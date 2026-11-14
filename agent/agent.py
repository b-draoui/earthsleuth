"""Layer 5: one LLM agent with tools, shown in the app as
Understand -> Plan -> Analyse -> Check -> Explain.

The app only calls run_investigation() and replay_demo(). Both yield Contract 3 events
(contracts/examples/agent_event.json), one per step, so the app can show live progress.
API key: st.secrets / .streamlit/secrets.toml, never in the repo.
"""

from collections.abc import Iterator
from pathlib import Path

PROMPT = Path(__file__).with_name("prompt.md")
CACHE_DIR = Path(__file__).with_name("cache")


def run_investigation(question: str) -> Iterator[dict]:
    """Answer a question step by step, yielding progress events."""
    # TODO(AI engineer): tool-calling loop with tools.py, then check_numbers() before the answer
    raise NotImplementedError(question)


def check_numbers(answer: str, tool_outputs: list[dict]) -> bool:
    """True if every number in the answer appears in the tool outputs (Doc 2, 9.3)."""
    # TODO(AI engineer)
    raise NotImplementedError


def list_demos() -> list[str]:
    """Ids of the cached demo investigations (one JSON file each in cache/)."""
    return sorted(p.stem for p in CACHE_DIR.glob("*.json"))


def replay_demo(demo_id: str) -> Iterator[dict]:
    """Replay a cached investigation step by step, with no internet and no API key."""
    # TODO(AI engineer): load CACHE_DIR / f"{demo_id}.json" and yield its events
    raise NotImplementedError(demo_id)
