"""Layer 3: the statistics engine (Doc 2, section 6).

Pure functions on one monthly series. The app imports anomalies() for the Time series
page, so it shows exactly what the engine computed.
"""

import numpy as np
import pandas as pd

from common.config import ALPHA, FDR_Q


def anomalies(s: pd.Series) -> pd.Series:
    """Remove the seasons: value minus the long-term mean of its calendar month.

    s: monthly values with a DatetimeIndex.
    """
    # TODO(ML engineer)
    raise NotImplementedError


def theil_sen(s: pd.Series) -> dict:
    """Median of all pairwise slopes, per decade, with 95% interval.

    Returns {"slope_dec": float, "ci_lo": float, "ci_hi": float}.
    """
    # TODO(ML engineer)
    raise NotImplementedError


def mann_kendall(s: pd.Series, alpha: float = ALPHA) -> dict:
    """Mann–Kendall test with the Hamed–Rao correction for autocorrelation.

    Returns {"p": float, "tau": float, "n": int}.
    """
    # TODO(ML engineer): pymannkendall.hamed_rao_modification_test
    raise NotImplementedError


def fdr(p_values: np.ndarray, q: float = FDR_Q) -> tuple[np.ndarray, np.ndarray]:
    """Benjamini–Hochberg across all cells of one variable.

    Returns (q_values, significant_mask).
    """
    # TODO(ML engineer): statsmodels.stats.multitest.multipletests(method="fdr_bh")
    raise NotImplementedError


def regional_series(series: pd.DataFrame, lats: np.ndarray) -> pd.Series:
    """Cos-latitude weighted mean of land cells -> one regional monthly series."""
    # TODO(ML engineer)
    raise NotImplementedError
