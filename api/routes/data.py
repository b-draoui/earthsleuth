from fastapi import APIRouter, HTTPException, Request, Response

from api import data_access as da
from api.schemas import VariableResult
from common.config import REGION_ID, SUBREGIONS, VARIABLES

router = APIRouter(tags=["data"])


def _check(variable: str, region: str | None = None) -> None:
    if variable not in VARIABLES:
        raise HTTPException(404, f"unknown variable {variable!r}, expected one of {list(VARIABLES)}")
    if region is not None and region != REGION_ID and region not in SUBREGIONS:
        raise HTTPException(404, f"unknown region {region!r}")


@router.get("/trends/{variable}")
def trends(variable: str, request: Request) -> Response:
    _check(variable)
    gz = "gzip" in request.headers.get("accept-encoding", "")
    headers = {"Cache-Control": "public, max-age=600", "Vary": "Accept-Encoding"}
    if gz:
        headers["Content-Encoding"] = "gzip"
    return Response(da.trends_payload(variable, gzipped=gz), media_type="application/json", headers=headers)


@router.get("/regional/{variable}")
def regional(variable: str, region: str = REGION_ID) -> VariableResult:
    _check(variable, region)
    return da.regional(variable, region)


@router.get("/regional/{variable}/all")
def regional_all(variable: str) -> list[dict]:
    _check(variable)
    return da.regional_all(variable)


@router.get("/regional/{variable}/series")
def regional_series(variable: str, region: str = REGION_ID) -> dict:
    _check(variable, region)
    return da.regional_series(variable, region)


@router.get("/series/{variable}/{cell_id}")
def series(variable: str, cell_id: str) -> dict:
    _check(variable)
    try:
        return da.series(variable, cell_id)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.get("/radar/ranking")
def ranking() -> list[dict]:
    return da.ranking()


@router.get("/radar/clusters")
def clusters() -> dict:
    return da.clusters_geojson()


@router.get("/cells")
def cells(response: Response) -> dict:
    response.headers["Cache-Control"] = "public, max-age=600"
    return da.cells_matrix()


@router.get("/summary")
def summary() -> dict:
    return da.summary()
