"""The owner's ad spend limit (decision 240): the one approval gate left, set by talking to VAIC."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

from test_owner_api import turn, wired
from vaic.runtime.tools import TurnCtx, file_approval
from vaic.shared.ad_spend import AdLimitStore, planned_spend, spend_ask
from vaic.shared.chief_of_staff import _waiting
from vaic.shared.policy import action_hash, gate
from vaic.shared.table import MemoryTable

NOW = datetime(2026, 11, 11, tzinfo=UTC)
META = "mcp__gateway__meta-ads___create_adset"


def campaign(total_usd: float, name: str = "Spring sale") -> dict[str, Any]:
    """A Meta ad set: a daily budget (in cents, as Meta takes it) over ten days, so the total is ``total_usd``."""
    return {
        "name": name,
        "status": "ACTIVE",
        "daily_budget": int(total_usd * 100 / 10),
        "start_time": "2026-11-12T00:00:00Z",
        "end_time": "2026-11-22T00:00:00Z",
    }


async def check(table: MemoryTable, args: dict[str, Any], role: str = "worker", approved: bool = False) -> Any:
    async def consume(_: str) -> bool:
        return approved

    ask = await spend_ask(table, META, args, NOW)
    return await gate(META, args, role, "w1", consume_approval=consume, spend_ask=ask)


# ---------- reading the planned total from a call ----------
@pytest.mark.parametrize(
    ("tool", "args", "total"),
    [
        (META, campaign(400), 400),
        ("mcp__gateway__meta-ads___create_campaign", {"name": "X", "lifetime_budget": "60000"}, 600),
        (
            "mcp__gateway__google-ads___create_campaign_budget",
            {"amount_micros": 50_000_000, "start_date": "2026-11-12", "end_date": "2026-11-15"},
            150,
        ),
        ("mcp__gateway__google-ads___create_campaign", {"campaign": {"total_amount_micros": 9_000_000_000}}, 9000),
        (
            "Bash",
            {
                "command": "curl -X POST https://graph.facebook.com/v21.0/act_1/adsets -F 'name=Big' "
                "-F 'lifetime_budget=120000' -F 'status=ACTIVE'"
            },
            1200,
        ),
    ],
)
def test_the_planned_total_is_daily_times_days_or_the_lifetime_budget(
    tool: str, args: dict[str, Any], total: float
) -> None:
    s = planned_spend(tool, args, NOW)
    assert s is not None and s.total == pytest.approx(total)


def test_calls_that_set_no_budget_are_not_ad_spend_and_an_open_end_has_no_total() -> None:
    assert planned_spend(META, {"name": "x", "status": "PAUSED"}, NOW) is None
    assert planned_spend("Bash", {"command": "echo daily_budget=5"}, NOW) is None  # not an ads API
    assert planned_spend("mcp__gateway__gh___create_issue", {"title": "budget"}, NOW) is None
    open_ended = planned_spend(META, {"name": "x", "daily_budget": 1000}, NOW)
    assert open_ended is not None and open_ended.total is None and "no end date" in open_ended.detail


# ---------- the owner's scenarios ----------
async def test_set_500_then_1000_then_confirm_then_remove() -> None:
    table = MemoryTable()
    store = AdLimitStore(table, lambda: NOW)
    assert (await check(table, campaign(5000))).decision == "allow"  # no limit set: no limit
    await store.set(500, "USD")
    assert (await check(table, campaign(400))).decision == "allow"
    held = await check(table, campaign(600))
    assert held.decision == "deny" and held.needs_approval and held.needs_approval.kind == "ad.spend"
    assert "Meta" in held.reason and "Spring sale" in held.reason and "600" in held.reason and "500" in held.reason
    assert "don't ask again with ask_owner" in held.reason
    await store.set(1000, "USD")  # replaces the old value
    assert (await check(table, campaign(600))).decision == "allow"
    assert (await check(table, campaign(1200))).needs_approval is not None
    assert (await check(table, campaign(1200), approved=True)).decision == "allow"  # the owner confirmed it
    await store.remove()
    assert (await check(table, campaign(1200))).decision == "allow"  # no limit, no check
    hist = await store.history()
    assert [(h["action"], h["amount"]) for h in hist] == [("removed", None), ("set", 1000), ("set", 500)]
    assert all(h["at"] for h in hist)


async def test_raising_a_running_campaigns_budget_above_the_limit_asks_too() -> None:
    table = MemoryTable()
    await AdLimitStore(table, lambda: NOW).set(500, "USD")
    raise_it = {"adset_id": "123", "daily_budget": 8000, "end_time": "2026-11-21T00:00:00Z"}  # 80 a day for 10 days
    r = await gate("mcp__gateway__meta-ads___update_adset", raise_it, "manager", "m1",
                   spend_ask=await spend_ask(table, "mcp__gateway__meta-ads___update_adset", raise_it, NOW))  # fmt: skip
    assert r.needs_approval is not None and "123" in r.reason


async def test_a_deny_in_the_policy_file_still_wins_and_workers_are_checked_even_with_the_policy_off() -> None:
    table = MemoryTable()
    await AdLimitStore(table, lambda: NOW).set(500, "USD")
    off = {"policy_applies_to_workers": False, "rules": []}
    ask = await spend_ask(table, META, campaign(600), NOW)
    r = await gate(META, campaign(600), "worker", "w1", policy=off, spend_ask=ask)
    assert r.needs_approval is not None


# ---------- any agent, any department, on the agents' own engine ----------
async def test_an_agent_outside_marketing_is_checked_on_the_sdk_path() -> None:
    from claude_agent_sdk import PermissionResultAllow, PermissionResultDeny

    from test_gateway import gw_spec, sdk

    ran: list[str] = []
    o, req = sdk([gw_spec("meta-ads___create_adset", ran)])
    req.ctx.role, req.ctx.department = "worker", "Finance"
    filed: list[Any] = []

    async def on_needs(tool: str, args: dict[str, Any], need: Any) -> None:
        filed.append((tool, need.kind))

    req.on_needs_approval = on_needs
    await AdLimitStore(req.ledger.table).set(500, "USD")
    small = await o.can_use_tool(META, campaign(400), None)
    assert isinstance(small, PermissionResultAllow)
    big = await o.can_use_tool(META, campaign(600), None)
    assert isinstance(big, PermissionResultDeny) and "ad spend limit" in big.message
    assert filed == [(META, "ad.spend")]


# ---------- the owner talks to VAIC ----------
async def test_vaic_sets_replaces_reads_and_removes_the_limit_on_the_owners_word() -> None:
    _, _, t = wired()
    tool = t["ad_spend_limit"]
    assert "no ad spend limit" in await tool.handler({"action": "get"})
    assert "500 USD per campaign" in await tool.handler({"action": "set", "amount": 500, "currency": "usd"})
    assert "1,000 USD per campaign" in await tool.handler({"action": "set", "amount": 1000, "currency": "USD"})
    assert "1,000 USD" in await tool.handler({"action": "get"})
    hist = await tool.handler({"action": "history"})
    assert "set to 1,000 USD" in hist and "set to 500 USD" in hist
    assert "Removed" in await tool.handler({"action": "remove"})
    assert "no ad spend limit" in await tool.handler({"action": "get"})
    assert "must be an amount above zero" in await tool.handler({"action": "set", "amount": 0})


async def test_only_the_owners_own_message_changes_the_limit_and_only_vaic_has_the_tool() -> None:
    c, _, t = wired(from_owner=False)
    assert "Only the owner's own message" in await t["ad_spend_limit"].handler({"action": "set", "amount": 1})
    assert await AdLimitStore(c.deps.ledger.table).get() is None
    for role in ("orchestrator", "manager", "worker"):
        assert "ad_spend_limit" not in turn(c, role=role)


async def test_a_held_campaign_waits_for_the_owner_alone_and_their_yes_lets_the_same_call_start() -> None:
    c, _, t = wired()
    await t["ad_spend_limit"].handler({"action": "set", "amount": 500, "currency": "USD"})
    table, ledger = c.deps.ledger.table, c.deps.ledger
    args = campaign(600)
    r = await gate(META, args, "worker", "w1", consume_approval=ledger.consume_approval,
                   spend_ask=await spend_ask(table, META, args, NOW))  # fmt: skip
    assert r.needs_approval is not None
    ctx = TurnCtx(agent_id="w1", role="worker", department="Finance", ticket_id="t-1", task_id="t-1")
    await file_approval(c.deps, ctx, META, args, r.needs_approval.hash, r.needs_approval.reason, kind="ad.spend")
    (ap,) = await ledger.pending_approvals()
    assert ap["kind"] == "ad.spend" and ap["hash"] == action_hash(META, args)
    assert not _waiting(ap, True) and not _waiting(ap, False)  # neither the Chief of Staff nor Autopilot decides it
    ev = [e for e in c.bus.events if e["type"] == "approval.requested"][-1]
    assert ev["kind"] == "ad.spend" and "600" in ev["reason"]  # the chat card shows amount, platform, campaign
    assert "Waiting for the owner" in await turn(c)["ad_spend_limit"].handler({"action": "get"})
    out = await turn(c)["ad_spend_limit"].handler({"action": "confirm"})  # the owner typed "yes, start it"
    assert out.startswith("Confirmed")
    again = await gate(META, args, "worker", "w1", consume_approval=ledger.consume_approval,
                       spend_ask=await spend_ask(table, META, args, NOW))  # fmt: skip
    assert again.decision == "allow"
    assert "No ad campaign is waiting" in await turn(c)["ad_spend_limit"].handler({"action": "refuse"})
