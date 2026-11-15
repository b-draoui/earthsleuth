# EarthSleuth: one container = FastAPI API + the built React site, on one port.
#
#   docker build -t earthsleuth .
#   docker run -p 8000:8000 earthsleuth        -> http://localhost:8000
#
# On Render the platform sets $PORT; the server listens on it.

# ---------------------------------------------------------------- 1. build the site
FROM node:22-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
# a lockfile made on Windows can miss Linux-only optional packages: fall back to npm install
RUN npm ci --no-audit --no-fund || (rm -rf node_modules && npm install --no-audit --no-fund)
COPY web/ ./
# same fallback if the build cannot find a Linux native package
RUN npm run build || (rm -rf node_modules package-lock.json && npm install --no-audit --no-fund && npm run build)

# ---------------------------------------------------------------- 2. the server
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    EARTHSLEUTH_FAKE=0
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY common/ common/
COPY api/ api/
COPY engine/ engine/
COPY agent/ agent/
COPY graph/ graph/
COPY data/ data/
COPY scripts/ scripts/
COPY --from=web /web/dist web/dist

# Prepare the map layers now, on the fast build machine, for both data sources when present
RUN EARTHSLEUTH_FAKE=1 python -m scripts.prebuild_cache /app/cache \
 && EARTHSLEUTH_FAKE=0 python -m scripts.prebuild_cache /app/cache
ENV EARTHSLEUTH_CACHE_DIR=/app/cache
# ...and the investigator's statistics for every region of the graph (about 1.5 min here,
# instead of minutes per question on a 0.1-CPU server)
RUN EARTHSLEUTH_FAKE=0 python -m scripts.prewarm_engine

RUN useradd --create-home --uid 1000 app && chown -R app /app
USER app

EXPOSE 8000
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
