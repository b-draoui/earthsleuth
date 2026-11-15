from __future__ import annotations

import logging
import shutil
from pathlib import Path

from common import config as C
from common.variables import DATASETS
from pipeline.preprocess import month_key, process_granule

log = logging.getLogger(__name__)


def login():
    import earthaccess
    if C.EARTHDATA_USERNAME and C.EARTHDATA_PASSWORD:
        auth = earthaccess.login(strategy="environment")
    else:
        auth = earthaccess.login(strategy="netrc")
    if not auth or not getattr(auth, "authenticated", False):
        raise RuntimeError(
            "Earthdata login failed. Put EARTHDATA_USERNAME and EARTHDATA_PASSWORD in .env "
            "(free account at https://urs.earthdata.nasa.gov) and approve 'NASA GESDISC DATA "
            "ARCHIVE' under Applications > Authorized Apps in your Earthdata profile.")
    return auth


APP_HINT = {
    "GES_DISC": "NASA GESDISC DATA ARCHIVE",
    "LPCLOUD": "LP DAAC Data Pool",
}


def fetch(dataset: str, granules: list, folder: Path, threads: int = 4) -> list:
    import earthaccess
    try:
        return earthaccess.download(granules, str(folder), threads=threads)
    except Exception as e:
        provider = DATASETS[dataset].cmr_concept_id.split("-")[-1]
        app = APP_HINT.get(provider, "the data archive")
        raise RuntimeError(
            f"Download of {DATASETS[dataset].short_name} was refused. Your Earthdata login works, "
            f"but if the error above says 401/403 you still have to approve '{app}' in your "
            "Earthdata profile: https://urs.earthdata.nasa.gov/profile -> Applications -> "
            "Authorized Apps -> Approve More Applications. Then run the command again.") from e


def granule_filename(granule) -> str:
    links = granule.data_links()
    if not links:
        raise ValueError("granule has no download link")
    return Path(links[0].split("?")[0]).name


def sample_path(dataset: str) -> Path | None:
    folder = C.RAW / dataset / "sample"
    files = sorted(folder.glob("*")) if folder.exists() else []
    return files[0] if files else None


def download_dataset(dataset: str, start: str = C.PERIOD_START, end: str = C.PERIOD_END,
                     batch: int = 8, threads: int = 4, keep_raw: bool = False) -> dict:
    import earthaccess
    spec = DATASETS[dataset]
    login()
    granules = earthaccess.search_data(
        short_name=spec.short_name, version=spec.version,
        temporal=(f"{start}-01", f"{end}-28T23:59:59"), bounding_box=C.REGION.as_tuple())
    log.info("%s: %d granules found in CMR", spec.short_name, len(granules))

    todo = []
    for g in granules:
        try:
            key = month_key(dataset, granule_filename(g))
        except ValueError as e:
            log.warning("skipping a granule: %s", e)
            continue
        if not (start <= key <= end):
            continue
        if (C.SMALL / dataset / f"{key}.npz").exists():
            continue
        todo.append(g)
    log.info("%s: %d months still to do", spec.short_name, len(todo))

    raw_dir = C.RAW / dataset
    raw_dir.mkdir(parents=True, exist_ok=True)
    done, failed = 0, []
    for i in range(0, len(todo), batch):
        chunk = todo[i:i + batch]
        paths = fetch(dataset, chunk, raw_dir, threads)
        for p in map(Path, paths):
            try:
                process_granule(dataset, p)
                done += 1
                if sample_path(dataset) is None:
                    (raw_dir / "sample").mkdir(exist_ok=True)
                    shutil.copy2(p, raw_dir / "sample" / p.name)
            except Exception as e:
                log.error("failed to process %s: %s", p.name, e)
                failed.append(p.name)
            finally:
                if not keep_raw and p.exists():
                    p.unlink()
        log.info("%s: %d/%d processed", spec.short_name, done, len(todo))
    return {"dataset": spec.short_name, "found": len(granules), "processed": done,
            "failed": failed}


def download_sample_only(dataset: str) -> Path:
    import earthaccess
    spec = DATASETS[dataset]
    login()
    g = earthaccess.search_data(short_name=spec.short_name, version=spec.version,
                                temporal=("2001-01-01", "2001-01-31"), count=1)
    folder = C.RAW / dataset / "sample"
    folder.mkdir(parents=True, exist_ok=True)
    if not g:
        raise RuntimeError(f"CMR found no granule of {spec.short_name} for January 2001.")
    [p] = fetch(dataset, g[:1], folder, threads=1)
    return Path(p)
