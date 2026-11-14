"""Write fake result files with the exact contract formats into data/fake/.

Lets the app, agent and graph be built before the real data exists.
Run from the repo root:
    python -m scripts.make_fake_data

Useful fakes (Doc 2, 6.1): known slope + seasonal cycle + noise, so the real engine can
also be tested on them. Make the north wetter and the south drier for precip, so the
opposite-trend map has something to show.
"""

from common.config import FAKE_DIR, VARIABLES


def main() -> None:
    # TODO(integration): series.nc, trends.parquet, regional.parquet, clusters.parquet,
    #   findings.json, graph.json (can start as a copy of contracts/examples/)
    raise NotImplementedError(f"write fakes for {list(VARIABLES)} into {FAKE_DIR}")


if __name__ == "__main__":
    main()
