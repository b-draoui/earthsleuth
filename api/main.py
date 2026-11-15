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
    try:
        da.summary()
        da.clusters_geojson()
        da.cells_matrix()
        da.graph()
        for v in VARIABLES:
            da.trends_payload(v, gzipped=True)
        if not USE_FAKE:
            from agent.agent import investigator

            investigator()
        print("EarthSleuth: caches ready")
    except Exception as exc:
        print(f"EarthSleuth: warm-up skipped ({exc!r})")


@asynccontextmanager
async def lifespan(_: FastAPI):
    threading.Thread(target=_warm_up, daemon=True).start()
    yield


app = FastAPI(title="EarthSleuth API", version="0.3.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)

for module in (meta, data, graph, agent):
    app.include_router(module.router, prefix="/api")


@app.exception_handler(FileNotFoundError)
def no_results_yet(_: Request, exc: FileNotFoundError) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"detail": f"Result file missing ({exc.filename}). Run `python -m scripts.make_fake_data` "
                 "and set EARTHSLEUTH_FAKE=1, or run the real pipeline."},
    )


@app.exception_handler(NotImplementedError)
def not_built_yet(_: Request, exc: NotImplementedError) -> JSONResponse:
    return JSONResponse(status_code=501, content={"detail": f"Not built yet: {exc}"})


if WEB_DIST.exists():
    class _CachedStatic(StaticFiles):
        def file_response(self, *args, **kwargs):
            response = super().file_response(*args, **kwargs)
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return response

    app.mount("/assets", _CachedStatic(directory=WEB_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(status_code=404)
        file = (WEB_DIST / path).resolve()
        if path and file.is_file() and file.is_relative_to(WEB_DIST):
            return FileResponse(file)
        return FileResponse(WEB_DIST / "index.html")
