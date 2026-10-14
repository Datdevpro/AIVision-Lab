"""Training endpoints + live WebSocket stream."""
from __future__ import annotations

import asyncio
import re
from typing import Annotated, Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from sqlmodel import Session

from app.api.deps import token_ok
from app.core.config import get_settings
from app.core.db import get_session
from app.core.errors import not_found
from app.schemas.api import EstimateRequest, JobOut, TrainingStartRequest
from app.schemas.training_config import resolve_config, estimate_params
from app.services.insights_service import generate_insights
from app.services.training_service import TERMINAL, _jsonable, manager

router = APIRouter(tags=["training"])
ws_router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]
JOB_ID_RE = re.compile(r"^[0-9a-f]{32}$")


@router.post("/training/start", response_model=JobOut)
def start_training(body: TrainingStartRequest, session: SessionDep):
    """Validates the dataset and config, then launches ONE background worker process."""
    state = manager.start(session, body.project_id, body.config, body.experiment_name)
    return state.snapshot()


@router.post("/training/estimate")
def estimate(body: EstimateRequest):
    """Parameter-count estimate shown before training (no weights are loaded)."""
    try:
        cfg = resolve_config(body.config, allow_test_backbone=get_settings().allow_test_backbone)
    except ValueError as exc:
        from app.core.errors import bad_request
        raise bad_request("INVALID_CONFIG", str(exc)) from exc
    est = estimate_params(cfg, body.num_classes)
    limit = get_settings().max_custom_cnn_params
    return {**est, "architecture": cfg.architecture, "freeze_backbone": cfg.freeze_backbone,
            "input_size": cfg.input_size, "limit": limit if cfg.architecture == "custom_cnn" else None,
            "within_limit": cfg.architecture != "custom_cnn" or est["total_params"] <= limit}


@router.get("/training/active")
def active_job():
    """The running job (if any) so the UI can re-attach after a page refresh."""
    state = manager.active_job()
    return {"job": state.snapshot() if state and state.status not in TERMINAL else None}


@router.get("/training/{job_id}", response_model=JobOut)
def get_job(job_id: str):
    snap = manager.job_snapshot(job_id) if JOB_ID_RE.match(job_id) else None
    if not snap:
        raise not_found("phiên huấn luyện")
    return snap


@router.post("/training/{job_id}/cancel", response_model=JobOut)
def cancel_job(job_id: str):
    if not JOB_ID_RE.match(job_id):
        raise not_found("phiên huấn luyện")
    return manager.cancel(job_id).snapshot()


@router.get("/training/{job_id}/insights")
def job_insights(job_id: str):
    """Rule-based insights from the metrics measured so far (works while training is running)."""
    snap = manager.job_snapshot(job_id) if JOB_ID_RE.match(job_id) else None
    if not snap:
        raise not_found("phiên huấn luyện")
    finished = snap["status"] in TERMINAL
    return {"insights": generate_insights(snap["epochs"], snap["config"], snap["dataset_summary"], None, finished=finished)}


@ws_router.websocket("/ws/training/{job_id}")
async def training_ws(ws: WebSocket, job_id: str):
    """Streams worker events: status, batch, epoch, checkpoint, log and the final job snapshot."""
    if not token_ok(ws.query_params.get("token")):
        await ws.close(code=4401)
        return
    snap = await run_in_threadpool(manager.job_snapshot, job_id) if JOB_ID_RE.match(job_id) else None
    if snap is None:
        await ws.close(code=4404)
        return
    await ws.accept()
    q = manager.subscribe(job_id)
    try:
        await ws.send_json({"type": "snapshot", "job": _jsonable(snap)})
        if snap["status"] in TERMINAL:
            await ws.close()
            return
        while True:
            try:
                payload: dict[str, Any] = await asyncio.wait_for(q.get(), timeout=15)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "ping"})
                continue
            await ws.send_json(payload)
            if payload.get("type") == "job" and payload.get("job", {}).get("status") in TERMINAL:
                await ws.close()
                return
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        manager.unsubscribe(job_id, q)
