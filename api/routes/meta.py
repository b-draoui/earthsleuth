from fastapi import APIRouter

from api import data_access as da
from common.config import PERIOD, USE_FAKE

router = APIRouter(tags=["meta"])


@router.get("/health")
def health() -> dict:
    try:
        run = da.run_id()
    except FileNotFoundError:
        run = None
    return {"status": "ok", "fake_data": USE_FAKE, "simulated": USE_FAKE, "run_id": run, "period": list(PERIOD)}


@router.get("/variables")
def variables() -> list[dict]:
    return da.variables()


@router.get("/regions")
def regions() -> list[dict]:
    return da.regions()
