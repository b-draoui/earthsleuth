import json
import time
import warnings
from datetime import UTC, datetime

import numpy as np
import pandas as pd
import pymannkendall as mk
import xarray as xr
from scipy.ndimage import distance_transform_edt, zoom
from scipy.stats import theilslopes
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from statsmodels.stats.multitest import multipletests

from common.config import (
    ALPHA,
    CLUSTERS_FILE,
    FAKE_DIR,
    FDR_Q,
    FINDINGS_FILE,
    GRAPH_FILE,
    LAT_MAX,
    LAT_MIN,
    LON_MAX,
    LON_MIN,
    PERIOD,
    REGION_ID,
    REGION_LABELS,
    REGIONAL_FILE,
    SERIES_FILE,
    SUBREGIONS,
    TRENDS_FILE,
    VARIABLES,
    app_cell_id as cell_id,
)

SEED = 2026

LAND_ROWS = [
    "00000000111111111111111111111111111111111011110011",
    "00000000011111111111111111111111111111110001100111",
    "00000000011111111111110001111111111111100000000011",
    "00111000111111111000111100111111111111000000000000",
    "01111111111110000000011100001111111111000000000000",
    "01111111111100000000000111000111111111000011110000",
    "01111111111000000011000001110111110011011111111111",
    "01111111110000000011000000100011100011111111111111",
    "01111111110000000000000000000001110001111111111111",
    "01111111100000000000000110000001100001111111111111",
    "00001000000111111111100000000000000000010011001111",
    "00001000011111111111100000000000000000000000001111",
    "00011111111111111111000000000000000000000000001111",
    "00111111111111111111100000000000000000000000011111",
    "01111111111111111111111110000001100000000000011111",
    "11111111111111111111111111000011111110000000111111",
    "11111111111111111111111111111011111111111111111111",
    "11111111111111111111111111111111111111111111111111",
    "11111111111111111111111111111111111111111111111111",
    "11111111111111111111111111111111111111111111001111",
    "11111111111111111111111111111111111111111111001111",
    "11111111111111111111111111111111111111111111100111",
]

LATS = np.arange(LAT_MIN + 0.5, LAT_MAX, 1.0)
LONS = np.arange(LON_MIN + 0.5, LON_MAX, 1.0)
TIME = pd.date_range(f"{PERIOD[0]}-01", f"{PERIOD[1]}-01", freq="MS")
NT, NY, NX = len(TIME), len(LATS), len(LONS)
LAND = np.array([[c == "1" for c in row] for row in LAND_ROWS[::-1]])
LAT2, LON2 = np.meshgrid(LATS, LONS, indexing="ij")
YEARS = np.arange(NT) / 12.0
MONTH = np.arange(NT) % 12


def box(lon0, lon1, lat0, lat1):
    return (LON2 >= lon0) & (LON2 <= lon1) & (LAT2 >= lat0) & (LAT2 <= lat1)


def smooth_noise(rng, sd, phi, coarse=(4, 7)):
    out = np.empty((NT, NY, NX))
    prev = np.zeros((NY, NX))
    for t in range(NT):
        field = zoom(rng.normal(size=coarse), (NY / coarse[0], NX / coarse[1]), order=3)[:NY, :NX]
        prev = phi * prev + np.sqrt(1 - phi**2) * field
        out[t] = prev
    return sd * out / out.std()


def build_series(rng):
    inland = np.clip(distance_transform_edt(LAND) / 6.0, 0, 1)
    desert = np.clip((31.5 - LAT2) / 5.0, 0, 1) + 0.6 * box(34, 40, 25, 33) * np.clip((36 - LAT2) / 6, 0, 1)
    desert = np.clip(desert, 0, 1)
    maghreb = box(-10, 12, 29, 37.5).astype(float)
    levant = box(33, 40, 29, 37).astype(float)
    nile = box(29.5, 32.5, 29.5, 31.6).astype(float)
    season = np.cos(2 * np.pi * MONTH / 12)[:, None, None]

    base = 29 - 0.62 * (LAT2 - 25) + 2.0 * desert
    amp = 6 + 5 * inland + 2 * desert
    warm = 0.22 + 0.25 * inland + 0.12 * box(-10, 3.5, 36, 44) + 0.1 * desert + 0.05 * rng.normal(size=(NY, NX))
    t2m = base - amp * season + warm * YEARS[:, None, None] / 10
    t2m += smooth_noise(rng, 1.0, 0.5) + 0.35 * rng.normal(size=t2m.shape)

    p0 = 3 + 72 / (1 + np.exp(-(LAT2 - 34.5) / 2.2)) - 22 * levant * inland
    s = np.where(LAT2 < 42, 0.75, 0.25)
    rel_trend = 0.05 * np.tanh((LAT2 - 41) / 2) - 0.07 * maghreb - 0.05 * levant + 0.015 * rng.normal(size=(NY, NX))
    shape = np.clip(1 + s * season, 0.05, None)
    precip = p0 * shape * np.clip(1 + rel_trend * YEARS[:, None, None] / 10, 0.2, None)
    precip *= np.exp(smooth_noise(rng, 0.38, 0.3) + 0.25 * rng.normal(size=precip.shape) - 0.1)
    precip = np.clip(precip, 0, None)

    ema = np.empty_like(precip)
    ema[0] = precip[0]
    for t in range(1, NT):
        ema[t] = 0.55 * ema[t - 1] + 0.45 * precip[t]
    t_clim = np.stack([t2m[MONTH == m].mean(axis=0) for m in range(12)])[MONTH]
    soil = 6 + 26 * ema / (ema + 35) - 0.18 * (t2m - t_clim) + 0.6 * smooth_noise(rng, 1.0, 0.4)
    soil = np.clip(soil, 2, 40)

    pet = 0.5 + 0.13 * np.clip(t2m, 0, None)
    et = pet * soil / (soil + 12) * (0.6 + 0.4 * (1 - desert)) + 0.08 * smooth_noise(rng, 1.0, 0.3)
    et = np.clip(et, 0.05, None)

    soil_lag = np.roll(soil, 1, axis=0)
    soil_lag[0] = soil[0]
    green_up = np.cos(2 * np.pi * (MONTH[:, None, None] - np.where(LAT2 < 40, 3, 5)[None]) / 12)
    ndvi = 0.07 + 0.55 * soil_lag / (soil_lag + 16) * (1 + 0.12 * green_up) - 0.03 * desert
    ndvi += nile * (0.25 + 0.045 * YEARS[:, None, None] / 10) + 0.012 * smooth_noise(rng, 1.0, 0.5)
    ndvi = np.clip(ndvi, -0.1, 0.9)

    data = {"t2m": t2m, "precip": precip, "soil_moisture": soil, "et": et, "ndvi": ndvi}
    for v in data:
        data[v] = np.where(LAND[None], data[v], np.nan).astype("float32")
    return data


def anomalies(x):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        clim = np.stack([np.nanmean(x[MONTH == m], axis=0) for m in range(12)])
    return x - clim[MONTH]


def trend_test(y):
    ts = theilslopes(y, YEARS, alpha=0.95)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        test = mk.hamed_rao_modification_test(y)
    if not np.isfinite(test.p):
        test = mk.original_test(y)
    return {
        "slope_dec": float(ts.slope * 10),
        "ci_lo": float(ts.low_slope * 10),
        "ci_hi": float(ts.high_slope * 10),
        "p": float(test.p),
        "tau": float(test.Tau),
    }


def main() -> None:
    started = time.time()
    rng = np.random.default_rng(SEED)
    run_id = datetime.now(UTC).strftime("%Y-%m-%dT%H:%MZ") + "-simulated"
    FAKE_DIR.mkdir(parents=True, exist_ok=True)

    data = build_series(rng)
    ds = xr.Dataset(
        {v: (("time", "lat", "lon"), data[v], {"units": VARIABLES[v]["unit"], "long_name": VARIABLES[v]["label"]}) for v in data},
        coords={"time": TIME, "lat": LATS, "lon": LONS},
        attrs={"title": "EarthSleuth SIMULATED series", "simulated": 1, "run_id": run_id},
    )
    ds.to_netcdf(FAKE_DIR / SERIES_FILE, engine="h5netcdf")

    land_idx = np.argwhere(LAND)
    rows = []
    for v in VARIABLES:
        anom = anomalies(data[v].astype("float64"))
        stats = [trend_test(anom[:, i, j]) for i, j in land_idx]
        pvals = np.array([s["p"] if np.isfinite(s["p"]) else 1.0 for s in stats])
        reject, q, _, _ = multipletests(pvals, alpha=FDR_Q, method="fdr_bh")
        for (i, j), s, sig, qv in zip(land_idx, stats, reject, q, strict=True):
            direction = ("up" if s["slope_dec"] > 0 else "down") if sig else "none"
            rows.append(
                {
                    "variable": v,
                    "cell_id": cell_id(LATS[i], LONS[j]),
                    "lat": float(LATS[i]),
                    "lon": float(LONS[j]),
                    **s,
                    "unit": VARIABLES[v]["unit"],
                    "q": float(qv),
                    "significant": bool(sig),
                    "n": NT,
                    "direction": direction,
                    "run_id": run_id,
                    "datasets": f"SIMULATED ({VARIABLES[v]['dataset']} v{VARIABLES[v]['version']} format)",
                }
            )
        print(f"  {v}: {int(reject.sum())} of {len(stats)} cells significant after FDR")
    trends = pd.DataFrame(rows)[
        ["variable", "cell_id", "lat", "lon", "slope_dec", "ci_lo", "ci_hi", "unit", "p", "q",
         "significant", "tau", "n", "direction", "run_id", "datasets"]
    ]
    trends.to_parquet(FAKE_DIR / TRENDS_FILE, index=False)

    weights = np.cos(np.deg2rad(LAT2)) * LAND
    regions = {REGION_ID: (LON_MIN, LON_MAX, LAT_MIN, LAT_MAX), **SUBREGIONS}
    reg_rows = []
    for v in VARIABLES:
        anom = anomalies(data[v].astype("float64"))
        tv = trends[trends.variable == v].set_index("cell_id")
        for rid, (lo0, lo1, la0, la1) in regions.items():
            inside = box(lo0, lo1, la0, la1) & LAND
            w = weights * inside
            series = np.nansum(anom * w[None], axis=(1, 2)) / w.sum()
            s = trend_test(series)
            ids = [cell_id(LATS[i], LONS[j]) for i, j in np.argwhere(inside)]
            sub = tv.loc[ids]
            area = np.cos(np.deg2rad(sub.lat))
            reg_rows.append(
                {
                    "variable": v,
                    "region": rid,
                    "slope_dec": s["slope_dec"],
                    "ci_lo": s["ci_lo"],
                    "ci_hi": s["ci_hi"],
                    "p": s["p"],
                    "significant": s["p"] < ALPHA,
                    "n_cells": len(ids),
                    "sig_up": int((sub.direction == "up").sum()),
                    "sig_down": int((sub.direction == "down").sum()),
                    "pct_sig_area": float(100 * (area * sub.significant).sum() / area.sum()),
                    "unit": VARIABLES[v]["unit"],
                    "run_id": run_id,
                }
            )
    regional = pd.DataFrame(reg_rows)
    regional.to_parquet(FAKE_DIR / REGIONAL_FILE, index=False)

    wide = trends.pivot(index="cell_id", columns="variable", values="slope_dec")[list(VARIABLES)]
    z = (wide - wide.mean()) / wide.std()
    best = None
    for k in range(3, 7):
        km = KMeans(n_clusters=k, n_init=10, random_state=0).fit(z.values)
        score = silhouette_score(z.values, km.labels_)
        if best is None or score > best[0]:
            best = (score, k, km)
    _, k, km = best
    words = {
        "t2m": ("warming", "cooling"),
        "precip": ("wetter", "drier"),
        "soil_moisture": ("moister soils", "drying soils"),
        "et": ("more evaporation", "less evaporation"),
        "ndvi": ("greening", "browning"),
    }
    names = {}
    for c, centre in enumerate(km.cluster_centers_):
        mean_slope = wide[km.labels_ == c].mean()
        strong = []
        for v, zval in zip(VARIABLES, centre, strict=True):
            if abs(zval) < 0.5:
                continue
            word = words[v][0 if mean_slope[v] > 0 else 1]
            if np.sign(zval) != np.sign(mean_slope[v]):
                word = f"weaker {word}"
            strong.append((abs(zval), word))
        strong.sort(reverse=True)
        names[c] = " + ".join(w for _, w in strong[:2]) or "little change"
    meta = trends.drop_duplicates("cell_id").set_index("cell_id")[["lat", "lon"]]
    clusters = z.copy()
    clusters["cluster"] = km.labels_
    clusters["cluster_name"] = [names[c] for c in km.labels_]
    clusters = clusters.join(meta).reset_index()[["cell_id", "lat", "lon", "cluster", "cluster_name", *VARIABLES]]
    clusters.to_parquet(FAKE_DIR / CLUSTERS_FILE, index=False)

    findings = []
    for r in reg_rows:
        if r["region"] != REGION_ID and r["significant"]:
            findings.append(
                {
                    "id": f"finding_{r['variable']}_{r['region']}",
                    "kind": "regional_trend",
                    "variable": r["variable"],
                    "region": r["region"],
                    "slope_dec": r["slope_dec"],
                    "ci95": [r["ci_lo"], r["ci_hi"]],
                    "p": r["p"],
                    "direction": "up" if r["slope_dec"] > 0 else "down",
                    "period": list(PERIOD),
                    "datasets": ["SIMULATED"],
                    "run_id": run_id,
                }
            )
    for c in range(k):
        findings.append(
            {
                "id": f"finding_cluster_{c}",
                "kind": "cluster",
                "cluster": c,
                "cluster_name": names[c],
                "signature": {v: float(val) for v, val in zip(VARIABLES, km.cluster_centers_[c], strict=True)},
                "n_cells": int((km.labels_ == c).sum()),
                "period": list(PERIOD),
                "run_id": run_id,
            }
        )
    (FAKE_DIR / FINDINGS_FILE).write_text(json.dumps(findings, indent=2), encoding="utf-8")
    (FAKE_DIR / GRAPH_FILE).write_text(json.dumps(build_graph(findings), indent=2), encoding="utf-8")

    print(f"Wrote simulated files to {FAKE_DIR} in {time.time() - started:.0f} s ({run_id}, {k} clusters)")


def build_graph(findings: list[dict]) -> dict:
    nodes, edges = [], []

    def node(i, t, label, **kw):
        nodes.append({"id": i, "type": t, "label": label, **kw})

    def edge(a, b, t, **kw):
        edges.append({"source": a, "target": b, "type": t, "key": 0, **kw})

    node("src_merra2", "Mission", "MERRA-2 reanalysis (NASA GMAO)")
    node("src_gpm", "Mission", "GPM constellation")
    node("src_gldas", "Mission", "GLDAS land model")
    node("src_terra", "Mission", "Terra satellite")
    node("inst_modis", "Instrument", "MODIS")
    edge("src_terra", "inst_modis", "CARRIES")
    for v, info in VARIABLES.items():
        ds_id = f"dataset_{info['dataset'].lower()}"
        if not any(n["id"] == ds_id for n in nodes):
            node(ds_id, "Dataset", f"{info['dataset']} v{info['version']}")
        node(f"var_{v}", "Variable", info["label"], var_id=v, unit=info["unit"])
        edge(ds_id, f"var_{v}", "HAS_VARIABLE")
    edge("src_merra2", "dataset_m2tmnxslv", "PROVIDES")
    edge("src_gpm", "dataset_gpm_3imergm", "PROVIDES")
    edge("src_gldas", "dataset_gldas_noah025_m", "PROVIDES")
    edge("inst_modis", "dataset_mod13c2", "MEASURES")

    for cid, label in [
        ("concept_heat", "Surface heating"),
        ("concept_water", "Water availability"),
        ("concept_vegetation", "Vegetation health"),
        ("concept_water_cycle", "Water cycle"),
    ]:
        node(cid, "Concept", label)
    for v, c in [("t2m", "concept_heat"), ("precip", "concept_water"), ("soil_moisture", "concept_water"),
                 ("et", "concept_water_cycle"), ("precip", "concept_water_cycle"), ("ndvi", "concept_vegetation")]:
        edge(f"var_{v}", c, "INDICATOR_OF")
    basis = "general physical relationship, not tested by EarthSleuth"
    for a, b, sign in [("precip", "soil_moisture", "+"), ("soil_moisture", "et", "+"), ("t2m", "et", "+"),
                       ("t2m", "soil_moisture", "-"), ("soil_moisture", "ndvi", "+")]:
        edge(f"var_{a}", f"var_{b}", "INFLUENCES", sign=sign, basis=basis)

    node(f"region_{REGION_ID}", "Region", REGION_LABELS[REGION_ID])
    for rid in SUBREGIONS:
        node(f"region_{rid}", "Region", REGION_LABELS[rid])
        edge(f"region_{rid}", f"region_{REGION_ID}", "PART_OF")

    for f in findings:
        if f["kind"] == "regional_trend":
            word = "rising" if f["direction"] == "up" else "falling"
            label = f"{VARIABLES[f['variable']]['label']} {word} in {REGION_LABELS[f['region']]}"
            node(f["id"], "Finding", label, slope_dec=f["slope_dec"], p=f["p"], simulated=True)
            edge(f["id"], f"var_{f['variable']}", "ABOUT")
            edge(f["id"], f"region_{f['region']}", "IN_REGION")
        else:
            node(f["id"], "Finding", f"Cluster: {f['cluster_name']}", n_cells=f["n_cells"], simulated=True)
            for v, val in f["signature"].items():
                if abs(val) >= 0.5:
                    edge(f["id"], f"var_{v}", "ABOUT")
    return {"directed": True, "multigraph": True, "graph": {"simulated": True}, "nodes": nodes, "edges": edges}


if __name__ == "__main__":
    main()
