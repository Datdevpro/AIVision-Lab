"""Verify the prepared dataset, portable package and fully offline restoration."""
from __future__ import annotations

import csv
from dataclasses import replace
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import urllib.request
import zipfile

from PIL import Image

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.core.config import get_settings
from app.services import office_fruit as office
from app.services.dataset_logic import Item, compute_split
from app.services.image_ingest import process_image


def main():
    settings = get_settings()
    data = office.manifest()
    root = office.cache_dir(settings)
    assert [cls["id"] for cls in data["classes"]] == [key for key, _, _ in office.CLASSES]
    per_class = data["images_per_class"]
    total = len(data["classes"]) * per_class
    expected_val = len(data["classes"]) * round(per_class * .2)
    seen_photos, seen_pixels = set(), set()
    excluded = json.loads((office.MANIFEST_PATH.parent / "office-fruit-exclusions.json").read_text(encoding="utf-8"))
    files, original_bytes = 0, 0
    sizes = []
    for cls in data["classes"]:
        assert len(cls["images"]) == per_class
        assert len(list((root / cls["id"]).glob("*.jpg"))) == per_class
        for item in cls["images"]:
            assert item["image_id"] not in seen_photos
            assert item["image_id"] not in excluded
            seen_photos.add(item["image_id"])
            path = root / cls["id"] / f"{item['image_id']}.jpg"
            raw = path.read_bytes()
            info = json.loads(path.with_suffix(".json").read_text())
            assert hashlib.sha256(raw).hexdigest() == info["crop_sha256"]
            assert item["source_sha256"] == info["source_sha256"]
            image = process_image(raw, settings)
            assert image.sha256 not in seen_pixels
            seen_pixels.add(image.sha256)
            with Image.open(io.BytesIO(raw)) as photo:
                assert photo.mode == "RGB" and min(photo.size) >= 64 and max(photo.size) <= 512
                sizes.append(photo.size)
            files += 1
            original_bytes += item["source_bytes"]
    archive_path = root / "office-fruit-v1.zip"
    with zipfile.ZipFile(archive_path) as archive:
        assert archive.testzip() is None
        assert archive.read("manifest.json") == office.MANIFEST_PATH.read_bytes()
        rows = list(csv.DictReader(io.StringIO(archive.read("SPLITS.csv").decode("utf-8-sig"))))
        assert len(rows) == total
        assert sum(r["split"] == "train" for r in rows) == total - expected_val
        assert sum(r["split"] == "val" for r in rows) == expected_val
        items = [Item(id=row["image"], class_id=row["class_id"], subset="train",
                      session_id=f"openimages:{row['class_id']}:{row['source_image_id']}") for row in rows]
        split = compute_split(items, "random", .2, 42)
        assert all(split[row["image"]] == row["split"] for row in rows)
        work = BACKEND.parent / ".cache" / "dataset-build"
        work.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=work, prefix="offline-verify-") as temporary:
            offline_settings = replace(settings, data_dir=Path(temporary))
            destination = office.cache_dir(offline_settings)
            for entry in archive.infolist():
                path = (destination / entry.filename).resolve()
                assert path.is_relative_to(destination.resolve())
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(archive.read(entry))
            original_urlopen = urllib.request.urlopen
            def no_network(*args, **kwargs):
                raise AssertionError("Offline restoration attempted a network download")
            urllib.request.urlopen = no_network
            try:
                office.ensure_cache(offline_settings, lambda **fields: None)
                assert office.cached(offline_settings)
            finally:
                urllib.request.urlopen = original_urlopen
    report = {"classes": {c["id"]: len(c["images"]) for c in data["classes"]},
              "images": files, "unique_source_photos": len(seen_photos), "unique_normalized_images": len(seen_pixels),
              "default_train": total - expected_val, "default_validation": expected_val,
              "source_download_bytes": original_bytes, "offline_zip_bytes": archive_path.stat().st_size,
              "min_image_side": min(min(size) for size in sizes), "max_image_side": max(max(size) for size in sizes),
              "manifest_sha256": office.manifest_hash(), "offline_restore": "passed"}
    (BACKEND.parent / ".cache/dataset-build/verification.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
