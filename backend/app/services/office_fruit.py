"""Curated Open Images crops: office objects plus five common fruits."""
from __future__ import annotations

import concurrent.futures
import hashlib
import io
import json
import math
from pathlib import Path
import re
import urllib.request

from PIL import Image, ImageOps, ImageStat

from app.core.config import Settings
from app.core.errors import AppError, bad_request
from app.services.image_ingest import dhash64

CLASSES = (
    ("laptop", "Laptop", "/m/01c648"),
    ("mouse", "Chuột máy tính", "/m/020lf"),
    ("keyboard", "Bàn phím", "/m/01m2v"),
    ("desk", "Bàn làm việc", "/m/01y9k5"),
    ("monitor", "Màn hình máy tính", "/m/02522"),
    ("watch", "Đồng hồ đeo tay", "/m/0gjkl"),
    ("banana", "Chuối", "/m/09qck"),
    ("apple", "Táo", "/m/014j1m"),
    ("watermelon", "Dưa hấu", "/m/0kpqd"),
    ("orange", "Cam", "/m/0cyhj_"),
    ("pear", "Lê", "/m/061_f"),
    ("phone", "Điện thoại di động", "/m/050k8"),
)
MANIFEST_PATH = Path(__file__).resolve().parents[1] / "data" / "office-fruit-v1.json"
SOURCE_URL = "https://storage.googleapis.com/openimages/web/download_v7.html"
NAME = "Office & Fruit"
MAX_SOURCE_BYTES = 16 * 1024 * 1024


def manifest() -> dict:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def manifest_hash() -> str:
    return hashlib.sha256(MANIFEST_PATH.read_bytes()).hexdigest()


def cache_dir(settings: Settings) -> Path:
    return settings.data_dir / "sample_datasets" / "office-fruit"


def cached(settings: Settings) -> bool:
    try:
        marker = json.loads((cache_dir(settings) / ".ready.json").read_text(encoding="utf-8"))
        return marker["manifest_sha256"] == manifest_hash() and all(
            (cache_dir(settings) / c["id"] / f"{item['image_id']}.jpg").is_file()
            for c in manifest()["classes"] for item in c["images"]
        )
    except (OSError, ValueError, KeyError):
        return False


def catalog(settings: Settings) -> dict:
    data = manifest()
    return {
        "id": "office-fruit", "name": NAME,
        "description": "7 loại đồ công nghệ/văn phòng và 5 loại trái cây. Ảnh thực tế đã cắt theo vật thể, chuẩn hóa và loại trùng, sẵn sàng huấn luyện.",
        "source_url": SOURCE_URL, "license_url": "/datasets/office-fruit/LICENSE.txt",
        "download_bytes": sum(item.get("source_bytes", 150_000) for c in data["classes"] for item in c["images"]),
        "cached": cached(settings), "min_classes": 2, "max_classes": min(len(CLASSES), settings.max_classes),
        "min_images_per_class": 20,
        "max_images_per_class": min(data["images_per_class"], settings.max_images_per_class),
        "default_images_per_class": 200,
        "max_images_per_project": settings.max_images_per_project,
        "classes": [{"id": c["id"], "name": c["name"], "available": len(c["images"]),
                     "preview_url": f"/datasets/office-fruit/{c['id']}.jpg"} for c in data["classes"]],
    }


def validate_selection(class_ids: list[str], count: int, settings: Settings) -> None:
    valid = {key for key, _, _ in CLASSES}
    if not 2 <= len(class_ids) <= min(len(CLASSES), settings.max_classes) or len(set(class_ids)) != len(class_ids) or not set(class_ids) <= valid:
        raise bad_request("INVALID_SAMPLE_CLASSES", "Chọn ít nhất 2 lớp khác nhau trong giới hạn của ứng dụng.")
    maximum = min(manifest()["images_per_class"], settings.max_images_per_class)
    if not 20 <= count <= maximum:
        raise bad_request("INVALID_SAMPLE_COUNT", f"Chọn từ 20 đến {maximum} ảnh mỗi lớp.")
    if count * len(class_ids) > settings.max_images_per_project:
        raise bad_request("PROJECT_FULL", f"Dataset vượt giới hạn {settings.max_images_per_project} ảnh/dự án.")


def crop_image(raw: bytes, bbox: list[float], rotation: int = 0) -> tuple[bytes, str]:
    if rotation not in (0, 90, 180, 270):
        raise ValueError("Invalid source rotation")
    if len(bbox) != 4 or not all(math.isfinite(x) and 0 <= x <= 1 for x in bbox):
        raise ValueError("Invalid bounding box")
    x0, y0, x1, y1 = bbox
    if x1 <= x0 or y1 <= y0:
        raise ValueError("Empty bounding box")
    with Image.open(io.BytesIO(raw)) as source:
        if source.width * source.height > 36_000_000:
            raise ValueError("Source image is too large")
        image = ImageOps.exif_transpose(source).convert("RGB")
        # Keep a small amount of context without including an entire multi-object photo.
        pad_x, pad_y = (x1 - x0) * .04, (y1 - y0) * .04
        box = (max(0, math.floor((x0 - pad_x) * image.width)), max(0, math.floor((y0 - pad_y) * image.height)),
               min(image.width, math.ceil((x1 + pad_x) * image.width)), min(image.height, math.ceil((y1 + pad_y) * image.height)))
        crop = image.crop(box)
        if rotation:
            # Open Images specifies CCW rotation for both the photo and its boxes;
            # cropping first and rotating the crop is equivalent for this task.
            crop = crop.rotate(rotation, expand=True)
        if min(crop.size) < 64 or max(crop.size) / min(crop.size) > 8:
            raise ValueError("Object crop is too small or narrow")
        if ImageStat.Stat(crop.convert("L").resize((64, 64))).stddev[0] < 12:
            raise ValueError("Object crop has insufficient detail")
        crop.thumbnail((512, 512), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        crop.save(buffer, "JPEG", quality=92)
        return buffer.getvalue(), dhash64(crop)


def _paths(root: Path, key: str, item: dict) -> tuple[Path, Path]:
    if key not in {c[0] for c in CLASSES} or not re.fullmatch(r"[a-f0-9]{16}", item["image_id"]):
        raise ValueError("Invalid curated image identifier")
    path = root / key / f"{item['image_id']}.jpg"
    return path, path.with_suffix(".json")


def prepare_one(root: Path, key: str, item: dict) -> tuple[Path, dict]:
    path, info_path = _paths(root, key, item)
    rotation = int(float(item.get("Rotation") or 0))
    try:
        info = json.loads(info_path.read_text(encoding="utf-8"))
        if info["recipe"] == item["bbox"] and info.get("rotation", 0) == rotation and info["crop_sha256"] == hashlib.sha256(path.read_bytes()).hexdigest() and (
            not item.get("source_sha256") or info["source_sha256"] == item["source_sha256"]
        ):
            return path, info
    except (OSError, ValueError, KeyError):
        pass
    url = f"https://open-images-dataset.s3.amazonaws.com/train/{item['image_id']}.jpg"
    with urllib.request.urlopen(url, timeout=45) as response:
        raw = response.read(MAX_SOURCE_BYTES + 1)
    if len(raw) > MAX_SOURCE_BYTES:
        raise ValueError("Source download is too large")
    source_sha = hashlib.sha256(raw).hexdigest()
    if item.get("source_sha256") and source_sha != item["source_sha256"]:
        raise ValueError("Source image checksum mismatch")
    crop, dhash = crop_image(raw, item["bbox"], rotation)
    info = {"recipe": item["bbox"], "rotation": rotation, "source_sha256": source_sha, "source_bytes": len(raw),
            "crop_sha256": hashlib.sha256(crop).hexdigest(), "dhash": dhash}
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_suffix(".part")
    part.write_bytes(crop)
    part.replace(path)
    info_path.write_text(json.dumps(info), encoding="utf-8")
    return path, info


def ensure_cache(settings: Settings, progress, class_ids: list[str] | None = None) -> Path:
    data = manifest()
    root = cache_dir(settings)
    selected = [c for c in data["classes"] if class_ids is None or c["id"] in class_ids]
    total = sum(len(c["images"]) for c in selected)
    progress(status="preparing", message=f"Đang kiểm tra và chuẩn bị {total} ảnh Office & Fruit…")
    finished = 0
    def prepare(entry):
        key, item = entry
        try:
            return prepare_one(root, key, item)
        except Exception as exc:
            raise AppError(503, "SAMPLE_IMAGE_UNAVAILABLE", f"Chưa tải được ảnh {key}/{item['image_id']}. Kiểm tra Internet rồi thử lại; ảnh đã tải được giữ lại.") from exc
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for _ in pool.map(prepare, [(c["id"], item) for c in selected for item in c["images"]]):
            finished += 1
            progress(message=f"Chuẩn bị Office & Fruit: {finished}/{total} ảnh")
    # Only publish the full-cache marker when all classes are present.
    if all((root / c["id"] / f"{item['image_id']}.jpg").is_file() for c in data["classes"] for item in c["images"]):
        root.mkdir(parents=True, exist_ok=True)
        (root / ".ready.json").write_text(json.dumps({"manifest_sha256": manifest_hash()}), encoding="utf-8")
    return root


def attribution_text(classes: list[dict]) -> str:
    lines = ["Office & Fruit — Vision Lab curated subset of Open Images", SOURCE_URL,
             "Images: CC BY 2.0 https://creativecommons.org/licenses/by/2.0/",
             "Annotations: Google LLC, CC BY 4.0 https://creativecommons.org/licenses/by/4.0/",
             "Changes: object bounding-box crop with 4% context; source orientation correction; RGB conversion; resize <=512px; JPEG re-encoding.",
             "One crop per original photo; class labels translated to Vietnamese. No synthetic augmentation in this dataset.", ""]
    for cls in classes:
        for item in cls["images"]:
            lines.append(f"{cls['id']}/{item['image_id']}.jpg | {item.get('Author', '')} | {item.get('Title', '')} | {item.get('OriginalLandingURL', '')} | {item.get('License', '')}")
    return "\n".join(lines) + "\n"


def import_project(settings: Settings, class_ids: list[str], images_per_class: int, seed: int,
                   project_name: str, progress) -> str:
    import random
    import shutil
    from sqlmodel import Session
    from app.core.db import get_engine
    from app.models.db_models import Project, ImageClass, ImageRecord, new_id
    from app.services.image_ingest import process_image

    validate_selection(class_ids, images_per_class, settings)
    root = ensure_cache(settings, progress, class_ids)
    project = Project(name=project_name.strip() or NAME)
    project_id = project.id
    folder = settings.projects_dir / project_id
    selected = []
    imported = 0
    progress(status="importing", imported_images=0, message="Đang tạo dự án Office & Fruit…")
    try:
        (folder / "images").mkdir(parents=True)
        (folder / "thumbs").mkdir()
        with Session(get_engine()) as session:
            session.add(project)
            session.flush()
            hashes = set()
            for cls in manifest()["classes"]:
                if cls["id"] not in class_ids:
                    continue
                candidates = list(cls["images"])
                random.Random(f"{seed}:{cls['id']}").shuffle(candidates)
                chosen = candidates[:images_per_class]
                selected.append({**cls, "images": chosen})
                db_class = ImageClass(project_id=project.id, name=cls["name"], position=len(selected) - 1)
                session.add(db_class)
                session.flush()
                for item in chosen:
                    path, _ = _paths(root, cls["id"], item)
                    image = process_image(path.read_bytes(), settings)
                    if image.sha256 in hashes:
                        raise bad_request("DUPLICATE_CURATED_IMAGE", "Dataset có ảnh trùng giữa các lớp; cần kiểm tra lại bộ dữ liệu nguồn.")
                    hashes.add(image.sha256)
                    image_id = new_id()
                    rel = f"{project.id}/images/{image_id}.jpg"
                    thumb_rel = f"{project.id}/thumbs/{image_id}.jpg"
                    (settings.projects_dir / rel).write_bytes(image.jpeg_bytes)
                    (settings.projects_dir / thumb_rel).write_bytes(image.thumb_bytes)
                    session.add(ImageRecord(
                        id=image_id, project_id=project.id, class_id=db_class.id, source="sample",
                        session_id=f"openimages:{cls['id']}:{item['image_id']}", original_name=f"{cls['id']}/{item['image_id']}.jpg",
                        original_width=image.original_width, original_height=image.original_height,
                        width=image.width, height=image.height, sha256=image.sha256, dhash=image.dhash,
                        color_hist=image.color_hist, rel_path=rel, thumb_rel_path=thumb_rel, size_bytes=len(image.jpeg_bytes),
                    ))
                    imported += 1
                    progress(imported_images=imported, message=f"Đang thêm ảnh: {imported}/{len(class_ids) * images_per_class}")
            metadata = {"id": "office-fruit", "name": NAME, "version": 1, "source_url": SOURCE_URL,
                        "class_ids": [c["id"] for c in selected], "images_per_class": images_per_class,
                        "imported_images": imported, "seed": seed, "manifest_sha256": manifest_hash(),
                        "license": "Images CC BY 2.0; annotations CC BY 4.0",
                        "preprocessing": "Object crops, RGB, max 512px, one crop per original photo, balanced classes"}
            (folder / "sample-dataset.json").write_text(json.dumps(metadata, ensure_ascii=False), encoding="utf-8")
            (folder / "DATASET-LICENSE.txt").write_text(attribution_text(selected), encoding="utf-8")
            (folder / "IMAGE-PROVENANCE.json").write_text(json.dumps(selected, ensure_ascii=False), encoding="utf-8")
            session.commit()
        return project_id
    except Exception:
        # folder is generated here from a UUID, never a caller-supplied directory.
        shutil.rmtree(folder, ignore_errors=True)
        raise
