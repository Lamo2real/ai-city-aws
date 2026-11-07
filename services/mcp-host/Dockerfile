# MCP host image (docs/CONNECTORS_SKILLS.md §1.10): ARM64, plain HTTP on 8080, one generic image for every package connector.
# Node 22 LTS + npm and Python 3.13 + uv to install npm and PyPI MCP servers at the exact approved version, and server.py
# (standard library only) to run one over stdio. No city code, no AWS CLI, no credentials.
# Build with this folder as the context:  docker build --platform linux/arm64 -f services/mcp-host/Dockerfile services/mcp-host
FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:22-bookworm-slim AS node

FROM --platform=linux/arm64 public.ecr.aws/docker/library/python:3.13-slim-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /usr/local/bin/uv
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 1000 mcp \
 && mkdir -p /tmp/pkg /tmp/home \
 && chown mcp:mcp /tmp/pkg /tmp/home
WORKDIR /app
COPY server.py /app/server.py
ENV PYTHONUNBUFFERED=1 \
    PORT=8080 \
    MCP_HOST_PKG_DIR=/tmp/pkg \
    UV_PYTHON_DOWNLOADS=never \
    NPM_CONFIG_UPDATE_NOTIFIER=false
USER mcp
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/ping').status==200 else 1)"
CMD ["python", "/app/server.py"]
