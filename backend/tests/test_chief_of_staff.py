"""The Chief of Staff (decision 124): decides Needs you items through the HUD's own code paths. Fake models only."""

import json
from typing import Any

from aic.lambdas.api import handle_http, steward_apply
from aic.lambdas.chief_of_staff import handle, item_id
from aic.shared.chief_of_staff import ChiefDeps, digest, parse_decision, review
from aic.shared.turn import TurnInput, TurnOutput
from test_api import FakeSfn, ev, js, make


class Model:
    """Answers with the scripted replies in order (the last one repeats), and remembers every prompt."""

    def __init__(self, *replies: str | dict[str, Any], refuse_primary: bool = False) -> None:
        self.replies = [r if isinstance(r, str) else json.dumps(r) for r in replies]
        self.calls: list[TurnInput] = []
        self.refuse_primary = refuse_primary

    async def __call__(self, i: TurnInput) -> TurnOutput:
        self.calls.append(i)
        if self.refuse_primary and i.model.name == "fable-5-1":
            return TurnOutput(text="", stop_reason="refusal")
        return TurnOutput(text=self.replies[min(len(self.calls) - 1, len(self.replies) - 1)])


def chief(d: Any, model: Model) -> ChiefDeps:
    async def apply(op: dict[str, Any]) -> dict[str, Any]:
        return await steward_apply(op, d)  # in-process, exactly what the api Lambda runs on a direct invoke

    return ChiefDeps(ledger=d.ledger, bus=d.bus, runner=model, settings=d.settings, apply=apply, env={})


async def _stuck_research(d: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    """The Research manager stuck on a goal, asking the owner to clear phantom workers (t-c32ca08b9bdf)."""
    await d.ledger.put_agent({"id": "mgr-research", "kind": "manager", "role": "Research Manager", "department": "Research",
                              "model": "fable-5-1", "parent": "orchestrator", "state": "active", "total_cost_usd": 0})  # fmt: skip
    task = await d.ledger.create_ticket({"goal": "Find 20 leads", "from": "ace", "to": "orchestrator", "department": None,
                                         "parent_id": None, "kind": "task", "owner_words": "find me leads", "status": "in_progress"})  # fmt: skip
    goal = await d.ledger.create_ticket({"goal": "Research leads", "from": "orchestrator", "to": "mgr-research", "department": "Research",
                                         "parent_id": task["id"], "kind": "assignment", "status": "waiting_on_owner"})  # fmt: skip
    q = await d.ledger.ask_question(
        {
            "asked_by": "mgr-research",
            "path": "Research › manager",
            "ticket_id": goal["id"],
            "text": "Phantom workers fill my seats. Can you clear them?",
            "options": ["Release the idle workers and hire your one researcher", "Wait"],
            "default_answer": "Wait",
        }
    )
    return task, q


async def test_answers_the_stuck_research_question_as_if_the_owner_clicked() -> None:
    d = make()
    _, q = await _stuck_research(d)
    pick = "Release the idle workers and hire your one researcher"
    model = Model({"decision": "answer", "answer": pick, "reason": "The fix shipped; this unblocks the goal."})
    out = await review(chief(d, model))
    assert out["results"] == [{"id": q["id"], "result": "answer"}]
    got = await d.ledger.get_question(q["id"])
    assert got is not None
    assert (got["status"], got["answer"], got["answered_by"]) == ("answered", pick, "chief_of_staff")
    assert (got["decided_by"], got["decision"]) == ("chief_of_staff", pick)
    assert "unblocks" in got["reason"]
    # The manager is told and its goal moves on, exactly like the owner's tap.
    sent = [m for m in d.queue.sent if m.get("kind") == "answer"]
    assert sent and sent[0]["agentId"] == "mgr-research" and pick in sent[0]["body"]
    assert (await d.ledger.get_ticket(q["ticket_id"]))["status"] == "in_progress"
    e = d.bus.of_type("steward.decided")[0]
    assert (e["id"], e["kind"], e["choice"]) == (q["id"], "question", pick)
    # The model saw the item, the job and the owner's words, as data.
    prompt = model.calls[0].prompt
    assert "<item>" in prompt and "Phantom workers" in prompt and "find me leads" in prompt
    assert model.calls[0].model.name == "fable-5-1"
    # Listed for the HUD.
    s = js(await handle_http(ev("GET", "/chief-of-staff"), d))
    assert s["enabled"] is True and s["needs_owner"] == []
    assert s["decided"][0]["id"] == q["id"] and s["decided"][0]["department"] == "Research"
    assert set(s["decided"][0]) == {"id", "kind", "title", "choice", "reason", "at", "department"}


async def test_picking_the_default_goes_through_the_default_path() -> None:
    d = make()
    _, q = await _stuck_research(d)
    await review(chief(d, Model({"decision": "answer", "answer": "wait", "reason": "r"})))
    got = await d.ledger.get_question(q["id"])
    assert got is not None and got["answer"] == "Wait"


async def test_approves_an_approval_through_the_same_steps_as_the_owner() -> None:
    sfn = FakeSfn()
    d = make(sfn=sfn)
    a = await d.ledger.request_approval(
        {"agent": "w1", "ticket_id": None, "tool": "Bash", "action": "npm publish", "hash": "h1", "reason": "ship"}
    )
    out = await review(chief(d, Model({"decision": "approve", "reason": "The owner asked for this release."})))
    assert out["results"][0]["result"] == "approve"
    got = await d.ledger.get_approval(a["id"])
    assert got is not None and got["status"] == "approved" and got["decided_by"] == "chief_of_staff"
    assert got["decision"] == "Approved"
    assert d.bus.of_type("approval.decided")[0]["approved"] is True
    assert await d.ledger.consume_approval("h1") is True


async def test_refuses_an_approval() -> None:
    d = make()
    a = await d.ledger.request_approval(
        {"agent": "w1", "ticket_id": None, "tool": "Bash", "action": "rm -rf /data", "hash": "h2", "reason": "x"}
    )
    await review(chief(d, Model({"decision": "refuse", "reason": "Would delete the owner's data."})))
    got = await d.ledger.get_approval(a["id"])
    assert got is not None and got["status"] == "denied" and got["decision"] == "Refused"


async def test_with_autopilot_off_items_that_need_the_owners_hands_stay_open_with_one_sentence_why() -> None:
    d = make()
    await d.ledger.update_settings({"autopilot": False})
    q = await d.ledger.ask_question(
        {
            "asked_by": "w1",
            "path": "w1",
            "ticket_id": None,
            "text": "Paste your Stripe secret key?",
            "options": [],
            "default_answer": "skip",
        }
    )
    model = Model({"decision": "needs_owner", "why": "Only you can paste your Stripe key in Settings."})
    await review(chief(d, model))
    got = await d.ledger.get_question(q["id"])
    assert got is not None and got["status"] == "open" and "Stripe key" in got["needs_owner_reason"]
    s = js(await handle_http(ev("GET", "/chief-of-staff"), d))
    assert s["needs_owner"] == [{"id": q["id"], "title": q["text"], "why": got["needs_owner_reason"], "service": ""}]
    # Later sweeps leave it alone: no second model call.
    await d.ledger.table.delete(f"IDEMP#chief:{q['id']}", "META")
    await review(chief(d, model))
    assert len(model.calls) == 1


async def test_off_means_items_wait_for_the_owner() -> None:
    d = make()
    await _stuck_research(d)
    off = {"chief_of_staff_enabled": False, "autopilot": False}
    assert (await handle_http(ev("PUT", "/settings", off), d))["statusCode"] == 200
    model = Model({"decision": "answer", "answer": "Wait", "reason": "r"})
    assert (await review(chief(d, model)))["skipped"]
    assert model.calls == []
    assert js(await handle_http(ev("GET", "/chief-of-staff"), d))["enabled"] is False


async def test_a_reply_that_is_not_a_decision_changes_nothing() -> None:
    d = make()
    _, q = await _stuck_research(d)
    out = await review(chief(d, Model("I think you should wait.")))
    assert out["results"][0]["result"] == "unparsed"
    got = await d.ledger.get_question(q["id"])
    assert got is not None and got["status"] == "open" and "decided_by" not in got


async def test_falls_back_to_opus_once_when_fable_refuses() -> None:
    d = make()
    await _stuck_research(d)
    model = Model({"decision": "answer", "answer": "Wait", "reason": "r"}, refuse_primary=True)
    await review(chief(d, model))
    assert [c.model.name for c in model.calls] == ["fable-5-1", "opus-5-5"]


async def test_stops_a_job_stuck_in_a_loop() -> None:
    d = make()
    task, _ = await _stuck_research(d)
    await review(chief(d, Model({"decision": "stop_job", "reason": "Asked the same thing five times."})))
    assert (await d.ledger.get_ticket(task["id"]))["status"] == "cancelled"
    assert d.bus.of_type("steward.decided")[0]["choice"] == "Stopped the job"


async def test_one_review_per_item_even_when_event_and_sweep_race() -> None:
    d = make()
    await _stuck_research(d)
    model = Model("not json")
    await review(chief(d, model))
    await review(chief(d, model))
    assert len(model.calls) == 1


async def test_steward_apply_refuses_bad_ops_and_wrong_kinds() -> None:
    d = make()
    _, q = await _stuck_research(d)
    assert (await steward_apply({"kind": "question", "id": q["id"], "op": "approve"}, d))["ok"] is False
    assert (await steward_apply({"kind": "nope", "id": q["id"], "op": "answer"}, d))["ok"] is False
    assert (await steward_apply({"kind": "question", "id": "../x", "op": "answer", "answer": "a"}, d))["ok"] is False


def test_parse_decision_tolerates_fences_and_rejects_wrong_shapes() -> None:
    assert parse_decision('```json\n{"decision": "approve", "reason": "ok"}\n```', "approval") is not None
    assert parse_decision('{"decision": "approve"}', "question") is None
    assert parse_decision('{"decision": "answer", "answer": ""}', "question") is None
    assert parse_decision('{"decision": "needs_owner"}', "question") is None
    assert parse_decision("no", "question") is None


async def test_lambda_reviews_the_item_an_event_is_about() -> None:
    d = make()
    _, q = await _stuck_research(d)
    event = {"detail-type": "question.asked", "detail": {"question": {"id": q["id"]}}}
    assert item_id(event) == q["id"]
    assert item_id({"detail-type": "approval.requested", "detail": {"id": "ap-1"}}) == "ap-1"
    assert item_id({"detail-type": "ticket.status", "detail": {}}) is None
    out = await handle(event, chief(d, Model({"decision": "answer", "answer": "Wait", "reason": "r"})))
    assert out["reviewed"] == 1


async def test_daily_digest_is_one_paragraph_in_aics_conversation_once() -> None:
    d = make()
    await _stuck_research(d)
    await review(chief(d, Model({"decision": "answer", "answer": "Wait", "reason": "r"})))
    assert (await digest(d.ledger, d.bus))["digest"] == "sent"
    assert (await digest(d.ledger, d.bus))["digest"] == "already sent"
    line = (await d.ledger.recent_conversation("main"))[-1]
    assert line["who"] == "ace" and "decided 1 item" in line["text"]
    assert d.bus.of_type("ace.reply")[0]["done"] is True
