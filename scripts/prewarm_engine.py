"""Fill the engine's on-demand cache (data/cache) for the full period, every variable and every
region of the graph, so the investigator answers in under a second on a small server.

Run once after `python run.py precompute` (the Docker image runs it at build time):
    python -m scripts.prewarm_engine
"""

import logging
import time

from common import config as C


def main() -> None:
    from agent.agent import _store
    from engine.analysis import Area, TrendEngine
    from engine.findings import analyse_area
    from graph import queries as Q

    store = _store()
    engine = TrendEngine()
    variables = engine.variables
    period = [C.PERIOD_START, C.PERIOD_END]
    t0 = time.perf_counter()
    for r in Q.regions(store):
        area = Area(r["code_id"], r["name"], r["bbox"])
        subs = [Area(s["code_id"], s["name"], s["bbox"]) for s in Q.sub_regions(store, area.id)]
        try:
            analyse_area(engine, area, variables, period, subs)
            print(f"  {r['code_id']:28s} ok ({len(subs)} sub-regions)  {time.perf_counter() - t0:6.1f} s")
        except Exception as e:  # noqa: BLE001 - a region the guardrails refuse is fine
            print(f"  {r['code_id']:28s} skipped: {e}")
    print(f"engine cache ready in {C.CACHE} ({time.perf_counter() - t0:.0f} s)")


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    main()
