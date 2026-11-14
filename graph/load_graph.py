"""Build the knowledge + evidence graph from seed.yaml (Layer A) and findings.json (Layer B).

Writes data/processed/graph.json (used by the deployed app) and, optionally, pushes the
same graph to Neo4j for development and slide screenshots. Format: contracts/README.md.

Run from the repo root:
    python -m graph.load_graph            # graph.json only
    python -m graph.load_graph --neo4j    # also Neo4j (needs requirements-pipeline.txt)
"""

import argparse
from pathlib import Path

import networkx as nx

from common.config import FINDINGS_FILE, GRAPH_FILE, PROCESSED_DIR

SEED = Path(__file__).with_name("seed.yaml")


def build_graph(seed_path: Path = SEED, findings_path: Path = PROCESSED_DIR / FINDINGS_FILE) -> nx.MultiDiGraph:
    """Seed nodes/edges + one Analysis node + Finding nodes + OPPOSITE_OF / CO_OCCURS_WITH edges."""
    # TODO(AI engineer)
    raise NotImplementedError((seed_path, findings_path))


def export_json(g: nx.MultiDiGraph, path: Path = PROCESSED_DIR / GRAPH_FILE) -> None:
    """networkx node-link JSON."""
    # TODO(AI engineer): json.dump(nx.node_link_data(g, edges="edges"), ...)
    raise NotImplementedError(path)


def push_to_neo4j(g: nx.MultiDiGraph) -> None:
    """Optional: same graph into Neo4j (credentials from .env)."""
    # TODO(AI engineer)
    raise NotImplementedError


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--neo4j", action="store_true")
    args = parser.parse_args()
    graph = build_graph()
    export_json(graph)
    if args.neo4j:
        push_to_neo4j(graph)
