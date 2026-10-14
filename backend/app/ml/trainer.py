"""Real PyTorch training loop (transfer learning / custom CNN).

``run_training`` is pure ML logic: it receives a fully resolved, already-split job spec and
reports progress through an ``emit(event_type, **payload)`` callback. It knows nothing
about FastAPI, databases or WebSockets. Every number it reports is measured.
"""
from __future__ import annotations

import math
import random
import time
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

from app.ml.architectures import PretrainedWeightsError, VisionModel, build_model, count_params
from app.ml.checkpoints import make_metadata, save_checkpoint
from app.ml.evaluator import build_report
from app.ml.preprocessing import build_eval_transform, build_train_transform, load_rgb
from app.schemas.training_config import ResolvedConfig

Emit = Callable[..., None]


class TrainingCancelled(Exception):
    pass


class TrainingFailure(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed % (2**32))
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def select_device(pref: str) -> torch.device:
    if pref == "cpu":
        return torch.device("cpu")
    if torch.cuda.is_available():
        return torch.device("cuda")
    if pref == "cuda":
        raise TrainingFailure("CUDA_UNAVAILABLE", "Bạn yêu cầu GPU (CUDA) nhưng PyTorch không phát hiện GPU. Đặt VISIONLAB_DEVICE=auto hoặc cpu.")
    return torch.device("cpu")


class ImageDataset(Dataset):
    def __init__(self, images: list, labels: list[int], transform: Callable) -> None:
        self.images, self.labels, self.transform = images, labels, transform

    def __len__(self) -> int:
        return len(self.images)

    def __getitem__(self, i: int):
        return self.transform(self.images[i]), self.labels[i]


def _load_split(items: list[dict], size: int) -> tuple[list, list[int], list[str]]:
    images, labels, ids = [], [], []
    for it in items:
        try:
            images.append(load_rgb(it["path"], size))
        except Exception as exc:
            raise TrainingFailure("IMAGE_UNREADABLE", f"Không đọc được ảnh {it['id']}: {exc}") from exc
        labels.append(int(it["label"]))
        ids.append(it["id"])
    return images, labels, ids


def run_training(
    spec: dict[str, Any],
    emit: Emit,
    is_cancelled: Callable[[], bool],
) -> dict[str, Any]:
    t_start = time.time()
    cfg = ResolvedConfig(**spec["config"])
    class_names: list[str] = spec["class_names"]
    n_classes = len(class_names)
    out_dir = Path(spec["output_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    best_path = out_dir / "best.pt"

    emit("status", status="preparing", message="Đang kiểm tra dữ liệu và khởi tạo…")
    seed_everything(cfg.seed)
    device = select_device(spec.get("device_pref", "auto"))
    device_name = torch.cuda.get_device_name(0) if device.type == "cuda" else "CPU"
    emit("device", device=device.type, device_name=device_name)

    by_split: dict[str, list[dict]] = {"train": [], "val": [], "test": []}
    for it in spec["items"]:
        by_split[it["split"]].append(it)
    if not by_split["train"] or not by_split["val"]:
        raise TrainingFailure("EMPTY_SPLIT", "Tập train hoặc validation đang trống.")

    emit("status", status="preparing", message="Đang đọc và chuẩn hóa ảnh…")
    size = cfg.input_size
    data = {s: _load_split(items, size) for s, items in by_split.items() if items}
    if is_cancelled():
        raise TrainingCancelled()

    if cfg.architecture == "mobilenet_v3_small":
        emit("status", status="preparing", message="Đang tải/khởi tạo MobileNetV3-Small (trọng số ImageNet)…")
    try:
        model: VisionModel = build_model(cfg, n_classes, pretrained=True)
    except PretrainedWeightsError as exc:
        raise TrainingFailure("PRETRAINED_WEIGHTS_UNAVAILABLE", str(exc)) from exc
    model.to(device)
    counts = count_params(model)
    emit("model", param_counts=counts)
    if is_cancelled():
        raise TrainingCancelled()

    # ---------------------------------------------------------------- data pipeline
    gen = torch.Generator().manual_seed(cfg.seed)
    eval_tf = build_eval_transform()
    # Frozen backbone + no augmentation => backbone outputs are deterministic, so they can be
    # computed once. This is mathematically identical to recomputing them every epoch.
    use_cache = cfg.freeze_backbone and not cfg.augmentation
    cache: dict[str, tuple[torch.Tensor, torch.Tensor]] = {}
    loaders: dict[str, DataLoader] = {}
    bs_eval = 64

    def eval_loader(split: str) -> DataLoader:
        images, labels, _ = data[split]
        return DataLoader(ImageDataset(images, labels, eval_tf), batch_size=bs_eval, shuffle=False, num_workers=0)

    if use_cache:
        emit("status", status="preparing", message="Đang trích xuất đặc trưng từ backbone đã đóng băng…")
        model.eval()
        for split in data:
            feats, labs = [], []
            with torch.no_grad():
                for xb, yb in eval_loader(split):
                    feats.append(model.features(xb.to(device)).cpu())
                    labs.append(yb)
                    if is_cancelled():
                        raise TrainingCancelled()
            cache[split] = (torch.cat(feats), torch.cat(labs))
    else:
        t_images, t_labels, _ = data["train"]
        loaders["train"] = DataLoader(
            ImageDataset(t_images, t_labels, build_train_transform(cfg.augmentation)),
            batch_size=cfg.batch_size, shuffle=True, generator=gen, num_workers=0,
        )
        for split in data:
            if split != "train":
                loaders[split] = eval_loader(split)

    forward: Callable[[torch.Tensor], torch.Tensor] = model.head if use_cache else model
    n_train = len(data["train"][1])
    batches_per_epoch = math.ceil(n_train / cfg.batch_size)

    def iter_batches(split: str, train: bool) -> Iterator[tuple[torch.Tensor, torch.Tensor]]:
        if use_cache:
            feats, labs = cache[split]
            n = len(labs)
            order = torch.randperm(n, generator=gen) if train else torch.arange(n)
            step = cfg.batch_size if train else bs_eval
            for i in range(0, n, step):
                idx = order[i : i + step]
                yield feats[idx].to(device), labs[idx].to(device)
        else:
            loader = loaders["train"] if train else loaders[split]
            for xb, yb in loader:
                yield xb.to(device), yb.to(device)

    criterion = nn.CrossEntropyLoss()
    params = [p for p in model.parameters() if p.requires_grad]
    if cfg.optimizer == "adam":
        optimizer: torch.optim.Optimizer = torch.optim.Adam(params, lr=cfg.learning_rate, weight_decay=cfg.weight_decay)
    else:
        optimizer = torch.optim.SGD(params, lr=cfg.learning_rate, momentum=0.9, weight_decay=cfg.weight_decay)

    def evaluate(split: str) -> tuple[float, float, np.ndarray, list[int]]:
        model.eval()
        total_loss, correct, seen = 0.0, 0, 0
        probs_all, labels_all = [], []
        with torch.no_grad():
            for xb, yb in iter_batches(split, False):
                logits = forward(xb)
                total_loss += criterion(logits, yb).item() * yb.size(0)
                probs_all.append(torch.softmax(logits, dim=1).cpu())
                labels_all += yb.cpu().tolist()
                correct += (logits.argmax(1) == yb).sum().item()
                seen += yb.size(0)
        return total_loss / seen, correct / seen, torch.cat(probs_all).numpy(), labels_all

    # ---------------------------------------------------------------- training loop
    metrics: list[dict[str, Any]] = []
    best: dict[str, Any] | None = None
    no_improve = 0
    stopped_early = False
    t_train = time.time()
    last_emit = 0.0
    has_bn = cfg.architecture == "custom_cnn"

    for epoch in range(1, cfg.epochs + 1):
        if is_cancelled():
            raise TrainingCancelled()
        emit("status", status="training", message=f"Epoch {epoch}/{cfg.epochs}: đang huấn luyện…")
        model.train()
        run_loss, correct, seen = 0.0, 0, 0
        for b, (xb, yb) in enumerate(iter_batches("train", True), start=1):
            if is_cancelled():
                raise TrainingCancelled()
            if has_bn and xb.size(0) < 2:
                continue  # BatchNorm cannot train on a single sample
            optimizer.zero_grad(set_to_none=True)
            logits = forward(xb)
            loss = criterion(logits, yb)
            if not torch.isfinite(loss):
                raise TrainingFailure(
                    "NON_FINITE_LOSS",
                    "Loss trở thành NaN/Inf: learning rate có thể quá cao hoặc cấu hình không ổn định. Hãy giảm learning rate.",
                )
            loss.backward()
            optimizer.step()
            n = yb.size(0)
            run_loss += loss.item() * n
            correct += (logits.argmax(1) == yb).sum().item()
            seen += n
            now = time.time()
            if now - last_emit > 0.15 or b == batches_per_epoch:
                last_emit = now
                emit(
                    "batch", epoch=epoch, total_epochs=cfg.epochs, batch=b, total_batches=batches_per_epoch,
                    loss=run_loss / seen, accuracy=correct / seen,
                    progress=((epoch - 1) + b / batches_per_epoch) / cfg.epochs,
                )
        train_loss, train_acc = run_loss / max(seen, 1), correct / max(seen, 1)

        emit("status", status="validating", message=f"Epoch {epoch}/{cfg.epochs}: đang kiểm tra trên tập validation…")
        val_loss, val_acc, _, _ = evaluate("val")
        row = {
            "epoch": epoch, "total_epochs": cfg.epochs,
            "train_loss": train_loss, "val_loss": val_loss,
            "train_accuracy": train_acc, "val_accuracy": val_acc,
            "learning_rate": optimizer.param_groups[0]["lr"],
            "elapsed_s": time.time() - t_train,
        }
        metrics.append(row)
        emit("epoch", metrics=row)

        # best checkpoint: highest validation accuracy, ties broken by lower validation loss
        improved = best is None or (val_acc, -val_loss) > (best["val_accuracy"], -best["val_loss"])
        if improved:
            best = {"epoch": epoch, "val_accuracy": val_acc, "val_loss": val_loss, "train_accuracy": train_acc,
                    "train_loss": train_loss, "criterion": "val_accuracy (ties: lower val_loss)"}
            meta = make_metadata(cfg, class_names, {"best": best, "param_counts": counts})
            save_checkpoint(best_path, model, meta)
            emit("checkpoint", epoch=epoch, val_accuracy=val_acc, val_loss=val_loss)
            no_improve = 0
        else:
            no_improve += 1
        if cfg.early_stopping_patience and no_improve >= cfg.early_stopping_patience:
            stopped_early = True
            emit("log", message=f"Early stopping sau epoch {epoch}: {no_improve} epoch liên tiếp không cải thiện val.")
            break

    # ---------------------------------------------------------------- final evaluation (best checkpoint)
    emit("status", status="validating", message="Đang đánh giá checkpoint tốt nhất…")
    assert best is not None
    payload = torch.load(best_path, map_location="cpu", weights_only=True)
    model.load_state_dict(payload["state_dict"])
    model.to(device)
    evaluation: dict[str, Any] = {"validation": None, "test": None, "checkpoint_epoch": best["epoch"]}
    for split, key in (("val", "validation"), ("test", "test")):
        if split in data:
            _, _, probs, labels = evaluate(split)
            report = build_report(labels, probs, class_names, data[split][2])
            report["split"] = split
            evaluation[key] = report

    return {
        "epochs": metrics,
        "best": best,
        "evaluation": evaluation,
        "param_counts": counts,
        "device": device.type,
        "device_name": device_name,
        "duration_s": time.time() - t_start,
        "train_duration_s": time.time() - t_train,
        "checkpoint_file": "best.pt",
        "stopped_early": stopped_early,
        "feature_cache": use_cache,
        "split_sizes": {s: len(v[1]) for s, v in data.items()},
    }
