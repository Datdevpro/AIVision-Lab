"""Preprocessing shared by training, evaluation and inference.

Training and inference use the *same* resize + ImageNet normalisation. Augmentation is
only ever attached to the training transform (see ``build_train_transform``).
"""
from __future__ import annotations

from pathlib import Path

import torch
from PIL import Image, ImageOps
from torchvision import transforms as T

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def load_rgb(path: str | Path, size: int | None = None) -> Image.Image:
    """Open an image as RGB (EXIF-aware); optionally resize to ``size`` x ``size``."""
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        if size:
            im = im.resize((size, size), Image.BILINEAR)
        else:
            im.load()
        return im


def build_eval_transform() -> T.Compose:
    """Deterministic transform (images are pre-resized to the model's input size)."""
    return T.Compose([T.ToTensor(), T.Normalize(IMAGENET_MEAN, IMAGENET_STD)])


def build_train_transform(augment: bool) -> T.Compose:
    """Training transform. Augmentations: horizontal flip, small rotation, moderate colour jitter."""
    steps: list = []
    if augment:
        steps += [
            T.RandomHorizontalFlip(p=0.5),
            T.RandomRotation(degrees=15),
            T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.02),
        ]
    steps += [T.ToTensor(), T.Normalize(IMAGENET_MEAN, IMAGENET_STD)]
    return T.Compose(steps)


def preprocess_pil(image: Image.Image, size: int) -> torch.Tensor:
    """Inference-time preprocessing: identical to the evaluation path used during training."""
    im = ImageOps.exif_transpose(image).convert("RGB").resize((size, size), Image.BILINEAR)
    return build_eval_transform()(im)


def preprocessing_spec(size: int) -> dict:
    """Serialisable description stored with checkpoints/exports so the pipeline can be reproduced."""
    return {
        "color_mode": "RGB",
        "resize": [size, size],
        "resize_interpolation": "bilinear",
        "normalize_mean": list(IMAGENET_MEAN),
        "normalize_std": list(IMAGENET_STD),
        "scale": "0-1 (ToTensor)",
        "train_only_augmentation": [
            "RandomHorizontalFlip(0.5)",
            "RandomRotation(15deg)",
            "ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.02)",
        ],
    }
