"""The knowledge + evidence graph for the Graph explorer (read from graph.json, not Neo4j,
so the public app never depends on a database that can pause)."""

from fastapi import APIRouter

from api import data_access as da

router = APIRouter(tags=["graph"])


@router.get("/graph")
def graph() -> dict:
    return da.graph()
