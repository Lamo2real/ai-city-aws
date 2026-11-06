# AgentCore Runtime image: ARM64, plain HTTP on 8080, one image for all four roles (AIC_ROLE).
# Build from the repo root:  docker build --platform linux/arm64 -f services/agent-runtime/Dockerfile .
FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:24-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/agent-runtime/package.json services/agent-runtime/
RUN npm ci --workspace @aic/shared --workspace @aic/agent-runtime --include-workspace-root --ignore-scripts
COPY config config
COPY packages/shared packages/shared
COPY services/agent-runtime services/agent-runtime
RUN npx esbuild services/agent-runtime/src/server.ts --bundle --platform=node --target=node24 --format=esm \
      --outfile=dist/server.mjs --external:@anthropic-ai/claude-agent-sdk \
      --banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);"

FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:24-bookworm-slim
# git for workers' branches; nothing else. No AWS CLI in the image: agents never change AWS.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /src/dist/server.mjs ./server.mjs
COPY --from=build /src/node_modules/@anthropic-ai ./node_modules/@anthropic-ai
COPY agents ./agents
ENV NODE_ENV=production \
    AIC_RUNTIME_MAIN=1 \
    AIC_AGENTS_DIR=/app/agents \
    PORT=8080 \
    CLAUDE_CODE_USE_BEDROCK=1 \
    CLAUDE_CODE_DISABLE_1M_CONTEXT=1 \
    CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1
RUN mkdir -p /tmp/work && chown node:node /tmp/work
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8080/ping').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
