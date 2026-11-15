from fastapi import APIRouter

from api import data_access as da

router = APIRouter(tags=["graph"])


@router.get("/graph")
def graph() -> dict:
    return da.graph()
