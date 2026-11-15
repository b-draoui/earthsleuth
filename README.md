# EarthSleuth

NASA Space Apps Challenge 2026. EarthSleuth looks at five Earth variables (air temperature, rain, soil moisture, evapotranspiration, vegetation) over the Mediterranean and North Africa from 2001 to 2024. It finds where they changed, checks whether each trend is real or just luck, and an AI investigator explains the results in plain words.

"EarthSleuth" is a working name. The full design is in Document 1 (full system) and Document 2 (hackathon build), see `docs/`.

## How the pieces fit

The heavy work runs offline, once, and writes small files to `data/`. The web server reads those files and runs the
investigator on demand, so the site stays fast.

```
pipeline/   NASA data -> 1° grid       ->  data/processed/series.nc
engine/     statistics + Signal Radar   ->  data/processed/trends.parquet, regional.json, clusters.parquet, findings.json
graph/      curator agent (Gemini)      ->  Neo4j + data/graph/graph.json (snapshot)
agent/      AI investigator (7 steps)   ->  answers questions; reports in data/investigations/
api/        FastAPI                     ->  serves it all as JSON + streams the investigator (SSE)
web/        React                       ->  the website (MapLibre maps, animations); built copy in web/dist/
run.py      one command per phase       ->  python run.py status | download | preprocess | precompute | build_graph | ask | app
```

| Folder | Layer | Contents |
|---|---|---|
| `pipeline/` | 1. Data platform | `download.py` (earthaccess), `preprocess.py` (readers, units, 1° binning, land mask) |
| `engine/` | 3–4. Statistics + Signal Radar | `stats.py` (anomalies, Theil–Sen, Mann–Kendall Hamed–Rao, BH-FDR, Weatherhead), `analysis.py` (on-demand engine + guardrails + cache), `radar.py`, `findings.py`, `run_all.py` |
| `graph/` | 2. Knowledge graph | `schema.yaml` (Contract 0), `strategy.yaml`, `papers.yaml`, `store.py` (Neo4j or JSON), `curator_agent.py` + `curator_tools.py`, `queries.py`, `evidence.py`, `validate_graph.py` |
| `agent/` | 5. AI investigator | `investigator.py` (Understand → Plan → Analyse → Record → Why? → Check → Explain), `tools.py`, `llm.py` (Gemini), `agent.py` (bridge to the web app) |
| `api/` + `web/` | 6. The app | FastAPI server + React site |
| `common/` | shared | `config.py` (region, grid, period, thresholds, paths, secrets), `variables.py` (datasets, variables, sub-regions), `contracts.py` |

Golden rules (enforced in code): the AI never computes numbers; every number in an answer must appear in the tool
outputs (number check, with signs); hypotheses are always labelled; the curator decides what goes in the graph, never
the facts (units, DOIs and dates come from NASA CMR, the file headers or Crossref).

## Run it on a laptop (with Gemini + Neo4j)

You need Python 3.10+ (3.12 recommended). Node.js is **not** needed: the built site is in `web/dist/`.

```bash
git clone https://github.com/b-draoui/earthsleuth && cd earthsleuth
python -m venv .venv
.venv\Scripts\activate                 # macOS/Linux: source .venv/bin/activate
pip install -r requirements-local.txt   # an existing venv with the team's packages also works
copy .env.example .env                  # macOS/Linux: cp; then fill GEMINI_API_KEY (+ NEO4J_PASSWORD)
python run.py status                    # data, graph, Gemini key, Neo4j
python run.py app                       # http://localhost:8000
```

- With `GEMINI_API_KEY` in `.env`, the investigator uses Gemini for steps 1 and 7. Without it, it uses rules and
  templates (same statistics), and the app says so.
- With Neo4j Desktop running and `NEO4J_PASSWORD` set, the investigator reads and writes the live graph. Otherwise it
  reads `data/graph/graph.json` (and only writes it back with `EARTHSLEUTH_SAVE_GRAPH=1`).
- Every finished investigation is saved in `data/investigations/`. The ones made with Gemini appear as case files on
  the Investigate page (replayed without any key, also on the public site): commit the good ones.
- First question on a region: about a minute while the engine computes; then it is cached in `data/cache/`.
  `python run.py prewarm` computes every region at once (about 1.5 min).
- Terminal only: `python run.py ask "Is Tunisia getting drier?"` (add `--no-llm` to skip Gemini).

## Develop the site (Node.js 22)

```bash
pip install -r requirements.txt -r requirements-dev.txt   # Python 3.12, exact versions (as on the server)
cd web && npm install
uvicorn api.main:app --reload --port 8000    # terminal 1, repo root: the API (docs at http://localhost:8000/docs)
cd web && npm run dev                         # terminal 2: the site at http://localhost:5173
```

After changing `web/`, run `npm run build` and commit `web/dist/` too, so laptops without Node get the new site
(the server builds its own copy).

## Deploy (Render, free)

The whole app is one Docker container (`Dockerfile`): the React site is built, then FastAPI serves it and the API on
one port. `render.yaml` describes the service.

1. Merge into `main` and push.
2. On [render.com](https://render.com), sign in with GitHub, then **New → Blueprint**, pick the repo, **Apply**.
   The first build takes about 5 minutes. The app is then at `https://earthsleuth.onrender.com` (or the name Render
   gives), and every push to `main` redeploys it once the GitHub checks pass.
3. `EARTHSLEUTH_FAKE` must be `0` (real NASA results). `GEMINI_API_KEY` is optional: without it the public site runs
   the investigator offline (rules + templates) and replays the recorded Gemini investigations. Set keys only under
   the service's **Environment**, never in the repo.

The free plan sleeps after 15 minutes without visits and takes about a minute to wake up. Before and during judging,
keep it awake with a free monitor (e.g. cron-job.org or UptimeRobot) calling `/api/health` every 10 minutes, or
switch the service to the Starter plan ($7/month). Measured with the same limits as the free plan (0.1 CPU, 512 MB,
applied with Linux cgroups to the image's contents): 121 MB of memory at peak, answering after about 11 s, fully ready
after about 13 s. The map layers and the investigator's statistics for every region are prepared while the image is built
(`scripts/prebuild_cache.py`, `scripts/prewarm_engine.py`), so they load in milliseconds; every other call takes under
1 s (a question about other years than 2001–2024 is computed on the spot and takes longer on the free plan). The GitHub check builds the image on every pull request.

Locally: `docker build -t earthsleuth .` then `docker run -p 8000:8000 earthsleuth`.

## Offline phases (repo root)

```bash
python run.py download                    # ~52 GB streamed, processed and deleted file by file (resumable)
python run.py preprocess                  # -> data/processed/series.nc
python run.py precompute                  # -> trends.parquet, regional.json, clusters, findings.json
python run.py build_graph --fresh         # curator (Gemini) -> Neo4j, validate, evidence, snapshot graph.json
python run.py load_seed                   # backup graph without any LLM
pytest
```

## Simulated data

`data/fake/` (committed) holds simulated result files in the same formats, made by `python -m scripts.make_fake_data`
(seasons + trend + noise, analysed with the real methods). The tests use them; `EARTHSLEUTH_FAKE=1` makes the app use
them too, with a "Simulated data" badge on every page. Real results are the default.

## The app (Layer 6)

Five pages follow the investigation: **01 Discover** (`/`, the opening and the method), **02 Explore** (`/explore`, the
map lab: 5 layers, trend / yearly / opposite views, click any cell or region), **03 Investigate** (`/investigate`, the AI
investigator), **04 Understand** (`/understand`, Signal Radar, clusters, knowledge graph), **05 Conclude**
(`/conclude`, the report, downloadable).

Also in the app:
- a scroll-driven flight on the home page (globe → region, then the yearly temperature anomalies 2001 → 2024);
- a city search (`web/src/lib/cities.ts`) and, for any cell, its five signals, a 10-second sound version of its record,
  and a share card (PNG drawn on a canvas);
- a map of the answer in Investigate (where all the significant directions hold together) and small maps in Conclude,
  both from `/api/cells` (every cell × every variable, no yearly values);
- a guided tour (`/?tour=1` or the button on the home page), about 80 s, for demos and the video;
- a link preview (`web/public/og.png`, meta tags in `web/index.html`).

The basemap is Natural Earth, drawn by MapLibre from `web/public/geo/`: no map key, works offline.

## Challenge

NASA Space Apps Challenge 2026, challenge **"Be An Earth System Trend Detective!"**: find variables measured by NASA
missions or produced by NASA models, show how they change over time, and determine what is changing, where, how much,
and whether the change is significant.

## Credits

The same list is in the app (05 Conclude → Credits) and in the downloaded report (`web/src/lib/credits.ts`).

**Data (NASA)**
- MERRA-2 tavgM_2d_slv_Nx (M2TMNXSLV) v5.12.4, 2 m air temperature. NASA GMAO / GES DISC. https://doi.org/10.5067/AP1B0BA5PD2K
- GPM IMERG Final Precipitation L3 monthly (GPM_3IMERGM) V07. NASA GPM / GES DISC. https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07
- GLDAS Noah L4 monthly 0.25° (GLDAS_NOAH025_M) v2.1, soil moisture and evapotranspiration. Beaudoing & Rodell, NASA/GSFC/HSL / GES DISC. https://doi.org/10.5067/SXAVCZFAQLNO
- Terra MODIS Vegetation Indices monthly 0.05° (MOD13C2) v061, NDVI. NASA / LP DAAC. https://doi.org/10.5067/MODIS/MOD13C2.061

**Maps and imagery**: Natural Earth (public domain); Blue Marble Shaded Relief and Bathymetry via NASA GIBS (ESDIS);
approximate city-centre coordinates for labels.

**Methods**: Theil (1950); Sen (1968), J. Am. Stat. Assoc. 63; Mann (1945), Econometrica 13; Kendall (1975), Rank
Correlation Methods; Hamed & Rao (1998), J. Hydrology 204; Benjamini & Hochberg (1995), J. R. Stat. Soc. B 57;
Weatherhead et al. (1998), J. Geophys. Res. 103; Wilks (2016), Bull. Am. Meteorol. Soc. 97.

**Literature in the knowledge graph** (read by the team, `graph/papers.yaml`): Giorgi (2006), Geophys. Res. Lett. 33;
Vicente-Serrano et al. (2014), Environ. Res. Lett. 9; Tuel & Eltahir (2020), J. Climate 33.

**Services**: NASA Earthdata (CMR, Earthdata Login, earthaccess); Crossref REST API; Neo4j (local graph database).

**Fonts and colours**: Inter (Rasmus Andersson) and Space Grotesk (Florian Karsten), SIL OFL 1.1, via Fontsource;
ColorBrewer RdBu / BrBG (Cynthia Brewer, Apache 2.0); Okabe–Ito palette (Okabe & Ito, 2008).

**Open-source software**: React, React Router, Vite, TypeScript, Tailwind CSS, Motion, MapLibre GL JS, react-map-gl,
Recharts, react-force-graph-2d, Fontsource, oxlint; FastAPI, Uvicorn, pandas, NumPy, SciPy, xarray, h5netcdf, h5py,
PyArrow, pyMannKendall, statsmodels, scikit-learn, NetworkX, PyYAML, python-dotenv, pytest, Google Gen AI SDK;
earthaccess, netCDF4, pyhdf, Neo4j Python driver, requests, global-land-mask. Licences are listed in the app.

## Use of AI

AI tools used to build EarthSleuth: Claude (Anthropic) and ChatGPT (OpenAI); details on the project page. Inside the
app, Gemini (Google) builds the knowledge graph (curator agent, every fact checked by tools, human-reviewed), maps
questions to graph concepts and writes explanations from a fixed evidence pack. Statistics are plain code. No image or
video in the app is AI-generated. No NASA logos are used.

## Notes for the team

- The web app converts the engine's formats on the fly (`api/data_access.py`): cell ids `lat36.5_lon10.5` → `36.5_10.5`,
  units `degC per decade` → `°C`, `regional.json` → one table, the curator's graph export → nodes + edges.
- Measured on pure noise (`tests/test_stats.py`): the Hamed–Rao test is a little liberal (about 9% of noise series
  below p = 0.05 instead of 5%; about 2% of noise cells kept after FDR, against ~0% with the original Mann–Kendall).
  Strong trends (temperature, soil moisture) are not affected; a few marginal rainfall cells could be. Worth a line
  in "Limits".
- Hamed–Rao can return `p = NaN` on near-constant series; the engine leaves those cells out of the FDR (`n_tested`).

## Working together

- Every push to `main` redeploys the site once the checks (tests, site build, Docker build) pass. Run `pytest` first.
- Stay inside your folder. If you need something from another folder, ask its owner.
- Changing a contract (a column name, a JSON key) means: tell the group chat, then update `contracts/`, `api/schemas.py` and `web/src/lib/types.ts` in the same PR.
- Region, period, grid, variable ids and paths come from `common/config.py`. Import them, don't retype them.
- Raw NASA files never go in Git (`data/raw/` is ignored). Only small results go in `data/processed/`.
- No NASA logos, flags or mission patches anywhere (submission rule).
