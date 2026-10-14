"""Training configuration: validation, learning-mode presets and parameter estimation.

This module is intentionally free of torch imports so it can be unit-tested and
used by the API layer cheaply. The same resolved config is what the worker trains with,
so every control exposed in the UI really changes the model that is trained.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Mode = Literal["beginner", "intermediate", "advanced"]
Optimizer = Literal["adam", "sgd"]
Activation = Literal["relu", "gelu", "tanh"]
SplitStrategy = Literal["random", "explicit"]
Architecture = Literal["mobilenet_v3_small", "custom_cnn", "tiny_test"]

MOBILENET_FEATURE_DIM = 576
MOBILENET_BACKBONE_PARAMS = 927_008  # torchvision mobilenet_v3_small `features` (verified by tests/smoke test)
MOBILENET_INPUT_SIZE = 224
CUSTOM_CNN_INPUT_SIZE = 64
TINY_TEST_FEATURE_DIM = 16
TINY_TEST_INPUT_SIZE = 32
TINY_TEST_BACKBONE_PARAMS = 3 * 8 * 9 + 8 + 8 * 16 * 9 + 16  # see ml/architectures.TinyTestExtractor

ALLOWED_FILTERS = (8, 16, 24, 32, 48, 64, 96, 128)

# Parameters exposed per mode. Anything NOT listed is forced to its default.
BEGINNER_PARAMS = {"epochs", "val_split", "augmentation", "split_strategy"}
INTERMEDIATE_PARAMS = BEGINNER_PARAMS | {
    "batch_size",
    "learning_rate",
    "optimizer",
    "weight_decay",
    "dropout",
    "dense_layers",
    "neurons",
    "activation",
    "seed",
    "early_stopping_patience",
}
ADVANCED_PARAMS = INTERMEDIATE_PARAMS | {"conv_blocks", "conv_filters"}
MODE_PARAMS: dict[str, set[str]] = {
    "beginner": BEGINNER_PARAMS,
    "intermediate": INTERMEDIATE_PARAMS,
    "advanced": ADVANCED_PARAMS,
}


class TrainingConfig(BaseModel):
    """User-supplied configuration. Ranges here are the hard safety limits."""

    mode: Mode = "beginner"
    epochs: int = Field(10, ge=1, le=50)
    batch_size: int = Field(16, ge=2, le=64)
    learning_rate: float = Field(0.001, ge=1e-5, le=0.1)
    optimizer: Optimizer = "adam"
    weight_decay: float = Field(0.0, ge=0.0, le=0.1)
    dropout: float = Field(0.2, ge=0.0, le=0.8)
    val_split: float = Field(0.2, ge=0.1, le=0.5)
    augmentation: bool = True
    dense_layers: int = Field(1, ge=0, le=3)
    neurons: int = Field(64, ge=8, le=512)
    activation: Activation = "relu"
    seed: int = Field(42, ge=0, le=2**31 - 1)
    split_strategy: SplitStrategy = "random"
    early_stopping_patience: int = Field(0, ge=0, le=10)
    # advanced-only
    conv_blocks: int = Field(2, ge=1, le=4)
    conv_filters: list[int] = Field(default_factory=lambda: [16, 32])
    # hidden: only honoured when VISIONLAB_ALLOW_TEST_BACKBONE=1 (automated tests)
    test_backbone: bool = False

    model_config = {"extra": "forbid"}

    @field_validator("conv_filters")
    @classmethod
    def _filters_allowed(cls, v: list[int]) -> list[int]:
        for f in v:
            if f not in ALLOWED_FILTERS:
                raise ValueError(f"Số filter phải thuộc {list(ALLOWED_FILTERS)}")
        return v

    @model_validator(mode="after")
    def _filters_len(self) -> "TrainingConfig":
        if self.mode == "advanced" and len(self.conv_filters) != self.conv_blocks:
            raise ValueError("Số phần tử của conv_filters phải bằng conv_blocks")
        return self


class ResolvedConfig(TrainingConfig):
    """Config after applying mode presets. This is what gets trained and stored."""

    architecture: Architecture = "mobilenet_v3_small"
    freeze_backbone: bool = True

    @property
    def input_size(self) -> int:
        return {
            "mobilenet_v3_small": MOBILENET_INPUT_SIZE,
            "custom_cnn": CUSTOM_CNN_INPUT_SIZE,
            "tiny_test": TINY_TEST_INPUT_SIZE,
        }[self.architecture]


def resolve_config(cfg: TrainingConfig, *, allow_test_backbone: bool = False) -> ResolvedConfig:
    """Apply mode presets: parameters hidden from a mode are reset to defaults."""
    defaults = TrainingConfig()
    allowed = MODE_PARAMS[cfg.mode]
    data = cfg.model_dump()
    for key in list(data):
        if key in {"mode", "test_backbone"}:
            continue
        if key in {"conv_blocks", "conv_filters"} and cfg.mode == "advanced":
            continue
        if key not in allowed:
            data[key] = getattr(defaults, key)
    if cfg.mode == "beginner":
        # Beginner: small fixed head on frozen pretrained features.
        data.update(dense_layers=1, neurons=64, activation="relu", dropout=0.2, batch_size=16, learning_rate=0.001)
    if cfg.mode == "advanced":
        architecture: Architecture = "custom_cnn"
        freeze = False
    else:
        architecture = "mobilenet_v3_small"
        freeze = True
    if cfg.test_backbone:
        if not allow_test_backbone:
            raise ValueError("test_backbone chỉ dùng được khi bật VISIONLAB_ALLOW_TEST_BACKBONE=1")
        architecture = "tiny_test"
        freeze = cfg.mode != "advanced"
    return ResolvedConfig(**data, architecture=architecture, freeze_backbone=freeze)


# --------------------------------------------------------------------------- estimation
def head_param_count(in_dim: int, num_classes: int, dense_layers: int, neurons: int) -> int:
    total, prev = 0, in_dim
    for _ in range(dense_layers):
        total += prev * neurons + neurons
        prev = neurons
    total += prev * num_classes + num_classes
    return total


def custom_cnn_param_count(filters: list[int]) -> tuple[int, int]:
    """Returns (parameters, output_feature_dim). Conv has no bias because BatchNorm follows."""
    total, in_c = 0, 3
    for out_c in filters:
        total += in_c * out_c * 9 + 2 * out_c
        in_c = out_c
    return total, in_c


def estimate_params(cfg: ResolvedConfig, num_classes: int) -> dict[str, int]:
    """Analytical parameter estimate shown before training (verified against real models in tests)."""
    if cfg.architecture == "custom_cnn":
        extractor, dim = custom_cnn_param_count(list(cfg.conv_filters)[: cfg.conv_blocks])
    elif cfg.architecture == "tiny_test":
        extractor, dim = TINY_TEST_BACKBONE_PARAMS, TINY_TEST_FEATURE_DIM
    else:
        extractor, dim = MOBILENET_BACKBONE_PARAMS, MOBILENET_FEATURE_DIM
    head = head_param_count(dim, num_classes, cfg.dense_layers, cfg.neurons)
    trainable = head if cfg.freeze_backbone else head + extractor
    return {
        "extractor_params": extractor,
        "head_params": head,
        "total_params": extractor + head,
        "trainable_params": trainable,
        "frozen_params": extractor + head - trainable,
        "feature_dim": dim,
    }
