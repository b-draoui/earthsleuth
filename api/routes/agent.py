"""The AI investigator, streamed to the browser with Server-Sent Events (SSE).

Each event is one Contract 3 dict (contracts/examples/agent_event.json). In the browser:
    new EventSource("/api/investigate?q=...")   -> one "message" per step, then "end"

The agent itself (LangGraph) lives in agent/agent.py and is owned by the AI engineer.
"""

from collections.abc import Callable, Iterator

from fastapi import APIRouter
from fastapi.sse import EventSourceResponse, ServerSentEvent

router = APIRouter(tags=["agent"])


def _stream(start: Callable[[], Iterator[dict]]) -> Iterator[ServerSentEvent]:
    """Agent events -> SSE. Any crash (missing package, API error, stub) becomes an
    "error" event, so the page never hangs."""
    try:
        for event in start():
            yield ServerSentEvent(data=event)
    except Exception as exc:  # noqa: BLE001
        yield ServerSentEvent(data={"stage": "explain", "status": "error", "message": repr(exc), "data": {}})
    yield ServerSentEvent(event="end", data={})


def _run(question: str) -> Iterator[dict]:
    from agent.agent import run_investigation

    return run_investigation(question)


def _replay(demo_id: str) -> Iterator[dict]:
    from agent.agent import replay_demo

    return replay_demo(demo_id)


@router.get("/investigate", response_class=EventSourceResponse)
def investigate(q: str) -> Iterator[ServerSentEvent]:
    """Run a live investigation. TODO(app): per-visitor question limit (MAX_QUESTIONS_PER_SESSION)."""
    yield from _stream(lambda: _run(q))


@router.get("/demos")
def demos() -> list[str]:
    from agent.agent import list_demos

    return list_demos()


@router.get("/demos/{demo_id}", response_class=EventSourceResponse)
def replay(demo_id: str) -> Iterator[ServerSentEvent]:
    """Replay a cached investigation step by step (works with no API key, no internet)."""
    yield from _stream(lambda: _replay(demo_id))
