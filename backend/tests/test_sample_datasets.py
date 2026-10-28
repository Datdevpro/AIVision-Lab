"""Sample imports: offline cache, validation, isolation and failure atomicity."""
import hashlib
import io
import json
import tarfile
import time
import zipfile

import pytest

from app.core.config import get_settings
from app.core.errors import AppError
from app.services import sample_datasets as samples
from tests.conftest import make_image_bytes


@pytest.fixture
def flower_cache(client, tmp_path, monkeypatch):
    classes = tuple((key, name, 24) for key, name, _ in samples.FLOWER_CLASSES)
    monkeypatch.setattr(samples, "FLOWER_CLASSES", classes)
    monkeypatch.setattr(samples, "cache_dir", lambda settings: tmp_path)
    root = tmp_path / "flower_photos"
    root.mkdir()
    (root / ".ready.json").write_text(json.dumps({"sha256": samples.FLOWERS_SHA256}), encoding="utf-8")
    (root / "LICENSE.txt").write_text("CC BY 2.0 · test attribution", encoding="utf-8")
    for index, (key, _, _) in enumerate(classes):
        (root / key).mkdir()
        for n in range(24):
            (root / key / f"{n:03}.jpg").write_bytes(make_image_bytes((70, 100, 150), index * 100 + n))
    # Cached imports must never attempt to access the network.
    def no_network(*args, **kwargs):
        raise AssertionError("An offline import tried to download data")
    monkeypatch.setattr(samples.urllib.request, "urlopen", no_network)
    return root


def wait_import(client, payload):
    result = client.post("/api/sample-datasets/flowers/import", json=payload)
    assert result.status_code == 202, result.text
    for _ in range(400):
        job = client.get(f"/api/sample-datasets/imports/{result.json()['id']}").json()
        if job["status"] in ("completed", "failed"):
            return job
        time.sleep(0.01)
    raise AssertionError("Sample import did not finish")


def test_offline_import_creates_selected_classes_and_preserves_existing_project(client, flower_cache):
    previous = client.post("/api/projects", json={"name": "Existing project"}).json()
    original = client.get(f"/api/projects/{previous['id']}/dataset").json()
    assert client.get("/api/sample-datasets").json()["datasets"][0]["cached"] is True
    payload = {"class_ids": ["roses", "daisy"], "images_per_class": 20, "seed": 7}
    job = wait_import(client, payload)
    assert job["status"] == "completed", job
    pid = job["project_id"]
    assert pid != previous["id"]
    data = client.get(f"/api/projects/{pid}/dataset").json()
    assert [c["name"] for c in data["classes"]] == ["Hoa cúc", "Hoa hồng"]
    assert all(len(c["images"]) == 20 for c in data["classes"])
    assert data["summary"]["total_images"] == 40
    assert data["summary"]["split"]["train"] == 32
    assert data["summary"]["split"]["val"] == 8
    assert data["sample_source"]["seed"] == 7
    image = data["classes"][0]["images"][0]
    assert image["source"] == "sample"
    assert client.get(f"/api/images/{image['id']}/file?thumb=true").status_code == 200
    assert client.get(f"/api/projects/{previous['id']}/dataset").json() == original
    assert (get_settings().projects_dir / pid / "DATASET-LICENSE.txt").is_file()
    assert "test attribution" in client.get(f"/api/projects/{pid}/dataset-license").text
    exported = client.get(f"/api/classes/{data['classes'][0]['id']}/export")
    with zipfile.ZipFile(io.BytesIO(exported.content)) as archive:
        assert "DATASET-LICENSE.txt" in archive.namelist()
        assert image["original_name"] in archive.read("IMAGE-SOURCES.csv").decode("utf-8-sig")

    # A second project uses the same selection and images, without downloading again.
    again = wait_import(client, payload)
    assert again["status"] == "completed"
    other = client.get(f"/api/projects/{again['project_id']}/dataset").json()
    assert [[i["original_name"] for i in c["images"]] for c in data["classes"]] == [
        [i["original_name"] for i in c["images"]] for c in other["classes"]]
    client.delete(f"/api/projects/{pid}")
    client.delete(f"/api/projects/{again['project_id']}")
    client.delete(f"/api/projects/{previous['id']}")


@pytest.mark.parametrize("payload", [
    {"class_ids": ["daisy"]},
    {"class_ids": ["daisy", "daisy"]},
    {"class_ids": ["daisy", "unknown"]},
    {"class_ids": ["daisy", "roses"], "images_per_class": 0},
    {"class_ids": [c[0] for c in samples.FLOWER_CLASSES], "images_per_class": 500},
])
def test_invalid_selection_does_not_create_project(client, payload):
    before = client.get("/api/projects").json()
    assert client.post("/api/sample-datasets/flowers/import", json=payload).status_code in (400, 422)
    assert client.get("/api/projects").json() == before


def test_import_failure_removes_project_records_and_staged_images(client, flower_cache, monkeypatch):
    before = client.get("/api/projects").json()
    project_folders = set(get_settings().projects_dir.iterdir())
    process = samples.process_image
    calls = 0
    def fail_after_a_few_images(*args):
        nonlocal calls
        calls += 1
        if calls == 6:
            raise OSError("Simulated disk full")
        return process(*args)
    monkeypatch.setattr(samples, "process_image", fail_after_a_few_images)
    result = wait_import(client, {"class_ids": ["daisy", "roses"], "images_per_class": 20})
    assert result["status"] == "failed"
    assert result["project_id"] is None
    assert client.get("/api/projects").json() == before
    assert set(get_settings().projects_dir.iterdir()) == project_folders


def test_cache_extracts_verified_archive_without_network_or_unsafe_paths(client, tmp_path, monkeypatch):
    monkeypatch.setattr(samples, "cache_dir", lambda settings: tmp_path)
    monkeypatch.setattr(samples, "FLOWER_CLASSES", (("daisy", "Hoa cúc", 1), ("roses", "Hoa hồng", 1)))
    archive = tmp_path / "flower_photos.tgz"
    with tarfile.open(archive, "w:gz") as tar:
        for name, contents in [
            ("flower_photos/daisy/one.jpg", b"daisy"), ("flower_photos/roses/one.jpg", b"rose"),
            ("flower_photos/LICENSE.txt", b"CC BY"), ("../escape.jpg", b"bad"),
            ("flower_photos/daisy/..\\..\\escape.jpg", b"bad"),
        ]:
            item = tarfile.TarInfo(name)
            item.size = len(contents)
            tar.addfile(item, io.BytesIO(contents))
        link = tarfile.TarInfo("flower_photos/daisy/link.jpg")
        link.type = tarfile.SYMTYPE
        link.linkname = str(tmp_path / "outside.jpg")
        tar.addfile(link)
    monkeypatch.setattr(samples, "FLOWERS_BYTES", archive.stat().st_size)
    monkeypatch.setattr(samples, "FLOWERS_SHA256", hashlib.sha256(archive.read_bytes()).hexdigest())
    monkeypatch.setattr(samples.urllib.request, "urlopen", lambda *a, **kw: pytest.fail("Unexpected download"))
    root = samples.ensure_flowers(get_settings(), lambda **fields: None)
    assert samples.cached_flowers(get_settings()) == root
    assert (root / "LICENSE.txt").read_bytes() == b"CC BY"
    assert list((root / "daisy").iterdir()) == [root / "daisy" / "one.jpg"]
    assert not (tmp_path / "escape.jpg").exists()
    assert not (tmp_path / "outside.jpg").exists()


def test_download_checksum_failure_does_not_publish_cache(client, tmp_path, monkeypatch):
    monkeypatch.setattr(samples, "cache_dir", lambda settings: tmp_path)
    monkeypatch.setattr(samples.urllib.request, "urlopen", lambda *a, **kw: io.BytesIO(b"invalid archive"))
    with pytest.raises(AppError, match="checksum"):
        samples.ensure_flowers(get_settings(), lambda **fields: None)
    assert samples.cached_flowers(get_settings()) is None
    assert not list(tmp_path.glob("*.part"))
