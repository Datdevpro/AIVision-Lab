"""Pure dataset logic (no DB / no torch): splitting, validation, quality warnings, fingerprints."""
from __future__ import annotations

import hashlib
import math
import random
from dataclasses import dataclass
from typing import Any

import numpy as np

MIN_RECOMMENDED_PER_CLASS = 20
MIN_ABSOLUTE_PER_CLASS = 2
MIN_RECOMMENDED_VAL_PER_CLASS = 5
NEAR_DUP_MAX_HAMMING = 4
COLOR_SIMILARITY_THRESHOLD = 0.985


@dataclass
class Item:
    id: str
    class_id: str
    subset: str  # train | val | test (user-assigned)
    session_id: str | None = None
    sha256: str = ""
    dhash: str = ""
    color_hist: list[float] | None = None


def compute_split(items: list[Item], strategy: str, val_split: float, seed: int) -> dict[str, str]:
    """Assign each ORIGINAL image to train/val/test/unused. Augmentation happens later, on train only.

    * explicit: subset tags are used as-is (train/val/test).
    * random:   only images tagged ``train`` are pooled and split per class (stratified, seeded);
                ``val``-tagged images are left unused, ``test`` stays test.
    """
    out: dict[str, str] = {}
    if strategy == "explicit":
        for it in items:
            out[it.id] = it.subset
        return out
    by_class: dict[str, list[Item]] = {}
    for it in items:
        if it.subset == "test":
            out[it.id] = "test"
        elif it.subset == "val":
            out[it.id] = "unused"
        else:
            by_class.setdefault(it.class_id, []).append(it)
    for class_id, group in by_class.items():
        group = sorted(group, key=lambda i: i.id)
        random.Random(f"{seed}:{class_id}").shuffle(group)
        n = len(group)
        n_val = 0 if n < 2 else min(n - 1, max(1, round(n * val_split)))
        for idx, it in enumerate(group):
            out[it.id] = "val" if idx < n_val else "train"
    return out


def hamming_matrix(a: list[str], b: list[str]) -> np.ndarray:
    """Pairwise Hamming distance between two lists of 64-bit hex hashes."""
    if not a or not b:
        return np.zeros((len(a), len(b)), dtype=np.int32)
    ai = np.array([int(h, 16) for h in a], dtype=np.uint64)
    bi = np.array([int(h, 16) for h in b], dtype=np.uint64)
    out = np.zeros((len(a), len(b)), dtype=np.int32)
    for start in range(0, len(a), 64):
        x = ai[start : start + 64, None] ^ bi[None, :]
        bits = np.unpackbits(x.view(np.uint8).reshape(x.shape + (8,)), axis=-1)
        out[start : start + 64] = bits.reshape(x.shape + (64,)).sum(-1)
    return out


def dataset_fingerprint(items: list[Item], class_names: dict[str, str]) -> str:
    lines = sorted(f"{class_names.get(i.class_id, i.class_id)}|{i.subset}|{i.sha256}" for i in items)
    return hashlib.sha256("\n".join(lines).encode()).hexdigest()[:16]


def split_fingerprint(items: list[Item], assign: dict[str, str], class_names: dict[str, str]) -> str:
    lines = sorted(f"{class_names.get(i.class_id, i.class_id)}|{assign[i.id]}|{i.sha256}" for i in items)
    return hashlib.sha256("\n".join(lines).encode()).hexdigest()[:16]


def _w(code: str, severity: str, title: str, message: str, lesson: str | None = None) -> dict[str, Any]:
    return {"code": code, "severity": severity, "title": title, "message": message, "lesson": lesson}


def build_summary(
    items: list[Item],
    classes: list[tuple[str, str]],  # (class_id, name) in label order
    strategy: str,
    val_split: float,
    seed: int,
) -> dict[str, Any]:
    names = dict(classes)
    assign = compute_split(items, strategy, val_split, seed)
    per_class = []
    for cid, name in classes:
        mine = [i for i in items if i.class_id == cid]
        counts = {s: sum(1 for i in mine if assign[i.id] == s) for s in ("train", "val", "test", "unused")}
        per_class.append({"class_id": cid, "name": name, "total": len(mine), **counts})
    totals = {s: sum(c[s] for c in per_class) for s in ("train", "val", "test", "unused")}
    nonempty = [c["total"] for c in per_class]
    train_counts = [c["train"] for c in per_class]
    ratio = (max(train_counts) / max(min(train_counts), 1)) if train_counts and max(train_counts) else 0.0
    warnings = quality_warnings(items, classes, assign, per_class, strategy, ratio)
    return {
        "num_classes": len(classes),
        "total_images": len(items),
        "per_class": per_class,
        "split": {"strategy": strategy, "val_split": val_split, "seed": seed, **totals},
        "balance": {
            "min": min(nonempty) if nonempty else 0,
            "max": max(nonempty) if nonempty else 0,
            "train_ratio": None if not math.isfinite(ratio) else round(ratio, 2),
        },
        "warnings": warnings,
        "dataset_fingerprint": dataset_fingerprint(items, names),
        "split_fingerprint": split_fingerprint(items, assign, names),
        "assignment": assign,
    }


def quality_warnings(items, classes, assign, per_class, strategy, ratio) -> list[dict[str, Any]]:
    w: list[dict[str, Any]] = []
    if len(classes) < 2:
        w.append(_w("few_classes", "error", "Cần ít nhất 2 class", "Một bộ phân loại cần ít nhất hai class để học cách phân biệt.", "class"))
    for c in per_class:
        usable = c["train"] + c["val"]
        if c["total"] == 0:
            w.append(_w("empty_class", "error", f"Class “{c['name']}” chưa có ảnh", "Hãy chụp hoặc tải ảnh lên cho class này.", "dataset"))
        elif c["train"] < MIN_RECOMMENDED_PER_CLASS:
            w.append(_w(
                "few_samples", "warning" if usable >= 10 else "error",
                f"Class “{c['name']}” có ít ảnh ({c['train']} train)",
                f"Nên có ít nhất ~{MIN_RECOMMENDED_PER_CLASS} ảnh độc lập mỗi class. Với quá ít ảnh, mô hình dễ ghi nhớ thay vì học đặc trưng và kết quả sẽ không ổn định.",
                "dataset",
            ))
    trains = [c["train"] for c in per_class if c["total"] > 0]
    if len(trains) >= 2 and min(trains) > 0:
        if ratio >= 3:
            w.append(_w("imbalanced_severe", "error", "Dữ liệu mất cân bằng nghiêm trọng", f"Class lớn nhất nhiều gấp {ratio:.1f} lần class nhỏ nhất. Mô hình có thể thiên về class có nhiều ảnh; accuracy có thể gây hiểu nhầm.", "dataset"))
        elif ratio >= 1.5:
            w.append(_w("imbalanced", "warning", "Dữ liệu hơi mất cân bằng", f"Tỉ lệ class lớn/nhỏ là {ratio:.1f}. Hãy cân nhắc thêm ảnh cho class ít ảnh.", "dataset"))

    for c in per_class:
        if c["total"] > 0 and c["val"] < MIN_RECOMMENDED_VAL_PER_CLASS and c["train"] > 0:
            w.append(_w(
                "val_small", "warning", f"Validation của “{c['name']}” chỉ có {c['val']} ảnh",
                "Với rất ít ảnh validation, độ chính xác sẽ nhảy theo từng ảnh và có thể gây hiểu nhầm.", "validation"))
    if strategy == "explicit":
        for c in per_class:
            if c["total"] > 0 and c["val"] == 0:
                w.append(_w("val_missing", "error", f"Class “{c['name']}” chưa có ảnh validation riêng",
                            "Chiến lược chia ‘validation riêng’ cần ít nhất 1 ảnh gán là validation cho mỗi class.", "validation"))
    elif any(i.subset == "val" for i in items):
        n = sum(1 for i in items if i.subset == "val")
        w.append(_w("val_unused", "info", f"{n} ảnh validation riêng chưa được dùng",
                    "Bạn đang chọn chia ngẫu nhiên nên các ảnh gán ‘validation’ bị bỏ qua. Chọn ‘Validation riêng’ để dùng chúng.", "validation"))

    # correlated frames: random split across a single capture session
    by_id = {i.id: i for i in items}
    if strategy == "random":
        shared = 0
        for c in per_class:
            sessions_train = {by_id[k].session_id for k, s in assign.items() if s == "train" and by_id[k].class_id == c["class_id"] and by_id[k].session_id}
            sessions_val = {by_id[k].session_id for k, s in assign.items() if s == "val" and by_id[k].class_id == c["class_id"] and by_id[k].session_id}
            shared += len(sessions_train & sessions_val)
        if shared:
            w.append(_w(
                "correlated_split", "warning", "Ảnh validation có thể quá giống ảnh train",
                "Các khung hình webcam trong cùng một phiên chụp rất giống nhau. Chia ngẫu nhiên từng khung hình không tạo ra dữ liệu validation độc lập, nên accuracy có thể cao hơn thực tế. Hãy chụp một phiên riêng làm validation hoặc tải ảnh validation riêng.",
                "validation"))

    # near-duplicates between train and val
    tr = [by_id[k] for k, s in assign.items() if s == "train" and by_id[k].dhash]
    va = [by_id[k] for k, s in assign.items() if s == "val" and by_id[k].dhash]
    if tr and va:
        dist = hamming_matrix([v.dhash for v in va], [t.dhash for t in tr])
        dup_val = int((dist.min(axis=1) <= NEAR_DUP_MAX_HAMMING).sum())
        if dup_val:
            w.append(_w("near_duplicates", "warning", f"{dup_val} ảnh validation gần như trùng ảnh train",
                        "Ảnh gần giống nhau ở cả train và validation làm validation accuracy cao giả tạo (rò rỉ dữ liệu).", "validation"))

    # cross-class: same/near-identical image labelled with different classes
    all_hash = [i for i in items if i.dhash]
    if 2 <= len(classes) and 1 < len(all_hash) <= 1000:
        d = hamming_matrix([i.dhash for i in all_hash], [i.dhash for i in all_hash])
        cls = np.array([i.class_id for i in all_hash])
        conflict = (d <= NEAR_DUP_MAX_HAMMING) & (cls[:, None] != cls[None, :])
        n_conf = int(conflict.any(axis=1).sum())
        if n_conf:
            w.append(_w("label_conflict", "error", f"{n_conf} ảnh gần như giống hệt ảnh ở class khác",
                        "Cùng một hình nhưng có hai nhãn khác nhau sẽ làm mô hình bối rối. Hãy kiểm tra và xoá ảnh bị nhầm.", "dataset"))

    # visually similar classes (colour-statistics heuristic, NOT a guarantee)
    cents = {}
    for cid, _ in classes:
        hs = [np.array(i.color_hist) for i in items if i.class_id == cid and i.color_hist]
        if hs:
            cents[cid] = np.mean(hs, axis=0)
    cname = {cid: n for cid, n in classes}
    ids = list(cents)
    for a in range(len(ids)):
        for b in range(a + 1, len(ids)):
            va_, vb_ = cents[ids[a]], cents[ids[b]]
            sim = float(va_ @ vb_ / (np.linalg.norm(va_) * np.linalg.norm(vb_) + 1e-9))
            if sim >= COLOR_SIMILARITY_THRESHOLD:
                w.append(_w(
                    "similar_classes", "info", f"“{cname[ids[a]]}” và “{cname[ids[b]]}” có thể trông khá giống nhau",
                    f"Phân bố màu của hai class rất gần nhau (độ tương đồng {sim:.3f}). Đây chỉ là kiểm tra thô về màu sắc; nếu hai vật thể thật sự giống nhau, mô hình sẽ khó phân biệt và cần nhiều ảnh đa dạng hơn.", "dataset"))
    return w


def validate_for_training(summary: dict[str, Any]) -> list[dict[str, str]]:
    """Hard blocking problems. Returns a list of {code, message}."""
    errors: list[dict[str, str]] = []
    per_class = summary["per_class"]
    if summary["num_classes"] < 2:
        errors.append({"code": "FEW_CLASSES", "message": "Cần ít nhất 2 class."})
    for c in per_class:
        if c["total"] == 0:
            errors.append({"code": "EMPTY_CLASS", "message": f"Class “{c['name']}” chưa có ảnh."})
        elif c["train"] < 1:
            errors.append({"code": "NO_TRAIN_IMAGES", "message": f"Class “{c['name']}” không có ảnh train."})
        elif c["val"] < 1:
            errors.append({
                "code": "NO_VAL_IMAGES",
                "message": f"Class “{c['name']}” không có ảnh validation (cần ≥ {MIN_ABSOLUTE_PER_CLASS} ảnh nếu chia ngẫu nhiên, hoặc tải ảnh validation riêng).",
            })
    return errors
