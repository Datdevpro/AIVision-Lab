"""Experiments: queries, comparison (with fairness checks) and export artifacts."""
from __future__ import annotations

import csv
import io
import json
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.errors import AppError, not_found
from app.ml.checkpoints import make_metadata, resolve_managed_path
from app.models.db_models import Experiment
from app.services.dataset_service import delete_experiment_files

EPOCH_COLUMNS = ["epoch", "total_epochs", "train_loss", "val_loss", "train_accuracy", "val_accuracy", "learning_rate", "elapsed_s"]


def get_experiment(session: Session, experiment_id: str) -> Experiment:
    e = session.get(Experiment, experiment_id)
    if not e:
        raise not_found("thử nghiệm")
    return e


def list_experiments(session: Session, project_id: str | None = None) -> list[Experiment]:
    q = select(Experiment).order_by(Experiment.created_at.desc())
    if project_id:
        q = q.where(Experiment.project_id == project_id)
    return list(session.exec(q))


def delete_experiment(session: Session, experiment_id: str) -> None:
    e = get_experiment(session, experiment_id)
    delete_experiment_files(e)
    session.delete(e)
    session.commit()


def rename_experiment(session: Session, experiment_id: str, name: str) -> Experiment:
    e = get_experiment(session, experiment_id)
    e.name = name.strip()
    session.add(e)
    session.commit()
    session.refresh(e)
    return e


def latest_experiment_id(session: Session, project_id: str) -> str | None:
    e = session.exec(select(Experiment.id).where(Experiment.project_id == project_id).order_by(Experiment.created_at.desc())).first()
    return e


def summary_dict(e: Experiment) -> dict[str, Any]:
    best = e.best_checkpoint or {}
    test = (e.evaluation or {}).get("test") or {}
    last = e.epoch_metrics[-1] if e.epoch_metrics else {}
    return {
        "id": e.id, "project_id": e.project_id, "name": e.name, "mode": e.mode, "architecture": e.architecture,
        "created_at": e.created_at, "seed": e.seed, "duration_s": e.duration_s, "device": e.device,
        "config": e.config, "class_names": e.class_names, "dataset_fingerprint": e.dataset_fingerprint,
        "split_fingerprint": e.split_fingerprint, "best_epoch": best.get("epoch"),
        "best_val_accuracy": best.get("val_accuracy"), "best_val_loss": best.get("val_loss"),
        "final_train_accuracy": last.get("train_accuracy"), "test_accuracy": test.get("accuracy"),
        "num_epochs": len(e.epoch_metrics), "param_counts": e.param_counts,
    }


def detail_dict(e: Experiment) -> dict[str, Any]:
    return {**summary_dict(e), "dataset_summary": e.dataset_summary, "epoch_metrics": e.epoch_metrics,
            "best_checkpoint": e.best_checkpoint, "evaluation": e.evaluation, "metadata": export_metadata(e)}


# ---------------------------------------------------------------- comparison
_IGNORED_KEYS = {"test_backbone"}


def compare(a: Experiment, b: Experiment) -> dict[str, Any]:
    keys = sorted((set(a.config) | set(b.config)) - _IGNORED_KEYS)
    diff = [{"key": k, "a": a.config.get(k), "b": b.config.get(k)} for k in keys if a.config.get(k) != b.config.get(k)]
    same_dataset = a.dataset_fingerprint == b.dataset_fingerprint
    same_split = a.split_fingerprint == b.split_fingerprint
    warnings: list[str] = []
    if not same_dataset:
        warnings.append("Hai thử nghiệm dùng bộ ảnh khác nhau (dữ liệu đã thay đổi giữa hai lần train), nên không nên kết luận chỉ dựa vào accuracy.")
    if not same_split:
        warnings.append(
            "Hai thử nghiệm dùng cách chia train/validation khác nhau, vì vậy validation accuracy của chúng có thể không so sánh công bằng trực tiếp. "
            "Để so sánh công bằng, giữ nguyên dữ liệu, cách chia và random seed."
        )
    for e, tag in ((a, "A"), (b, "B")):
        nval = (e.dataset_summary or {}).get("split", {}).get("val", 0)
        if nval and nval < 20:
            warnings.append(f"Thử nghiệm {tag} chỉ có {nval} ảnh validation: chênh lệch nhỏ giữa hai kết quả có thể chỉ là do may rủi.")
    key = lambda e: ((e.best_checkpoint or {}).get("val_accuracy", 0.0), -(e.best_checkpoint or {}).get("val_loss", 1e9))  # noqa: E731
    ka, kb = key(a), key(b)
    best = "tie" if ka == kb else ("a" if ka > kb else "b")
    return {
        "a": summary_dict(a), "b": summary_dict(b), "config_diff": diff,
        "same_dataset": same_dataset, "same_split": same_split, "fair": same_dataset and same_split,
        "warnings": warnings, "best_by_validation": best,
        "best_basis": "Dựa trên validation accuracy của checkpoint tốt nhất (hoà thì xét validation loss thấp hơn), không dựa trên training accuracy.",
    }


# ---------------------------------------------------------------- exports
def export_metadata(e: Experiment) -> dict[str, Any]:
    from app.schemas.training_config import ResolvedConfig

    meta = make_metadata(ResolvedConfig(**e.config), list(e.class_names), {
        "experiment_id": e.id, "experiment_name": e.name, "created_at": e.created_at.isoformat(),
        "dataset_fingerprint": e.dataset_fingerprint, "split_fingerprint": e.split_fingerprint,
        "best_checkpoint": {k: v for k, v in (e.best_checkpoint or {}).items() if k != "path"},
        "param_counts": e.param_counts,
        "validation": {k: v for k, v in ((e.evaluation or {}).get("validation") or {}).items() if k in ("accuracy", "precision_macro", "recall_macro", "f1_macro", "num_samples")},
        "test": {k: v for k, v in ((e.evaluation or {}).get("test") or {}).items() if k in ("accuracy", "precision_macro", "recall_macro", "f1_macro", "num_samples")} or None,
        "how_to_load": (
            "ckpt = torch.load('model.pt', weights_only=True); rebuild the architecture described in 'architecture', 'head' and "
            "'custom_cnn'; model.load_state_dict(ckpt['state_dict']). Preprocess with the 'preprocessing' section."
        ),
    })
    return meta


def labels_json(e: Experiment) -> dict[str, Any]:
    return {"labels": list(e.class_names), "index_to_label": {str(i): n for i, n in enumerate(e.class_names)}}


def epoch_metrics_csv(e: Experiment) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(EPOCH_COLUMNS)
    for row in e.epoch_metrics:
        w.writerow([row.get(c) for c in EPOCH_COLUMNS])
    return buf.getvalue()


def project_summary_csv(experiments: list[Experiment]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    cols = ["id", "name", "mode", "architecture", "created_at", "seed", "epochs", "learning_rate", "batch_size", "optimizer",
            "best_epoch", "best_val_accuracy", "best_val_loss", "test_accuracy", "duration_s", "device", "split_fingerprint"]
    w.writerow(cols)
    for e in experiments:
        s = summary_dict(e)
        c = e.config
        w.writerow([s["id"], s["name"], s["mode"], s["architecture"], s["created_at"].isoformat(), s["seed"], c.get("epochs"),
                    c.get("learning_rate"), c.get("batch_size"), c.get("optimizer"), s["best_epoch"], s["best_val_accuracy"],
                    s["best_val_loss"], s["test_accuracy"], s["duration_s"], s["device"], s["split_fingerprint"]])
    return buf.getvalue()


def checkpoint_file(e: Experiment) -> Path:
    path = resolve_managed_path(e.checkpoint_path, get_settings().checkpoints_dir)
    if not path.is_file():
        raise not_found("file checkpoint")
    return path


def onnx_available() -> bool:
    try:
        import onnx  # noqa: F401
        return True
    except Exception:
        return False


def export_onnx(e: Experiment) -> Path:
    import torch

    from app.ml.checkpoints import load_checkpoint

    ckpt = checkpoint_file(e)
    out = ckpt.with_name("model.onnx")
    if out.is_file() and out.stat().st_mtime >= ckpt.stat().st_mtime:
        return out
    model, meta = load_checkpoint(e.checkpoint_path, get_settings().checkpoints_dir, "cpu")
    size = int(meta["input_size"])
    try:
        torch.onnx.export(
            model, torch.randn(1, 3, size, size), str(out), input_names=["image"], output_names=["logits"],
            dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}}, opset_version=17, dynamo=False,
        )
    except Exception as exc:
        out.unlink(missing_ok=True)
        raise AppError(501, "ONNX_EXPORT_FAILED", f"Không xuất được ONNX trong môi trường này: {exc}") from exc
    return out
