from typing import Literal

from pydantic import BaseModel


class Variable(BaseModel):
    id: str
    label: str
    unit: str
    dataset: str
    version: str


class RegionalTrend(BaseModel):
    slope_per_decade: float
    ci95: tuple[float, float]
    p: float
    significant: bool


class CellCounts(BaseModel):
    n: int
    sig_up: int
    sig_down: int
    pct_sig_area: float


class VariableResult(BaseModel):

    variable: str
    unit: str
    region: str
    regional: RegionalTrend
    cells: CellCounts
    method: str
    datasets: list[str]
    run_id: str


class AgentEvent(BaseModel):

    stage: Literal["understand", "plan", "analyse", "check", "explain"]
    status: Literal["running", "done", "error"]
    message: str
    data: dict = {}
