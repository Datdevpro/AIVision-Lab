"""Application settings, read from environment variables (prefix ``VISIONLAB_``).

Everything is local-first: by default the server binds to 127.0.0.1 and stores
all data (database, images, checkpoints) in ``backend/data``.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent


def _env(name: str, default: str | None = None) -> str | None:
    return os.environ.get(f"VISIONLAB_{name}", default)


def _env_int(name: str, default: int) -> int:
    raw = _env(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool = False) -> bool:
    raw = _env(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    host: str
    port: int
    cors_origins: tuple[str, ...]
    api_token: str | None
    # --- upload / dataset limits -------------------------------------------------
    max_upload_bytes: int
    max_image_dimension: int  # reject images whose width or height exceeds this
    max_image_pixels: int  # decompression-bomb guard
    stored_max_side: int  # images are downscaled to this on the backend
    max_images_per_class: int
    max_images_per_project: int
    max_classes: int
    max_files_per_request: int
    # --- training limits ---------------------------------------------------------
    max_epochs: int
    max_batch_size: int
    max_custom_cnn_params: int
    # --- devices -----------------------------------------------------------------
    device_pref: str  # auto | cpu | cuda
    inference_device: str  # auto | cpu
    # --- testing -----------------------------------------------------------------
    allow_test_backbone: bool
    frontend_dist: Path

    @property
    def db_path(self) -> Path:
        return self.data_dir / "visionlab.sqlite3"

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"

    @property
    def checkpoints_dir(self) -> Path:
        return self.data_dir / "checkpoints"

    @property
    def torch_home(self) -> Path:
        return Path(_env("TORCH_HOME") or (self.data_dir / "torch_cache"))

    def ensure_dirs(self) -> None:
        for p in (self.data_dir, self.projects_dir, self.checkpoints_dir, self.torch_home):
            p.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    data_dir = Path(_env("DATA_DIR") or (BACKEND_ROOT / "data")).resolve()
    origins_raw = _env(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    )
    origins = tuple(o.strip() for o in (origins_raw or "").split(",") if o.strip())
    token = _env("API_TOKEN")
    return Settings(
        data_dir=data_dir,
        host=_env("HOST", "127.0.0.1") or "127.0.0.1",
        port=_env_int("PORT", 8000),
        cors_origins=origins,
        api_token=token or None,
        max_upload_bytes=_env_int("MAX_UPLOAD_MB", 8) * 1024 * 1024,
        max_image_dimension=_env_int("MAX_IMAGE_DIMENSION", 6000),
        max_image_pixels=_env_int("MAX_IMAGE_PIXELS", 36_000_000),
        stored_max_side=_env_int("STORED_MAX_SIDE", 512),
        max_images_per_class=_env_int("MAX_IMAGES_PER_CLASS", 500),
        max_images_per_project=_env_int("MAX_IMAGES_PER_PROJECT", 2000),
        max_classes=_env_int("MAX_CLASSES", 10),
        max_files_per_request=_env_int("MAX_FILES_PER_REQUEST", 50),
        max_epochs=_env_int("MAX_EPOCHS", 50),
        max_batch_size=_env_int("MAX_BATCH_SIZE", 64),
        max_custom_cnn_params=_env_int("MAX_CUSTOM_CNN_PARAMS", 2_000_000),
        device_pref=(_env("DEVICE", "auto") or "auto").lower(),
        inference_device=(_env("INFERENCE_DEVICE", "auto") or "auto").lower(),
        allow_test_backbone=_env_bool("ALLOW_TEST_BACKBONE", False),
        frontend_dist=Path(_env("FRONTEND_DIST") or (REPO_ROOT / "frontend" / "dist")),
    )
