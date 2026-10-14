"""Unit tests: dataset splitting, validation, quality warnings, fingerprints."""
from app.services import dataset_logic as L


def _items(per_class=10, classes=("a", "b"), subset="train", session=None):
    out = []
    for c in classes:
        for i in range(per_class):
            out.append(L.Item(id=f"{c}{i:03d}", class_id=c, subset=subset, session_id=session,
                              sha256=f"sha-{c}-{i}", dhash=f"{(hash((c, i)) & (2**64 - 1)):016x}"))
    return out


def test_random_split_is_deterministic_stratified_and_disjoint():
    items = _items(10)
    s1 = L.compute_split(items, "random", 0.2, seed=1)
    s2 = L.compute_split(items, "random", 0.2, seed=1)
    s3 = L.compute_split(items, "random", 0.2, seed=2)
    assert s1 == s2 and s1 != s3
    for c in "ab":
        assert sum(1 for k, v in s1.items() if k.startswith(c) and v == "val") == 2
        assert sum(1 for k, v in s1.items() if k.startswith(c) and v == "train") == 8
    assert set(s1.values()) == {"train", "val"}


def test_split_keeps_at_least_one_train_and_one_val_for_small_classes():
    items = _items(2)
    s = L.compute_split(items, "random", 0.5, seed=0)
    for c in "ab":
        assert sorted(v for k, v in s.items() if k.startswith(c)) == ["train", "val"]
    single = L.compute_split(_items(1), "random", 0.2, seed=0)
    assert set(single.values()) == {"train"}  # cannot validate a one-image class


def test_test_images_are_never_in_train_or_val():
    items = _items(8) + [L.Item(id="t1", class_id="a", subset="test"), L.Item(id="t2", class_id="b", subset="test")]
    s = L.compute_split(items, "random", 0.25, seed=3)
    assert s["t1"] == s["t2"] == "test"


def test_explicit_strategy_uses_assigned_subsets_and_random_ignores_val_tag():
    items = _items(5) + [L.Item(id=f"v{i}", class_id="a", subset="val") for i in range(3)]
    explicit = L.compute_split(items, "explicit", 0.2, seed=0)
    assert sum(1 for v in explicit.values() if v == "val") == 3
    rnd = L.compute_split(items, "random", 0.2, seed=0)
    assert all(rnd[f"v{i}"] == "unused" for i in range(3))


def test_validation_blocks_missing_classes_and_validation():
    classes = [("a", "A"), ("b", "B")]
    summary = L.build_summary(_items(1, ("a",)), classes, "random", 0.2, 0)
    codes = {e["code"] for e in L.validate_for_training(summary)}
    assert "EMPTY_CLASS" in codes
    ok = L.build_summary(_items(10), classes, "random", 0.2, 0)
    assert L.validate_for_training(ok) == []
    explicit = L.build_summary(_items(10), classes, "explicit", 0.2, 0)
    assert any(e["code"] == "NO_VAL_IMAGES" for e in L.validate_for_training(explicit))


def test_quality_warnings_cover_small_imbalanced_and_correlated_data():
    classes = [("a", "A"), ("b", "B")]
    items = _items(30, ("a",), session="s1") + _items(6, ("b",), session="s1")
    codes = {w["code"] for w in L.build_summary(items, classes, "random", 0.2, 0)["warnings"]}
    assert {"few_samples", "imbalanced_severe", "val_small", "correlated_split"} <= codes


def test_near_duplicates_between_train_and_val_are_flagged():
    classes = [("a", "A"), ("b", "B")]
    items = [L.Item(id=f"a{i}", class_id="a", subset="train", sha256=f"x{i}", dhash="0f0f0f0f0f0f0f0f" if i < 6 else f"{i * 977:016x}") for i in range(10)]
    items += [L.Item(id=f"b{i}", class_id="b", subset="train", sha256=f"y{i}", dhash=f"{(i + 3) * 1234567891011:016x}") for i in range(10)]
    codes = {w["code"] for w in L.build_summary(items, classes, "random", 0.4, 0)["warnings"]}
    assert "near_duplicates" in codes


def test_same_image_in_two_classes_is_a_label_conflict():
    classes = [("a", "A"), ("b", "B")]
    items = [L.Item(id="a1", class_id="a", subset="train", sha256="1", dhash="ffffffff00000000"),
             L.Item(id="b1", class_id="b", subset="train", sha256="2", dhash="ffffffff00000001")]
    codes = {w["code"] for w in L.build_summary(items, classes, "random", 0.2, 0)["warnings"]}
    assert "label_conflict" in codes


def test_hamming_matrix():
    m = L.hamming_matrix(["0000000000000000", "ffffffffffffffff"], ["0000000000000001", "ffffffffffffffff"])
    assert m.tolist() == [[1, 64], [63, 0]]


def test_fingerprints_change_with_data_and_split():
    classes = {"a": "A", "b": "B"}
    items = _items(6)
    f1 = L.dataset_fingerprint(items, classes)
    assert f1 == L.dataset_fingerprint(list(reversed(items)), classes)
    items[0].sha256 = "changed"
    assert f1 != L.dataset_fingerprint(items, classes)
    a1 = L.compute_split(items, "random", 0.2, 1)
    a2 = L.compute_split(items, "random", 0.2, 2)
    assert L.split_fingerprint(items, a1, classes) != L.split_fingerprint(items, a2, classes)
