"""Layer 4: Radar-lite, automatic discovery (Doc 2, section 7).

Clusters only say "these places changed in a similar way".
Whether each trend is real is decided by stats.py.
"""

import pandas as pd


def rank_variables(trends: pd.DataFrame) -> pd.DataFrame:
    """% of land area (cos-lat weighted) with a significant trend, split up / down, per variable."""
    # TODO(ML engineer)
    raise NotImplementedError


def opposite_trend_map(trends: pd.DataFrame, variable: str) -> pd.DataFrame:
    """Each cell -> up / down / none, plus a flag when big up and down patches coexist."""
    # TODO(ML engineer)
    raise NotImplementedError


def cluster_cells(trends: pd.DataFrame) -> pd.DataFrame:
    """k-means on standardised slopes (k = 3..6, best silhouette) -> clusters.parquet format."""
    # TODO(ML engineer): code sketch in Doc 2, 7.3
    raise NotImplementedError
