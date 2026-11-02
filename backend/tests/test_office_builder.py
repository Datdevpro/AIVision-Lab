"""Incremental dataset extensions preserve curated classes and avoid false phone labels."""
import csv
import json

from scripts import build_office_fruit as builder


def test_extend_phone_preserves_curated_classes_and_filters_other_devices(tmp_path, monkeypatch):
    manifest = tmp_path / "manifest.json"
    monkeypatch.setattr(builder, "MANIFEST_PATH", manifest)
    monkeypatch.setattr(builder, "CACHE", tmp_path)
    old_classes = [{"id": key, "name": name, "open_images_label": mid,
                    "images": [{"image_id": f"{index:016x}", "bbox": [0, 0, 1, 1]}]}
                   for index, (key, name, mid) in enumerate(builder.CLASSES) if key != "phone"]
    manifest.write_text(json.dumps({"classes": old_classes}), encoding="utf-8")
    (tmp_path / "office-fruit-exclusions.json").write_text("{}", encoding="utf-8")
    with (tmp_path / "boxes.csv").open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(["ImageID", "LabelName", "Confidence", "IsDepiction", "IsInside", "XMin", "YMin", "XMax", "YMax"])
        for image_id in (f"{0:016x}", "a" * 16, "b" * 16):
            writer.writerow([image_id, "/m/050k8", "1", "0", "0", 0, 0, 1, 1])
    with (tmp_path / "metadata.csv").open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(["ImageID", "OriginalLandingURL", "License", "Author", "AuthorProfileURL", "Title", "Rotation"])
        for image_id, title in (("a" * 16, "Samsung Galaxy smartphone"), ("b" * 16, "iPadのソフトキーボード")):
            writer.writerow([image_id, "https://example.com/image", "https://creativecommons.org/licenses/by/2.0/", "Author", "https://example.com/author", title, "0"])
    monkeypatch.setattr(builder, "download", lambda name: tmp_path / name)
    builder.candidates(["phone"])
    result = json.loads(manifest.read_text(encoding="utf-8"))
    assert result["classes"][:-1] == old_classes
    assert result["classes"][-1]["id"] == "phone"
    assert [item["image_id"] for item in result["classes"][-1]["images"]] == ["a" * 16]


def test_existing_extension_is_idempotent_without_network(tmp_path, monkeypatch):
    manifest = tmp_path / "manifest.json"
    original = '{"classes":[{"id":"phone","images":[]}]}'
    manifest.write_text(original, encoding="utf-8")
    monkeypatch.setattr(builder, "MANIFEST_PATH", manifest)
    def no_download(*args):
        raise AssertionError("An existing class must not trigger downloads")
    monkeypatch.setattr(builder, "download", no_download)
    builder.candidates(["phone"])
    assert manifest.read_text(encoding="utf-8") == original


def test_phone_title_filter_handles_plural_and_non_latin_boundaries():
    for title in ("iPadのソフトキーボード", "iPods", "UTOO Powerbank 6", "Samsung Galaxy Tab 10.1"):
        assert not builder.title_allowed("phone", title)
    assert builder.title_allowed("phone", "Samsung Galaxy S5")
    assert builder.title_allowed("phone", "Nokia 5800")
