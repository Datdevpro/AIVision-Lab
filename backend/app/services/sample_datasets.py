"""Flower Photos catalog, verified local cache and atomic project imports."""
from __future__ import annotations

import copy
import hashlib
import json
import logging
import random
import shutil
import tarfile
import threading
import urllib.error
import urllib.request
from pathlib import Path, PurePosixPath
from typing import Callable

from sqlmodel import Session

from app.core.config import Settings, get_settings
from app.core.db import get_engine
from app.core.errors import AppError, bad_request, conflict, not_found
from app.models.db_models import ImageClass, ImageRecord, Project, new_id
from app.services.image_ingest import ImageRejected, process_image

logger = logging.getLogger("uvicorn.error.visionlab")
FLOWERS_URL = "https://storage.googleapis.com/download.tensorflow.org/example_images/flower_photos.tgz"
# TensorFlow Datasets: datasets/tf_flowers/checksums.tsv.
FLOWERS_SHA256 = "4c54ace7911aaffe13a365c34f650e71dd5bf1be0a58b464e5a7183e3e595d9c"
FLOWERS_BYTES = 228_813_984
FLOWER_CLASSES = (
    ("daisy", "Hoa cúc", 633),
    ("dandelion", "Bồ công anh", 898),
    ("roses", "Hoa hồng", 641),
    ("sunflowers", "Hoa hướng dương", 699),
    ("tulips", "Hoa tulip", 799),
)
SOURCE_URL = "https://www.tensorflow.org/tutorials/load_data/images"
Progress = Callable[..., None]


def cache_dir(settings: Settings) -> Path:
    return settings.data_dir / "sample_datasets" / "flowers"


def cached_flowers(settings: Settings) -> Path | None:
    root = cache_dir(settings) / "flower_photos"
    try:
        marker = json.loads((root / ".ready.json").read_text(encoding="utf-8"))
        if marker.get("sha256") != FLOWERS_SHA256 or not (root / "LICENSE.txt").is_file():
            return None
        for key, _, count in FLOWER_CLASSES:
            if len(list((root / key).glob("*.jpg"))) != count:
                return None
        return root
    except (OSError, ValueError, AttributeError):
        return None


def flowers_catalog(settings: Settings | None = None) -> dict:
    s = settings or get_settings()
    return {
        "id": "flowers", "name": "Flower Photos", "description": "Nhận diện 5 loại hoa từ ảnh thực tế. Phù hợp để bắt đầu với MobileNet.",
        "source_url": SOURCE_URL, "download_bytes": FLOWERS_BYTES,
        "cached": cached_flowers(s) is not None,
        "min_classes": 2, "max_classes": min(5, s.max_classes),
        "min_images_per_class": 20, "max_images_per_class": min(500, s.max_images_per_class),
        "max_images_per_project": s.max_images_per_project,
        "classes": [{"id": key, "name": name, "available": count,
                     "preview_url": f"/datasets/flowers/{key}.jpg"} for key, name, count in FLOWER_CLASSES],
    }


def _archive_valid(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size != FLOWERS_BYTES:
        return False
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest() == FLOWERS_SHA256


def ensure_flowers(settings: Settings, progress: Progress) -> Path:
    ready = cached_flowers(settings)
    if ready:
        return ready
    root = cache_dir(settings)
    root.mkdir(parents=True, exist_ok=True)
    archive = root / "flower_photos.tgz"
    if not _archive_valid(archive):
        part = root / f"download-{new_id()}.part"
        try:
            progress(status="downloading", message="Đang tải Flower Photos lần đầu…", downloaded_bytes=0)
            digest, received = hashlib.sha256(), 0
            with urllib.request.urlopen(FLOWERS_URL, timeout=45) as response, part.open("wb") as output:
                while block := response.read(1024 * 1024):
                    received += len(block)
                    if received > FLOWERS_BYTES:
                        raise AppError(502, "DATASET_DOWNLOAD_INVALID", "Dung lượng dataset không khớp nguồn chính thức.")
                    output.write(block)
                    digest.update(block)
                    progress(downloaded_bytes=received)
            if received != FLOWERS_BYTES or digest.hexdigest() != FLOWERS_SHA256:
                raise AppError(502, "DATASET_DOWNLOAD_INVALID", "Dataset tải về bị thiếu hoặc sai checksum. Vui lòng thử lại.")
            part.replace(archive)
        except (urllib.error.URLError, OSError) as exc:
            raise AppError(503, "DATASET_DOWNLOAD_FAILED", "Không tải được Flower Photos. Kiểm tra Internet rồi thử lại; dữ liệu đã lưu có thể dùng offline.") from exc
        finally:
            part.unlink(missing_ok=True)

    progress(status="extracting", message="Đang chuẩn bị ảnh và thông tin bản quyền…", downloaded_bytes=FLOWERS_BYTES)
    staging = root / f"extract-{new_id()}"
    staging.mkdir()
    try:
        keys = {key for key, _, _ in FLOWER_CLASSES}
        with tarfile.open(archive, "r:gz") as tar:
            for member in tar:
                path = PurePosixPath(member.name)
                if "\\" in member.name or ".." in path.parts:
                    continue
                # Never extract archive paths, symlinks or arbitrary files directly.
                allowed = (len(path.parts) == 3 and path.parts[0] == "flower_photos"
                           and path.parts[1] in keys and path.suffix == ".jpg") or path.parts == ("flower_photos", "LICENSE.txt")
                if not member.isfile() or not allowed:
                    continue
                if member.size > max(settings.max_upload_bytes, 2_000_000):
                    raise AppError(502, "DATASET_ARCHIVE_INVALID", "Tệp trong dataset vượt giới hạn cho phép.")
                destination = staging.joinpath(*path.parts)
                destination.parent.mkdir(parents=True, exist_ok=True)
                source = tar.extractfile(member)
                if source is not None:
                    with source, destination.open("wb") as output:
                        shutil.copyfileobj(source, output)
        extracted = staging / "flower_photos"
        for key, _, count in FLOWER_CLASSES:
            if len(list((extracted / key).glob("*.jpg"))) != count:
                raise AppError(502, "DATASET_ARCHIVE_INVALID", "Dataset thiếu ảnh. Vui lòng tải lại.")
        if not (extracted / "LICENSE.txt").is_file():
            raise AppError(502, "DATASET_ARCHIVE_INVALID", "Dataset thiếu thông tin bản quyền.")
        (extracted / ".ready.json").write_text(json.dumps({"sha256": FLOWERS_SHA256}), encoding="utf-8")
        destination = root / "flower_photos"
        # Replace only this service's known cache folder, never a user-supplied path.
        if destination.exists():
            shutil.rmtree(destination)
        extracted.replace(destination)
        return destination
    finally:
        shutil.rmtree(staging, ignore_errors=True)


def validate_selection(class_ids: list[str], images_per_class: int, settings: Settings) -> None:
    valid = {key for key, _, _ in FLOWER_CLASSES}
    if (not 2 <= len(class_ids) <= min(5, settings.max_classes)
            or len(set(class_ids)) != len(class_ids) or not set(class_ids) <= valid):
        raise bad_request("INVALID_SAMPLE_CLASSES", "Chọn ít nhất 2 loại hoa khác nhau, trong giới hạn lớp của ứng dụng.")
    if not 20 <= images_per_class <= min(500, settings.max_images_per_class):
        raise bad_request("INVALID_SAMPLE_COUNT", f"Chọn từ 20 đến {min(500, settings.max_images_per_class)} ảnh mỗi lớp.")
    if len(class_ids) * images_per_class > settings.max_images_per_project:
        raise bad_request("PROJECT_FULL", f"Tổng số ảnh không được vượt {settings.max_images_per_project} ảnh/dự án.")


def import_flowers(settings: Settings, class_ids: list[str], images_per_class: int, seed: int,
                   project_name: str, progress: Progress) -> str:
    """Publish a new project in one DB commit; remove staged files on any failure."""
    validate_selection(class_ids, images_per_class, settings)
    cache = ensure_flowers(settings, progress)
    project = Project(name=project_name.strip() or "Flower Photos")
    project_id = project.id
    folder = settings.projects_dir / project_id
    total = len(class_ids) * images_per_class
    progress(status="importing", message="Đang thêm ảnh vào dự án mới…", imported_images=0)
    try:
        (folder / "images").mkdir(parents=True)
        (folder / "thumbs").mkdir()
        with Session(get_engine()) as session:
            session.add(project)
            session.flush()
            hashes: set[str] = set()
            imported = 0
            for position, (key, label, _) in enumerate(c for c in FLOWER_CLASSES if c[0] in class_ids):
                cls = ImageClass(project_id=project.id, name=label, position=position)
                session.add(cls)
                session.flush()
                candidates = sorted((cache / key).glob("*.jpg"))
                random.Random(f"{seed}:{key}").shuffle(candidates)
                accepted = 0
                for path in candidates:
                    try:
                        processed = process_image(path.read_bytes(), settings)
                    except ImageRejected:
                        continue
                    if processed.sha256 in hashes:
                        continue
                    image_id = new_id()
                    rel = f"{project.id}/images/{image_id}.jpg"
                    thumb_rel = f"{project.id}/thumbs/{image_id}.jpg"
                    (settings.projects_dir / rel).write_bytes(processed.jpeg_bytes)
                    (settings.projects_dir / thumb_rel).write_bytes(processed.thumb_bytes)
                    session.add(ImageRecord(
                        id=image_id, project_id=project.id, class_id=cls.id, source="sample",
                        original_name=f"{key}/{path.name}", original_width=processed.original_width,
                        original_height=processed.original_height, width=processed.width, height=processed.height,
                        sha256=processed.sha256, dhash=processed.dhash, color_hist=processed.color_hist,
                        rel_path=rel, thumb_rel_path=thumb_rel, size_bytes=len(processed.jpeg_bytes),
                    ))
                    hashes.add(processed.sha256)
                    accepted += 1
                    imported += 1
                    progress(imported_images=imported, message=f"Đang thêm ảnh: {imported}/{total}")
                    if accepted == images_per_class:
                        break
                if accepted != images_per_class:
                    raise bad_request("SAMPLE_IMAGES_INSUFFICIENT", f"Không đủ ảnh hợp lệ cho lớp {label}. Hãy chọn ít ảnh hơn.")
            metadata = {
                "id": "flowers", "name": "Flower Photos", "source_url": SOURCE_URL,
                "class_ids": class_ids, "images_per_class": images_per_class,
                "imported_images": imported, "seed": seed, "sha256": FLOWERS_SHA256,
            }
            (folder / "sample-dataset.json").write_text(json.dumps(metadata, ensure_ascii=False), encoding="utf-8")
            shutil.copyfile(cache / "LICENSE.txt", folder / "DATASET-LICENSE.txt")
            session.commit()
        return project_id
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise


class SampleImportManager:
    """One background import per backend; GET polling never holds a DB session."""

    def __init__(self):
        self._lock = threading.Lock()
        self._jobs: dict[str, dict] = {}

    def get(self, job_id: str) -> dict:
        with self._lock:
            if job_id not in self._jobs:
                raise not_found("phiên import; backend có thể vừa khởi động lại")
            return copy.deepcopy(self._jobs[job_id])

    def start(self, class_ids: list[str], images_per_class: int, seed: int, project_name: str) -> dict:
        settings = get_settings()
        validate_selection(class_ids, images_per_class, settings)
        with self._lock:
            if any(j["status"] not in ("completed", "failed") for j in self._jobs.values()):
                raise conflict("SAMPLE_IMPORT_BUSY", "Backend đang chuẩn bị một dataset mẫu. Vui lòng đợi hoàn tất.")
            while len(self._jobs) >= 20:
                del self._jobs[next(iter(self._jobs))]
            job_id = new_id()
            job = {"id": job_id, "status": "preparing", "message": "Đang chuẩn bị Flower Photos…",
                   "downloaded_bytes": 0, "download_bytes": FLOWERS_BYTES, "imported_images": 0,
                   "total_images": len(class_ids) * images_per_class, "project_id": None, "error": None}
            self._jobs[job_id] = job
            snapshot = copy.deepcopy(job)

        def progress(**fields):
            with self._lock:
                self._jobs[job_id].update(fields)

        def run():
            try:
                project_id = import_flowers(settings, class_ids, images_per_class, seed, project_name, progress)
                progress(status="completed", project_id=project_id, message="Dataset đã sẵn sàng để huấn luyện.")
            except Exception as exc:
                logger.exception("Flower Photos import failed: %s", job_id)
                message = exc.message if isinstance(exc, AppError) else "Không thể import dataset. Kiểm tra dung lượng ổ đĩa và thử lại."
                progress(status="failed", message=message, error=message)

        threading.Thread(target=run, name=f"sample-import-{job_id[:8]}", daemon=True).start()
        return snapshot


sample_imports = SampleImportManager()
