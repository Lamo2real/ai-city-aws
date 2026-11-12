"""The live working copy of an app while workers build it (decision 278): the worker-side sync, the apps Lambda's
staging, and that a preview is owner-only data that never becomes a draft, a version or a published app."""

import asyncio
import re
from pathlib import Path
from typing import Any

import pytest

from test_apps import HIRE, URL, FakeS3, origin
from vaic.lambdas.apps import on_submitted
from vaic.shared.app_preview import LIVE, LivePreview, selector_for, stage_preview
from vaic.shared.apps import BRIDGE, DRAFTS_PK, list_apps, list_drafts
from vaic.shared.events import MemoryBus, parse_event
from vaic.shared.ledger import Ledger
from vaic.shared.table import MemoryTable

PAGE = b"<!doctype html><html><body><canvas id=board></canvas><script src=game.js></script></body></html>"


def live(tmp_path: Path, bus: MemoryBus, s3: FakeS3, hire: str = HIRE) -> LivePreview:
    return LivePreview(bus, lambda _h: s3, "ws", str(tmp_path), hire, "t-worker", "t-task", delay=0.01, min_gap=0)


def write(tmp_path: Path, rel: str, body: bytes, hire: str = HIRE) -> str:
    f = tmp_path / hire / "app" / rel
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_bytes(body)
    return str(f)


def files_event(**over: Any) -> dict[str, Any]:
    e = {
        "type": "app.preview.files",
        "at": "2026-11-12T10:00:00.000Z",
        "hire_id": HIRE,
        "ticket_id": "t-worker",
        "task_id": "t-task",
        "paths": ["index.html", "game.js"],
        "hints": [{"path": "game.js", "selector": "#board"}],
    }
    return {**e, **over}


# ---------- where an edit landed ----------
@pytest.mark.parametrize(
    ("path", "text", "want"),
    [
        ("index.html", '<div id="score">0</div>', "#score"),
        ("index.html", '<div class="card flipped">', ".card"),
        ("index.html", "<header><h1>Hi</h1></header>", "header"),
        ("style.css", ".card:hover { transform: scale(1.1) }", ".card"),
        ("style.css", "#board{display:grid}", "#board"),
        ("game.js", "const b = document.getElementById('board');", "#board"),
        ("game.js", 'document.querySelector(".card")', ".card"),
        ("game.js", "let x = 1", None),
        ("icon.svg", '<svg id="x"/>', None),
        ("index.html", '<div id="a);alert(1)//">', "#a"),
    ],
)
def test_the_selector_comes_from_what_the_edit_wrote_and_is_always_plain(
    path: str, text: str, want: str | None
) -> None:
    assert selector_for(path, text) == want


# ---------- the worker's side ----------
async def test_a_worker_file_write_sends_the_changed_path_once_index_html_exists(tmp_path: Path) -> None:
    bus, s3 = MemoryBus(), FakeS3()
    lp = live(tmp_path, bus, s3)
    lp.touched("Write", {"file_path": write(tmp_path, "game.js", b"let x=1"), "content": "let x=1"})
    await asyncio.sleep(0.05)
    assert bus.events == []  # no index.html yet: nothing to show
    path = write(tmp_path, "index.html", PAGE)
    lp.touched("Write", {"file_path": path, "content": PAGE.decode()})
    await asyncio.sleep(0.05)
    [e] = bus.events
    assert e["type"] == "app.preview.files" and e["hire_id"] == HIRE and e["task_id"] == "t-task"
    assert e["paths"] == ["game.js", "index.html"]
    assert e["hints"] == [{"path": "game.js", "selector": None}, {"path": "index.html", "selector": "#board"}]
    assert s3.keys("ws") == [f"hires/{HIRE}/app/game.js", f"hires/{HIRE}/app/index.html"]

    # An edit sends only what changed; a burst of edits shares one event.
    for i in range(5):
        p = write(tmp_path, "game.js", f"let x={i + 2}".encode())
        lp.touched("Edit", {"file_path": p, "new_string": f"let x={i + 2}"})
    await asyncio.sleep(0.05)
    assert len(bus.events) == 2 and bus.events[1]["paths"] == ["game.js"]
    await lp.close()
    assert len(bus.events) == 2  # nothing new at the end of the turn


async def test_files_outside_app_and_other_tools_send_nothing(tmp_path: Path) -> None:
    bus, s3 = MemoryBus(), FakeS3()
    write(tmp_path, "index.html", PAGE)
    lp = live(tmp_path, bus, s3)
    lp.touched("Write", {"file_path": str(tmp_path / HIRE / "notes.md"), "content": "x"})
    lp.touched("Read", {"file_path": str(tmp_path / HIRE / "app" / "index.html")})
    await asyncio.sleep(0.05)
    assert bus.events == []
    # A command that wrote files is picked up by the scan at the end of the turn.
    write(tmp_path, "run.sh", b"echo")  # not an allowed file type: never sent
    lp.touched("Bash", {"command": "npm run build"})
    await lp.close()
    assert [e["paths"] for e in bus.events] == [["index.html"]]


async def test_a_failed_upload_never_fails_the_turn(tmp_path: Path) -> None:
    write(tmp_path, "index.html", PAGE)

    def broken(_h: str) -> Any:
        raise RuntimeError("no credentials")

    lp = LivePreview(MemoryBus(), broken, "ws", str(tmp_path), HIRE, "t", "t", delay=0, min_gap=0)
    lp.touched("Bash", {"command": "x"})
    await lp.close()  # no exception


# ---------- the apps Lambda's side ----------
async def test_the_lambda_stages_the_changed_files_and_tells_the_hud() -> None:
    ledger, bus, s3 = Ledger(MemoryTable()), MemoryBus(), FakeS3()
    s3.put("ws", f"hires/{HIRE}/app/index.html", PAGE)
    s3.put("ws", f"hires/{HIRE}/app/game.js", b"let x=1")
    assert await on_submitted({"detail": files_event()}, ledger, bus, origin(s3), s3, "ws") is None
    [e] = bus.events
    assert e["type"] == "app.preview" and e["seq"] == 1 and e["hire_id"] == HIRE
    m = re.fullmatch(re.escape(URL) + r"/drafts/(prv-[0-9a-f]{32})/index.html", e["preview_url"])
    assert m, e["preview_url"]  # 128 random bits: the address is the owner's alone
    pid = m.group(1)
    assert e["paths"] == ["index.html", "game.js"] and e["hints"] == [{"path": "game.js", "selector": "#board"}]
    keys = s3.keys("vaic-prod-apps")
    assert keys == sorted(f"drafts/{pid}/{p}" for p in ("index.html", "game.js", BRIDGE, LIVE))
    page = s3.objects["vaic-prod-apps"][f"drafts/{pid}/index.html"]
    assert page["Body"].endswith(b'<script src="vaic-live.js"></script></body></html>')
    assert page["ContentType"] == "text/html; charset=utf-8" and page["CacheControl"] == "no-cache"

    # A later change: same address, next number, only that file copied.
    s3.put("ws", f"hires/{HIRE}/app/game.js", b"let x=2")
    await stage_preview(files_event(paths=["game.js"], hints=[]), ledger, bus, origin(s3), s3, "ws")
    assert bus.events[1]["preview_url"] == e["preview_url"] and bus.events[1]["seq"] == 2
    assert s3.objects["vaic-prod-apps"][f"drafts/{pid}/game.js"]["Body"] == b"let x=2"


async def test_a_preview_is_never_a_draft_a_version_or_a_published_app() -> None:
    ledger, bus, s3 = Ledger(MemoryTable()), MemoryBus(), FakeS3()
    s3.put("ws", f"hires/{HIRE}/app/index.html", PAGE)
    s3.put("ws", f"hires/{HIRE}/app/game.js", b"x")
    await stage_preview(files_event(), ledger, bus, origin(s3), s3, "ws")
    assert await list_drafts(ledger) == []
    assert await list_apps(ledger) == []
    assert [i["sk"] for i in await ledger.table.query(DRAFTS_PK, "")] == ["PREVIEW#t-task"]
    assert not s3.keys("vaic-prod-apps", "live/")
    assert [e["type"] for e in bus.events] == ["app.preview"]  # no app.draft, no approval


async def test_the_lambda_refuses_what_is_not_a_workers_allowed_file() -> None:
    ledger, bus, s3 = Ledger(MemoryTable()), MemoryBus(), FakeS3()
    s3.put("ws", "hires/mgr-apps/app/index.html", PAGE)
    assert await stage_preview(files_event(hire_id="mgr-apps"), ledger, bus, origin(s3), s3, "ws") is None
    s3.put("ws", f"hires/{HIRE}/app/{BRIDGE}", b"steal()")
    bad = files_event(paths=["../../secrets.json", "run.sh", BRIDGE, LIVE])
    assert await stage_preview(bad, ledger, bus, origin(s3), s3, "ws") is None
    assert bus.events == [] and s3.keys("vaic-prod-apps") == []


def test_the_preview_events_validate() -> None:
    parse_event(files_event())
    parse_event(
        {"type": "app.preview", "at": "x", "task_id": "t", "hire_id": HIRE, "preview_url": URL, "seq": 1, "paths": []}
    )


def test_the_bridge_treats_the_live_copy_as_a_preview_with_no_data() -> None:
    # The live copy sits under drafts/, which the city's bridge already answers with "preview" (docs/APPS.md, v2).
    from vaic.shared.apps import BRIDGE_JS

    assert b"/\\/drafts\\//.test(String(location.pathname))" in BRIDGE_JS
