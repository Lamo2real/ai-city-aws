"""Apps v2, the data bridge (docs/APPS.md § v2): the capability catalogue, manifests, grants, pins, the api route
and the app-bridge Lambda, proposals and the policy for role ``app``. Fakes only: no AWS, no Bedrock, no account."""

import json
from typing import Any

import pytest

from test_apps import GAME, FakeS3, api, draft, ev, js, origin, staged, submitted, upload
from vaic.lambdas.api import ROUTES, handle_http
from vaic.lambdas.apps import on_submitted
from vaic.shared.app_bridge import BridgeDeps, fit, serve_bridge
from vaic.shared.app_caps import (
    CATALOGUE,
    Invalid,
    LoginExpired,
    NoMail,
    NoProposals,
    app_call_from_env,
    calendar_chunks,
    check_manifest,
    check_params,
    clean_cap,
    gate_name,
    mail_from_env,
    no_app_call,
    proposals_from_env,
)
from vaic.shared.apps import BRIDGE_JS, get_app, list_apps, publish_draft, request_publish_approvals, update_draft
from vaic.shared.events import MemoryBus, parse_event
from vaic.shared.ledger import Ledger
from vaic.shared.policy import action_hash, decide
from vaic.shared.table import MemoryTable

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
    """The read methods of MailService (docs/MAIL_CALENDAR.md §11), with its result shapes."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, Any]] = []
        self.fail: Exception | None = None

    async def accounts(self) -> list[dict[str, Any]]:
        return [{"id": "ma-1", "label": "Personal", "provider": "google", "address": "o@x", "session_uri": "s"}]

    async def calendars(self) -> dict[str, Any]:
        return {"calendars": [{"id": "ma-1:primary", "name": "Personal"}], "errors": []}

    async def events(
        self, start: str, end: str, calendar_ids: list[str] | None = None, query: str | None = None
    ) -> dict[str, Any]:
        self.calls.append(("events", (start, end)))
        if self.fail:
            raise self.fail
        return {
            "events": [{"id": "e1", "account_id": "ma-1", "start": "2026-11-03T10:00:00+00:00", "title": "Dentist"},
                       {"id": f"e-{start[:10]}", "account_id": "ma-2", "start": start, "title": "Standup"}],
            "errors": [{"account_id": "ma-3", "message": "timed out"}],
        }  # fmt: skip

    async def search(self, query: str, **kw: Any) -> dict[str, Any]:
        self.calls.append(("search", {"query": query, **kw}))
        return {
            "messages": [{"id": "m1", "subject": "Hi", "body_text": "secret body", "attachments": []}],
            "errors": [],
        }


class FakeAppCall:
    """``connector_calls.app_call`` (docs/CONNECTORS_SKILLS.md §1.9)."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.result: dict[str, Any] = {
            "ok": True,
            "data": [{"type": "text", "text": "Sunny, 21°C"}, {"type": "json", "json": {"temp": 21}}],
            "truncated": False,
            "error": None,
        }

    async def __call__(self, d: Any, **kw: Any) -> dict[str, Any]:
        self.calls.append(kw)
        return self.result


class FakeProposals:
    """``vaic.mail.approvals.file`` / ``execute`` with the service bound."""

    def __init__(self, ledger: Ledger) -> None:
        self.ledger = ledger
        self.ran: list[dict[str, Any]] = []

    async def file(self, tool: str, args: dict[str, Any], requested_by: str) -> dict[str, Any]:
        return await self.ledger.request_approval(
            {"agent": requested_by.replace("app:", "app-"), "ticket_id": None, "tool": tool, "action": f"{tool} as shown",
             "hash": action_hash(tool, args), "reason": "an app asks", "kind": "tool", "input": args,
             "preview": {"kind": "event", "title": "Dentist"}, "requested_by": requested_by}
        )  # fmt: skip

    async def execute(self, approval: dict[str, Any]) -> dict[str, Any]:
        self.ran.append(approval)
        return {"done": True}


def wire(d: Any, mail: Any = None, app_call: Any = None) -> BridgeDeps:
    """The api's invoke runs the real app-bridge handler in-process, like the synchronous Lambda invoke."""
    b = BridgeDeps(ledger=d.ledger, city=object(), mail=mail or NoMail(), app_call=app_call or no_app_call)
    invokes: list[dict[str, Any]] = []

    async def invoke(payload: dict[str, Any]) -> dict[str, Any]:
        invokes.append(json.loads(json.dumps(payload)))  # what crosses the wire is JSON
        return json.loads(json.dumps(await serve_bridge(payload, b)))

    d.bridge_invoke = invoke
    d.invokes = invokes
    return b


_n = [0]


async def published(
    d: Any, s3: FakeS3, caps: list[dict[str, Any]], grants: Any = None, pin: bool = False
) -> dict[str, Any]:
    """A published app with these capabilities (a fresh draft each time; no approval left pending)."""
    _n[0] += 1
    draft_id = f"drf-p{_n[0]}"
    await draft(d.ledger, draft_id, "t-task", "awaiting_owner", f"App {_n[0]}")
    for p, b in GAME.items():
        s3.put("vaic-prod-apps", f"drafts/{draft_id}/{p}", b)
    await update_draft(d.ledger, draft_id, {"capabilities": caps, "pin": pin})
    return await publish_draft(d.ledger, d.bus, origin(s3), draft_id, grants)


def bridge(app: dict[str, Any], cap: str, params: Any = None) -> dict[str, Any]:
    return ev("POST", f"/apps/{app['app_id']}/bridge", {"cap": cap, "params": params or {}})


# ---------- catalogue and params ----------
def test_the_catalogue_holds_only_reads_propose_and_own_state() -> None:
    assert set(CATALOGUE) == {
        "calendar.read",
        "calendar.calendars",
        "mail.search",
        "mail.accounts",
        "connector.read",
        "propose",
        "state",
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
    assert gate_name(WEATHER) == "mcp__gateway__weather___forecast"  # gated by app_call like the agents' calls
    for bad in ("mail.send", "mail.draft", "mail.trash", "mail.label", "calendar.create", "calendar.respond",
                "calendar.update", "calendar.delete", "calendar.read.x", "calendar_read", "settings", "propose",
                "connector___weather___forecast", "connector.read", "start_job"):  # fmt: skip
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
    upload(s3, {**GAME, "vaic-app.json": json.dumps(manifest).encode(), "vaic-bridge.js": b"steal()"})
    dr = await on_submitted(submitted(), ledger, bus, origin(s3), s3, "ws")
    assert dr is not None and dr["status"] == "ready", dr
    assert dr["capabilities"] == [
        {**CAL, "label": "Read your calendars (all accounts)"},
        {**WEATHER, "label": "Read from Weather: forecast"},
    ]
    assert dr["pin"] is True
    shipped = s3.objects["vaic-prod-apps"][f"drafts/{dr['draft_id']}/vaic-bridge.js"]
    assert shipped["Body"] == BRIDGE_JS and shipped["ContentType"].startswith("text/javascript")
    assert [f["path"] for f in dr["files"]].count("vaic-bridge.js") == 1
    plain = await on_submitted(submitted(hire_id="wkr-apps-other"), ledger, bus, origin(s3), s3, "ws")
    assert plain is not None and plain["status"] == "rejected"  # nothing uploaded for that hire
    upload(s3, GAME, "wkr-apps-other")
    plain = await on_submitted(submitted(hire_id="wkr-apps-other"), ledger, bus, origin(s3), s3, "ws")
    assert plain is not None and plain["capabilities"] == [] and plain["pin"] is False
    assert f"drafts/{plain['draft_id']}/vaic-bridge.js" in s3.objects["vaic-prod-apps"]


async def test_a_bad_manifest_rejects_the_draft_with_the_reason() -> None:
    ledger, bus, s3 = Ledger(MemoryTable()), MemoryBus(), FakeS3()
    upload(s3, {**GAME, "vaic-app.json": json.dumps({"capabilities": [{"id": "mail.send"}]}).encode()})
    dr = await on_submitted(submitted(), ledger, bus, origin(s3), s3, "ws")
    assert dr is not None and dr["status"] == "rejected" and "mail.send" in dr["reason"]
    assert "vaic-prod-apps" not in s3.objects


def test_the_bridge_script_sends_only_the_wire_format_and_trusts_only_the_parent() -> None:
    js_src = BRIDGE_JS.decode()
    assert "e.source !== window.parent" in js_src
    assert "{ vaic: 1, id: id, cap: String(cap), params: params || {} }" in js_src
    assert 'var EVENTS = { "calendar.changed": [] };' in js_src  # the only event an app can hear
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
            s3.put("vaic-prod-apps", f"drafts/drf-{i}/{p}", b)
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


# ---------- grants feed the Cedar rewrite ----------
async def test_grants_keep_exactly_the_app_call_shape() -> None:
    s3 = FakeS3()
    d = api(s3)
    labelled = [{**CAL, "label": "Read your calendars"}, {**WEATHER, "label": "Read from Weather: forecast"}]
    app = await published(d, s3, labelled)
    assert app["grants"] == [CAL, WEATHER]
    assert (await get_app(d.ledger, app["app_id"]) or {})["grants"] == [CAL, WEATHER]
    upd = js(await handle_http(ev("PUT", f"/apps/{app['app_id']}", {"grants": [{**WEATHER, "label": "x"}]}), d))
    assert upd["app"]["grants"] == [WEATHER]


async def test_publish_removal_and_grant_changes_refresh_the_connector_policies() -> None:
    s3 = FakeS3()
    d = api(s3)
    calls: list[str] = []

    async def refresh() -> None:
        calls.append("policies")

    d.grants_changed = refresh
    a = await staged(d, s3)
    app = js(await handle_http(ev("POST", f"/approvals/{a['id']}", {"approved": True}), d))["app"]
    await handle_http(ev("PUT", f"/apps/{app['app_id']}", {"pinned": True}), d)  # not a grant change
    await handle_http(ev("PUT", f"/apps/{app['app_id']}", {"grants": []}), d)
    await handle_http(ev("DELETE", f"/apps/{app['app_id']}"), d)
    assert calls == ["policies"] * 3

    async def broken() -> None:
        raise RuntimeError("connectors Lambda not reachable")

    d.grants_changed = broken
    b = await staged(d, s3, "drf-2")
    assert (await handle_http(ev("POST", f"/approvals/{b['id']}", {"approved": True}), d))["statusCode"] == 200


# ---------- the api route + the app-bridge Lambda ----------
async def test_the_bridge_answers_granted_reads_and_refuses_the_rest() -> None:
    s3, mail = FakeS3(), FakeMail()
    d = api(s3)
    wire(d, mail=mail)
    app = await published(d, s3, [CAL, {"id": "mail.search"}, {"id": "mail.accounts"}, {"id": "propose"}])
    r = await handle_http(
        bridge(app, "calendar.read", {"from": "2026-11-01T00:00:00Z", "to": "2027-01-15T00:00:00Z"}), d
    )
    assert r["statusCode"] == 200, r
    assert d.invokes[0] == {"app_id": app["app_id"], "cap": "calendar.read",
                            "params": {"from": "2026-11-01T00:00:00+00:00", "to": "2027-01-15T00:00:00+00:00"}}  # fmt: skip
    data = js(r)["data"]
    assert [c[0] for c in mail.calls] == ["events", "events"]  # 75 days → 2 calls
    assert [e["title"] for e in data["events"]].count("Dentist") == 1  # merged across calls
    assert data["calendars"] == [{"id": "ma-1:primary", "name": "Personal"}] and len(data["errors"]) == 2
    m = js(await handle_http(bridge(app, "mail.search", {"query": "hi", "limit": 5}), d))["data"]["messages"][0]
    assert "body_text" not in m and m["subject"] == "Hi"
    assert mail.calls[-1][1]["limit"] == 5
    acct = js(await handle_http(bridge(app, "mail.accounts"), d))["data"]["accounts"][0]
    assert "session_uri" not in acct and acct["address"] == "o@x"
    n = len(d.invokes)
    for cap, params in (("calendar.calendars", {}), ("mail.send", {}), ("propose", {}),
                        ("connector.read", {"connector": "weather", "tool": "forecast"})):  # fmt: skip
        no = await handle_http(bridge(app, cap, params), d)
        assert (no["statusCode"], js(no)["error"]) == (403, "not_granted"), cap
    bad = await handle_http(bridge(app, "calendar.read", {"from": "x", "to": "y"}), d)
    assert (bad["statusCode"], js(bad)["error"]) == (400, "invalid")
    assert len(d.invokes) == n  # refused in the api; the bridge Lambda is never called
    gone = await handle_http(ev("POST", "/apps/app-nope/bridge", {"cap": "calendar.read"}), d)
    assert gone["statusCode"] == 404


async def test_the_bridge_lambda_rechecks_the_grant_itself() -> None:
    s3 = FakeS3()
    d = api(s3)
    b = wire(d, mail=FakeMail())
    app = await published(d, s3, [{"id": "mail.accounts"}])
    assert (await handle_http(bridge(app, "mail.accounts"), d))["statusCode"] == 200
    await handle_http(ev("PUT", f"/apps/{app['app_id']}", {"grants": []}), d)
    assert js(await handle_http(bridge(app, "mail.accounts"), d))["error"] == "not_granted"
    # Called directly (as if the api's check were bypassed), it still refuses.
    assert (await serve_bridge({"app_id": app["app_id"], "cap": "mail.accounts", "params": {}}, b))[
        "error"
    ] == "not_granted"
    assert (await serve_bridge({"app_id": "app-nope", "cap": "mail.accounts", "params": {}}, b))[
        "error"
    ] == "not_granted"
    assert (await serve_bridge({"cap": "mail.accounts"}, b))["ok"] is False


async def test_reads_answer_unavailable_until_the_bridge_and_the_mail_module_exist() -> None:
    s3 = FakeS3()
    d = api(s3)
    app = await published(d, s3, [{"id": "mail.accounts"}])
    r = await handle_http(bridge(app, "mail.accounts"), d)  # no bridge Lambda configured
    assert (r["statusCode"], js(r)["ok"], js(r)["error"]) == (200, False, "unavailable")
    wire(d)  # bridge Lambda, but no mail module yet
    r = await handle_http(bridge(app, "mail.accounts"), d)
    assert (js(r)["error"], js(r)["message"]) == ("unavailable", "Mail and calendar are not set up yet.")
    mail = FakeMail()
    mail.fail = LoginExpired("Personal needs you to sign in again.")
    wire(d, mail=mail)
    cal = await published(d, s3, [CAL])
    r = await handle_http(bridge(cal, "calendar.read", {"from": "2026-11-01", "to": "2026-11-02"}), d)
    assert js(r)["error"] == "login_expired"

    async def down(_: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("invoke failed")

    d.bridge_invoke = down
    assert js(await handle_http(bridge(app, "mail.accounts"), d))["error"] == "unavailable"


def test_the_env_readers_find_the_mail_and_connector_modules_but_stay_unavailable_without_config() -> None:
    from vaic.shared.connector_calls import app_call

    ledger = Ledger(MemoryTable())
    assert isinstance(mail_from_env(ledger), NoMail)  # no VAIC_MAIL_* in this environment
    assert app_call_from_env() is app_call  # the connectors module is in the package now
    assert app_call_from_env() is not no_app_call
    assert isinstance(proposals_from_env(ledger), NoProposals)  # follows mail


async def test_connector_reads_go_through_app_call_with_the_apps_identity() -> None:
    s3, call = FakeS3(), FakeAppCall()
    d = api(s3)
    await connectors(d.ledger)
    wire(d, app_call=call)
    app = await published(d, s3, [WEATHER])
    ok = await handle_http(
        bridge(app, "connector.read", {"connector": "weather", "tool": "forecast", "args": {"city": "Oslo"}}), d
    )
    assert js(ok) == {"ok": True, "data": {"content": "Sunny, 21°C", "json": [{"temp": 21}]}}
    assert call.calls == [
        {"app_id": app["app_id"], "connector_id": "weather", "tool": "forecast", "args": {"city": "Oslo"}}
    ]
    miss = await handle_http(bridge(app, "connector.read", {"connector": "weather", "tool": "forecast", "args": {}}), d)
    assert js(miss)["error"] == "invalid" and "city" in js(miss)["message"]  # the tool's schema, checked in the api
    assert len(call.calls) == 1
    for error, status in (("login_expired", 200), ("not_granted", 403), ("rate_limited", 429)):
        call.result = {"ok": False, "data": [], "truncated": False, "error": error}
        r = await handle_http(
            bridge(app, "connector.read", {"connector": "weather", "tool": "forecast", "args": {"city": "x"}}), d
        )
        assert (r["statusCode"], js(r)["error"]) == (status, error)
    call.result = {"ok": False, "data": [], "truncated": False, "error": "Weather is not ready."}
    r = await handle_http(
        bridge(app, "connector.read", {"connector": "weather", "tool": "forecast", "args": {"city": "x"}}), d
    )
    assert (js(r)["error"], js(r)["message"]) == ("unavailable", "Weather is not ready.")
    wire(d)  # connectors not merged yet
    r = await handle_http(
        bridge(app, "connector.read", {"connector": "weather", "tool": "forecast", "args": {"city": "x"}}), d
    )
    assert js(r)["error"] == "unavailable"


async def test_mail_reads_are_gated_audited_without_data_and_the_api_limits_the_rate() -> None:
    s3 = FakeS3()
    d = api(s3)
    wire(d, mail=FakeMail())
    app = await published(d, s3, [{"id": "mail.search"}])
    for _ in range(120):
        assert (await handle_http(bridge(app, "mail.search", {"query": "private words"}), d))["statusCode"] == 200
    r = await handle_http(bridge(app, "mail.search", {"query": "x"}), d)
    assert (r["statusCode"], js(r)["error"]) == (429, "rate_limited")
    assert len(d.invokes) == 120
    rows = await d.ledger.tool_calls(f"app-{app['app_id']}")
    assert rows and {row["tool"] for row in rows} == {"mcp__app__mail.search"}
    assert {row["decision"] for row in rows} == {"allow", "done"}
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
    s3 = FakeS3()
    d = api(s3)
    d.proposals = props = FakeProposals(d.ledger)
    app = await published(d, s3, [{"id": "propose"}])
    r = await handle_http(propose(app, "calendar.respond", {"id": "ma-1:e1", "response": "accept"}), d)
    assert js(r) == {"ok": True, "status": "waiting_for_you"}
    (ap,) = await d.ledger.pending_approvals()
    assert (ap["kind"], ap["tool"], ap["requested_by"]) == (
        "tool",
        "mcp__city__calendar_respond",
        f"app:{app['app_id']}",
    )
    assert ap["input"] == {"id": "ma-1:e1", "response": "accept"}
    assert d.bus.of_type("approval.requested")[-1]["id"] == ap["id"]
    again = await handle_http(propose(app, "calendar.respond", {"id": "ma-1:e1", "response": "accept"}), d)
    assert js(again)["status"] == "waiting_for_you" and len(await d.ledger.pending_approvals()) == 1
    assert props.ran == []
    done = await handle_http(ev("POST", f"/approvals/{ap['id']}", {"approved": True}), d)
    assert js(done)["result"] == {"ok": True, "result": {"done": True}}
    assert [x["id"] for x in props.ran] == [ap["id"]]
    assert (await handle_http(ev("POST", f"/approvals/{ap['id']}", {"approved": True}), d))["statusCode"] == 409
    assert len(props.ran) == 1


async def test_a_refused_proposal_runs_nothing() -> None:
    s3 = FakeS3()
    d = api(s3)
    d.proposals = props = FakeProposals(d.ledger)
    app = await published(d, s3, [{"id": "propose"}])
    await handle_http(
        propose(app, "mail.draft", {"account_id": "ma-1", "to": ["a@b.c"], "subject": "Hi", "body": "x"}), d
    )
    (ap,) = await d.ledger.pending_approvals()
    assert ap["tool"] == "mcp__city__mail_draft"
    await handle_http(ev("POST", f"/approvals/{ap['id']}", {"approved": False}), d)
    assert props.ran == []


async def test_proposals_need_the_grant_a_known_kind_and_stop_at_ten_an_hour() -> None:
    s3 = FakeS3()
    d = api(s3)
    d.proposals = FakeProposals(d.ledger)
    plain_app = await published(d, s3, [CAL])
    no = await handle_http(propose(plain_app, "calendar.respond", {"id": "e", "response": "accept"}), d)
    assert (no["statusCode"], js(no)["error"]) == (403, "not_granted")
    app = await published(d, s3, [{"id": "propose"}])
    for kind, params in (
        ("mail.send", {}),
        ("calendar.delete", {"id": "e"}),
        ("calendar.respond", {"id": "e", "response": "maybe"}),
    ):
        bad = await handle_http(propose(app, kind, params), d)
        assert (bad["statusCode"], js(bad)["error"]) == (400, "invalid"), kind
    event = {"calendar_id": "c", "start": "2026-11-09T10:00:00Z", "end": "2026-11-09T11:00:00Z"}
    for i in range(10):
        ok = await handle_http(propose(app, "calendar.create", {**event, "title": f"T{i}"}), d)
        assert ok["statusCode"] == 200, ok
    over = await handle_http(propose(app, "calendar.create", {**event, "title": "T"}), d)
    assert (over["statusCode"], js(over)["error"]) == (429, "rate_limited")


async def test_proposals_answer_unavailable_until_the_mail_module_exists() -> None:
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


async def test_a_mail_problem_reaches_the_app_as_unavailable_not_a_crash() -> None:
    from vaic.mail.service import MailError
    from vaic.shared.app_caps import Unavailable, _BoundProposals

    class Approvals:
        async def file(self, *a: object, **k: object) -> dict[str, object]:
            raise MailError("That mailbox was removed.")

        async def execute(self, *a: object) -> dict[str, object]:
            raise MailError("That approval was already used, or isn't approved.")

    bound = _BoundProposals(None, None, Approvals())  # type: ignore[arg-type]
    with pytest.raises(Unavailable, match="mailbox was removed"):
        await bound.file("mail.draft", {}, "app:x")
    with pytest.raises(Unavailable, match="already used"):
        await bound.execute({})
