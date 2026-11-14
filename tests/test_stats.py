"""Tests for engine/stats.py on fake series (Doc 2, 6.1). TODO(ML engineer).

Ideas from the doc:
- a series with a known slope + seasons + noise must give back that slope
- pure noise should be significant in about 5% of cases before FDR, rarely after FDR
"""

import pytest


@pytest.mark.skip(reason="TODO(ML engineer)")
def test_theil_sen_recovers_known_slope():
    ...


@pytest.mark.skip(reason="TODO(ML engineer)")
def test_noise_false_positive_rate():
    ...
