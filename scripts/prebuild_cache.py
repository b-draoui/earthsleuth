"""Docker build step: write the map layers ready to send, so a small server starts warm.

    EARTHSLEUTH_FAKE=1 python -m scripts.prebuild_cache /app/cache

The image sets EARTHSLEUTH_CACHE_DIR to that folder; api/data_access.py then reads these files
instead of computing them (about 45 s on Render's free CPU). Nothing else changes.
"""

import gzip
import sys
from pathlib import Path

from api import data_access as da
from common.config import RESULTS_DIR, TRENDS_FILE, VARIABLES


def main(out: Path) -> None:
    if not (RESULTS_DIR / TRENDS_FILE).exists():
        print(f"prebuild: no {TRENDS_FILE} in {RESULTS_DIR}, skipped")
        return
    out.mkdir(parents=True, exist_ok=True)
    for v in VARIABLES:
        raw = da.trends_payload(v, gzipped=False)
        (out / da.cache_name(v, gzipped=False)).write_bytes(raw)
        (out / da.cache_name(v, gzipped=True)).write_bytes(gzip.compress(raw, compresslevel=9))
    print(f"prebuild: {len(VARIABLES)} map layers from {RESULTS_DIR} -> {out}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
