"""Notifications to the owner's email (SNS): completed tasks, spend alerts, and questions that waited more than
15 minutes. Plain words, no IDs beyond a short reference, no content from outside."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from pydantic import ValidationError

from aic.shared.aws import aws_city, require_env
from aic.shared.caps import default_settings
from aic.shared.events import parse_event
from aic.shared.ledger import Ledger

from ._runtime import run

QUESTION_NUDGE_MS = 15 * 60_000


@dataclass(frozen=True)
class Notice:
    subject: str
    message: str


def _fmt(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else str(v)


def notice_for(detail: Any) -> Notice | None:
    try:
        e = parse_event(detail)
    except (ValidationError, TypeError):
        return None
    t = e["type"]
    if t == "result":
        return Notice(
            "AI City: a task is done",
            f"AIC has a result for you. Open AI City to hear it.\n\nSummary: {e['summary'][:300]}",
        )
    if t == "spend.cap_reached":
        return Notice(
            "AI City: spend cap reached",
            f"The {e['cap'].replace('_', ' ')} cap of ${_fmt(e['limit'])} is reached (estimate ${e['spent']:.2f}). "
            "No new work starts until you raise the cap or the period resets.",
        )
    if t == "city.state" and e["paused"]:
        return Notice(
            "AI City is paused", f"{e.get('reason') or 'Paused'}. Work already running finishes; nothing new starts."
        )
    return None


async def stale_questions(ledger: Ledger) -> list[Notice]:
    """Questions open for more than 15 minutes, each nudged once."""
    now = ledger.now_ms()
    out: list[Notice] = []
    for q in await ledger.open_questions():
        created = int(datetime.fromisoformat(q["created_at"].replace("Z", "+00:00")).timestamp() * 1000)
        if now - created < QUESTION_NUDGE_MS:
            continue
        if not await ledger.claim(f"nudge:{q['id']}", 30 * 86_400):
            continue
        out.append(
            Notice(
                "AI City: a question is waiting for you",
                f"{q['path']} asks: {q['text'][:300]}\nDefault if you don't answer: {q['default_answer']}",
            )
        )
    return out


async def deliver(notices: list[Notice], sns: Any, topic_arn: str, enabled: bool) -> int:
    if not enabled:
        return 0
    for n in notices:
        await asyncio.to_thread(sns.publish, TopicArn=topic_arn, Subject=n.subject[:99], Message=n.message)
    return len(notices)


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, int]:
    city = aws_city()
    sns = city.session.client("sns")

    async def go() -> int:
        settings = await city.ledger.settings(default_settings())
        if event.get("job") == "nudge":
            notices = await stale_questions(city.ledger)
        else:
            n = notice_for(event.get("detail"))
            notices = [n] if n else []
        return await deliver(notices, sns, require_env("AIC_NOTIFY_TOPIC_ARN"), bool(settings.get("notify_email")))

    return {"sent": run(go())}
