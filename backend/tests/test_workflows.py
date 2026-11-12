"""AI workflows (decision 126): recognised in the owner's words, confirmed before anything runs, walked through
page by page or done by the team, missing inputs asked one at a time and never twice, the spend shown before the
owner's yes, and more workflows added as data. Fakes only: no AWS, no Bedrock, no Meta or Google call."""

from dataclasses import replace
from datetime import UTC, date, datetime
from typing import Any

import pytest

from test_apps import city_deps, ev, js, tool
from vaic.lambdas.api import ROUTES, ApiDeps, handle_http
from vaic.runtime.host import AgentHost, HostOptions
from vaic.runtime.prompts import load_prompt
from vaic.runtime.tools import TurnCtx
from vaic.shared import workflows as wf
from vaic.shared.connectors import ConnectorStore
from vaic.shared.events import parse_event
from vaic.shared.ledger import Ledger
from vaic.shared.table import MemoryTable

NOW = datetime(2026, 11, 9, 10, 0, tzinfo=UTC)  # a Monday
TODAY = NOW.date()
META = "meta-ads-campaign"


def deps() -> Any:
    return replace(city_deps(), ledger=Ledger(MemoryTable(), clock=lambda: NOW))


_MSG = iter(range(1, 10_000))


def vaic(conversation: str = "main", from_owner: bool = True, message_id: str | None = None) -> TurnCtx:
    """VAIC's turn on a new owner message each time (message ids m-1, m-2, …) unless one is given."""
    return TurnCtx(
        agent_id="vaic", role="vaic", department=None, ticket_id="", task_id="", conversation=conversation,
        from_owner=from_owner, message_id=message_id or f"m-{next(_MSG)}",
    )  # fmt: skip


async def connect(d: Any, key: str = "meta-ads", status: str = "ready") -> None:
    url = {"meta-ads": "https://mcp.pipeboard.co/meta-ads-mcp", "google-ads": "https://google-ads.mcp.pipeboard.co/"}
    await ConnectorStore(d.ledger.table).create({"id": key, "label": key, "url": url[key], "status": status})


async def live(d: Any, conversation: str = "main") -> dict[str, Any]:
    r = await wf.Runs(d.ledger.table, d.ledger.now).live_in(conversation)
    assert r
    return r


# ---------- the definitions are data, and every one is complete ----------
def test_every_workflow_in_the_config_is_complete() -> None:
    ws = wf.definitions()
    assert {w["id"] for w in ws} >= {META, "google-ads-campaign"}
    for w in ws:
        assert wf.check_definition(w) == [], w["id"]


def test_a_broken_definition_is_caught() -> None:
    bad = {**wf.definition(META), "steps": [{"id": "x", "title": "X", "guide": "{nope}", "do": "d", "inputs": ["y"]}]}  # type: ignore[dict-item]
    errs = wf.check_definition(bad)
    assert any("unknown input y" in e for e in errs) and any("{nope}" in e for e in errs)


def test_each_workflow_needs_a_connector_from_the_catalog() -> None:
    from vaic.shared.presets import catalog

    for w in wf.definitions():
        assert w["connector"] is None or w["connector"] in catalog(), w["id"]  # None: nothing outside the city


# ---------- recognising ----------
@pytest.mark.parametrize(
    ("words", "found", "direct"),
    [
        ("Let's create Meta ads", META, True),
        ("set up some facebook ads for the shop", META, True),
        ("I want an Instagram ad campaign", META, True),
        ("our facebook ads could use some love", META, False),
        ("let's run a google search campaign", "google-ads-campaign", True),
        ("youtube ads, maybe?", "google-ads-campaign", False),
    ],
)
def test_the_owners_words_point_at_a_workflow(words: str, found: str, direct: bool) -> None:
    (m,) = wf.recognise(words)
    assert (m["id"], m["direct"]) == (found, direct)


@pytest.mark.parametrize(
    "words", ["how are my meta ads doing?", "pause the facebook ads", "send me a report on google ads", "hello Vaic"]
)
def test_questions_reports_and_pausing_are_not_the_workflow(words: str) -> None:
    assert wf.recognise(words) == []


# ---------- reading answers the way the owner says them ----------
def test_three_hundred_is_three_hundred_per_day() -> None:
    inp = {i["key"]: i for i in wf.definition(META)["inputs"]}  # type: ignore[index]
    assert wf.parse_answer(inp["daily_budget"], "300", TODAY) == {
        "amount": 300,
        "currency": None,
        "text": "300 per day",
    }
    assert wf.parse_answer(inp["daily_budget"], "€2,100 a week", TODAY)["amount"] == 300
    assert wf.parse_answer(inp["daily_budget"], "1.5k kr", TODAY)["currency"] == "SEK"
    assert wf.parse_answer(inp["start_date"], "tomorrow", TODAY)["date"] == "2026-11-10"
    assert wf.parse_answer(inp["start_date"], "next monday", TODAY)["date"] == "2026-11-16"
    assert wf.parse_answer(inp["start_date"], "12 nov", TODAY)["date"] == "2026-11-12"
    assert wf.parse_answer(inp["end_date"], "keep running", TODAY)["open"] is True
    assert wf.parse_answer(inp["end_date"], "after 30 days", TODAY)["days"] == 30
    assert wf.parse_answer(inp["objective"], "leads please", TODAY)["text"] == "Leads"
    assert wf.parse_answer(inp["link"], "shop.example.com/offer.", TODAY)["url"] == "https://shop.example.com/offer"
    for key, said in (("daily_budget", "lots"), ("start_date", "whenever"), ("objective", "sales and leads"),
                      ("start_date", "2025-01-01"), ("link", "my site")):  # fmt: skip
        with pytest.raises(wf.Invalid):
            wf.parse_answer(inp[key], said, TODAY)


def test_what_the_owner_already_said_is_read_before_anything_is_asked() -> None:
    got = wf.extract(
        wf.definition(META),  # type: ignore[arg-type]
        "Let's create Meta ads for my shoe shop, 300 a day starting tomorrow for 2 weeks, aim for sales, "
        "landing page shoes.example.com",
        TODAY,
    )
    assert got["daily_budget"]["amount"] == 300
    assert got["start_date"]["date"] == "2026-11-10"
    assert got["end_date"]["days"] == 14
    assert got["objective"]["text"] == "Sales"
    assert got["link"]["url"] == "https://shoes.example.com"
    # A number without a budget word is not a budget; "for my shop" is not an end date.
    assert wf.extract(wf.definition(META), "meta ads for my 2 shops", TODAY) == {}  # type: ignore[arg-type]


def test_the_spend_shows_daily_total_and_dates() -> None:
    w = wf.definition(META)
    assert w
    inp = {i["key"]: i for i in w["inputs"]}
    v = {
        "daily_budget": wf.parse_answer(inp["daily_budget"], "300 EUR", TODAY),
        "start_date": wf.parse_answer(inp["start_date"], "tomorrow", TODAY),
        "end_date": wf.parse_answer(inp["end_date"], "for 14 days", TODAY),
    }
    s = wf.spend(w, v)
    assert s and (s["daily"], s["currency"], s["start"], s["end"], s["days"], s["total"]) == (
        300, "EUR", "2026-11-10", "2026-11-23", 14, 4200,
    )  # fmt: skip
    assert s["text"] == "300 EUR per day from Tue 10 Nov 2026 to Mon 23 Nov 2026: 4,200 EUR in all (14 days)"
    v["end_date"] = wf.parse_answer(inp["end_date"], "keep running", TODAY)
    open_ = wf.spend(w, v)
    assert open_ and open_["total"] is None and "about 9,000 EUR a month" in open_["text"]
    assert wf.spend(w, {}) is None


# ---------- VAIC's tools: confirm first, one question at a time, never twice ----------
async def test_nothing_starts_without_the_owners_yes_when_the_match_is_only_maybe() -> None:
    d = deps()
    start = tool(d, vaic(), "start_workflow")
    out = await start({"workflow_id": META, "owner_words": "our facebook ads could use some love"})
    assert "You mean the Meta Ads campaign workflow?" in out
    assert await wf.Runs(d.ledger.table).list() == []
    out = await start({"workflow_id": META, "owner_words": "yes", "owner_confirmed": True})
    assert "walk you through it" in out
    # Not on a turn that isn't the owner's own message (a report, a reminder), whatever VAIC claims.
    d2 = deps()
    out = await tool(d2, vaic(from_owner=False), "start_workflow")(
        {"workflow_id": META, "owner_words": "Let's create Meta ads", "owner_confirmed": True}
    )
    assert out.startswith("Not started") and await wf.Runs(d2.ledger.table).list() == []


async def test_direct_start_asks_only_whats_missing_one_at_a_time_and_never_twice() -> None:
    d = deps()
    await connect(d)
    out = await tool(d, vaic(), "start_workflow")(
        {
            "workflow_id": META,
            "owner_words": "Let's create Meta ads for my shoe shop, do it for me, starting tomorrow for 2 weeks",
            "values": {"offer": "Running shoes, 20% off"},
        }
    )
    run = await live(d)
    assert run["mode"] == "do"  # "do it for me" was in their words: not asked
    assert set(run["values"]) == {"offer", "start_date", "end_date"}
    assert "“What should the ads achieve: sales, leads, website visits or awareness?”" in out
    (q,) = d.bus.of_type("vaic.question")
    assert q["options"] == ["Sales", "Leads", "Website visits", "Awareness"]
    update = tool(d, vaic(), "update_workflow")
    asked: list[str] = []
    answers = {
        "objective": "Sales",
        "link": "shoes.example.com",
        "audience": "Runners in Stockholm, 25 to 45",
        "creative": "make them for me",
        "daily_budget": "300",
    }
    while (key := wf.next_need(await live(d), wf.definition(META), True).get("key")) is not None:  # type: ignore[arg-type]
        assert key not in asked, f"{key} asked twice"
        asked.append(key)
        out = await update({"values": {key: answers[key]}})
    assert asked == ["objective", "link", "audience", "creative", "daily_budget"]  # the inputs' order, gaps only
    assert "Create it?" in out and "300 per day from Tue 10 Nov 2026 to Mon 23 Nov 2026" in out
    assert "4,200 in all" in out
    run = await live(d)
    assert run["values"]["daily_budget"]["text"] == "300 per day"
    assert "__confirm__" in run["asked"]


async def test_an_answer_that_cant_be_read_is_explained_and_stays_missing() -> None:
    d = deps()
    await connect(d)
    await tool(d, vaic(), "start_workflow")({"workflow_id": META, "owner_words": "create meta ads", "mode": "do"})
    out = await tool(d, vaic(), "update_workflow")({"values": {"objective": "Sales", "daily_budget": "lots"}})
    assert out.startswith("Tell the owner: Daily budget: I need an amount")
    run = await live(d)
    assert "objective" in run["values"] and "daily_budget" not in run["values"]


async def test_do_mode_without_the_connector_says_which_one_and_where() -> None:
    d = deps()
    await connect(d, status="needs_auth")
    out = await tool(d, vaic(), "start_workflow")(
        {"workflow_id": META, "owner_words": "let's create Meta ads, do it for me"}
    )
    assert "Meta Ads isn't connected yet" in out
    assert "Settings → Departments & tools → Marketing" in out
    assert "nothing was created" in out
    (e,) = d.bus.of_type("workflow.updated")
    assert e["run"]["next"]["kind"] == "connect" and e["run"]["connector"]["connected"] is False
    # Walking through it by hand works without the connector.
    out = await tool(d, vaic(), "update_workflow")({"mode": "guide"})
    assert "page 1 of 6" in out


async def test_yes_to_the_money_hands_it_to_marketing_with_the_brief() -> None:
    d = deps()
    await connect(d)
    await tool(d, vaic(), "start_workflow")(
        {
            "workflow_id": META,
            "owner_words": "create meta ads for sales, do it for me, 300 a day from tomorrow, keep running",
            "values": {"offer": "Running shoes", "link": "shoes.example.com", "audience": "Runners in Sweden",
                       "creative": "make them for me"},
        }
    )  # fmt: skip
    go = tool(d, vaic(), "run_workflow")
    # Not in the same message the money was shown in: the owner must have seen it first.
    shown_in = (await live(d))["confirm_shown_in"]
    assert "Create it?" in await tool(d, vaic(message_id=shown_in), "run_workflow")({"confirm": True})
    assert not d.queue.sent
    # Not on VAIC's word alone: the turn must be the owner's own message.
    assert "Create it?" in await tool(d, vaic(from_owner=False), "run_workflow")({"confirm": True})
    assert not d.queue.sent
    out = await go({"confirm": True})
    assert out.startswith("Handed to the Marketing department as task ")
    (msg,) = d.queue.sent
    assert msg["role"] == "orchestrator" and "Marketing" in msg["body"] and "meta-ads" in msg["body"]
    (t,) = [t for t in await d.ledger.list_tickets(("open",)) if t.get("kind") == "task"]
    assert t["workflow_run"] == (await wf.Runs(d.ledger.table).list())[0]["id"]
    assert "Spend the owner approved" in t["brief"] and "300 per day from Tue 10 Nov 2026" in t["brief"]
    assert "OUTCOME_SALES" in t["brief"] and "https://shoes.example.com" in t["brief"]
    run = (await wf.Runs(d.ledger.table).list())[0]
    assert run["status"] == "running" and run["task_id"] == t["id"]
    assert await go({"confirm": True}) == "No workflow is waiting to be created here."
    assert len(d.queue.sent) == 1


async def test_the_walkthrough_goes_page_by_page_asking_each_pages_inputs() -> None:
    d = deps()
    out = await tool(d, vaic(), "start_workflow")(
        {"workflow_id": META, "owner_words": "create meta ads, walk me through it"}
    )
    assert "page 1 of 6, “Open Ads Manager”" in out
    step = tool(d, vaic(), "workflow_step")
    out = await step({"to": "next"})
    assert "What should the ads achieve" in out  # page 2 needs the goal
    out = await tool(d, vaic(), "update_workflow")({"values": {"objective": "leads", "offer": "Free trial"}})
    assert "page 2 of 6" in out and "Choose the objective Leads" in out and "Free trial - Leads" in out
    out = await step({"to": "back"})
    assert "page 1 of 6" in out
    run = await live(d)
    for _ in range(30):
        if run["status"] != "active":
            break
        need = wf.next_need(run, wf.definition(META), False)  # type: ignore[arg-type]
        if need["kind"] == "input":
            said = {"daily_budget": "50", "start_date": "today", "end_date": "after 7 days", "audience": "Sweden",
                    "link": "x.com", "creative": "my own"}[need["key"]]  # fmt: skip
            await tool(d, vaic(), "update_workflow")({"values": {need["key"]: said}})
        else:
            await step({"to": "next"})
        run = (await wf.Runs(d.ledger.table).list())[0]
    assert run["status"] == "done"
    assert not d.queue.sent  # a walkthrough never hands anything to the team


async def test_one_workflow_at_a_time_and_stop() -> None:
    d = deps()
    await tool(d, vaic(), "start_workflow")({"workflow_id": META, "owner_words": "create meta ads"})
    first = await live(d)
    await tool(d, vaic(), "start_workflow")({"workflow_id": "google-ads-campaign", "owner_words": "make google ads"})
    runs = await wf.Runs(d.ledger.table).list()
    assert {r["id"]: r["status"] for r in runs}[first["id"]] == "cancelled"
    assert await tool(d, vaic(), "cancel_workflow")({}) == "Stopped. Nothing was created."
    assert await wf.Runs(d.ledger.table).live_in("main") is None


async def test_list_workflows_says_whats_connected() -> None:
    d = deps()
    await connect(d)
    out = await tool(d, vaic(), "list_workflows")({})
    assert "Meta Ads campaign" in out and "connected)" in out
    assert "Google Ads campaign" in out and "not connected; Settings → Departments & tools → Marketing" in out


# ---------- what VAIC is told each turn ----------
async def test_aics_prompt_names_the_workflow_and_whats_already_known() -> None:
    d = deps()
    host = AgentHost(d, HostOptions(engine=None))  # type: ignore[arg-type]
    inv = {"role": "vaic", "kind": "task", "from": "owner", "conversation": "main"}
    maybe = await host._workflow_lines({**inv, "body": "our facebook ads need some love"})
    assert len(maybe) == 1 and "You mean the Meta Ads campaign workflow?" in maybe[0]
    direct = await host._workflow_lines({**inv, "body": "let's create Meta ads"})
    assert "Start it now with start_workflow" in direct[0] and "not connected yet" in direct[0]
    assert await host._workflow_lines({**inv, "body": "what's the weather?"}) == []
    assert await host._workflow_lines({**inv, "from": "orchestrator", "body": "let's create Meta ads"}) == []
    await tool(d, vaic(), "start_workflow")(
        {"workflow_id": META, "owner_words": "create meta ads, 300 a day, do it for me"}
    )
    (line,) = await host._workflow_lines({**inv, "body": "Sales"})
    assert "Workflow in progress: Meta Ads campaign" in line
    assert "never ask these again): Daily budget: 300 per day" in line


def test_aics_prompt_explains_workflows() -> None:
    p = load_prompt("vaic.md")
    for t in (
        "start_workflow",
        "update_workflow",
        "workflow_step",
        "run_workflow",
        "cancel_workflow",
        "list_workflows",
    ):
        assert t in p.tools
    for words in (
        "You mean the <name> workflow?",
        "One question at a time",
        'ask "Create it?"',
    ):
        assert words in p.body


# ---------- the HUD's routes ----------
def api_deps(d: Any) -> ApiDeps:
    return ApiDeps(ledger=d.ledger, bus=d.bus, queue=d.queue, settings=d.settings)


async def test_the_huds_routes_page_switch_mode_and_stop_but_never_spend() -> None:
    d = deps()
    a = api_deps(d)
    r = js(await handle_http(ev("GET", "/workflows"), a))
    assert {w["id"] for w in r["workflows"]} >= {META} and r["runs"] == []
    await tool(d, vaic(), "start_workflow")({"workflow_id": META, "owner_words": "create meta ads, walk me through it"})
    rid = (await live(d))["id"]
    (run,) = js(await handle_http(ev("GET", "/workflows"), a))["runs"]
    assert run["id"] == rid and run["mode"] == "guide" and run["step"] == 0 and len(run["steps"]) == 6
    assert run["next"]["kind"] == "step"
    run = js(await handle_http(ev("POST", f"/workflows/runs/{rid}/step", {"to": "next"}), a))["run"]
    assert run["step"] == 1 and run["steps"][0]["done"] is True and run["next"]["kind"] == "input"
    run = js(await handle_http(ev("POST", f"/workflows/runs/{rid}/mode", {"mode": "do"}), a))["run"]
    assert run["mode"] == "do" and run["next"]["kind"] == "connect"
    assert (await handle_http(ev("POST", f"/workflows/runs/{rid}/mode", {"mode": "fly"}), a))["statusCode"] == 400
    assert (await handle_http(ev("POST", f"/workflows/runs/{rid}/run"), a))["statusCode"] == 404
    assert (await handle_http(ev("GET", "/workflows/runs/wf-nope"), a))["statusCode"] == 404
    run = js(await handle_http(ev("POST", f"/workflows/runs/{rid}/cancel"), a))["run"]
    assert run["status"] == "cancelled"
    assert [e["run"]["status"] for e in d.bus.of_type("workflow.updated")][-1] == "cancelled"
    assert not d.queue.sent


async def test_a_running_run_is_done_when_its_task_is() -> None:
    d = deps()
    await connect(d)
    await tool(d, vaic(), "start_workflow")(
        {"workflow_id": META, "owner_words": "create meta ads for sales, do it for me, 300 a day from today, keep running",
         "values": {"offer": "Shoes", "link": "x.com", "audience": "Sweden", "creative": "make them for me"}}
    )  # fmt: skip
    await tool(d, vaic(), "run_workflow")({"confirm": True})
    run = (await wf.Runs(d.ledger.table).list())[0]
    await d.ledger.set_ticket_status(run["task_id"], "done")
    (shown,) = js(await handle_http(ev("GET", "/workflows"), api_deps(d)))["runs"]
    assert shown["status"] == "done"


def test_routes_are_owner_only_and_the_event_validates() -> None:
    for r in (("GET", "/workflows"), ("POST", "/workflows/runs/wf-1/step"), ("POST", "/workflows/runs/wf-1/cancel")):
        assert r in ROUTES
    assert parse_event({"type": "workflow.updated", "at": "x", "run": {"id": "wf-1"}})["run"] == {"id": "wf-1"}


def test_today_is_the_ledgers_day() -> None:
    assert wf.Runs(MemoryTable(), lambda: NOW).today() == date(2026, 11, 9)


async def test_the_money_shown_on_the_card_counts_as_shown() -> None:
    d = deps()
    await connect(d)
    await tool(d, vaic(), "start_workflow")(
        {"workflow_id": META, "owner_words": "create meta ads for sales, walk me through it, 300 a day from today, keep running",
         "values": {"offer": "Shoes", "link": "x.com", "audience": "Sweden", "creative": "make them for me"}}
    )  # fmt: skip
    rid = (await live(d))["id"]
    run = js(await handle_http(ev("POST", f"/workflows/runs/{rid}/mode", {"mode": "do"}), api_deps(d)))["run"]
    assert run["next"]["kind"] == "confirm" and "300 per day from Mon 9 Nov 2026" in run["spend"]["text"]
    out = await tool(d, vaic(), "run_workflow")({"confirm": True})  # the owner tapped "Yes, create it"
    assert out.startswith("Handed to the Marketing department")


# ---------- decision 127: apps are built while the owner is away; taste questions never block ----------
APP = "app-build"


@pytest.mark.parametrize(
    ("words", "found"),
    [
        ("build me an app where my family can share a shopping list", APP),
        ("make me a snake game", APP),
        ("make my snake game harder", None),
        ("the iphone app is slow", None),
        ("I have an idea for an app", None),  # no action word: "app" alone never asks "Is this what you mean"
        ("let's create Meta ads", META),
    ],
)
def test_app_build_is_recognised_only_when_asked_for(words: str, found: str | None) -> None:
    assert [m["id"] for m in wf.recognise(words)] == ([found] if found else [])


@pytest.mark.parametrize(
    ("words", "here"),
    [("build it, I'm here, ask me", True), ("you decide, I'm away", False), ("make a game", None)],
)
def test_the_owner_says_whether_they_are_here(words: str, here: bool | None) -> None:
    assert wf.presence_in(words) is here


async def test_an_app_is_built_to_the_end_while_the_owner_is_away() -> None:
    d = deps()
    words = "Build me an app where my family can share a shopping list"
    out = await tool(d, vaic(), "start_workflow")({"workflow_id": APP, "owner_words": words})
    assert "Handed to the Application department as task" in out and "will finish it on its own" in out
    assert "what you went with for must-have parts, look, paid or private" in out  # "my family" was said
    assert not d.bus.of_type("vaic.question")  # nothing was asked
    (msg,) = d.queue.sent
    assert "Application department" in msg["body"] and "without waiting for them" in msg["body"]
    (t,) = [t for t in await d.ledger.list_tickets(("open",)) if t.get("kind") == "task"]
    assert words in t["brief"] and "The owner is away" in t["brief"] and "ask_taste" in t["brief"]
    assert "Look: Clean and light (assumed)" in t["brief"] and "how one page should behave" in t["brief"]
    run = (await wf.Runs(d.ledger.table).list())[0]
    assert run["status"] == "running" and run["mode"] == "do" and run["present"] is False
    qs = await wf.Taste(d.ledger.table).all(open_only=True)
    assert {q["default"] for q in qs} == {"The smallest version that does the idea well", "Clean and light",
                                          "Nothing paid or private"}  # fmt: skip
    assert "Who uses it: Family or team\n" in t["brief"]
    assert all(q["run_id"] == run["id"] and q["task_id"] == t["id"] and q["asked_by"] == "vaic" for q in qs)
    (e,) = d.bus.of_type("workflow.updated")
    assert len(e["run"]["taste"]) == 3 and e["run"]["inputs"][2]["assumed"] is True


async def test_when_the_owner_is_here_the_app_is_planned_with_them_first() -> None:
    d = deps()
    out = await tool(d, vaic(), "start_workflow")(
        {"workflow_id": APP, "owner_words": "create a website for my bakery, I'm here, ask me"}
    )
    assert "Who will use it" in out and not d.queue.sent  # the idea came from their words: never asked
    update = tool(d, vaic(), "update_workflow")
    await update({"values": {"users": "my customers"}})
    await update({"values": {"must_have": "menu, opening hours, order form"}})
    await update({"values": {"look": "playful"}})
    out = await update({"values": {"paid_private": "Nothing paid or private"}})
    assert "Build it?" in out and not d.queue.sent
    out = await tool(d, vaic(), "run_workflow")({"confirm": True})
    assert out.startswith("Handed to the Application department") and len(d.queue.sent) == 1
    assert await wf.Taste(d.ledger.table).all() == []  # nothing assumed, nothing to ask later


async def test_saying_im_off_mid_way_lets_the_team_start() -> None:
    d = deps()
    await tool(d, vaic(), "start_workflow")(
        {"workflow_id": APP, "owner_words": "make me a habit tracker", "present": True}
    )
    assert not d.queue.sent
    out = await tool(d, vaic(), "update_workflow")({"present": False})
    assert "Handed to the Application department" in out and len(d.queue.sent) == 1


async def test_ads_are_never_assumed_away_their_money_is_always_asked() -> None:
    d = deps()
    await connect(d)
    out = await tool(d, vaic(), "start_workflow")(
        {"workflow_id": META, "owner_words": "create meta ads, do it for me, you decide, I'm away"}
    )
    assert "Handed" not in out and not d.queue.sent
    run = await live(d)
    assert "daily_budget" not in run["values"]


async def a_running_app(d: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    await tool(d, vaic(), "start_workflow")({"workflow_id": APP, "owner_words": "make me a snake game"})
    (t,) = [t for t in await d.ledger.list_tickets(("open",)) if t.get("kind") == "task"]
    await d.ledger.create_ticket({"id": "t-dept", "goal": "g", "from": "orchestrator", "to": "mgr-apps",
                                  "department": "Apps", "parent_id": t["id"], "kind": "assignment"})  # fmt: skip
    await d.ledger.create_ticket({"id": "t-wkr", "goal": "g", "from": "mgr-apps", "to": "wkr-1", "department": "Apps",
                                  "parent_id": "t-dept", "kind": "assignment"})  # fmt: skip
    await d.ledger.put_agent({"id": "wkr-1", "kind": "worker", "role": "Game developer", "department": "Apps",
                              "model": "opus-5-5", "parent": "mgr-apps", "state": "active", "worker_state": "working",
                              "ticket_id": "t-wkr", "total_cost_usd": 0, "hired_at": "2026-11-09T10:00:00Z"})  # fmt: skip
    return t, (await wf.Runs(d.ledger.table).list())[0]


def worker(task_id: str) -> TurnCtx:
    return TurnCtx(agent_id="wkr-1", role="worker", department="Apps", ticket_id="t-wkr", task_id=task_id)


async def test_the_team_asks_taste_questions_and_goes_on_with_its_default() -> None:
    d = deps()
    t, run = await a_running_app(d)
    sent = len(d.queue.sent)
    out = await tool(d, worker(t["id"]), "ask_taste")(
        {
            "question": "Do you like walls that wrap around?",
            "options": ["Wrap around", "Walls end the game"],
            "default": "Walls end the game",
        }
    )
    assert "Don't wait: go on with “Walls end the game” now" in out
    assert len(d.queue.sent) == sent  # nobody is woken, nothing waits
    q = next(q for q in await wf.Taste(d.ledger.table).all() if q["asked_by"] == "wkr-1")
    assert q["run_id"] == run["id"] and q["task_id"] == t["id"] and q["status"] == "open"
    assert "at least 2" in await tool(d, worker(t["id"]), "ask_taste")(
        {"question": "Colour?", "options": ["Red"], "default": "Red"}
    )
    with pytest.raises(wf.Invalid):
        await wf.Taste(d.ledger.table).add({"question": "Colour?", "options": ["Red", "Blue"], "default": ""})


async def test_an_answer_that_differs_reaches_whoever_can_still_change_it() -> None:
    d = deps()
    t, _ = await a_running_app(d)
    await tool(d, worker(t["id"]), "ask_taste")(
        {"question": "Walls?", "options": ["Wrap around", "Walls end the game"], "default": "Walls end the game"}
    )
    qs = {q["question"]: q for q in await wf.Taste(d.ledger.table).all()}
    answer = tool(d, vaic(), "answer_taste")
    assert "Only the owner" in await tool(d, vaic(from_owner=False), "answer_taste")(
        {"id": qs["Walls?"]["id"], "answer": "wrap around"}
    )
    sent = len(d.queue.sent)
    out = await answer({"id": qs["Walls?"]["id"], "answer": "wrap around"})
    assert out == "Sent to wkr-1: they change it to “Wrap around”."
    (msg,) = d.queue.sent[sent:]
    assert msg["agentId"] == "wkr-1" and msg["kind"] == "instruction" and "“Wrap around”" in msg["body"]
    assert "already answered" in await answer({"id": qs["Walls?"]["id"], "answer": "no"})
    # Same as the default: kept, nobody disturbed.
    look = next(q for q in qs.values() if q["default"] == "Clean and light")
    assert (await answer({"id": look["id"], "answer": "clean and light"})).startswith("Kept")
    assert len(d.queue.sent) == sent + 1
    # VAIC's own assumption goes to the Orchestrator, who passes it on.
    users = next(q for q in qs.values() if q["default"] == "Just me")
    assert (
        await answer({"id": users["id"], "answer": "My customers"})
    ) == "Sent to the team: they change it to “My customers”."
    assert d.queue.sent[-1]["role"] == "orchestrator" and d.queue.sent[-1]["taskId"] == t["id"]
    # After the job: noted, and VAIC offers a change.
    await d.ledger.set_ticket_status(t["id"], "done")
    must = next(q for q in qs.values() if q["default"].startswith("The smallest"))
    assert "the job has finished" in await answer({"id": must["id"], "answer": "add a high score table"})


async def test_the_card_answers_taste_questions_and_vaic_is_told_about_open_ones() -> None:
    d = deps()
    _t, _run = await a_running_app(d)
    a = api_deps(d)
    open_ = js(await handle_http(ev("GET", "/workflows/taste"), a))["taste"]
    assert len(open_) == 4
    (shown,) = js(await handle_http(ev("GET", "/workflows"), a))["runs"]
    assert len(shown["taste"]) == 4 and shown["status"] == "running"
    look = next(q for q in open_ if q["default"] == "Clean and light")
    r = await handle_http(ev("POST", f"/workflows/taste/{look['id']}", {"answer": "Dark and sleek"}), a)
    assert r["statusCode"] == 200 and "Dark and sleek" in js(r)["result"]
    assert (await handle_http(ev("POST", f"/workflows/taste/{look['id']}", {"answer": "x"}), a))["statusCode"] == 409
    host = AgentHost(d, HostOptions(engine=None))  # type: ignore[arg-type]
    inv = {"role": "vaic", "kind": "task", "from": "owner", "conversation": "main", "body": "hi Vaic"}
    (line, progress) = await host._workflow_lines(inv)
    assert line.startswith("Taste questions from the work in progress") and "answer_taste" in line
    assert "Dark and sleek" not in line and "Just me" in line
    assert "The team is doing it as task" in progress
    # In an existing app's own chat, "make…" changes that app: no App build match.
    assert not [x for x in await host._workflow_lines({**inv, "conversation": "app-app-snake", "body": "make a game"})
                if x.startswith("Workflow:")]  # fmt: skip


def test_the_team_and_vaic_are_told_about_taste_questions() -> None:
    assert "ask_taste" in load_prompt("worker.md", {"id": "w", "specialty": "s", "parent": "p"}).body
    assert "ask_taste" in load_prompt("manager.md", {"department": "Apps"}).body
    p = load_prompt("vaic.md")
    assert "answer_taste" in p.tools and "The owner is usually away" in p.body and "never waited on" in p.body


# ---------- decision 132: organic content, made by Media and published with no money spent ----------
ORGANIC = "organic-content"


@pytest.mark.parametrize(
    ("words", "found"),
    [
        ("make a tiktok about our new summer menu", ORGANIC),
        ("create a reel showing our product in action", ORGANIC),
        ("post a youtube short about the launch", ORGANIC),
        ("boost our latest reel with a paid campaign", None),  # money: the ads workflows, never this one
        ("how did my last reel do", None),
        ("make me a snake game", APP),
    ],
)
def test_organic_content_is_recognised_only_when_asked_for_and_never_for_ads(words: str, found: str | None) -> None:
    assert [m["id"] for m in wf.recognise(words)] == ([found] if found else [])


async def test_organic_content_is_made_and_published_by_media_while_the_owner_is_away() -> None:
    d = deps()
    words = "Make a TikTok about our new summer menu, bold and energetic"
    out = await tool(d, vaic(), "start_workflow")({"workflow_id": ORGANIC, "owner_words": words})
    assert "Handed to the Media department as task" in out
    assert not d.bus.of_type("vaic.question")
    (t,) = [t for t in await d.ledger.list_tickets(("open",)) if t.get("kind") == "task"]
    brief = t["brief"]
    assert "Format: A short video\n" in brief and "Tone: Bold and energetic\n" in brief
    assert "Where: YouTube, TikTok and Instagram (assumed)" in brief
    for tool_name in ("Canva", "Higgsfield", "EveryGen", "ElevenLabs", "draw.io", "Metricool"):
        assert tool_name in brief
    assert "Never boost, promote or spend" in brief and "official API" in brief
    assert not wf.spend(next(w for w in wf.definitions() if w["id"] == ORGANIC), {})  # nothing is ever spent
