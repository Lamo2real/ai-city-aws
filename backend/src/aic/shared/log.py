"""Structured JSON logs.

Never log prompts, model output, tool input or secrets: only ids, counts and outcomes. Fields whose names
suggest content or credentials are dropped before writing.
"""

from __future__ import annotations

import json
import re
import sys
import time
from datetime import UTC, datetime

_BANNED = re.compile(r"prompt|content|text|message_body|secret|token|password|authorization|cookie|key$", re.I)

LogValue = str | int | float | bool | None


def safe_fields(fields: dict[str, LogValue]) -> dict[str, LogValue]:
    out: dict[str, LogValue] = {}
    for k, v in fields.items():
        if not _BANNED.search(k):
            out[k] = v[:200] if isinstance(v, str) else v
    return out


def log(level: str, event: str, **fields: LogValue) -> None:
    line = json.dumps({"level": level, "event": event, "ts": datetime.now(UTC).isoformat(), **safe_fields(fields)})
    print(line, file=sys.stderr, flush=True)


def metric(dimensions: dict[str, str], values: dict[str, float]) -> None:
    """CloudWatch embedded metric format: one line becomes metrics in namespace ``AIC`` for the dashboard."""
    line = {
        "_aws": {
            "Timestamp": int(time.time() * 1000),
            "CloudWatchMetrics": [
                {
                    "Namespace": "AIC",
                    "Dimensions": [list(dimensions)],
                    "Metrics": [{"Name": n, "Unit": "None" if n.endswith("Usd") else "Count"} for n in values],
                }
            ],
        },
        **dimensions,
        **values,
    }
    print(json.dumps(line), flush=True)
