"""SQLModel tables."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Project(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=utcnow)


class ImageClass(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    project_id: str = Field(foreign_key="project.id", index=True)
    name: str
    position: int = 0
    created_at: datetime = Field(default_factory=utcnow)


class ImageRecord(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    project_id: str = Field(foreign_key="project.id", index=True)
    class_id: str = Field(foreign_key="imageclass.id", index=True)
    subset: str = "train"  # train | val | test
    session_id: str | None = None  # capture session (webcam frames of one session are correlated)
    source: str = "upload"  # upload | webcam
    original_name: str = ""
    original_width: int = 0
    original_height: int = 0
    width: int = 0  # stored (normalised) size
    height: int = 0
    sha256: str = Field(default="", index=True)
    dhash: str = ""  # 64-bit difference hash (hex) for near-duplicate detection
    color_hist: list[float] = Field(default_factory=list, sa_column=Column(JSON))
    rel_path: str = ""
    thumb_rel_path: str = ""
    size_bytes: int = 0
    created_at: datetime = Field(default_factory=utcnow)


class TrainingJob(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    project_id: str = Field(index=True)
    status: str = "preparing"
    config: dict = Field(default_factory=dict, sa_column=Column(JSON))
    dataset_summary: dict = Field(default_factory=dict, sa_column=Column(JSON))
    epochs: list = Field(default_factory=list, sa_column=Column(JSON))
    error: dict | None = Field(default=None, sa_column=Column(JSON))
    experiment_id: str | None = None
    device: str | None = None
    total_epochs: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    started_at: datetime | None = None
    finished_at: datetime | None = None


class Experiment(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    project_id: str = Field(index=True)
    job_id: str | None = None
    name: str = ""
    mode: str = "beginner"
    architecture: str = "mobilenet_v3_small"
    config: dict = Field(default_factory=dict, sa_column=Column(JSON))
    class_names: list = Field(default_factory=list, sa_column=Column(JSON))
    dataset_summary: dict = Field(default_factory=dict, sa_column=Column(JSON))
    dataset_fingerprint: str = ""
    split_fingerprint: str = ""
    seed: int = 0
    epoch_metrics: list = Field(default_factory=list, sa_column=Column(JSON))
    best_checkpoint: dict = Field(default_factory=dict, sa_column=Column(JSON))
    evaluation: dict = Field(default_factory=dict, sa_column=Column(JSON))
    param_counts: dict = Field(default_factory=dict, sa_column=Column(JSON))
    duration_s: float = 0.0
    device: str = "cpu"
    checkpoint_path: str = ""  # relative to settings.checkpoints_dir
    created_at: datetime = Field(default_factory=utcnow)


class InferenceFeedback(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    experiment_id: str = Field(index=True)
    predicted_label: str
    correct: bool
    true_label: str | None = None
    confidence: float | None = None
    created_at: datetime = Field(default_factory=utcnow)
