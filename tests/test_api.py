"""The FastAPI server on the simulated data: every route answers, shapes follow the contracts,
and the narrator only quotes numbers that are in the result files."""

import re

from fastapi.testclient import TestClient

from api import narrator
from api.main import app
from common.config import REGION_ID, SUBREGIONS, VARIABLES

client = TestClient(app)


def test_health_says_simulated():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["simulated"] is True


def test_variables_match_config():
    r = client.get("/api/variables")
    assert r.status_code == 200
    assert [v["id"] for v in r.json()] == list(VARIABLES)
    assert all(v["definition"] for v in r.json())


def test_regions():
    ids = [r["id"] for r in client.get("/api/regions").json()]
    assert ids == [REGION_ID, *SUBREGIONS]


def test_trends_geojson_has_every_year():
    fc = client.get("/api/trends/t2m").json()
    assert fc["type"] == "FeatureCollection"
    assert fc["meta"]["n_cells"] == len(fc["features"]) > 0
    props = fc["features"][0]["properties"]
    assert {"cell_id", "slope_dec", "q", "significant", "direction"} <= props.keys()
    assert all(f"y{y}" in props for y in fc["meta"]["years"])
    assert fc["meta"]["years"][0] == 2001 and fc["meta"]["years"][-1] == 2024


def test_unknown_variable_is_404():
    assert client.get("/api/trends/nope").status_code == 404
    assert client.get("/api/regional/t2m?region=atlantis").status_code == 404


def test_regional_is_contract_2():
    r = client.get("/api/regional/precip").json()
    assert {"variable", "unit", "region", "regional", "cells", "method", "datasets", "run_id"} <= r.keys()
    assert len(r["regional"]["ci95"]) == 2


def test_series_of_a_cell():
    s = client.get("/api/series/t2m/36.5_10.5").json()
    assert len(s["time"]) == len(s["value"]) == len(s["anomaly"]) == len(s["trend"]) == 288
    assert s["stats"]["q"] is not None


def test_no_missing_q_values():
    for v in VARIABLES:
        fc = client.get(f"/api/trends/{v}").json()
        assert all(f["properties"]["q"] is not None for f in fc["features"]), v


def test_ranking_clusters_summary_graph():
    assert len(client.get("/api/radar/ranking").json()) == len(VARIABLES)
    assert client.get("/api/radar/clusters").json()["meta"]["clusters"]
    assert client.get("/api/summary").json()["n_land_cells"] > 0
    g = client.get("/api/graph").json()
    assert g["nodes"] and g["edges"]


def test_agent_stream_always_ends():
    """Even if the agent crashes, the browser gets an event and then "end"."""
    r = client.get("/api/demos/does-not-exist")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    assert "event: end" in r.text


def test_narrator_only_quotes_numbers_from_the_files():
    events = list(narrator.investigate("Is the Maghreb getting hotter and drier?"))
    assert [e["stage"] for e in events][-1] == "explain"
    region = events[1]["data"]["region"]
    assert region == "maghreb"
    allowed = set()
    for e in events:
        res = e["data"].get("result")
        if res:
            r = res["regional"]
            allowed |= {r["slope_per_decade"], *r["ci95"], r["p"], res["cells"]["pct_sig_area"],
                        res["cells"]["sig_up"], res["cells"]["sig_down"]}
    for e in events:
        if e["stage"] == "analyse" and e["status"] == "done":
            for token in re.findall(r"[+-]?\d+\.\d+", e["message"]):
                value = float(token)
                assert any(abs(value - a) <= 0.0051 * max(1, abs(a)) for a in allowed), (token, e["message"])


def test_prebuilt_map_layers_match_computed(tmp_path):
    """The Docker image serves prebuilt layers: they must be byte-for-byte what the API computes,
    and named after their data source so simulated layers never pass for real ones."""
    import gzip

    from api import data_access as da
    from scripts.prebuild_cache import main

    main(tmp_path)
    for v in VARIABLES:
        raw = (tmp_path / da.cache_name(v, gzipped=False)).read_bytes()
        assert "fake" in da.cache_name(v, gzipped=False)
        assert raw == da.trends_payload(v, gzipped=False)
        assert gzip.decompress((tmp_path / da.cache_name(v, gzipped=True)).read_bytes()) == raw


def test_cells_matrix_matches_the_trends():
    """/api/cells (small maps, place card) must say exactly what the map layers say."""
    m = client.get("/api/cells").json()
    assert set(m["variables"]) == set(VARIABLES)
    n = len(m["cells"])
    for v, x in m["variables"].items():
        assert len(x["slope"]) == len(x["sig"]) == len(x["q"]) == n
        fc = client.get(f"/api/trends/{v}").json()
        by_id = {f["properties"]["cell_id"]: f["properties"] for f in fc["features"]}
        assert sum(x["sig"]) == fc["meta"]["n_significant"]
        for i in (0, n // 2, n - 1):
            p = by_id[m["cells"][i]["id"]]
            assert p["significant"] == x["sig"][i]
            assert abs(p["slope_dec"] - x["slope"][i]) < 1e-3
