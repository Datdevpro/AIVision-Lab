"""Training orchestration (web side).

Responsibilities: validate + split the dataset, spawn ONE worker process, consume its events,
mirror them into job state / the database / WebSocket subscribers, and create the experiment
record when a run succeeds. No ML code lives here (see app.ml.*).
"""
from __future__ import annotations

import asyncio
import multiprocessing as mp
import queue as queue_mod
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.db import session_scope
from app.core.errors import AppError, bad_request, conflict, not_found
from app.models.db_models import Experiment, TrainingJob, new_id, utcnow
from app.schemas.training_config import TrainingConfig, estimate_params, resolve_config
from app.services import dataset_logic as logic
from app.services import dataset_service
from app.workers.training_worker import worker_main

TERMINAL = {"completed", "cancelled", "failed"}
CANCEL_GRACE_S = 20.0


@dataclass
class JobState:
    id: str
    project_id: str
    config: dict[str, Any]
    dataset_summary: dict[str, Any]
    total_epochs: int
    experiment_name: str | None = None
    status: str = "preparing"
    message: str | None = "Đang chuẩn bị…"
    epochs: list[dict[str, Any]] = field(default_factory=list)
    progress: float = 0.0
    batch: dict[str, Any] | None = None
    device: str | None = None
    device_name: str | None = None
    param_counts: dict[str, Any] | None = None
    error: dict[str, Any] | None = None
    experiment_id: str | None = None
    created_at: datetime = field(default_factory=utcnow)
    started_mono: float = field(default_factory=time.monotonic)
    finished_mono: float | None = None
    cancel_requested_mono: float | None = None
    class_names: list[str] = field(default_factory=list)
    fingerprints: tuple[str, str] = ("", "")

    def elapsed(self) -> float:
        return (self.finished_mono or time.monotonic()) - self.started_mono

    def snapshot(self) -> dict[str, Any]:
        return {
            "id": self.id, "project_id": self.project_id, "status": self.status, "message": self.message,
            "config": self.config, "dataset_summary": self.dataset_summary, "epochs": list(self.epochs),
            "total_epochs": self.total_epochs, "progress": self.progress, "batch": self.batch,
            "device": self.device, "device_name": self.device_name, "param_counts": self.param_counts,
            "error": self.error, "experiment_id": self.experiment_id, "elapsed_s": self.elapsed(),
            "created_at": self.created_at,
        }


class TrainingManager:
    """At most one active training job. Jobs run in a spawned process, never in the event loop."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._ctx = mp.get_context("spawn")
        self._active: str | None = None
        self._procs: dict[str, tuple[Any, Any]] = {}  # job_id -> (process, cancel_event)
        self._jobs: dict[str, JobState] = {}
        self._subs: dict[str, set[asyncio.Queue]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    # ---------------------------------------------------------------- lifecycle
    def attach_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def active_job(self) -> JobState | None:
        return self._jobs.get(self._active) if self._active else None

    def get_state(self, job_id: str) -> JobState | None:
        return self._jobs.get(job_id)

    def recover_orphans(self) -> None:
        """Jobs left in a non-terminal state by a previous server run can never finish."""
        with session_scope() as s:
            for j in s.exec(select(TrainingJob)):
                if j.status not in TERMINAL:
                    j.status = "failed"
                    j.error = {"code": "SERVER_RESTARTED", "message": "Máy chủ đã khởi động lại khi đang huấn luyện."}
                    j.finished_at = utcnow()
                    s.add(j)
            s.commit()

    # ---------------------------------------------------------------- start
    def start(self, session: Session, project_id: str, config: TrainingConfig, experiment_name: str | None) -> JobState:
        settings = get_settings()
        dataset_service.get_project(session, project_id)
        try:
            cfg = resolve_config(config, allow_test_backbone=settings.allow_test_backbone)
        except ValueError as exc:
            raise bad_request("INVALID_CONFIG", str(exc)) from exc
        if cfg.epochs > settings.max_epochs or cfg.batch_size > settings.max_batch_size:
            raise bad_request("LIMIT_EXCEEDED", "Cấu hình vượt giới hạn an toàn của máy chủ.")

        items, classes, records = dataset_service.project_items(session, project_id)
        summary = logic.build_summary(items, classes, cfg.split_strategy, cfg.val_split, cfg.seed)
        errors = logic.validate_for_training(summary)
        if errors:
            raise AppError(400, "DATASET_INVALID", "Dữ liệu chưa đủ điều kiện để huấn luyện.", errors)
        est = estimate_params(cfg, len(classes))
        if cfg.architecture == "custom_cnn" and est["total_params"] > settings.max_custom_cnn_params:
            raise bad_request(
                "MODEL_TOO_LARGE",
                f"CNN ước tính {est['total_params']:,} tham số, vượt giới hạn {settings.max_custom_cnn_params:,}. Hãy giảm số filter/neuron.",
            )

        assignment: dict[str, str] = summary.pop("assignment")
        label_of = {cid: idx for idx, (cid, _) in enumerate(classes)}
        spec_items = [
            {
                "id": it.id,
                "path": str((settings.projects_dir / records[it.id].rel_path).resolve()),
                "label": label_of[it.class_id],
                "split": assignment[it.id],
            }
            for it in items
            if assignment[it.id] in ("train", "val", "test")
        ]

        with self._lock:
            if self._active and self._jobs[self._active].status not in TERMINAL:
                raise conflict("TRAINING_ALREADY_RUNNING", "Đang có một phiên huấn luyện khác. Hãy chờ hoặc dừng nó trước.",
                               {"job_id": self._active})
            job_id = new_id()
            state = JobState(
                id=job_id, project_id=project_id, config=cfg.model_dump(), dataset_summary=summary,
                total_epochs=cfg.epochs, experiment_name=experiment_name,
                class_names=[n for _, n in classes],
                fingerprints=(summary["dataset_fingerprint"], summary["split_fingerprint"]),
            )
            spec = {
                "job_id": job_id, "config": cfg.model_dump(), "class_names": state.class_names,
                "items": spec_items, "output_dir": str(settings.checkpoints_dir / job_id),
                "device_pref": settings.device_pref, "torch_home": str(settings.torch_home),
            }
            settings.ensure_dirs()
            q = self._ctx.Queue()
            cancel_event = self._ctx.Event()
            proc = self._ctx.Process(target=worker_main, args=(spec, q, cancel_event), name=f"train-{job_id[:6]}", daemon=True)
            self._jobs[job_id] = state
            self._procs[job_id] = (proc, cancel_event)
            self._active = job_id
            self._trim_history()
            self._persist(state, started=True)
            proc.start()
            threading.Thread(target=self._consume, args=(state, proc, q), name=f"consume-{job_id[:6]}", daemon=True).start()
        return state

    def _trim_history(self) -> None:
        done = [k for k, v in self._jobs.items() if v.status in TERMINAL]
        for k in done[:-20]:
            self._jobs.pop(k, None)

    # ---------------------------------------------------------------- cancel
    def cancel(self, job_id: str) -> JobState:
        state = self._jobs.get(job_id)
        if state is None:
            raise not_found("phiên huấn luyện")
        if state.status in TERMINAL:
            raise conflict("JOB_NOT_ACTIVE", "Phiên huấn luyện đã kết thúc.")
        _, cancel_event = self._procs[job_id]
        cancel_event.set()
        state.cancel_requested_mono = time.monotonic()
        state.message = "Đang dừng huấn luyện…"
        self._publish(state, {"type": "log", "message": state.message})
        return state

    # ---------------------------------------------------------------- event consumption (thread)
    def _consume(self, state: JobState, proc, q) -> None:
        terminal_seen = False
        try:
            while True:
                try:
                    event = q.get(timeout=0.5)
                except queue_mod.Empty:
                    if state.cancel_requested_mono and proc.is_alive() and (
                        time.monotonic() - state.cancel_requested_mono > CANCEL_GRACE_S
                    ):
                        proc.terminate()  # e.g. stuck in a weights download
                    if not proc.is_alive():
                        # drain whatever the worker flushed before exiting
                        while True:
                            try:
                                event = q.get(timeout=0.3)
                            except queue_mod.Empty:
                                break
                            terminal_seen = self._handle(state, event) or terminal_seen
                        break
                    continue
                if self._handle(state, event):
                    terminal_seen = True
                    break
            if not terminal_seen:
                if state.cancel_requested_mono:
                    self._finish(state, "cancelled", message="Đã dừng huấn luyện.")
                else:
                    self._finish(state, "failed", error={
                        "code": "WORKER_DIED", "message": f"Tiến trình huấn luyện thoát bất ngờ (mã {proc.exitcode}). Có thể thiếu RAM/VRAM.",
                    })
        except Exception as exc:  # never let the consumer die silently
            self._finish(state, "failed", error={"code": "INTERNAL_ERROR", "message": str(exc)})
        finally:
            proc.join(timeout=10)
            if proc.is_alive():
                proc.terminate()
            with self._lock:
                self._procs.pop(state.id, None)
                if self._active == state.id:
                    self._active = None

    def _handle(self, state: JobState, e: dict[str, Any]) -> bool:
        """Apply one worker event. Returns True when the event is terminal."""
        t = e["type"]
        if t == "status":
            state.status, state.message = e["status"], e.get("message")
            if state.cancel_requested_mono:
                state.message = "Đang dừng huấn luyện…"
        elif t == "device":
            state.device, state.device_name = e["device"], e["device_name"]
        elif t == "model":
            state.param_counts = e["param_counts"]
        elif t == "batch":
            state.batch = {k: e[k] for k in ("epoch", "batch", "total_batches", "loss", "accuracy")}
            state.progress = e["progress"]
        elif t == "epoch":
            state.epochs.append(e["metrics"])
            state.progress = e["metrics"]["epoch"] / state.total_epochs
            self._persist(state)
        elif t == "log":
            state.message = e["message"]
        elif t == "result":
            self._on_result(state, e["result"])
            return True
        elif t == "cancelled":
            self._finish(state, "cancelled", message=e.get("message"))
            return True
        elif t == "error":
            self._finish(state, "failed", error={"code": e["code"], "message": e["message"], "details": e.get("details")})
            return True
        self._publish(state, e)
        return False

    def _on_result(self, state: JobState, result: dict[str, Any]) -> None:
        settings = get_settings()
        with session_scope() as s:
            existing = len(s.exec(select(Experiment.id).where(Experiment.project_id == state.project_id)).all())
            best = result["best"]
            cfg = state.config
            exp = Experiment(
                project_id=state.project_id, job_id=state.id,
                name=(state.experiment_name or f"Thử nghiệm #{existing + 1}").strip(),
                mode=cfg["mode"], architecture=cfg["architecture"], config=cfg, class_names=state.class_names,
                dataset_summary=state.dataset_summary, dataset_fingerprint=state.fingerprints[0],
                split_fingerprint=state.fingerprints[1], seed=cfg["seed"], epoch_metrics=result["epochs"],
                best_checkpoint={**best, "file": result["checkpoint_file"], "path": f"{state.id}/{result['checkpoint_file']}"},
                evaluation=result["evaluation"],
                param_counts=result["param_counts"], duration_s=result["duration_s"], device=result["device"],
                checkpoint_path=f"{state.id}/{result['checkpoint_file']}",
            )
            exp.evaluation = {**result["evaluation"], "stopped_early": result["stopped_early"],
                              "split_sizes": result["split_sizes"], "feature_cache": result["feature_cache"]}
            s.add(exp)
            s.commit()
            state.experiment_id = exp.id
        state.progress = 1.0
        state.device, state.device_name = result["device"], result["device_name"]
        self._finish(state, "completed", message="Huấn luyện hoàn tất. Checkpoint tốt nhất đã được lưu.")

    def _finish(self, state: JobState, status: str, message: str | None = None, error: dict | None = None) -> None:
        state.status = status
        state.message = message or (error or {}).get("message")
        state.error = error
        state.finished_mono = time.monotonic()
        self._persist(state, finished=True)
        if status != "completed":  # nothing useful to keep
            import shutil
            shutil.rmtree(get_settings().checkpoints_dir / state.id, ignore_errors=True)
        self._publish(state, {"type": "job", "job": _jsonable(state.snapshot())})

    # ---------------------------------------------------------------- persistence + pub/sub
    def _persist(self, state: JobState, started: bool = False, finished: bool = False) -> None:
        with session_scope() as s:
            row = s.get(TrainingJob, state.id) or TrainingJob(id=state.id, project_id=state.project_id)
            row.status, row.config, row.dataset_summary = state.status, state.config, state.dataset_summary
            row.epochs, row.error, row.experiment_id = state.epochs, state.error, state.experiment_id
            row.device, row.total_epochs = state.device, state.total_epochs
            if started:
                row.started_at = utcnow()
            if finished:
                row.finished_at = utcnow()
            s.add(row)
            s.commit()

    def _publish(self, state: JobState, event: dict[str, Any]) -> None:
        payload = _jsonable({**event, "job_status": state.status, "elapsed_s": state.elapsed()})
        payload.pop("ts", None)
        if self._loop is None:
            return
        self._loop.call_soon_threadsafe(self._fanout, state.id, payload)

    def _fanout(self, job_id: str, payload: dict[str, Any]) -> None:
        for q in list(self._subs.get(job_id, ())):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:  # slow client: drop; it can re-sync from the snapshot
                pass

    def subscribe(self, job_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        self._subs.setdefault(job_id, set()).add(q)
        return q

    def unsubscribe(self, job_id: str, q: asyncio.Queue) -> None:
        self._subs.get(job_id, set()).discard(q)
        if not self._subs.get(job_id):
            self._subs.pop(job_id, None)

    # ---------------------------------------------------------------- queries
    def job_snapshot(self, job_id: str) -> dict[str, Any] | None:
        state = self._jobs.get(job_id)
        if state:
            return state.snapshot()
        with session_scope() as s:
            row = s.get(TrainingJob, job_id)
            if not row:
                return None
            done = row.epochs[-1]["epoch"] / row.total_epochs if row.epochs and row.total_epochs else 0.0
            dur = ((row.finished_at or utcnow()) - row.started_at).total_seconds() if row.started_at else 0.0
            return {
                "id": row.id, "project_id": row.project_id, "status": row.status, "message": (row.error or {}).get("message"),
                "config": row.config, "dataset_summary": row.dataset_summary, "epochs": row.epochs,
                "total_epochs": row.total_epochs, "progress": 1.0 if row.status == "completed" else done, "batch": None,
                "device": row.device, "device_name": None, "param_counts": None, "error": row.error,
                "experiment_id": row.experiment_id, "elapsed_s": dur, "created_at": row.created_at,
            }

    def shutdown(self) -> None:
        for job_id, (proc, ev) in list(self._procs.items()):
            ev.set()
            proc.join(timeout=3)
            if proc.is_alive():
                proc.terminate()


def _jsonable(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_jsonable(v) for v in obj]
    return obj


manager = TrainingManager()
