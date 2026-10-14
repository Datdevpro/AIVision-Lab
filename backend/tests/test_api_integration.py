"""Backend integration test: full workflow through the HTTP API on a tiny synthetic dataset.

Training runs in the real spawned worker process, using the lightweight ``tiny_test`` backbone
(enabled only by VISIONLAB_ALLOW_TEST_BACKBONE=1) so no pretrained weights are downloaded.
"""
import io
import json
import time

import pytest

from tests.conftest import make_image_bytes

RED, BLUE = (220, 40, 40), (40, 40, 220)


def _upload(client, pid, cid, color, n, start=0, subset="train", source="upload", session_id=None):
    files = [("files", (f"img{start + i}.png", make_image_bytes(color, seed=start + i), "image/png")) for i in range(n)]
    data = {"class_id": cid, "subset": subset, "source": source}
    if session_id:
        data["session_id"] = session_id
    r = client.post(f"/api/projects/{pid}/images", files=files, data=data)
    assert r.status_code == 201, r.text
    return r.json()


def _wait(client, job_id, timeout=180):
    t0 = time.time()
    while time.time() - t0 < timeout:
        job = client.get(f"/api/training/{job_id}").json()
        if job["status"] in ("completed", "failed", "cancelled"):
            return job
        time.sleep(0.5)
    raise AssertionError("training timed out")


@pytest.fixture(scope="module")
def project(client):
    r = client.post("/api/projects", json={"name": "Test"})
    assert r.status_code == 201
    p = r.json()
    classes = client.get(f"/api/projects/{p['id']}/dataset").json()["classes"]
    assert len(classes) == 2
    c1 = client.patch(f"/api/classes/{classes[0]['id']}", json={"name": "Bút"}).json()
    c2 = client.patch(f"/api/classes/{classes[1]['id']}", json={"name": "Điện thoại"}).json()
    _upload(client, p["id"], c1["id"], RED, 16, 0)
    _upload(client, p["id"], c2["id"], BLUE, 16, 100)
    return {"id": p["id"], "c1": c1["id"], "c2": c2["id"]}


def test_health_and_capabilities(client):
    assert client.get("/api/health").json()["status"] == "ok"
    caps = client.get("/api/system/capabilities").json()
    assert caps["device"]["type"] == "cpu" and "limits" in caps and len(caps["modes"]) == 3
    params = client.get("/api/system/parameters").json()["parameters"]
    assert all(p["name_vi"] and p["description"] and p["tooltip"] for p in params)


def test_structured_errors(client):
    r = client.get("/api/projects/does-not-exist")
    assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"
    r = client.post("/api/training/start", json={"project_id": "x", "config": {"epochs": 9999}})
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert client.get("/api/training/not-a-valid-id").status_code == 404


def test_class_management_rules(client, project):
    assert client.post(f"/api/projects/{project['id']}/classes", json={"name": "bút"}).status_code == 409  # duplicate (case-insens.)
    r = client.post(f"/api/projects/{project['id']}/classes", json={"name": "Tạm"})
    assert r.status_code == 201
    assert client.delete(f"/api/classes/{r.json()['id']}").status_code == 204


def test_upload_rejects_bad_files_and_duplicates(client, project):
    good = make_image_bytes((10, 200, 10), seed=999)
    files = [
        ("files", ("ok.png", good, "image/png")),
        ("files", ("dup.png", good, "image/png")),  # exact duplicate of previous
        ("files", ("fake.png", b"this is not an image", "image/png")),
        ("files", ("tiny.png", make_image_bytes((1, 1, 1), 1, size=8), "image/png")),
        ("files", ("gif.gif", _gif_bytes(), "image/gif")),
    ]
    r = client.post(f"/api/projects/{project['id']}/images", files=files, data={"class_id": project["c1"]})
    body = r.json()
    codes = {x["filename"]: x.get("code") for x in body["results"]}
    assert codes["ok.png"] is None and codes["dup.png"] == "DUPLICATE_IMAGE"
    assert codes["fake.png"] == "CORRUPTED_IMAGE" and codes["tiny.png"] == "IMAGE_TOO_SMALL"
    assert codes["gif.gif"] == "UNSUPPORTED_FORMAT"
    assert body["accepted"] == 1 and body["rejected"] == 4
    accepted_id = next(x["image"]["id"] for x in body["results"] if x["status"] == "accepted")
    assert client.get(f"/api/images/{accepted_id}/file?thumb=true").headers["content-type"] == "image/jpeg"
    assert client.delete(f"/api/images/{accepted_id}").status_code == 204
    assert client.get(f"/api/images/{accepted_id}/file").status_code == 404


def _gif_bytes():
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (5, 5, 5)).save(buf, format="GIF")
    return buf.getvalue()


def test_dataset_summary_has_split_and_fingerprint(client, project):
    ds = client.get(f"/api/projects/{project['id']}/dataset?val_split=0.25").json()
    s = ds["summary"]
    assert s["split"]["train"] + s["split"]["val"] == 32 and s["split"]["val"] == 8
    assert len(s["dataset_fingerprint"]) == 16 and s["num_classes"] == 2


def test_training_rejects_invalid_dataset(client):
    p = client.post("/api/projects", json={"name": "Empty"}).json()
    r = client.post("/api/training/start", json={"project_id": p["id"], "config": {"test_backbone": True}})
    assert r.status_code == 400 and r.json()["error"]["code"] == "DATASET_INVALID"
    client.delete(f"/api/projects/{p['id']}")


def test_full_workflow_train_stream_predict_export_compare(client, project):
    cfg = {"mode": "intermediate", "epochs": 4, "learning_rate": 0.01, "batch_size": 8, "test_backbone": True,
           "augmentation": False, "seed": 7}
    r = client.post("/api/training/start", json={"project_id": project["id"], "config": cfg, "experiment_name": "Lần 1"})
    assert r.status_code == 200, r.text
    job = r.json()
    assert job["status"] in ("preparing", "training")

    # only one active job is allowed
    r2 = client.post("/api/training/start", json={"project_id": project["id"], "config": cfg})
    assert r2.status_code == 409 and r2.json()["error"]["code"] == "TRAINING_ALREADY_RUNNING"
    assert client.get("/api/training/active").json()["job"]["id"] == job["id"]

    # live WebSocket stream: must contain real epoch events then a final job event
    types, epochs = [], []
    with client.websocket_connect(f"/ws/training/{job['id']}") as ws:
        first = ws.receive_json()
        assert first["type"] == "snapshot"
        while True:
            msg = ws.receive_json()
            types.append(msg["type"])
            if msg["type"] == "epoch":
                epochs.append(msg["metrics"])
            if msg["type"] == "job":
                final = msg["job"]
                break
    assert final["status"] == "completed", final
    assert "epoch" in types
    snap_epochs = final["epochs"]
    assert [e["epoch"] for e in snap_epochs] == [1, 2, 3, 4]
    for e in snap_epochs:
        assert 0 <= e["val_accuracy"] <= 1 and e["train_loss"] > 0 and e["val_loss"] > 0
        assert e["learning_rate"] == 0.01 and e["elapsed_s"] >= 0

    job = _wait(client, job["id"])
    exp_id = job["experiment_id"]
    assert exp_id

    # experiment record
    exp = client.get(f"/api/experiments/{exp_id}").json()
    assert exp["name"] == "Lần 1" and exp["class_names"] == ["Bút", "Điện thoại"]
    assert exp["config"]["learning_rate"] == 0.01 and exp["config"]["seed"] == 7
    assert exp["best_checkpoint"]["epoch"] in (1, 2, 3, 4) and exp["dataset_fingerprint"] and exp["split_fingerprint"]
    ev = exp["evaluation"]["validation"]
    assert ev["num_samples"] == 6 and len(ev["confusion_matrix"]) == 2 and ev["warnings"]  # small-set warning present
    assert exp["evaluation"]["test"] is None
    assert client.get(f"/api/experiments/{exp_id}/metrics").json()["best_epoch"] == exp["best_checkpoint"]["epoch"]
    assert client.get(f"/api/experiments/{exp_id}/insights").json()["insights"]
    assert client.get(f"/api/experiments?project_id={project['id']}").json()[0]["id"] == exp_id

    # inference with the trained model (labels map consistently to output indices)
    pred = client.post("/api/inference/predict", data={"experiment_id": exp_id},
                       files={"image": ("q.png", make_image_bytes(RED, 5000), "image/png")})
    assert pred.status_code == 200, pred.text
    p = pred.json()
    assert p["predicted_label"] == "Bút" and abs(sum(x["probability"] for x in p["probabilities"]) - 1) < 1e-4
    assert p["latency_ms"] > 0
    bad = client.post("/api/inference/predict", data={"experiment_id": exp_id}, files={"image": ("x.png", b"nope", "image/png")})
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "CORRUPTED_IMAGE"
    fb = client.post("/api/inference/feedback", json={"experiment_id": exp_id, "predicted_label": "Bút", "correct": True}).json()
    assert fb["total"] == 1 and fb["accuracy"] == 1.0

    # exports
    ck = client.get(f"/api/models/{exp_id}/export?format=checkpoint")
    assert ck.status_code == 200 and len(ck.content) > 1000
    meta = client.get(f"/api/models/{exp_id}/export?format=metadata").json()
    assert meta["class_names"] == ["Bút", "Điện thoại"] and meta["preprocessing"]["normalize_mean"]
    assert client.get(f"/api/models/{exp_id}/export?format=labels").json()["index_to_label"] == {"0": "Bút", "1": "Điện thoại"}
    csv_text = client.get(f"/api/models/{exp_id}/export?format=metrics_csv").text
    assert csv_text.splitlines()[0].startswith("epoch,") and len(csv_text.splitlines()) == 5
    assert "best_val_accuracy" in client.get("/api/experiments/summary.csv").text

    # second run with a changed parameter -> compare
    cfg2 = {**cfg, "learning_rate": 0.001, "seed": 8}
    j2 = client.post("/api/training/start", json={"project_id": project["id"], "config": cfg2, "experiment_name": "Lần 2"}).json()
    j2 = _wait(client, j2["id"])
    assert j2["status"] == "completed"
    cmp_ = client.get(f"/api/experiments/compare?a={exp_id}&b={j2['experiment_id']}").json()
    assert {d["key"] for d in cmp_["config_diff"]} >= {"learning_rate", "seed"}
    assert cmp_["best_by_validation"] in ("a", "b", "tie") and "training accuracy" in cmp_["best_basis"].lower()
    assert cmp_["same_dataset"] is True and cmp_["same_split"] is False and cmp_["fair"] is False
    assert any("không so sánh công bằng" in w for w in cmp_["warnings"])  # different partitions => fairness warning

    assert client.patch(f"/api/experiments/{exp_id}", json={"name": "Đổi tên"}).json()["name"] == "Đổi tên"


def test_cancellation_between_batches(client, project):
    cfg = {"mode": "intermediate", "epochs": 50, "batch_size": 2, "test_backbone": True, "augmentation": True}
    job = client.post("/api/training/start", json={"project_id": project["id"], "config": cfg}).json()
    # wait until real training began, then cancel
    t0 = time.time()
    while time.time() - t0 < 120:
        cur = client.get(f"/api/training/{job['id']}").json()
        if cur["epochs"]:
            break
        time.sleep(0.3)
    assert client.post(f"/api/training/{job['id']}/cancel").status_code == 200
    final = _wait(client, job["id"], 60)
    assert final["status"] == "cancelled" and final["experiment_id"] is None
    assert client.post(f"/api/training/{job['id']}/cancel").status_code == 409
    n_before = len(client.get(f"/api/experiments?project_id={project['id']}").json())
    assert n_before == 2  # the cancelled run created no experiment


def test_dataset_deletion(client, project):
    assert client.delete(f"/api/projects/{project['id']}/images").json()["deleted"] == 32
    ds = client.get(f"/api/projects/{project['id']}/dataset").json()
    assert all(not c["images"] for c in ds["classes"])
    assert client.delete(f"/api/projects/{project['id']}").status_code == 204
    assert client.get(f"/api/projects/{project['id']}").status_code == 404
