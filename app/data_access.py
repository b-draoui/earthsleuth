"""The only place where the app reads result files or calls the agent.

Pages import from here, never from engine/ or agent/ directly. If a teammate changes a
file format, only this file needs fixing. Formats: contracts/README.md.
"""

import sys
from collections.abc import Iterator
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))  # lets the app import common/, engine/, agent/

import pandas as pd  # noqa: E402

from common.config import RESULTS_DIR, VARIABLES  # noqa: E402,F401


def load_trends() -> pd.DataFrame:
    """trends.parquet as a DataFrame."""
    # TODO(app): read RESULTS_DIR / TRENDS_FILE, cache it with @st.cache_data
    raise NotImplementedError


def load_regional() -> pd.DataFrame:
    """regional.parquet as a DataFrame."""
    # TODO(app)
    raise NotImplementedError


def load_clusters() -> pd.DataFrame:
    """clusters.parquet as a DataFrame."""
    # TODO(app)
    raise NotImplementedError


def get_series(variable: str, cell_id: str) -> pd.DataFrame:
    """Monthly series of one cell: columns time, value, anomaly.

    Use engine.stats.anomalies() so the app shows exactly what the engine computed.
    """
    # TODO(app): open series.nc with xarray, select the cell
    raise NotImplementedError


def load_graph():
    """graph.json as a networkx graph."""
    # TODO(app)
    raise NotImplementedError


def run_investigation(question: str) -> Iterator[dict]:
    """Agent progress events (Contract 3), one by one."""
    from agent.agent import run_investigation as _run

    return _run(question)


def list_demos() -> list[str]:
    from agent.agent import list_demos as _list

    return _list()


def replay_demo(demo_id: str) -> Iterator[dict]:
    from agent.agent import replay_demo as _replay

    return _replay(demo_id)
