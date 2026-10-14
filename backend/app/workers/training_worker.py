"""Training worker process entry point.

Runs in a separate ``spawn``-ed process so training never blocks the FastAPI event loop,
a crash cannot take the web server down, and GPU memory is released when the job ends.
The worker talks to the server only through a queue (events) and an Event (cancellation).
"""
from __future__ import annotations

import os
import time
import traceback
from typing import Any


def worker_main(spec: dict[str, Any], queue, cancel_event) -> None:
    os.environ["TORCH_HOME"] = str(spec["torch_home"])  # keep pretrained weights in the app data dir
    started = time.time()

    def emit(event_type: str, **payload: Any) -> None:
        queue.put({"type": event_type, "ts": time.time(), **payload})

    try:
        from app.ml.trainer import TrainingCancelled, TrainingFailure, run_training

        try:
            result = run_training(spec, emit, cancel_event.is_set)
            emit("result", result=result)
        except TrainingCancelled:
            emit("cancelled", message="Đã dừng huấn luyện theo yêu cầu.", elapsed_s=time.time() - started)
        except TrainingFailure as exc:
            emit("error", code=exc.code, message=exc.message)
    except Exception as exc:  # unexpected: report with a traceback tail for debugging
        emit(
            "error",
            code="TRAINING_CRASHED",
            message=f"Huấn luyện thất bại: {exc}",
            details=traceback.format_exc()[-1500:],
        )
