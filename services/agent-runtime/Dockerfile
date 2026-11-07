# AgentCore Runtime image: ARM64, plain HTTP on 8080, one image for all four roles (AIC_ROLE).
# Python 3.13 + the Claude Agent SDK (its wheel bundles the Claude Code CLI, so no Node.js is needed).
# Build from the repo root:  docker build --platform linux/arm64 -f services/agent-runtime/Dockerfile .
FROM --platform=linux/arm64 public.ecr.aws/docker/library/python:3.13-slim-bookworm AS build
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /usr/local/bin/uv
WORKDIR /src
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --extra runtime --no-install-project
COPY backend/src ./src
RUN uv sync --frozen --no-dev --extra runtime --no-editable

FROM --platform=linux/arm64 public.ecr.aws/docker/library/python:3.13-slim-bookworm
# git for workers' branches; bubblewrap so Claude Code can scrub the environment of workers' shell
# commands (CLAUDE_CODE_SUBPROCESS_ENV_SCRUB, set for workers only in Terraform); nothing else. No AWS CLI in the image: agents never change AWS.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates bubblewrap \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 1000 aic
WORKDIR /app
COPY --from=build /src/.venv /app/.venv
COPY config /app/config
COPY agents /app/agents
ENV PATH=/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    AIC_CONFIG_DIR=/app/config \
    AIC_AGENTS_DIR=/app/agents \
    PORT=8080 \
    CLAUDE_CODE_USE_BEDROCK=1 \
    CLAUDE_CODE_DISABLE_1M_CONTEXT=1
RUN mkdir -p /tmp/work && chown aic:aic /tmp/work
USER aic
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/ping').status==200 else 1)"
CMD ["python", "-m", "aic.runtime.server"]
