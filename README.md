# EarthSleuth

NASA Space Apps Challenge 2026. EarthSleuth looks at five Earth variables (air temperature, rain, soil moisture, evapotranspiration, vegetation) over the Mediterranean and North Africa from 2001 to 2024. It finds where they changed, checks whether each trend is real or just luck, and an AI investigator explains the results in plain words.

"EarthSleuth" is a working name. The full design is in Document 1 (full system) and Document 2 (hackathon build), see `docs/`.

## How the pieces fit

The heavy work runs offline, once, and writes small files to `data/processed/`. The server only reads those files, so the app stays fast while the judges use it.

```
pipeline/   NASA data      ->  data/processed/series.nc
engine/     statistics     ->  data/processed/trends.parquet, regional.parquet, clusters.parquet, findings.json
graph/      knowledge      ->  data/processed/graph.json
agent/      AI (LangGraph) ->  reads the files above, answers questions
api/        FastAPI        ->  serves all of it as JSON + streams the agent (SSE)
web/        React          ->  the website (MapLibre maps, animations)
```

`contracts/` describes the exact format of every file and JSON passed between folders. This is what lets everyone work in parallel. Nobody changes a format without telling the team first.

| Folder | Layer in Doc 1 | Contents | Owner |
|---|---|---|---|
| `pipeline/` | 1. Data platform | `download.py`, `preprocess.py` | Integration (name) |
| `graph/` | 2. Knowledge graph | `seed.yaml`, `load_graph.py` (Neo4j for dev, `graph.json` for the app) | AI engineer (name) |
| `engine/stats.py`, `engine/run_all.py` | 3. Statistics engine | anomalies, Theil–Sen, Mann–Kendall, FDR | ML engineer (name) |
| `engine/radar.py` | 4. Signal Radar | ranking, opposite trends, clusters | ML engineer (name) |
| `agent/` | 5. AI investigator | LangGraph agent, tools, demo cache | AI engineer (name) |
| `api/` + `web/` | 6. The app | FastAPI server + React site | Integration / product (name) |
| `common/` | shared | region, period, grid, variable ids, paths | everyone (ask before changing) |

## Setup

You need Python 3.12 and Node.js 22 (LTS).

```bash
# Python (repo root)
python -m venv .venv
.venv\Scripts\activate               # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
pip install -r requirements-pipeline.txt   # only if you download data or push the graph to Neo4j

# Front end
cd web
npm install
```

Secrets: copy `.env.example` to `.env` (Earthdata login, LLM key) and `web/.env.example` to `web/.env` (free CARTO basemap key). Both copies are ignored by Git.

## Run the app (two terminals)

```bash
uvicorn api.main:app --reload --port 8000    # terminal 1, repo root: the API (docs at http://localhost:8000/docs)
cd web && npm run dev                         # terminal 2: the site at http://localhost:5173
```

The site calls `/api/...`; Vite forwards those calls to FastAPI. Both reload by themselves when you save a file.

Production is one server: `cd web && npm run build`, then `uvicorn api.main:app` serves the API and the built site on the same port.

## Offline scripts (repo root)

```bash
python -m pipeline.download --variable precip
python -m pipeline.preprocess
python -m engine.run_all
python -m graph.load_graph
pytest
```

## Fake data first

Until real results exist, `scripts/make_fake_data.py` writes files in the right format into `data/fake/`. Set `EARTHSLEUTH_FAKE=1` in `.env` and the API and agent read `data/fake/` instead of `data/processed/`. When the real files arrive, nothing else changes.

## Working together

- Never push to `main`. One branch per task (`web/trend-map`, `engine/fdr`, `agent/tools`), then a pull request. Tests and the front-end build run on every PR.
- Merge small and often. A branch that stays open for a day will conflict.
- Stay inside your folder. If you need something from another folder, ask its owner.
- Changing a contract (a column name, a JSON key) means: tell the group chat, then update `contracts/`, `api/schemas.py` and `web/src/lib/types.ts` in the same PR.
- Region, period, grid, variable ids and paths come from `common/config.py`. Import them, don't retype them.
- Raw NASA files never go in Git (`data/raw/` is ignored). Only small results go in `data/processed/`.
- No NASA logos, flags or mission patches anywhere (submission rule).
