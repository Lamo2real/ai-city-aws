"""Autopilot (decision 125): nothing waits on the owner; standing orders; the away summary. Fake models only."""

import json
from datetime import timedelta
from typing import Any

from aic.lambdas.api import decide_approval, handle_http
from aic.lambdas.approvals import on_approval_step
from aic.lambdas.notifier import finished_job
from aic.lambdas.scheduler import run_job
from aic.runtime.tools import TurnCtx
from aic.shared import standing_orders as so
from aic.shared.chief_of_staff import LOOP_LIMIT, MAX_TRIES, review
from aic.shared.table import UpdateOptions
from test_api import Clock, FakeSfn, ev, js, make
from test_apps import city_deps, tool
from test_chief_of_staff import Model, _stuck_research, chief


async def _again(d: Any, model: Model, id: str) -> dict[str, Any]:
    """The next sweep, once the item's claim has run out."""
    await d.ledger.table.delete(f"IDEMP#chief:{id}", "META")
    return await review(chief(d, model))


class Broken(Model):
    async def __call__(self, i: Any) -> Any:
        self.calls.append(i)
        raise RuntimeError("model down")


# ---------- the Chief always decides ----------
async def test_owner_hands_never_block_the_agent_carries_on_and_one_line_per_service_waits() -> None:
    d = make()
    _, q = await _stuck_research(d)
    q2 = await d.ledger.ask_question(
        {
            "asked_by": "mgr-research",
            "path": "x",
            "ticket_id": q["ticket_id"],
            "text": "Sign in to Jira again?",
            "options": [],
            "default_answer": "wait",
        }
    )
    model = Model(
        {
            "decision": "needs_owner",
            "service": "Jira",
            "why": "Sign in to Jira in Settings → Connectors.",
            "answer": "Use the exported CSV instead and note the gap.",
        }
    )
    out = await review(chief(d, model))
    assert {r["result"] for r in out["results"]} == {"carry_on"}
    for qq in (q, q2):
        got = await d.ledger.get_question(qq["id"])
        assert got is not None and got["status"] == "answered" and got["decided_by"] == "chief_of_staff"
    assert "exported CSV" in (await d.ledger.get_question(q["id"]))["answer"]  # type: ignore[index]
    s = js(await handle_http(ev("GET", "/chief-of-staff"), d))
    assert s["autopilot"] is True
    assert s["needs_owner"] == [
        {"id": "back-jira", "title": q2["text"], "why": "Sign in to Jira in Settings → Connectors.", "service": "Jira"}
    ]


async def test_a_reply_that_is_never_a_decision_ends_with_the_default_after_three_tries() -> None:
    d = make()
    _, q = await _stuck_research(d)
    model = Model("hmm")
    await review(chief(d, model))
    for _ in range(MAX_TRIES - 1):
        await _again(d, model, q["id"])
    got = await d.ledger.get_question(q["id"])
    assert got is not None and got["status"] == "answered" and got["answer"] == "Wait"
    assert "No clear decision" in got["reason"]


async def test_a_failing_model_ends_with_a_refusal_for_an_approval() -> None:
    d = make()
    a = await d.ledger.request_approval(
        {"agent": "w1", "ticket_id": None, "tool": "Bash", "action": "deploy", "hash": "h9", "reason": "x"}
    )
    model = Broken()
    await review(chief(d, model))
    for _ in range(MAX_TRIES - 1):
        await _again(d, model, a["id"])
    got = await d.ledger.get_approval(a["id"])
    assert got is not None and got["status"] == "denied" and got["decided_by"] == "chief_of_staff"


async def test_a_part_that_keeps_asking_gets_its_job_stopped_without_a_model_call() -> None:
    d = make()
    task, q = await _stuck_research(d)
    for i in range(LOOP_LIMIT):
        await d.ledger.table.put(
            {
                "pk": "STEWARD",
                "sk": f"{d.ledger.now().isoformat()}Z#{i}",
                "id": f"q-{i}",
                "ticket_id": q["ticket_id"],
                "at": "2026-11-06T11:59:00.000Z",
                "kind": "question",
                "choice": "x",
                "reason": "r",
            }
        )
    model = Model({"decision": "answer", "answer": "Wait", "reason": "r"})
    out = await review(chief(d, model))
    assert out["results"][0]["result"] == "stop_job" and model.calls == []
    assert (await d.ledger.get_ticket(task["id"]))["status"] == "cancelled"  # type: ignore[index]


async def test_items_left_for_the_owner_before_autopilot_are_carried_on_without_a_model_call() -> None:
    d = make()
    _, q = await _stuck_research(d)
    await d.ledger.table.update(
        f"Q#{q['id']}", "META", UpdateOptions(set={"needs_owner_reason": "Delete the 7 orphans by hand."})
    )
    model = Model("unused")
    await review(chief(d, model))
    assert model.calls == []
    got = await d.ledger.get_question(q["id"])
    assert got is not None and got["status"] == "answered" and "Carry on without that part" in got["answer"]


# ---------- nothing parks for the owner ----------
async def test_ask_owner_under_autopilot_keeps_the_part_moving_and_off_parks_it_as_before() -> None:
    d = city_deps()
    t = await d.ledger.create_ticket({"id": "t-g", "goal": "g", "from": "orchestrator", "to": "mgr-x",
                                      "department": "X", "parent_id": None, "kind": "assignment", "status": "in_progress"})  # fmt: skip
    ctx = TurnCtx(agent_id="mgr-x", role="manager", department="X", ticket_id="t-g", task_id="t-g")
    ask = tool(d, ctx, "ask_owner")
    out = await ask({"question": "Which source?", "options": ["A", "B"], "default_answer": "A"})
    assert "Chief of Staff decides" in out
    assert (await d.ledger.get_ticket(t["id"]))["status"] == "in_progress"  # type: ignore[index]
    await d.ledger.update_settings({"autopilot": False})
    await ask({"question": "Which source?", "options": ["A", "B"], "default_answer": "A"})
    assert (await d.ledger.get_ticket(t["id"]))["status"] == "waiting_on_owner"  # type: ignore[index]


# ---------- approvals decided before Step Functions stored its token ----------
async def test_an_approval_decided_before_its_token_was_stored_still_wakes_the_agent() -> None:
    sfn = FakeSfn()
    d = make(sfn=sfn)
    a = await d.ledger.request_approval(
        {"agent": "w1", "ticket_id": "t1", "tool": "Bash", "action": "npm publish", "hash": "hx", "reason": "r"}
    )
    assert (await decide_approval(d, a["id"], True))["statusCode"] == 200
    assert sfn.sent == []  # no token yet
    await on_approval_step({"step": "store_token", "approvalId": a["id"], "taskToken": "tok"}, d.ledger, d.queue, sfn)
    assert sfn.sent and sfn.sent[0][0] == "success" and sfn.sent[0][1]["taskToken"] == "tok"


async def test_a_token_stored_while_deciding_is_read_again() -> None:
    sfn = FakeSfn()
    d = make(sfn=sfn)
    a = await d.ledger.request_approval(
        {"agent": "w1", "ticket_id": "t1", "tool": "Bash", "action": "x", "hash": "hy", "reason": "r"}
    )
    real = d.ledger.decide_approval

    async def store_then_decide(id: str, approved: bool) -> Any:
        await d.ledger.table.update(f"APPROVAL#{id}", "META", UpdateOptions(set={"task_token": "late"}))
        return await real(id, approved)

    d.ledger.decide_approval = store_then_decide  # type: ignore[method-assign]
    await decide_approval(d, a["id"], False)
    assert sfn.sent and sfn.sent[0][0] == "failure" and sfn.sent[0][1]["taskToken"] == "late"


# ---------- standing orders ----------
async def test_standing_order_routes_add_list_change_and_remove() -> None:
    d = make()
    bad = await handle_http(ev("POST", "/standing-orders", {"source": "Jira"}), d)
    assert bad["statusCode"] == 400
    r = await handle_http(
        ev("POST", "/standing-orders", {"source": "Jira project SUP", "instructions": "Answer each new ticket."}), d
    )
    assert r["statusCode"] == 201
    o = js(r)["standing_order"]
    assert (o["department"], o["every_minutes"], o["enabled"]) == ("Customer Support", 15, True)
    assert js(await handle_http(ev("GET", "/standing-orders"), d))["standing_orders"][0]["id"] == o["id"]
    assert (await handle_http(ev("PUT", f"/standing-orders/{o['id']}", {"every_minutes": 2}), d))["statusCode"] == 400
    put = js(await handle_http(ev("PUT", f"/standing-orders/{o['id']}", {"enabled": False}), d))
    assert put["standing_order"]["enabled"] is False
    assert (await handle_http(ev("DELETE", f"/standing-orders/{o['id']}"), d))["statusCode"] == 200
    assert (await handle_http(ev("DELETE", f"/standing-orders/{o['id']}"), d))["statusCode"] == 404


async def test_aic_sets_up_lists_and_stops_a_standing_order() -> None:
    d = city_deps()
    ace = TurnCtx(agent_id="ace", role="ace", department=None, ticket_id="", task_id="")
    out = await tool(d, ace, "add_standing_order")(
        {"source": "Slack #support", "instructions": "Reply to new support messages."}
    )
    assert "every 15 minutes the Customer Support department checks Slack #support" in out
    (o,) = await so.list_orders(d.ledger)
    assert o["id"] in await tool(d, ace, "list_standing_orders")({})
    assert "is off" in await tool(d, ace, "stop_standing_order")({"id": o["id"]})
    assert (await so.get_order(d.ledger, o["id"]))["enabled"] is False  # type: ignore[index]


async def test_the_scheduler_runs_a_due_order_once_at_a_time_and_nothing_is_handled_twice() -> None:
    clock = Clock()
    d = make(clock)
    o = await so.add_order(d.ledger, {"source": "Jira SUP", "instructions": "Answer new tickets."})
    out = await run_job("standing_orders", d.ledger, d.queue, d.bus)
    assert out == {"started": 1, "still_running": 0, "tickets_moved": 0}
    job = (await so.get_order(d.ledger, o["id"]))["last_job_id"]  # type: ignore[index]
    t = await d.ledger.get_ticket(job)
    assert t is not None and t["standing_order"] == o["id"] and t["to"] == "orchestrator"
    assert "Send it to the Customer Support department" in d.queue.sent[-1]["body"]
    # Still running and due again: no second job.
    clock.t += timedelta(minutes=20)
    assert (await run_job("standing_orders", d.ledger, d.queue, d.bus))["still_running"] == 1
    # The worker records what it handled; a repeat is refused, and the next round is told to skip it.
    w = TurnCtx(agent_id="wkr-1", role="worker", department="Customer Support", ticket_id=job, task_id=job)
    deps = city_deps()
    deps.ledger.table = d.ledger.table  # same ledger
    rec = tool(deps, w, "record_handled")
    assert await rec({"order_id": o["id"], "item": "SUP-12", "summary": "Answered the refund question."}) == "Recorded."
    assert "Already handled" in await rec({"order_id": o["id"], "item": "SUP-12", "summary": "again"})
    await d.ledger.set_ticket_status(job, "done", "round finished")
    assert (await run_job("standing_orders", d.ledger, d.queue, d.bus))["started"] == 1
    assert "skip these: SUP-12" in d.queue.sent[-1]["body"]


def test_a_standing_order_round_finishing_sends_no_push() -> None:
    t = {"id": "t1", "goal": "g", "from": "ace", "to": "orchestrator", "status": "done", "department": None,
         "parent_id": None, "kind": "task", "standing_order": "so-1", "created_at": "x", "updated_at": "x"}  # fmt: skip
    assert finished_job({"type": "ticket.status", "ticket": t, "previous": "in_progress", "at": "x"}) is None
    assert finished_job({"type": "ticket.status", "ticket": {**t, "standing_order": None}, "previous": "in_progress",
                         "at": "x"}) is not None  # fmt: skip


# ---------- while you were away ----------
async def test_away_summary_says_what_finished_what_runs_what_was_decided_and_handled() -> None:
    d = make()
    task, _ = await _stuck_research(d)
    await review(chief(d, Model({"decision": "answer", "answer": "Wait", "reason": "r"})))
    done = await d.ledger.create_ticket({"goal": "Write the launch post", "from": "ace", "to": "orchestrator",
                                         "department": None, "parent_id": None, "kind": "task", "status": "done"})  # fmt: skip
    o = await so.add_order(d.ledger, {"source": "Jira SUP", "instructions": "Answer."})
    await so.record_handled(d.ledger, o["id"], "SUP-1", "Answered.", None)
    r = js(await handle_http(ev("GET", "/away-summary?since=2026-11-01T00:00:00Z"), d))
    assert set(r) == {"since", "jobs_finished", "jobs_running", "decided", "handled_by_standing_orders",
                      "when_youre_back"}  # fmt: skip
    assert [j["id"] for j in r["jobs_finished"]] == [done["id"]] and r["jobs_finished"][0]["status"] == "Done"
    assert [j["id"] for j in r["jobs_running"]] == [task["id"]]
    assert r["decided"] == 1
    assert r["handled_by_standing_orders"] == [
        {"source": "Jira SUP", "item": "SUP-1", "summary": "Answered.", "at": "2026-11-06T12:00:00.000Z"}
    ]
    assert json.dumps(r)  # plain JSON
    # A bad "since" falls back to the last 7 days.
    assert js(await handle_http(ev("GET", "/away-summary?since=yesterday"), d))["since"] == "2026-10-30T12:00:00.000Z"
