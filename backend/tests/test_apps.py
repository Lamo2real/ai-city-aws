"""Apps built by the city (docs/APPS.md): validation, the submit_app tool, the apps Lambda, sign-off
approvals, and the owner's publish / refuse / remove through the API. Fakes only: no AWS, no Bedrock."""

import io
import json
import os
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from vaic.lambdas.api import ApiDeps, handle_http
from vaic.lambdas.approvals import on_approval_step
from vaic.lambdas.apps import on_submitted
from vaic.lambdas.ledger_writer import ticket_of
from vaic.runtime.tools import TurnCtx, gate_tools, tools_for
from vaic.shared.apps import (
    AppsOrigin,
    Workspace,
    content_type,
    get_draft,
    list_apps,
    publish_draft,
    put_draft,
    slugify,
    update_draft,
    validate_files,
)
from vaic.shared.caps import default_settings
from vaic.shared.events import MemoryBus, parse_event
from vaic.shared.hierarchy.actions import CityDeps
from vaic.shared.hierarchy.queue import MemoryQueue
from vaic.shared.ledger import Ledger
from vaic.shared.table import MemoryTable

HIRE = "wkr-apps-0123456789ab"
URL = "https://apps.example.cloudfront.net"


# ---------- fakes ----------
class FakeS3:
    """The boto3 S3 calls the city uses, over in-memory buckets."""

    def __init__(self) -> None:
        self.objects: dict[str, dict[str, dict[str, Any]]] = {}
        self.calls: list[str] = []

    def put(self, bucket: str, key: str, body: bytes, **meta: Any) -> None:
        self.objects.setdefault(bucket, {})[key] = {"Body": body, **meta}

    def keys(self, bucket: str, prefix: str = "") -> list[str]:
        return sorted(k for k in self.objects.get(bucket, {}) if k.startswith(prefix))

    def list_objects_v2(self, Bucket: str, Prefix: str, ContinuationToken: str | None = None) -> dict[str, Any]:
        self.calls.append("list")
        keys = self.keys(Bucket, Prefix)
        start = int(ContinuationToken or 0)
        page = keys[start : start + 2]  # tiny pages so paging is exercised
        more = start + 2 < len(keys)
        out: dict[str, Any] = {
            "Contents": [{"Key": k, "Size": len(self.objects[Bucket][k]["Body"])} for k in page],
            "IsTruncated": more,
        }
        if more:
            out["NextContinuationToken"] = str(start + 2)
        return out

    def get_object(self, Bucket: str, Key: str) -> dict[str, Any]:
        return {"Body": io.BytesIO(self.objects[Bucket][Key]["Body"])}

    def put_object(self, Bucket: str, Key: str, Body: bytes, **meta: Any) -> dict[str, Any]:
        self.put(Bucket, Key, Body, **meta)
        return {}

    def copy_object(self, Bucket: str, Key: str, CopySource: dict[str, str], **meta: Any) -> dict[str, Any]:
        src = self.objects[CopySource["Bucket"]][CopySource["Key"]]
        self.put(Bucket, Key, src["Body"], **{k: v for k, v in meta.items() if k != "MetadataDirective"})
        return {}

    def delete_objects(self, Bucket: str, Delete: dict[str, Any]) -> dict[str, Any]:
        for o in Delete["Objects"]:
            self.objects.get(Bucket, {}).pop(o["Key"], None)
        return {}


class FakeCloudFront:
    def __init__(self) -> None:
        self.invalidations: list[dict[str, Any]] = []

    def create_invalidation(self, DistributionId: str, InvalidationBatch: dict[str, Any]) -> dict[str, Any]:
        self.invalidations.append({"id": DistributionId, **InvalidationBatch})
        return {}


def origin(s3: FakeS3, cf: FakeCloudFront | None = None) -> AppsOrigin:
    return AppsOrigin(s3=s3, bucket="vaic-prod-apps", url=URL, cloudfront=cf, distribution_id="E123")


def submitted(**over: Any) -> dict[str, Any]:
    e = {
        "type": "app.submitted",
        "at": "2026-11-07T10:00:00.000Z",
        "hire_id": HIRE,
        "ticket_id": "t-worker",
        "task_id": "t-task",
        "department": "Apps",
        "title": "Comet Hopper",
        "description": "Hop between comets and collect stardust.",
        "icon": "icon.svg",
        "files": [],
    }
    return {"detail": {**e, **over}}


def upload(s3: FakeS3, files: dict[str, bytes], hire: str = HIRE) -> None:
    for p, b in files.items():
        s3.put("ws", f"hires/{hire}/app/{p}", b)


GAME = {"index.html": b"<!doctype html><script src=game.js></script>", "game.js": b"let x=1", "icon.svg": b"<svg/>"}


# ---------- validation ----------
@pytest.mark.parametrize(
    ("files", "icon", "problem"),
    [
        ([{"path": "index.html", "size": 10}], None, None),
        ([{"path": "index.html", "size": 10}, {"path": "img/a.png", "size": 5}], "img/a.png", None),
        ([], None, "empty"),
        ([{"path": "main.html", "size": 10}], None, "index.html is missing"),
        ([{"path": "index.html", "size": 1}, {"path": "../x.js", "size": 1}], None, "'..'"),
        ([{"path": "index.html", "size": 1}, {"path": "/abs.js", "size": 1}], None, "relative"),
        ([{"path": "index.html", "size": 1}, {"path": "a//b.js", "size": 1}], None, "empty"),
        ([{"path": "index.html", "size": 1}, {"path": ".env.js", "size": 1}], None, "hidden"),
        ([{"path": "index.html", "size": 1}, {"path": "a/.git/config.txt", "size": 1}], None, "hidden"),
        ([{"path": "index.html", "size": 1}, {"path": "run.sh", "size": 1}], None, "not allowed"),
        ([{"path": "index.html", "size": 1}, {"path": "Makefile", "size": 1}], None, "not allowed"),
        ([{"path": "index.html", "size": 1}, {"path": "a b.js", "size": 1}], None, "only letters"),
        ([{"path": "index.html", "size": 1}, {"path": "é.js", "size": 1}], None, "only letters"),
        ([{"path": "index.html", "size": 2 * 1024 * 1024 + 1}], None, "2 MB"),
        (
            [{"path": "index.html", "size": 1}] + [{"path": f"{i}.png", "size": 2_000_000} for i in range(6)],
            None,
            "10 MB",
        ),
        ([{"path": f"{i}.js", "size": 1} for i in range(300)] + [{"path": "index.html", "size": 1}], None, "300-file"),
        ([{"path": "index.html", "size": 1}, {"path": "index.html", "size": 1}], None, "twice"),
        ([{"path": "index.html", "size": 1}], "icon.svg", "not in the app folder"),
        ([{"path": "index.html", "size": 1}, {"path": "icon.gif", "size": 1}], "icon.gif", ".svg or .png"),
    ],
)
def test_validation_table(files: list[dict[str, Any]], icon: str | None, problem: str | None) -> None:
    got = validate_files(files, icon)
    if problem is None:
        assert got is None
    else:
        assert got is not None and problem in got, got


def test_content_type_comes_from_the_extension_only() -> None:
    assert content_type("index.html") == "text/html; charset=utf-8"
    assert content_type("a/B.JS") == "text/javascript; charset=utf-8"
    assert content_type("x.woff2") == "font/woff2"


def test_slugs_are_short_and_unique() -> None:
    assert slugify("Comet Hopper!") == "comet-hopper"
    assert slugify("Comet Hopper", ["comet-hopper"]) == "comet-hopper-2"
    assert slugify("Comet Hopper", ["comet-hopper", "comet-hopper-2"]) == "comet-hopper-3"
    assert slugify("!!!") == "app"
    long = slugify("x" * 60, ["x" * 40])
    assert len(long) <= 40 and long.endswith("-2")


# ---------- events ----------
def test_app_events_validate_and_approvals_carry_a_kind() -> None:
    e = parse_event(submitted(files=[{"path": "index.html", "size": 3}])["detail"])
    assert e["files"] == [{"path": "index.html", "size": 3}]
    json.dumps(e)
    assert (
        parse_event(
            {"type": "app.removed", "at": "x", "app_id": "app-1", "slug": "s"}  # minimal
        )["slug"]
        == "s"
    )
    with pytest.raises(ValidationError):
        parse_event({"type": "app.draft", "at": "x", "draft_id": "d", "ticket_id": "t", "task_id": "t",
                     "department": "Apps", "title": "x", "status": "live"})  # fmt: skip
    plain = parse_event(
        {"type": "approval.requested", "at": "x", "id": "ap", "agent": "a", "action": "b", "reason": "c"}
    )
    assert plain["kind"] == "tool"
    assert ticket_of(parse_event(submitted()["detail"])) == "t-worker"


# ---------- the apps Lambda ----------
async def test_the_lambda_stages_a_valid_submission_as_a_ready_draft_with_the_citys_content_types() -> None:
    ledger, bus, s3 = Ledger(MemoryTable()), MemoryBus(), FakeS3()
    upload(s3, {**GAME, "lvl/one.json": b"{}"})
    dr = await on_submitted(submitted(files=[{"path": "fake.exe", "size": 1}]), ledger, bus, origin(s3), s3, "ws")
    assert dr is not None and dr["status"] == "ready", dr
    assert dr["preview_url"] == f"{URL}/drafts/{dr['draft_id']}/index.html"
    assert {f["path"] for f in dr["files"]} == {"index.html", "game.js", "icon.svg", "lvl/one.json", "vaic-bridge.js"}
    staged = s3.objects["vaic-prod-apps"]
    html = staged[f"drafts/{dr['draft_id']}/index.html"]
    assert (html["ContentType"], html["CacheControl"]) == ("text/html; charset=utf-8", "no-cache")
    assert staged[f"drafts/{dr['draft_id']}/game.js"]["CacheControl"] == "max-age=300"
    assert not any(k.startswith("live/") for k in staged)
    (ev,) = bus.of_type("app.draft")
    assert (ev["status"], ev["ticket_id"], ev["preview_url"]) == ("ready", "t-worker", dr["preview_url"])


async def test_the_lambda_rejects_what_fails_a_check_with_the_reason() -> None:
    ledger, bus, s3 = Ledger(MemoryTable()), MemoryBus(), FakeS3()
    upload(s3, {"game.js": b"x"})
    dr = await on_submitted(submitted(icon=None), ledger, bus, origin(s3), s3, "ws")
    assert dr is not None and dr["status"] == "rejected" and "index.html" in dr["reason"]
    assert "vaic-prod-apps" not in s3.objects
    assert bus.of_type("app.draft")[0]["reason"] == dr["reason"]
    bad = await on_submitted(submitted(hire_id="mgr-apps"), ledger, bus, origin(s3), s3, "ws")
    assert bad is not None and bad["status"] == "rejected" and "worker" in bad["reason"]


async def test_a_new_submission_replaces_the_hires_older_draft_and_ignores_other_events() -> None:
    ledger, bus, s3 = Ledger(MemoryTable()), MemoryBus(), FakeS3()
    upload(s3, GAME)
    first = await on_submitted(submitted(), ledger, bus, origin(s3), s3, "ws")
    second = await on_submitted(submitted(), ledger, bus, origin(s3), s3, "ws")
    assert first and second
    assert (await get_draft(ledger, first["draft_id"]) or {})["reason"] == "replaced"
    assert (await get_draft(ledger, second["draft_id"]) or {})["status"] == "ready"
    assert await on_submitted({"detail": {"type": "agent.retired", "at": "x", "id": "w-1", "worker_state": "released"}},
                              ledger, bus, origin(s3), s3, "ws") is None  # fmt: skip
    assert await on_submitted({"detail": {"type": "nope"}}, ledger, bus, origin(s3), s3, "ws") is None


# ---------- the worker tool ----------
def city_deps(workspace: Workspace | None = None) -> CityDeps:
    ledger = Ledger(MemoryTable())

    async def settings() -> dict[str, Any]:
        return await ledger.settings(default_settings())

    class NoFactory:
        async def hire(self, *_: Any) -> Any:
            raise RuntimeError

        async def release(self, *_: Any) -> Any:
            raise RuntimeError

    return CityDeps(
        ledger=ledger,
        bus=MemoryBus(),
        queue=MemoryQueue(),
        factory=NoFactory(),
        settings=settings,
        max_review_rounds=3,
        workspace=workspace,
    )


def tool(d: CityDeps, ctx: TurnCtx, name: str) -> Any:
    return next(t for t in gate_tools(d, ctx, tools_for(d, ctx)) if t.name == name).handler


WORKER = TurnCtx(agent_id=HIRE, role="worker", department="Apps", ticket_id="t-worker", task_id="t-task")


def workspace(tmp_path: Path, s3: FakeS3, assumed: list[str]) -> Workspace:
    def s3_for(hire_id: str) -> FakeS3:
        assumed.append(hire_id)
        return s3

    return Workspace(bucket="ws", s3_for=s3_for, root=str(tmp_path))


def write_app(tmp_path: Path, files: dict[str, bytes], folder: str = "app") -> Path:
    root = tmp_path / HIRE / folder
    for p, b in files.items():
        (root / p).parent.mkdir(parents=True, exist_ok=True)
        (root / p).write_bytes(b)
    return root


async def test_submit_app_uploads_to_the_hires_own_prefix_on_the_tagged_role_and_puts_the_event(
    tmp_path: Path,
) -> None:
    s3, assumed = FakeS3(), []
    s3.put("ws", f"hires/{HIRE}/app/old.js", b"old")
    s3.put("ws", f"hires/{HIRE}/notes.txt", b"keep")
    d = city_deps(workspace(tmp_path, s3, assumed))
    write_app(tmp_path, GAME)
    out = await tool(d, WORKER, "submit_app")(
        {"title": "Comet Hopper", "description": "Hop between comets.", "icon": "icon.svg"}
    )
    assert out == "Submitted 3 files; the city is checking them."
    assert assumed == [HIRE]
    assert s3.keys("ws") == sorted(
        [f"hires/{HIRE}/app/{p}" for p in GAME] + [f"hires/{HIRE}/notes.txt"]
    )  # older submission files gone, nothing outside app/ touched
    (ev,) = d.bus.of_type("app.submitted")  # type: ignore[attr-defined]
    assert (ev["hire_id"], ev["ticket_id"], ev["task_id"], ev["department"]) == (HIRE, "t-worker", "t-task", "Apps")
    assert {f["path"] for f in ev["files"]} == set(GAME)


async def test_submit_app_refuses_early_on_the_same_checks(tmp_path: Path) -> None:
    s3, assumed = FakeS3(), []
    d = city_deps(workspace(tmp_path, s3, assumed))
    submit = tool(d, WORKER, "submit_app")
    base = {"title": "Comet Hopper", "description": "Hop between comets."}
    write_app(tmp_path, {"game.js": b"x"})
    assert "index.html is missing" in await submit(base)
    assert "inside your workspace" in await submit({**base, "dir": "../.."})
    assert "no folder" in await submit({**base, "dir": "nope"})
    write_app(tmp_path, {"index.html": b"x", "run.sh": b"x"}, "two")
    assert "not allowed" in await submit({**base, "dir": "two"})
    outside = tmp_path / "secret.txt"
    outside.write_text("s")
    root = write_app(tmp_path, {"index.html": b"x"}, "three")
    os.symlink(outside, root / "link.txt")
    assert "symbolic links" in await submit({**base, "dir": "three"})
    assert "wrong length" in await submit({**base, "title": "x" * 41})
    assert assumed == [] and s3.objects == {}
    assert d.bus.of_type("app.submitted") == []  # type: ignore[attr-defined]
    assert "cannot be submitted" in await tool(city_deps(), WORKER, "submit_app")(base)


def test_submit_app_is_a_worker_tool_only() -> None:
    d = city_deps()
    for role in ("vaic", "orchestrator", "manager"):
        ctx = TurnCtx(agent_id="x", role=role, department="Apps", ticket_id="t", task_id="t")
        assert "submit_app" not in {t.name for t in tools_for(d, ctx)}


# ---------- sign-off files the owner's approvals ----------
async def draft(d: CityDeps | Ledger, draft_id: str, task_id: str, status: str, title: str = "Comet Hopper") -> None:
    ledger = d if isinstance(d, Ledger) else d.ledger
    await put_draft(
        ledger,
        {
            "draft_id": draft_id,
            "hire_id": HIRE,
            "ticket_id": "t-worker",
            "task_id": task_id,
            "department": "Apps",
            "title": title,
            "description": "Hop between comets.",
            "icon": "icon.svg",
            "status": status,
            "reason": None,
            "files": [{"path": p, "size": len(b), "type": content_type(p)} for p, b in GAME.items()],
            "total_bytes": 10,
            "preview_url": f"{URL}/drafts/{draft_id}/index.html",
            "approval_id": None,
            "created_at": "2026-11-07T10:00:00.000Z",
        },
    )


async def test_a_finished_job_asks_the_owner_to_publish_each_ready_draft_of_that_task_once() -> None:
    from vaic.shared.apps import request_publish_approvals
    from vaic.shared.hierarchy.board_path import finish_job

    d = city_deps()
    task = await d.ledger.create_ticket({"id": "t-task", "goal": "a game", "from": "vaic", "to": "orchestrator",
                                         "department": None, "parent_id": None, "status": "in_progress"})  # fmt: skip
    await draft(d, "drf-ready", "t-task", "ready")
    await draft(d, "drf-rejected", "t-task", "rejected")
    await draft(d, "drf-other", "t-other", "ready")
    await finish_job(d, task, "plays well")  # the board's sign-off (decision 298)
    (ev,) = d.bus.of_type("approval.requested")  # type: ignore[attr-defined]
    assert (ev["kind"], ev["draft_id"], ev["title"]) == ("app.publish", "drf-ready", "Comet Hopper")
    assert ev["preview_url"].endswith("/drafts/drf-ready/index.html")
    ap = await d.ledger.get_approval(str(ev["id"])) or {}
    assert (ap["kind"], ap["draft_id"], ap["ticket_id"]) == ("app.publish", "drf-ready", "t-task")
    dr = await get_draft(d.ledger, "drf-ready") or {}
    assert (dr["status"], dr["approval_id"]) == ("awaiting_owner", ap["id"])
    assert (await get_draft(d.ledger, "drf-other") or {})["status"] == "ready"
    assert "not live yet" in str((await d.ledger.get_ticket("t-task") or {}).get("result"))
    assert await request_publish_approvals(d.ledger, d.bus, "t-task", "orchestrator") == []  # never asked twice


# ---------- the owner: publish, refuse, remove ----------
def api(s3: FakeS3, cf: FakeCloudFront | None = None, configured: bool = True) -> ApiDeps:
    ledger = Ledger(MemoryTable())

    async def settings() -> dict[str, Any]:
        return await ledger.settings(default_settings())

    return ApiDeps(
        ledger=ledger,
        bus=MemoryBus(),
        queue=MemoryQueue(),
        settings=settings,
        apps=origin(s3, cf) if configured else None,
    )


def ev(method: str, path: str, body: Any = None) -> dict[str, Any]:
    return {
        "rawPath": path,
        "requestContext": {
            "http": {"method": method},
            "authorizer": {"jwt": {"claims": {"cognito:groups": "[owner]"}}},
        },
        "body": None if body is None else json.dumps(body),
    }


def js(r: dict[str, Any]) -> Any:
    return json.loads(r["body"])


async def staged(d: ApiDeps, s3: FakeS3, draft_id: str = "drf-1") -> dict[str, Any]:
    await draft(d.ledger, draft_id, "t-task", "awaiting_owner")
    for p, b in GAME.items():
        s3.put("vaic-prod-apps", f"drafts/{draft_id}/{p}", b, ContentType=content_type(p))
    a = await d.ledger.request_approval(
        {"agent": "orchestrator", "ticket_id": "t-task", "tool": "app.publish", "action": "Publish", "hash": "h",
         "reason": "r", "kind": "app.publish", "draft_id": draft_id, "preview_url": "p", "title": "Comet Hopper"}
    )  # fmt: skip
    return a


async def test_approving_publishes_the_draft_to_live_and_lists_it() -> None:
    s3 = FakeS3()
    d = api(s3)
    a = await staged(d, s3)
    r = await handle_http(ev("POST", f"/approvals/{a['id']}", {"approved": True}), d)
    assert r["statusCode"] == 200, r
    app = js(r)["app"]
    assert app["slug"] == "comet-hopper" and app["app_id"].startswith("app-")
    assert app["url"] == f"{URL}/live/{app['app_id']}/index.html"
    assert app["icon_url"] == f"{URL}/live/{app['app_id']}/icon.svg"
    assert s3.keys("vaic-prod-apps", f"live/{app['app_id']}/") == sorted(f"live/{app['app_id']}/{p}" for p in GAME)
    live_html = s3.objects["vaic-prod-apps"][f"live/{app['app_id']}/index.html"]
    assert (live_html["ContentType"], live_html["CacheControl"]) == ("text/html; charset=utf-8", "no-cache")
    assert (await get_draft(d.ledger, "drf-1") or {})["status"] == "published"
    assert [e["type"] for e in d.bus.events] == ["app.published", "approval.decided"]  # type: ignore[attr-defined]
    assert js(await handle_http(ev("GET", "/apps"), d))["apps"] == [app]
    assert js(await handle_http(ev("GET", "/city"), d))["apps"] == [app]
    # Deciding again is refused; publishing the same draft again gives the same app.
    assert (await handle_http(ev("POST", f"/approvals/{a['id']}", {"approved": True}), d))["statusCode"] == 409
    assert (await publish_draft(d.ledger, d.bus, origin(s3), "drf-1"))["app_id"] == app["app_id"]
    assert len(await list_apps(d.ledger)) == 1
    # While one publish of a draft is under way, a second is turned away instead of publishing a twin.
    assert await d.ledger.claim("publish:drf-1", 300)
    with pytest.raises(ValueError, match="being published"):
        await publish_draft(d.ledger, d.bus, origin(s3), "drf-1")


async def test_a_second_app_with_the_same_title_gets_its_own_slug() -> None:
    s3 = FakeS3()
    d = api(s3)
    for n in ("drf-1", "drf-2"):
        await staged(d, s3, n)
        await publish_draft(d.ledger, d.bus, origin(s3), n)
    assert sorted(a["slug"] for a in await list_apps(d.ledger)) == ["comet-hopper", "comet-hopper-2"]


async def test_refusing_marks_the_draft_refused_and_publishes_nothing() -> None:
    s3 = FakeS3()
    d = api(s3)
    a = await staged(d, s3)
    r = await handle_http(ev("POST", f"/approvals/{a['id']}", {"approved": False}), d)
    assert r["statusCode"] == 200 and "app" not in js(r)
    assert (await get_draft(d.ledger, "drf-1") or {})["status"] == "refused"
    assert s3.keys("vaic-prod-apps", "live/") == [] and await list_apps(d.ledger) == []


async def test_publishing_without_the_apps_origin_leaves_the_approval_pending() -> None:
    s3 = FakeS3()
    d = api(s3, configured=False)
    a = await staged(d, s3)
    r = await handle_http(ev("POST", f"/approvals/{a['id']}", {"approved": True}), d)
    assert r["statusCode"] == 503
    assert (await d.ledger.get_approval(a["id"]) or {})["status"] == "pending"


async def test_removing_an_app_deletes_its_files_invalidates_the_cdn_and_forgets_it() -> None:
    s3, cf = FakeS3(), FakeCloudFront()
    d = api(s3, cf)
    await staged(d, s3)
    app = await publish_draft(d.ledger, d.bus, origin(s3, cf), "drf-1")
    r = await handle_http(ev("DELETE", f"/apps/{app['app_id']}"), d)
    assert (r["statusCode"], js(r)) == (200, {"removed": app["app_id"]})
    assert s3.keys("vaic-prod-apps", "live/") == []
    assert s3.keys("vaic-prod-apps", "drafts/")  # drafts expire by lifecycle, not here
    assert cf.invalidations[0]["Paths"]["Items"] == [f"/live/{app['app_id']}/*"]
    assert await list_apps(d.ledger) == []
    assert d.bus.of_type("app.removed")[-1] == {  # type: ignore[attr-defined]
        "type": "app.removed", "at": d.bus.events[-1]["at"], "app_id": app["app_id"], "slug": "comet-hopper"  # type: ignore[attr-defined]
    }  # fmt: skip
    assert (await handle_http(ev("DELETE", f"/apps/{app['app_id']}"), d))["statusCode"] == 404


async def test_the_resume_step_wakes_the_orchestrator_only_when_the_owner_refused_a_publish() -> None:
    s3 = FakeS3()
    d = api(s3)
    await d.ledger.put_agent({"id": "orchestrator", "kind": "core", "role": "Orchestrator", "department": None,
                              "model": "fable-5-1", "parent": "vaic", "state": "active"})  # fmt: skip
    a = await staged(d, s3)
    await on_approval_step({"step": "resume", "approvalId": a["id"], "approved": True}, d.ledger, d.queue)
    assert d.queue.sent == []  # type: ignore[attr-defined]
    # Nobody answered in time: the card stays (a late yes still publishes) and nobody is told it was refused.
    await on_approval_step({"step": "resume", "approvalId": a["id"], "approved": False}, d.ledger, d.queue)
    assert d.queue.sent == []  # type: ignore[attr-defined]
    assert (await d.ledger.get_approval(a["id"]) or {})["status"] == "pending"
    await d.ledger.decide_approval(a["id"], False)
    await on_approval_step({"step": "resume", "approvalId": a["id"], "approved": False}, d.ledger, d.queue)
    (m,) = d.queue.sent  # type: ignore[attr-defined]
    assert (m["role"], m["agentId"], m["taskId"]) == ("orchestrator", "orchestrator", "t-task")
    assert "not to publish" in m["body"] and "Comet Hopper" in m["body"]


async def test_the_worker_and_its_manager_see_the_citys_verdict_on_the_draft() -> None:
    from city_support import make_city, scripted_engine

    city = make_city(scripted_engine({}))
    await draft(city.ledger, "drf-1", "t-task", "rejected")
    await update_draft(city.ledger, "drf-1", {"reason": "index.html is missing at the top of the app folder"})
    worker = {"id": HIRE, "kind": "worker", "role": "Game dev"}
    inv = {
        "role": "worker",
        "kind": "task",
        "from": "mgr-apps",
        "body": "go",
        "ticketId": "t-worker",
        "taskId": "t-task",
    }
    text = await city.host._prompt(worker, inv)
    assert "- app draft drf-1 [rejected]: index.html is missing" in text


async def test_vaic_is_told_when_the_owner_spoke_so_it_answers_short_and_spoken() -> None:
    from city_support import make_city, scripted_engine

    city = make_city(scripted_engine({}))
    vaic = {"id": "vaic", "kind": "vaic", "role": "vaic"}
    inv = {"role": "vaic", "kind": "task", "from": "owner", "body": "how is it going?", "ticketId": "c", "taskId": "c"}
    assert "said this out loud" not in await city.host._prompt(vaic, inv)
    spoken = await city.host._prompt(vaic, {**inv, "voice": True})
    assert "said this out loud" in spoken and "one to three short" in spoken
    assert spoken.index("how is it going?") < spoken.index("said this out loud") < spoken.index("Current state")
