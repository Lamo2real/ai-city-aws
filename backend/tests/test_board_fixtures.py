"""The events a small app change and a medium build really send to the HUD (decision 289), recorded from the
in-process city, so the Playwright specs replay exactly what the backend emits (``web/e2e/fixtures/board-*.json``).

``VAIC_WRITE_FIXTURES=1 uv run pytest tests/test_board_fixtures.py`` rewrites them; otherwise this checks that the
saved streams still have the event types and ticket fields the backend sends now.
"""

# ruff: noqa: ASYNC240 (test workers write their files like a real worker does)
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import pytest

from city_support import Call, City, make_city, scripted_engine
from test_hierarchy_e2e import make_manager
from vaic.runtime import tools as tools_mod
from vaic.runtime.engine import EngineRequest
from vaic.shared.apps import APPS_PK, drafts_of_ticket, put_draft
from vaic.shared.ledger import ALL_STATUSES
from vaic.shared.utility import Triage

APP_ID = "app-0000000000aa"
CONV = f"app-{APP_ID}"
NEW_CONV = "app-new-mem0001"
FIXTURES = Path(__file__).resolve().parents[2] / "web" / "e2e" / "fixtures"
INDEX = '<!doctype html><title>Star Sweeper</title><script src="game.js"></script><button>Sweep</button>'


@pytest.fixture(autouse=True)
def triage_application(monkeypatch: pytest.MonkeyPatch) -> None:
    async def triage(*_: Any, **__: Any) -> Triage:
        return Triage("department", "Application", "test")

    monkeypatch.setattr(tools_mod, "triage", triage)


async def builder(req: EngineRequest, call: Call) -> str:
    """A worker that changes the app the way a real one does: steps, a live preview, a staged draft, a report."""
    assert req.cwd
    d = req.ledger
    me, part, task = req.ctx.agent_id, req.ctx.ticket_id, req.ctx.task_id
    app = Path(req.cwd, "app")
    app.mkdir(parents=True, exist_ok=True)
    (app / "index.html").write_text(INDEX)
    (app / "game.js").write_text("const PAIRS = 4;\n")
    events = req_bus(req)
    for activity, detail in (("coding", "Loaded the app: Star Sweeper"), ("coding", "Edited app/game.js")):
        await events.put({"type": "activity", "id": me, "activity": activity, "detail": detail})
    await events.put(
        {
            "type": "app.preview",
            "task_id": task,
            "hire_id": me,
            "preview_url": "https://apps.vaic.test/drafts/prv-0123456789abcdef0123456789abcdef/index.html",
            "seq": 1,
            "paths": ["game.js"],
            "hints": [{"path": "game.js", "agent": me, "label": "game.js"}],
        }
    )
    if not await drafts_of_ticket(d, part):
        draft = {
            "draft_id": f"d-{part}",
            "hire_id": me,
            "ticket_id": part,
            "task_id": task,
            "department": "Application",
            "title": "Star Sweeper",
            "description": "Sweep the stars.",
            "status": "ready",
            "reason": None,
            "preview_url": "https://apps.vaic.test/drafts/d-1/",
            "capabilities": [],
            "pin": False,
            "replaces": APP_ID,
            "created_at": "2026-11-06T09:00:00.000Z",
        }
        await put_draft(d, draft)
        await events.put(
            {
                "type": "app.draft",
                "draft_id": draft["draft_id"],
                "ticket_id": part,
                "task_id": task,
                "department": "Application",
                "title": "Star Sweeper",
                "status": "ready",
                "preview_url": draft["preview_url"],
            }
        )
    return await call("report_to_manager", {"summary": "The game now has 4 pairs.", "artifacts": [], "checks": "-"})


_BUS: dict[str, Any] = {}


def req_bus(_: EngineRequest) -> Any:
    return _BUS["bus"]


async def vaic(req: EngineRequest, call: Call) -> str:
    if "(task) from owner" in req.turn.prompt:
        words = req.ctx.owner_text
        return await call("delegate_to_orchestrator", {"goal": words, "owner_words": words, "confirm": True})
    return "Done, Sir: the game has 4 pairs now. The new version is waiting for your OK in Needs you."


async def orchestrator(req: EngineRequest, call: Call) -> str:
    if "(task) from vaic" in req.turn.prompt:
        await call(
            "assign_to_department",
            {"department": "Application", "goal": "Do it", "acceptance": "Done as the owner asked"},
        )
        return "Sent."
    await call("sign_off", {"verdict": "PASS", "reasons": "Meets the ask."})
    await call("report_to_vaic", {"summary": "The game has 4 pairs."})
    return "PASS"


async def city_for(board_sizes: list[str] | None = None) -> City:
    settings = {} if board_sizes is None else {"board_sizes": board_sizes}
    city = make_city(
        scripted_engine({"vaic": vaic, "orchestrator": orchestrator, "manager": make_manager(), "worker": builder}),
        **settings,
    )
    _BUS["bus"] = city.bus
    city.deps.utility_runner = object()
    await city.ledger.create_department("Application", "Build the owner's apps.", "mgr-application")
    await city.ledger.table.put(
        {
            "pk": APPS_PK,
            "sk": f"APP#{APP_ID}",
            "app_id": APP_ID,
            "slug": "star-sweeper",
            "title": "Star Sweeper",
            "version": 1,
            "department": "Application",
            "published_at": "2026-11-01T00:00:00Z",
        }
    )
    return city


def _plain(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The stream as the HUD gets it, minus the time each was sent (the replay stamps its own)."""
    keep = []
    for e in events:
        if e["type"] in ("cost.update", "build.stage"):
            continue
        keep.append({k: v for k, v in e.items() if k != "at"})
    return keep


async def record(
    name: str, words: str, conversation: str, board_sizes: list[str] | None = None
) -> list[dict[str, Any]]:
    city = await city_for(board_sizes)
    await city.owner_says(words, conversation)
    await city.run()
    task = next(t for t in await city.ledger.list_tickets(ALL_STATUSES) if t["from"] == "vaic")
    assert task["status"] == "done", (name, task)
    return _plain(city.bus.events)


def _shape(events: list[dict[str, Any]]) -> list[str]:
    out = []
    for e in events:
        tk = e.get("ticket") or {}
        out.append(f"{e['type']}:{tk.get('kind', '')}:{tk.get('status', '')}:{e.get('state', '')}")
    return out


CASES = {
    "board-small": ("change the memory game to 4 pairs", CONV, None),
    "chain-small": ("change the memory game to 4 pairs", CONV, []),
    "board-medium": ("build me a memory game with animals", NEW_CONV, None),
}


@pytest.mark.parametrize("name", list(CASES))
async def test_the_saved_event_streams_match_what_the_backend_sends(name: str) -> None:
    words, conv, sizes = CASES[name]
    events = await record(name, words, conv, sizes)
    path = FIXTURES / f"{name}.json"
    text = json.dumps(events, indent=1)
    if os.environ.get("VAIC_WRITE_FIXTURES") == "1":
        path.write_text(text + "\n")
    saved = json.loads(path.read_text())
    assert _shape(saved) == _shape(events), f"{path.name} is stale: run with VAIC_WRITE_FIXTURES=1"
    assert not re.search(
        r"\b(wkr|mgr)-[a-z-]+-[0-9a-f]{12}\b", " ".join(e.get("text", "") for e in saved if e["type"] == "vaic.reply")
    )
    if name == "board-small":
        assert not any(
            e["type"] == "ticket.status"
            and e["ticket"]["to"] == "orchestrator"
            and e["ticket"].get("kind") == "assignment"
            for e in saved
        )
        hires = [e["agent"] for e in saved if e["type"] == "agent.hired" and e["agent"]["kind"] == "worker"]
        assert [(h["department"], h["model"]) for h in hires] == [("Application", "sonnet-5-5")]
