"""Any department hands work to any other, workers too, and the result comes back to whoever filed it (decision 241).

The owner: IT infrastructure files to Marketing, Customer Support, Product, "and vice versa, and all different
combinations", by each agent's own judgement; the team that fixes it updates the same Jira issue and gets back to
the worker who filed it. Slack and Jira are fakes; nothing here reaches Bedrock.
"""

from __future__ import annotations

import re
from typing import Any

from city_support import Call, make_city, scripted_engine
from test_apps import city_deps, tool
from vaic.runtime.engine import EngineRequest
from vaic.runtime.tools import TurnCtx
from vaic.shared import support_desk as desk
from vaic.shared.connectors import ConnectorStore
from vaic.shared.hierarchy.actions import FINAL, CityDeps
from vaic.shared.ids import manager_id
from vaic.shared.ledger import ALL_STATUSES

ID = re.compile(r"\b(st-\d{4}-\d{5})\b")
SLACK: list[str] = []
JIRA: dict[str, dict[str, Any]] = {}
SEEN: dict[str, str] = {}


async def _goal(req: EngineRequest) -> str:
    t = await req.ledger.get_ticket(req.ctx.ticket_id)
    return str((t or {}).get("goal") or "")


async def vaic(req: EngineRequest, call: Call) -> str:
    return "Noted."


async def orchestrator(req: EngineRequest, call: Call) -> str:
    """The board's planner, for a job whose department isn't standing yet (decision 298)."""
    dept = re.search(r"Give every part to the (.+?) department", req.turn.prompt).group(1)  # type: ignore[union-attr]
    await call("write_contract", {"summary": "The shared contract for this job."})
    await call("add_part", {"name": "The job", "goal": await _goal(req), "acceptance": "done", "department": dept})
    await call("finish_plan", {})
    return "Planned."


async def manager(req: EngineRequest, call: Call) -> str:
    """A department's reviewer on the board: one review of the part it was sent."""
    if "Board review" in req.turn.prompt:
        await call("review", {"ticket_id": req.ctx.ticket_id, "verdict": "PASS", "reasons": "Meets the acceptance."})
    return "Reviewed."


async def worker(req: EngineRequest, call: Call) -> str:
    prompt, goal = req.turn.prompt, await _goal(req)
    if "The ticket desk, for your assignment" in prompt:  # IT's worker gets Marketing's result on its own work
        handoff = ID.search(prompt[prompt.index("Your handoff") :]).group(1)  # type: ignore[union-attr]
        assert "status page is updated" in prompt and "Close Jira issue OPS-1" in prompt, prompt
        JIRA["OPS-1"]["status"] = "Done"  # the filer closes the Jira issue
        await call("ticket_replied", {"ticket": handoff, "summary": "Linked the status post from the incident."})
        await call("ticket_fixed", {"ticket": SEEN["customer"], "summary": "The login service is back up."})
        await call("report_to_manager", {"summary": "Fixed the login, with Marketing's status post.",
                                         "artifacts": [], "checks": "ok"})  # fmt: skip
        return "Reported."
    if goal.startswith("Customer ticket") and "is fixed:" not in goal:  # IT decides Marketing must tell everyone
        SEEN["customer"] = ID.search(goal).group(1)  # type: ignore[union-attr]
        SEEN["it_worker"] = req.ctx.agent_id
        JIRA["OPS-1"] = {"status": "To Do", "comments": []}
        out = await call("file_handoff", {"to_department": "Marketing", "title": "Post a status update on the outage",
                                          "details": "Login is down for some customers; say we're on it.",
                                          "priority": "urgent", "reply_to": SEEN["customer"],
                                          "tracker_key": "OPS-1"})  # fmt: skip
        assert out.startswith("Filed") and "comes back to you" in out, out
        return "Waiting for Marketing."  # no report yet: the worker stays on its assignment
    if "from IT Infrastructure to your department" in goal:  # Marketing does it, on the same Jira issue
        tid = ID.search(goal).group(1)  # type: ignore[union-attr]
        assert SEEN["it_worker"] in goal and "leave it open" in goal and "Jira issue OPS-1" in goal, goal
        JIRA["OPS-1"]["comments"].append("Status page updated.")
        await call("ticket_fixed", {"ticket": tid, "summary": "The status page is updated."})
        summary = "Posted."
    else:  # Customer Support tells the reporter
        tid = ID.search(goal).group(1)  # type: ignore[union-attr]
        SLACK.append("Fixed: login works again.")
        await call("ticket_replied", {"ticket": tid, "summary": "Told them in the thread."})
        summary = "Replied."
    await call("report_to_manager", {"summary": summary, "artifacts": [], "checks": "ok"})
    return "Reported."


async def test_an_it_worker_files_to_marketing_and_the_result_comes_straight_back_to_that_worker() -> None:
    SLACK.clear(), JIRA.clear(), SEEN.clear()
    city = make_city(scripted_engine({"vaic": vaic, "orchestrator": orchestrator, "manager": manager,
                                      "worker": worker}))  # fmt: skip
    await city.host.ensure_core()
    for n in ("Customer Support", "IT Infrastructure", "Marketing"):
        await city.ledger.create_department(n, f"The {n} team.", manager_id(n))
    d = city.deps
    jira = {"id": "atlassian", "label": "Jira", "url": "https://mcp.atlassian.com/v1/mcp", "status": "ready"}
    await ConnectorStore(city.ledger.table).create(jira)
    t, _ = await desk.open_ticket(d, {"title": "Can't log in", "details": "Error 500.", "channel": "slack",
                                      "where": "#support", "thread": "1.1", "department": "IT"}, "Customer Support")  # fmt: skip

    await desk.advance(d)  # one beat: everything after it runs without waiting for the next one
    await city.run()

    tickets = {x["id"]: x for x in await desk.list_tickets(city.ledger)}
    handoff = next(x for x in tickets.values() if x["kind"] == "handoff")
    assert (handoff["from_department"], handoff["department"], handoff["filed_by"]) == (
        "IT Infrastructure", "Marketing", SEEN["it_worker"])  # fmt: skip
    assert handoff["chain"] == ["Customer Support", "IT Infrastructure", "Marketing"]
    assert handoff["status"] == "closed" and handoff["tracker_key"] == "OPS-1"
    assert any(f"({SEEN['it_worker']})" in h["text"] for h in handoff["history"])
    # The result went to the worker, not through the Orchestrator and IT's manager.
    back = await city.ledger.get_ticket(str(handoff["reply_job"]))
    assert back is not None and back["to"] == SEEN["it_worker"] and back["desk_direct"] and back["status"] == "done"
    via_orchestrator = [j for j in await city.ledger.list_tickets(ALL_STATUSES)
                        if j["from"] == "vaic" and j.get("support_ticket") == handoff["id"]]  # fmt: skip
    assert len(via_orchestrator) == 1  # Marketing's job only
    assert JIRA["OPS-1"] == {"status": "Done", "comments": ["Status page updated."]}
    # And the customer ticket went round in the same beat.
    assert tickets[t["id"]]["status"] == "closed" and SLACK == ["Fixed: login works again."]
    jobs = [j for j in await city.ledger.list_tickets(ALL_STATUSES) if j["from"] == "vaic"]
    assert all(j["status"] in FINAL for j in jobs), [(j["status"], j["goal"][:50]) for j in jobs]


async def _worker(d: CityDeps, wid: str, dept: str, released: bool = False, on: str | None = None) -> TurnCtx:
    await d.ledger.put_agent({"id": wid, "kind": "worker", "department": dept, "parent": f"mgr-{dept.lower().replace(' ', '-')}",
                              "state": "retired" if released else "active",
                              "worker_state": "released" if released else "working", "ticket_id": on})  # fmt: skip
    return TurnCtx(agent_id=wid, role="worker", department=dept, ticket_id=on or "t0", task_id=on or "t0")


def _sent(d: CityDeps) -> list[dict[str, Any]]:
    return list(d.queue.sent)  # type: ignore[attr-defined]


async def test_a_released_filer_falls_back_to_its_manager() -> None:
    d = city_deps()
    ctx = await _worker(d, "wkr-product-1", "Product")
    out = await tool(d, ctx, "file_handoff")({"to_department": "IT", "title": "Add a feature flag service"})
    [h] = await desk.list_tickets(d.ledger)
    assert out.startswith("Filed") and h["filed_by"] == "wkr-product-1" and h["status"] == "with_team"
    await d.ledger.update_agent("wkr-product-1", {"state": "retired", "worker_state": "released"})
    await desk.mark_fixed(d, h["id"], "Flags are live.", "IT Infrastructure")
    await desk.step_now(d, h["id"])
    h = await desk.get_ticket(d.ledger, h["id"])
    assert h is not None and h["status"] == "replying"
    back = await d.ledger.get_ticket(str(h["reply_job"]))
    assert back is not None and back["from"] == "vaic" and back["goal"].startswith("Your handoff")
    assert "Give every part to the Product department" in _sent(d)[-1]["body"]  # the planner


async def test_bounds_hold_for_workers_and_any_pair_of_departments_works() -> None:
    d = city_deps()
    it = await _worker(d, "wkr-it-1", "IT Infrastructure")
    file = tool(d, it, "file_handoff")
    assert "your own department" in await file({"to_department": "IT", "title": "x y z"})
    for to in ("Marketing", "Customer Support", "Product"):
        assert (await file({"to_department": to, "title": f"Tell {to}"})).startswith("Filed")
    assert "already has this open" in await file({"to_department": "Marketing", "title": "Tell Marketing"})
    for n in range(9):
        assert (await file({"to_department": "Marketing", "title": f"Item {n}"})).startswith("Filed")
    assert "already has 10 open handoffs" in await file({"to_department": "Marketing", "title": "One more"})
    # Vice versa, from a worker in each of those departments.
    for dept in ("Marketing", "Customer Support", "Product"):
        w = await _worker(d, f"wkr-{dept.split()[0].lower()}-1", dept)
        assert (await tool(d, w, "file_handoff")({"to_department": "IT", "title": f"From {dept}"})).startswith("Filed")
    # A chain still stops at four departments.
    [a] = [x for x in await desk.list_tickets(d.ledger) if x["title"] == "Tell Product"]
    pr = await _worker(d, "wkr-product-2", "Product")
    await tool(d, pr, "file_handoff")({"to_department": "Legal", "title": "Check terms", "reply_to": a["id"]})
    b = next(x for x in await desk.list_tickets(d.ledger) if x["title"] == "Check terms")
    lg = await _worker(d, "wkr-legal-1", "Legal")
    await tool(d, lg, "file_handoff")({"to_department": "Finance", "title": "Price it", "reply_to": b["id"]})
    c = next(x for x in await desk.list_tickets(d.ledger) if x["title"] == "Price it")
    assert c["chain"] == ["IT Infrastructure", "Product", "Legal", "Finance"]
    fi = await _worker(d, "wkr-finance-1", "Finance")
    assert "Finish it with what you have" in await tool(d, fi, "file_handoff")(
        {"to_department": "Sales", "title": "Sell it", "reply_to": c["id"]}
    )


async def test_a_customer_tickets_reply_goes_to_the_support_worker_who_opened_it() -> None:
    d = city_deps()
    sup = await _worker(d, "wkr-customer-support-1", "Customer Support")
    out = await tool(d, sup, "open_ticket")({"title": "Invoice is wrong", "details": "Charged twice.",
                                             "customer": "Acme", "channel": "slack", "where": "#support",
                                             "thread": "9.9", "department": "Finance"})  # fmt: skip
    [t] = await desk.list_tickets(d.ledger)
    assert out.startswith("Opened") and t["filed_by"] == sup.agent_id and t["status"] == "with_team"
    fin = TurnCtx(agent_id="wkr-finance-1", role="worker", department="Finance", ticket_id="t1", task_id="t1")
    assert "tells the reporter now" in await tool(d, fin, "ticket_fixed")({"ticket": t["id"], "summary": "Refunded."})
    t = await desk.get_ticket(d.ledger, t["id"])
    assert t is not None and t["status"] == "replying"
    job = await d.ledger.get_ticket(str(t["reply_job"]))
    assert (
        job is not None and job["to"] == sup.agent_id and job["desk_direct"] and job["from"] == "mgr-customer-support"
    )
    msg = _sent(d)[-1]
    assert (msg["role"], msg["agentId"], msg["ticketId"]) == ("worker", sup.agent_id, job["id"])
    assert "Reply to the person who reported it in Slack channel #support" in msg["body"]
    # Its report is the reply: the ticket closes and nothing goes to its manager.
    ctx = TurnCtx(agent_id=sup.agent_id, role="worker", department="Customer Support", ticket_id=job["id"],
                  task_id=job["id"])  # fmt: skip
    said = await tool(d, ctx, "report_to_manager")({"summary": "Told Acme in the thread.", "artifacts": [],
                                                    "checks": "ok"})  # fmt: skip
    assert said.startswith("Closed") and len(_sent(d)) == 2  # the team's job and this one, no report to a manager
    t = await desk.get_ticket(d.ledger, t["id"])
    assert t is not None and t["status"] == "closed"
    job = await d.ledger.get_ticket(job["id"])
    assert job is not None and job["status"] == "done"
