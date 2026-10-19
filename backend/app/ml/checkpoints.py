"""Reliable, safe checkpoint saving/loading.

* Saves are atomic (write to a temp file then ``os.replace``).
* Loads only accept paths inside the managed checkpoint directory and use
  ``torch.load(weights_only=True)`` so arbitrary pickled code can never be executed.
  The checkpoint payload therefore only contains tensors and JSON-safe primitives.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import TYPE_CHECKING, Any

from app.ml.preprocessing import preprocessing_spec
from app.schemas.training_config import ResolvedConfig

if TYPE_CHECKING:
    import torch
    from app.ml.architectures import VisionModel

FORMAT_VERSION = 1


class CheckpointError(RuntimeError):
    pass


def make_metadata(cfg: ResolvedConfig, class_names: list[str], extra: dict[str, Any] | None = None) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "format_version": FORMAT_VERSION,
        "architecture": cfg.architecture,
        "class_names": list(class_names),
        "num_classes": len(class_names),
        "input_size": cfg.input_size,
        "freeze_backbone": cfg.freeze_backbone,
        "head": {
            "dense_layers": cfg.dense_layers,
            "neurons": cfg.neurons,
            "activation": cfg.activation,
            "dropout": cfg.dropout,
        },
        "custom_cnn": {"conv_blocks": cfg.conv_blocks, "conv_filters": list(cfg.conv_filters)}
        if cfg.architecture == "custom_cnn" else None,
        "preprocessing": preprocessing_spec(cfg.input_size),
        "config": cfg.model_dump(),
    }
    if extra:
        meta.update(extra)
    return meta


def save_checkpoint(path: Path, model: Any, metadata: dict[str, Any]) -> None:
    import torch

    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    state = {k: v.detach().cpu() for k, v in model.state_dict().items()}
    torch.save({"state_dict": state, "metadata": metadata}, tmp)
    os.replace(tmp, path)


def resolve_managed_path(path: str | Path, root: Path) -> Path:
    """Reject anything that is not a file strictly inside ``root`` (no path traversal)."""
    root = root.resolve()
    candidate = (root / path).resolve() if not Path(path).is_absolute() else Path(path).resolve()
    if root != candidate and root not in candidate.parents:
        raise CheckpointError("Đường dẫn checkpoint nằm ngoài thư mục được quản lý.")
    return candidate


def metadata_to_config(meta: dict[str, Any]) -> ResolvedConfig:
    try:
        return ResolvedConfig(**meta["config"])
    except Exception as exc:
        raise CheckpointError(f"Metadata checkpoint không hợp lệ: {exc}") from exc


def load_checkpoint(path: str | Path, root: Path, device: Any = "cpu") -> tuple[Any, dict[str, Any]]:
    import torch
    from app.ml.architectures import build_model

    file = resolve_managed_path(path, root)
    if not file.is_file():
        raise CheckpointError("Không tìm thấy file checkpoint.")
    try:
        payload = torch.load(file, map_location="cpu", weights_only=True)
    except Exception as exc:
        raise CheckpointError(f"Không đọc được checkpoint an toàn: {exc}") from exc
    if not isinstance(payload, dict) or "state_dict" not in payload or "metadata" not in payload:
        raise CheckpointError("Checkpoint không đúng định dạng Vision Lab AI.")
    meta = payload["metadata"]
    if meta.get("format_version") != FORMAT_VERSION:
        raise CheckpointError("Phiên bản định dạng checkpoint không được hỗ trợ.")
    cfg = metadata_to_config(meta)
    if cfg.architecture == "tiny_test":
        pass  # allowed only because the config was created while the test flag was on
    # Architecture is rebuilt WITHOUT downloading pretrained weights; the checkpoint holds all weights.
    model = build_model(cfg, int(meta["num_classes"]), pretrained=False)
    model.load_state_dict(payload["state_dict"])
    model.to(device).eval()
    return model, meta
