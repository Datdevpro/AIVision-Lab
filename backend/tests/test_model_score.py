"""History uses the same weighted validation rubric and preserves saved scorecards."""
import copy
import math

import pytest

from app.models.db_models import Experiment
from app.services.experiment_service import summary_dict
from app.services.model_score import RUBRIC_VERSION, build_model_score


def report():
    return {"num_samples": 300, "accuracy": .85, "f1_macro": .84,
            "per_class": [{"label": "Táo", "recall": .7, "f1": .9, "support": 100},
                          {"label": "Cam", "recall": .85, "f1": .85, "support": 100},
                          {"label": "Lê", "recall": .95, "f1": .77, "support": 100}]}


def test_weighted_score_matches_frontend_rubric_and_selects_recall_not_f1():
    score = build_model_score(["Táo", "Cam", "Lê"], report(), math.log(3) / 2)
    assert score["rubric_version"] == RUBRIC_VERSION
    assert score["total"] == pytest.approx(73.05)
    assert score["qualities"] == {"accuracy": .85, "macro": .84, "weakest": .7, "loss": .5}
    assert score["weakest_class"]["label"] == "Táo"


@pytest.mark.parametrize("loss,quality", [(0, 1), (math.log(3), 0), (100, 0), (None, None), (-1, None), (float("nan"), None)])
def test_loss_boundaries(loss, quality):
    score = build_model_score(["a", "b", "c"], report(), loss)
    assert score["qualities"]["loss"] == quality
    assert (score["total"] is None) == (quality is None)


def test_missing_class_or_validation_has_no_total():
    validation = report()
    validation["per_class"][0]["support"] = 0
    assert build_model_score(["a", "b", "c"], validation, .1)["total"] is None
    assert build_model_score(["a", "b", "c"], None, .1)["total"] is None


def test_legacy_history_is_scored_without_changing_persisted_metrics():
    exp = Experiment(class_names=["Táo", "Cam", "Lê"], evaluation={"validation": report()},
                     best_checkpoint={"val_loss": math.log(3) / 2})
    before = copy.deepcopy(exp.evaluation)
    assert summary_dict(exp)["model_score"]["total"] == pytest.approx(73.05)
    assert exp.evaluation == before


def test_history_uses_saved_score_instead_of_other_or_modified_metrics():
    saved = build_model_score(["Táo", "Cam", "Lê"], report(), math.log(3) / 2)
    exp = Experiment(class_names=["Táo", "Cam", "Lê"], evaluation={"validation": {"accuracy": .1}, "model_score": saved},
                     best_checkpoint={"val_loss": 100})
    assert summary_dict(exp)["model_score"] == saved
