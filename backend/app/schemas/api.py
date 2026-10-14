"""Request/response schemas for the REST API."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.training_config import TrainingConfig

Subset = Literal["train", "val", "test"]


class ProjectCreate(BaseModel):
    name: str = Field("Dự án mới", min_length=1, max_length=80)
    default_classes: bool = True


class ProjectUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)


class ProjectOut(BaseModel):
    id: str
    name: str
    created_at: datetime
    num_classes: int = 0
    num_images: int = 0
    latest_experiment_id: str | None = None


class ClassCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=40)


class ClassUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=40)


class ClassOut(BaseModel):
    id: str
    project_id: str
    name: str
    position: int


class ImageOut(BaseModel):
    id: str
    class_id: str
    subset: Subset
    session_id: str | None
    source: str
    original_name: str
    original_width: int
    original_height: int
    width: int
    height: int
    created_at: datetime


class ImageUpdate(BaseModel):
    class_id: str | None = None
    subset: Subset | None = None


class UploadResult(BaseModel):
    filename: str
    status: Literal["accepted", "rejected"]
    code: str | None = None
    message: str | None = None
    image: ImageOut | None = None


class UploadResponse(BaseModel):
    accepted: int
    rejected: int
    results: list[UploadResult]


class ClassWithImages(ClassOut):
    images: list[ImageOut]


class DatasetOut(BaseModel):
    project_id: str
    classes: list[ClassWithImages]
    summary: dict[str, Any]


class TrainingStartRequest(BaseModel):
    project_id: str
    config: TrainingConfig = Field(default_factory=TrainingConfig)
    experiment_name: str | None = Field(None, max_length=80)


class EstimateRequest(BaseModel):
    config: TrainingConfig = Field(default_factory=TrainingConfig)
    num_classes: int = Field(2, ge=2, le=10)


class JobOut(BaseModel):
    id: str
    project_id: str
    status: str
    message: str | None = None
    config: dict[str, Any]
    dataset_summary: dict[str, Any] = {}
    epochs: list[dict[str, Any]] = []
    total_epochs: int = 0
    progress: float = 0.0
    batch: dict[str, Any] | None = None
    device: str | None = None
    device_name: str | None = None
    param_counts: dict[str, Any] | None = None
    error: dict[str, Any] | None = None
    experiment_id: str | None = None
    elapsed_s: float = 0.0
    created_at: datetime | None = None


class ExperimentSummary(BaseModel):
    id: str
    project_id: str
    name: str
    mode: str
    architecture: str
    created_at: datetime
    seed: int
    duration_s: float
    device: str
    config: dict[str, Any]
    class_names: list[str]
    dataset_fingerprint: str
    split_fingerprint: str
    best_epoch: int | None
    best_val_accuracy: float | None
    best_val_loss: float | None
    final_train_accuracy: float | None
    test_accuracy: float | None
    num_epochs: int
    param_counts: dict[str, Any]


class ExperimentDetail(ExperimentSummary):
    dataset_summary: dict[str, Any]
    epoch_metrics: list[dict[str, Any]]
    best_checkpoint: dict[str, Any]
    evaluation: dict[str, Any]
    metadata: dict[str, Any]


class ExperimentUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)


class PredictionItem(BaseModel):
    index: int
    label: str
    probability: float


class PredictionOut(BaseModel):
    experiment_id: str
    predicted_index: int
    predicted_label: str
    confidence: float
    probabilities: list[PredictionItem]
    latency_ms: float
    total_ms: float
    device: str
    note: str = "Đây là đầu ra của mô hình để học tập, không phải sự thật tuyệt đối."


class FeedbackIn(BaseModel):
    experiment_id: str
    predicted_label: str
    correct: bool
    true_label: str | None = None
    confidence: float | None = None


class FeedbackStats(BaseModel):
    experiment_id: str
    total: int
    correct: int
    accuracy: float | None
