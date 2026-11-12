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
    api.ledger, api.settings = c.deps.ledger, c.deps.settings  # one city: what VAIC stages is what the HUD reads

    async def call(x: dict[str, Any]) -> dict[str, Any]:
        return await vaic_call(x, api)

    c.deps.owner_api = call
    return c, api, turn(c, from_owner, role)


def turn(c: City, from_owner: bool = True, role: str = "vaic") -> dict[str, Any]:
    """The tools of one turn (a new owner message is a new turn)."""
    ctx = TurnCtx(agent_id=role, role=role, department=None, ticket_id="t-1", task_id="t-1", from_owner=from_owner)
    return {t.name: t for t in tools_for(c.deps, ctx)}


def status(text: str) -> int:
    return int(text.split(" ", 1)[0])


async def test_vaic_reads_and_changes_a_setting_like_the_hud() -> None:
    c, api, t = wired()
    out = await t["city_api"].handler({"method": "PUT", "path": "/settings", "body": {"autopilot": False}})
    assert "Staged, NOT saved" in out
    assert (await api.settings())["autopilot"] is True  # nothing saved before the owner's yes
    out = await turn(c)["save_change"].handler({"answer": "yes"})
    assert out.startswith("Saved") and (await api.settings())["autopilot"] is False
    got = await t["city_api"].handler({"method": "GET", "path": "/settings"})
    assert status(got) == 200 and '"autopilot": false' in got


async def test_the_routes_own_checks_still_apply() -> None:
    _, _, t = wired()
    out = await t["city_api"].handler({"method": "PUT", "path": "/settings", "body": {"max_workers_per_goal": 0}})
    assert "Not staged" in out and "whole number" in out
    out = await t["city_api"].handler(
        {"method": "PUT", "path": "/settings", "body": {"max_new_sessions_per_second": 30}}
    )
    assert "Not staged" in out and "25" in out


# ---------- staged changes with Yes / No (decision 206) ----------
async def test_a_limit_change_is_shown_with_yes_and_no_then_saved_on_yes() -> None:
    c, api, t = wired()
    bus: MemoryBus = c.bus  # type: ignore[assignment]
    out = await t["city_api"].handler(
        {"method": "PUT", "path": "/settings", "body": {"max_workers_per_goal": 65, "max_new_sessions_per_second": 3}}
    )
    assert "Do you want to save these changes?" in out
    q = [e for e in bus.events if e["type"] == "vaic.question"][-1]
    assert q["options"] == ["Yes", "No"] and q["question"] == "Do you want to save these changes?"
    assert q["title"] == "Settings → Limits & spending" and q["id"].startswith("chg-")
    before = (await api.settings())["max_workers_per_goal"]
    assert q["lines"] == [
        f"Workers per goal (one manager's team): {before} → 65",
        f"New workers per second: {(await api.settings())['max_new_sessions_per_second']} → 3",
    ]
    # The same turn can't say yes for the owner.
    assert "same turn" in await t["save_change"].handler({"answer": "yes"})
    assert (await api.settings())["max_workers_per_goal"] == before
    # The owner's next message ("Yes", a tap, typed or spoken) is a new turn.
    out = await turn(c)["save_change"].handler({"answer": "yes"})
    assert out.startswith("Saved")
    s = await api.settings()
    assert s["max_workers_per_goal"] == 65 and s["max_new_sessions_per_second"] == 3
    done = [e for e in bus.events if e["type"] == "vaic.change"]
    assert done == [{"type": "vaic.change", "conversation": "main", "id": q["id"], "saved": True, **_at(done[0])}]
    assert "Nothing is waiting" in await turn(c)["save_change"].handler({"answer": "yes"})


def _at(e: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in e.items() if k not in ("type", "conversation", "id", "saved")}


async def test_no_discards_the_change() -> None:
    c, api, t = wired()
    bus: MemoryBus = c.bus  # type: ignore[assignment]
    await t["city_api"].handler({"method": "PUT", "path": "/settings", "body": {"max_workers_per_goal": 65}})
    out = await turn(c)["save_change"].handler({"answer": "no"})
    assert out.startswith("Discarded")
    assert (await api.settings())["max_workers_per_goal"] != 65
    assert [e["saved"] for e in bus.events if e["type"] == "vaic.change"] == [False]
    assert "Nothing is waiting" in await turn(c)["save_change"].handler({"answer": "yes"})


async def test_a_newer_change_replaces_the_waiting_one() -> None:
    c, api, t = wired()
    await t["city_api"].handler({"method": "PUT", "path": "/settings", "body": {"max_workers_per_goal": 65}})
    await turn(c)["city_api"].handler({"method": "PUT", "path": "/settings", "body": {"max_workers_per_goal": 66}})
    await turn(c)["save_change"].handler({"answer": "yes"})
    assert (await api.settings())["max_workers_per_goal"] == 66


@pytest.mark.parametrize(
    "body",
    [{"policy": {"rules": []}}, {"self_improvement": True}, {"iam_role": "admin"}, {"first_run_done": True}, {}],
)
async def test_safety_iam_policy_and_unknown_settings_are_refused(body: dict[str, Any]) -> None:
    c, _, t = wired()
    out = await t["city_api"].handler({"method": "PUT", "path": "/settings", "body": body})
    assert "not a setting" in out
    assert "Nothing is waiting" in await turn(c)["save_change"].handler({"answer": "yes"})


async def test_spend_caps_are_the_owners_setting_and_staged_too() -> None:
    c, api, t = wired()
    out = await t["city_api"].handler({"method": "PUT", "path": "/settings", "body": {"daily_global_usd": 20}})
    assert "Daily cap, all departments: no limit → $20" in out
    await turn(c)["save_change"].handler({"answer": "yes"})
    assert (await api.settings())["daily_global_usd"] == 20


async def test_an_unchanged_value_stages_nothing() -> None:
    _, api, t = wired()
    cur = (await api.settings())["max_workers_per_goal"]
    out = await t["city_api"].handler({"method": "PUT", "path": "/settings", "body": {"max_workers_per_goal": cur}})
    assert "already have those values" in out


async def test_save_change_needs_the_owners_message() -> None:
    c, _, t = wired()
    await t["city_api"].handler({"method": "PUT", "path": "/settings", "body": {"autopilot": False}})
    assert "Only the owner's own message" in await turn(c, from_owner=False)["save_change"].handler({"answer": "yes"})


async def test_skill_one_match_shows_a_card_with_add() -> None:
    c, _, t = wired()
    bus: MemoryBus = c.bus  # type: ignore[assignment]
    seen: list[dict[str, Any]] = []

    async def call(x: dict[str, Any]) -> dict[str, Any]:
        seen.append(x)
        return {"statusCode": 201, "body": json.dumps({"skill": {"name": "release-notes"}})}

    c.deps.owner_api = call
    out = await t["find_skill"].handler({"query": "release notes"})
    assert "Add this skill?" in out and seen == []
    q = [e for e in bus.events if e["type"] == "vaic.question"][-1]
    assert q["options"] == ["Add", "Not now"] and q["title"] == "Add the skill Release notes"
    assert q["lines"] and "Product" in q["detail"]
    out = await turn(c)["save_change"].handler({"answer": "yes"})
    assert out.startswith("Saved")
    assert seen == [{"method": "POST", "path": "/skills/catalog/release-notes", "body": {}}]


async def test_skill_several_matches_are_offered_as_choices() -> None:
    c, _, t = wired()
    bus: MemoryBus = c.bus  # type: ignore[assignment]
    out = await t["find_skill"].handler({"query": "release"})
    assert "skills fit" in out
    q = [e for e in bus.events if e["type"] == "vaic.question"][-1]
    assert "Release notes" in q["options"] and "Press release" in q["options"] and not q.get("id")
    assert "Nothing is waiting" in await turn(c)["save_change"].handler({"answer": "yes"})


async def test_skill_no_match_says_so() -> None:
    c, _, t = wired()
    bus: MemoryBus = c.bus  # type: ignore[assignment]
    out = await t["find_skill"].handler({"query": "quantum teleportation"})
    assert out.startswith("No skill in the catalog matches")
    assert not [e for e in bus.events if e["type"] == "vaic.question"]


async def test_a_skill_already_added_is_not_offered_again() -> None:
    c, _, t = wired()
    await c.deps.ledger.table.put({"pk": "SKILLS", "sk": "SKILL#release-notes", "name": "release-notes"})
    assert "already has" in await t["find_skill"].handler({"query": "Release notes"})


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


async def test_deletes_are_staged_like_any_change() -> None:
    c, _, t = wired()
    out = await t["city_api"].handler({"method": "DELETE", "path": "/standing-orders/so-1"})
    assert "Do you want to go ahead?" in out
    out = await turn(c)["save_change"].handler({"answer": "yes"})
    assert "404" in out or out.startswith("Saved")


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
    assert "Staged" in await t["hud_action"].handler({"action": "theme", "value": "dark"})
    assert not [e for e in bus.events if e["type"] == "hud.action"]  # appearance waits for the owner's yes
    assert (await turn(c)["save_change"].handler({"answer": "yes"})).startswith("Saved")
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


@pytest.mark.parametrize(
    ("tool", "args"),
    [
        ("save_change", {"answer": "yes"}),
        ("find_skill", {"query": "release notes"}),
        ("city_api", {"method": "PUT", "path": "/settings", "body": {"max_workers_per_goal": 65}}),
    ],
)
def test_the_new_tools_pass_the_policy_gate(tool: str, args: dict[str, Any]) -> None:
    from vaic.runtime.tools import mcp_name
    from vaic.shared.policy import decide

    assert decide(mcp_name(tool), args)[0] == "allow"


async def test_the_coo_review_switches_on_from_the_chat_in_the_shape_the_get_gives() -> None:
    # The owner, 2026-11-11: "turn on the COO bottleneck review", daily, Yes → "not saved". VAIC sent back the
    # reviews list it read from GET /executives and the save crashed (AttributeError) after the Yes (decision 209).
    c, _, t = wired()
    got = json.loads((await t["city_api"].handler({"method": "GET", "path": "/executives"})).split(" ", 1)[1])
    reviews = [
        {**r, "enabled": True, "every_days": 1} if r["id"] == "coo-bottleneck-review" else r for r in got["reviews"]
    ]
    out = await t["city_api"].handler({"method": "PUT", "path": "/executives", "body": {"reviews": reviews}})
    assert "Staged, NOT saved" in out
    out = await turn(c)["save_change"].handler({"answer": "yes"})
    assert out.startswith("Saved"), out
    after = json.loads((await t["city_api"].handler({"method": "GET", "path": "/executives"})).split(" ", 1)[1])
    coo = next(r for r in after["reviews"] if r["id"] == "coo-bottleneck-review")
    assert coo["enabled"] is True and coo["every_days"] == 1
    # The documented shape works too.
    body = {"reviews": {"cfo-cost-review": {"enabled": True, "every_days": 7}}, "enabled": {"cto": False}}
    await t["city_api"].handler({"method": "PUT", "path": "/executives", "body": body})
    assert (await turn(c)["save_change"].handler({"answer": "yes"})).startswith("Saved")


async def test_a_body_in_the_wrong_shape_is_a_plain_400_vaic_can_fix() -> None:
    _, api, _ = wired()
    r = await vaic_call({"method": "PUT", "path": "/executives", "body": {"enabled": True}}, api)
    assert r["statusCode"] == 400 and "ceo, coo, cfo and cto" in r["body"]
    r = await vaic_call({"method": "PUT", "path": "/executives", "body": {"reviews": "daily"}}, api)
    assert r["statusCode"] == 400 and "reviews takes" in r["body"]


async def test_an_executives_change_is_checked_when_staged_and_takes_everyday_words() -> None:
    # The owner, again on 2026-11-11: "Daily", Yes → "the save didn't go through". The change is now checked when
    # VAIC stages it, so a body the save would refuse never reaches the owner's Yes (decision 215).
    c, _, t = wired()
    bad = {"reviews": {"coo-bottleneck": {"enabled": True}}}
    out = await t["city_api"].handler({"method": "PUT", "path": "/executives", "body": bad})
    assert out.startswith("Not staged") and "coo-bottleneck-review" in out
    assert "Nothing is waiting" in await turn(c)["save_change"].handler({"answer": "yes"})
    # Words and strings VAIC may use, and the GET's own fields (title, last_run_at, other ids) are fine.
    got = json.loads((await t["city_api"].handler({"method": "GET", "path": "/executives"})).split(" ", 1)[1])
    body = {
        "executives": [*got["executives"], {"id": "chief-of-staff", "enabled": True}],
        "reviews": {"coo-bottleneck-review": {"enabled": "on", "every_days": "daily", "last_run_at": None}},
    }
    out = await t["city_api"].handler({"method": "PUT", "path": "/executives", "body": body})
    assert "Staged, NOT saved" in out and "COO bottleneck review: on, daily" in out, out
    assert (await turn(c)["save_change"].handler({"answer": "yes"})).startswith("Saved")
    after = json.loads((await t["city_api"].handler({"method": "GET", "path": "/executives"})).split(" ", 1)[1])
    coo = next(r for r in after["reviews"] if r["id"] == "coo-bottleneck-review")
    assert coo["enabled"] is True and coo["every_days"] == 1


# ---------- skills VAIC writes (decision 257) ----------
def draft(**kw: Any) -> dict[str, Any]:
    return {
        "name": "code-animation",
        "description": "Silent code-made videos for Media: 1 to 2 second intense scenes.",
        "instructions": "# Code animation\n\n1. Storyboard with Video production.\n2. Keep every scene 1 to 2 seconds.",
        **kw,
    }


def skills_wired() -> tuple[City, Any, dict[str, Any]]:
    from test_skills import FakeS3
    from vaic.lambdas.skills_api import SkillsApi

    c, api, t = wired()
    api.skills = SkillsApi(api.ledger, FakeS3(), "vaic-prod-skills")
    return c, api, t


async def test_a_drafted_skill_is_staged_with_its_files_and_previewed() -> None:
    c, api, t = skills_wired()
    bus: MemoryBus = c.bus  # type: ignore[assignment]
    out = await t["draft_skill"].handler(draft(roles=["worker"]))
    assert "Staged, NOT saved" in out and "Add this skill?" in out
    q = [e for e in bus.events if e["type"] == "vaic.question"][-1]
    assert q["options"] == ["Add", "Not now"] and q["title"] == "Add the skill code-animation"
    sk = q["skill"]
    assert sk["name"] == "code-animation" and sk["replacing"] is False and sk["files"] == []
    assert sk["markdown"].startswith('---\nname: "code-animation"\n') and "# Code animation" in sk["markdown"]
    assert await api.skills.ledger.table.get("SKILLS", "SKILL#code-animation") is None  # nothing saved yet
    out = await turn(c)["save_change"].handler({"answer": "yes"})
    assert out.startswith("Saved")
    row = await api.skills.ledger.table.get("SKILLS", "SKILL#code-animation")
    assert row and row["roles"] == ["worker"] and row["source"] == "upload"
    stored = api.skills.s3.objects[f"skills/code-animation/{row['version']}/SKILL.md"].decode()
    assert stored == sk["markdown"]  # Yes saves exactly what the owner read
    assert [e["saved"] for e in bus.events if e["type"] == "vaic.change"] == [True]


@pytest.mark.parametrize(
    ("kw", "why"),
    [
        ({"name": "Code Animation!"}, "lower-case"),
        ({"description": "   "}, "description"),
        ({"description": "x" * 1100}, "1,024"),
        ({"name": "catalog"}, "catalog"),
        ({"instructions": "y" * 50_000}, "at most 48,000"),
        ({"files": [{"path": "../evil.sh", "content": "rm"}]}, "relative path"),
        ({"files": [{"path": "hooks/x.json", "content": "{}"}]}, "refused"),
        ({"roles": ["janitor"]}, "Roles"),
    ],
)
async def test_a_draft_the_save_would_refuse_is_refused_at_staging(kw: dict[str, Any], why: str) -> None:
    c, _, t = skills_wired()
    out = await t["draft_skill"].handler(draft(**kw))
    assert out.startswith("Not staged") and why in out and "draft_skill again" in out
    assert "Nothing is waiting" in await turn(c)["save_change"].handler({"answer": "yes"})


async def test_no_discards_a_drafted_skill() -> None:
    c, api, t = skills_wired()
    await t["draft_skill"].handler(draft())
    assert (await turn(c)["save_change"].handler({"answer": "no"})).startswith("Discarded")
    assert await api.skills.ledger.table.get("SKILLS", "SKILL#code-animation") is None


async def test_a_redraft_replaces_the_shown_one_and_an_existing_skill_is_updated() -> None:
    c, api, t = skills_wired()
    bus: MemoryBus = c.bus  # type: ignore[assignment]
    await t["draft_skill"].handler(draft())
    await turn(c)["draft_skill"].handler(draft(instructions="# Code animation\n\nScenes of 1 second only."))
    await turn(c)["save_change"].handler({"answer": "yes"})
    row = await api.skills.ledger.table.get("SKILLS", "SKILL#code-animation")
    md = api.skills.s3.objects[f"skills/code-animation/{row['version']}/SKILL.md"].decode()
    assert "1 second only" in md and "Storyboard" not in md
    # Editing it: a new version under the same name, previewed as an update.
    await turn(c)["draft_skill"].handler(
        draft(
            instructions="# Code animation\n\nTwo seconds max.",
            files=[{"path": "examples/scene.md", "content": "a scene"}],
        )
    )
    q = [e for e in bus.events if e["type"] == "vaic.question"][-1]
    assert q["title"] == "Update the skill code-animation" and q["options"] == ["Save", "Not now"]
    assert q["skill"]["replacing"] is True and q["skill"]["files"] == ["examples/scene.md"]
    await turn(c)["save_change"].handler({"answer": "yes"})
    row = await api.skills.ledger.table.get("SKILLS", "SKILL#code-animation")
    assert [f["path"] for f in row["files"]] == ["SKILL.md", "examples/scene.md"]


async def test_city_api_post_skills_is_checked_the_same_way() -> None:
    _, _, t = skills_wired()
    out = await t["city_api"].handler({"method": "POST", "path": "/skills", "body": {"name": "code-animation"}})
    assert out.startswith("Not staged") and "files" in out


async def test_only_the_owner_drafts_skills() -> None:
    _, _, t = wired(from_owner=False)
    assert "Only the owner's own message" in await t["draft_skill"].handler(draft())
