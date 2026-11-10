"""VAIC does anything the owner can do in AI City (decision 143): `city_api` and `hud_action`."""

from __future__ import annotations

import json
from typing import Any

import pytest

from city_support import City, make_city, scripted_engine
from test_api import ev, js, make
from vaic.lambdas.api import handle_http, handler, vaic_call
from vaic.runtime.tools import TurnCtx, tools_for
from vaic.shared import owner_api
from vaic.shared.events import MemoryBus


def wired(from_owner: bool = True, role: str = "vaic") -> tuple[City, Any, dict[str, Any]]:
    c = make_city(scripted_engine({}))
    api = make()

    async def call(x: dict[str, Any]) -> dict[str, Any]:
        return await vaic_call(x, api)

    c.deps.owner_api = call
    ctx = TurnCtx(agent_id=role, role=role, department=None, ticket_id="t-1", task_id="t-1", from_owner=from_owner)
    return c, api, {t.name: t for t in tools_for(c.deps, ctx)}


def status(text: str) -> int:
    return int(text.split(" ", 1)[0])


async def test_vaic_reads_and_changes_a_setting_like_the_hud() -> None:
    _, api, t = wired()
    out = await t["city_api"].handler({"method": "PUT", "path": "/settings", "body": {"autopilot": False}})
    assert status(out) == 200
    assert (await api.settings())["autopilot"] is False
    got = await t["city_api"].handler({"method": "GET", "path": "/settings"})
    assert status(got) == 200 and '"autopilot": false' in got


async def test_the_routes_own_checks_still_apply() -> None:
    _, _, t = wired()
    out = await t["city_api"].handler({"method": "PUT", "path": "/settings", "body": {"max_workers_per_goal": 0}})
    assert status(out) == 400 and "whole number" in out


async def test_only_the_owners_own_message_can_use_it() -> None:
    _, api, t = wired(from_owner=False)
    out = await t["city_api"].handler({"method": "PUT", "path": "/settings", "body": {"autopilot": False}})
    assert "Only the owner's own message" in out
    assert (await api.settings()).get("autopilot") is not False
    assert "Only the owner's own message" in await t["hud_action"].handler({"action": "theme", "value": "dark"})


@pytest.mark.parametrize("role", ["orchestrator", "manager", "worker"])
def test_no_one_but_vaic_has_it(role: str) -> None:
    _, _, t = wired(role=role)
    assert "city_api" not in t and "hud_action" not in t


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("PUT", "/github/token"),
        ("PUT", "/connectors/notion/key"),
        ("PUT", "/voice/openai-key"),
        ("PUT", "/notifications/apns"),
        ("POST", "/mail/accounts/ma-1/imap"),
        ("POST", "/messages"),
        ("POST", "/knowledge/uploads"),
        ("GET", "/../secrets"),
        ("PATCH", "/settings"),
    ],
)
async def test_secrets_and_aics_own_routes_are_refused_twice(method: str, path: str) -> None:
    _, _, t = wired()
    assert owner_api.refusal(method, path)
    out = await t["city_api"].handler({"method": "GET" if method == "PATCH" else method, "path": path})
    if method != "PATCH":
        assert "secret" in out or "HUD's own" in out or "not one of" in out
    r = await vaic_call({"method": method, "path": path, "body": {"token": "x"}}, make())
    assert r["statusCode"] == 403


async def test_deletes_need_confirm() -> None:
    _, _, t = wired()
    out = await t["city_api"].handler({"method": "DELETE", "path": "/standing-orders/so-1"})
    assert "confirm: true" in out
    out = await t["city_api"].handler({"method": "DELETE", "path": "/standing-orders/so-1", "confirm": True})
    assert status(out) in (200, 204, 404)


async def test_a_query_string_reaches_the_route() -> None:
    e = owner_api.to_event("GET", "/away-summary?since=2026-11-01T00:00:00Z")
    assert e["rawPath"] == "/away-summary"
    assert e["queryStringParameters"] == {"since": "2026-11-01T00:00:00Z"}


async def test_an_http_request_can_never_take_the_vaic_path() -> None:
    # The key exists only on a direct Lambda invoke (IAM: VAIC's role). Over HTTP the authorizer still decides.
    e = ev("PUT", "/settings", {"autopilot": False}, groups=None)
    e["vaic_call"] = {"method": "PUT", "path": "/settings", "body": {"autopilot": False}}
    assert (await handle_http(e, make()))["statusCode"] == 403
    assert callable(handler)


async def test_hud_action_switches_the_theme_and_opens_pages() -> None:
    c, _, t = wired()
    bus: MemoryBus = c.bus  # type: ignore[assignment]
    assert "Done" in await t["hud_action"].handler({"action": "theme", "value": "dark"})
    assert "Done" in await t["hud_action"].handler({"action": "open", "page": "#/settings/connectors"})
    sent = [e for e in bus.events if e["type"] == "hud.action"]
    assert [(e["action"], e.get("value"), e.get("page")) for e in sent] == [
        ("theme", "dark", None),
        ("open", None, "#/settings/connectors"),
    ]
    assert "light, dark or system" in await t["hud_action"].handler({"action": "theme", "value": "purple"})
    assert "HUD address" in await t["hud_action"].handler({"action": "open", "page": "https://evil.example"})


def test_the_answer_is_cut_to_fit() -> None:
    long = {"statusCode": 200, "body": json.dumps({"x": "a" * 10_000})}
    assert len(owner_api.summarise(long)) < 6100
    assert js({"body": '{"a": 1}'}) == {"a": 1}
