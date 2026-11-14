# Contracts

The formats every folder agrees on. Agree on them in the first hour, then everyone can build on fake data and switch to real data later without breaking anything.

Rules: variable ids, region ids and paths come from `common/config.py`. Numbers in `examples/` are placeholders, not results. Changing a format = tell the team + update this file and the examples in the same PR.

## Shared ids

- Variables: `t2m`, `precip`, `soil_moisture`, `et`, `ndvi`
- Main region: `mediterranean_north_africa`, sub-regions in `common/config.py` (`SUBREGIONS`)
- Cell: `cell_id = "lat_lon"` of the cell centre, one decimal, e.g. `"36.5_10.5"`, `"40.5_-3.5"` (use `common.config.cell_id`)
- Time: monthly, first day of the month, `2001-01-01` to `2024-12-01`

## Files written offline (in `data/processed/`, same format in `data/fake/`)

### `series.nc` (pipeline → engine, app)
xarray Dataset. Coordinates `time` (288), `lat` (22), `lon` (50), cell centres. One data variable per variable id, already in the units of `common/config.py`. Ocean cells = NaN.

### `trends.parquet` (engine → agent, app). One row per variable × land cell
| column | type | meaning |
|---|---|---|
| `variable` | str | variable id |
| `cell_id`, `lat`, `lon` | str, float, float | which cell |
| `slope_dec` | float | Theil–Sen slope per decade, in `unit` |
| `ci_lo`, `ci_hi` | float | 95% interval of the slope |
| `unit` | str | e.g. `°C` |
| `p`, `q` | float | Mann–Kendall p-value, FDR q-value |
| `significant` | bool | `q < FDR_Q` |
| `tau`, `n` | float, int | Kendall's tau, number of months |
| `direction` | str | `up` / `down` / `none` (none if not significant) |
| `run_id`, `datasets` | str, str | provenance |

### `regional.parquet` (engine → agent, app). Proposal, one row per variable × region
`variable, region, slope_dec, ci_lo, ci_hi, p, significant, n_cells, sig_up, sig_down, pct_sig_area, unit, run_id`. Regional series = cos-latitude weighted mean of the land cells. The `regional` and `cells` blocks of Contract 2 are built from this file.

### `clusters.parquet` (engine/radar → agent, app). Proposal
`cell_id, lat, lon, cluster` (int), `cluster_name` (e.g. "warming + drying"), plus one standardised slope column per variable id, named by the id (`t2m`, `precip`, ...). Name groups from the sign of the real mean slope: a group that warms less than average is "weaker warming", never "cooling".

### `findings.json` (engine → graph). Proposal
List of findings (one per variable × sub-region with a significant regional trend, one per cluster). See `examples/findings.json`.

### `graph.json` (graph → agent, app)
networkx node-link format (`networkx.node_link_data`). Every node has `id`, `type`, `label`. Every edge has `source`, `target`, `type`. Hypothesis nodes have `status: "unverified"`. See `examples/graph.json`.

## JSON between agent, engine and app

- Contract 1, investigation spec (agent → engine): `examples/investigation_spec.json`
- Contract 2, result for one variable (engine → agent / app): `examples/variable_result.json`
- Contract 3, agent progress events (agent → app, proposal): `examples/agent_event.json`. `agent.run_investigation(question)` yields these one by one so the Live progress screen can light up each step. `stage` is one of `understand`, `plan`, `analyse`, `check`, `explain`; `status` is `running`, `done` or `error`. The last event (`explain`, `done`) carries the final answer in `data`.

## Open questions

- "Years needed" on the Time series screen (how many more years before a non-significant trend could become significant): engine column or computed in the app?
- Sub-region boxes (`SUBREGIONS`): the app layer proposed 7 boxes in `common/config.py`. Confirm or change them.
