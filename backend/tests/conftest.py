"""Test configuration.

All tests run against a temporary data directory, on CPU, with the lightweight ``tiny_test``
backbone enabled so no pretrained weights are ever downloaded.
"""
from __future__ import annotations

import io
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

_TMP = tempfile.mkdtemp(prefix="visionlab-tests-")
os.environ["VISIONLAB_DATA_DIR"] = _TMP
os.environ["VISIONLAB_ALLOW_TEST_BACKBONE"] = "1"
os.environ["VISIONLAB_DEVICE"] = "cpu"
os.environ["VISIONLAB_INFERENCE_DEVICE"] = "cpu"
os.environ.pop("VISIONLAB_API_TOKEN", None)


def make_image_bytes(color: tuple[int, int, int], seed: int, fmt: str = "PNG", size: int = 48) -> bytes:
    rng = np.random.default_rng(seed)
    arr = np.clip(np.array(color) + rng.normal(0, 30, (size, size, 3)), 0, 255).astype("uint8")
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format=fmt)
    return buf.getvalue()


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.core.config import get_settings
    from app.core.db import reset_engine

    get_settings.cache_clear()
    reset_engine()
    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c
    reset_engine()
