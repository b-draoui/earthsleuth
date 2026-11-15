"""The AI investigator, streamed to the browser with Server-Sent Events (SSE).

Each event is one Contract 3 dict (contracts/examples/agent_event.json). In the browser:
    new EventSource("/api/investigate?q=...")   -> one "message" per step, then "end"

The investigator lives in agent/ (agent/agent.py adapts its 7 steps to the app's 5 stages).
If it cannot start (simulated data, missing package or file), api/narrator.py answers instead
and every event says so in data.narrator, so the app can show it honestly.

SSE is written by hand (StreamingResponse), so any FastAPI version works.
"""

import json
import logging
from collections.abc import Callable, Iterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from api import narrator

router = APIRouter(tags=["agent"])
log = logging.getLogger(__name__)
SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def _with_fallback(real: Callable[[], Iterator[dict]], fallback: Callable[[], Iterator[dict]]) -> Iterator[dict]:
    """Use the real investigator if it produces a first event, else the rule-based narrator."""
    try:
        events = iter(real())
        first = next(events)
    except (NotImplementedError, ImportError, StopIteration, FileNotFoundError, KeyError) as e:
        log.info("investigator unavailable (%r): narrator answers", e)
        yield from fallback()
        return
    yield first
    yield from events


def _sse(data: dict, event: str | None = None) -> str:
    head = f"event: {event}\n" if event else ""
    return f"{head}data: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def _stream(start: Callable[[], Iterator[dict]]) -> StreamingResponse:
    """Agent events -> SSE. Any crash becomes an "error" event, so the page never hangs."""

    def gen() -> Iterator[str]:
        try:
            for event in start():
                yield _sse(event)
        except Exception as exc:  # noqa: BLE001
            log.exception("investigation failed")
            yield _sse({"stage": "explain", "status": "error", "message": f"The investigation stopped: {exc!r}", "data": {}})
        yield _sse({}, event="end")

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


def _real_run(question: str) -> Iterator[dict]:
    from agent.agent import run_investigation

    return run_investigation(question)


def _real_replay(demo_id: str) -> Iterator[dict]:
    from agent.agent import replay_demo

    return replay_demo(demo_id)


def _recorded() -> list[dict]:
    try:
        from agent.agent import list_demos

        return list_demos()
    except Exception:  # noqa: BLE001 - no recorded investigations: only the narrator's demos
        return []


@router.get("/investigate")
def investigate(q: str) -> StreamingResponse:
    """Run a live investigation."""
    question = q.strip()[:500]
    return _stream(lambda: _with_fallback(lambda: _real_run(question), lambda: narrator.investigate(question, pace=0.35)))


@router.get("/demos")
def demos() -> list[dict]:
    """Recorded investigations first (real runs of the investigator), then the narrator's demos."""
    recorded = [{"id": d["id"], "question": d["question"], "recorded": d.get("recorded", "")} for d in _recorded()]
    return recorded + [{"id": i, "question": q} for i, q in narrator.DEMOS.items()]


@router.get("/demos/{demo_id}")
def replay(demo_id: str) -> StreamingResponse:
    """Replay an investigation step by step (works with no API key, no internet)."""
    if demo_id in narrator.DEMOS:
        return _stream(lambda: narrator.demo(demo_id))
    # unknown ids end as an "error" event + "end", like any failure, so the page never hangs
    return _stream(lambda: _real_replay(demo_id))
