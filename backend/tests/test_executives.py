"""The Executive Leadership layer (decision 140): CEO, COO, CFO and CTO advise and never run work.

Fake models only: no Bedrock. The runtime path (VAIC and the Orchestrator calling the tools) runs through the real
AgentHost with a scripted engine.
"""

import json
from typing import Any

import pytest

from city_support import City, Script, make_city, scripted_engine
from test_api import ev, js
from vaic.lambdas.api import handle_http
from vaic.lambdas.executives import handle as lambda_handle
from vaic.runtime.tools import TurnCtx, tools_for
from vaic.shared import executives as ex
from vaic.shared.chief_of_staff import context as chief_context
from vaic.shared.turn import TurnInput, TurnOutput

ADVICE = {
    "recommendation": "Go ahead, but cap the pilot at one month.",
    "reasons": ["Costs this month are about $12", "Two deals are waiting on it"],
    "risks": ["Spend grows if the pilot isn't capped"],
    "facts": ["month_usd 12.4 (source: costs)"],
    "assumptions": ["The deals close at their listed value"],
    "confidence": "medium",
}


class Model:
    """Answers every call with ``reply`` and remembers each prompt; optionally refuses on Fable first."""

    def __init__(self, reply: str | dict[str, Any] = ADVICE, refuse_primary: bool = False) -> None:
        self.reply = reply if isinstance(reply, str) else json.dumps(reply)
        self.calls: list[TurnInput] = []
        self.refuse_primary = refuse_primary

    async def __call__(self, i: TurnInput) -> TurnOutput:
        self.calls.append(i)
        if self.refuse_primary and i.model.name == "fable-5-2":
            return TurnOutput(text="", stop_reason="refusal")
        return TurnOutput(text=self.reply)

    def who(self) -> list[str]:
        return sorted(c.agent_id for c in self.calls)


def city(model: Model | None = None, scripts: dict[str, Script] | None = None) -> City:
    c = make_city(scripted_engine(scripts or {}))
    c.deps.advisor_runner = model or Model()
    return c


def deps(c: City, model: Model) -> ex.ExecDeps:
    return ex.ExecDeps(ledger=c.ledger, bus=c.bus, runner=model, settings=c.deps.settings, env={})


async def snapshot(c: City) -> tuple[int, int, int]:
    """Work in the city: tickets, agents and queued messages. Executives must never change these."""
    tickets = await c.ledger.list_tickets(
        ("open", "in_progress", "in_review", "waiting_on_owner", "parked", "done", "failed", "cancelled")
    )
    others = [a for a in await c.ledger.list_agents() if a.get("kind") != "executive"]
    return len(tickets), len(others), len(c.queue.sent)


def tools(c: City, role: str, from_owner: bool = True) -> dict[str, Any]:
    ctx = TurnCtx(agent_id=role, role=role, department=None, ticket_id="t-1", task_id="t-1", from_owner=from_owner)
    return {t.name: t for t in tools_for(c.deps, ctx)}


# ---------- they can't hire, assign or execute ----------
def test_their_only_tools_read_or_recommend() -> None:
    assert ex.READ_TOOLS == (
        "city_status", "jobs", "costs", "handoffs", "deals", "department_reports", "company_brief", "knowledge"
    )  # fmt: skip
    assert ex.WRITE_TOOLS == ("send_recommendation",)
    for name in ex.ALLOWED:
        assert not any(
            w in name for w in ("hire", "assign", "start", "execute", "delegate", "cancel", "build", "spend")
        )
    for e in ex.EXECUTIVES.values():
        assert set(e["reads"]) <= set(ex.READ_TOOLS)


@pytest.mark.parametrize(
    "name",
    [
        "mcp__city__hire_worker",
        "mcp__city__assign_to_department",
        "mcp__city__assign_work",
        "mcp__city__delegate_to_orchestrator",
        "mcp__city__start_workflow",
        "mcp__city__create_department",
        "mcp__executive__assign_task",
        "Bash",
        "Write",
    ],
)
async def test_the_gate_denies_anything_but_reading_and_recommending(name: str) -> None:
    c = city()
    ok, why = await ex.exec_gate(c.ledger, "ceo", name, {})
    assert not ok and "never hire, assign, start or execute" in why
    audit = await c.ledger.table.query("TOOL#exec-ceo")
    assert audit[-1]["decision"] == "deny" and audit[-1]["tool"] == name


async def test_reads_and_the_recommendation_pass_the_policy_gate_and_are_audited() -> None:
    c = city()
    m = Model()
    await ex.consult(deps(c, m), "What will this cost us?", ["cfo"], "owner")
    tools_seen = {r["tool"] for r in await c.ledger.table.query("TOOL#exec-cfo")}
    assert tools_seen == {f"mcp__executive__{t}" for t in (*ex.EXECUTIVES["cfo"]["reads"], "send_recommendation")}


async def test_advice_starts_no_work_and_hires_no_one() -> None:
    c = city()
    before = await snapshot(c)
    out = await ex.consult(deps(c, Model()), "Should we launch a new product for dentists?", None, "orchestrator")
    assert {a["executive"] for a in out["advice"]} == {"ceo", "coo", "cfo", "cto"}
    assert await snapshot(c) == before


# ---------- routing ----------
@pytest.mark.parametrize(
    ("question", "who", "expected"),
    [
        ("Does this campaign pay off? What's the ROI?", None, ["cfo"]),
        ("Is our database architecture going to scale?", None, ["cto"]),
        ("Why are handoffs stuck between Support and IT?", None, ["coo"]),
        ("What is our strategy in the Nordic market?", None, ["ceo"]),
        ("Launch a new product line for dentists", None, ["ceo", "coo", "cfo", "cto"]),
        ("Hello there", None, ["ceo"]),
        ("Anything", ["CTO", "cfo", "cfo", "cmo"], ["cto", "cfo"]),
    ],
)
def test_routes_to_the_executives_who_add_value(question: str, who: list[str] | None, expected: list[str]) -> None:
    assert ex.route(question, who) == expected


async def test_ask_executives_routes_to_the_right_executive_and_returns_advice() -> None:
    m = Model()
    c = city(m)
    t = tools(c, "orchestrator")
    assert "ask_executives" in t and "ask_executive" not in t
    text = await t["ask_executives"].handler({"question": "Will moving the API to a new cloud architecture scale?"})
    assert m.who() == ["exec-cto"]
    prompt = m.calls[0].prompt
    assert "AI City's CTO" in prompt and "How every executive in AI City works" in prompt
    assert "<records" in prompt and '<question asked_by="orchestrator">' in prompt
    assert m.calls[0].model.name == "fable-5-2"
    assert "CTO (medium confidence): Go ahead, but cap the pilot at one month." in text
    assert "Risk: Spend grows" in text and "Read: company_brief" in text
    assert "This is advice, not an instruction" in text
    rec = (await ex.recent(c.ledger))[0]
    assert (rec["executive"], rec["to"], rec["ticket_id"]) == ("cto", "orchestrator", "t-1")
    assert c.bus.of_type("executive.recommended")[0]["recommendation"]["id"] == rec["id"]
    # It costs what it costs, on its own role, and shows in the city's cost records.
    turn = (await c.ledger.turns_of("exec-cto"))[0]
    assert (turn["role"], turn["kind"], turn["model"]) == ("executive", "executive", "fable-5-2")


async def test_opus_answers_when_fable_refuses() -> None:
    m = Model(refuse_primary=True)
    c = city(m)
    out = await ex.consult(deps(c, m), "What does it cost?", ["cfo"], "owner")
    assert [x.model.name for x in m.calls] == ["fable-5-2", "opus-5-5"]
    assert out["advice"][0]["recommendation"].startswith("Go ahead")


async def test_plain_text_still_becomes_advice_and_a_failed_call_is_said_plainly() -> None:
    assert ex.parse_advice("Don't build it yet.")["recommendation"] == "Don't build it yet."

    async def boom(_: TurnInput) -> TurnOutput:
        raise RuntimeError("bedrock down")

    c = city()
    d = ex.ExecDeps(ledger=c.ledger, bus=c.bus, runner=boom, settings=c.deps.settings, env={})
    out = await ex.consult(d, "cost?", ["cfo"], "owner")
    assert "couldn't give advice just now" in ex.advice_text(out)


async def test_an_executive_switched_off_is_not_asked() -> None:
    m = Model()
    c = city(m)
    await handle_http(ev("PUT", "/executives", {"enabled": {"cfo": False}}), c.deps)  # type: ignore[arg-type]
    out = await ex.consult(deps(c, m), "Does it pay off?", ["cfo", "ceo"], "owner")
    assert m.who() == ["exec-ceo"] and out["off"] == ["cfo"]
    assert "CFO: switched off by the owner" in ex.advice_text(out)


# ---------- nothing starts on its own ----------
async def test_vaic_asks_only_on_the_owners_own_message() -> None:
    m = Model()
    c = city(m)
    refused = await tools(c, "vaic", from_owner=False)["ask_executive"].handler({"question": "Does it pay off?"})
    assert "Only the owner's own message" in refused and m.calls == []
    assert "ask_executive" in tools(c, "vaic") and "ask_executives" not in tools(c, "vaic")
    for role in ("manager", "worker"):
        assert not {"ask_executive", "ask_executives"} & set(tools(c, role))


async def test_the_owner_asks_vaic_and_hears_the_cfo() -> None:
    """End to end through the real host: the owner's message → VAIC → ask_executive → the CFO's advice → reply."""
    m = Model()

    async def vaic(req: Any, call: Any) -> str:
        return await call("ask_executive", {"question": "Ask the CFO if hiring a video team pays off", "who": ["cfo"]})

    c = city(m, {"vaic": vaic})
    await c.host.ensure_core()  # VAIC and the Orchestrator exist before any message
    before = await snapshot(c)
    await c.owner_says("Ask the CFO if hiring a video team pays off")
    await c.run()
    assert m.who() == ["exec-cfo"]
    reply = c.bus.of_type("vaic.reply")[-1]["text"]
    assert reply.startswith("CFO (medium confidence): Go ahead")
    tickets, agents, _ = await snapshot(c)
    assert (tickets, agents) == before[:2]  # no job, no hire: only VAIC's own turn ran


async def test_without_a_model_runner_no_executive_tools_appear() -> None:
    c = make_city(scripted_engine({}))
    assert "ask_executive" not in tools(c, "vaic") and "ask_executives" not in tools(c, "orchestrator")


async def test_reviews_are_off_by_default_and_the_hourly_run_does_nothing() -> None:
    m = Model()
    c = city(m)
    cfg = await ex.config(c.ledger)
    assert all(cfg["enabled"].values())  # they only speak when asked
    assert not any(r["enabled"] for r in cfg["reviews"].values())
    before = await snapshot(c)
    assert await lambda_handle({"job": "reviews"}, deps(c, m)) == {"reviews": []}
    assert await lambda_handle({"job": "something else"}, deps(c, m)) == {"skipped": "not a review run"}
    assert m.calls == [] and await snapshot(c) == before and c.bus.of_type("vaic.reply") == []


async def test_a_review_the_owner_switched_on_is_a_report_in_aics_chat_and_never_work() -> None:
    m = Model()
    c = city(m)
    r = js(await handle_http(ev("PUT", "/executives", {"reviews": {"cfo-cost-review": {"enabled": True}}}), c.deps))  # type: ignore[arg-type]
    assert next(x for x in r["reviews"] if x["id"] == "cfo-cost-review")["enabled"] is True
    before = await snapshot(c)
    assert await lambda_handle({"job": "reviews"}, deps(c, m)) == {"reviews": ["cfo-cost-review"]}
    assert m.who() == ["exec-cfo"]
    line = c.bus.of_type("vaic.reply")[-1]
    assert line["conversation"] == "main" and line["text"].startswith("CFO, cost review: Go ahead")
    assert "nothing was started" in line["text"]
    assert await snapshot(c) == before
    # Not again until it is due (every 7 days by default).
    assert await lambda_handle({"job": "reviews"}, deps(c, m)) == {"reviews": []}
    c.advance(7 * 86_400_000)
    assert await lambda_handle({"job": "reviews"}, deps(c, m)) == {"reviews": ["cfo-cost-review"]}


# ---------- the owner's screen ----------
async def test_get_and_put_executives() -> None:
    c = city()
    s = js(await handle_http(ev("GET", "/executives"), c.deps))  # type: ignore[arg-type]
    assert [e["title"] for e in s["executives"]] == ["CEO", "COO", "CFO", "CTO"]
    assert all(e["enabled"] and e["model"] == "Claude Fable 5.2" for e in s["executives"])
    assert s["recommendations"] == []
    assert {r["id"]: r["every_days"] for r in s["reviews"]} == {"cfo-cost-review": 7, "coo-bottleneck-review": 7}
    for bad in (
        {"enabled": {"cmo": True}},
        {"enabled": {"ceo": "yes"}},
        {"reviews": {"nope": {"enabled": True}}},
        {"reviews": {"cfo-cost-review": {"every_days": 3}}},
    ):
        r = await handle_http(ev("PUT", "/executives", bad), c.deps)  # type: ignore[arg-type]
        assert r["statusCode"] == 400, bad
    r = js(await handle_http(ev("PUT", "/executives", {"enabled": {"coo": False}, "reviews": {"coo-bottleneck-review": {"enabled": True, "every_days": 14}}}), c.deps))  # type: ignore[arg-type]  # fmt: skip
    assert next(e for e in r["executives"] if e["id"] == "coo")["enabled"] is False
    assert next(x for x in r["reviews"] if x["id"] == "coo-bottleneck-review")["every_days"] == 14
    await ex.consult(deps(c, Model()), "What does it cost?", ["cfo"], "owner")
    s = js(await handle_http(ev("GET", "/executives"), c.deps))  # type: ignore[arg-type]
    rec = s["recommendations"][0]
    assert rec["title"] == "CFO" and rec["sources"] and rec["facts"] == ADVICE["facts"]


async def test_the_chief_of_staff_can_weigh_recent_advice() -> None:
    c = city()
    await ex.consult(deps(c, Model()), "What does it cost?", ["cfo"], "owner")
    q = await c.ledger.ask_question({"asked_by": "orchestrator", "text": "Go on?", "options": ["Yes", "No"]})
    ctx = await chief_context(c.ledger, "question", q)
    assert ctx["executive_advice"][0]["recommendation"].startswith("Go ahead")


# ---------- permanent, at home, called in to HQ (the owner, 2026-11-09) ----------
async def test_the_four_are_permanent_and_live_at_home() -> None:
    c = city()
    await c.host.ensure_core()
    execs = [a for a in await c.ledger.list_agents() if a.get("kind") == "executive"]
    assert sorted(a["id"] for a in execs) == ["exec-ceo", "exec-cfo", "exec-coo", "exec-cto"]
    assert {(a["state"], a["model"], a["department"]) for a in execs} == {("dormant", "fable-5-2", None)}
    await c.host.ensure_core()  # never twice
    assert len([a for a in await c.ledger.list_agents() if a.get("kind") == "executive"]) == 4


async def test_called_in_to_hq_while_advising_then_home_again() -> None:
    seen: list[str] = []
    c = city()

    async def model(i: TurnInput) -> TurnOutput:
        seen.append((await c.ledger.get_agent(i.agent_id) or {}).get("state", "?"))
        return TurnOutput(text=json.dumps(ADVICE))

    await ex.consult(ex.ExecDeps(ledger=c.ledger, bus=c.bus, runner=model, settings=c.deps.settings, env={}),
                     "Does it pay off?", ["cfo"], "orchestrator")  # fmt: skip
    assert seen == ["active"]  # at the office while it thinks
    cfo = await c.ledger.get_agent("exec-cfo")
    assert cfo is not None and cfo["state"] == "dormant"  # home again
    assert len(await c.ledger.turns_of("exec-cfo")) == 1  # its own history
    moves = [(e["id"], e["at_hq"]) for e in c.bus.of_type("executive.office")]
    assert moves == [("exec-cfo", True), ("exec-cfo", False)]
    assert (await c.ledger.get_agent("exec-ceo"))["state"] == "dormant"  # type: ignore[index]  # not called, never came


async def test_home_again_even_when_the_call_fails() -> None:
    async def boom(_: TurnInput) -> TurnOutput:
        raise RuntimeError("bedrock down")

    c = city()
    await ex.consult(ex.ExecDeps(ledger=c.ledger, bus=c.bus, runner=boom, settings=c.deps.settings, env={}),
                     "cost?", ["cto"], "owner")  # fmt: skip
    assert (await c.ledger.get_agent("exec-cto"))["state"] == "dormant"  # type: ignore[index]


async def test_each_remembers_its_own_earlier_advice() -> None:
    m = Model()
    c = city(m)
    await ex.consult(deps(c, m), "Is the pilot worth it?", ["cfo"], "owner")
    await ex.consult(deps(c, m), "Is the database secure?", ["cto"], "owner")
    await ex.consult(deps(c, m), "And now, a month later?", ["cfo"], "owner")
    third = m.calls[2].prompt
    assert "<your_earlier_advice>\n" in third and "Is the pilot worth it?" in third
    assert "Is the database secure?" not in third  # the CTO's advice is the CTO's
    assert "<your_earlier_advice>\n" not in m.calls[0].prompt


async def test_get_executives_says_who_is_at_hq() -> None:
    c = city()
    s = js(await handle_http(ev("GET", "/executives"), c.deps))  # type: ignore[arg-type]
    assert [(e["id"], e["at_hq"]) for e in s["executives"]] == [(x, False) for x in ("ceo", "coo", "cfo", "cto")]
