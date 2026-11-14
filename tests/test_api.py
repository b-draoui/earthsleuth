"""Smoke tests for the FastAPI server."""

from fastapi.testclient import TestClient

from api.main import app
from common.config import VARIABLES

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_variables_match_config():
    r = client.get("/api/variables")
    assert r.status_code == 200
    assert [v["id"] for v in r.json()] == list(VARIABLES)


def test_stub_returns_501_not_500():
    r = client.get("/api/graph")
    assert r.status_code in (200, 501)


def test_agent_stream_always_ends():
    """Even if the agent crashes, the browser gets an event and then "end"."""
    r = client.get("/api/demos/does-not-exist")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    assert "event: end" in r.text
