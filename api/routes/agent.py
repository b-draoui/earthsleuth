"""The AI investigator, streamed to the browser with Server-Sent Events (SSE).

Each event is one Contract 3 dict (contracts/examples/agent_event.json). In the browser:
    new EventSource("/api/investigate?q=...")   -> one "message" per step, then "end"

The agent itself (LangGraph) lives in agent/agent.py and is owned by the AI engineer.
While it is not connected (stub or import error), api/narrator.py answers instead and every
event says so in data.narrator, so the app can show it honestly.
"""

from collections.abc import Callable, Iterator

from fastapi import APIRouter
from fastapi.sse import EventSourceResponse, ServerSentEvent

from api import narrator

router = APIRouter(tags=["agent"])


def _with_fallback(real: Callable[[], Iterator[dict]], fallback: Callable[[], Iterator[dict]]) -> Iterator[dict]:
    """Use the real agent if it produces a first event, else the rule-based narrator."""
    try:
        events = iter(real())
        first = next(events)
    except (NotImplementedError, ImportError, StopIteration):
        yield from fallback()
        return
    yield first
    yield from events


def _stream(start: Callable[[], Iterator[dict]]) -> Iterator[ServerSentEvent]:
    """Agent events -> SSE. Any crash becomes an "error" event, so the page never hangs."""
    try:
        for event in start():
            yield ServerSentEvent(data=event)
    except Exception as exc:  # noqa: BLE001
        yield ServerSentEvent(data={"stage": "explain", "status": "error", "message": repr(exc), "data": {}})
    yield ServerSentEvent(event="end", data={})


def _real_run(question: str) -> Iterator[dict]:
    from agent.agent import run_investigation

    return run_investigation(question)


def _real_replay(demo_id: str) -> Iterator[dict]:
    from agent.agent import replay_demo

    return replay_demo(demo_id)


@router.get("/investigate", response_class=EventSourceResponse)
def investigate(q: str) -> Iterator[ServerSentEvent]:
    """Run a live investigation. TODO(app): per-visitor question limit (MAX_QUESTIONS_PER_SESSION)."""
    question = q.strip()[:500]
    yield from _stream(lambda: _with_fallback(lambda: _real_run(question),
                                              lambda: narrator.investigate(question, pace=0.35)))


@router.get("/demos")
def demos() -> list[dict]:
    """Cached demo investigations: the agent's cache when it exists, else the narrator's."""
    try:
        from agent.agent import list_demos

        ids = list_demos()
    except (NotImplementedError, ImportError):
        ids = []
    if ids:
        return [{"id": i, "question": i.replace("-", " ").capitalize()} for i in ids]
    return [{"id": i, "question": q} for i, q in narrator.DEMOS.items()]


@router.get("/demos/{demo_id}", response_class=EventSourceResponse)
def replay(demo_id: str) -> Iterator[ServerSentEvent]:
    """Replay a demo investigation step by step (works with no API key, no internet)."""
    if demo_id in narrator.DEMOS:
        yield from _stream(lambda: _with_fallback(lambda: _real_replay(demo_id), lambda: narrator.demo(demo_id)))
        return
    yield from _stream(lambda: _real_replay(demo_id))

