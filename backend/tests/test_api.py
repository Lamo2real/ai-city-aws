import json
from datetime import UTC, datetime
from typing import Any
from urllib.parse import parse_qsl

import pytest

from vaic.lambdas.api import ROUTES, ApiDeps, handle_http, is_owner
from vaic.lambdas.approvals import on_approval_step
from vaic.lambdas.ws import authorize, broadcast, on_connection
from vaic.shared.caps import default_settings
from vaic.shared.cost import Usage
from vaic.shared.events import MemoryBus
from vaic.shared.hierarchy.queue import MemoryQueue
from vaic.shared.ledger import Ledger
from vaic.shared.presets import presets
from vaic.shared.table import MemoryTable, UpdateOptions
from vaic.shared.turn import TurnInput, TurnOutput
from vaic.shared.utility import wake_match


class Clock:
    def __init__(self) -> None:
        self.t = datetime(2026, 11, 6, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.t


class Deps(ApiDeps):
    bus: MemoryBus  # type: ignore[assignment]
    queue: MemoryQueue  # type: ignore[assignment]


def make(clock: Clock | None = None, **extra: Any) -> Any:
    ledger = Ledger(MemoryTable(), clock or Clock())

    async def settings() -> dict[str, Any]:
        return await ledger.settings(default_settings())

    return ApiDeps(ledger=ledger, bus=MemoryBus(), queue=MemoryQueue(), settings=settings, **extra)


def ev(method: str, path: str, body: Any = None, groups: Any = "[owner]") -> dict[str, Any]:
    p, _, qs = path.partition("?")
    return {
        "rawPath": p,
        "requestContext": {
            "http": {"method": method},
            "authorizer": {"jwt": {"claims": {} if groups is None else {"cognito:groups": groups}}},
        },
        "queryStringParameters": dict(parse_qsl(qs)) if qs else None,
        "body": None if body is None else json.dumps(body),
    }


def js(r: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = json.loads(r["body"])
    return out


# ---------- every route requires the owner group ----------
@pytest.mark.parametrize(("method", "path"), ROUTES)
async def test_every_route_rejects_a_token_without_the_owner_group(method: str, path: str) -> None:
    for groups in (None, "[]", "[friends]", ["admins"], "ownerish"):
        r = await handle_http(ev(method, path, {}, groups), make())
        assert r["statusCode"] == 403, groups
        assert "Only the owner" in js(r)["error"]


def test_accepts_the_group_in_each_shape_api_gateway_can_send() -> None:
    for g in ("[owner]", "owner", "[admins owner]", ["owner"]):
        assert is_owner(ev("GET", "/city", None, g))


# ---------- HTTP routes ----------
async def test_post_messages_queues_the_owners_message_for_vaic_keyed_by_the_client_id() -> None:
    d = make()
    r = await handle_http(
        ev("POST", "/messages", {"text": "yo VAIC, what's 9 + 9?", "conversation": "c1", "client_id": "abcd1234"}), d
    )
    assert r["statusCode"] == 202
    m = d.queue.sent[0]
    assert (m["id"], m["role"], m["conversation"], m["from"]) == ("owner-abcd1234", "vaic", "c1", "owner")
    assert "voice" not in m
    await handle_http(ev("POST", "/messages", {"text": "status?", "voice": True}), d)
    assert d.queue.sent[1]["voice"] is True  # said out loud: VAIC is told to keep it short
    assert (await handle_http(ev("POST", "/messages", {"text": ""}), d))["statusCode"] == 400
    assert (await handle_http({**ev("POST", "/messages"), "body": "{"}, d))["statusCode"] == 400


async def test_get_city_returns_the_snapshot_the_city_view_starts_from() -> None:
    d = make()
    await d.ledger.create_department("Engineering", "Build software.", "mgr-engineering")
    r = js(await handle_http(ev("GET", "/city"), d))
    assert r["departments"][0]["name"] == "Engineering"
    assert r["usage"] == {"usd": 0, "turns": 0, "tokens": 0}
    assert r["caps"] == {"daily_global_usd": None, "monthly_budget_usd": None, "daily_department_usd": None}


async def test_answers_a_question_with_the_default_in_one_tap_once() -> None:
    d = make()
    q = await d.ledger.ask_question(
        {
            "asked_by": "w1",
            "path": "mgr › w1",
            "ticket_id": None,
            "text": "Which DB?",
            "options": ["Postgres", "SQLite"],
            "default_answer": "SQLite",
        }
    )
    r = await handle_http(ev("POST", f"/questions/{q['id']}/default", {}), d)
    assert js(r) == {"answered": True, "answer": "SQLite"}
    a = d.bus.of_type("question.answered")[0]
    assert (a["answer"], a["answered_by"]) == ("SQLite", "owner")
    assert (await handle_http(ev("POST", f"/questions/{q['id']}/default", {}), d))["statusCode"] == 409


class FakeSfn:
    def __init__(self) -> None:
        self.sent: list[tuple[str, dict[str, Any]]] = []

    def send_task_success(self, **kw: Any) -> dict[str, Any]:
        self.sent.append(("success", kw))
        return {}

    def send_task_failure(self, **kw: Any) -> dict[str, Any]:
        self.sent.append(("failure", kw))
        return {}


async def test_decides_an_approval_and_sends_the_step_functions_task_result() -> None:
    sfn = FakeSfn()
    d = make(sfn=sfn)
    a = await d.ledger.request_approval(
        {"agent": "w1", "ticket_id": "t1", "tool": "Bash", "action": "npm publish", "hash": "h", "reason": "publishing"}
    )
    await d.ledger.table.update(f"APPROVAL#{a['id']}", "META", UpdateOptions(set={"task_token": "tok"}))
    r = await handle_http(ev("POST", f"/approvals/{a['id']}", {"approved": True}), d)
    assert r["statusCode"] == 200
    assert len(sfn.sent) == 1 and sfn.sent[0][0] == "success"
    assert await d.ledger.consume_approval("h") is True
    assert (await handle_http(ev("POST", f"/approvals/{a['id']}", {"approved": False}), d))["statusCode"] == 409


async def test_put_settings_caps_are_optional_impossible_values_refused_null_clears() -> None:
    d = make()
    assert "zero or more" in js(await handle_http(ev("PUT", "/settings", {"daily_global_usd": -5}), d))["error"]
    # No daily cap: a department cap of any size is fine.
    assert (await handle_http(ev("PUT", "/settings", {"department_caps": {"Eng": 9999}}), d))["statusCode"] == 200
    assert (await handle_http(ev("PUT", "/settings", {"daily_global_usd": 500}), d))["statusCode"] == 200
    assert (await d.settings())["daily_global_usd"] == 500
    # With a daily cap, a department cap above it is refused.
    assert (await handle_http(ev("PUT", "/settings", {"department_caps": {"Eng": 9999}}), d))["statusCode"] == 400
    assert (await handle_http(ev("PUT", "/settings", {"max_new_sessions_per_second": 40}), d))["statusCode"] == 400
    assert (await handle_http(ev("PUT", "/settings", {"daily_global_usd": None}), d))["statusCode"] == 200
    assert (await d.settings())["daily_global_usd"] is None


async def test_costs_are_labelled_as_estimates_split_by_department_role_and_model() -> None:
    d = make()
    await d.ledger.record_turn(
        {
            "agent": "w1",
            "role": "worker",
            "department": "Eng",
            "ticket_id": None,
            "kind": "worker",
            "model": "opus-5-5",
            "fallback": False,
            "input": 1,
            "output": 1,
            "cache_read": 0,
            "cache_write_5m": 0,
            "cache_write_1h": 0,
            "usd": 1.5,
            "cache_savings_usd": 0.3,
            "outcome": "ok",
        }
    )
    c = js(await handle_http(ev("GET", "/costs"), d))
    assert c["estimate"] is True
    assert c["by_department"]["eng"]["usd"] == 1.5
    assert c["by_role"]["worker"]["usd"] == 1.5
    assert c["by_model"]["Claude Opus 5.5"]["usd"] == 1.5


async def test_hides_internal_errors_behind_plain_words() -> None:
    d = make()

    async def boom(*_: Any) -> Any:
        raise RuntimeError("DynamoDB exploded: arn:aws:...")

    d.ledger.list_agents = boom
    r = await handle_http(ev("GET", "/city"), d)
    assert r["statusCode"] == 500
    assert "arn:" not in r["body"] and "DynamoDB" not in r["body"]
    assert "Nothing was lost" in js(r)["error"]


async def test_wake_check_plain_matching_first_haiku_only_for_unclear_transcripts() -> None:
    calls = 0

    async def runner(_: TurnInput) -> TurnOutput:
        nonlocal calls
        calls += 1
        return TurnOutput(text="YES", usage=Usage(input=50, output=1))

    d = make(utility_runner=runner)
    assert js(await handle_http(ev("POST", "/wake-check", {"transcript": "yo VAIC, status?"}), d))["addressed"] is True
    assert js(await handle_http(ev("POST", "/wake-check", {"transcript": "pass the salt"}), d))["addressed"] is False
    assert calls == 0
    assert (
        js(await handle_http(ev("POST", "/wake-check", {"transcript": "so I told VAIC about it"}), d))["addressed"]
        is True
    )
    assert calls == 1
    assert (await d.ledger.spend("day", "ROLE#utility"))["turns"] == 1  # utility turns are costed and capped


# ---------- wake word ----------
@pytest.mark.parametrize(
    ("t", "want"),
    [
        ("yo VAIC", "yes"),
        ("hi VAIC, how are things", "yes"),
        ("hey a.i.c.", "yes"),
        ("what's up VAIC", "yes"),
        ("how's it going VAIC", "yes"),
        ("VAIC, pause everything", "yes"),
        ("what's the status of the product, VAIC?", "yes"),
        ("VAIC what time is it", "yes"),
        ("the race was fun", "no"),
        ("I placed an vaic in the deck", "unclear"),
        ("yo Vaic", "yes"),
        ("so I told VAIC about it", "unclear"),
        ("", "no"),
    ],
)
def test_wake_word(t: str, want: str) -> None:
    assert wake_match(t) == want


# ---------- WebSocket ----------
class Verifier:
    def __init__(self, groups: list[str] | None) -> None:
        self.groups = groups

    def verify(self, token: str) -> dict[str, Any]:
        if token == "bad.bad.bad":
            raise ValueError("invalid")
        return {"sub": "u1", **({"cognito:groups": self.groups} if self.groups is not None else {})}


def _effect(r: dict[str, Any]) -> str:
    return str(r["policyDocument"]["Statement"][0]["Effect"])


def test_the_connect_authorizer_allows_only_a_valid_owner_token() -> None:
    e = {"methodArn": "arn:ws", "queryStringParameters": {"token": "a.b.c"}}
    assert _effect(authorize(e, Verifier(["owner"]))) == "Allow"
    assert _effect(authorize(e, Verifier(["guest"]))) == "Deny"
    assert _effect(authorize(e, Verifier(None))) == "Deny"
    bad = {"methodArn": "arn:ws", "queryStringParameters": {"token": "bad.bad.bad"}}
    assert _effect(authorize(bad, Verifier(["owner"]))) == "Deny"
    assert _effect(authorize({"methodArn": "arn:ws"}, Verifier(["owner"]))) == "Deny"
    proto = {"methodArn": "arn:ws", "headers": {"Sec-WebSocket-Protocol": "vaic, a.b.c"}}
    assert _effect(authorize(proto, Verifier(["owner"]))) == "Allow"


async def test_stores_connections_with_a_ttl_broadcasts_and_drops_gone_connections() -> None:
    table = MemoryTable()
    await on_connection({"requestContext": {"routeKey": "$connect", "connectionId": "c1"}}, table, 0)
    await on_connection({"requestContext": {"routeKey": "$connect", "connectionId": "c2"}}, table, 0)
    assert (await table.get("CONN#c1", "META") or {})["ttl"] == 7200
    posted: list[str] = []

    class P:
        async def post(self, cid: str, data: str) -> Any:
            posted.append(cid)
            return "gone" if cid == "c2" else "ok"

    class Ok:
        async def post(self, cid: str, data: str) -> Any:
            return "ok"

    r = await broadcast({"type": "agent.retired", "id": "w1", "at": "2026-11-06T12:00:00.000Z"}, table, P())
    assert r == {"sent": 1, "gone": 1}
    assert await table.get("CONN#c2", "META") is None
    assert (await broadcast({"type": "nope"}, table, Ok()))["sent"] == 0

    class Breaks:  # one connection that fails never stops the others
        async def post(self, cid: str, data: str) -> Any:
            if cid == "c1":
                raise RuntimeError("the connection broke")
            return "ok"

    await on_connection({"requestContext": {"routeKey": "$connect", "connectionId": "c3"}}, table, 0)
    assert await broadcast(
        {"type": "agent.retired", "id": "w1", "at": "2026-11-06T12:00:00.000Z"}, table, Breaks()
    ) == {
        "sent": 1,
        "gone": 0,
    }
    await on_connection({"requestContext": {"routeKey": "$disconnect", "connectionId": "c3"}}, table)
    await on_connection({"requestContext": {"routeKey": "$disconnect", "connectionId": "c1"}}, table)
    assert await table.query_index("gsi1", "CONN") == []


# ---------- approval steps ----------
async def test_stores_the_task_token_and_wakes_the_agent_with_the_owners_decision() -> None:
    d = make()
    await d.ledger.put_agent(
        {
            "id": "w1",
            "kind": "worker",
            "role": "Dev",
            "department": "Eng",
            "model": "opus-5-5",
            "parent": "mgr-eng",
            "state": "active",
            "total_cost_usd": 0,
        }
    )
    a = await d.ledger.request_approval(
        {"agent": "w1", "ticket_id": "t1", "tool": "Bash", "action": "npm publish", "hash": "h", "reason": "publishing"}
    )
    await on_approval_step({"step": "store_token", "approvalId": a["id"], "taskToken": "tok"}, d.ledger, d.queue)
    assert (await d.ledger.get_approval(a["id"]) or {})["task_token"] == "tok"
    # Nobody answered within the workflow's day: that is not a refusal. The card closes and the agent is told so.
    await on_approval_step({"step": "resume", "approvalId": a["id"], "approved": False}, d.ledger, d.queue, None, d.bus)
    m = d.queue.sent[0]
    assert (m["role"], m["agentId"], m["kind"]) == ("worker", "w1", "answer")
    assert "did not answer" in m["body"] and "not refused" in m["body"]
    assert (await d.ledger.get_approval(a["id"]) or {})["status"] == "withdrawn"
    assert await d.ledger.decide_approval(a["id"], True) is None  # a late tap approves nothing
    # Run again for the same closed card (or one whose job stopped): nobody is told twice.
    await on_approval_step({"step": "resume", "approvalId": a["id"], "approved": False}, d.ledger, d.queue)
    assert len(d.queue.sent) == 1
    # A real refusal still says refused.
    b = await d.ledger.request_approval(
        {
            "agent": "w1",
            "ticket_id": "t1",
            "tool": "Bash",
            "action": "npm publish",
            "hash": "h2",
            "reason": "publishing",
        }
    )
    await d.ledger.decide_approval(b["id"], False)
    await on_approval_step({"step": "resume", "approvalId": b["id"], "approved": False}, d.ledger, d.queue)
    assert "refused this action" in d.queue.sent[1]["body"]


# ---------- the owner's direct controls: no model in the loop ----------
async def _office(d: Any) -> tuple[str, list[str]]:
    """A job with two live workers on it, straight into the ledger (as the hierarchy would leave it)."""
    await d.ledger.create_department("Writing", "Writing work.", "mgr-writing")
    await d.ledger.put_agent({"id": "mgr-writing", "kind": "manager", "role": "Writing Manager", "department": "Writing",
                              "model": "fable-5-1", "parent": "orchestrator", "state": "active", "total_cost_usd": 0})  # fmt: skip
    task = await d.ledger.create_ticket({"goal": "50 sentences on engines", "from": "vaic", "to": "orchestrator", "department": None,
                                         "parent_id": None, "kind": "task", "owner_words": "the Porsche sentences", "status": "in_progress"})  # fmt: skip
    goal = await d.ledger.create_ticket({"goal": "50 sentences", "from": "orchestrator", "to": "mgr-writing", "department": "Writing",
                                         "parent_id": task["id"], "kind": "assignment", "status": "in_progress"})  # fmt: skip
    workers = []
    for i in (1, 2):
        wid = f"wkr-{i}"
        await d.ledger.put_agent({"id": wid, "kind": "worker", "role": "Writer", "department": "Writing", "model": "opus-5-5",
                                  "parent": "mgr-writing", "state": "active", "worker_state": "working", "total_cost_usd": 0.1})  # fmt: skip
        part = await d.ledger.create_ticket({"goal": f"part {i}", "from": "mgr-writing", "to": wid, "department": "Writing",
                                             "parent_id": goal["id"], "kind": "assignment", "status": "in_progress"})  # fmt: skip
        await d.ledger.update_agent(wid, {"ticket_id": part["id"]})
        workers.append(wid)
    return task["id"], workers


async def test_post_workers_home_stops_every_job_and_sends_everyone_home_at_once() -> None:
    d = make()
    task_id, workers = await _office(d)
    r = await handle_http(ev("POST", "/workers/home"), d)
    assert r["statusCode"] == 200 and js(r) == {"jobs": 1, "workers": 2, "parts": 3, "managers": 1, "failed": 0}
    for w in workers:
        a = await d.ledger.get_agent(w)
        assert a and a["state"] == "retired" and a["worker_state"] == "released"
    assert sorted(e["id"] for e in d.bus.of_type("agent.retired")) == workers
    assert (await d.ledger.get_ticket(task_id))["status"] == "cancelled"  # the job itself is stopped
    # The manager stands down: dormant, its department hires nothing, and nobody is asked to re-assign.
    assert (await d.ledger.get_agent("mgr-writing"))["state"] == "dormant"
    assert (await d.ledger.get_department("Writing")).get("stood_down_at")
    assert not [m for m in d.queue.sent if "Assign again" in str(m.get("body"))]
    again = await handle_http(ev("POST", "/workers/home"), d)
    assert js(again) == {"jobs": 0, "workers": 0, "parts": 0, "managers": 1, "failed": 0}


async def test_post_tasks_cancel_stops_one_job_and_knows_a_wrong_or_finished_one() -> None:
    d = make()
    task, workers = await _office(d)
    assert (await handle_http(ev("POST", "/tasks/t-nope/cancel"), d))["statusCode"] == 404
    r = await handle_http(ev("POST", f"/tasks/{task}/cancel"), d)
    assert r["statusCode"] == 200 and js(r)["workers"] == 2
    assert (await d.ledger.get_ticket(task) or {})["status"] == "cancelled"
    for w in workers:
        assert (await d.ledger.get_agent(w) or {})["state"] == "retired"
    assert (await handle_http(ev("POST", f"/tasks/{task}/cancel"), d))["statusCode"] == 409


def test_there_is_no_pause_route_the_city_is_always_on() -> None:
    from vaic.lambdas.api import ROUTES

    assert not any("/city/pause" in r[1] or "/city/resume" in r[1] for r in ROUTES)


async def test_the_city_snapshot_never_lists_questions_of_a_job_that_already_stopped() -> None:
    d = make()
    t = await d.ledger.create_ticket(
        {"goal": "g", "from": "vaic", "to": "orchestrator", "department": None, "parent_id": None, "kind": "task",
         "status": "cancelled"}
    )  # fmt: skip
    await d.ledger.ask_question({"asked_by": "x", "path": "x", "ticket_id": t["id"], "text": "?", "options": [],
                                 "default_answer": "ok"})  # fmt: skip
    assert js(await handle_http(ev("GET", "/city"), d))["questions"] == []
    assert js(await handle_http(ev("GET", "/questions"), d))["questions"] == []


async def test_post_city_reset_empties_the_city_only_with_a_clear_confirm() -> None:
    d = make()
    task_id, _workers = await _office(d)
    await d.queue.send({"role": "manager", "ticketId": task_id, "department": "Writing"})
    refused = await handle_http(ev("POST", "/city/reset"), d)
    assert refused["statusCode"] == 400 and "Nothing was reset" in js(refused)["error"]
    refused = await handle_http(ev("POST", "/city/reset", {"confirm": "yes"}), d)
    assert refused["statusCode"] == 400
    assert await d.ledger.get_ticket(task_id) and d.queue.purged == 0

    r = await handle_http(ev("POST", "/city/reset", {"confirm": True}), d)
    assert r["statusCode"] == 200
    body = js(r)
    assert body["gone"]["AGENT"] == 3 and body["gone"]["TICKET"] >= 4 and body["records"] == sum(body["gone"].values())
    assert body["done"] is True  # the HUD keeps calling until this says so
    assert await d.ledger.get_ticket(task_id) is None and await d.ledger.list_agents() == []
    assert await d.ledger.get_department("Writing") is None
    assert d.queue.purged == 1 and d.queue.pending == []
    city = js(await handle_http(ev("GET", "/city"), d))
    assert city["agents"] == [] and city["tickets"] == []
    # Only the pre-configured departments stand again (decision 119): empty towers, ready for work.
    assert {x["name"] for x in city["departments"]} == {p["name"] for p in presets()}
    assert all(x["name"] != "Writing" for x in city["departments"])


async def test_post_agents_home_sends_one_clicked_worker_home_and_nothing_else() -> None:
    d = make()
    task_id, (w1, w2) = await _office(d)
    assert (await handle_http(ev("POST", "/agents/mgr-writing/home"), d))["statusCode"] == 404
    assert (await handle_http(ev("POST", "/agents/wkr-nope/home"), d))["statusCode"] == 404
    r = await handle_http(ev("POST", f"/agents/{w1}/home"), d)
    assert r["statusCode"] == 200 and js(r) == {"workers": 1, "parts": 1, "failed": 0}
    assert (await d.ledger.get_agent(w1))["state"] == "retired"
    assert (await d.ledger.get_agent(w2))["state"] == "active"  # the colleague stays
    assert (await d.ledger.get_ticket(task_id))["status"] == "in_progress"  # the job stays
    assert (await d.ledger.get_agent("mgr-writing"))["state"] == "active"
    assert (await handle_http(ev("POST", f"/agents/{w1}/home"), d))["statusCode"] == 409


async def test_post_agents_home_releases_the_worker_even_when_its_ticket_cannot_be_cancelled() -> None:
    d = make()
    _task_id, (w1, _w2) = await _office(d)
    d.ledger.table.fail_writes = 1  # the cancel of its part fails (a half-deleted ticket after a reset ran out of time)
    r = await handle_http(ev("POST", f"/agents/{w1}/home"), d)
    assert r["statusCode"] == 200 and js(r) == {"workers": 1, "parts": 0, "failed": 0}
    assert (await d.ledger.get_agent(w1))["state"] == "retired"  # off its desk all the same


async def test_post_agents_home_never_claims_a_worker_went_home_when_the_release_failed() -> None:
    d = make()
    _task_id, (w1, _w2) = await _office(d)
    d.ledger.table.fail_writes = 2  # the cancel and then the release itself fail
    r = await handle_http(ev("POST", f"/agents/{w1}/home"), d)
    assert r["statusCode"] == 500 and "could not be sent home" in js(r)["error"]
    assert (await d.ledger.get_agent(w1))["state"] == "active"
