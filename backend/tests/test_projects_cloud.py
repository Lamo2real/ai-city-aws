"""Projects and their chats on the server (decision 299): a project started on one device shows on every other,
and a device's old local chat is uploaded once without duplicates. Fakes only: no AWS, no Bedrock."""

from typing import Any

from test_apps import FakeS3, api, ev, js
from vaic.lambdas.api import ROUTES, handle_http
from vaic.shared.apps import APPS_PK
from vaic.shared.owner_api import refusal


async def test_a_project_is_saved_listed_announced_and_removed() -> None:
    d = api(FakeS3())
    r = await handle_http(ev("PUT", "/projects/new-abc12345", {"idea": "a quiz about world capitals", "title": "Quiz About World Capitals", "at": 1000}), d)  # fmt: skip
    assert r["statusCode"] == 200
    assert js(await handle_http(ev("GET", "/projects"), d))["projects"] == [
        {"key": "new-abc12345", "idea": "a quiz about world capitals", "title": "Quiz About World Capitals", "at": 1000}
    ]
    # Saving again (another device, a retry) keeps one record.
    await handle_http(ev("PUT", "/projects/new-abc12345", {"idea": "a quiz", "title": "Quiz", "at": 1000}), d)
    assert len(js(await handle_http(ev("GET", "/projects"), d))["projects"]) == 1
    await handle_http(ev("DELETE", "/projects/new-abc12345"), d)
    assert js(await handle_http(ev("GET", "/projects"), d))["projects"] == []
    types = [e["type"] for e in d.bus.events]  # type: ignore[attr-defined]
    assert types == ["project.saved", "project.saved", "project.removed"]


async def test_a_published_project_leaves_the_list() -> None:
    d = api(FakeS3())
    await handle_http(ev("PUT", "/projects/new-abc12345", {"idea": "i", "title": "T", "at": 1}), d)
    await handle_http(ev("PUT", "/projects/new-def67890", {"idea": "i", "title": "U", "at": 2}), d)
    await d.ledger.table.put({"pk": APPS_PK, "sk": "APP#app-1", "app_id": "app-1", "conversation": "app-new-abc12345"})
    keys = [p["key"] for p in js(await handle_http(ev("GET", "/projects"), d))["projects"]]
    assert keys == ["new-def67890"]


async def test_only_new_project_keys_are_taken() -> None:
    d = api(FakeS3())
    assert (await handle_http(ev("PUT", "/projects/app-1", {"idea": "i", "title": "T"}), d))["statusCode"] == 404
    r = await handle_http(ev("PUT", "/projects/new-abc12345", {"title": "T"}), d)
    assert r["statusCode"] == 400


async def test_project_chats_are_read_and_kept_beyond_30_days() -> None:
    d = api(FakeS3())
    await d.ledger.add_conversation_line("app-new-abc12345", "owner", "a quiz about world capitals")
    await d.ledger.add_conversation_line("app-new-abc12345", "vaic", "On it, Sir.")
    await d.ledger.add_conversation_line("main", "owner", "hello")
    lines = js(await handle_http(ev("GET", "/conversations/app-new-abc12345/lines"), d))["lines"]
    assert [(x["who"], x["text"]) for x in lines] == [("owner", "a quiz about world capitals"), ("vaic", "On it, Sir.")]
    assert all(x["id"] and x["at"] for x in lines)
    items = await d.ledger.table.query("CONV#app-new-abc12345")
    assert all("ttl" not in i for i in items)
    assert all("ttl" in i for i in await d.ledger.table.query("CONV#main"))


async def test_a_devices_old_lines_upload_once() -> None:
    d = api(FakeS3())
    old: list[dict[str, Any]] = [
        {"id": "p1", "who": "owner", "text": "a quiz", "at": 1_700_000_000_000},
        {"id": "a1", "who": "ace", "text": "Sure.", "at": 1_700_000_001_000},
        {"id": "f1", "who": "ace", "text": "", "at": 1_700_000_002_000},  # a file card: nothing to keep as text
        {"id": "bad id!", "who": "owner", "text": "x", "at": 1},
        {"id": "z", "who": "someone", "text": "x", "at": 1},
    ]
    for _ in range(2):
        r = await handle_http(ev("POST", "/conversations/app-new-abc12345/lines", {"lines": old}), d)
        assert js(r) == {"imported": 2}
    lines = js(await handle_http(ev("GET", "/conversations/app-new-abc12345/lines"), d))["lines"]
    assert [(x["who"], x["text"]) for x in lines] == [("owner", "a quiz"), ("vaic", "Sure.")]
    assert lines[0]["at"] == "2023-11-14T22:13:20.000Z"


async def test_a_message_tells_the_owners_other_devices() -> None:
    d = api(FakeS3())
    await handle_http(ev("POST", "/messages", {"text": "make it blue", "conversation": "app-new-abc12345", "client_id": "pabc12345"}), d)  # fmt: skip
    e = [e for e in d.bus.events if e["type"] == "owner.line"]  # type: ignore[attr-defined]
    assert e and e[0]["conversation"] == "app-new-abc12345" and e[0]["client_id"] == "pabc12345"
    assert e[0]["text"] == "make it blue"


def test_the_routes_are_listed_and_vaic_cannot_write_chat_lines() -> None:
    for r in [
        ("GET", "/projects"),
        ("PUT", "/projects/new-abc12345"),
        ("POST", "/conversations/app-new-abc12345/lines"),
    ]:
        assert r in ROUTES
    assert refusal("POST", "/conversations/main/lines")
    assert refusal("GET", "/conversations/main/lines") is None
