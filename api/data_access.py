import gzip
import json
import math
import os
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

from api.content import DEFINITIONS, METHOD, WHY_IT_MATTERS
from common.config import (
    CLUSTERS_FILE,
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
    REGIONAL_JSON_FILE,
    RESULTS_DIR,
    SERIES_FILE,
    SUBREGIONS,
    TRENDS_FILE,
    USE_FAKE,
    VARIABLES,
    app_cell_id,
)

HALF = 0.5
CACHE_DIR = os.getenv("EARTHSLEUTH_CACHE_DIR")


def _f(x, nd: int = 4):
    if x is None:
        return None
    x = float(x)
    return None if math.isnan(x) else round(x, nd)


def _anomalies(s: pd.Series) -> pd.Series:
    try:
        from engine.stats import anomalies

        return pd.Series(anomalies(s.to_numpy(dtype="float64"), s.index.month.to_numpy()), index=s.index)
    except (ImportError, NotImplementedError):
        return s - s.groupby(s.index.month).transform("mean")


def _robust_max(values: pd.Series, pct: float = 95) -> float:
    v = np.abs(values.dropna().to_numpy())
    return float(np.percentile(v, pct)) if len(v) else 1.0


def _square(lon: float, lat: float) -> dict:
    return {
        "type": "Polygon",
        "coordinates": [[[lon - HALF, lat - HALF], [lon + HALF, lat - HALF], [lon + HALF, lat + HALF],
                         [lon - HALF, lat + HALF], [lon - HALF, lat - HALF]]],
    }


def _regions() -> dict[str, tuple[float, float, float, float]]:
    return {REGION_ID: (LON_MIN, LON_MAX, LAT_MIN, LAT_MAX), **SUBREGIONS}


def datasets_label(variable: str) -> list[str]:
    info = VARIABLES[variable]
    name = f"{info['dataset']} v{info['version']}"
    return [f"SIMULATED ({name} format)"] if USE_FAKE else [name]


def _app_ids(df: pd.DataFrame) -> pd.DataFrame:
    if "lat" in df and "lon" in df:
        df = df.copy()
        df["cell_id"] = [app_cell_id(a, b) for a, b in zip(df.lat, df.lon)]
    return df


@lru_cache
def load_trends() -> pd.DataFrame:
    t = _app_ids(pd.read_parquet(RESULTS_DIR / TRENDS_FILE))
    t["unit"] = t.variable.map(lambda v: VARIABLES[v]["unit"])
    return t


def _regional_from_json(path) -> pd.DataFrame:
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    items = list(data.get("results", {}).items())
    for v, by_region in data.get("sub_results", {}).items():
        items += [(v, r) for r in by_region.values()]
    for v, r in items:
        reg, cells = r["regional"], r["cells"]
        rows.append({
            "variable": v,
            "region": r["region"],
            "slope_dec": reg.get("slope_per_decade"),
            "ci_lo": (reg.get("ci95") or [None, None])[0],
            "ci_hi": (reg.get("ci95") or [None, None])[1],
            "p": reg.get("p"),
            "significant": bool(reg.get("significant")),
            "n_cells": cells.get("n"),
            "sig_up": cells.get("sig_up"),
            "sig_down": cells.get("sig_down"),
            "pct_sig_area": cells.get("pct_sig_area"),
            "unit": VARIABLES[v]["unit"],
            "run_id": r.get("run_id"),
        })
    return pd.DataFrame(rows)


@lru_cache
def load_regional() -> pd.DataFrame:
    if (RESULTS_DIR / REGIONAL_FILE).exists():
        return pd.read_parquet(RESULTS_DIR / REGIONAL_FILE)
    return _regional_from_json(RESULTS_DIR / REGIONAL_JSON_FILE)


@lru_cache
def load_clusters() -> pd.DataFrame:
    c = _app_ids(pd.read_parquet(RESULTS_DIR / CLUSTERS_FILE))
    if "cluster_name" not in c and "cluster_label" in c:
        c = c.rename(columns={"cluster_label": "cluster_name"})
    names = c.groupby("cluster").agg(name=("cluster_name", "first"), n=("cluster_name", "size"))
    for name, grp in names.groupby("name"):
        if len(grp) > 1:
            for k, cl in enumerate(grp.sort_values("n", ascending=False).index):
                c.loc[c.cluster == cl, "cluster_name"] = f"{name} ({'ABCDEFGH'[k]})"
    return c


@lru_cache
def load_series() -> xr.Dataset:
    with xr.open_dataset(RESULTS_DIR / SERIES_FILE, engine="h5netcdf") as ds:
        return ds.load()


def _graph_path():
    from common.config import GRAPH_JSON

    if not USE_FAKE and GRAPH_JSON.exists():
        return GRAPH_JSON
    return RESULTS_DIR / GRAPH_FILE


_NAME_KEYS = ("name", "display_name", "title", "summary", "question", "text")


def _node_label(n: dict) -> str:
    kind = n.get("label") or n.get("type")
    if kind == "Finding" and n.get("kind") == "trend" and n.get("variable") in VARIABLES:
        region = REGION_LABELS.get(n.get("region"), n.get("region"))
        return f"{VARIABLES[n['variable']]['label']} · {region}"
    if kind == "Finding" and n.get("kind") == "cluster":
        region = REGION_LABELS.get(n.get("region"), n.get("region"))
        return f"Cluster '{n.get('cluster_label', '?')}' · {region}"
    for k in _NAME_KEYS:
        if isinstance(n.get(k), str) and n[k].strip():
            return n[k].strip()
    return str(n.get("id"))


def _to_node_link(g: dict) -> dict:
    from graph.store import parse_json_prop

    nodes = []
    for n in g.get("nodes", []):
        props = {k: parse_json_prop(v) for k, v in n.items() if k not in ("created_at", "updated_at")}
        out = {**props, "id": n["id"], "type": n.get("label") or n.get("type") or "Node", "label": _node_label(n)}
        if isinstance(props.get("slope_per_decade"), (int, float)) and "slope_dec" not in out:
            out["slope_dec"] = props["slope_per_decade"]
        nodes.append(out)
    ids = {n["id"] for n in nodes}
    edges = [
        {**{k: v for k, v in r.items() if k not in ("src", "dst", "created_at", "updated_at")},
         "source": r["src"], "target": r["dst"], "type": r["type"]}
        for r in g.get("relationships", [])
        if r.get("src") in ids and r.get("dst") in ids
    ]
    return {"directed": True, "multigraph": True, "graph": {"exported_at": g.get("exported_at")}, "nodes": nodes, "edges": edges}


@lru_cache
def graph() -> dict:
    g = json.loads(_graph_path().read_text(encoding="utf-8"))
    return _to_node_link(g) if "relationships" in g else g


@lru_cache
def findings() -> list[dict]:
    return json.loads((RESULTS_DIR / FINDINGS_FILE).read_text(encoding="utf-8"))


@lru_cache
def _yearly_anomalies(variable: str) -> xr.DataArray:
    da = load_series()[variable]
    clim = da.groupby("time.month").mean("time")
    anom = da.groupby("time.month") - clim
    return anom.groupby("time.year").mean("time")


def run_id() -> str:
    return str(load_trends()["run_id"].iloc[0])


def variables() -> list[dict]:
    return [
        {
            "id": vid,
            "label": v["label"],
            "unit": v["unit"],
            "dataset": v["dataset"],
            "version": v["version"],
            "definition": DEFINITIONS.get(vid, ""),
            "why": WHY_IT_MATTERS.get(vid, ""),
        }
        for vid, v in VARIABLES.items()
    ]


def regions() -> list[dict]:
    return [{"id": rid, "label": REGION_LABELS.get(rid, rid), "bbox": list(b)} for rid, b in _regions().items()]


@lru_cache
def trends_geojson(variable: str) -> dict:
    t = load_trends()
    t = t[t.variable == variable]
    yearly = _yearly_anomalies(variable)
    years = [int(y) for y in yearly.year.values]
    features = []
    for row in t.itertuples(index=False):
        ys = yearly.sel(lat=row.lat, lon=row.lon, method="nearest").values
        props = {
            "cell_id": row.cell_id,
            "lat": row.lat,
            "lon": row.lon,
            "slope_dec": _f(row.slope_dec, 5),
            "ci_lo": _f(row.ci_lo, 5),
            "ci_hi": _f(row.ci_hi, 5),
            "p": _f(row.p, 5),
            "q": _f(row.q, 5),
            "significant": bool(row.significant),
            "direction": row.direction,
        }
        props.update({f"y{y}": _f(v, 4) for y, v in zip(years, ys, strict=True)})
        features.append({"type": "Feature", "properties": props, "geometry": _square(row.lon, row.lat)})
    yearly_values = pd.Series(yearly.values.ravel())
    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {
            "variable": variable,
            "unit": VARIABLES[variable]["unit"],
            "years": years,
            "slope_max": _f(_robust_max(t.slope_dec), 5),
            "anomaly_max": _f(_robust_max(yearly_values), 4),
            "n_cells": len(features),
            "n_significant": int(t.significant.sum()),
            "simulated": USE_FAKE,
            "run_id": run_id(),
        },
    }


def cache_name(variable: str, gzipped: bool) -> str:
    source = "fake" if USE_FAKE else "processed"
    return f"trends_{source}_{variable}.json{'.gz' if gzipped else ''}"


@lru_cache
def trends_payload(variable: str, gzipped: bool) -> bytes:
    if CACHE_DIR:
        f = Path(CACHE_DIR) / cache_name(variable, gzipped)
        if f.exists():
            return f.read_bytes()
    raw = json.dumps(trends_geojson(variable), separators=(",", ":")).encode()
    return gzip.compress(raw, compresslevel=6) if gzipped else raw


def _regional_row(variable: str, region: str) -> pd.Series:
    r = load_regional()
    row = r[(r.variable == variable) & (r.region == region)]
    if row.empty:
        raise KeyError(f"no regional result for {variable} / {region}")
    return row.iloc[0]


def regional(variable: str, region: str) -> dict:
    row = _regional_row(variable, region)
    return {
        "variable": variable,
        "unit": VARIABLES[variable]["unit"],
        "region": region,
        "regional": {
            "slope_per_decade": _f(row.slope_dec, 5),
            "ci95": [_f(row.ci_lo, 5), _f(row.ci_hi, 5)],
            "p": _f(row.p, 5),
            "significant": bool(row.significant),
        },
        "cells": {
            "n": int(row.n_cells),
            "sig_up": int(row.sig_up),
            "sig_down": int(row.sig_down),
            "pct_sig_area": _f(row.pct_sig_area, 2),
        },
        "method": METHOD,
        "datasets": datasets_label(variable),
        "run_id": str(row.run_id),
    }


def regional_all(variable: str) -> list[dict]:
    out = []
    for rid, b in _regions().items():
        try:
            res = regional(variable, rid)
        except KeyError:
            continue
        out.append({**res, "label": REGION_LABELS.get(rid, rid), "bbox": list(b)})
    return out


def _trend_lines(t_years: np.ndarray, y: np.ndarray, slope_dec: float, ci_lo: float, ci_hi: float) -> dict:
    ok = ~np.isnan(y)
    b = slope_dec / 10
    a = float(np.median(y[ok] - b * t_years[ok]))
    t_mid = float(np.median(t_years))
    y_mid = a + b * t_mid
    lo = y_mid + (ci_lo / 10) * (t_years - t_mid)
    hi = y_mid + (ci_hi / 10) * (t_years - t_mid)
    return {
        "trend": [_f(a + b * t) for t in t_years],
        "band_lo": [_f(min(u, v)) for u, v in zip(lo, hi, strict=True)],
        "band_hi": [_f(max(u, v)) for u, v in zip(lo, hi, strict=True)],
    }


def regional_series(variable: str, region: str) -> dict:
    lo0, lo1, la0, la1 = _regions()[region]
    da = load_series()[variable].sel(lon=slice(lo0, lo1), lat=slice(la0, la1))
    w = np.cos(np.deg2rad(da.lat)) * da.isel(time=0).notnull()
    mean = (da.fillna(0) * w).sum(("lat", "lon")) / w.sum()
    s = pd.Series(mean.values, index=pd.DatetimeIndex(mean.time.values))
    anom = _anomalies(s)
    row = _regional_row(variable, region)
    t_years = (np.arange(len(s)) / 12.0)
    lines = _trend_lines(t_years, anom.to_numpy(), row.slope_dec, row.ci_lo, row.ci_hi)
    yearly = anom.groupby(anom.index.year).mean()
    return {
        "variable": variable,
        "region": region,
        "label": REGION_LABELS.get(region, region),
        "unit": VARIABLES[variable]["unit"],
        "time": [d.strftime("%Y-%m") for d in s.index],
        "value": [_f(v) for v in s.to_numpy()],
        "anomaly": [_f(v) for v in anom.to_numpy()],
        **lines,
        "years": [int(y) for y in yearly.index],
        "yearly_anomaly": [_f(v) for v in yearly.to_numpy()],
        "stats": regional(variable, region)["regional"],
    }


def series(variable: str, cell_id: str) -> dict:
    t = load_trends()
    row = t[(t.variable == variable) & (t.cell_id == cell_id)]
    if row.empty:
        raise KeyError(f"no land cell {cell_id} for {variable}")
    row = row.iloc[0]
    da = load_series()[variable].sel(lat=row.lat, lon=row.lon, method="nearest")
    s = pd.Series(da.values.astype("float64"), index=pd.DatetimeIndex(da.time.values))
    anom = _anomalies(s)
    t_years = np.arange(len(s)) / 12.0
    lines = _trend_lines(t_years, anom.to_numpy(), row.slope_dec, row.ci_lo, row.ci_hi)
    clim = s.groupby(s.index.month).mean()
    return {
        "variable": variable,
        "cell_id": cell_id,
        "lat": float(row.lat),
        "lon": float(row.lon),
        "unit": VARIABLES[variable]["unit"],
        "time": [d.strftime("%Y-%m") for d in s.index],
        "value": [_f(v) for v in s.to_numpy()],
        "anomaly": [_f(v) for v in anom.to_numpy()],
        **lines,
        "seasonal_cycle": [_f(v) for v in clim.to_numpy()],
        "stats": {
            "slope_dec": _f(row.slope_dec, 5),
            "ci_lo": _f(row.ci_lo, 5),
            "ci_hi": _f(row.ci_hi, 5),
            "p": _f(row.p, 5),
            "q": _f(row.q, 5),
            "significant": bool(row.significant),
            "direction": row.direction,
            "n": int(row.n),
            "tau": _f(row.tau, 4),
        },
        "regions": [rid for rid, (a, b, c, d) in SUBREGIONS.items() if a <= row.lon <= b and c <= row.lat <= d],
    }


def ranking() -> list[dict]:
    t = load_trends()
    out = []
    for v in VARIABLES:
        tv = t[t.variable == v]
        w = np.cos(np.deg2rad(tv.lat))
        up = float(100 * (w * (tv.direction == "up")).sum() / w.sum())
        down = float(100 * (w * (tv.direction == "down")).sum() / w.sum())
        reg = regional(v, REGION_ID)
        out.append({
            "variable": v,
            "label": VARIABLES[v]["label"],
            "unit": VARIABLES[v]["unit"],
            "pct_up": _f(up, 2),
            "pct_down": _f(down, 2),
            "pct_total": _f(up + down, 2),
            "n_cells": len(tv),
            "regional": reg["regional"],
        })
    return sorted(out, key=lambda r: r["pct_total"], reverse=True)


@lru_cache
def clusters_geojson() -> dict:
    c = load_clusters()
    var_cols = [v for v in VARIABLES if v in c.columns]
    features = [
        {
            "type": "Feature",
            "properties": {"cell_id": r.cell_id, "cluster": int(r.cluster), "cluster_name": r.cluster_name},
            "geometry": _square(r.lon, r.lat),
        }
        for r in c.itertuples(index=False)
    ]
    summary = []
    for k, g in c.groupby("cluster"):
        summary.append({
            "cluster": int(k),
            "name": str(g.cluster_name.iloc[0]),
            "n_cells": len(g),
            "signature": {v: _f(g[v].mean(), 3) for v in var_cols},
        })
    return {"type": "FeatureCollection", "features": features, "meta": {"clusters": summary, "simulated": USE_FAKE}}


@lru_cache
def cells_matrix() -> dict:
    t = load_trends()
    cells = (
        t[["cell_id", "lat", "lon"]].drop_duplicates("cell_id").sort_values(["lat", "lon"], ascending=[False, True])
    )
    ids = cells.cell_id.tolist()
    out: dict = {
        "cells": [{"id": c, "lat": _f(la, 2), "lon": _f(lo, 2)} for c, la, lo in zip(ids, cells.lat, cells.lon)],
        "variables": {},
    }
    for v in VARIABLES:
        sub = t[t.variable == v].set_index("cell_id").reindex(ids)
        slopes = sub.slope_dec.astype(float)
        out["variables"][v] = {
            "unit": str(sub.unit.dropna().iloc[0]) if sub.unit.notna().any() else "",
            "slope_max": _f(_robust_max(slopes.abs().dropna())),
            "slope": [None if pd.isna(x) else _f(x, 5) for x in slopes],
            "ci_lo": [None if pd.isna(x) else _f(x, 5) for x in sub.ci_lo.astype(float)],
            "ci_hi": [None if pd.isna(x) else _f(x, 5) for x in sub.ci_hi.astype(float)],
            "q": [None if pd.isna(x) else _f(x, 4) for x in sub.q.astype(float)],
            "sig": [bool(x) if not pd.isna(x) else False for x in sub.significant],
        }
    out["simulated"] = USE_FAKE
    out["run_id"] = run_id()
    return out


def co_occurrence(var_a: str, dir_a: str, var_b: str, dir_b: str) -> dict:
    t = load_trends()
    a = t[(t.variable == var_a) & (t.direction == dir_a)].cell_id
    b = t[(t.variable == var_b) & (t.direction == dir_b)].cell_id
    both = sorted(set(a) & set(b))
    n_land = t[t.variable == var_a].shape[0]
    return {"n_cells": len(both), "pct_cells": _f(100 * len(both) / n_land, 1), "cells": both}


def land_area_km2() -> float:
    lats = load_trends().drop_duplicates("cell_id").lat.to_numpy()
    return float(((np.pi * 6371.0 / 180) ** 2 * np.cos(np.deg2rad(lats))).sum())


def summary() -> dict:
    r = load_regional()
    out = []
    for v in VARIABLES:
        main = regional(v, REGION_ID)
        subs = r[(r.variable == v) & (r.region != REGION_ID) & (r.significant)]
        strongest = None
        if not subs.empty:
            s = subs.loc[subs.slope_dec.abs().idxmax()]
            strongest = {"region": s.region, "label": REGION_LABELS.get(s.region, s.region),
                         "slope_dec": _f(s.slope_dec, 5), "p": _f(s.p, 5)}
        ups = subs[subs.slope_dec > 0].region.tolist()
        downs = subs[subs.slope_dec < 0].region.tolist()
        out.append({
            "variable": v,
            "label": VARIABLES[v]["label"],
            "unit": VARIABLES[v]["unit"],
            "regional": main["regional"],
            "cells": main["cells"],
            "strongest": strongest,
            "opposite": {"up": [REGION_LABELS.get(x, x) for x in ups], "down": [REGION_LABELS.get(x, x) for x in downs]}
            if ups and downs else None,
        })
    return {
        "period": list(PERIOD),
        "region": REGION_ID,
        "region_label": REGION_LABELS[REGION_ID],
        "n_land_cells": int(load_trends().cell_id.nunique()),
        "land_area_km2": _f(land_area_km2(), 0),
        "variables": out,
        "warming_drying": co_occurrence("t2m", "up", "soil_moisture", "down") | {"cells": None},
        "method": METHOD,
        "simulated": USE_FAKE,
        "run_id": run_id(),
    }
