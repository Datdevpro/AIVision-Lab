"""Curated sample datasets, imported into isolated new projects."""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.sample_datasets import flowers_catalog, sample_imports

router = APIRouter(tags=["sample datasets"])


class FlowerImportRequest(BaseModel):
    class_ids: list[str] = Field(min_length=2, max_length=5)
    images_per_class: int = Field(100, ge=20, le=500)
    seed: int = Field(42, ge=0, le=2**31 - 1)
    project_name: str = Field("Flower Photos", min_length=1, max_length=80)


@router.get("/sample-datasets")
def catalog():
    return {"datasets": [flowers_catalog()]}


@router.post("/sample-datasets/flowers/import", status_code=202)
def start_import(body: FlowerImportRequest):
    return sample_imports.start(body.class_ids, body.images_per_class, body.seed, body.project_name)


@router.get("/sample-datasets/imports/{job_id}")
def import_status(job_id: str):
    return sample_imports.get(job_id)
