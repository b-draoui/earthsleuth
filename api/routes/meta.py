"""Health check and the list of variables (ids, labels, units)."""

from fastapi import APIRouter

from api.schemas import Variable
from common.config import USE_FAKE, VARIABLES

router = APIRouter(tags=["meta"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "fake_data": USE_FAKE}


@router.get("/variables")
def variables() -> list[Variable]:
    return [
        Variable(id=vid, label=v["label"], unit=v["unit"], dataset=v["dataset"], version=v["version"])
        for vid, v in VARIABLES.items()
    ]
