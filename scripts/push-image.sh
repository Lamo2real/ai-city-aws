#!/usr/bin/env bash
# Called by Terraform (terraform_data.image in infra/modules/agents) during `terraform apply`, after the
# ECR repository exists and before the runtimes are created, so a single reviewed plan can deploy from
# nothing. Builds the agent runtime image for ARM64 and pushes it. The repository's tags are immutable,
# so an image that is already there is left alone. Needs Docker with buildx (and QEMU on x86 runners).
# Never run from an agent session: deploy.yml runs it, after the owner approves the plan.
set -euo pipefail
: "${REPO_URL:?}" "${IMAGE_TAG:?}" "${AWS_REGION:?}" "${CONTEXT_DIR:?}"

REPO_NAME="${REPO_URL#*/}"
if aws ecr describe-images --region "$AWS_REGION" --repository-name "$REPO_NAME" \
  --image-ids "imageTag=${IMAGE_TAG}" >/dev/null 2>&1; then
  echo "Image ${REPO_URL}:${IMAGE_TAG} is already in ECR."
  exit 0
fi

aws ecr get-login-password --region "$AWS_REGION" |
  docker login --username AWS --password-stdin "${REPO_URL%%/*}"
docker buildx build --platform linux/arm64 \
  -f "${CONTEXT_DIR}/services/agent-runtime/Dockerfile" \
  -t "${REPO_URL}:${IMAGE_TAG}" --provenance=false --push "$CONTEXT_DIR"
echo "Pushed ${REPO_URL}:${IMAGE_TAG}."
