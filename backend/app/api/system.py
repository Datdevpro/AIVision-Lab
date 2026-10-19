"""System endpoints: health, capabilities, parameter specs, pretrained-weights prefetch."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.param_specs import MODES, PARAM_SPECS
from app.services.experiment_service import onnx_available
from app.services.training_service import manager

router = APIRouter(tags=["system"])
public_router = APIRouter(tags=["system"])

WEIGHTS_FILE = "mobilenet_v3_small-047dcff4.pth"


@public_router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "vision-lab-ai"}


def _weights_cached() -> bool:
    return (get_settings().torch_home / "hub" / "checkpoints" / WEIGHTS_FILE).is_file()


_cached_static_capabilities: dict[str, Any] | None = None


def _get_static_capabilities() -> dict[str, Any]:
    global _cached_static_capabilities
    if _cached_static_capabilities is not None:
        return _cached_static_capabilities
    import torch
    import torchvision

    s = get_settings()
    cuda = torch.cuda.is_available()
    device: dict[str, Any] = {"type": "cuda" if cuda and s.device_pref != "cpu" else "cpu", "cuda_available": cuda,
                              "name": "CPU", "vram_gb": None, "preference": s.device_pref}
    if cuda:
        props = torch.cuda.get_device_properties(0)
        device["vram_gb"] = round(props.total_memory / 1024**3, 1)
        if device["type"] == "cuda":
            device["name"] = props.name
    _cached_static_capabilities = {
        "device": device,
        "torch_version": torch.__version__,
        "torchvision_version": torchvision.__version__,
        "onnx_available": onnx_available(),
    }
    return _cached_static_capabilities


@router.get("/system/capabilities")
def capabilities() -> dict[str, Any]:
    s = get_settings()
    static = _get_static_capabilities()
    active = manager.active_job()
    return {
        "device": static["device"],
        "torch_version": static["torch_version"], "torchvision_version": static["torchvision_version"],
        "pretrained_weights_cached": _weights_cached(),
        "onnx_available": static["onnx_available"],
        "modes": MODES,
        "advanced_mode_enabled": True,
        "training_busy": bool(active and active.status not in {"completed", "cancelled", "failed"}),
        "limits": {
            "max_upload_mb": s.max_upload_bytes // (1024 * 1024), "max_image_dimension": s.max_image_dimension,
            "max_images_per_class": s.max_images_per_class, "max_images_per_project": s.max_images_per_project,
            "max_classes": s.max_classes, "max_files_per_request": s.max_files_per_request,
            "max_epochs": s.max_epochs, "max_batch_size": s.max_batch_size,
            "max_custom_cnn_params": s.max_custom_cnn_params,
            "allowed_image_types": ["image/jpeg", "image/png", "image/webp"],
        },
        "privacy": "Dữ liệu được lưu cục bộ trên máy chủ này; không gửi tới dịch vụ bên thứ ba.",
        "auth_required": bool(s.api_token),
    }


@router.get("/system/parameters")
def parameters() -> dict[str, Any]:
    return {"parameters": PARAM_SPECS, "modes": MODES}


@router.post("/system/prefetch-weights")
async def prefetch_weights() -> dict[str, Any]:
    """Download MobileNetV3-Small ImageNet weights now so training does not fail later. Errors are reported, never faked."""
    def _run() -> None:
        import torch

        from app.ml.architectures import load_mobilenet_extractor

        s = get_settings()
        s.ensure_dirs()
        torch.hub.set_dir(str(s.torch_home / "hub"))
        load_mobilenet_extractor(pretrained=True)

    try:
        await run_in_threadpool(_run)
    except Exception as exc:
        raise AppError(502, "PRETRAINED_WEIGHTS_UNAVAILABLE", str(exc)) from exc
    return {"pretrained_weights_cached": _weights_cached()}
