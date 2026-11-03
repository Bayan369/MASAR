# syntax=docker/dockerfile:1
FROM ghcr.io/astral-sh/uv:0.8.22 AS uv
FROM python:3.12-slim-bookworm
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"
COPY pyproject.toml uv.lock ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export SSL_CERT_FILE=/run/secrets/proxy_ca; fi; \
    uv sync --frozen --no-dev --no-install-project
COPY --chown=10001:10001 app ./app
COPY --chown=10001:10001 scripts ./scripts
RUN useradd --uid 10001 --create-home masar
USER 10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD python -c "import http.client,os; c=http.client.HTTPConnection('127.0.0.1',int(os.environ.get('PORT','8000')),timeout=3); c.request('GET','/api/v1/health'); assert c.getresponse().status==200"
CMD ["python", "-m", "scripts.start_server"]
