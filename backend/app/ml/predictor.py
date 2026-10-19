"""Inference: loads a managed checkpoint once and classifies single images."""
from __future__ import annotations

import threading
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any

from PIL import Image

from app.ml.checkpoints import load_checkpoint
from app.ml.preprocessing import preprocess_pil

if TYPE_CHECKING:
    import torch


def pick_device(pref: str) -> Any:
    import torch

    if pref == "cpu":
        return torch.device("cpu")
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


class Predictor:
    """Keeps the most recently used model in memory. Thread-safe."""

    def __init__(self, checkpoints_root: Path, device_pref: str = "auto") -> None:
        self.root = checkpoints_root
        self.device = pick_device(device_pref)
        self._lock = threading.Lock()
        self._key: tuple[str, float] | None = None
        self._model = None
        self._meta: dict | None = None

    def _ensure(self, rel_path: str):
        file = (self.root / rel_path)
        key = (rel_path, file.stat().st_mtime if file.exists() else 0.0)
        if self._key != key:
            self._model, self._meta = load_checkpoint(rel_path, self.root, self.device)
            self._key = key
        return self._model, self._meta

    def invalidate(self) -> None:
        with self._lock:
            self._key, self._model, self._meta = None, None, None

    def predict(self, rel_path: str, image: Image.Image) -> dict:
        import torch

        with self._lock:
            model, meta = self._ensure(rel_path)
            t0 = time.perf_counter()
            x = preprocess_pil(image, int(meta["input_size"])).unsqueeze(0).to(self.device)
            with torch.inference_mode():
                probs = torch.softmax(model(x), dim=1)[0].cpu().tolist()
            if self.device.type == "cuda":
                torch.cuda.synchronize()
            latency_ms = (time.perf_counter() - t0) * 1000
        names = meta["class_names"]
        ranked = sorted(
            ({"index": i, "label": names[i], "probability": p} for i, p in enumerate(probs)),
            key=lambda d: -d["probability"],
        )
        return {
            "predicted_index": ranked[0]["index"],
            "predicted_label": ranked[0]["label"],
            "confidence": ranked[0]["probability"],
            "probabilities": [{"index": i, "label": names[i], "probability": p} for i, p in enumerate(probs)],
            "latency_ms": latency_ms,
            "device": self.device.type,
        }
