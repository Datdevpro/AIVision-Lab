"""Unit tests: ML configuration validation, mode presets and parameter estimates."""
import pytest
from pydantic import ValidationError

from app.ml.architectures import build_model, count_params
from app.schemas.training_config import (
    MOBILENET_BACKBONE_PARAMS,
    TrainingConfig,
    estimate_params,
    resolve_config,
)


@pytest.mark.parametrize("field,value", [
    ("epochs", 0), ("epochs", 51), ("batch_size", 1), ("batch_size", 65), ("learning_rate", 0.0),
    ("learning_rate", 0.5), ("dropout", 0.95), ("weight_decay", -0.1), ("val_split", 0.05),
    ("val_split", 0.9), ("dense_layers", 4), ("neurons", 4), ("neurons", 1024), ("optimizer", "rmsprop"),
    ("activation", "sigmoid"), ("seed", -1),
])
def test_out_of_range_values_are_rejected(field, value):
    with pytest.raises(ValidationError):
        TrainingConfig(**{field: value})


def test_unknown_fields_are_rejected():
    with pytest.raises(ValidationError):
        TrainingConfig(epochs=5, hacker_option=True)


def test_advanced_filters_must_match_blocks_and_be_allowed():
    with pytest.raises(ValidationError):
        TrainingConfig(mode="advanced", conv_blocks=3, conv_filters=[16, 32])
    with pytest.raises(ValidationError):
        TrainingConfig(mode="advanced", conv_blocks=1, conv_filters=[999])


def test_beginner_mode_ignores_hidden_parameters():
    cfg = resolve_config(TrainingConfig(mode="beginner", epochs=7, learning_rate=0.09, dense_layers=3, neurons=500, optimizer="sgd"))
    assert cfg.epochs == 7  # exposed
    assert cfg.learning_rate == 0.001 and cfg.dense_layers == 1 and cfg.neurons == 64  # forced presets
    assert cfg.optimizer == "adam"
    assert cfg.architecture == "mobilenet_v3_small" and cfg.freeze_backbone


def test_intermediate_mode_honours_all_head_parameters():
    cfg = resolve_config(TrainingConfig(mode="intermediate", learning_rate=0.01, dense_layers=2, neurons=128,
                                        activation="gelu", optimizer="sgd", dropout=0.5, batch_size=8))
    assert (cfg.learning_rate, cfg.dense_layers, cfg.neurons, cfg.activation, cfg.optimizer, cfg.dropout, cfg.batch_size) == (
        0.01, 2, 128, "gelu", "sgd", 0.5, 8)
    assert cfg.freeze_backbone


def test_advanced_mode_trains_custom_cnn_from_scratch():
    cfg = resolve_config(TrainingConfig(mode="advanced", conv_blocks=2, conv_filters=[8, 16]))
    assert cfg.architecture == "custom_cnn" and not cfg.freeze_backbone and cfg.input_size == 64


def test_test_backbone_is_blocked_unless_explicitly_allowed():
    with pytest.raises(ValueError):
        resolve_config(TrainingConfig(test_backbone=True), allow_test_backbone=False)
    assert resolve_config(TrainingConfig(test_backbone=True), allow_test_backbone=True).architecture == "tiny_test"


@pytest.mark.parametrize("kwargs,n_classes", [
    (dict(mode="intermediate", dense_layers=0), 2),
    (dict(mode="intermediate", dense_layers=2, neurons=96), 5),
    (dict(mode="advanced", conv_blocks=3, conv_filters=[8, 16, 32], dense_layers=1, neurons=32), 3),
    (dict(mode="intermediate", test_backbone=True, dense_layers=1), 4),
])
def test_parameter_estimate_matches_real_model(kwargs, n_classes):
    cfg = resolve_config(TrainingConfig(**kwargs), allow_test_backbone=True)
    est = estimate_params(cfg, n_classes)
    real = count_params(build_model(cfg, n_classes, pretrained=False))
    assert est["total_params"] == real["total_params"]
    assert est["trainable_params"] == real["trainable_params"]


def test_frozen_backbone_has_no_trainable_extractor_params():
    cfg = resolve_config(TrainingConfig(mode="intermediate"))
    model = build_model(cfg, 3, pretrained=False)
    assert all(not p.requires_grad for p in model.extractor.parameters())
    assert count_params(model)["extractor_params"] == MOBILENET_BACKBONE_PARAMS
    model.train()
    assert not model.extractor.training  # BatchNorm stats of a frozen backbone must not change
