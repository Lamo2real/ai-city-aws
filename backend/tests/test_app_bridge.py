"""Apps v2, the data bridge (docs/APPS.md § v2): the capability catalogue, manifests, grants, pins, the bridge
route, proposals and the policy for role ``app``. Fakes only: no AWS, no Bedrock, no real account."""

import json
from typing import Any

import pytest

from aic.lambdas.api import ROUTES, handle_http
from aic.lambdas.apps import on_submitted
from aic.shared.app_bridge import Readers, fit
from aic.shared.app_caps import (
    CATALOGUE,
    Invalid,
    LoginExpired,
    calendar_chunks,
    check_manifest,
    check_params,
    clean_cap,
    gate_name,
)
from aic.shared.apps import BRIDGE_JS, list_apps, publish_draft, request_publish_approvals, update_draft
from aic.shared.events import MemoryBus, parse_event
from aic.shared.ledger import Ledger
from aic.shared.policy import decide
from aic.shared.table import MemoryTable
from test_apps import GAME, FakeS3, api, draft, ev, js, origin, staged, submitted, upload

CAL = {"id": "calendar.read"}
WEATHER = {"id": "connector.read", "connector": "weather", "tool": "forecast"}


async def connectors(ledger: Ledger, status: str = "ready") -> None:
    await ledger.table.put(
        {
            "pk": "CONNECTORS",
            "sk": "CONN#weather",
            "id": "weather",
            "label": "Weather",
            "status": status,
            "tools": [
                {"name": "forecast", "read_only": True, "destructive": False,
                 "input_schema": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}},
                {"name": "set_alert", "read_only": False, "destructive": False},
                {"name": "mystery"},
            ],
        }
    )  # fmt: skip


class FakeMail:
    """The mail/calendar module as the bridge sees it."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, Any]] = []
        self.ran: list[tuple[str, dict[str, Any]]] = []
        self.fail: Exception | None = None

    async def calendar_events(self, start: str, end: str, calendar_ids: list[str] | None) -> dict[str, Any]:
        self.calls.append(("calendar_events", (start, end)))
        if self.fail:
            raise self.fail
        return {
            "events": [{"id": "e1", "account_id": "ma-1", "start": "2026-11-03T10:00:00+00:00", "title": "Dentist"},
                       {"id": f"e-{start[:10]}", "account_id": "ma-2", "start": start, "title": "Standup"}],
            "errors": [],
        }  # fmt: skip

    async def calendar_list(self) -> dict[str, Any]:
        return {"calendars": [{"id": "ma-1:primary", "name": "Personal"}], "errors": []}

    async def mail_search(self, params: dict[str, Any]) -> dict[str, Any]:
        self.calls.append(("mail_search", params))
        return {"messages": [{"id": "m1", "subject": "Hi", "body_text": "secret body", "attachments": []}]}

    async def mail_accounts(self) -> dict[str, Any]:
        return {
            "accounts": [
                {"id": "ma-1", "label": "Personal", "provider": "google", "address": "o@x", "session_uri": "s"}
            ]
        }

    async def preview(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        if self.fail:
            raise self.fail
        return {"kind": "event", "action": args.get("response", "invite"), "title": "Dentist"}

    async def run(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        self.ran.append((tool, args))
        return {"done": True}


class FakeConnectors:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, dict[str, Any]]] = []
        self.reply: list[dict[str, Any]] = [{"type": "text", "text": "Sunny, 21°C"}, {"type": "image", "data": "x"}]

    async def call(self, connector_id: str, tool: str, args: dict[str, Any]) -> list[dict[str, Any]]:
        self.calls.append((connector_id, tool, args))
        return self.reply


_n = [0]


async def published(
    d: Any, s3: FakeS3, caps: list[dict[str, Any]], grants: Any = None, pin: bool = False
) -> dict[str, Any]:
    """A published app with these capabilities (a fresh draft each time; no approval left pending)."""
    _n[0] += 1
    draft_id = f"drf-p{_n[0]}"
    await draft(d.ledger, draft_id, "t-task", "awaiting_owner", f"App {_n[0]}")
    for p, b in GAME.items():
        s3.put("aic-prod-apps", f"drafts/{draft_id}/{p}", b)
    await update_draft(d.ledger, draft_id, {"capabilities": caps, "pin": pin})
    return await publish_draft(d.ledger, d.bus, origin(s3), draft_id, grants)


def bridge(app: dict[str, Any], cap: str, params: Any = None) -> dict[str, Any]:
    return ev("POST", f"/apps/{app['app_id']}/bridge", {"cap": cap, "params": params or {}})


# ---------- catalogue and params ----------
def test_the_catalogue_holds_only_reads_and_propose() -> None:
    assert set(CATALOGUE) == {
        "calendar.read",
        "calendar.calendars",
        "mail.search",
        "mail.accounts",
        "connector.read",
        "propose",
    }
    for bad in ({"id": "mail.send"}, {"id": "calendar.delete"}, {"id": "settings"}, "calendar.read", {"x": 1}):
        with pytest.raises(Invalid):
            clean_cap(bad)
    with pytest.raises(Invalid):
        clean_cap({"id": "connector.read", "connector": "Weather!", "tool": "forecast"})
    assert clean_cap({"id": "calendar.read", "extra": "dropped"}) == {"id": "calendar.read"}


@pytest.mark.parametrize(
    ("cap", "params", "problem"),
    [
        (CAL, {"from": "2026-11-01T00:00:00Z", "to": "2026-12-01T00:00:00Z"}, None),
        (CAL, {"from": "2026-01-01", "to": "2027-01-02"}, None),
        (CAL, {"from": "2026-01-01", "to": "2027-01-03"}, "366 days"),
        (CAL, {"from": "2026-02-01", "to": "2026-01-01"}, "after"),
        (CAL, {"from": "soon", "to": "2026-01-01"}, "ISO"),
        (CAL, {"from": "2026-01-01", "to": "2026-01-02", "evil": 1}, "unknown params"),
        ({"id": "mail.search"}, {"query": "invoice", "limit": 25}, None),
        ({"id": "mail.search"}, {"query": "x", "limit": 26}, "limit"),
        ({"id": "mail.search"}, {"query": "x", "unread_only": "yes"}, "unread_only"),
        ({"id": "mail.accounts"}, {"x": 1}, "unknown params"),
        (WEATHER, {"args": "city"}, "args"),
        (CAL, "not an object", "object"),
    ],
)
def test_params_are_validated_per_capability(cap: dict[str, Any], params: Any, problem: str | None) -> None:
    if problem is None:
        check_params(cap, params)
    else:
        with pytest.raises(Invalid, match=problem):
            check_params(cap, params)


def test_a_year_is_split_into_calls_of_at_most_62_days() -> None:
    chunks = calendar_chunks("2026-01-01T00:00:00+00:00", "2027-01-01T00:00:00+00:00")
    assert len(chunks) == 6 and chunks[0][0].startswith("2026-01-01") and chunks[-1][1].startswith("2027-01-01")


def test_no_write_tool_name_passes_the_policy_for_apps() -> None:
    for name in ("calendar.read", "calendar.calendars", "mail.search", "mail.accounts"):
        assert decide(f"mcp__app__{name}", {})[0] == "allow", name
    assert decide(gate_name(WEATHER), {})[0] == "allow"
    for bad in ("mail.send", "mail.draft", "mail.trash", "mail.label", "calendar.create", "calendar.respond",
                "calendar.update", "calendar.delete", "calendar.read.x", "calendar_read", "settings", "propose",
                "connector___weather", "connector___weather___", "connector___Weather___forecast",
                "connector___github___get_secret", "delegate_to_orchestrator"):  # fmt: skip
        assert decide(f"mcp__app__{bad}", {})[0] == "deny", bad


# ---------- manifests at staging ----------
async def test_a_manifest_must_name_known_read_only_capabilities() -> None:
    ledger = Ledger(MemoryTable())
    await connectors(ledger)
    ok = json.dumps({"capabilities": [CAL, CAL, WEATHER, {"id": "propose"}], "pin": True}).encode()
    caps, pin = await check_manifest(ok, ledger)
    assert caps == [CAL, WEATHER, {"id": "propose"}] and pin is True
    for raw, problem in [
        (b"{", "valid JSON"),
        (b"[]", "object"),
        (json.dumps({"capabilities": [{"id": "mail.send"}]}).encode(), "not a capability"),
        (json.dumps({"capabilities": [{**WEATHER, "tool": "set_alert"}]}).encode(), "not a read-only"),
        (json.dumps({"capabilities": [{**WEATHER, "tool": "mystery"}]}).encode(), "not a read-only"),
        (json.dumps({"capabilities": [{**WEATHER, "connector": "nope"}]}).encode(), "no connector"),
        (json.dumps({"capabilities": [], "pin": "yes"}).encode(), "pin"),
        (json.dumps({"capabilities": [], "network": True}).encode(), "unknown keys"),
        (b" " * 20_000, "16 KB"),
    ]:
        with pytest.raises(Invalid, match=problem):
            await check_manifest(raw, ledger)


async def test_staging_stores_the_capabilities_and_always_ships_the_citys_bridge() -> None:
    ledger, bus, s3 = Ledger(MemoryTable()), MemoryBus(), FakeS3()
    await connectors(ledger)
    manifest = {"capabilities": [CAL, WEATHER], "pin": True}
    upload(s3, {**GAME, "aic-app.json": json.dumps(manifest).encode(), "aic-bridge.js": b"steal()"})
    dr = await on_submitted(submitted(), ledger, bus, origin(s3), s3, "ws")
    assert dr is not None and dr["status"] == "ready", dr
    assert dr["capabilities"] == [
        {**CAL, "label": "Read your calendars (all accounts)"},
        {**WEATHER, "label": "Read from Weather: forecast"},
    ]
    assert dr["pin"] is True
    shipped = s3.objects["aic-prod-apps"][f"drafts/{dr['draft_id']}/aic-bridge.js"]
    assert shipped["Body"] == BRIDGE_JS and shipped["ContentType"].startswith("text/javascript")
    assert [f["path"] for f in dr["files"]].count("aic-bridge.js") == 1
    plain = await on_submitted(submitted(hire_id="wkr-apps-other"), ledger, bus, origin(s3), s3, "ws")
    assert plain is not None and plain["status"] == "rejected"  # nothing uploaded for that hire
    upload(s3, GAME, "wkr-apps-other")
    plain = await on_submitted(submitted(hire_id="wkr-apps-other"), ledger, bus, origin(s3), s3, "ws")
    assert plain is not None and plain["capabilities"] == [] and plain["pin"] is False
    assert f"drafts/{plain['draft_id']}/aic-bridge.js" in s3.objects["aic-prod-apps"]


async def test_a_bad_manifest_rejects_the_draft_with_the_reason() -> None:
    ledger, bus, s3 = Ledger(MemoryTable()), MemoryBus(), FakeS3()
    upload(s3, {**GAME, "aic-app.json": json.dumps({"capabilities": [{"id": "mail.send"}]}).encode()})
    dr = await on_submitted(submitted(), ledger, bus, origin(s3), s3, "ws")
    assert dr is not None and dr["status"] == "rejected" and "mail.send" in dr["reason"]
    assert "aic-prod-apps" not in s3.objects


def test_the_bridge_script_sends_only_the_wire_format_and_trusts_only_the_parent() -> None:
    js_src = BRIDGE_JS.decode()
    assert "e.source !== window.parent" in js_src
    assert "{ aic: 1, id: id, cap: String(cap), params: params || {} }" in js_src
    for banned in ("fetch(", "XMLHttpRequest", "localStorage", "document.cookie", "eval(", "innerHTML"):
        assert banned not in js_src


# ---------- grants and pins ----------
async def test_sign_off_approval_carries_the_capabilities() -> None:
    d = api(FakeS3())
    await draft(d.ledger, "drf-1", "t-task", "ready")
    await update_draft(d.ledger, "drf-1", {"capabilities": [CAL], "pin": True})
    (ap,) = await request_publish_approvals(d.ledger, d.bus, "t-task", "orchestrator")
    assert (ap["capabilities"], ap["pin"]) == ([CAL], True)
    assert d.bus.of_type("approval.requested")[0]["capabilities"] == [CAL]


async def test_approve_publishes_with_the_chosen_grants_only() -> None:
    s3 = FakeS3()
    d = api(s3)
    a = await staged(d, s3)
    await update_draft(d.ledger, "drf-1", {"capabilities": [CAL, WEATHER], "pin": True})
    bad = await handle_http(
        ev("POST", f"/approvals/{a['id']}", {"approved": True, "grants": [{"id": "mail.search"}]}), d
    )
    assert bad["statusCode"] == 400 and (await d.ledger.get_approval(a["id"]) or {})["status"] == "pending"
    r = await handle_http(ev("POST", f"/approvals/{a['id']}", {"approved": True, "grants": [WEATHER]}), d)
    app = js(r)["app"]
    assert (app["grants"], app["capabilities"], app["pinned"]) == ([WEATHER], [CAL, WEATHER], True)
    assert app["granted_at"]


async def test_grants_default_to_everything_asked_and_pins_stop_at_six() -> None:
    s3 = FakeS3()
    d = api(s3)
    for i in range(7):
        await draft(d.ledger, f"drf-{i}", "t", "awaiting_owner", f"App {i}")
        for p, b in GAME.items():
            s3.put("aic-prod-apps", f"drafts/drf-{i}/{p}", b)
            await update_draft(d.ledger, f"drf-{i}", {"capabilities": [CAL], "pin": True})
        app = await publish_draft(d.ledger, d.bus, origin(s3), f"drf-{i}")
        assert app["grants"] == [CAL]
        assert app["pinned"] is (i < 6)  # the 7th keeps its suggestion off instead of failing the publish
    apps = await list_apps(d.ledger)
    unpinned = next(a for a in apps if not a["pinned"])
    r = await handle_http(ev("PUT", f"/apps/{unpinned['app_id']}", {"pinned": True}), d)
    assert r["statusCode"] == 400 and "up to 6" in js(r)["error"]


async def test_put_apps_only_shrinks_grants_and_says_so_on_the_bus() -> None:
    s3 = FakeS3()
    d = api(s3)
    app = await published(d, s3, [CAL, {"id": "mail.search"}])
    grow = await handle_http(ev("PUT", f"/apps/{app['app_id']}", {"grants": [CAL, {"id": "mail.accounts"}]}), d)
    assert grow["statusCode"] == 400 and "taken away" in js(grow)["error"]
    r = await handle_http(ev("PUT", f"/apps/{app['app_id']}", {"grants": [CAL], "pinned": True}), d)
    assert r["statusCode"] == 200
    assert (js(r)["app"]["grants"], js(r)["app"]["pinned"]) == ([CAL], True)
    (upd,) = d.bus.of_type("app.updated")
    assert upd["app"]["grants"] == [CAL]
    assert (await handle_http(ev("PUT", "/apps/app-nope", {"pinned": True}), d))["statusCode"] == 404
    assert (await handle_http(ev("PUT", f"/apps/{app['app_id']}", {"pinned": "yes"}), d))["statusCode"] == 400


# ---------- the bridge route ----------
async def test_the_bridge_answers_granted_reads_and_refuses_the_rest() -> None:
    s3, mail = FakeS3(), FakeMail()
    d = api(s3)
    d.readers = Readers(mail=mail)
    app = await published(d, s3, [CAL, {"id": "mail.search"}, {"id": "mail.accounts"}, {"id": "propose"}])
    r = await handle_http(
        bridge(app, "calendar.read", {"from": "2026-11-01T00:00:00Z", "to": "2027-01-15T00:00:00Z"}), d
    )
    assert r["statusCode"] == 200, r
    data = js(r)["data"]
    assert [c[0] for c in mail.calls] == ["calendar_events", "calendar_events"]  # 75 days → 2 calls
    assert [e["title"] for e in data["events"]].count("Dentist") == 1  # merged across calls
    assert data["calendars"] == [{"id": "ma-1:primary", "name": "Personal"}]
    m = js(await handle_http(bridge(app, "mail.search", {"query": "hi"}), d))["data"]["messages"][0]
    assert "body_text" not in m and m["subject"] == "Hi"
    acct = js(await handle_http(bridge(app, "mail.accounts"), d))["data"]["accounts"][0]
    assert "session_uri" not in acct
    for cap, params in (
        ("calendar.calendars", {}),
        ("mail.send", {}),
        ("propose", {}),
        ("connector.read", {"connector": "weather", "tool": "forecast"}),
    ):
        no = await handle_http(bridge(app, cap, params), d)
        assert (no["statusCode"], js(no)["error"]) == (403, "not_granted"), cap
    bad = await handle_http(bridge(app, "calendar.read", {"from": "x", "to": "y"}), d)
    assert (bad["statusCode"], js(bad)["error"]) == (400, "invalid")
    gone = await handle_http(ev("POST", "/apps/app-nope/bridge", {"cap": "calendar.read"}), d)
    assert gone["statusCode"] == 404


async def test_a_revoked_grant_stops_working_on_the_next_request() -> None:
    s3 = FakeS3()
    d = api(s3)
    d.readers = Readers(mail=FakeMail())
    app = await published(d, s3, [{"id": "mail.accounts"}])
    assert (await handle_http(bridge(app, "mail.accounts"), d))["statusCode"] == 200
    await handle_http(ev("PUT", f"/apps/{app['app_id']}", {"grants": []}), d)
    assert js(await handle_http(bridge(app, "mail.accounts"), d))["error"] == "not_granted"


async def test_mail_and_calendar_answer_unavailable_until_they_are_wired() -> None:
    s3 = FakeS3()
    d = api(s3)
    app = await published(d, s3, [{"id": "mail.accounts"}])
    r = await handle_http(bridge(app, "mail.accounts"), d)
    assert (r["statusCode"], js(r)["ok"], js(r)["error"]) == (200, False, "unavailable")
    mail = FakeMail()
    mail.fail = LoginExpired("Personal needs you to sign in again.")
    d.readers = Readers(mail=mail)
    cal = await published(d, s3, [CAL])
    r = await handle_http(bridge(cal, "calendar.read", {"from": "2026-11-01", "to": "2026-11-02"}), d)
    assert js(r)["error"] == "login_expired"


async def test_connector_reads_need_a_ready_read_only_tool_and_its_schema() -> None:
    s3, conns = FakeS3(), FakeConnectors()
    d = api(s3)
    await connectors(d.ledger)
    d.readers = Readers(connectors=conns)
    app = await published(d, s3, [WEATHER])
    ok = await handle_http(
        bridge(app, "connector.read", {"connector": "weather", "tool": "forecast", "args": {"city": "Oslo"}}), d
    )
    assert js(ok) == {"ok": True, "data": {"content": "Sunny, 21°C"}}  # text parts only
    assert conns.calls == [("weather", "forecast", {"city": "Oslo"})]
    miss = await handle_http(bridge(app, "connector.read", {"connector": "weather", "tool": "forecast", "args": {}}), d)
    assert js(miss)["error"] == "invalid" and "city" in js(miss)["message"]
    # The connector later marks the tool as a write: the grant no longer reads anything.
    rec = await d.ledger.table.get("CONNECTORS", "CONN#weather")
    assert rec is not None
    rec["tools"][0]["read_only"] = False
    await d.ledger.table.put(rec)
    w = await handle_http(
        bridge(app, "connector.read", {"connector": "weather", "tool": "forecast", "args": {"city": "Oslo"}}), d
    )
    assert (w["statusCode"], js(w)["error"]) == (403, "not_granted")
    await connectors(d.ledger, "login_expired")
    le = await handle_http(
        bridge(app, "connector.read", {"connector": "weather", "tool": "forecast", "args": {"city": "x"}}), d
    )
    assert js(le)["error"] == "login_expired"
    assert len(conns.calls) == 1
    d.readers = Readers()
    await connectors(d.ledger)
    un = await handle_http(
        bridge(app, "connector.read", {"connector": "weather", "tool": "forecast", "args": {"city": "x"}}), d
    )
    assert js(un)["error"] == "unavailable"


async def test_bridge_calls_are_gated_audited_without_data_and_rate_limited() -> None:
    s3 = FakeS3()
    d = api(s3)
    d.readers = Readers(mail=FakeMail())
    app = await published(d, s3, [{"id": "mail.search"}])
    for _ in range(120):
        assert (await handle_http(bridge(app, "mail.search", {"query": "private words"}), d))["statusCode"] == 200
    r = await handle_http(bridge(app, "mail.search", {"query": "x"}), d)
    assert (r["statusCode"], js(r)["error"]) == (429, "rate_limited")
    rows = await d.ledger.tool_calls(f"app-{app['app_id']}")
    assert rows and {row["tool"] for row in rows} == {"mcp__app__mail.search"}
    assert "private words" not in json.dumps(rows)


def test_big_answers_are_cut_to_256_kb() -> None:
    big = {"events": [{"title": "x" * 1000} for _ in range(1000)], "calendars": []}
    out = fit(big)
    assert out["truncated"] is True and 0 < len(out["events"]) < 1000
    assert len(json.dumps(out).encode()) <= 256 * 1024


# ---------- proposals ----------
def propose(app: dict[str, Any], kind: str, params: Any) -> dict[str, Any]:
    return ev("POST", f"/apps/{app['app_id']}/proposals", {"kind": kind, "params": params})


async def test_a_proposal_becomes_a_normal_approval_and_runs_once_on_approve() -> None:
    s3, mail = FakeS3(), FakeMail()
    d = api(s3)
    d.readers = Readers(mail=mail)
    app = await published(d, s3, [{"id": "propose"}])
    r = await handle_http(propose(app, "calendar.respond", {"id": "ma-1:e1", "response": "accept"}), d)
    assert js(r) == {"ok": True, "status": "waiting_for_you"}
    (ap,) = await d.ledger.pending_approvals()
    assert (ap["kind"], ap["tool"], ap["requested_by"]) == (
        "tool",
        "mcp__city__calendar_respond",
        f"app:{app['app_id']}",
    )
    assert ap["preview"]["title"] == "Dentist" and ap["input"] == {"id": "ma-1:e1", "response": "accept"}
    assert d.bus.of_type("approval.requested")[-1]["kind"] == "tool"
    again = await handle_http(propose(app, "calendar.respond", {"id": "ma-1:e1", "response": "accept"}), d)
    assert js(again)["status"] == "waiting_for_you" and len(await d.ledger.pending_approvals()) == 1
    assert mail.ran == []
    done = await handle_http(ev("POST", f"/approvals/{ap['id']}", {"approved": True}), d)
    assert js(done)["result"] == {"ok": True, "result": {"done": True}}
    assert mail.ran == [("mcp__city__calendar_respond", {"id": "ma-1:e1", "response": "accept"})]
    assert (await handle_http(ev("POST", f"/approvals/{ap['id']}", {"approved": True}), d))["statusCode"] == 409
    assert len(mail.ran) == 1


async def test_a_refused_proposal_runs_nothing() -> None:
    s3, mail = FakeS3(), FakeMail()
    d = api(s3)
    d.readers = Readers(mail=mail)
    app = await published(d, s3, [{"id": "propose"}])
    await handle_http(
        propose(app, "mail.draft", {"account_id": "ma-1", "to": ["a@b.c"], "subject": "Hi", "body": "x"}), d
    )
    (ap,) = await d.ledger.pending_approvals()
    await handle_http(ev("POST", f"/approvals/{ap['id']}", {"approved": False}), d)
    assert mail.ran == []


async def test_proposals_need_the_grant_a_known_kind_and_stop_at_ten_an_hour() -> None:
    s3, mail = FakeS3(), FakeMail()
    d = api(s3)
    d.readers = Readers(mail=mail)
    plain = await published(d, s3, [CAL])
    no = await handle_http(propose(plain, "calendar.respond", {"id": "e", "response": "accept"}), d)
    assert (no["statusCode"], js(no)["error"]) == (403, "not_granted")
    app = await published(d, s3, [{"id": "propose"}])
    for kind, params in (
        ("mail.send", {}),
        ("calendar.delete", {"id": "e"}),
        ("calendar.respond", {"id": "e", "response": "maybe"}),
    ):
        bad = await handle_http(propose(app, kind, params), d)
        assert (bad["statusCode"], js(bad)["error"]) == (400, "invalid"), kind
    for i in range(10):
        ok = await handle_http(
            propose(
                app,
                "calendar.create",
                {"calendar_id": "c", "title": f"T{i}", "start": "2026-11-09T10:00:00Z", "end": "2026-11-09T11:00:00Z"},
            ),
            d,
        )
        assert ok["statusCode"] == 200, ok
    over = await handle_http(
        propose(
            app,
            "calendar.create",
            {"calendar_id": "c", "title": "T", "start": "2026-11-09T10:00:00Z", "end": "2026-11-09T11:00:00Z"},
        ),
        d,
    )
    assert (over["statusCode"], js(over)["error"]) == (429, "rate_limited")


async def test_proposals_answer_unavailable_until_mail_and_calendar_are_wired() -> None:
    s3 = FakeS3()
    d = api(s3)
    app = await published(d, s3, [{"id": "propose"}])
    r = await handle_http(propose(app, "calendar.respond", {"id": "e", "response": "accept"}), d)
    assert js(r)["error"] == "unavailable" and await d.ledger.pending_approvals() == []


# ---------- routes and events ----------
def test_the_new_routes_are_in_the_owner_check() -> None:
    for r in (("PUT", "/apps/app-1"), ("POST", "/apps/app-1/bridge"), ("POST", "/apps/app-1/proposals")):
        assert r in ROUTES


def test_app_updated_and_publish_capabilities_validate() -> None:
    assert parse_event({"type": "app.updated", "at": "x", "app": {"app_id": "a", "grants": []}})["app"]["app_id"] == "a"
    e = parse_event({"type": "approval.requested", "at": "x", "id": "ap", "agent": "o", "action": "p", "reason": "r",
                     "kind": "app.publish", "capabilities": [CAL], "pin": True})  # fmt: skip
    assert (e["capabilities"], e["pin"]) == ([CAL], True)
