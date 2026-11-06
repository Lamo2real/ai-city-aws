#!/usr/bin/env bash
# Run by the owner, never by an agent. Pauses the city: sets the pause flag (the dispatcher starts
# no new turns) and disables the four queue triggers (no messages are even picked up). Work already
# running finishes within the turn timeout. Nothing is deleted; queued work waits.
# Needs: an AWS SSO session (aws sso login), terraform outputs from infra/envs/prod.
set -euo pipefail
cd "$(dirname "$0")/../infra/envs/prod"
REGION="${AWS_REGION:-eu-north-1}"
TABLE="$(terraform output -raw ledger_table)"
REASON="${1:-Paused by the owner with city-off.sh}"

aws dynamodb update-item --region "$REGION" --table-name "$TABLE" \
  --key '{"pk":{"S":"CONFIG"},"sk":{"S":"city"}}' \
  --update-expression "SET paused = :t, pause_reason = :r" \
  --expression-attribute-values "{\":t\":{\"BOOL\":true},\":r\":{\"S\":\"${REASON//\"/}\"}}"

for uuid in $(terraform output -json event_source_mapping_uuids | python3 -c 'import json,sys; print(" ".join(json.load(sys.stdin).values()))'); do
  aws lambda update-event-source-mapping --region "$REGION" --uuid "$uuid" --no-enabled >/dev/null
done

echo "AI City is paused. Still costing money while paused: S3 storage, CloudWatch logs, KMS keys, Secrets Manager secrets, WAF web ACL, DynamoDB storage, CloudFront requests."
echo "Resume with scripts/city-on.sh."
