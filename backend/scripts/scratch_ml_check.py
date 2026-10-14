"""Scratch smoke test of the ML core (no web layer)."""
import sys, tempfile
from pathlib import Path

import numpy as np
import torch
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.ml.trainer import run_training  # noqa: E402
from app.schemas.training_config import TrainingConfig, resolve_config, estimate_params  # noqa: E402
from app.ml.architectures import build_model, count_params  # noqa: E402

print("torch", torch.__version__, "cuda", torch.cuda.is_available())
tmp = Path(tempfile.mkdtemp())
rng = np.random.default_rng(0)
items = []
for label, color in enumerate([(220, 40, 40), (40, 40, 220)]):
    for i in range(14):
        arr = np.clip(np.array(color) + rng.normal(0, 25, (48, 48, 3)), 0, 255).astype("uint8")
        p = tmp / f"{label}_{i}.png"
        Image.fromarray(arr).save(p)
        items.append({"id": f"{label}-{i}", "path": str(p), "label": label, "split": "val" if i >= 10 else "train"})

for aug in (False, True):
    cfg = resolve_config(TrainingConfig(mode="intermediate", epochs=4, augmentation=aug, test_backbone=True), allow_test_backbone=True)
    spec = {"config": cfg.model_dump(), "class_names": ["red", "blue"], "items": items, "output_dir": str(tmp / f"out{aug}"), "device_pref": "auto"}
    events = []
    res = run_training(spec, lambda t, **kw: events.append(t), lambda: False)
    print("aug", aug, [round(e["val_accuracy"], 2) for e in res["epochs"]], res["best"]["epoch"], "cache", res["feature_cache"],
          "events", sorted(set(events)))
    est = estimate_params(cfg, 2)
    real = count_params(build_model(cfg, 2))
    print(" estimate==real:", est["total_params"] == real["total_params"], est["trainable_params"] == real["trainable_params"])

adv = resolve_config(TrainingConfig(mode="advanced", conv_blocks=3, conv_filters=[8, 16, 32], epochs=2, test_backbone=False))
real = count_params(build_model(adv, 3))
print("custom cnn estimate==real:", estimate_params(adv, 3)["total_params"] == real["total_params"], real)
