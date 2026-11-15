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

    def gen() -> Iterator[str]:
        try:
            for event in start():
                yield _sse(event)
        except Exception as exc:
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
    except Exception:
        return []


@router.get("/investigate")
def investigate(q: str) -> StreamingResponse:
    question = q.strip()[:500]
    return _stream(lambda: _with_fallback(lambda: _real_run(question), lambda: narrator.investigate(question, pace=0.35)))


@router.get("/demos")
def demos() -> list[dict]:
    recorded = [{"id": d["id"], "question": d["question"], "recorded": d.get("recorded", "")} for d in _recorded()]
    return recorded + [{"id": i, "question": q} for i, q in narrator.DEMOS.items()]


@router.get("/demos/{demo_id}")
def replay(demo_id: str) -> StreamingResponse:
    if demo_id in narrator.DEMOS:
        return _stream(lambda: narrator.demo(demo_id))
    return _stream(lambda: _real_replay(demo_id))
