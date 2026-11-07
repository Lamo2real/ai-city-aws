#!/usr/bin/env bash
# Run by the owner. Switches the city on again: re-enables the queue triggers.
set -euo pipefail
cd "$(dirname "$0")/../infra/envs/prod"
REGION="${AWS_REGION:-eu-north-1}"
for uuid in $(terraform output -json event_source_mapping_uuids | python3 -c 'import json,sys; print(" ".join(json.load(sys.stdin).values()))'); do
  aws lambda update-event-source-mapping --region "$REGION" --uuid "$uuid" --enabled >/dev/null
done
echo "AI City is running again. Work that waited in the queues starts now."
