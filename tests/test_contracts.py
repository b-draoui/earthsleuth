import json
from pathlib import Path

import pandas as pd
import pytest

from common.config import FAKE_DIR, PROCESSED_DIR, TRENDS_FILE, VARIABLES

EXAMPLES = Path(__file__).resolve().parents[1] / "contracts" / "examples"

TRENDS_COLUMNS = {
    "variable", "cell_id", "lat", "lon", "slope_dec", "ci_lo", "ci_hi", "unit",
    "p", "q", "significant", "tau", "n", "direction", "run_id", "datasets",
}


def load(name: str):
    return json.loads((EXAMPLES / name).read_text(encoding="utf-8"))


def test_investigation_spec_keys():
    spec = load("investigation_spec.json")
    assert {"question", "concepts", "variables", "region", "period", "outputs"} <= spec.keys()
    assert set(spec["variables"]) <= VARIABLES.keys()


def test_variable_result_keys():
    res = load("variable_result.json")
    assert {"variable", "unit", "region", "regional", "cells", "method", "datasets", "run_id"} <= res.keys()
    assert {"slope_per_decade", "ci95", "p", "significant"} <= res["regional"].keys()


def test_agent_events_keys():
    stages = {"understand", "plan", "analyse", "check", "explain"}
    for event in load("agent_event.json"):
        assert {"stage", "status", "message", "data"} <= event.keys()
        assert event["stage"] in stages
        assert event["status"] in {"running", "done", "error"}


@pytest.mark.parametrize("folder", [PROCESSED_DIR, FAKE_DIR], ids=["processed", "fake"])
def test_trends_parquet_columns(folder):
    path = folder / TRENDS_FILE
    if not path.exists():
        pytest.skip(f"{path.name} not in {folder.name}/ yet")
    df = pd.read_parquet(path)
    assert TRENDS_COLUMNS <= set(df.columns), f"missing: {TRENDS_COLUMNS - set(df.columns)}"
    assert set(df["variable"]) <= VARIABLES.keys()
    assert set(df["direction"]) <= {"up", "down", "none"}
