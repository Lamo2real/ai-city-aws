"""The chief-of-staff Lambda (decision 124): decides Needs you items so nothing waits for the owner.

Triggers:
- EventBridge ``question.asked`` / ``approval.requested``: that one item, at once.
- ``{"job": "sweep"}`` every 5 minutes: anything still open and undecided (a missed event, a failed try,
  the switch just turned back on).
- ``{"job": "digest"}`` once a day: one paragraph in VAIC's conversation about what was decided.

Decisions are carried out by the api Lambda (``api.steward_apply``, a direct invoke), so they take the same path
as the owner's clicks. This function itself only reads the ledger, calls its model and writes its own marks.
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from botocore.config import Config

from vaic.shared.aws import aws_city
from vaic.shared.chief_of_staff import ChiefDeps, digest, review
from vaic.shared.clients import client, config_for
from vaic.shared.hierarchy.actions import sweep_stale_asks
from vaic.shared.log import log
from vaic.shared.utility import bedrock_converse_runner

from ._runtime import run


def api_apply(lam: Any, fn: str) -> Any:
    """``lam`` is a boto3 ``lambda`` client; ``fn`` the api function (its ``live`` alias)."""

    async def apply(op: dict[str, Any]) -> dict[str, Any]:
        r = await asyncio.to_thread(
            lam.invoke, FunctionName=fn, InvocationType="RequestResponse", Payload=json.dumps({"chief_of_staff": op})
        )
        out = json.loads(r["Payload"].read() or b"{}")
        if r.get("FunctionError"):
            log("warn", "chief.apply_failed", id=op.get("id"), error=str(out.get("errorType", "unknown")))
            return {"ok": False}
        return out if isinstance(out, dict) else {"ok": False}

    return apply


def item_id(event: dict[str, Any]) -> str | None:
    """The question or approval an EventBridge event is about; None for anything else."""
    detail = event.get("detail") or {}
    if event.get("detail-type") == "question.asked":
        return str((detail.get("question") or {}).get("id") or "") or None
    if event.get("detail-type") == "approval.requested":
        return str(detail.get("id") or "") or None
    return None


async def handle(event: dict[str, Any], d: ChiefDeps) -> dict[str, Any]:
    if event.get("job") == "digest":
        return await digest(d.ledger, d.bus)
    if event.get("job") == "sweep":
        try:  # asks of jobs that already stopped are withdrawn first, never decided
            await sweep_stale_asks(d.ledger, d.bus)
        except Exception as e:
            log("warn", "chief.stale_sweep_failed", error=type(e).__name__)
        return await review(d)
    id = item_id(event)
    if not id:
        return {"skipped": "not a Needs you item"}
    return await review(d, only=id)


_deps: ChiefDeps | None = None


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    global _deps
    if _deps is None:
        city = aws_city()
        _deps = ChiefDeps(
            ledger=city.ledger,
            bus=city.bus,
            runner=bedrock_converse_runner(client(city.session, "bedrock-runtime")),
            settings=city.settings,
            # The api answers within its 30 s; never retried, so a slow call can't carry a decision out twice.
            apply=api_apply(
                city.session.client(
                    "lambda", config=config_for("lambda").merge(Config(read_timeout=40, retries={"max_attempts": 1}))
                ),
                os.environ["VAIC_API_FUNCTION"],
            ),
        )
    out = run(handle(event, _deps))
    log("info", "chief.run", **{k: v for k, v in out.items() if k != "results"})
    return out
