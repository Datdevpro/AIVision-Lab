"""Rebuild the curated Office & Fruit manifest from official Open Images tables.

Run with backend/.venv/Scripts/python.exe backend/scripts/build_office_fruit.py.
Large upstream tables stay in .cache/dataset-build; only the curated manifest is source.
"""
from __future__ import annotations

import concurrent.futures
import argparse
import csv
import hashlib
import json
import re
from pathlib import Path
import sys
import urllib.request

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.services.office_fruit import CLASSES, MANIFEST_PATH

CACHE = BACKEND.parent / ".cache" / "dataset-build"
TABLES = {
    "boxes.csv": ("https://storage.googleapis.com/openimages/v6/oidv6-train-annotations-bbox.csv", "3c3e70cfaba5757ea5c2604b19cac3b2"),
    "metadata.csv": ("https://storage.googleapis.com/openimages/2018_04/train/train-images-boxable-with-rotation.csv", "a4ac0bcedb5c2df4d1b1230dc6b41b8f"),
}
PREVIEW_PREFIXES = {
    "laptop": "05224738c89f", "mouse": "2977c4dfa069", "keyboard": "1855397ae932",
    "desk": "57f1ca280020", "monitor": "a3939a09aea1", "watch": "a7fabb3bd493",
    "banana": "0c59a8e4469e", "apple": "533563a9ff6c", "watermelon": "5ee1459e77fb",
    "orange": "3c22df7047a1", "pear": "51a4941f3028",
    "phone": "d3e4d1bb0057f",
}


def title_allowed(key: str, title: str) -> bool:
    if key != "phone":
        return True
    # Some upstream phone boxes actually refer to tablets, media players or props.
    return re.search(r"(?<![a-z0-9])(?:ipads?|ipods?|tablets?|kindles?|power\s*bank|nexus\s*7|galaxy\s*tab|fonepad|amigurumi|mock\s*up|credit\s*card|card\s*swipe|scanner|pda|pocket\s*pc)(?![a-z0-9])", title, re.IGNORECASE) is None


def download(name):
    url, expected = TABLES[name]
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if path.exists():
        with path.open("rb") as source:
            if hashlib.file_digest(source, "md5").hexdigest() == expected:
                return path
    part = path.with_suffix(".part")
    print(f"Downloading official {name}...", flush=True)
    digest = hashlib.md5()
    with urllib.request.urlopen(url, timeout=90) as response, part.open("wb") as output:
        while block := response.read(1024 * 1024):
            digest.update(block)
            output.write(block)
    if digest.hexdigest() != expected:
        raise RuntimeError(f"Official table checksum mismatch: {name}")
    part.replace(path)
    print(f"Verified {name}", flush=True)
    return path


def candidates(extend: list[str] | None = None):
    # An extension preserves previously curated photographs and their ordering.
    # New labels are sampled independently from the official annotations.
    existing = json.loads(MANIFEST_PATH.read_text(encoding="utf-8")) if MANIFEST_PATH.exists() else None
    # The 2020+ smartphone class has a separate, visually reviewed Commons source.
    # Rebuilding the older Open Images tables must not silently restore legacy phones.
    preserved = {cls["id"]: cls for cls in existing["classes"]
                 if extend or (cls["id"] == "phone" and existing.get("phone_policy"))} if existing else {}
    requested = set(extend or [key for key, _, _ in CLASSES])
    if not requested <= {key for key, _, _ in CLASSES}:
        raise ValueError("Unknown Office & Fruit class")
    requested -= preserved.keys()
    if not requested:
        print("Requested classes already exist; curated photographs were preserved.", flush=True)
        return
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(download, TABLES))
    by_mid = {mid: key for key, _, mid in CLASSES if key in requested}
    exclusions = json.loads((MANIFEST_PATH.parent / "office-fruit-exclusions.json").read_text(encoding="utf-8"))
    boxes = {key: {} for key in by_mid.values()}
    used_ids = {item["image_id"] for cls in preserved.values() for item in cls["images"]}
    with (CACHE / "boxes.csv").open(newline="", encoding="utf-8") as source:
        for row in csv.DictReader(source):
            key = by_mid.get(row["LabelName"])
            if not key or row["Confidence"] != "1":
                continue
            # This is single-label classification: a bunch/basket of the same fruit
            # is valid. Partial occlusion is useful real-world variation as well.
            if any(row[name] != "0" for name in ("IsDepiction", "IsInside")):
                continue
            bbox = [float(row[name]) for name in ("XMin", "YMin", "XMax", "YMax")]
            width, height = bbox[2] - bbox[0], bbox[3] - bbox[1]
            area = width * height
            if min(width, height) < .04 or area < .01:
                continue
            image_id = row["ImageID"]
            if image_id in exclusions or image_id in used_ids:
                continue
            previous = boxes[key].get(image_id)
            if previous is None or area > previous[0]:
                boxes[key][image_id] = (area, bbox)
    # Stable random sampling, not the first consecutive IDs from an annotation file.
    selected = {}
    for key, rows in boxes.items():
        ids = sorted(rows, key=lambda image_id: hashlib.sha256(f"visionlab-v1:{key}:{image_id}".encode()).hexdigest())[:900]
        selected[key] = [{"image_id": image_id, "bbox": rows[image_id][1]} for image_id in ids]
        print(f"{key}: {len(rows)} eligible photos, {len(ids)} candidates", flush=True)
    wanted = {item["image_id"] for rows in selected.values() for item in rows}
    metadata = {}
    with (CACHE / "metadata.csv").open(newline="", encoding="utf-8") as source:
        for row in csv.DictReader(source):
            if row["ImageID"] in wanted:
                metadata[row["ImageID"]] = {name: row[name] for name in ("OriginalLandingURL", "License", "Author", "AuthorProfileURL", "Title", "Rotation")}
    for key in selected:
        licensed = []
        for item in selected[key]:
            info = metadata.get(item["image_id"])
            if not info or "creativecommons.org/licenses/by/2.0" not in info["License"]:
                continue
            if key == "watch" and "pocket" in info["Title"].lower():
                continue
            if not title_allowed(key, info["Title"]):
                continue
            item.update(info)
            licensed.append(item)
        selected[key] = licensed
    manifest = {"id": "office-fruit", "version": 1, "images_per_class": 200,
                "source_url": "https://storage.googleapis.com/openimages/web/download_v7.html",
                "annotation_url": TABLES["boxes.csv"][0], "metadata_url": TABLES["metadata.csv"][0],
                "classes": [preserved[key] if key in preserved else
                            {"id": key, "name": label, "open_images_label": mid, "images": selected[key]}
                            for key, label, mid in CLASSES]}
    if existing and existing.get("phone_policy"):
        manifest["phone_policy"] = existing["phone_policy"]
        manifest["additional_sources"] = existing.get("additional_sources", [])
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    snapshot = "candidates-" + "-".join(sorted(requested)) + ".json" if extend else "candidates.json"
    (CACHE / snapshot).write_bytes(MANIFEST_PATH.read_bytes())
    print(f"Candidate manifest: {MANIFEST_PATH}", flush=True)


def curate():
    from app.core.config import get_settings
    from app.services import office_fruit as office
    settings = get_settings()
    data = office.manifest()
    root = office.cache_dir(settings)
    used_ids, exact_hashes = set(), set()
    report = {}
    exclusions = json.loads((MANIFEST_PATH.parent / "office-fruit-exclusions.json").read_text(encoding="utf-8"))
    for cls in data["classes"]:
        cls["images"] = [item for item in cls["images"] if item["image_id"] not in exclusions
                         and title_allowed(cls["id"], item.get("Title", ""))]
        accepted, near_hashes, rejected = [], [], []
        def prepare(item):
            try:
                if item["image_id"] in used_ids:
                    return item, None, "original photo already used"
                _, info = office.prepare_one(root, cls["id"], item)
                return item, info, None
            except Exception as exc:
                return item, None, str(exc)
        workers = 2 if any(item.get("provider") == "wikimedia-commons" for item in cls["images"]) else 8
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            # Small batches avoid downloading hundreds of unnecessary candidates.
            for offset in range(0, len(cls["images"]), 24):
                for item, info, error in pool.map(prepare, cls["images"][offset:offset + 24]):
                    if len(accepted) == data["images_per_class"]:
                        break
                    if error:
                        rejected.append({"image_id": item["image_id"], "reason": error})
                        continue
                    dhash = int(info["dhash"], 16)
                    if info["source_sha256"] in exact_hashes or any((dhash ^ previous).bit_count() <= 3 for previous in near_hashes):
                        rejected.append({"image_id": item["image_id"], "reason": "duplicate or near duplicate"})
                        continue
                    item.update({name: info[name] for name in ("source_sha256", "source_bytes")})
                    accepted.append(item)
                    near_hashes.append(dhash)
                    used_ids.add(item["image_id"])
                    exact_hashes.add(info["source_sha256"])
                print(f"{cls['id']}: {len(accepted)}/{data['images_per_class']}", flush=True)
                if len(accepted) == data["images_per_class"]:
                    break
        if len(accepted) != data["images_per_class"]:
            raise RuntimeError(f"Not enough clean independent images for {cls['id']}: {len(accepted)}")
        cls["images"] = accepted
        report[cls["id"]] = {"accepted": len(accepted), "rejected": rejected}
    MANIFEST_PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (CACHE / "curation-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    for cls in data["classes"]:
        folder = root / cls["id"]
        if folder.resolve().parent != root.resolve():
            raise RuntimeError("Curated cache folder points outside the managed cache")
        selected_ids = {item["image_id"] for item in cls["images"]}
        for path in folder.glob("*.jpg"):
            if path.stem not in selected_ids:
                if path.resolve().parent != folder.resolve():
                    raise RuntimeError("Curated cache file points outside its class folder")
                path.unlink()
                path.with_suffix(".json").unlink(missing_ok=True)
    office.ensure_cache(settings, lambda **fields: None)
    previews = BACKEND.parent / "frontend" / "public" / "datasets" / "office-fruit"
    previews.mkdir(parents=True, exist_ok=True)
    preview_classes = []
    for cls in data["classes"]:
        item = next((item for item in cls["images"] if item["image_id"].startswith(PREVIEW_PREFIXES[cls["id"]])), cls["images"][0])
        (previews / f"{cls['id']}.jpg").write_bytes((root / cls["id"] / f"{item['image_id']}.jpg").read_bytes())
        preview_classes.append({**cls, "images": [item]})
    (previews / "LICENSE.txt").write_text(office.attribution_text(preview_classes), encoding="utf-8")
    # Portable offline bundle contains the already processed images and attribution.
    import zipfile
    import io
    import random
    archive = root / "office-fruit-v1.zip"
    split_csv = io.StringIO()
    writer = csv.writer(split_csv)
    writer.writerow(("image", "class_id", "class_name", "split", "source_image_id"))
    for cls in data["classes"]:
        images = sorted(cls["images"], key=lambda item: item["image_id"])
        random.Random(f"42:{cls['id']}").shuffle(images)
        val_count = round(len(images) * .2)
        for position, item in enumerate(images):
            writer.writerow((f"{cls['id']}/{item['image_id']}.jpg", cls["id"], cls["name"],
                             "val" if position < val_count else "train", item["image_id"]))
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as output:
        output.writestr("manifest.json", MANIFEST_PATH.read_bytes())
        output.writestr("DATASET-LICENSE.txt", office.attribution_text(data["classes"]))
        output.writestr("SPLITS.csv", split_csv.getvalue().encode("utf-8-sig"))
        output.writestr("README.txt", f"Office & Fruit: {len(data['classes'])} classes, {data['images_per_class']} photographs per class.\nSPLITS.csv: stratified 80/20 train/validation, seed 42; matches the application's default split.\nExtract all files into backend/data/sample_datasets/office-fruit on a matching source version to use offline.\nSee DATASET-LICENSE.txt for authors, original URLs, licenses and modifications.\n")
        output.write(root / ".ready.json", ".ready.json")
        for cls in data["classes"]:
            for item in cls["images"]:
                for suffix in (".jpg", ".json"):
                    output.write(root / cls["id"] / f"{item['image_id']}{suffix}", f"{cls['id']}/{item['image_id']}{suffix}")
    print(f"Ready: {len(used_ids)} images, {len(data['classes'])} classes. Offline archive: {archive}", flush=True)


def audit():
    import random
    from PIL import Image, ImageDraw, ImageOps
    from app.core.config import get_settings
    from app.services import office_fruit as office
    root = office.cache_dir(get_settings())
    CACHE.mkdir(parents=True, exist_ok=True)
    for cls in office.manifest()["classes"]:
        chosen = random.Random(42).sample(cls["images"], min(48, len(cls["images"])))
        sheet = Image.new("RGB", (960, 6 * 142 + 30), "white")
        draw = ImageDraw.Draw(sheet)
        draw.text((8, 8), cls["id"], fill="black")
        for position, item in enumerate(chosen):
            with Image.open(root / cls["id"] / f"{item['image_id']}.jpg") as image:
                thumb = ImageOps.contain(image, (116, 116))
                x, y = (position % 8) * 120, 30 + (position // 8) * 142
                sheet.paste(thumb, (x + (120 - thumb.width) // 2, y))
                draw.text((x + 2, y + 118), item["image_id"][:12], fill="black")
        path = CACHE / f"audit-{cls['id']}.jpg"
        sheet.save(path, quality=90)
        print(path, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--curate", action="store_true", help="Download, clean, deduplicate and finalize the candidate manifest")
    parser.add_argument("--audit", action="store_true", help="Generate contact sheets for visual review")
    parser.add_argument("--extend", nargs="+", choices=[key for key, _, _ in CLASSES], help="Prepare candidate classes without replacing already curated classes")
    args = parser.parse_args()
    audit() if args.audit else curate() if args.curate else candidates(args.extend)
