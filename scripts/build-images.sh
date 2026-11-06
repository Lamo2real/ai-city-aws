#!/usr/bin/env bash
# Builds the agent runtime image locally for ARM64, to check the Dockerfile. It never pushes: pushing is
# done by `terraform apply` (scripts/push-image.sh) inside deploy.yml, after the owner approves.
set -euo pipefail
cd "$(dirname "$0")/.."
TAG="${1:-$(git rev-parse --short HEAD)}"
docker build --platform linux/arm64 -f services/agent-runtime/Dockerfile -t "aic-agent-runtime:${TAG}" .
echo "Built aic-agent-runtime:${TAG} (local only, not pushed)."
