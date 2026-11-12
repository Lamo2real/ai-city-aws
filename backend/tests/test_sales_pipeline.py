"""The sales pipeline (decision 133): AI City's own deal board and Sales' daily follow-ups. Fake models only; no
CRM or mail is called."""

from __future__ import annotations

from datetime import timedelta

from test_api import Clock, ev, js, make
from test_apps import city_deps, tool
from vaic.lambdas.api import handle_http
from vaic.lambdas.scheduler import run_job
from vaic.runtime.tools import TurnCtx
from vaic.shared import sales_pipeline as deals
from vaic.shared import standing_orders as so

SALES = TurnCtx(agent_id="wkr-s", role="worker", department="Sales", ticket_id="t1", task_id="t1")
VAIC = TurnCtx(agent_id="vaic", role="vaic", department=None, ticket_id="conv-main", task_id="conv-main")


async def test_deals_are_added_moved_and_go_stale_after_a_week_without_contact() -> None:
    clock = Clock()
    d = make(clock)
    a = await deals.add_deal(d.ledger, {"name": "Acme", "contact": "Bo", "value": "$5,000", "currency": "usd"}, "VAIC")
    b = await deals.add_deal(d.ledger, {"company": "Globex", "stage": "won"}, "VAIC")
    assert (a["stage"], a["value"], a["currency"], a["words"]) == ("lead", 5000.0, "USD", "New lead")
    clock.t += timedelta(days=8)
    assert [x["id"] for x in await deals.list_deals(d.ledger, stale_days=7)] == [a["id"]]  # won is never chased
    up = await deals.update_deal(d.ledger, a["id"], {"contacted": True, "stage": "proposal", "note": "Sent it."}, "x")
    assert (
        up is not None
        and up["stage"] == "proposal"
        and up["history"][-1]["text"] == "Now proposal sent. Followed up. Sent it."
    )
    assert await deals.list_deals(d.ledger, stale_days=7) == []
    r = js(await handle_http(ev("GET", "/deals?stage=open"), d))
    assert [x["id"] for x in r["deals"]] == [a["id"]] and r["stale_days"] == 7
    assert b["id"] not in str(r)
    for bad in ({"name": ""}, {"name": "x", "stage": "maybe"}, {"name": "x", "value": "-3"}):
        try:
            await deals.add_deal(d.ledger, bad, "x")
            raise AssertionError(bad)
        except deals.Invalid:
            pass


async def test_sales_and_vaic_use_the_board_through_tools() -> None:
    d = city_deps()
    assert "Added deal-" in await tool(d, VAIC, "add_deal")({"name": "Initech", "contact": "Peter", "value": "1200"})
    [x] = await deals.list_deals(d.ledger)
    assert "Initech (Peter) [New lead, 1200" in await tool(d, SALES, "list_deals")({})
    out = await tool(d, SALES, "update_deal")({"id": x["id"], "contacted": True, "next_step": "Call on Friday"})
    assert "next: Call on Friday" in out
    assert "no deal with that id" in await tool(d, SALES, "update_deal")({"id": "deal-0", "note": "x"})


async def test_a_daily_sales_order_follows_up_once_per_deal_per_day() -> None:
    clock = Clock()
    d = make(clock)
    o = await so.add_order(
        d.ledger,
        {
            "source": "the sales pipeline",
            "instructions": "Follow up on stale deals.",
            "department": "Sales",
            "every_minutes": 1440,
        },
    )
    await run_job("standing_orders", d.ledger, d.queue, d.bus)
    body = d.queue.sent[-1]["body"]
    assert "Give every part to the Sales department" in body and "no contact for 7 days" in body
    assert "item '<deal id>#2026-11-06'" in body and "list_deals (stale_days 7, team Sales)" in body
    assert "open_ticket" not in body
    assert "list_deals" not in so.goal_text({**o, "department": "Customer Support"}, [])
