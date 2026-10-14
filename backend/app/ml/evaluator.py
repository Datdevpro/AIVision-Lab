"""Evaluation reports built from real model predictions (scikit-learn metrics)."""
from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support


def build_report(
    y_true: list[int],
    probs: np.ndarray,
    class_names: list[str],
    image_ids: list[str],
    *,
    max_misclassified: int = 12,
) -> dict[str, Any]:
    """``probs``: array [N, C] of softmax outputs on a held-out set."""
    n_classes = len(class_names)
    labels = list(range(n_classes))
    y_pred = probs.argmax(axis=1).tolist()
    n = len(y_true)
    if n == 0:
        return {"num_samples": 0}
    prec, rec, f1, support = precision_recall_fscore_support(y_true, y_pred, labels=labels, zero_division=0)
    macro_p, macro_r, macro_f1, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, average="macro", zero_division=0
    )
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    conf = probs.max(axis=1)
    wrong = [i for i in range(n) if y_true[i] != y_pred[i]]
    wrong.sort(key=lambda i: -float(conf[i]))  # most confidently wrong first
    misclassified = [
        {
            "image_id": image_ids[i],
            "true_label": class_names[y_true[i]],
            "predicted_label": class_names[y_pred[i]],
            "confidence": float(conf[i]),
            "true_class_probability": float(probs[i, y_true[i]]),
        }
        for i in wrong[:max_misclassified]
    ]
    per_class = [
        {
            "label": class_names[c],
            "precision": float(prec[c]),
            "recall": float(rec[c]),
            "f1": float(f1[c]),
            "support": int(support[c]),
        }
        for c in labels
    ]
    warnings: list[str] = []
    if n < 20:
        warnings.append(
            f"Chỉ có {n} ảnh để đánh giá: các chỉ số có thể không ổn định và dễ gây hiểu nhầm."
        )
    if any(p["support"] == 0 for p in per_class):
        warnings.append("Có class không có ảnh nào trong tập đánh giá, nên chỉ số của class đó không có ý nghĩa.")
    return {
        "num_samples": n,
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_macro": float(macro_p),
        "recall_macro": float(macro_r),
        "f1_macro": float(macro_f1),
        "mean_confidence": float(conf.mean()),
        "mean_confidence_correct": float(conf[[i for i in range(n) if i not in set(wrong)]].mean()) if len(wrong) < n else None,
        "mean_confidence_wrong": float(conf[wrong].mean()) if wrong else None,
        "per_class": per_class,
        "confusion_matrix": cm.tolist(),
        "labels": list(class_names),
        "misclassified": misclassified,
        "warnings": warnings,
    }
