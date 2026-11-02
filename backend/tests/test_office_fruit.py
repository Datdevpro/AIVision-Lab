"""Combined samples must be balanced, offline-capable, isolated and trainable."""
from dataclasses import replace
import hashlib
import io
import json
import time
import zipfile

import pytest
import numpy as np
from PIL import Image

from app.core.config import get_settings
from app.core.errors import AppError
from app.services import office_fruit as office
from tests.conftest import make_image_bytes


@pytest.fixture
def office_cache(client, tmp_path, monkeypatch):
    manifest_path = tmp_path / "manifest.json"
    monkeypatch.setattr(office, "MANIFEST_PATH", manifest_path)
    root = tmp_path / "cache"
    monkeypatch.setattr(office, "cache_dir", lambda settings: root)
    data = {"id": "office-fruit", "version": 1, "images_per_class": 24, "classes": []}
    for index, (key, label, mid) in enumerate(office.CLASSES):
        rows = []
        for number in range(24):
            image_id = f"{index * 100 + number:016x}"
            pixels = np.random.default_rng(index * 100 + number).integers(0, 256, (96, 96, 3), dtype=np.uint8)
            buffer = io.BytesIO()
            Image.fromarray(pixels).save(buffer, "PNG")
            raw = buffer.getvalue()
            item = {"image_id": image_id, "bbox": [.05, .05, .95, .95],
                    "source_sha256": hashlib.sha256(raw).hexdigest(), "source_bytes": len(raw),
                    "Author": "Fixture author", "Title": key, "License": "https://creativecommons.org/licenses/by/2.0/",
                    "OriginalLandingURL": f"https://example.com/{image_id}"}
            monkeypatch.setattr(office.urllib.request, "urlopen", lambda *args, _raw=raw, **kwargs: io.BytesIO(_raw))
            office.prepare_one(root, key, item)
            rows.append(item)
        data["classes"].append({"id": key, "name": label, "open_images_label": mid, "images": rows})
    manifest_path.write_text(json.dumps(data), encoding="utf-8")
    (root / ".ready.json").write_text(json.dumps({"manifest_sha256": office.manifest_hash()}), encoding="utf-8")
    def offline(*args, **kwargs):
        raise AssertionError("Prepared cache must not access the network")
    monkeypatch.setattr(office.urllib.request, "urlopen", offline)
    return root


def wait_import(client, payload):
    response = client.post("/api/sample-datasets/office-fruit/import", json=payload)
    assert response.status_code == 202, response.text
    for _ in range(500):
        job = client.get(f"/api/sample-datasets/imports/{response.json()['id']}").json()
        if job["status"] in ("failed", "completed"):
            return job
        time.sleep(.01)
    pytest.fail("Import did not complete")


def test_all_twelve_classes_import_offline_with_provenance(client, office_cache):
    old = client.post("/api/projects", json={"name": "Keep existing data"}).json()
    before = client.get(f"/api/projects/{old['id']}/dataset").json()
    catalog = client.get("/api/sample-datasets").json()["datasets"]
    dataset = next(d for d in catalog if d["id"] == "office-fruit")
    assert dataset["cached"] and len(dataset["classes"]) == 12
    assert next(cls for cls in dataset["classes"] if cls["id"] == "phone")["name"] == "Điện thoại di động"
    keys = [c[0] for c in office.CLASSES]
    job = wait_import(client, {"class_ids": keys, "images_per_class": 20})
    assert job["status"] == "completed", job
    project_id = job["project_id"]
    result = client.get(f"/api/projects/{project_id}/dataset").json()
    assert len(result["classes"]) == 12
    assert all(len(c["images"]) == 20 for c in result["classes"])
    assert result["summary"]["total_images"] == 240
    assert result["summary"]["split"]["train"] == 192
    assert result["summary"]["split"]["val"] == 48
    assert result["sample_source"]["id"] == "office-fruit"
    assert client.get(f"/api/projects/{old['id']}/dataset").json() == before
    license_text = client.get(f"/api/projects/{project_id}/dataset-license").text
    assert "Fixture author" in license_text and "CC BY 4.0" in license_text
    images = [image for cls in result["classes"] for image in cls["images"]]
    assert len({image["original_name"].split("/")[-1] for image in images}) == 240
    exported = client.get(f"/api/classes/{result['classes'][0]['id']}/export")
    with zipfile.ZipFile(io.BytesIO(exported.content)) as archive:
        assert "IMAGE-PROVENANCE.json" in archive.namelist()
        assert "DATASET-LICENSE.txt" in archive.namelist()
    client.delete(f"/api/projects/{project_id}")
    client.delete(f"/api/projects/{old['id']}")


@pytest.mark.parametrize("payload", [
    {"class_ids": ["laptop", "laptop"], "images_per_class": 20},
    {"class_ids": ["mouse", "invalid"], "images_per_class": 20},
    {"class_ids": ["apple", "banana"], "images_per_class": 201},
])
def test_invalid_selection_creates_nothing(client, office_cache, payload):
    before = client.get("/api/projects").json()
    assert client.post("/api/sample-datasets/office-fruit/import", json=payload).status_code in (400, 422)
    assert client.get("/api/projects").json() == before


def test_respects_configured_project_limits(office_cache):
    with pytest.raises(AppError):
        office.validate_selection(["apple", "banana"], 20, replace(get_settings(), max_images_per_project=30))
    with pytest.raises(AppError):
        office.validate_selection([c[0] for c in office.CLASSES], 20, replace(get_settings(), max_classes=10))


def test_failure_rolls_back_new_project(client, office_cache, monkeypatch):
    from app.services import image_ingest
    before = client.get("/api/projects").json()
    folders = set(get_settings().projects_dir.iterdir())
    real_process = image_ingest.process_image
    calls = 0
    def disk_full(*args):
        nonlocal calls
        calls += 1
        if calls == 4:
            raise OSError("disk full")
        return real_process(*args)
    monkeypatch.setattr(image_ingest, "process_image", disk_full)
    job = wait_import(client, {"class_ids": ["laptop", "mouse"], "images_per_class": 20})
    assert job["status"] == "failed" and job["project_id"] is None
    assert client.get("/api/projects").json() == before
    assert set(get_settings().projects_dir.iterdir()) == folders


def test_corrupt_cache_is_not_silently_imported(client, office_cache):
    path = next((office_cache / "apple").glob("*.jpg"))
    path.write_bytes(b"broken image")
    before = client.get("/api/projects").json()
    job = wait_import(client, {"class_ids": ["apple", "banana"], "images_per_class": 20})
    assert job["status"] == "failed"
    assert client.get("/api/projects").json() == before


def test_source_checksum_and_path_traversal_rejected(tmp_path, monkeypatch):
    raw = make_image_bytes((90, 70, 150), 42, size=96)
    monkeypatch.setattr(office.urllib.request, "urlopen", lambda *args, **kwargs: io.BytesIO(raw))
    with pytest.raises(ValueError, match="checksum"):
        office.prepare_one(tmp_path, "apple", {"image_id": "a" * 16, "bbox": [0, 0, 1, 1], "source_sha256": "0" * 64})
    with pytest.raises(ValueError, match="identifier"):
        office.prepare_one(tmp_path, "apple", {"image_id": "../../escape", "bbox": [0, 0, 1, 1]})
    with pytest.raises(ValueError, match="bounding box"):
        office.crop_image(raw, [0, 0, float("nan"), 1])


def test_source_orientation_applies_after_cropping():
    pixels = np.random.default_rng(42).integers(0, 256, (80, 120, 3), dtype=np.uint8)
    raw = io.BytesIO()
    Image.fromarray(pixels).save(raw, "PNG")
    unrotated, _ = office.crop_image(raw.getvalue(), [0, 0, 1, 1])
    rotated, _ = office.crop_image(raw.getvalue(), [0, 0, 1, 1], 90)
    assert Image.open(io.BytesIO(unrotated)).size == (120, 80)
    assert Image.open(io.BytesIO(rotated)).size == (80, 120)


def test_parameter_estimate_accepts_twelve_classes_and_respects_system_limit(client):
    response = client.post("/api/training/estimate", json={"num_classes": 12, "config": {"mode": "beginner"}})
    assert response.status_code == 200, response.text
    assert response.json()["head_params"] > 0
    rejected = client.post("/api/training/estimate", json={"num_classes": get_settings().max_classes + 1})
    assert rejected.status_code == 400
