from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

ROOT = Path(__file__).resolve().parents[1]
if load_dotenv is not None:
    load_dotenv(ROOT / ".env", override=False)

@dataclass(frozen=True)
class BBox:
    west: float
    south: float
    east: float
    north: float

    def as_tuple(self) -> tuple[float, float, float, float]:
        return (self.west, self.south, self.east, self.north)

    def contains(self, other: "BBox") -> bool:
        return (self.west <= other.west and self.east >= other.east
                and self.south <= other.south and self.north >= other.north)

    def is_valid(self) -> bool:
        return self.west < self.east and self.south < self.north


REGION_ID = "mediterranean_north_africa"
REGION_NAME = "Mediterranean + North Africa"
REGION = BBox(west=-10.0, south=25.0, east=40.0, north=47.0)

GRID_RES = 1.0
LATS = np.arange(REGION.south + GRID_RES / 2, REGION.north, GRID_RES)
LONS = np.arange(REGION.west + GRID_RES / 2, REGION.east, GRID_RES)


def cell_id(lat: float, lon: float) -> str:
    return f"lat{lat:.1f}_lon{lon:.1f}"


PERIOD_START = "2001-01"
PERIOD_END = "2024-12"

FDR_Q = 0.10
MIN_VALID_FRACTION = 0.8
MIN_YEARS_WARN = 15
MIN_YEARS = 10
MIN_CELLS = 10
BIN_MIN_FRACTION = 0.5

DATA = ROOT / "data"
RAW = DATA / "raw"
SMALL = DATA / "small"
PROCESSED = DATA / "processed"
CACHE = DATA / "cache"
GRAPH_DIR = DATA / "graph"

SERIES_NC = PROCESSED / "series.nc"
TRENDS_PARQUET = PROCESSED / "trends.parquet"
REGIONAL_JSON = PROCESSED / "regional.json"
CLUSTERS_PARQUET = PROCESSED / "clusters.parquet"
CLUSTERS_JSON = PROCESSED / "clusters.json"
FINDINGS_JSON = PROCESSED / "findings.json"
GRAPH_JSON = GRAPH_DIR / "graph.json"
BUILD_LOG = GRAPH_DIR / "curator_build_log.jsonl"
INVESTIGATIONS = DATA / "investigations"

def _writable(path: Path) -> Path:
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".write_test"
        probe.touch()
        probe.unlink()
        return path
    except OSError:
        import tempfile
        alt = Path(tempfile.gettempdir()) / "earthsleuth" / path.name
        alt.mkdir(parents=True, exist_ok=True)
        return alt


CACHE = _writable(CACHE)
INVESTIGATIONS = _writable(INVESTIGATIONS)
for _d in (RAW, SMALL, PROCESSED, GRAPH_DIR):
    try:
        _d.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass

NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://127.0.0.1:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE") or None

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "").strip()

EARTHDATA_USERNAME = os.getenv("EARTHDATA_USERNAME", "")
EARTHDATA_PASSWORD = os.getenv("EARTHDATA_PASSWORD", "")

CMR_URL = "https://cmr.earthdata.nasa.gov/search"
HTTP_TIMEOUT = 30


from common.variables import SUBREGIONS as _SUBREGIONS

DATA_DIR = DATA
RAW_DIR = RAW
PROCESSED_DIR = PROCESSED
FAKE_DIR = DATA / "fake"

USE_FAKE = os.getenv("EARTHSLEUTH_FAKE", "0") == "1"
RESULTS_DIR = FAKE_DIR if USE_FAKE else PROCESSED_DIR

SERIES_FILE = "series.nc"
TRENDS_FILE = "trends.parquet"
REGIONAL_FILE = "regional.parquet"
REGIONAL_JSON_FILE = "regional.json"
CLUSTERS_FILE = "clusters.parquet"
FINDINGS_FILE = "findings.json"
GRAPH_FILE = "graph.json"

LON_MIN, LON_MAX = REGION.west, REGION.east
LAT_MIN, LAT_MAX = REGION.south, REGION.north
PERIOD = (PERIOD_START, PERIOD_END)
GRID_DEG = GRID_RES
ALPHA = 0.05

SUBREGIONS: dict[str, tuple[float, float, float, float]] = {
    k: (bb[0], bb[2], bb[1], bb[3]) for k, (_name, bb) in _SUBREGIONS.items()
}
REGION_LABELS: dict[str, str] = {
    REGION_ID: "Mediterranean & North Africa",
    **{k: name for k, (name, _bb) in _SUBREGIONS.items()},
}

VARIABLES = {
    "t2m": {"label": "Air temperature (2 m)", "unit": "°C", "dataset": "M2TMNXSLV", "version": "5.12.4",
            "name_in_file": "T2M"},
    "precip": {"label": "Precipitation", "unit": "mm/month", "dataset": "GPM_3IMERGM", "version": "07",
               "name_in_file": "precipitation"},
    "soil_moisture": {"label": "Soil moisture (0–10 cm)", "unit": "kg/m²", "dataset": "GLDAS_NOAH025_M",
                      "version": "2.1", "name_in_file": "SoilMoi0_10cm_inst"},
    "et": {"label": "Evapotranspiration", "unit": "mm/day", "dataset": "GLDAS_NOAH025_M", "version": "2.1",
           "name_in_file": "Evap_tavg"},
    "ndvi": {"label": "Vegetation (NDVI)", "unit": "index (−1 to 1)", "dataset": "MOD13C2", "version": "061",
             "name_in_file": "CMG 0.05 Deg Monthly NDVI"},
}


def app_cell_id(lat: float, lon: float) -> str:
    return f"{float(lat):.1f}_{float(lon):.1f}"
