"""The only place where the API reads result files.

Routes call these functions, never pandas/xarray directly. If a teammate changes a file
format, only this file needs fixing. Formats: contracts/README.md.
Files come from common.config.RESULTS_DIR (data/fake/ when EARTHSLEUTH_FAKE=1).
"""

from functools import lru_cache

import pandas as pd

from common.config import RESULTS_DIR, VARIABLES  # noqa: F401


@lru_cache
def load_trends() -> pd.DataFrame:
    """trends.parquet, read once and kept in memory."""
    # TODO(app): pd.read_parquet(RESULTS_DIR / TRENDS_FILE)
    raise NotImplementedError("trends.parquet")


def trends_geojson(variable: str) -> dict:
    """One variable as a GeoJSON FeatureCollection: one 1° square polygon per land cell,
    with slope_dec, q, significant, direction as properties (what MapLibre draws)."""
    # TODO(app)
    raise NotImplementedError(f"trends geojson for {variable}")


def regional(variable: str, region: str) -> dict:
    """Contract 2 for one variable and region, built from regional.parquet + trends.parquet."""
    # TODO(app)
    raise NotImplementedError(f"regional {variable} {region}")


def series(variable: str, cell_id: str) -> dict:
    """Monthly series of one cell: {"time": [...], "value": [...], "anomaly": [...]} + its trend row.

    Use engine.stats.anomalies() so the app shows exactly what the engine computed.
    """
    # TODO(app): xarray.open_dataset(RESULTS_DIR / SERIES_FILE), select the cell
    raise NotImplementedError(f"series {variable} {cell_id}")


def ranking() -> list[dict]:
    """Signal Radar ranked list (engine.radar.rank_variables output)."""
    # TODO(app)
    raise NotImplementedError("ranking")


def clusters_geojson() -> dict:
    """clusters.parquet as GeoJSON squares with cluster + cluster_name."""
    # TODO(app)
    raise NotImplementedError("clusters")


@lru_cache
def graph() -> dict:
    """graph.json as is (networkx node-link format)."""
    # TODO(app): json.loads((RESULTS_DIR / GRAPH_FILE).read_text())
    raise NotImplementedError("graph.json")
