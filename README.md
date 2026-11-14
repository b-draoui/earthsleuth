# EarthSleuth

NASA Space Apps Challenge 2026. EarthSleuth looks at five Earth variables (air temperature, rain, soil moisture, evapotranspiration, vegetation) over the Mediterranean and North Africa from 2001 to 2024. It finds where they changed, checks whether each trend is real or just luck, and an AI investigator explains the results in plain words.

"EarthSleuth" is a working name. The full design is in Document 1 (full system) and Document 2 (hackathon build), see `docs/`.

## How the pieces fit

The heavy work runs offline, once, and writes small files to `data/processed/`. The app only reads those files, so it stays fast while the judges use it.

```
pipeline/   NASA data      ->  data/processed/series.nc
engine/     statistics     ->  data/processed/trends.parquet, regional.parquet, clusters.parquet, findings.json
graph/      knowledge      ->  data/processed/graph.json
agent/      AI             ->  reads the files above, answers questions
app/        web app        ->  shows everything (Streamlit)
```

`contracts/` describes the exact format of every file and JSON passed between folders. This is what lets everyone work in parallel. Nobody changes a format without telling the team first.

| Folder | Layer in Doc 1 | Contents | Owner |
|---|---|---|---|
| `pipeline/` | 1. Data platform | `download.py`, `preprocess.py` | Integration (name) |
| `graph/` | 2. Knowledge graph | `seed.yaml`, `load_graph.py` | AI engineer (name) |
| `engine/stats.py`, `engine/run_all.py` | 3. Statistics engine | anomalies, Theil–Sen, Mann–Kendall, FDR | ML engineer (name) |
| `engine/radar.py` | 4. Signal Radar | ranking, opposite trends, clusters | ML engineer (name) |
| `agent/` | 5. AI investigator | tools, agent loop, demo cache | AI engineer (name) |
| `app/` | 6. The app | Streamlit pages | Integration / product (name) |
| `common/` | shared | region, period, grid, variable ids, paths | everyone (ask before changing) |

## Setup

Python 3.12 for everyone (see `.python-version`).

```bash
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt      # app + engine (also what Streamlit Cloud installs)
pip install -r requirements-dev.txt  # pytest
pip install -r requirements-pipeline.txt   # only if you download data or push the graph to Neo4j
```

Run everything from the repo root, otherwise imports like `from common.config import VARIABLES` break:

```bash
streamlit run app/Home.py
python -m pipeline.download --variable precip
python -m pipeline.preprocess
python -m engine.run_all
python -m graph.load_graph
pytest
```

## Fake data first

Until real results exist, `scripts/make_fake_data.py` writes files in the right format into `data/fake/`. Set `EARTHSLEUTH_FAKE=1` and the app and agent read `data/fake/` instead of `data/processed/`. When the real files arrive, nothing else changes.

## Working together

- Never push to `main`. One branch per task (`app/trend-map`, `engine/fdr`, `agent/tools`), then a pull request. Tests run on every PR.
- Merge small and often. A branch that stays open for a day will conflict.
- Stay inside your folder. If you need something from another folder, ask its owner.
- Changing a contract (a column name, a JSON key) means: tell the group chat, update `contracts/` and its example files in the same PR.
- Region, period, grid, variable ids and paths come from `common/config.py`. Import them, don't retype them.
- Raw NASA files never go in Git (`data/raw/` is ignored). Only small results go in `data/processed/`.
- Secrets: copy `.env.example` to `.env` (Earthdata login) and `.streamlit/secrets.toml.example` to `.streamlit/secrets.toml` (LLM key). Both copies are ignored by Git.
- No NASA logos, flags or mission patches anywhere (submission rule).
