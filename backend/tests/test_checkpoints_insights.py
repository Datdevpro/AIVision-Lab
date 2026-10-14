"""Unit tests: checkpoint safety and rule-based insights."""
import pytest
import torch

from app.ml.architectures import build_model
from app.ml.checkpoints import CheckpointError, load_checkpoint, make_metadata, save_checkpoint
from app.schemas.training_config import TrainingConfig, resolve_config
from app.services.insights_service import generate_insights


def _cfg():
    return resolve_config(TrainingConfig(mode="intermediate", test_backbone=True, dense_layers=1, neurons=16), allow_test_backbone=True)


def test_checkpoint_roundtrip_preserves_weights_and_labels(tmp_path):
    cfg = _cfg()
    model = build_model(cfg, 3, pretrained=False)
    save_checkpoint(tmp_path / "m" / "best.pt", model, make_metadata(cfg, ["x", "y", "z"]))
    loaded, meta = load_checkpoint("m/best.pt", tmp_path)
    assert meta["class_names"] == ["x", "y", "z"]
    inp = torch.randn(2, 3, cfg.input_size, cfg.input_size)
    assert torch.allclose(model.eval()(inp), loaded(inp), atol=1e-6)


def test_checkpoint_loading_refuses_paths_outside_managed_dir(tmp_path):
    outside = tmp_path / "outside.pt"
    outside.write_bytes(b"x")
    root = tmp_path / "root"
    root.mkdir()
    for bad in ("../outside.pt", str(outside)):
        with pytest.raises(CheckpointError):
            load_checkpoint(bad, root)


def test_checkpoint_loading_never_unpickles_arbitrary_objects(tmp_path):
    import pickle

    class Evil:
        def __reduce__(self):
            return (__import__("os").system, ("echo pwned",))

    (tmp_path / "evil.pt").write_bytes(pickle.dumps({"state_dict": Evil(), "metadata": {}}))
    with pytest.raises(CheckpointError):
        load_checkpoint("evil.pt", tmp_path)


def _row(e, tl, vl, ta, va):
    return {"epoch": e, "train_loss": tl, "val_loss": vl, "train_accuracy": ta, "val_accuracy": va}


def test_overfitting_insight_uses_real_numbers():
    epochs = [_row(1, 0.9, 0.8, 0.6, 0.6), _row(2, 0.5, 0.7, 0.8, 0.65), _row(3, 0.3, 0.8, 0.9, 0.6),
              _row(4, 0.15, 0.95, 0.95, 0.6), _row(5, 0.08, 1.1, 1.0, 0.6)]
    ids = {i["id"] for i in generate_insights(epochs)}
    assert {"val_loss_rising", "overfitting_gap", "train_loss_decreasing"} <= ids
    msg = next(i for i in generate_insights(epochs) if i["id"] == "val_loss_rising")["message"]
    assert "có thể" in msg  # cautious wording


def test_underfitting_and_lr_rules():
    flat = [_row(e, 1.0, 1.0, 0.4, 0.4) for e in range(1, 6)]
    assert "underfitting" in {i["id"] for i in generate_insights(flat)}
    spiky = [_row(1, 0.5, 0.6, 0.7, 0.7), _row(2, 1.5, 1.5, 0.3, 0.3), _row(3, 0.6, 0.7, 0.7, 0.7),
             _row(4, 2.0, 2.0, 0.2, 0.2), _row(5, 0.7, 0.8, 0.6, 0.6)]
    ids = {i["id"] for i in generate_insights(spiky, {"learning_rate": 0.05, "optimizer": "adam"})}
    assert {"unstable_training", "lr_maybe_high"} <= ids


def test_dataset_insights_and_no_metrics():
    summary = {"per_class": [{"train": 5, "total": 7}, {"train": 20, "total": 25}], "split": {"strategy": "random", "val": 4}}
    ids = {i["id"] for i in generate_insights([], None, summary)}
    assert {"small_dataset", "class_imbalance", "random_split_caveat"} <= ids
    healthy = [_row(1, 0.9, 0.9, 0.5, 0.5)] + [_row(e, 0.1, 0.1, 0.95, 0.95) for e in range(2, 6)]
    assert generate_insights(healthy, None, None)  # never empty
