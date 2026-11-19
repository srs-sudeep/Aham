# syntax=docker/dockerfile:1.7
# Build from the REPOSITORY ROOT:  docker build -f services/core-api/Dockerfile -t my-platform-core-api .
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS build
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never

WORKDIR /repo
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv  \
    uv sync --frozen --no-dev --no-editable --package core-api

FROM python:3.12-slim-bookworm AS runtime
RUN groupadd --system app && useradd --system --gid app --home /app app
WORKDIR /app
COPY --from=build --chown=app:app /repo/.venv /app/.venv
COPY --chown=app:app services/core-api/alembic.ini /app/alembic.ini
COPY --chown=app:app services/core-api/alembic /app/alembic
COPY --chown=app:app services/core-api/docker-entrypoint.sh /app/docker-entrypoint.sh
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 ENV=prod
USER app
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health/live', timeout=2).status == 200 else 1)"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["uvicorn", "core_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--no-access-log"]
