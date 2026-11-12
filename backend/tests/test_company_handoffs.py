"""The company brief, handoffs between departments and the shared CRM (decisions 135–137), end to end.

"We're an online fashion store like Zalando; run it." Then, with nobody's input:
- a customer writes in Slack → Customer Support files it for Application (in Jira) → Application's manager assigns a
  worker, who fixes it and closes the Jira issue → back to Customer Support → reply in the same Slack thread;
- Marketing finds a qualified lead → hands it to Sales (MQL → SQL) → Sales converts it in Salesforce → the result
  goes back to Marketing.

Slack, Jira and Salesforce are fakes (``SLACK``, ``JIRA``, ``SALESFORCE``) that the scripted workers write to where
real workers would call the connectors. Nothing here reaches Slack, Atlassian, Salesforce or Bedrock.
"""

from __future__ import annotations

import re
from typing import Any

from city_support import Call, make_city, scripted_engine
from test_api import ev, js, make
from test_apps import city_deps, tool
from vaic.lambdas.api import handle_http
from vaic.runtime.engine import EngineRequest
from vaic.runtime.tools import TurnCtx
from vaic.shared import company
from vaic.shared import sales_pipeline as deals
from vaic.shared import standing_orders as so
from vaic.shared import support_desk as desk
from vaic.shared.connectors import ConnectorStore
from vaic.shared.hierarchy.actions import FINAL
from vaic.shared.ids import manager_id
from vaic.shared.ledger import ALL_STATUSES

SLACK: list[dict[str, str]] = []
JIRA: dict[str, dict[str, Any]] = {}
SALESFORCE: dict[str, dict[str, Any]] = {}
CUSTOMER_MSG = {"channel": "#support", "ts": "1731200000.0042", "user": "Mia (support rep)",
                "text": "Customer Jonas: checkout fails with 'payment error' when using a voucher."}  # fmt: skip
ID = re.compile(r"\b(st-\d{4}-\d{5})\b")
ZALANDO = "We are an online fashion store like Zalando: shoes and clothes, delivered across Europe."


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
    goal = await _goal(req)
    summary = "Nothing new."
    if goal.startswith("Standing order so-company-marketing"):
        # Marketing hands the qualified lead to Sales (MQL → SQL) and converts it in Salesforce (decision 241: a
        # worker files handoffs by its own judgement).
        lead = next(x for x in await deals.list_deals(req.ledger, team="Marketing") if x["name"] == "Lena Shop")
        if lead["id"] not in SALESFORCE:
            SALESFORCE[lead["id"]] = {"type": "Opportunity", "stage": "Qualification", "owner": "Sales"}
            out = await call("file_handoff", {"to_department": "Sales", "title": "Qualified lead: Lena Shop",
                                              "details": "Asked for wholesale prices twice.", "ref": lead["id"],
                                              "priority": "high"})  # fmt: skip
            assert out.startswith("Filed"), out
            summary = "Handed the lead to Sales."
    elif goal.startswith("Standing order so-company-support") and CUSTOMER_MSG["ts"] not in goal:
        key = f"SHOP-{len(JIRA) + 1}"
        JIRA[key] = {"project": "SHOP", "component": "Application", "status": "To Do", "comments": []}
        out = await call("open_ticket", {"title": "Checkout fails with a voucher", "details": CUSTOMER_MSG["text"],
                                         "customer": "Jonas", "channel": "slack", "where": CUSTOMER_MSG["channel"],
                                         "thread": CUSTOMER_MSG["ts"], "department": "Application",
                                         "tracker": "Jira", "tracker_key": key,
                                         "order_id": "so-company-support"})  # fmt: skip
        SLACK.append({"thread": CUSTOMER_MSG["ts"], "text": f"Thanks Mia, we're on it ({key})."})
        await call("record_handled", {"order_id": "so-company-support", "item": CUSTOMER_MSG["ts"], "summary": out})
        summary = "Filed one ticket."
    elif (
        goal.startswith("Customer ticket SHOP-") and "is fixed:" not in goal
    ):  # Application fixes it and keeps Jira current
        key, tid = re.search(r"ticket (SHOP-\d+)", goal).group(1), ID.search(goal).group(1)  # type: ignore[union-attr]
        assert "Jira issue SHOP-1: assign it" in goal, goal
        JIRA[key]["assignee"] = req.ctx.agent_id
        JIRA[key]["comments"].append("Voucher codes were rejected by the new payment step; fixed the validation.")
        await call("ticket_note", {"ticket": tid, "text": "Found it: voucher validation in the payment step."})
        await call("ticket_fixed", {"ticket": tid, "summary": "Vouchers work at checkout again."})
        JIRA[key]["status"] = "Done"
        summary = "Fixed checkout."
    elif "is fixed:" in goal:  # Customer Support tells the reporter, in the thread
        tid = ID.search(goal).group(1)  # type: ignore[union-attr]
        thread = re.search(r"thread (\S+) \(the reporter", goal).group(1)  # type: ignore[union-attr]
        SLACK.append({"thread": thread, "text": "Fixed: vouchers work at checkout again. Reach out any time!"})
        await call("ticket_replied", {"ticket": tid, "summary": "Told Mia in the thread."})
        summary = "Replied."
    elif "from Marketing to your department" in goal:  # Sales takes the qualified lead
        tid = ID.search(goal).group(1)  # type: ignore[union-attr]
        deal = re.search(r"about (deal-\w+)", goal).group(1)  # type: ignore[union-attr]
        SALESFORCE[deal]["stage"] = "Needs Analysis"
        await call("update_deal", {"id": deal, "contacted": True, "stage": "contacted", "next_step": "Send prices"})
        await call("ticket_fixed", {"ticket": tid, "summary": "Sales called Lena Shop; prices go out tomorrow."})
        summary = "Took the lead."
    elif goal.startswith("Your handoff"):  # back with Marketing
        tid = ID.search(goal).group(1)  # type: ignore[union-attr]
        await call("ticket_replied", {"ticket": tid, "summary": "Moved Lena Shop out of the nurture campaign."})
        summary = "Noted Sales' result."
    await call("report_to_manager", {"summary": summary, "artifacts": [], "checks": "ok"})
    return "Reported."


async def test_zalando_runs_itself_support_to_application_and_back_and_a_lead_from_marketing_to_sales() -> None:
    SLACK.clear(), JIRA.clear(), SALESFORCE.clear()
    city = make_city(scripted_engine({"vaic": vaic, "orchestrator": orchestrator, "manager": manager,
                                      "worker": worker}))  # fmt: skip
    await city.host.ensure_core()
    for n in ("Customer Support", "Application", "Marketing", "Sales"):
        await city.ledger.create_department(n, f"The {n} team.", manager_id(n))
    d = city.deps
    jira = {
        "id": "atlassian",
        "label": "Jira & Confluence",
        "url": "https://mcp.atlassian.com/v1/mcp",
        "status": "ready",
    }
    await ConnectorStore(city.ledger.table).create(jira)
    await deals.add_deal(city.ledger, {"name": "Lena Shop", "contact": "Lena", "stage": "nurturing"}, "Marketing")
    # The owner, once:
    vaic_ctx = TurnCtx(
        agent_id="vaic", role="vaic", department=None, ticket_id="conv-main", task_id="conv-main", from_owner=True
    )
    said = await tool(d, vaic_ctx, "set_company_brief")(
        {"text": ZALANDO, "support_source": "Slack #support", "running": True}
    )
    assert "runs on its own" in said
    assert {o["id"] for o in await company.operating_orders(city.ledger)} == {
        "so-company-support", "so-company-marketing", "so-company-sales"}  # fmt: skip

    async def beat() -> None:
        await so.run_due(d)
        await desk.advance(d)
        await city.run()
        city.advance(16 * 60_000)

    for _ in range(5):
        await beat()

    tickets = await desk.list_tickets(city.ledger)
    support = next(t for t in tickets if t["kind"] == "customer")
    handoff = next(t for t in tickets if t["kind"] == "handoff")
    # Customer → Support → Application (Jira) → Support → the same Slack thread.
    assert (support["status"], support["department"], support["tracker"], support["tracker_key"]) == (
        "closed", "Application", "Jira", "SHOP-1")  # fmt: skip
    assert JIRA["SHOP-1"]["status"] == "Done" and JIRA["SHOP-1"]["assignee"].startswith("wkr-application")
    assert [m["thread"] for m in SLACK] == [CUSTOMER_MSG["ts"]] * 2
    assert SLACK[-1]["text"] == "Fixed: vouchers work at checkout again. Reach out any time!"
    # Marketing → Sales: the lead became Sales' (MQL → SQL), Sales worked it, the result went back to Marketing.
    assert (handoff["from_department"], handoff["department"], handoff["status"], handoff["priority"]) == (
        "Marketing", "Sales", "closed", "high")  # fmt: skip
    assert handoff["words"] == "Closed" and any("Taken back" in h["text"] for h in handoff["history"])
    [lead] = await deals.list_deals(city.ledger)
    assert (lead["team"], lead["stage"], lead["next_step"]) == ("Sales", "contacted", "Send prices")
    assert SALESFORCE[lead["id"]] == {"type": "Opportunity", "stage": "Needs Analysis", "owner": "Sales"}
    # Nothing waited on the owner, and every job ended.
    assert await city.ledger.open_questions() == []
    jobs = [j for j in await city.ledger.list_tickets(ALL_STATUSES) if j["from"] == "vaic"]
    assert jobs and all(j["status"] in FINAL for j in jobs)
    # Every team knows the business and who it hands work to.
    mgr = await city.ledger.get_agent("mgr-customer-support")
    system, _ = await city.host._system(mgr or {}, {"role": "manager", "department": "Customer Support"})
    assert ZALANDO in system and "Application (errors on the website" in system


async def test_any_department_hands_off_to_any_other_and_never_loops() -> None:
    d = city_deps()
    mk = TurnCtx(agent_id="mgr-marketing", role="manager", department="Marketing", ticket_id="t1", task_id="t1")
    wk = TurnCtx(agent_id="wkr-1", role="worker", department="Marketing", ticket_id="t1", task_id="t1")
    with_tools = {t.name for t in __import__("vaic.runtime.tools", fromlist=["tools_for"]).tools_for(d, wk)}
    assert "file_handoff" in with_tools  # workers file between departments too (decision 241)
    file = tool(d, mk, "file_handoff")
    assert "your own department" in await file({"to_department": "marketing", "title": "x y z"})
    assert (await file({"to_department": "Sales", "title": "Lead A"})).startswith("Filed")
    assert "already has this open" in await file({"to_department": "Sales", "title": "Lead A"})
    [a] = await desk.list_tickets(d.ledger)
    assert (
        a["chain"] == ["Marketing", "Sales"] and a["tracker"] == desk.BOARD and a["words"] == "Being worked on"
    )  # sent at once
    # Back and forth is allowed, but a chain stops at four departments: no endless ping-pong.
    sales = TurnCtx(agent_id="mgr-sales", role="manager", department="Sales", ticket_id="t2", task_id="t2")
    out = await tool(d, sales, "file_handoff")({"to_department": "Marketing", "title": "Need a case study",
                                                "reply_to": a["id"]})  # fmt: skip
    b = next(t for t in await desk.list_tickets(d.ledger) if t["id"] != a["id"])
    assert out.startswith("Filed") and b["chain"] == ["Marketing", "Sales", "Marketing"]
    out = await file({"to_department": "Sales", "title": "Here it is", "reply_to": b["id"]})
    c = next(t for t in await desk.list_tickets(d.ledger) if t["id"] not in (a["id"], b["id"]))
    assert out.startswith("Filed") and c["chain"] == ["Marketing", "Sales", "Marketing", "Sales"]
    assert "Finish it with what you have" in await tool(d, sales, "file_handoff")(
        {"to_department": "Finance", "title": "Invoice it", "reply_to": c["id"]}
    )


async def test_the_company_brief_shows_in_settings_and_stopping_it_turns_the_rounds_off() -> None:
    d = make()
    assert js(await handle_http(ev("GET", "/company"), d)) == {"brief": None, "orders": []}
    assert (await handle_http(ev("PUT", "/company", {"text": " "}), d))["statusCode"] == 400
    r = js(
        await handle_http(
            ev("PUT", "/company", {"text": ZALANDO, "support_source": "support@shop.eu", "running": True}), d
        )
    )
    assert r["brief"]["running"] is True and len(r["orders"]) == 3
    assert next(o for o in r["orders"] if o["department"] == "Customer Support")["source"] == "support@shop.eu"
    r = js(await handle_http(ev("PUT", "/company", {"running": False}), d))
    assert r["brief"]["text"] == ZALANDO and not any(o["enabled"] for o in r["orders"])
    r = js(await handle_http(ev("PUT", "/company", {"running": True}), d))
    assert all(o["enabled"] for o in r["orders"]) and len(await so.list_orders(d.ledger)) == 3  # never duplicated
    r = js(await handle_http(ev("DELETE", "/company"), d))
    assert r["brief"] is None and not any(o["enabled"] for o in r["orders"])
    assert company.context(None, "manager", "Sales") == ""
    ctx = company.context({"text": ZALANDO}, "manager", "Sales")
    assert "Sales hands work to: Finance" in ctx and "file_handoff" in ctx


async def test_a_marketing_order_nurtures_in_the_shared_crm_and_sales_reads_only_its_own_deals() -> None:
    d = make()
    lead = await deals.add_deal(d.ledger, {"name": "New lead"}, "Marketing")
    opp = await deals.add_deal(d.ledger, {"name": "Big deal", "stage": "proposal"}, "Sales")
    assert (lead["team"], opp["team"]) == ("Marketing", "Sales")
    assert [x["id"] for x in await deals.list_deals(d.ledger, team="Sales")] == [opp["id"]]
    o = {"id": "so-1", "source": "CRM", "instructions": "Nurture.", "department": "Marketing"}
    text = so.goal_text(o, [])
    assert "Salesforce: Leads and Campaigns" in text and "file_handoff (to_department Sales" in text
    assert "convert the lead into an opportunity" in text and "Salesforce" not in so.goal_text(
        {**o, "department": "Finance"}, []
    )
