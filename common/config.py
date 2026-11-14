"""Settings shared by every folder. Import from here instead of retyping values.

Changing something here affects everyone: tell the team first.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

# ---------------------------------------------------------------- paths
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"  # big NASA files, ignored by Git
PROCESSED_DIR = DATA_DIR / "processed"  # real results, committed
FAKE_DIR = DATA_DIR / "fake"  # fake results with the same format

# EARTHSLEUTH_FAKE=1 -> app and agent read data/fake/ instead of data/processed/
USE_FAKE = os.getenv("EARTHSLEUTH_FAKE", "0") == "1"
RESULTS_DIR = FAKE_DIR if USE_FAKE else PROCESSED_DIR

SERIES_FILE = "series.nc"
TRENDS_FILE = "trends.parquet"
REGIONAL_FILE = "regional.parquet"
CLUSTERS_FILE = "clusters.parquet"
FINDINGS_FILE = "findings.json"
GRAPH_FILE = "graph.json"

# ---------------------------------------------------------------- study area (Doc 2, 5.1)
REGION_ID = "mediterranean_north_africa"
LON_MIN, LON_MAX = -10.0, 40.0
LAT_MIN, LAT_MAX = 25.0, 47.0
PERIOD = ("2001-01", "2024-12")  # 288 months
GRID_DEG = 1.0  # 50 x 22 = 1,100 cells, about 600 on land

# Sub-regions as boxes (lon_min, lon_max, lat_min, lat_max).
# TODO(AI engineer + ML engineer): agree on the boxes, keep the same ids in graph/seed.yaml.
SUBREGIONS: dict[str, tuple[float, float, float, float]] = {
    # "tunisia": (7.0, 12.0, 30.0, 38.0),
}

# ---------------------------------------------------------------- variables (Doc 2, 5.2)
# The keys ("t2m", "precip"...) are THE ids used in every file, JSON and page.
# Student definitions live in graph/seed.yaml (Variable nodes).
VARIABLES = {
    "t2m": {
        "label": "Air temperature (2 m)",
        "unit": "°C",
        "dataset": "M2TMNXSLV",
        "version": "5.12.4",
        "name_in_file": "T2M",
    },
    "precip": {
        "label": "Precipitation",
        "unit": "mm/month",
        "dataset": "GPM_3IMERGM",
        "version": "07",
        "name_in_file": "precipitation",
    },
    "soil_moisture": {
        "label": "Soil moisture (0–10 cm)",
        "unit": "kg/m²",
        "dataset": "GLDAS_NOAH025_M",
        "version": "2.1",
        "name_in_file": "SoilMoi0_10cm_inst",
    },
    "et": {
        "label": "Evapotranspiration",
        "unit": "mm/day",
        "dataset": "GLDAS_NOAH025_M",
        "version": "2.1",
        "name_in_file": "Evap_tavg",
    },
    "ndvi": {
        "label": "Vegetation (NDVI)",
        "unit": "index (−1 to 1)",
        "dataset": "MOD13C2",
        "version": "061",
        "name_in_file": "CMG 0.05 Deg Monthly NDVI",
    },
}

# ---------------------------------------------------------------- statistics (Doc 2, 6)
ALPHA = 0.05  # significance threshold for one test
FDR_Q = 0.10  # Benjamini–Hochberg level across cells


def cell_id(lat: float, lon: float) -> str:
    """Id of a 1° cell from its centre, e.g. (36.5, 10.5) -> "36.5_10.5"."""
    return f"{lat:.1f}_{lon:.1f}"
