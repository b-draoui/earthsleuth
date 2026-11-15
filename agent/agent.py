"""Bridge between the AI investigator (agent/investigator.py) and the web app.

The web app (api/routes/agent.py) only calls the three functions below. Each yields Contract 3
events, one per step, so the browser can show the investigation live:

    {"stage": "understand" | "plan" | "analyse" | "check" | "explain",
     "status": "running" | "done" | "error", "message": str, "data": {...}}

The investigator has 7 steps; the app shows 5 stages:
    Understand -> understand, Plan -> plan, Analyse + Record -> analyse,
    Why? + Check -> check, Explain -> explain.

Where it runs:
- with GEMINI_API_KEY (Chedi's computer): the full investigator, Gemini for steps 1 and 7;
- without a key (the public site): the same investigator with rules and templates for steps 1 and 7.
  Every number still comes from the statistics engine.
Graph: Neo4j when NEO4J_PASSWORD is set and the database answers, else data/graph/graph.json in
memory (written back only with EARTHSLEUTH_SAVE_GRAPH=1, so visitors never change the file).
"""

from __future__ import annotations

import json
import logging
import math
import os
import queue
import threading
import time
from collections.abc import Iterator
from pathlib import Path

from common import config as C

log = logging.getLogger(__name__)

STAGE = {
    "Understand": "understand",
    "Plan": "plan",
    "Analyse": "analyse",
    "Record": "analyse",
    "Why?": "check",
    "Check": "check",
    "Explain": "explain",
}
RUNNING = {
    "Understand": "Reading the question and matching it to the knowledge graph…",
    "Plan": "Walking the graph: concepts → variables → datasets → methods…",
    "Analyse": "Running the statistics on 24 years of monthly NASA data…",
    "Record": "Writing the findings into the graph…",
    "Why?": "Looking for published mechanisms and possible explanations…",
    "Check": "Checking every number in the answer against the tool outputs…",
    "Explain": "Writing the answer…",
}
FULL_PERIOD = [C.PERIOD_START, C.PERIOD_END]

_lock = threading.Lock()  # one investigation at a time (CPU and the in-memory graph)
_investigator = None


# ---------------------------------------------------------------- small helpers
def _num(x, digits: int = 3) -> str:
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return "n/a"
    x = float(x)
    return "0" if x == 0 else f"{x:+.{digits}g}"


def _p(p) -> str:
    if p is None:
        return "p n/a"
    return "p < 0.001" if p < 0.001 else f"p = {p:.3g}"


def _bbox(region: str):
    if region == C.REGION_ID:
        return [C.LON_MIN, C.LON_MAX, C.LAT_MIN, C.LAT_MAX]
    b = C.SUBREGIONS.get(region)
    return list(b) if b else None


def app_result(r: dict) -> dict:
    """Engine Contract 2 (common/contracts.py) -> the shape the web app draws."""
    v = r["variable"]
    reg, cells = r.get("regional", {}), r.get("cells", {})
    return {
        "variable": v,
        "unit": C.VARIABLES.get(v, {}).get("unit", r.get("unit", "")),
        "region": r.get("region"),
        "label": C.REGION_LABELS.get(r.get("region"), r.get("region")),
        "bbox": _bbox(r.get("region")),
        "period": r.get("period"),
        "regional": {
            "slope_per_decade": reg.get("slope_per_decade"),
            "ci95": reg.get("ci95") or [None, None],
            "p": reg.get("p"),
            "significant": bool(reg.get("significant")),
        },
        "cells": {
            "n": cells.get("n", 0),
            "sig_up": cells.get("sig_up", 0),
            "sig_down": cells.get("sig_down", 0),
            "pct_sig_area": cells.get("pct_sig_area", 0),
        },
        "method": r.get("method", ""),
        "datasets": r.get("datasets", []),
        "run_id": r.get("run_id", ""),
        "warnings": r.get("warnings", []),
    }


def _result_sentence(r: dict) -> str:
    v = r["variable"]
    label = C.VARIABLES.get(v, {}).get("label", v)
    unit = C.VARIABLES.get(v, {}).get("unit", "")
    reg = r["regional"]
    ci = reg.get("ci95") or [None, None]
    verdict = "significant" if reg.get("significant") else "could be chance"
    return (f"{label}: {_num(reg.get('slope_per_decade'))} {unit} per decade over "
            f"{C.REGION_LABELS.get(r['region'], r['region'])} (95% range {_num(ci[0])} to {_num(ci[1])}), "
            f"{verdict}, {_p(reg.get('p'))}.")


class EventMapper:
    """Investigator steps (name, status, payload) -> Contract 3 events for the app."""

    def __init__(self, offline: bool, replay: str | None = None):
        self.offline = offline
        self.replay = replay
        self.results: list[dict] = []
        self.literature: list[dict] = []
        self.hypotheses: list[dict] = []
        self.region = C.REGION_ID

    def _event(self, step: str, status: str, message: str, **data) -> dict:
        if self.offline:
            data.setdefault("narrator", "investigator in offline mode (no AI key: rules and templates, same statistics)")
        if self.replay:
            data.setdefault("replay", self.replay)
        return {"stage": STAGE.get(step, "explain"), "status": status, "message": message, "data": data}

    def map(self, step: str, status: str, payload: dict) -> list[dict]:
        if status == "running":
            return [self._event(step, "running", RUNNING.get(step, f"{step}…"))]
        p = payload or {}
        if step == "Understand":
            concepts = ", ".join(c.get("name", "?") for c in p.get("concepts", [])) or "nothing we can measure"
            self.region = p.get("region") or C.REGION_ID
            period = p.get("period") or FULL_PERIOD
            return [self._event(step, "done", f"Concepts: {concepts}. Region: {p.get('region_name', self.region)}, "
                                f"{period[0]} to {period[1]} · {p.get('method', 'rules')}.",
                                region=self.region, concepts=[c.get("id") for c in p.get("concepts", [])])]
        if step == "Plan":
            names = [C.VARIABLES.get(v, {}).get("label", v) for v in p.get("variables", [])]
            msg = f"Plan from the graph: {', '.join(names) or 'no variable'}."
            if p.get("warnings"):
                msg += " " + " ".join(p["warnings"])
            return [self._event(step, "done", msg, variables=p.get("variables", []), region=p.get("region"))]
        if step == "Analyse":
            out = []
            for r in (p.get("results") or {}).values():
                res = app_result(r)
                self.results.append(res)
                out.append(self._event(step, "done", _result_sentence(res), variable=res["variable"], result=res))
            for v, err in (p.get("errors") or {}).items():
                out.append(self._event(step, "done", f"{C.VARIABLES.get(v, {}).get('label', v)}: {err}"))
            if not out:
                out.append(self._event(step, "done", "No result."))
            return out
        if step == "Record":
            n = len(p.get("findings", []))
            return [self._event(step, "done", f"{n} findings recorded in the graph, with their provenance.")]
        if step == "Why?":
            self.literature = p.get("literature", [])
            self.hypotheses = p.get("hypotheses", [])
            return [self._event(step, "done", f"{len(self.literature)} published mechanism(s), "
                                f"{len(self.hypotheses)} hypothesis(es), labelled as unproven.")]
        if step == "Check":
            mode = "Gemini" if p.get("mode") == "gemini" else "the template"
            if p.get("passed"):
                msg = f"Number check passed: every number in the answer ({mode}) appears in the tool outputs."
            else:
                msg = f"Number check: {', '.join(p.get('unknown_numbers', [])) or 'see report'} not found; answer kept from {mode}."
            return [self._event(step, "done", msg, check=p)]
        if step == "Explain":
            return [self._event(step, "done", "Answer ready.", answer_md=p.get("answer", ""), evidence=self.evidence())]
        return [self._event(step, "done", step)]

    def evidence(self) -> list[dict]:
        ev = []
        for r in self.results:
            ev.append({"kind": "observed", "text": _result_sentence(r),
                       "source": f"{', '.join(r['datasets'])} · run {r['run_id']}"})
        for m in self.literature:
            ev.append({"kind": "literature", "text": f"“{m.get('quote', '')}”",
                       "source": f"{m.get('paper_title', 'paper')} ({m.get('paper_year', '?')})"})
        for h in self.hypotheses:
            ev.append({"kind": "hypothesis", "text": h.get("text", ""),
                       "source": f"graph pattern {h.get('pattern', '')} · not proven"})
        return ev


# ---------------------------------------------------------------- the investigator
def _store():
    from graph.store import JsonStore, Neo4jStore

    if C.NEO4J_PASSWORD:
        try:
            return Neo4jStore()
        except Exception as e:  # noqa: BLE001 - any connection problem: use the snapshot
            log.warning("Neo4j not reachable (%s): using graph.json", e.__class__.__name__)
    return JsonStore(C.GRAPH_JSON, autosave=os.getenv("EARTHSLEUTH_SAVE_GRAPH", "0") == "1")


def investigator():
    global _investigator
    if _investigator is None:
        from agent.investigator import Investigator

        _investigator = Investigator(store=_store())
    return _investigator


def run_investigation(question: str) -> Iterator[dict]:
    """Run the 7 steps in a worker thread and stream their events as they happen."""
    if C.USE_FAKE:
        # the investigator needs the real series.nc; with simulated data the app's narrator answers
        raise NotImplementedError("investigator runs on real data only")
    inv = investigator()
    mapper = EventMapper(offline=not inv.use_llm)
    q: queue.Queue = queue.Queue()
    DONE = object()

    def on_step(step: str, status: str, payload: dict):
        for e in mapper.map(step, status, payload):
            q.put(e)

    def work():
        try:
            with _lock:
                inv.run(question, on_step=on_step)
        except Exception as e:  # noqa: BLE001 - guardrails and crashes become a readable error
            from engine.analysis import GuardrailError

            msg = str(e) if isinstance(e, GuardrailError) else f"The investigation stopped: {e!r}"
            q.put({"stage": "explain", "status": "error", "message": msg, "data": {}})
        finally:
            q.put(DONE)

    threading.Thread(target=work, daemon=True).start()
    while True:
        e = q.get()
        if e is DONE:
            return
        yield e


def check_numbers(answer: str, tool_outputs: list[dict]) -> bool:
    """True if every number in the answer appears in the tool outputs (the investigator's own check)."""
    from agent.investigator import number_check

    return not number_check(answer, json.dumps(tool_outputs, ensure_ascii=False))


# ---------------------------------------------------------------- recorded investigations (demos)
def _reports() -> list[Path]:
    folder = C.INVESTIGATIONS
    committed = C.DATA / "investigations"
    files = {p.name: p for p in committed.glob("*.json")} if committed.exists() else {}
    files.update({p.name: p for p in folder.glob("*.json")})
    return sorted(files.values(), key=lambda p: p.name)


def _load(path: Path) -> dict | None:
    try:
        r = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    # demos = finished runs of the AI investigator on real data (visitors' offline runs are not listed)
    if r.get("status") != "done" or r.get("synthetic") or not r.get("llm_used"):
        return None
    return r


def list_demos() -> list[dict]:
    """Recorded investigations (data/investigations/*.json), newest questions first."""
    out = []
    for p in _reports():
        r = _load(p)
        if r:
            out.append({"id": p.stem, "question": r["question"], "recorded": r.get("created", ""),
                        "ai": bool(r.get("llm_used"))})
    return out


def replay_demo(demo_id: str, pace: float = 0.45) -> Iterator[dict]:
    """Replay a recorded investigation step by step: no internet, no key, same events as live."""
    path = next((p for p in _reports() if p.stem == demo_id), None)
    r = _load(path) if path else None
    if r is None:
        raise KeyError(demo_id)
    when = (r.get("created") or "")[:16].replace("T", " ")
    who = "the AI investigator (Gemini), number check passed" if r.get("llm_used") else "the investigator"
    mapper = EventMapper(offline=False, replay=f"recorded on {when} UTC by {who}")
    steps = r.get("steps", {})
    for step in ("Understand", "Plan", "Analyse", "Record", "Why?", "Check", "Explain"):
        if step not in steps and step != "Explain":
            continue
        for e in mapper.map(step, "running", {}):
            yield e
        time.sleep(pace)
        payload = {"answer": r.get("answer", "")} if step == "Explain" else steps[step]
        yield from mapper.map(step, "done", payload)
        time.sleep(pace * 0.6)
