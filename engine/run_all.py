"""Run the stats engine and Radar-lite on every variable and write the result files.

Reads  data/processed/series.nc
Writes data/processed/trends.parquet, regional.parquet, clusters.parquet, findings.json
Formats: contracts/README.md

Run from the repo root:
    python -m engine.run_all
"""

from common.config import PROCESSED_DIR, VARIABLES


def main() -> None:
    # TODO(ML engineer): for each variable and land cell: anomalies -> theil_sen -> mann_kendall,
    #   then fdr per variable, regional trends, radar, then write the files.
    #   run_id = timestamp + git commit, for provenance.
    raise NotImplementedError(f"process {list(VARIABLES)} into {PROCESSED_DIR}")


if __name__ == "__main__":
    main()
