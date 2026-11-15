"""Layer 6, back end: the FastAPI server.

Development (two terminals, from the repo root):
    uvicorn api.main:app --reload --port 8000
    cd web && npm run dev            -> open http://localhost:5173

Production (one server, one port):
    cd web && npm run build
    uvicorn api.main:app --port 8000 -> FastAPI also serves the built site from web/dist

Interactive API docs: http://localhost:8000/docs
"""

import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from api import data_access as da
from api.routes import agent, data, graph, meta
from common.config import USE_FAKE, VARIABLES

WEB_DIST = (Path(__file__).resolve().parents[1] / "web" / "dist").resolve()


def _warm_up() -> None:
    """Read the result files and prepare the map layers once, in the background, so the first
    visitor does not wait (a free server has a small CPU)."""
    try:
        da.summary()
        da.clusters_geojson()
        da.cells_matrix()
        da.graph()
        for v in VARIABLES:
            da.trends_payload(v, gzipped=True)
        if not USE_FAKE:
            from agent.agent import investigator

            investigator()  # load the engine and the graph before the first question
        print("EarthSleuth: caches ready")
    except Exception as exc:  # noqa: BLE001  (missing files: the routes report it properly)
        print(f"EarthSleuth: warm-up skipped ({exc!r})")


@asynccontextmanager
async def lifespan(_: FastAPI):
    threading.Thread(target=_warm_up, daemon=True).start()
    yield


app = FastAPI(title="EarthSleuth API", version="0.3.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)  # map GeoJSON shrinks ~5x

for module in (meta, data, graph, agent):
    app.include_router(module.router, prefix="/api")


@app.exception_handler(FileNotFoundError)
def no_results_yet(_: Request, exc: FileNotFoundError) -> JSONResponse:
    """Result files missing: say how to make them instead of a 500."""
    return JSONResponse(
        status_code=503,
        content={"detail": f"Result file missing ({exc.filename}). Run `python -m scripts.make_fake_data` "
                 "and set EARTHSLEUTH_FAKE=1, or run the real pipeline."},
    )


@app.exception_handler(NotImplementedError)
def not_built_yet(_: Request, exc: NotImplementedError) -> JSONResponse:
    """Stubs raise NotImplementedError; the front end gets a clear 501 instead of a crash."""
    return JSONResponse(status_code=501, content={"detail": f"Not built yet: {exc}"})


# ---------------------------------------------------------------- built React site
if WEB_DIST.exists():
    # file names in /assets contain a content hash, so browsers may keep them for a year
    class _CachedStatic(StaticFiles):
        def file_response(self, *args, **kwargs):
            response = super().file_response(*args, **kwargs)
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return response

    app.mount("/assets", _CachedStatic(directory=WEB_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        """Any non-API URL returns index.html, so React Router can handle /explore, /radar..."""
        if path.startswith("api/"):
            raise HTTPException(status_code=404)
        file = (WEB_DIST / path).resolve()
        if path and file.is_file() and file.is_relative_to(WEB_DIST):
            return FileResponse(file)  # favicon and other files in web/public
        return FileResponse(WEB_DIST / "index.html")
