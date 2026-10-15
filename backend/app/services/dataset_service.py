"""Dataset service: projects, classes, images (DB + files) and dataset summaries."""
from __future__ import annotations

import re
import shutil
from pathlib import Path

from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.errors import AppError, bad_request, conflict, not_found
from app.models.db_models import Experiment, ImageClass, ImageRecord, Project, new_id
from app.schemas.api import ImageOut, UploadResult
from app.services import dataset_logic as logic
from app.services.image_ingest import ImageRejected, process_image

SESSION_RE = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
DEFAULT_CLASS_NAMES = ["Lớp 1", "Lớp 2"]


# ------------------------------------------------------------------ projects
def get_project(session: Session, project_id: str) -> Project:
    p = session.get(Project, project_id)
    if not p:
        raise not_found("dự án")
    return p


def create_project(session: Session, name: str, default_classes: bool) -> Project:
    p = Project(name=name.strip())
    session.add(p)
    session.flush()
    if default_classes:
        for pos, n in enumerate(DEFAULT_CLASS_NAMES):
            session.add(ImageClass(project_id=p.id, name=n, position=pos))
    session.commit()
    session.refresh(p)
    return p


def project_dir(project_id: str, settings: Settings | None = None) -> Path:
    s = settings or get_settings()
    return s.projects_dir / project_id


def list_classes(session: Session, project_id: str) -> list[ImageClass]:
    return list(session.exec(
        select(ImageClass).where(ImageClass.project_id == project_id).order_by(ImageClass.position, ImageClass.created_at)
    ))


def _delete_image_files(img: ImageRecord, settings: Settings) -> None:
    for rel in (img.rel_path, img.thumb_rel_path):
        if rel:
            (settings.projects_dir / rel).unlink(missing_ok=True)


def delete_project(session: Session, project_id: str) -> None:
    project = get_project(session, project_id)
    for e in session.exec(select(Experiment).where(Experiment.project_id == project_id)):
        delete_experiment_files(e)
        session.delete(e)
    for img in session.exec(select(ImageRecord).where(ImageRecord.project_id == project_id)):
        session.delete(img)
    for c in list_classes(session, project_id):
        session.delete(c)
    session.delete(project)
    session.commit()
    shutil.rmtree(project_dir(project_id), ignore_errors=True)


def delete_experiment_files(e: Experiment) -> None:
    if e.checkpoint_path:
        shutil.rmtree((get_settings().checkpoints_dir / e.checkpoint_path).parent, ignore_errors=True)


def clear_dataset(session: Session, project_id: str) -> int:
    settings = get_settings()
    get_project(session, project_id)
    n = 0
    for img in session.exec(select(ImageRecord).where(ImageRecord.project_id == project_id)):
        _delete_image_files(img, settings)
        session.delete(img)
        n += 1
    session.commit()
    return n


# ------------------------------------------------------------------ classes
def _check_class_name(session: Session, project_id: str, name: str, ignore_id: str | None = None) -> str:
    name = name.strip()
    if not name:
        raise bad_request("INVALID_NAME", "Tên class không được để trống.")
    for c in list_classes(session, project_id):
        if c.id != ignore_id and c.name.casefold() == name.casefold():
            raise conflict("DUPLICATE_CLASS", f"Đã có class tên “{name}”.")
    return name


def add_class(session: Session, project_id: str, name: str) -> ImageClass:
    get_project(session, project_id)
    classes = list_classes(session, project_id)
    if len(classes) >= get_settings().max_classes:
        raise bad_request("TOO_MANY_CLASSES", f"Tối đa {get_settings().max_classes} class.")
    name = _check_class_name(session, project_id, name)
    c = ImageClass(project_id=project_id, name=name, position=(classes[-1].position + 1) if classes else 0)
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


def rename_class(session: Session, class_id: str, name: str) -> ImageClass:
    c = session.get(ImageClass, class_id)
    if not c:
        raise not_found("class")
    c.name = _check_class_name(session, c.project_id, name, ignore_id=c.id)
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


def delete_class(session: Session, class_id: str) -> None:
    c = session.get(ImageClass, class_id)
    if not c:
        raise not_found("class")
    settings = get_settings()
    for img in session.exec(select(ImageRecord).where(ImageRecord.class_id == class_id)):
        _delete_image_files(img, settings)
        session.delete(img)
    session.delete(c)
    session.commit()


def clear_class_images(session: Session, class_id: str) -> int:
    c = session.get(ImageClass, class_id)
    if not c:
        raise not_found("class")
    settings = get_settings()
    n = 0
    for img in session.exec(select(ImageRecord).where(ImageRecord.class_id == class_id)):
        _delete_image_files(img, settings)
        session.delete(img)
        n += 1
    session.commit()
    return n


def export_class_images(session: Session, class_id: str) -> tuple[str, bytes]:
    """Create a zip archive containing all images of this class."""
    import io
    import zipfile
    c = session.get(ImageClass, class_id)
    if not c:
        raise not_found("class")
    settings = get_settings()
    imgs = list(session.exec(select(ImageRecord).where(ImageRecord.class_id == class_id).order_by(ImageRecord.created_at)))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for idx, img in enumerate(imgs, 1):
            path = (settings.projects_dir / img.rel_path).resolve()
            if path.is_file():
                ext = path.suffix or ".jpg"
                filename = f"{c.name}_{idx:03d}{ext}"
                zf.write(path, arcname=filename)
    buf.seek(0)
    return f"{c.name}_samples.zip", buf.getvalue()


# ------------------------------------------------------------------ images
def image_out(img: ImageRecord) -> ImageOut:
    return ImageOut(
        id=img.id, class_id=img.class_id, subset=img.subset, session_id=img.session_id, source=img.source,
        original_name=img.original_name, original_width=img.original_width, original_height=img.original_height,
        width=img.width, height=img.height, created_at=img.created_at,
    )


def ingest_files(
    session: Session, project_id: str, class_id: str, subset: str, session_id: str | None,
    source: str, files: list[tuple[str, bytes]],
) -> list[UploadResult]:
    settings = get_settings()
    get_project(session, project_id)
    cls = session.get(ImageClass, class_id)
    if not cls or cls.project_id != project_id:
        raise not_found("class")
    if session_id is not None and not SESSION_RE.match(session_id):
        raise bad_request("INVALID_SESSION", "session_id không hợp lệ.")
    if source not in ("upload", "webcam"):
        raise bad_request("INVALID_SOURCE", "source phải là upload hoặc webcam.")
    if len(files) > settings.max_files_per_request:
        raise bad_request("TOO_MANY_FILES", f"Mỗi lần tải lên tối đa {settings.max_files_per_request} ảnh.")

    total = len(session.exec(select(ImageRecord.id).where(ImageRecord.project_id == project_id)).all())
    in_class = len(session.exec(select(ImageRecord.id).where(ImageRecord.class_id == class_id)).all())
    existing_hashes = {h for h in session.exec(select(ImageRecord.sha256).where(ImageRecord.project_id == project_id))}
    pdir = project_dir(project_id, settings)
    (pdir / "images").mkdir(parents=True, exist_ok=True)
    (pdir / "thumbs").mkdir(parents=True, exist_ok=True)

    results: list[UploadResult] = []
    for name, data in files:
        try:
            if total >= settings.max_images_per_project:
                raise ImageRejected("PROJECT_FULL", f"Dự án đã đạt giới hạn {settings.max_images_per_project} ảnh.")
            if in_class >= settings.max_images_per_class:
                raise ImageRejected("CLASS_FULL", f"Class đã đạt giới hạn {settings.max_images_per_class} ảnh.")
            proc = process_image(data, settings)
            if proc.sha256 in existing_hashes:
                raise ImageRejected("DUPLICATE_IMAGE", "Ảnh này đã có trong dự án (trùng hoàn toàn).")
            image_id = new_id()
            rel = f"{project_id}/images/{image_id}.jpg"
            trel = f"{project_id}/thumbs/{image_id}.jpg"
            (settings.projects_dir / rel).write_bytes(proc.jpeg_bytes)
            (settings.projects_dir / trel).write_bytes(proc.thumb_bytes)
            rec = ImageRecord(
                id=image_id, project_id=project_id, class_id=class_id, subset=subset, session_id=session_id,
                source=source, original_name=(name or "")[:120], original_width=proc.original_width,
                original_height=proc.original_height, width=proc.width, height=proc.height, sha256=proc.sha256,
                dhash=proc.dhash, color_hist=proc.color_hist, rel_path=rel, thumb_rel_path=trel,
                size_bytes=len(proc.jpeg_bytes),
            )
            session.add(rec)
            session.commit()
            existing_hashes.add(proc.sha256)
            total += 1
            in_class += 1
            results.append(UploadResult(filename=name, status="accepted", image=image_out(rec)))
        except ImageRejected as exc:
            results.append(UploadResult(filename=name, status="rejected", code=exc.code, message=exc.message))
    return results


def get_image(session: Session, image_id: str) -> ImageRecord:
    img = session.get(ImageRecord, image_id)
    if not img:
        raise not_found("ảnh")
    return img


def image_file_path(img: ImageRecord, thumb: bool) -> Path:
    """Paths always come from the DB, never from user input, and are verified to stay in the data dir."""
    root = get_settings().projects_dir.resolve()
    p = (root / (img.thumb_rel_path if thumb else img.rel_path)).resolve()
    if root not in p.parents or not p.is_file():
        raise not_found("tệp ảnh")
    return p


def delete_image(session: Session, image_id: str) -> None:
    img = get_image(session, image_id)
    _delete_image_files(img, get_settings())
    session.delete(img)
    session.commit()


def update_image(session: Session, image_id: str, class_id: str | None, subset: str | None) -> ImageRecord:
    img = get_image(session, image_id)
    if class_id is not None:
        cls = session.get(ImageClass, class_id)
        if not cls or cls.project_id != img.project_id:
            raise not_found("class")
        img.class_id = class_id
    if subset is not None:
        img.subset = subset
    session.add(img)
    session.commit()
    session.refresh(img)
    return img


# ------------------------------------------------------------------ dataset view / summary
def project_items(session: Session, project_id: str) -> tuple[list[logic.Item], list[tuple[str, str]], dict[str, ImageRecord]]:
    classes = [(c.id, c.name) for c in list_classes(session, project_id)]
    imgs = list(session.exec(select(ImageRecord).where(ImageRecord.project_id == project_id).order_by(ImageRecord.created_at)))
    items = [
        logic.Item(id=i.id, class_id=i.class_id, subset=i.subset, session_id=i.session_id,
                   sha256=i.sha256, dhash=i.dhash, color_hist=list(i.color_hist or []))
        for i in imgs
    ]
    return items, classes, {i.id: i for i in imgs}


def dataset_summary(session: Session, project_id: str, strategy: str = "random", val_split: float = 0.2, seed: int = 42) -> dict:
    get_project(session, project_id)
    items, classes, _ = project_items(session, project_id)
    summary = logic.build_summary(items, classes, strategy, val_split, seed)
    summary.pop("assignment", None)
    return summary


def dataset_view(session: Session, project_id: str, strategy: str, val_split: float, seed: int) -> dict:
    get_project(session, project_id)
    classes = list_classes(session, project_id)
    imgs = list(session.exec(select(ImageRecord).where(ImageRecord.project_id == project_id).order_by(ImageRecord.created_at)))
    by_class: dict[str, list[ImageOut]] = {c.id: [] for c in classes}
    for i in imgs:
        by_class.setdefault(i.class_id, []).append(image_out(i))
    return {
        "project_id": project_id,
        "classes": [
            {"id": c.id, "project_id": c.project_id, "name": c.name, "position": c.position, "images": by_class.get(c.id, [])}
            for c in classes
        ],
        "summary": dataset_summary(session, project_id, strategy, val_split, seed),
    }
