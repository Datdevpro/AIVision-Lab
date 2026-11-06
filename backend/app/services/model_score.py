"""Versioned validation scorecards, persisted with each completed training run."""
from __future__ import annotations

import math

RUBRIC_VERSION = "validation-35-20-20-25-recall-v1"


def _ratio(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and 0 <= value <= 1


def build_model_score(class_names: list[str], validation: dict | None, loss: float | None) -> dict:
    report = validation or {}
    classes = len(class_names)
    baseline = math.log(classes) if classes > 1 else None
    has_samples = report.get("num_samples", 0) > 0
    per_class = report.get("per_class") or []
    complete = has_samples and classes > 1 and len(per_class) == classes and all(c.get("support", 0) > 0 for c in per_class)
    weakest = min(per_class, key=lambda c: c["recall"]) if complete and all(_ratio(c.get("recall")) for c in per_class) else None
    valid_loss = has_samples and baseline is not None and isinstance(loss, (int, float)) and not isinstance(loss, bool) and math.isfinite(loss) and loss >= 0
    qualities = {
        "accuracy": report["accuracy"] if has_samples and _ratio(report.get("accuracy")) else None,
        "macro": report["f1_macro"] if complete and _ratio(report.get("f1_macro")) else None,
        "weakest": weakest["recall"] if weakest is not None else None,
        "loss": max(0.0, min(1.0, 1 - loss / baseline)) if valid_loss else None,
    }
    total = sum(qualities[key] * weight for key, weight in (("accuracy", 35), ("macro", 20), ("weakest", 20), ("loss", 25))) if all(v is not None for v in qualities.values()) else None
    return {
        "rubric_version": RUBRIC_VERSION, "total": total, "qualities": qualities,
        "loss": loss if valid_loss else None, "baseline_loss": baseline,
        "weakest_class": {key: weakest[key] for key in ("label", "recall", "support")} if weakest is not None else None,
    }
