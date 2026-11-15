import numpy as np
import pandas as pd

from engine import stats

MONTHS = np.tile(np.arange(1, 13), 24)
T_YEARS = np.arange(288) / 12.0
SEASONS = 8 * np.sin(2 * np.pi * (MONTHS - 4) / 12)


def test_anomalies_remove_the_seasons():
    a = stats.anomalies(SEASONS + 3.0, MONTHS)
    assert np.allclose(a, 0.0)


def test_theil_sen_recovers_known_slope():
    rng = np.random.default_rng(1)
    slope_dec = 0.45
    y = 15 + SEASONS + slope_dec / 10 * T_YEARS + rng.normal(0, 0.6, 288)
    r = stats.trend(y, MONTHS, T_YEARS)
    assert r is not None
    assert abs(r["slope_dec"] - slope_dec) < 0.08
    assert r["ci_lo"] < slope_dec < r["ci_hi"]
    assert r["p"] < 0.001


def test_noise_false_positive_rate():
    rng = np.random.default_rng(7)
    rows = []
    for k in range(300):
        r = stats.trend(10 + SEASONS + rng.normal(0, 1, 288), MONTHS, T_YEARS)
        rows.append({"cell_id": f"c{k}", "lat": 35.0, "lon": float(k), **r})
    df = stats.add_fdr(pd.DataFrame(rows))
    raw_rate = float((df["p"] < 0.05).mean())
    assert raw_rate < 0.12
    assert int(df["significant"].sum()) <= 9


def test_too_many_missing_months_gives_no_trend():
    y = 15 + SEASONS.copy()
    y[:100] = np.nan
    assert stats.trend(y, MONTHS, T_YEARS) is None
