"""Layer 1: turn raw NASA files into one small file, data/processed/series.nc.

For each file: open -> cut the region -> convert units -> average to 1° -> land mask.
Format of the output: contracts/README.md (series.nc).

Run from the repo root:
    python -m pipeline.preprocess
"""

from pathlib import Path

import xarray as xr

from common.config import (
    GRID_DEG,
    LAT_MAX,
    LAT_MIN,
    LON_MAX,
    LON_MIN,
    PROCESSED_DIR,
    SERIES_FILE,
    VARIABLES,
)


def preprocess_file(path: Path, variable: str) -> xr.DataArray:
    """One raw monthly file -> one 1° DataArray (lat, lon) in our units.

    Unit conversions (Doc 2, 5.2): K -> °C, mm/hr -> mm/month, kg/m²/s -> mm/day, NDVI x 0.0001.
    """
    # TODO(integration): open, subset to LON_MIN..LON_MAX / LAT_MIN..LAT_MAX,
    #   convert units, coarsen to GRID_DEG (ds.coarsen(lat=..., lon=..., boundary="trim").mean())
    raise NotImplementedError((path, variable, GRID_DEG, LON_MIN, LON_MAX, LAT_MIN, LAT_MAX))


def build_series() -> None:
    """Stack all months of all variables, apply the land mask, write series.nc."""
    # TODO(integration): land mask = cells where GLDAS has data
    raise NotImplementedError(f"write {PROCESSED_DIR / SERIES_FILE} with {list(VARIABLES)}")


if __name__ == "__main__":
    build_series()
