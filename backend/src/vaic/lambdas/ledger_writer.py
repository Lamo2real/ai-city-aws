"""EventBridge rule → this Lambda: every city event is appended to its ticket's trace in the ledger, and folded
into its job's project board (decision 289).

So a ticket's full story survives. Events are validated; anything else is ignored. A board write that fails is
logged and never loses the trace.
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from vaic.shared.aws import aws_city
from vaic.shared.board import Board
from vaic.shared.events import CityEvent, parse_event
from vaic.shared.ledger import Ledger
from vaic.shared.log import log

from ._runtime import run


def ticket_of(e: CityEvent) -> str | None:
    t = e["type"]
    if t == "ticket.status":
        return str(e["ticket"]["id"])
    if t in (
        "review.result",
        "review.started",
        "review.finished",
        "signoff.result",
        "result",
        "instruction",
        "app.submitted",
        "app.draft",
    ):
        return str(e["ticket_id"])
    if t == "question.asked":
        tid = e["question"].get("ticket_id")
        return str(tid) if tid else None
    return None


async def write_event(raw: dict[str, Any], ledger: Ledger) -> bool:
    try:
        e = parse_event(raw.get("detail") or {})
    except ValidationError:
        return False
    ticket = ticket_of(e)
    if ticket:
        await ledger.append_event(ticket, e)
    try:
        await Board(ledger.table, ledger.get_ticket).project(dict(e))
    except Exception as err:  # the board is a projection: the trace above already holds the event
        log("warn", "board.project_failed", type=e["type"], error=type(err).__name__, detail=str(err)[:300])
    return bool(ticket)


_ledger: Ledger | None = None


def handler(raw: dict[str, Any], _context: Any = None) -> bool:
    global _ledger
    if _ledger is None:
        _ledger = aws_city().ledger
    return run(write_event(raw, _ledger))
