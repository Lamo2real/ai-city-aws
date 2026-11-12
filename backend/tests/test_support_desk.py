"""The support desk (decision 131): Slack message → ticket → responsible department → reply in the same thread.

Fake models and a fake Slack: the scripted workers write to ``SLACK`` where a real worker would call the Slack
connector. Nothing here talks to Slack, Jira or Bedrock.
"""

from __future__ import annotations

import re
from datetime import timedelta

from city_support import Call, make_city, scripted_engine
from test_api import Clock, ev, js, make
from test_apps import city_deps, tool
from vaic.lambdas.api import handle_http
from vaic.lambdas.scheduler import run_job
from vaic.runtime.engine import EngineRequest
from vaic.runtime.tools import TurnCtx
from vaic.shared import standing_orders as so
from vaic.shared import support_desk as desk
from vaic.shared.hierarchy.actions import FINAL
from vaic.shared.ids import manager_id
from vaic.shared.ledger import ALL_STATUSES

SLACK: list[dict[str, str]] = []
"""What the fake Slack received: {channel, thread, text}."""
INBOX = [{"channel": "#support", "ts": "1731150000.0001", "user": "Dana (support rep)",
          "text": "Customer Acme can't log in since this morning, error 500 on /login."}]  # fmt: skip
TICKET = re.compile(r"\b(st-\d{4}-\d{5})\b")


async def _goal(req: EngineRequest) -> str:
    t = await req.ledger.get_ticket(req.ctx.ticket_id)
    return str((t or {}).get("goal") or "")


async def vaic(req: EngineRequest, call: Call) -> str:
    return "Noted."


async def orchestrator(req: EngineRequest, call: Call) -> str:
    """The board's planner, for a job whose department isn't standing yet (decision 298)."""
    dept = re.search(r"Give every part to the (.+?) department", req.turn.prompt).group(1)  # type: ignore[union-attr]
    await call("add_part", {"name": "The job", "goal": await _goal(req), "acceptance": "done", "department": dept})
    await call("finish_plan", {})
    return "Planned."


async def manager(req: EngineRequest, call: Call) -> str:
    """A department's reviewer on the board: one review of the part it was sent."""
    if "Board review" in req.turn.prompt:
        await call("review", {"ticket_id": req.ctx.ticket_id, "verdict": "PASS", "reasons": "Meets the acceptance."})
    return "Reviewed."


async def departments(city: object, *names: str) -> None:
    for n in names:
        await city.ledger.create_department(n, f"The {n} team.", manager_id(n))  # type: ignore[attr-defined]


async def worker(req: EngineRequest, call: Call) -> str:
    goal = await _goal(req)
    if goal.startswith("Standing order"):  # intake: Customer Support reads Slack
        order = re.search(r"order_id (so-\w+)", goal).group(1)  # type: ignore[union-attr]
        for m in INBOX:
            if m["ts"] in goal:
                continue
            out = await call("open_ticket", {"title": "Customer can't log in (error 500)", "details": m["text"],
                                             "customer": "Acme", "channel": "slack", "where": m["channel"],
                                             "thread": m["ts"], "department": "IT Infrastructure",
                                             "order_id": order})  # fmt: skip
            SLACK.append({"channel": m["channel"], "thread": m["ts"], "text": f"Got it, we're on it. {out[:40]}"})
            await call("record_handled", {"order_id": order, "item": m["ts"], "summary": "Ticket opened."})
        summary = "Handled new messages."
    elif "is fixed:" in goal:  # the reply
        tid = TICKET.search(goal).group(1)  # type: ignore[union-attr]
        thread = re.search(r"thread (\S+) \(the reporter", goal).group(1)  # type: ignore[union-attr]
        SLACK.append({"channel": "#support", "thread": thread, "text": "Fixed: login works again. Reach out any time."})
        await call("ticket_replied", {"ticket": tid, "summary": "Told Dana in the thread."})
        summary = "Replied in the thread."
    else:  # the department's fix
        tid = TICKET.search(goal).group(1)  # type: ignore[union-attr]
        await call("ticket_note", {"ticket": tid, "text": "Found an expired certificate on the login service."})
        await call("ticket_fixed", {"ticket": tid, "summary": "We renewed the login certificate; sign-in works again."})
        summary = "Fixed the login."
    await call("report_to_manager", {"summary": summary, "artifacts": [], "checks": "ok"})
    return "Reported."


async def test_a_slack_message_becomes_a_ticket_is_fixed_by_it_and_the_reporter_is_told_in_the_thread() -> None:
    SLACK.clear()
    city = make_city(scripted_engine({"vaic": vaic, "orchestrator": orchestrator, "manager": manager,
                                      "worker": worker}))  # fmt: skip
    await city.host.ensure_core()
    await departments(city, "Customer Support", "IT Infrastructure")
    o = await so.add_order(city.ledger, {"source": "Slack #support", "instructions": "Answer new messages."})
    d = city.deps

    async def beat() -> dict[str, int]:
        out = {**(await so.run_due(d)), **(await desk.advance(d))}
        await city.run()
        city.advance(16 * 60_000)
        return out

    await beat()  # intake → IT fixes it → Support tells the reporter: one beat, no waiting for the next (decision 241)
    [t] = await desk.list_tickets(city.ledger)
    assert (t["department"], t["channel"], t["thread"]) == ("IT Infrastructure", "slack", INBOX[0]["ts"])
    assert SLACK[0]["thread"] == INBOX[0]["ts"] and "on it" in SLACK[0]["text"]
    assert "renewed the login certificate" in t["resolution"]
    assert t["status"] == "closed" and t["words"] == "Customer told"
    assert SLACK[-1] == {"channel": "#support", "thread": INBOX[0]["ts"],
                         "text": "Fixed: login works again. Reach out any time."}  # fmt: skip
    # Nothing is filed twice: the intake round skipped the handled message, and the job tree is finished.
    await beat()
    assert len(await desk.list_tickets(city.ledger)) == 1 and len(SLACK) == 2
    jobs = [j for j in await city.ledger.list_tickets(ALL_STATUSES) if j["from"] == "vaic"]
    assert all(j["status"] in FINAL for j in jobs), [(j["status"], j["goal"][:60]) for j in jobs]
    assert all(j.get("standing_order") == o["id"] for j in jobs)
    assert {j.get("support_ticket") for j in jobs} == {None, t["id"]}
    # Every step is on the ticket and in the City's events.
    assert [h["who"] for h in t["history"]][:2] == ["Customer Support", "support desk"]
    assert any("expired certificate" in h["text"] for h in t["history"])
    assert {e["ticket"]["status"] for e in city.bus.of_type("support.ticket")} >= {"new", "with_team", "fixed",
                                                                                  "replying", "closed"}  # fmt: skip


async def test_the_same_thread_is_one_ticket_and_replies_need_a_thread() -> None:
    d = city_deps()
    w = TurnCtx(agent_id="wkr-1", role="worker", department="Customer Support", ticket_id="t1", task_id="t1")
    open_ = tool(d, w, "open_ticket")
    assert "Say where to reply" in await open_({"title": "Refund please", "channel": "email"})
    a = {"title": "Refund please", "channel": "email", "where": "bo@example.com", "thread": "<m1@x>",
         "department": "Finance", "tracker": "Jira", "tracker_key": "SUP-7"}  # fmt: skip
    assert "Opened ticket" in await open_(a)
    assert "already has ticket" in await open_(a)
    [t] = await desk.list_tickets(d.ledger)
    assert (t["tracker"], t["tracker_key"], t["number"]) == ("Jira", "SUP-7", 1)
    assert "Jira issue SUP-7" in desk.team_goal(t) and "move Jira issue SUP-7 to done" in desk.reply_goal(
        {**t, "resolution": "Refunded."}
    )
    assert "by email to bo@example.com" in desk.reply_goal(t)
    assert await desk.get_ticket(d.ledger, "#1") == t
    assert "SUP-7" in await tool(d, w, "list_customer_tickets")({"status": "open"})


async def test_a_team_that_fails_twice_leaves_the_ticket_stuck_and_a_forgotten_tool_still_moves_it() -> None:
    clock = Clock()
    d = make(clock)
    t, _ = await desk.open_ticket(d, {"title": "Invoice wrong", "channel": "chat", "department": "Finance"}, "x")
    await run_job("standing_orders", d.ledger, d.queue, d.bus)
    t = await desk.get_ticket(d.ledger, t["id"])
    assert t is not None and t["status"] == "with_team"
    assert "Give every part to the Finance department" in d.queue.sent[-1]["body"]  # the board's planner
    await d.ledger.set_ticket_status(t["team_job"], "failed", "x")
    assert (await run_job("standing_orders", d.ledger, d.queue, d.bus))["tickets_moved"] == 1
    t2 = await desk.get_ticket(d.ledger, t["id"])
    assert t2 is not None and t2["status"] == "with_team" and t2["team_job"] != t["team_job"]
    await d.ledger.set_ticket_status(t2["team_job"], "failed", "x")
    await run_job("standing_orders", d.ledger, d.queue, d.bus)
    assert (await desk.get_ticket(d.ledger, t["id"]))["status"] == "stuck"  # type: ignore[index]
    # A finished job without ticket_fixed: its report becomes the resolution.
    u, _ = await desk.open_ticket(d, {"title": "Price question", "channel": "chat", "department": "Sales"}, "x")
    await run_job("standing_orders", d.ledger, d.queue, d.bus)
    u = await desk.get_ticket(d.ledger, u["id"])
    await d.ledger.set_ticket_status(u["team_job"], "done", "x", {"result": "Sent them the price list."})  # type: ignore[index]
    clock.t += timedelta(minutes=5)
    await run_job("standing_orders", d.ledger, d.queue, d.bus)
    u = await desk.get_ticket(d.ledger, u["id"])  # type: ignore[index]
    assert u is not None and (u["status"], u["resolution"]) == ("fixed", "Sent them the price list.")
    # The board in the HUD.
    r = js(await handle_http(ev("GET", "/support-tickets?status=stuck"), d))
    assert [x["id"] for x in r["tickets"]] == [t["id"]] and r["tickets"][0]["words"] == "Stuck"


def test_customer_support_orders_carry_the_desk_and_others_dont() -> None:
    sup = {"id": "so-1", "source": "Slack #support", "instructions": "Answer.", "department": "Customer Support"}
    assert "open_ticket" in so.goal_text(sup, []) and "open_ticket" not in so.goal_text(
        {**sup, "department": "Sales"}, []
    )


async def test_a_standing_order_whose_job_cannot_be_sent_starts_again_on_the_next_beat_and_others_still_run() -> None:
    city = make_city(scripted_engine({"vaic": vaic}))
    await city.host.ensure_core()
    first = await so.add_order(city.ledger, {"source": "Slack #support", "instructions": "Answer new messages."})
    second = await so.add_order(city.ledger, {"source": "Slack #sales", "instructions": "Answer new messages."})
    real, sent = city.queue.send, {"n": 0}

    async def flaky(m: object, delay: int = 0) -> None:
        sent["n"] += 1
        if sent["n"] == 1:
            raise RuntimeError("SQS is unavailable")
        await real(m, delay)  # type: ignore[arg-type]

    city.queue.send = flaky  # type: ignore[method-assign]
    assert (await so.run_due(city.deps))["started"] == 1  # the first could not start; the second did
    failed, ok = sorted(await so.list_orders(city.ledger), key=lambda o: bool(o.get("last_job_id")))
    assert not failed.get("last_job_id") and not failed.get("last_run_at") and ok["last_job_id"]
    assert {failed["id"], ok["id"]} == {first["id"], second["id"]}
    jobs = [j for j in await city.ledger.list_tickets(ALL_STATUSES) if j.get("standing_order") == failed["id"]]
    assert [j["status"] for j in jobs] == ["cancelled"]
    assert (await so.run_due(city.deps))["started"] == 1  # the next beat starts the one that failed


async def test_one_ticket_that_cannot_move_does_not_hold_up_the_others() -> None:
    city = make_city(scripted_engine({"vaic": vaic}))
    await city.host.ensure_core()
    d = city.deps
    for name in ("One", "Two"):
        await desk.open_ticket(d, {"title": f"{name} is broken", "details": "It does not start.", "customer": name,
                                   "channel": "slack", "where": "#support", "thread": name,
                                   "department": "IT Infrastructure"}, "Customer Support")  # fmt: skip
    real, sent = city.queue.send, {"n": 0}

    async def flaky(m: object, delay: int = 0) -> None:
        sent["n"] += 1
        if sent["n"] == 1:
            raise RuntimeError("SQS is unavailable")
        await real(m, delay)  # type: ignore[arg-type]

    city.queue.send = flaky  # type: ignore[method-assign]
    assert await desk.advance(d) == {"tickets_moved": 1}
    assert sorted(t["status"] for t in await desk.list_tickets(city.ledger)) == ["new", "with_team"]
