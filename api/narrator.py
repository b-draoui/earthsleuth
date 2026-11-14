"""Rule-based narrator: the app's honest stand-in while the LangGraph agent is not connected.

It follows the same five stages as the agent (Contract 3) and only says what the result files
say. Every number is read from them; explanations are labelled observed / hypothesis, and it
says plainly when the data cannot answer "why". When agent.agent.run_investigation() works,
the API uses it instead (api/routes/agent.py).
"""

import re
import time
from collections.abc import Iterator

from api import data_access as da
from common.config import PERIOD, REGION_ID, REGION_LABELS, VARIABLES

NARRATOR = "rule-based narrator (LLM agent not connected yet)"

DEMOS = {
    "heat-and-water": "Where is it getting hotter while water becomes scarcer?",
    "rain-divide": "Is rainfall changing the same way everywhere?",
    "green-or-brown": "Is vegetation greening or browning, and where?",
}

KEYWORDS = {
    "t2m": ["heat", "hot", "warm", "temperat", "cool", "cold"],
    "precip": ["rain", "precip", "wet", "drought", "dry", "drier", "water", "storm"],
    "soil_moisture": ["soil", "drought", "dry", "drier", "drying", "water", "moist"],
    "et": ["evapo", "evaporat", "transpir", "water cycle", " et "],
    "ndvi": ["vegetat", "green", "brown", "plant", "crop", "forest", "ndvi", "farm"],
}

PLACES = {
    "iberia": ["spain", "portugal", "iberia"],
    "maghreb": ["morocco", "algeria", "tunisia", "maghreb"],
    "sahara": ["sahara", "desert", "libya"],
    "nile_delta": ["egypt", "nile", "delta"],
    "levant": ["lebanon", "syria", "israel", "palestin", "jordan", "levant"],
    "anatolia": ["turkey", "türkiye", "anatolia"],
    "italy_balkans": ["italy", "greece", "balkan", "croatia", "albania"],
}

WORDS = {
    "t2m": ("warming", "cooling"),
    "precip": ("wetter", "drier"),
    "soil_moisture": ("moister soils", "drying soils"),
    "et": ("more evaporation", "less evaporation"),
    "ndvi": ("greening", "browning"),
}


def fmt(x: float, unit: str) -> str:
    digits = 3 if abs(x) < 0.05 else 2
    return f"{x:+.{digits}f} {unit}"


def fmt_p(p: float) -> str:
    return "p < 0.001" if p < 0.001 else f"p = {p:.3f}"


def understand(question: str) -> tuple[list[str], str]:
    q = f" {question.lower()} "
    variables = [v for v, keys in KEYWORDS.items() if any(k in q for k in keys)]
    region = next((rid for rid, keys in PLACES.items() if any(re.search(rf"\b{k}", q) for k in keys)), REGION_ID)
    return (variables or list(VARIABLES)), region


def event(stage: str, status: str, message: str, **data) -> dict:
    return {"stage": stage, "status": status, "message": message, "data": {"narrator": NARRATOR, **data}}


def describe(variable: str, region: str) -> tuple[str, dict]:
    """One sentence with the regional trend, its uncertainty and the share of area that changes."""
    res = da.regional(variable, region)
    reg, cells = res["regional"], res["cells"]
    unit = f"{res['unit']} per decade"
    label = VARIABLES[variable]["label"]
    slope = reg["slope_per_decade"]
    verdict = "statistically significant" if reg["significant"] else "not statistically significant (could be chance)"
    sentence = (
        f"**{label}**: {fmt(slope, unit)} on average over {REGION_LABELS[region]} "
        f"(95% interval {reg['ci95'][0]:+.3g} to {reg['ci95'][1]:+.3g}), {verdict}, {fmt_p(reg['p'])}. "
        f"{cells['pct_sig_area']:.0f}% of the area has a significant local trend "
        f"({cells['sig_up']} cells up, {cells['sig_down']} down, after FDR)."
    )
    return sentence, res


def investigate(question: str, pace: float = 0.0) -> Iterator[dict]:
    def wait(k: float = 1.0):
        if pace:
            time.sleep(pace * k)

    variables, region = understand(question)
    names = ", ".join(VARIABLES[v]["label"].lower() for v in variables)
    yield event("understand", "running", "Reading the question…")
    wait(0.8)
    yield event("understand", "done", f"The question is about {names} over {REGION_LABELS[region]}.",
                variables=variables, region=region)
    wait()
    spec = {
        "question": question,
        "variables": variables,
        "region": region,
        "period": list(PERIOD),
        "outputs": ["regional_trends", "local_trends", "co_occurrence", "explanation"],
    }
    yield event("plan", "done",
                f"Plan: {len(variables)} variable(s), {PERIOD[0][:4]}–{PERIOD[1][:4]}, monthly anomalies, "
                "Theil–Sen slope, Mann–Kendall test, false-discovery-rate control.", spec=spec)
    wait()

    observed, results = [], {}
    for v in variables:
        yield event("analyse", "running", f"Reading {VARIABLES[v]['label'].lower()} trends ({VARIABLES[v]['dataset']})…")
        wait(0.7)
        sentence, res = describe(v, region)
        results[v] = res
        observed.append(sentence)
        yield event("analyse", "done", sentence.replace("**", ""), variable=v, result=res)
        wait(0.5)

    links = []
    sig_dir = {v: ("up" if r["regional"]["slope_per_decade"] > 0 else "down")
               for v, r in results.items() if r["regional"]["significant"]}
    if "t2m" in sig_dir and "soil_moisture" in sig_dir:
        co = da.co_occurrence("t2m", sig_dir["t2m"], "soil_moisture", sig_dir["soil_moisture"])
        links.append(
            f"In **{co['n_cells']} cells ({co['pct_cells']}% of the land)**, air temperature and soil moisture "
            f"both have significant trends at the same place: {WORDS['t2m'][0 if sig_dir['t2m'] == 'up' else 1]} "
            f"with {WORDS['soil_moisture'][0 if sig_dir['soil_moisture'] == 'up' else 1]}."
        )
    for v in variables:
        s = next(x for x in da.summary()["variables"] if x["variable"] == v)
        if s["opposite"]:
            links.append(
                f"**{s['label']} does not change the same way everywhere**: significant rise in "
                f"{', '.join(s['opposite']['up'])}, significant fall in {', '.join(s['opposite']['down'])}."
            )

    yield event("check", "running", "Checking every number against the result files…")
    wait(0.8)
    yield event("check", "done", f"All numbers come from the trend files (run {da.run_id()}).",
                run_id=da.run_id(), simulated=da.USE_FAKE)
    wait()

    hypothesis = None
    if "t2m" in sig_dir and sig_dir["t2m"] == "up" and any(sig_dir.get(v) == "down" for v in ("soil_moisture", "precip")):
        hypothesis = ("Warmer air can pull more water out of soils and plants. That is general physics, not "
                      "something these data prove: a trend in two variables at the same place is correlation, "
                      "not cause.")
    answer = ["### What changed", *[f"- {s}" for s in observed]]
    if links:
        answer += ["", "### Where things change together", *[f"- {s}" for s in links]]
    answer += ["", "### Why?"]
    answer += [f"- *Hypothesis, not tested here:* {hypothesis}"] if hypothesis else []
    answer += ["- The data show *where* and *how much*. They cannot show *why* on their own: that needs studies "
               "of the region, which the knowledge graph does not hold yet."]
    if da.USE_FAKE:
        answer += ["", "> These numbers come from **simulated data** used to build the app. They are not real findings."]
    evidence = [{"kind": "observed", "text": s.replace("**", ""), "source": "regional.parquet + trends.parquet"}
                for s in observed]
    evidence += [{"kind": "observed", "text": s.replace("**", ""), "source": "trends.parquet"} for s in links]
    if hypothesis:
        evidence.append({"kind": "hypothesis", "text": hypothesis, "source": "general physics"})
    yield event("explain", "done", "Answer ready.", answer_md="\n".join(answer), evidence=evidence,
                variables=variables, region=region)


def demo(demo_id: str) -> Iterator[dict]:
    if demo_id not in DEMOS:
        raise KeyError(demo_id)
    yield from investigate(DEMOS[demo_id], pace=0.55)
