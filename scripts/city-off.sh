#!/usr/bin/env bash
# Run by the owner, never by an agent. Switches the city off for a while: disables the four queue
# triggers (no messages are even picked up). Work already running finishes within the turn timeout.
# Nothing is deleted; queued work waits. (There is no pause flag: the city is always on otherwise.)
# Needs: an AWS SSO session (aws sso login), terraform outputs from infra/envs/prod.
set -euo pipefail
cd "$(dirname "$0")/../infra/envs/prod"
REGION="${AWS_REGION:-eu-north-1}"
for uuid in $(terraform output -json event_source_mapping_uuids | python3 -c 'import json,sys; print(" ".join(json.load(sys.stdin).values()))'); do
  aws lambda update-event-source-mapping --region "$REGION" --uuid "$uuid" --no-enabled >/dev/null
done

echo "AI City is switched off. Still costing money: S3 storage, CloudWatch logs, KMS keys, Secrets Manager secrets, WAF web ACL, DynamoDB storage, CloudFront requests."
echo "Switch it on again with scripts/city-on.sh."
