"""Apps v3 (docs/APPS.md § v3): per-app state for granted apps, and new versions of an existing app with
rollback. Fakes only: no AWS, no Bedrock."""

from pathlib import Path
from typing import Any

from aic.lambdas.api import ROUTES, handle_http
from aic.lambdas.apps import on_submitted
from aic.runtime.tools import TurnCtx
from aic.shared.app_state import MAX_KEYS, delete_state, get_value
from aic.shared.apps import get_app, get_draft, request_publish_approvals, update_draft
from aic.shared.policy import decide
from aic.shared.table import UpdateOptions
from test_app_bridge import bridge, published
from test_apps import (
    GAME,
    HIRE,
    URL,
    WORKER,
    FakeS3,
    api,
    city_deps,
    draft,
    ev,
    js,
    origin,
    submitted,
    tool,
    upload,
    workspace,
)

STATE = {"id": "state"}


async def call(d: Any, app: dict[str, Any], cap: str, params: Any = None) -> tuple[int, dict[str, Any]]:
    r = await handle_http(bridge(app, cap, params), d)
    return r["statusCode"], js(r)


# ---------- per-app state ----------
async def test_a_granted_app_keeps_and_reads_its_own_values() -> None:
    s3 = FakeS3()
    d = api(s3)
    app = await published(d, s3, [STATE])
    assert await call(d, app, "state.get", {"key": "best"}) == (200, {"ok": True, "data": {"value": None}})
    assert (await call(d, app, "state.set", {"key": "best", "value": {"score": 42, "name": "Ada"}}))[1]["ok"]
    assert (await call(d, app, "state.get", {"key": "best"}))[1]["data"] == {"value": {"score": 42, "name": "Ada"}}
    assert (await call(d, app, "state.set", {"key": "best", "value": None}))[1]["ok"]
    assert (await call(d, app, "state.get", {"key": "best"}))[1]["data"] == {"value": None}


async def test_state_needs_the_grant_and_is_per_app() -> None:
    s3 = FakeS3()
    d = api(s3)
    mine, other = await published(d, s3, [STATE]), await published(d, s3, [STATE])
    plain_app = await published(d, s3, [])
    await call(d, mine, "state.set", {"key": "k", "value": 1})
    assert (await call(d, other, "state.get", {"key": "k"}))[1]["data"] == {"value": None}
    status, body = await call(d, plain_app, "state.get", {"key": "k"})
    assert (status, body["error"]) == (403, "not_granted")
    status, body = await call(d, mine, "state", {"key": "k"})
    assert (status, body["error"]) == (400, "invalid")
    # Revoked: refused from the next request.
    await handle_http(ev("PUT", f"/apps/{mine['app_id']}", {"grants": []}), d)
    assert (await call(d, mine, "state.get", {"key": "k"}))[0] == 403


async def test_state_limits_keys_sizes_and_shapes() -> None:
    s3 = FakeS3()
    d = api(s3)
    app = await published(d, s3, [STATE])
    for bad in ({"key": "a b", "value": 1}, {"key": "x" * 65, "value": 1}, {"key": "k"}, {"key": "k", "value": 1, "x": 2},
                {"key": "k", "value": "v" * 5000}):  # fmt: skip
        status, body = await call(d, app, "state.set", bad)
        assert (status, body["error"]) == (400, "invalid"), bad
    for i in range(MAX_KEYS):
        assert (await call(d, app, "state.set", {"key": f"k{i}", "value": i}))[1]["ok"]
    status, body = await call(d, app, "state.set", {"key": "one-more", "value": 1})
    assert (status, body["error"]) == (400, "invalid") and "50 keys" in body["message"]
    assert (await call(d, app, "state.set", {"key": "k0", "value": 7}))[1]["ok"]  # replacing a key is fine


async def test_state_is_gated_as_role_app_and_audited_without_the_value() -> None:
    assert decide("mcp__app__state.get", {"key": "k"})[0] == "allow"
    assert decide("mcp__app__state.set", {"key": "k"})[0] == "allow"
    assert decide("mcp__app__state.delete_all", {})[0] == "deny"
    s3 = FakeS3()
    d = api(s3)
    app = await published(d, s3, [STATE])
    await call(d, app, "state.set", {"key": "secret-ish", "value": "the app's own data"})
    rows = await d.ledger.table.query(f"TOOL#app-{app['app_id']}")
    assert any(r.get("tool") == "mcp__app__state.set" for r in rows)
    assert "the app's own data" not in str(rows)


async def test_removing_the_app_deletes_its_state() -> None:
    s3 = FakeS3()
    d = api(s3)
    app = await published(d, s3, [STATE])
    await call(d, app, "state.set", {"key": "k", "value": 1})
    assert (await handle_http(ev("DELETE", f"/apps/{app['app_id']}"), d))["statusCode"] == 200
    assert await get_value(d.ledger, app["app_id"], "k") is None
    assert await delete_state(d.ledger, app["app_id"]) == 0


def test_the_bridge_script_offers_state() -> None:
    from aic.shared.apps import BRIDGE_JS

    js_src = BRIDGE_JS.decode()
    assert "state.get" in js_src and "state.set" in js_src


# ---------- AIC and the Orchestrator target an existing app ----------
ACE = TurnCtx(agent_id="ace", role="ace", department=None, ticket_id="", task_id="")


async def an_app(d: Any) -> dict[str, Any]:
    a = {"pk": "APPS", "sk": "APP#app-snake", "app_id": "app-snake", "slug": "snake", "title": "Snake",
         "description": "d", "url": f"{URL}/live/app-snake/index.html", "draft_id": "drf-v1", "version": 1,
         "grants": [], "capabilities": [], "history": [], "pinned": False}  # fmt: skip
    await d.ledger.table.put(a)
    return a


async def test_aic_lists_the_apps_and_hands_over_a_change_to_one_by_id() -> None:
    d = city_deps()
    await an_app(d)
    status = await tool(d, ACE, "get_status")({})
    assert '"app_id": "app-snake"' in status and '"version": 1' in status
    out = await tool(d, ACE, "delegate_to_orchestrator")(
        {
            "goal": "make snake harder",
            "owner_words": "make my snake game harder",
            "app_id": "app-snake",
            "confirm": True,
        }
    )
    assert out.startswith("Handed to the Orchestrator")
    (t,) = [t for t in await d.ledger.list_tickets(("open",)) if t.get("kind") == "task"]
    assert t["app_id"] == "app-snake"
    (msg,) = d.queue.sent  # type: ignore[attr-defined]
    assert "existing app “Snake” (app-snake, version 1)" in msg["body"]
    bad = await tool(d, ACE, "delegate_to_orchestrator")({"goal": "x y z", "owner_words": "", "app_id": "app-nope"})
    assert "no app with that id" in bad


async def test_the_departments_ticket_carries_the_app_id() -> None:
    d = city_deps()
    await an_app(d)
    await d.ledger.create_ticket({"id": "t-task", "goal": "harder", "from": "ace", "to": "orchestrator",
                                  "department": None, "parent_id": None, "app_id": "app-snake"})  # fmt: skip
    orch = TurnCtx(agent_id="orchestrator", role="orchestrator", department=None, ticket_id="t-task", task_id="t-task")
    await tool(d, orch, "create_department")({"name": "Apps", "mission": "Builds web apps and games."})
    await tool(d, orch, "assign_to_department")({"department": "Apps", "goal": "harder", "acceptance": "faster"})
    (kid,) = await d.ledger.child_tickets("t-task")
    assert kid["app_id"] == "app-snake"
    assert "load_app" in d.queue.sent[-1]["body"]  # type: ignore[attr-defined]


async def test_load_app_copies_the_current_version_into_the_workers_folder(tmp_path: Path) -> None:
    s3, assumed = FakeS3(), []
    d = city_deps(workspace(tmp_path, s3, assumed))
    assert d.workspace is not None
    d.workspace.apps_url = URL
    await an_app(d)
    await draft(d, "drf-v1", "t-old", "published", "Snake")
    await update_draft(d.ledger, "drf-v1", {"files": [*({"path": p, "size": 1} for p in GAME),
                                                      {"path": "aic-bridge.js", "size": 1}]})  # fmt: skip
    fetched: list[str] = []

    def fetch(url: str) -> bytes:
        fetched.append(url)
        return b"<" + url.rsplit("/", 1)[1].encode() + b">"

    d.fetch = fetch
    no_task = await tool(d, WORKER, "load_app")({})
    assert "does not change an existing app" in no_task
    await d.ledger.create_ticket({"id": "t-task", "goal": "harder", "from": "ace", "to": "orchestrator",
                                  "department": None, "parent_id": None, "app_id": "app-snake"})  # fmt: skip
    out = await tool(d, WORKER, "load_app")({})
    assert out.startswith("Loaded 3 files of “Snake” version 1")
    assert sorted(fetched) == sorted(f"{URL}/live/app-snake/{p}" for p in GAME)  # never the city's bridge file
    assert (tmp_path / HIRE / "app" / "game.js").read_bytes() == b"<game.js>"


# ---------- a new version replaces the app after the owner approves ----------
async def stage_update(d: Any, s3: FakeS3, app_id: str, task: str = "t-v2") -> dict[str, Any]:
    await d.ledger.create_ticket({"id": task, "goal": "harder", "from": "ace", "to": "orchestrator",
                                  "department": None, "parent_id": None, "app_id": app_id})  # fmt: skip
    upload(s3, {**GAME, "game.js": b"let speed=2"})
    await on_submitted(submitted(task_id=task, title="Snake Turbo"), d.ledger, d.bus, origin(s3), s3, "ws")
    (dr,) = [x for x in await d.ledger.table.query("APPDRAFTS") if x.get("task_id") == task]
    return dr


async def test_an_update_is_staged_against_the_app_and_asks_to_update_it() -> None:
    s3 = FakeS3()
    d = api(s3)
    app = await published(d, s3, [STATE])
    dr = await stage_update(d, s3, app["app_id"])
    assert (dr["status"], dr["replaces"]) == ("ready", app["app_id"])
    (ap,) = await request_publish_approvals(d.ledger, d.bus, "t-v2", "orchestrator")
    assert ap["action"] == f"Update the app “{app['title']}” to version 2"
    assert (ap["replaces"], ap["version"]) == (app["app_id"], 2)
    (sent,) = [e for e in d.bus.events if e["type"] == "approval.requested"]  # type: ignore[attr-defined]
    assert (sent["replaces"], sent["version"]) == (app["app_id"], 2)  # the live event keeps them for the HUD


async def test_approving_an_update_replaces_the_app_and_keeps_the_old_version_for_rollback() -> None:
    s3 = FakeS3()
    d = api(s3)
    v1 = await published(d, s3, [STATE])
    await call(d, v1, "state.set", {"key": "best", "value": 9})
    dr = await stage_update(d, s3, v1["app_id"])
    (ap,) = await request_publish_approvals(d.ledger, d.bus, "t-v2", "orchestrator")
    r = await handle_http(ev("POST", f"/approvals/{ap['id']}", {"approved": True}), d)
    assert r["statusCode"] == 200, r
    v2 = js(r)["app"]
    assert (v2["app_id"], v2["slug"], v2["version"], v2["title"]) == (v1["app_id"], v1["slug"], 2, "Snake Turbo")
    assert v2["url"] == f"{URL}/live/{v1['app_id']}/{dr['draft_id']}/index.html"
    assert s3.objects["aic-prod-apps"][f"live/{v1['app_id']}/{dr['draft_id']}/game.js"]["Body"] == b"let speed=2"
    assert s3.keys("aic-prod-apps", f"live/{v1['app_id']}/index.html")  # version 1 is untouched
    assert [h["version"] for h in v2["history"]] == [1]
    assert len(await d.ledger.table.query("APPS")) == 1  # the same app, not a second one
    assert "app.updated" in [e["type"] for e in d.bus.events]  # type: ignore[attr-defined]
    assert await get_value(d.ledger, v1["app_id"], "best") == 9  # state survives
    assert (await get_draft(d.ledger, dr["draft_id"]) or {})["status"] == "published"


async def test_rollback_restores_the_previous_version_minus_revoked_grants() -> None:
    s3 = FakeS3()
    d = api(s3)
    v1 = await published(d, s3, [STATE, {"id": "calendar.read"}])
    app_id = v1["app_id"]
    assert (await handle_http(ev("POST", f"/apps/{app_id}/rollback"), d))["statusCode"] == 409
    dr = await stage_update(d, s3, app_id)
    (ap,) = await request_publish_approvals(d.ledger, d.bus, "t-v2", "orchestrator")
    await handle_http(ev("POST", f"/approvals/{ap['id']}", {"approved": True, "grants": []}), d)
    await d.ledger.table.update("APPS", f"APP#{app_id}", UpdateOptions(set={"revoked": ["calendar.read"]}))
    r = await handle_http(ev("POST", f"/apps/{app_id}/rollback"), d)
    assert r["statusCode"] == 200, r
    back = js(r)["app"]
    assert (back["version"], back["url"], back["history"]) == (1, v1["url"], [])
    assert back["grants"] == [STATE]  # calendar.read was revoked after version 1 had it
    assert not s3.keys("aic-prod-apps", f"live/{app_id}/{dr['draft_id']}/")  # the rolled-back-from files are gone
    assert (await get_app(d.ledger, app_id) or {})["version"] == 1


async def test_at_most_five_earlier_versions_are_kept() -> None:
    s3 = FakeS3()
    d = api(s3)
    app = await published(d, s3, [])
    app_id = app["app_id"]
    drafts = []
    for n in range(2, 9):
        dr = await stage_update(d, s3, app_id, f"t-v{n}")
        drafts.append(dr["draft_id"])
        (ap,) = await request_publish_approvals(d.ledger, d.bus, f"t-v{n}", "orchestrator")
        await handle_http(ev("POST", f"/approvals/{ap['id']}", {"approved": True}), d)
    cur = await get_app(d.ledger, app_id) or {}
    assert cur["version"] == 8 and [h["version"] for h in cur["history"]] == [7, 6, 5, 4, 3]
    assert not s3.keys("aic-prod-apps", f"live/{app_id}/{drafts[0]}/")  # version 2 fell out of history
    assert s3.keys("aic-prod-apps", f"live/{app_id}/{drafts[1]}/")  # version 3 is still kept


async def test_an_update_of_a_removed_app_is_a_new_app() -> None:
    s3 = FakeS3()
    d = api(s3)
    await d.ledger.create_ticket({"id": "t-v2", "goal": "x", "from": "ace", "to": "orchestrator",
                                  "department": None, "parent_id": None, "app_id": "app-gone"})  # fmt: skip
    upload(s3, GAME)
    await on_submitted(submitted(task_id="t-v2"), d.ledger, d.bus, origin(s3), s3, "ws")
    (dr,) = await d.ledger.table.query("APPDRAFTS")
    assert dr["replaces"] is None


def test_the_rollback_route_is_in_the_owner_check() -> None:
    assert ("POST", "/apps/app-1/rollback") in ROUTES
