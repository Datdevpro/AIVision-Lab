"""Experiments and model export endpoints."""
from __future__ import annotations

import json
import unicodedata
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse, Response
from sqlmodel import Session

from app.core.db import get_session
from app.core.errors import bad_request
from app.schemas.api import ExperimentDetail, ExperimentSummary, ExperimentUpdate
from app.services import experiment_service as es
from app.services.insights_service import generate_insights

router = APIRouter(tags=["experiments"])
SessionDep = Annotated[Session, Depends(get_session)]


def _ascii_slug(name: str) -> str:
    """HTTP header filenames must be latin-1; fold Vietnamese diacritics to plain ASCII."""
    folded = unicodedata.normalize("NFKD", name.replace("đ", "d").replace("Đ", "D")).encode("ascii", "ignore").decode()
    return "".join(ch if ch.isalnum() else "_" for ch in folded)[:40].strip("_") or "model"


@router.get("/experiments", response_model=list[ExperimentSummary])
def list_experiments(session: SessionDep, project_id: str | None = None):
    return [es.summary_dict(e) for e in es.list_experiments(session, project_id)]


@router.get("/experiments/summary.csv")
def experiments_csv(session: SessionDep, project_id: str | None = None):
    csv_text = es.project_summary_csv(es.list_experiments(session, project_id))
    return Response(csv_text, media_type="text/csv; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="experiments.csv"'})


@router.get("/experiments/compare")
def compare(session: SessionDep, a: str, b: str):
    if a == b:
        raise bad_request("SAME_EXPERIMENT", "Hãy chọn hai thử nghiệm khác nhau.")
    return es.compare(es.get_experiment(session, a), es.get_experiment(session, b))


@router.get("/experiments/{experiment_id}", response_model=ExperimentDetail)
def get_experiment(experiment_id: str, session: SessionDep):
    return es.detail_dict(es.get_experiment(session, experiment_id))


@router.get("/experiments/{experiment_id}/metrics")
def get_metrics(experiment_id: str, session: SessionDep):
    e = es.get_experiment(session, experiment_id)
    return {"experiment_id": e.id, "epochs": e.epoch_metrics, "best_epoch": (e.best_checkpoint or {}).get("epoch")}


@router.get("/experiments/{experiment_id}/insights")
def get_insights(experiment_id: str, session: SessionDep):
    e = es.get_experiment(session, experiment_id)
    return {"insights": generate_insights(e.epoch_metrics, e.config, e.dataset_summary, e.evaluation, finished=True)}


@router.patch("/experiments/{experiment_id}", response_model=ExperimentSummary)
def rename_experiment(experiment_id: str, body: ExperimentUpdate, session: SessionDep):
    return es.summary_dict(es.rename_experiment(session, experiment_id, body.name))


@router.delete("/experiments/{experiment_id}", status_code=204)
def delete_experiment(experiment_id: str, session: SessionDep):
    es.delete_experiment(session, experiment_id)


@router.get("/models/{experiment_id}/export")
def export_model(
    experiment_id: str, session: SessionDep,
    format: str = Query("checkpoint", pattern="^(checkpoint|metadata|labels|metrics_csv|onnx)$"),
):
    """Download an artifact: PyTorch checkpoint, metadata JSON, label mapping, metrics CSV or ONNX."""
    e = es.get_experiment(session, experiment_id)
    safe = _ascii_slug(e.name)
    base = f"{safe}_{e.id[:6]}"
    if format == "checkpoint":
        return FileResponse(es.checkpoint_file(e), media_type="application/octet-stream", filename=f"{base}.pt")
    if format == "onnx":
        return FileResponse(es.export_onnx(e), media_type="application/octet-stream", filename=f"{base}.onnx")
    if format == "metadata":
        body, mt, fn = json.dumps(es.export_metadata(e), ensure_ascii=False, indent=2), "application/json", f"{base}_metadata.json"
    elif format == "labels":
        body, mt, fn = json.dumps(es.labels_json(e), ensure_ascii=False, indent=2), "application/json", f"{base}_labels.json"
    else:
        body, mt, fn = es.epoch_metrics_csv(e), "text/csv; charset=utf-8", f"{base}_metrics.csv"
    return Response(body, media_type=mt, headers={"Content-Disposition": f'attachment; filename="{fn}"'})
