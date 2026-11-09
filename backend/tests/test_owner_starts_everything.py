"""The owner's rule (2026-11-09, decision 138): nothing starts unless the owner said so to VAIC.

"Don't start on anything unless I have explicitly said okay… Ace will instruct the orchestrator… it's not just
projects. It could be anything." Every scheduled job runs on an empty city and starts nothing; the company brief is
off by default; a schedule or the business mode can only be set on the owner's own message; turning the business
off stops its tickets and handoffs. Fake models only.
"""

from __future__ import annotations

from aic.lambdas.api import handle_http
from aic.lambdas.scheduler import run_job
from aic.runtime.tools import TurnCtx
from aic.shared import company
from aic.shared import standing_orders as so
from aic.shared import support_desk as desk
from test_api import ev, js, make
from test_apps import city_deps, tool


def _ace(from_owner: bool) -> TurnCtx:
    return TurnCtx(agent_id="ace", role="ace", department=None, ticket_id="conv-main", task_id="conv-main",
                   from_owner=from_owner)  # fmt: skip


async def test_an_untouched_city_starts_nothing_on_any_schedule() -> None:
    d = make()
    for job in ("standing_orders", "sweep", "retire_idle", "reminders"):
        await run_job(job, d.ledger, d.queue, d.bus)  # type: ignore[arg-type]
    assert d.queue.sent == []
    assert await d.ledger.list_tickets(("open", "in_progress")) == []
    assert await so.list_orders(d.ledger) == [] and await desk.list_tickets(d.ledger) == []
    assert js(await handle_http(ev("GET", "/company"), d)) == {"brief": None, "orders": []}


async def test_only_the_owners_own_message_sets_a_schedule_or_runs_the_business() -> None:
    d = city_deps()
    for name, args in (
        ("add_standing_order", {"source": "Slack #support", "instructions": "Answer."}),
        ("set_company_brief", {"text": "An online shop like Zalando.", "running": True}),
    ):
        out = await tool(d, _ace(False), name)(args)  # a report, a reminder, a connector's message: not the owner
        assert "Only the owner's own message" in out
    assert await so.list_orders(d.ledger) == [] and await company.get_brief(d.ledger) is None
    # Describing the business starts nothing; only "run it" does.
    await tool(d, _ace(True), "set_company_brief")({"text": "An online shop like Zalando."})
    assert (await company.get_brief(d.ledger))["running"] is False  # type: ignore[index]
    assert await so.list_orders(d.ledger) == []
    out = await tool(d, _ace(True), "set_company_brief")({"running": True})
    b = await company.get_brief(d.ledger)
    assert (
        "runs on its own" in out and b is not None and b["running_since"] and len(await so.list_orders(d.ledger)) == 3
    )


async def test_turning_the_business_off_stops_its_tickets_and_handoffs() -> None:
    d = make()
    await company.set_brief(d.ledger, {"text": "An online shop.", "running": True})
    t, _ = await desk.open_ticket(
        d,
        {"title": "Checkout broken", "channel": "chat", "department": "Application", "order_id": "so-company-support"},
        "Customer Support",
    )
    await company.set_brief(d.ledger, {"running": False})
    assert not any(o["enabled"] for o in await company.operating_orders(d.ledger))
    await run_job("standing_orders", d.ledger, d.queue, d.bus)
    assert d.queue.sent == [] and (await desk.get_ticket(d.ledger, t["id"]))["status"] == "new"  # type: ignore[index]
    await company.set_brief(d.ledger, {"running": True})
    await run_job("standing_orders", d.ledger, d.queue, d.bus)
    assert (await desk.get_ticket(d.ledger, t["id"]))["status"] == "with_team"  # type: ignore[index]
