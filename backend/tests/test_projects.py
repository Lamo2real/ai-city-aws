"""The Projects studio (docs/APPS.md § Projects): AIC agrees the plan before it builds, the agreed brief travels
with the build, new-project chats are linked to the app they became, tappable choices, and an app's activity
in plain words. Fakes only: no AWS, no Bedrock."""

import re

from aic.lambdas.api import ROUTES, handle_http
from aic.runtime.prompts import load_prompt
from aic.runtime.tools import TurnCtx, app_of_conversation, task_brief
from aic.shared.app_activity import MAX_ITEMS, plain
from aic.shared.apps import get_app, publish_draft
from aic.shared.events import parse_event
from test_apps import GAME, FakeS3, api, city_deps, draft, ev, js, origin, tool
from test_apps_v3 import an_app

BRIEF = "For the owner's family. Screens: a shopping list and a done list. Tap an item to tick it. Calm green look."


def ace(conversation: str) -> TurnCtx:
    return TurnCtx(agent_id="ace", role="ace", department=None, ticket_id="", task_id="", conversation=conversation)


# ---------- AIC asks before it builds ----------
def test_aics_prompt_asks_unclear_requests_first_and_builds_clear_ones_straight_away() -> None:
    p = load_prompt("ace.md")
    assert "offer_choices" in p.tools
    for words in (
        "Shall I build it?",
        "at most three per message",
        "don't ask anything",
        "brief",
        "never more than four",
    ):
        assert words in p.body, words


def test_the_brief_reaches_the_planner_managers_and_builders_prompts() -> None:
    assert "agreed brief" in load_prompt("orchestrator.md").body
    assert "agreed brief" in load_prompt("manager.md", {"department": "Apps"}).body


def test_project_conversations_name_their_app() -> None:
    assert app_of_conversation("app-app-snake") == "app-snake"
    assert app_of_conversation("app-new-3f2a") is None
    assert app_of_conversation("main") is None
    assert app_of_conversation(None) is None


async def test_the_agreed_brief_travels_with_the_build() -> None:
    d = city_deps()
    out = await tool(d, ace("app-new-1"), "delegate_to_orchestrator")(
        {
            "goal": "Build a family shopping list app",
            "owner_words": "make us a shopping list",
            "brief": BRIEF,
            "confirm": True,
        }
    )
    assert out.startswith("Handed to the Orchestrator")
    (t,) = [t for t in await d.ledger.list_tickets(("open",)) if t.get("kind") == "task"]
    assert t["brief"] == BRIEF and t["conversation"] == "app-new-1" and "app_id" not in t
    (msg,) = d.queue.sent  # type: ignore[attr-defined]
    assert BRIEF in msg["body"] and "nothing more" in msg["body"]
    # The departments' part and the builder's part find it through their parents.
    await d.ledger.create_ticket({"id": "t-dept", "goal": "g", "from": "orchestrator", "to": "mgr", "department": "Apps",
                                  "parent_id": t["id"], "kind": "assignment"})  # fmt: skip
    await d.ledger.create_ticket({"id": "t-wkr", "goal": "g", "from": "mgr", "to": "wkr-1", "department": "Apps",
                                  "parent_id": "t-dept", "kind": "assignment"})  # fmt: skip
    assert await task_brief(d, "t-wkr") == BRIEF
    assert await task_brief(d, "nope") is None


async def test_in_an_apps_own_chat_a_change_goes_to_that_app() -> None:
    d = city_deps()
    await an_app(d)
    await tool(d, ace("app-app-snake"), "delegate_to_orchestrator")(
        {"goal": "make snake harder", "owner_words": "harder please", "confirm": True}
    )
    (t,) = [t for t in await d.ledger.list_tickets(("open",)) if t.get("kind") == "task"]
    assert t["app_id"] == "app-snake"


async def test_offer_choices_puts_tappable_options_on_the_bus() -> None:
    d = city_deps()
    offer = tool(d, ace("app-new-1"), "offer_choices")
    out = await offer({"question": "Who will use it?", "options": ["Just me", " My family ", "My customers"]})
    assert "Ask the question" in out
    (e,) = d.bus.of_type("ace.question")  # type: ignore[attr-defined]
    assert e["conversation"] == "app-new-1" and e["question"] == "Who will use it?"
    assert e["options"] == ["Just me", "My family", "My customers"]
    assert "at least" in await offer({"question": "Who?", "options": ["Only one"]})
    assert len(d.bus.of_type("ace.question")) == 1  # type: ignore[attr-defined]
    assert parse_event({"type": "ace.question", "at": "x", "conversation": "c", "question": "q", "options": ["a"]})


# ---------- a new project's chat goes on as the app's chat ----------
async def test_an_app_built_from_a_new_project_chat_is_linked_to_it() -> None:
    s3 = FakeS3()
    d = api(s3)
    await d.ledger.create_ticket({"id": "t-task", "goal": "shopping list", "from": "ace", "to": "orchestrator",
                                  "department": None, "parent_id": None, "conversation": "app-new-1",
                                  "brief": BRIEF})  # fmt: skip
    await draft(d.ledger, "drf-1", "t-task", "awaiting_owner")
    for p, b in GAME.items():
        s3.put("aic-prod-apps", f"drafts/drf-1/{p}", b)
    app = await publish_draft(d.ledger, d.bus, origin(s3), "drf-1")
    assert app["conversation"] == "app-new-1" and app["brief"] == BRIEF
    (e,) = d.bus.of_type("app.published")  # type: ignore[attr-defined]
    assert e["conversation"] == "app-new-1"
    assert (await get_app(d.ledger, app["app_id"]) or {})["conversation"] == "app-new-1"


async def test_an_app_from_an_ordinary_chat_has_no_project_link() -> None:
    s3 = FakeS3()
    d = api(s3)
    await d.ledger.create_ticket({"id": "t-task", "goal": "g", "from": "ace", "to": "orchestrator",
                                  "department": None, "parent_id": None, "conversation": "main"})  # fmt: skip
    await draft(d.ledger, "drf-1", "t-task", "awaiting_owner")
    for p, b in GAME.items():
        s3.put("aic-prod-apps", f"drafts/drf-1/{p}", b)
    app = await publish_draft(d.ledger, d.bus, origin(s3), "drf-1")
    assert "conversation" not in app
    assert "conversation" not in d.bus.of_type("app.published")[0]  # type: ignore[attr-defined]


async def test_aic_in_an_apps_chat_knows_the_app_and_what_was_said_before_it_existed() -> None:
    from city_support import make_city, scripted_engine

    city = make_city(scripted_engine({}))
    await an_app(city.deps)
    from aic.shared.table import UpdateOptions

    await city.ledger.table.update(
        "APPS", "APP#app-snake", UpdateOptions(set={"conversation": "app-new-1", "brief": "Snake for the kids."})
    )
    await city.ledger.add_conversation_line("app-new-1", "owner", "make a snake game for the kids")
    await city.ledger.add_conversation_line("app-new-1", "ace", "Shall I build it?")
    me = {"id": "ace", "kind": "ace", "role": "ace"}
    inv = {"role": "ace", "kind": "task", "from": "owner", "body": "make it harder", "ticketId": "c", "taskId": "c",
           "conversation": "app-app-snake"}  # fmt: skip
    text = await city.host._prompt(me, inv)
    assert "app “Snake” (app_id app-snake, version 1)" in text
    assert "Snake for the kids." in text and "make a snake game for the kids" in text
    fresh = await city.host._prompt(me, {**inv, "conversation": "app-new-2"})
    assert "new project in the owner's Apps studio" in fresh


# ---------- GET /apps/<id>/activity ----------
def test_activity_words_hide_ids_links_and_code() -> None:
    s = plain("Fix wkr-apps-0123 on ticket t-9a8b7c `rm -rf x` see https://x.example/y (drf-12)")
    assert not re.search(r"wkr-|t-9|drf-|https|`|rm -rf", s)
    assert "job" in s
    assert len(plain("x" * 500)) <= 220


async def test_the_activity_tells_an_apps_story_in_plain_words_newest_last() -> None:
    s3 = FakeS3()
    d = api(s3)
    led = d.ledger
    await led.create_ticket({"id": "t-task", "goal": "Build the shopping list (app-x)", "from": "ace",
                             "to": "orchestrator", "department": None, "parent_id": None,
                             "conversation": "app-new-1"})  # fmt: skip
    await led.create_ticket({"id": "t-dept", "goal": "Shopping list app", "from": "orchestrator",
                             "to": "mgr-apps", "department": "Apps", "parent_id": "t-task",
                             "kind": "assignment"})  # fmt: skip
    await led.create_ticket({"id": "t-wkr", "goal": "Build `app/index.html`", "from": "mgr-apps",
                             "to": "wkr-apps-1", "department": "Apps", "parent_id": "t-dept",
                             "kind": "assignment"})  # fmt: skip
    await led.create_ticket({"id": "t-other", "goal": "Unrelated research", "from": "ace", "to": "orchestrator",
                             "department": None, "parent_id": None})  # fmt: skip
    await led.set_ticket_status("t-wkr", "in_progress")
    await led.set_ticket_status("t-wkr", "in_review")
    await led.append_event("t-wkr", {"type": "review.result", "ticket_id": "t-wkr", "agent": "wkr-apps-1",
                                     "reviewer": "mgr-apps", "verdict": "FAIL", "round": 1,
                                     "summary": "The tick button does nothing on t-wkr", "at": "2026-11-08T23:59:00.000Z"})  # fmt: skip
    await draft(led, "drf-1", "t-task", "awaiting_owner", "Shopping List")
    for p, b in GAME.items():
        s3.put("aic-prod-apps", f"drafts/drf-1/{p}", b)
    await led.request_approval({"agent": "orchestrator", "ticket_id": "t-task", "tool": "app.publish",
                                "action": "Publish the app “Shopping List” under Apps", "hash": "h",
                                "reason": "r", "kind": "app.publish", "draft_id": "drf-1"})  # fmt: skip
    app = await publish_draft(led, d.bus, origin(s3), "drf-1")
    await led.request_approval({"agent": f"app:{app['app_id']}", "ticket_id": None, "tool": "calendar.create",
                                "action": "a", "hash": "h2", "reason": "r", "kind": "mail.proposal",
                                "requested_by": f"app:{app['app_id']}"})  # fmt: skip

    r = await handle_http(ev("GET", f"/apps/{app['app_id']}/activity"), d)
    assert r["statusCode"] == 200
    items = js(r)["items"]
    assert all(set(i) == {"at", "who", "text"} for i in items)
    assert [i["at"] for i in items] == sorted(i["at"] for i in items)
    texts = " | ".join(f"{i['who']}: {i['text']}" for i in items)
    for line in (
        "AIC: Passed your request to the team: Build the shopping list",
        "Planner: Asked the Apps team: Shopping list app",
        "Manager: Gave a builder the work: Build",
        "Builder: Started working.",
        "Builder: Finished a version and sent it for a check.",
        "Reviewer: Asked for changes: The tick button does nothing on",
        "AIC: Asked you to approve: Publish the app “Shopping List” under Apps.",
        "AIC: Version 1 went live.",
        "App: Asked to add an event to your calendar. It is waiting for you in Needs you.",
    ):
        assert line in texts, line
    assert "Unrelated" not in texts
    assert not re.search(r"\b(t|wkr|mgr|app|drf)-[\w-]+|`|https?:", texts), texts


async def test_the_activity_keeps_the_newest_hundred_and_404s_an_unknown_app() -> None:
    d = api(FakeS3())
    await an_app(d)
    from aic.shared.table import UpdateOptions

    await d.ledger.table.update("APPS", "APP#app-snake", UpdateOptions(set={"task_id": "t-task"}))
    await d.ledger.create_ticket({"id": "t-task", "goal": "g", "from": "ace", "to": "orchestrator",
                                  "department": None, "parent_id": None})  # fmt: skip
    for i in range(MAX_ITEMS + 20):
        await d.ledger.append_event("t-task", {"type": "instruction", "text": f"note {i}", "ticket_id": "t-task",
                                               "at": f"2099-11-08T10:{i // 60:02d}:{i % 60:02d}.000Z"})  # fmt: skip
    items = js(await handle_http(ev("GET", "/apps/app-snake/activity"), d))["items"]
    assert len(items) == MAX_ITEMS
    assert items[-1]["text"] == f"Told the team: note {MAX_ITEMS + 19}"
    assert (await handle_http(ev("GET", "/apps/app-nope/activity"), d))["statusCode"] == 404


def test_the_activity_route_is_listed() -> None:
    assert ("GET", "/apps/app-1/activity") in ROUTES
