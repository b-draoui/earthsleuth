"""Tests run on the simulated data in data/fake/ (committed), so they work anywhere, CI included."""

import os

os.environ.setdefault("EARTHSLEUTH_FAKE", "1")
