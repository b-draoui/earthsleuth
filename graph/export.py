from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path

from common import config as C
from graph.store import GraphStore, JsonStore

SNAPSHOTS = C.GRAPH_DIR / "snapshots"


def export_snapshot(store: GraphStore) -> dict:
    path = store.export_json(C.GRAPH_JSON)
    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    copy = SNAPSHOTS / f"graph_{stamp}.json"
    shutil.copy2(path, copy)
    return {"graph_json": str(path), "snapshot": str(copy), "counts": store.counts()}


def restore_snapshot(store: GraphStore, snapshot: Path | None = None) -> int:
    if snapshot is None:
        snaps = sorted(SNAPSHOTS.glob("graph_*.json"))
        if not snaps:
            raise FileNotFoundError("no snapshot in data/graph/snapshots")
        snapshot = snaps[-1]
    store.clear()
    return store.import_json(snapshot)


def dump_instructions() -> str:
    return ("Neo4j Desktop: stop the database, then open its terminal and run\n"
            "  neo4j-admin database dump neo4j --to-path=<folder>\n"
            "Restore with: neo4j-admin database load neo4j --from-path=<folder> --overwrite-destination\n"
            "(graph.json snapshots made by `python run.py export` are an always-available alternative)")


def json_store() -> JsonStore:
    return JsonStore(C.GRAPH_JSON)
