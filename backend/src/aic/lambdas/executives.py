"""The executives Lambda (decision 140): the optional scheduled reviews, and nothing else.

Every hour EventBridge sends ``{"job": "reviews"}``. Only reviews the owner switched on in Settings → Executives
run (all are off by default), each when it is due; a review is a short report in AIC's chat and never starts work.
With every review off, the function reads one ledger record and returns.
"""

from __future__ import annotations

from typing import Any

from aic.shared.aws import aws_city
from aic.shared.clients import client
from aic.shared.executives import ExecDeps, run_reviews
from aic.shared.log import log
from aic.shared.utility import bedrock_converse_runner

from ._runtime import run


async def handle(event: dict[str, Any], d: ExecDeps) -> dict[str, Any]:
    if event.get("job") != "reviews":
        return {"skipped": "not a review run"}
    return await run_reviews(d)


_deps: ExecDeps | None = None


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    global _deps
    if _deps is None:
        city = aws_city()
        _deps = ExecDeps(
            ledger=city.ledger,
            bus=city.bus,
            runner=bedrock_converse_runner(client(city.session, "bedrock-runtime")),
            settings=city.settings,
            knowledge=None,  # reviews read the city's own records; the knowledge base is read on consultations
        )
    out = run(handle(event, _deps))
    log("info", "exec.reviews", **out)
    return out
