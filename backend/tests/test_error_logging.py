import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import install_error_handlers
from app.services.training_service import JobState, TrainingManager


LOGGER = "uvicorn.error.visionlab"


def test_validation_logs_endpoint_and_config_reason(client, caplog):
    with caplog.at_level(logging.WARNING, logger=LOGGER):
        response = client.post("/api/training/start", json={
            "project_id": "x", "config": {"mode": "advanced", "conv_blocks": 3, "conv_filters": [16, 32]},
        })
    assert response.status_code == 422
    assert "POST /api/training/start -> 422 VALIDATION_ERROR" in caplog.text
    assert "conv_filters" in caplog.text and "conv_blocks" in caplog.text
    assert response.json()["error"]["details"][0]["field"] == "config"
    assert "value_error" in caplog.text


def test_expected_api_errors_are_logged(client, caplog):
    with caplog.at_level(logging.WARNING, logger=LOGGER):
        response = client.get("/api/projects/missing-project")
    assert response.status_code == 404
    assert "GET /api/projects/missing-project -> 404 NOT_FOUND" in caplog.text
    assert response.json()["error"]["message"] in caplog.text


def test_http_errors_are_logged(client, caplog):
    with caplog.at_level(logging.WARNING, logger=LOGGER):
        response = client.delete("/api/health")
    assert response.status_code == 405
    assert "DELETE /api/health -> 405 METHOD_NOT_ALLOWED" in caplog.text


def test_unexpected_error_logs_traceback_and_returns_structured_error(caplog):
    app = FastAPI()
    install_error_handlers(app)

    @app.get("/crash")
    def crash():
        raise RuntimeError("diagnostic failure")

    with TestClient(app, raise_server_exceptions=False) as isolated_client, caplog.at_level(logging.ERROR, logger=LOGGER):
        response = isolated_client.get("/crash")
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "GET /crash -> 500 INTERNAL_ERROR" in caplog.text
    assert "RuntimeError: diagnostic failure" in caplog.text
    assert any(record.exc_info for record in caplog.records)
    assert "diagnostic failure" not in response.text


def test_worker_failures_log_job_code_reason_and_complete_traceback(caplog, monkeypatch):
    manager = TrainingManager()
    monkeypatch.setattr(manager, "_persist", lambda *args, **kwargs: None)
    monkeypatch.setattr(manager, "_publish", lambda *args, **kwargs: None)
    state = JobState(id="logging-test", project_id="project-test", config={}, dataset_summary={}, total_epochs=1)
    traceback = "Traceback (most recent call last):\n" + "frame\n" * 400 + "RuntimeError: worker diagnostic"
    with caplog.at_level(logging.ERROR, logger=LOGGER):
        manager._handle(state, {"type": "error", "code": "TRAINING_CRASHED", "message": "worker failed", "details": traceback})
    assert state.status == "failed"
    assert "job=logging-test project=project-test TRAINING_CRASHED: worker failed" in caplog.text
    assert traceback in caplog.text
