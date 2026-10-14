"""Inference endpoints (prediction + feedback)."""
from __future__ import annotations

import threading
import time
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.db import get_session
from app.core.errors import AppError, bad_request
from app.ml.checkpoints import CheckpointError
from app.ml.predictor import Predictor
from app.models.db_models import InferenceFeedback
from app.schemas.api import FeedbackIn, FeedbackStats, PredictionOut
from app.services import experiment_service as es
from app.services.image_ingest import ImageRejected, decode_for_inference

router = APIRouter(tags=["inference"])
SessionDep = Annotated[Session, Depends(get_session)]

_predictor: Predictor | None = None
_predictor_lock = threading.Lock()
# Server-side throttle: at most 2 predictions in flight. The client also never overlaps requests.
_slots = threading.BoundedSemaphore(2)


def get_predictor() -> Predictor:
    global _predictor
    with _predictor_lock:
        if _predictor is None:
            s = get_settings()
            _predictor = Predictor(s.checkpoints_dir, s.inference_device)
        return _predictor


def reset_predictor() -> None:
    global _predictor
    _predictor = None


@router.post("/inference/predict", response_model=PredictionOut)
async def predict(session: SessionDep, experiment_id: Annotated[str, Form()], image: Annotated[UploadFile, File()]):
    """Classify one image with a trained experiment's best checkpoint (runs on the Python backend)."""
    settings = get_settings()
    t0 = time.perf_counter()
    exp = es.get_experiment(session, experiment_id)
    data = await image.read(settings.max_upload_bytes + 1)
    try:
        pil = decode_for_inference(data, settings)
    except ImageRejected as exc:
        raise bad_request(exc.code, exc.message) from exc
    if not _slots.acquire(blocking=False):
        raise AppError(429, "SERVER_BUSY", "Máy chủ đang xử lý dự đoán khác, hãy thử lại sau giây lát.")
    try:
        result = await run_in_threadpool(get_predictor().predict, exp.checkpoint_path, pil)
    except CheckpointError as exc:
        raise AppError(422, "CHECKPOINT_INVALID", str(exc)) from exc
    finally:
        _slots.release()
    return PredictionOut(experiment_id=exp.id, total_ms=(time.perf_counter() - t0) * 1000, **result)


@router.post("/inference/feedback", response_model=FeedbackStats)
def feedback(body: FeedbackIn, session: SessionDep):
    """Records whether a prediction was judged correct, to give students a real accuracy tally."""
    exp = es.get_experiment(session, body.experiment_id)
    session.add(InferenceFeedback(
        experiment_id=exp.id, predicted_label=body.predicted_label, correct=body.correct,
        true_label=body.true_label, confidence=body.confidence,
    ))
    session.commit()
    return _stats(session, exp.id)


@router.get("/inference/feedback/{experiment_id}", response_model=FeedbackStats)
def feedback_stats(experiment_id: str, session: SessionDep):
    return _stats(session, es.get_experiment(session, experiment_id).id)


def _stats(session: Session, experiment_id: str) -> FeedbackStats:
    rows = list(session.exec(select(InferenceFeedback).where(InferenceFeedback.experiment_id == experiment_id)))
    correct = sum(1 for r in rows if r.correct)
    return FeedbackStats(experiment_id=experiment_id, total=len(rows), correct=correct,
                         accuracy=(correct / len(rows)) if rows else None)
