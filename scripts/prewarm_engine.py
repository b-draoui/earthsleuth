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
        except Exception as e:
            print(f"  {r['code_id']:28s} skipped: {e}")
    print(f"engine cache ready in {C.CACHE} ({time.perf_counter() - t0:.0f} s)")


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    main()
