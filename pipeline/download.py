"""Layer 1: download the NASA monthly files with earthaccess, one variable at a time.

Run from the repo root (one terminal per variable, start early):
    python -m pipeline.download --variable precip

Before the first run (Doc 2, 5.3):
- free Earthdata Login account, credentials in .env
- approve "NASA GESDISC DATA ARCHIVE" in the Earthdata profile (MERRA-2, GPM, GLDAS)
- pip install -r requirements-pipeline.txt

Raw files go to data/raw/ (ignored by Git). Process one file at a time and delete it
after preprocess.py has used it, or the disk fills up.
"""

import argparse

from common.config import PERIOD, RAW_DIR, VARIABLES


def download(variable: str) -> None:
    """Search and download every monthly file of one variable over PERIOD into RAW_DIR."""
    info = VARIABLES[variable]
    # TODO(integration): earthaccess.login(strategy="environment"),
    #   earthaccess.search_data(short_name=info["dataset"], version=..., temporal=PERIOD),
    #   earthaccess.download(results, RAW_DIR / variable)
    raise NotImplementedError(f"download {info['dataset']} to {RAW_DIR} for {PERIOD}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--variable", required=True, choices=list(VARIABLES))
    download(parser.parse_args().variable)
