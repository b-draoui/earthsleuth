"""The real NASA results (data/processed, data/graph, data/investigations) through the app's adapters.

These run without changing EARTHSLEUTH_FAKE: they call the readers directly on the real files.
"""

import json

import pandas as pd
import pytest

from common import config as C

pytestmark = pytest.mark.skipif(not C.SERIES_NC.exists(), reason="no real results in data/processed")


def test_real_files_follow_the_engine_format():
    t = pd.read_parquet(C.TRENDS_PARQUET)
    assert set(t.variable.unique()) == set(C.VARIABLES)
    assert t.cell_id.str.startswith("lat").all()  # engine ids; the app converts them
    reg = json.loads(C.REGIONAL_JSON.read_text(encoding="utf-8"))
    assert set(reg["results"]) == set(C.VARIABLES)
    for v in C.VARIABLES:
        assert set(reg["sub_results"][v]) <= set(C.SUBREGIONS)


def test_regional_json_becomes_the_app_table():
    from api.data_access import _regional_from_json

    r = _regional_from_json(C.REGIONAL_JSON)
    main = r[(r.region == C.REGION_ID) & (r.variable == "t2m")].iloc[0]
    raw = json.loads(C.REGIONAL_JSON.read_text(encoding="utf-8"))["results"]["t2m"]
    assert main.slope_dec == pytest.approx(raw["regional"]["slope_per_decade"])
    assert main.sig_up == raw["cells"]["sig_up"]
    assert main.unit == "°C"
    assert {C.REGION_ID, "tunisia", "iberia"} <= set(r.region)


def test_graph_becomes_node_link_with_types_and_labels():
    from api.data_access import _to_node_link

    g = _to_node_link(json.loads(C.GRAPH_JSON.read_text(encoding="utf-8")))
    ids = {n["id"] for n in g["nodes"]}
    assert all(n["type"] and n["label"] for n in g["nodes"])
    assert all(e["source"] in ids and e["target"] in ids for e in g["edges"])
    types = {n["type"] for n in g["nodes"]}
    assert {"Variable", "Concept", "Region", "Finding", "Dataset"} <= types


def test_recorded_investigations_replay_as_contract_3():
    from agent.agent import list_demos, replay_demo

    demos = list_demos()
    assert demos, "no recorded AI investigation in data/investigations"
    events = list(replay_demo(demos[0]["id"], pace=0))
    assert {e["stage"] for e in events} <= {"understand", "plan", "analyse", "check", "explain"}
    assert events[-1]["stage"] == "explain" and events[-1]["data"]["answer_md"]
    results = [e["data"]["result"] for e in events if e["data"].get("result")]
    assert results and all(r["unit"] == C.VARIABLES[r["variable"]]["unit"] for r in results)


def test_investigator_runs_offline_on_real_data(tmp_path, monkeypatch):
    """No Gemini key, no Neo4j: rules + templates, the same statistics, nothing written to the repo."""
    import agent.agent as A
    from agent.investigator import Investigator, number_check
    from graph.store import JsonStore

    monkeypatch.setattr(C, "INVESTIGATIONS", tmp_path)
    inv = Investigator(store=JsonStore(C.GRAPH_JSON, autosave=False), use_llm=False)
    mapper = A.EventMapper(offline=True)
    events = []
    report = inv.run("Is Tunisia getting drier?", on_step=lambda s, st, p: events.extend(mapper.map(s, st, p)))
    assert report["status"] == "done"
    assert report["steps"]["Check"]["passed"]
    assert not number_check(report["answer"], json.dumps(report["evidence_pack"]), {"2001", "2024"})
    assert any(e["data"].get("result", {}).get("region") == "tunisia" for e in events)
    assert events[-1]["data"]["answer_md"] == report["answer"]
