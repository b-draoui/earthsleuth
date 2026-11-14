"""Layer 5: the Python functions the agent can call (Doc 2, 9.1).

They only read result files and graph.json from common.config.RESULTS_DIR.
They never compute statistics themselves.
"""


def find_variables(concepts: list[str]) -> list[dict]:
    """Variables linked to the concepts in the graph, with definitions and datasets."""
    # TODO(AI engineer)
    raise NotImplementedError


def get_trend(variable: str, region: str) -> dict:
    """Contract 2 JSON for the regional trend + cell counts (contracts/examples/variable_result.json)."""
    # TODO(AI engineer)
    raise NotImplementedError


def get_opposite_trends(variable: str) -> list[dict]:
    """Sub-regions with opposite significant directions."""
    # TODO(AI engineer)
    raise NotImplementedError


def get_clusters() -> list[dict]:
    """Cluster signatures, sizes and their sub-regions."""
    # TODO(AI engineer)
    raise NotImplementedError


def get_mechanisms(variable: str) -> list[dict]:
    """INFLUENCES paths from the graph, with their paper sources."""
    # TODO(AI engineer)
    raise NotImplementedError


def record_hypothesis(text: str, based_on: list[str]) -> dict:
    """Save a Hypothesis node with status "unverified"."""
    # TODO(AI engineer)
    raise NotImplementedError
