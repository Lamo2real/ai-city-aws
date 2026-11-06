#!/usr/bin/env bash
# Run by the owner. Resumes the city: clears the pause flag and re-enables the queue triggers.
set -euo pipefail
cd "$(dirname "$0")/../infra/envs/prod"
REGION="${AWS_REGION:-eu-north-1}"
TABLE="$(terraform output -raw ledger_table)"

aws dynamodb update-item --region "$REGION" --table-name "$TABLE" \
  --key '{"pk":{"S":"CONFIG"},"sk":{"S":"city"}}' \
  --update-expression "SET paused = :f REMOVE pause_reason" \
  --expression-attribute-values '{":f":{"BOOL":false}}'

for uuid in $(terraform output -json event_source_mapping_uuids | python3 -c 'import json,sys; print(" ".join(json.load(sys.stdin).values()))'); do
  aws lambda update-event-source-mapping --region "$REGION" --uuid "$uuid" --enabled >/dev/null
done
echo "AI City is running again. Work that waited in the queues starts now."
