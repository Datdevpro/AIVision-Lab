"""Publish samples into a new project or an existing empty project."""
import shutil

from sqlalchemy import text
from sqlmodel import Session, select

from app.core.errors import conflict, not_found
from app.models.db_models import Experiment, ImageClass, ImageRecord, Project, TrainingJob, new_id


def empty_target(session: Session, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise not_found("dự án")
    if session.exec(select(ImageRecord.id).where(ImageRecord.project_id == project_id)).first() or session.exec(
        select(Experiment.id).where(Experiment.project_id == project_id)
    ).first():
        raise conflict("SAMPLE_TARGET_NOT_EMPTY", "Dự án đã có ảnh hoặc lịch sử huấn luyện. Hãy chọn dự án trống hoặc tạo dự án mới.")
    if session.exec(select(TrainingJob.id).where(
        TrainingJob.project_id == project_id, TrainingJob.status.in_(["preparing", "training", "validating"])
    )).first():
        raise conflict("TRAINING_ACTIVE", "Dự án đang huấn luyện; hãy đợi hoàn tất trước khi nhập dataset.")
    return project


def prepare_target(session: Session, project: Project, target_id: str | None) -> Project:
    if target_id:
        # Recheck after downloads and hold the write lock until publication.
        session.execute(text("BEGIN IMMEDIATE"))
        project = empty_target(session, target_id)
        for cls in session.exec(select(ImageClass).where(ImageClass.project_id == target_id)):
            session.delete(cls)
    else:
        session.add(project)
    session.flush()
    return project


def commit_import(session: Session, settings, folder, project_id: str):
    destination = settings.projects_dir / project_id
    if folder == destination:
        session.commit()
        return
    backup = settings.projects_dir / new_id()
    root = settings.projects_dir.resolve()
    for path in (folder, destination, backup):
        if path.resolve().parent != root:
            raise ValueError("Sample import path must stay inside the projects directory")
    had_folder = destination.exists()
    if had_folder:
        destination.rename(backup)
    try:
        folder.rename(destination)
        session.commit()
    except Exception:
        if destination.exists():
            destination.rename(folder)
        if had_folder:
            backup.rename(destination)
        raise
    if had_folder:
        shutil.rmtree(backup, ignore_errors=True)
