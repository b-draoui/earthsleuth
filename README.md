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

Secrets: copy `.env.example` to `.env` (Earthdata login, LLM key). It is ignored by Git. The maps need no key.

## Run the app (two terminals)

```bash
uvicorn api.main:app --reload --port 8000    # terminal 1, repo root: the API (docs at http://localhost:8000/docs)
cd web && npm run dev                         # terminal 2: the site at http://localhost:5173
```

The site calls `/api/...`; Vite forwards those calls to FastAPI. Both reload by themselves when you save a file.

Production is one server: `cd web && npm run build`, then `uvicorn api.main:app` serves the API and the built site on the same port.

## Deploy (Render, free)

The whole app is one Docker container (`Dockerfile`): the React site is built, then FastAPI serves it and the API on
one port. `render.yaml` describes the service.

1. Merge into `main` and push.
2. On [render.com](https://render.com), sign in with GitHub, then **New → Blueprint**, pick the repo, **Apply**.
   The first build takes about 5 minutes. The app is then at `https://earthsleuth.onrender.com` (or the name Render
   gives), and every push to `main` redeploys it once the GitHub checks pass.
3. Render asks for `LLM_API_KEY` during setup: leave it empty until the agent is connected (the narrator answers
   meanwhile), then add it under the service's **Environment**. Never in the repo.

The free plan sleeps after 15 minutes without visits and takes about a minute to wake up. Before and during judging,
keep it awake with a free monitor (e.g. cron-job.org or UptimeRobot) calling `/api/health` every 10 minutes, or
switch the service to the Starter plan ($7/month). Measured with the same limits as the free plan (0.1 CPU, 512 MB,
applied with Linux cgroups to the image's contents): 121 MB of memory at peak, answering after about 11 s, fully ready
after about 13 s. The map layers are prepared while the image is built (`scripts/prebuild_cache.py`), so they load in
milliseconds; every other call takes under 1 s. The GitHub check builds the image on every pull request.

Locally: `docker build -t earthsleuth .` then `docker run -p 8000:8000 earthsleuth`.

## Offline scripts (repo root)

```bash
python -m pipeline.download --variable precip
python -m pipeline.preprocess
python -m engine.run_all
python -m graph.load_graph
pytest
```

## Simulated data first

Until real results exist, the app runs on simulated data: `data/fake/` (committed) holds every result file in the
contract formats, made by `python -m scripts.make_fake_data` (about 45 s). The series are synthetic (seasons + trend +
noise), the statistics on them are the real methods. Set `EARTHSLEUTH_FAKE=1` in `.env` and the API reads `data/fake/`;
the app then shows a "Simulated data" badge on every page. When the real files land in `data/processed/`, set
`EARTHSLEUTH_FAKE=0`: nothing else changes.

## The app (Layer 6)

Five pages follow the investigation: **01 Discover** (`/`, the opening and the method), **02 Explore** (`/explore`, the
map lab: 5 layers, trend / yearly / opposite views, click any cell or region), **03 Investigate** (`/investigate`, the AI
investigator), **04 Understand** (`/understand`, Signal Radar, clusters, knowledge graph), **05 Conclude**
(`/conclude`, the report, downloadable).

The basemap is Natural Earth, drawn by MapLibre from `web/public/geo/`: no map key, works offline.

## Plugging in your layer

- **Statistics (ML engineer)**: `python -m engine.run_all` must write the files of `contracts/README.md` to
  `data/processed/`. Compare with `data/fake/` (same columns). The API uses `engine.stats.anomalies()` as soon as it
  is implemented. Watch out: the Hamed–Rao Mann–Kendall test returns `p = NaN` for near-constant series (rainless
  desert cells), and one NaN breaks the FDR correction for all cells: fall back to the original test there
  (`scripts/make_fake_data.py` shows how).
- **Agent (AI engineer)**: make `agent.agent.run_investigation(question)` yield Contract 3 events (one per step). The
  API switches to it automatically; until then `api/narrator.py` answers, says so in the app, and only quotes numbers
  from the result files. `list_demos()` / `replay_demo()` work the same way for the cached case files.
- **Graph**: `python -m graph.load_graph` writes `graph.json` (node-link format). The app reads that file, never Neo4j.
- **Pipeline**: `series.nc` with one variable per id, coordinates `time`, `lat`, `lon` (cell centres), ocean = NaN.

## Working together

- Never push to `main`. One branch per task (`web/trend-map`, `engine/fdr`, `agent/tools`), then a pull request. Tests and the front-end build run on every PR.
- Merge small and often. A branch that stays open for a day will conflict.
- Stay inside your folder. If you need something from another folder, ask its owner.
- Changing a contract (a column name, a JSON key) means: tell the group chat, then update `contracts/`, `api/schemas.py` and `web/src/lib/types.ts` in the same PR.
- Region, period, grid, variable ids and paths come from `common/config.py`. Import them, don't retype them.
- Raw NASA files never go in Git (`data/raw/` is ignored). Only small results go in `data/processed/`.
- No NASA logos, flags or mission patches anywhere (submission rule).
