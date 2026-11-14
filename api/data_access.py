"""The only place where the API reads result files.

Routes call these functions, never pandas/xarray directly. If a teammate changes a file
format, only this file needs fixing. Formats: contracts/README.md.
Files come from common.config.RESULTS_DIR (data/fake/ when EARTHSLEUTH_FAKE=1).

Every number returned here is read from the engine's files or computed from series.nc with
the same definitions (anomalies = value minus its calendar-month mean). Nothing is invented.
"""

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
    RESULTS_DIR,
    SERIES_FILE,
    SUBREGIONS,
    TRENDS_FILE,
    USE_FAKE,
    VARIABLES,
)

HALF = 0.5  # half a 1° cell
CACHE_DIR = os.getenv("EARTHSLEUTH_CACHE_DIR")  # set in the Docker image only


# ---------------------------------------------------------------- helpers
def _f(x, nd: int = 4):
    """JSON-safe rounded float (None for NaN)."""
    if x is None:
        return None
    x = float(x)
    return None if math.isnan(x) else round(x, nd)


def _anomalies(s: pd.Series) -> pd.Series:
    """Use the stats engine's definition when it exists, the same formula otherwise."""
    try:
        from engine.stats import anomalies

        return anomalies(s)
    except NotImplementedError:
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


# ---------------------------------------------------------------- loaders (read once)
@lru_cache
def load_trends() -> pd.DataFrame:
    return pd.read_parquet(RESULTS_DIR / TRENDS_FILE)


@lru_cache
def load_regional() -> pd.DataFrame:
    return pd.read_parquet(RESULTS_DIR / REGIONAL_FILE)


@lru_cache
def load_clusters() -> pd.DataFrame:
    return pd.read_parquet(RESULTS_DIR / CLUSTERS_FILE)


@lru_cache
def load_series() -> xr.Dataset:
    # load into memory and close the file, so the pipeline can rewrite it while the API runs
    with xr.open_dataset(RESULTS_DIR / SERIES_FILE, engine="h5netcdf") as ds:
        return ds.load()


@lru_cache
def graph() -> dict:
    """graph.json as is (networkx node-link format)."""
    return json.loads((RESULTS_DIR / GRAPH_FILE).read_text(encoding="utf-8"))


@lru_cache
def findings() -> list[dict]:
    return json.loads((RESULTS_DIR / FINDINGS_FILE).read_text(encoding="utf-8"))


@lru_cache
def _yearly_anomalies(variable: str) -> xr.DataArray:
    """Mean anomaly of each year, per cell: what the year-by-year map animates."""
    da = load_series()[variable]
    clim = da.groupby("time.month").mean("time")
    anom = da.groupby("time.month") - clim
    return anom.groupby("time.year").mean("time")


def run_id() -> str:
    return str(load_trends()["run_id"].iloc[0])


# ---------------------------------------------------------------- meta
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


# ---------------------------------------------------------------- trends map
@lru_cache
def trends_geojson(variable: str) -> dict:
    """One 1° square per land cell with its trend and its mean anomaly for every year."""
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
    """File name of a prebuilt map layer. The data source is in the name, so a layer built from
    simulated data can never be served when the app reads the real results, or the reverse."""
    source = "fake" if USE_FAKE else "processed"
    return f"trends_{source}_{variable}.json{'.gz' if gzipped else ''}"


@lru_cache
def trends_payload(variable: str, gzipped: bool) -> bytes:
    """The map layer as ready-to-send JSON bytes (and gzipped), computed once per variable.
    In the Docker image they are prebuilt (scripts/prebuild_cache.py), so a small server starts warm."""
    if CACHE_DIR:
        f = Path(CACHE_DIR) / cache_name(variable, gzipped)
        if f.exists():
            return f.read_bytes()
    raw = json.dumps(trends_geojson(variable), separators=(",", ":")).encode()
    return gzip.compress(raw, compresslevel=6) if gzipped else raw


# ---------------------------------------------------------------- regional
def _regional_row(variable: str, region: str) -> pd.Series:
    r = load_regional()
    row = r[(r.variable == variable) & (r.region == region)]
    if row.empty:
        raise KeyError(f"no regional result for {variable} / {region}")
    return row.iloc[0]


def regional(variable: str, region: str) -> dict:
    """Contract 2 for one variable and region."""
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
    """Contract 2 for every region, with labels and boxes, main region first."""
    out = []
    for rid, b in _regions().items():
        try:
            res = regional(variable, rid)
        except KeyError:
            continue
        out.append({**res, "label": REGION_LABELS.get(rid, rid), "bbox": list(b)})
    return out


def _trend_lines(t_years: np.ndarray, y: np.ndarray, slope_dec: float, ci_lo: float, ci_hi: float) -> dict:
    """Theil–Sen line drawn with the engine's slope, plus the fan of its 95% interval around
    the middle of the period. Intercept = median(y - slope * t), the Theil–Sen definition."""
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
    """Cos-latitude weighted mean anomaly of the region, monthly and yearly, with its trend."""
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


# ---------------------------------------------------------------- one cell
def series(variable: str, cell_id: str) -> dict:
    """Monthly series of one cell: raw values, anomalies, Theil–Sen line + 95% fan, its stats."""
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


# ---------------------------------------------------------------- Signal Radar
def ranking() -> list[dict]:
    """Share of the land area (cos-lat weighted) with a significant trend, up and down, per variable."""
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


def co_occurrence(var_a: str, dir_a: str, var_b: str, dir_b: str) -> dict:
    """Cells where both variables have a significant trend in the given directions."""
    t = load_trends()
    a = t[(t.variable == var_a) & (t.direction == dir_a)].cell_id
    b = t[(t.variable == var_b) & (t.direction == dir_b)].cell_id
    both = sorted(set(a) & set(b))
    n_land = t[t.variable == var_a].shape[0]
    return {"n_cells": len(both), "pct_cells": _f(100 * len(both) / n_land, 1), "cells": both}


# ---------------------------------------------------------------- summary
def land_area_km2() -> float:
    """Area of the land cells studied: a 1° cell is (pi R / 180)^2 cos(lat) km²."""
    lats = load_trends().drop_duplicates("cell_id").lat.to_numpy()
    return float(((np.pi * 6371.0 / 180) ** 2 * np.cos(np.deg2rad(lats))).sum())


def summary() -> dict:
    """Headline facts for the home and report pages, all read from the result files."""
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
