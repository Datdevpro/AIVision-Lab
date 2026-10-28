"""Projects, classes, images and dataset endpoints."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
import urllib.parse
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.db import get_session
from app.core.errors import bad_request, not_found
from app.models.db_models import ImageRecord, Project
from app.schemas.api import (
    ClassCreate, ClassOut, ClassUpdate, DatasetOut, ImageOut, ImageUpdate, ProjectCreate,
    ProjectOut, ProjectUpdate, Subset, UploadResponse,
)
from app.services import dataset_service as ds
from app.services import experiment_service as es

router = APIRouter(tags=["dataset"])
SessionDep = Annotated[Session, Depends(get_session)]


def _project_out(session: Session, p: Project) -> ProjectOut:
    return ProjectOut(
        id=p.id, name=p.name, created_at=p.created_at,
        num_classes=len(ds.list_classes(session, p.id)),
        num_images=len(session.exec(select(ImageRecord.id).where(ImageRecord.project_id == p.id)).all()),
        latest_experiment_id=es.latest_experiment_id(session, p.id),
    )


@router.get("/projects", response_model=list[ProjectOut])
def list_projects(session: SessionDep):
    return [_project_out(session, p) for p in session.exec(select(Project).order_by(Project.created_at))]


@router.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, session: SessionDep):
    return _project_out(session, ds.create_project(session, body.name, body.default_classes))


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, session: SessionDep):
    return _project_out(session, ds.get_project(session, project_id))


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def rename_project(project_id: str, body: ProjectUpdate, session: SessionDep):
    p = ds.get_project(session, project_id)
    p.name = body.name.strip()
    session.add(p)
    session.commit()
    return _project_out(session, p)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str, session: SessionDep):
    """Deletes the project, all its images, experiments and checkpoints."""
    ds.delete_project(session, project_id)


@router.post("/projects/{project_id}/classes", response_model=ClassOut, status_code=201)
def add_class(project_id: str, body: ClassCreate, session: SessionDep):
    c = ds.add_class(session, project_id, body.name)
    return ClassOut(id=c.id, project_id=c.project_id, name=c.name, position=c.position)


@router.patch("/classes/{class_id}", response_model=ClassOut)
def rename_class(class_id: str, body: ClassUpdate, session: SessionDep):
    c = ds.rename_class(session, class_id, body.name)
    return ClassOut(id=c.id, project_id=c.project_id, name=c.name, position=c.position)


@router.delete("/classes/{class_id}", status_code=204)
def delete_class(class_id: str, session: SessionDep):
    ds.delete_class(session, class_id)


@router.delete("/classes/{class_id}/images")
def clear_class_images(class_id: str, session: SessionDep):
    """Delete all images in a specific class."""
    return {"deleted": ds.clear_class_images(session, class_id)}


@router.get("/classes/{class_id}/export")
def export_class_images(class_id: str, session: SessionDep):
    """Download all images in this class as a ZIP file."""
    filename, zip_bytes = ds.export_class_images(session, class_id)
    encoded_filename = urllib.parse.quote(filename)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"},
    )


@router.get("/projects/{project_id}/dataset", response_model=DatasetOut)
def get_dataset(
    project_id: str, session: SessionDep,
    strategy: str = Query("random", pattern="^(random|explicit)$"),
    val_split: float = Query(0.2, ge=0.1, le=0.5),
    seed: int = Query(42, ge=0, le=2**31 - 1),
):
    return ds.dataset_view(session, project_id, strategy, val_split, seed)


@router.get("/projects/{project_id}/dataset-license")
def dataset_license(project_id: str, session: SessionDep):
    ds.get_project(session, project_id)
    path = ds.project_dir(project_id) / "DATASET-LICENSE.txt"
    if not path.is_file():
        raise not_found("thông tin bản quyền dataset")
    return FileResponse(path, media_type="text/plain; charset=utf-8", filename="Flower-Photos-LICENSE.txt")


@router.post("/projects/{project_id}/images", response_model=UploadResponse, status_code=201)
async def upload_images(
    project_id: str,
    session: SessionDep,
    class_id: Annotated[str, Form()],
    files: Annotated[list[UploadFile], File()],
    subset: Annotated[Subset, Form()] = "train",
    session_id: Annotated[str | None, Form()] = None,
    source: Annotated[str, Form()] = "upload",
):
    """Upload one or many images (JPEG/PNG/WebP). Each file gets its own accept/reject result."""
    settings = get_settings()
    if len(files) > settings.max_files_per_request:
        raise bad_request("TOO_MANY_FILES", f"Mỗi lần tải lên tối đa {settings.max_files_per_request} ảnh.")
    payload: list[tuple[str, bytes]] = []
    for f in files:
        data = await f.read(settings.max_upload_bytes + 1)  # never buffer more than limit + 1 byte
        payload.append((f.filename or "image", data))
    results = await run_in_threadpool(ds.ingest_files, session, project_id, class_id, subset, session_id, source, payload)
    acc = sum(1 for r in results if r.status == "accepted")
    return UploadResponse(accepted=acc, rejected=len(results) - acc, results=results)


@router.delete("/projects/{project_id}/images")
def clear_images(project_id: str, session: SessionDep):
    """Delete every image of the project (dataset deletion for privacy)."""
    return {"deleted": ds.clear_dataset(session, project_id)}


@router.patch("/images/{image_id}", response_model=ImageOut)
def update_image(image_id: str, body: ImageUpdate, session: SessionDep):
    return ds.image_out(ds.update_image(session, image_id, body.class_id, body.subset))


@router.delete("/images/{image_id}", status_code=204)
def delete_image(image_id: str, session: SessionDep):
    ds.delete_image(session, image_id)


@router.get("/images/{image_id}/file")
def image_file(image_id: str, session: SessionDep, thumb: bool = False):
    img = ds.get_image(session, image_id)
    return FileResponse(ds.image_file_path(img, thumb), media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"})
