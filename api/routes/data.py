"""Trends, regional results, time series and Signal Radar."""

from fastapi import APIRouter

from api import data_access as da
from api.schemas import VariableResult
from common.config import REGION_ID

router = APIRouter(tags=["data"])


@router.get("/trends/{variable}")
def trends(variable: str) -> dict:
    """GeoJSON of all land cells for the Trend map."""
    return da.trends_geojson(variable)


@router.get("/regional/{variable}")
def regional(variable: str, region: str = REGION_ID) -> VariableResult:
    return da.regional(variable, region)


@router.get("/series/{variable}/{cell_id}")
def series(variable: str, cell_id: str) -> dict:
    """Raw + anomaly series of one cell, for the Time series panel."""
    return da.series(variable, cell_id)


@router.get("/radar/ranking")
def ranking() -> list[dict]:
    return da.ranking()


@router.get("/radar/clusters")
def clusters() -> dict:
    return da.clusters_geojson()
