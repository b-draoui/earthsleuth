"""Layer 6, back end: the FastAPI server.

Development (two terminals, from the repo root):
    uvicorn api.main:app --reload --port 8000
    cd web && npm run dev            -> open http://localhost:5173

Production (one server, one port):
    cd web && npm run build
    uvicorn api.main:app --port 8000 -> FastAPI also serves the built site from web/dist

Interactive API docs: http://localhost:8000/docs
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from api.routes import agent, data, graph, meta

WEB_DIST = (Path(__file__).resolve().parents[1] / "web" / "dist").resolve()

app = FastAPI(title="EarthSleuth API", version="0.1.0")

for module in (meta, data, graph, agent):
    app.include_router(module.router, prefix="/api")


@app.exception_handler(NotImplementedError)
def not_built_yet(_: Request, exc: NotImplementedError) -> JSONResponse:
    """Stubs raise NotImplementedError; the front end gets a clear 501 instead of a crash."""
    return JSONResponse(status_code=501, content={"detail": f"Not built yet: {exc}"})


# ---------------------------------------------------------------- built React site
if WEB_DIST.exists():
    app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        """Any non-API URL returns index.html, so React Router can handle /explore, /radar..."""
        if path.startswith("api/"):
            raise HTTPException(status_code=404)
        file = (WEB_DIST / path).resolve()
        if path and file.is_file() and file.is_relative_to(WEB_DIST):
            return FileResponse(file)  # favicon and other files in web/public
        return FileResponse(WEB_DIST / "index.html")
