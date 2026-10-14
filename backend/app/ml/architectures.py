"""Model architectures.

* ``mobilenet_v3_small``: pretrained ImageNet feature extractor + new classification head.
* ``custom_cnn``: small CNN trained from scratch (Advanced mode, bounded size).
* ``tiny_test``: tiny extractor used ONLY by automated tests (never silently substituted).
"""
from __future__ import annotations

import torch
from torch import nn

from app.schemas.training_config import (
    CUSTOM_CNN_INPUT_SIZE,
    MOBILENET_FEATURE_DIM,
    TINY_TEST_FEATURE_DIM,
    ResolvedConfig,
)


class PretrainedWeightsError(RuntimeError):
    """Raised when pretrained weights cannot be downloaded/loaded. Never swallowed or faked."""


def activation_module(name: str) -> nn.Module:
    return {"relu": nn.ReLU, "gelu": nn.GELU, "tanh": nn.Tanh}[name]()


def build_head(in_dim: int, num_classes: int, dense_layers: int, neurons: int, activation: str, dropout: float) -> nn.Sequential:
    layers: list[nn.Module] = []
    prev = in_dim
    for _ in range(dense_layers):
        layers += [nn.Linear(prev, neurons), activation_module(activation), nn.Dropout(dropout)]
        prev = neurons
    if dense_layers == 0:
        layers.append(nn.Dropout(dropout))
    layers.append(nn.Linear(prev, num_classes))
    return nn.Sequential(*layers)


class TinyTestExtractor(nn.Module):
    """Test-only lightweight extractor (no downloads)."""

    def __init__(self) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(3, 8, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(8, 16, 3, padding=1), nn.ReLU(), nn.AdaptiveAvgPool2d(1), nn.Flatten(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class CustomCNN(nn.Module):
    """Conv-BN-activation-MaxPool blocks followed by global average pooling."""

    def __init__(self, filters: list[int], activation: str) -> None:
        super().__init__()
        blocks: list[nn.Module] = []
        in_c = 3
        for out_c in filters:
            blocks += [
                nn.Conv2d(in_c, out_c, 3, padding=1, bias=False),
                nn.BatchNorm2d(out_c),
                activation_module(activation),
                nn.MaxPool2d(2),
            ]
            in_c = out_c
        blocks += [nn.AdaptiveAvgPool2d(1), nn.Flatten()]
        self.net = nn.Sequential(*blocks)
        self.out_dim = in_c

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def load_mobilenet_extractor(pretrained: bool) -> nn.Module:
    """MobileNetV3-Small ``features`` + global pooling -> 576-d vector."""
    from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small

    try:
        weights = MobileNet_V3_Small_Weights.IMAGENET1K_V1 if pretrained else None
        backbone = mobilenet_v3_small(weights=weights)
    except Exception as exc:  # network/cache/corruption problems
        raise PretrainedWeightsError(
            "Không tải được trọng số pretrained MobileNetV3-Small (ImageNet). "
            f"Kiểm tra kết nối Internet hoặc xem phần Troubleshooting trong README. Chi tiết: {exc}"
        ) from exc
    return nn.Sequential(backbone.features, backbone.avgpool, nn.Flatten())


class VisionModel(nn.Module):
    """extractor -> head. When the backbone is frozen it is always kept in eval mode
    (so BatchNorm running statistics are not modified)."""

    def __init__(self, extractor: nn.Module, head: nn.Module, freeze_extractor: bool) -> None:
        super().__init__()
        self.extractor = extractor
        self.head = head
        self.freeze_extractor = freeze_extractor
        if freeze_extractor:
            for p in self.extractor.parameters():
                p.requires_grad = False
            self.extractor.eval()

    def train(self, mode: bool = True) -> "VisionModel":
        super().train(mode)
        if self.freeze_extractor:
            self.extractor.eval()
        return self

    def features(self, x: torch.Tensor) -> torch.Tensor:
        if self.freeze_extractor:
            with torch.no_grad():
                return self.extractor(x)
        return self.extractor(x)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.head(self.features(x))


def build_model(cfg: ResolvedConfig, num_classes: int, *, pretrained: bool = True) -> VisionModel:
    if cfg.architecture == "mobilenet_v3_small":
        extractor, dim = load_mobilenet_extractor(pretrained), MOBILENET_FEATURE_DIM
    elif cfg.architecture == "custom_cnn":
        extractor = CustomCNN(list(cfg.conv_filters)[: cfg.conv_blocks], cfg.activation)
        dim = extractor.out_dim
    elif cfg.architecture == "tiny_test":
        extractor, dim = TinyTestExtractor(), TINY_TEST_FEATURE_DIM
    else:  # pragma: no cover
        raise ValueError(f"Unknown architecture {cfg.architecture}")
    head = build_head(dim, num_classes, cfg.dense_layers, cfg.neurons, cfg.activation, cfg.dropout)
    return VisionModel(extractor, head, cfg.freeze_backbone)


def count_params(model: VisionModel) -> dict[str, int]:
    def _c(m: nn.Module, trainable_only: bool = False) -> int:
        return sum(p.numel() for p in m.parameters() if (p.requires_grad or not trainable_only))

    total = _c(model)
    trainable = _c(model, True)
    return {
        "extractor_params": _c(model.extractor),
        "head_params": _c(model.head),
        "total_params": total,
        "trainable_params": trainable,
        "frozen_params": total - trainable,
    }


__all__ = [
    "PretrainedWeightsError", "VisionModel", "CustomCNN", "TinyTestExtractor",
    "build_model", "build_head", "count_params", "CUSTOM_CNN_INPUT_SIZE",
]
