"""Departments chosen when a document is added (decision 270): stored from the start, none means every department."""

from __future__ import annotations

from typing import Any

import pytest

from knowledge_support import world
from test_api import ev, js, make
from vaic.lambdas.api import handle_http


@pytest.fixture
def rig() -> Any:
    w = world()
    d = make(knowledge=w.service)
    d.bus = w.bus
    return w, d


async def stored(w: Any, item_id: str) -> dict[str, Any]:
    rec = await w.service.store.get_item(item_id)
    assert rec
    return dict(rec)


async def test_an_upload_for_finance_is_stored_for_finance_from_the_start(rig: Any) -> None:
    w, d = rig
    body = {"file_name": "Q3 budget.xlsx", "content_type": "application/vnd.ms-excel", "size_bytes": 9}
    r = await handle_http(ev("POST", "/knowledge/uploads", {**body, "departments": ["Finance", "data"]}), d)
    assert r["statusCode"] == 201
    item = js(r)["item"]
    assert item["departments"] == ["finance", "data"]
    assert (await stored(w, item["id"]))["departments"] == ["finance", "data"]


@pytest.mark.parametrize("given", [None, "all", []])
async def test_no_choice_or_all_is_every_department(rig: Any, given: Any) -> None:
    w, d = rig
    body: dict[str, Any] = {"file_name": "a.md", "content_type": "text/markdown", "size_bytes": 3}
    if given is not None:
        body["departments"] = given
    item = js(await handle_http(ev("POST", "/knowledge/uploads", body), d))["item"]
    assert not item.get("departments") and "departments" not in await stored(w, item["id"])


async def test_a_link_and_pasted_text_carry_their_departments(rig: Any) -> None:
    _w, d = rig
    r = await handle_http(ev("POST", "/knowledge/links", {"url": "https://example.com/a", "departments": ["legal"]}), d)
    assert js(r)["item"]["departments"] == ["legal"]
    r = await handle_http(
        ev("POST", "/knowledge/text", {"text": "Pay day.", "title": "Pay", "departments": ["finance"]}), d
    )
    assert js(r)["item"]["departments"] == ["finance"]


async def test_a_bad_departments_value_is_refused_before_anything_is_stored(rig: Any) -> None:
    w, d = rig
    r = await handle_http(ev("POST", "/knowledge/text", {"text": "x", "title": "x", "departments": "finance"}), d)
    assert r["statusCode"] == 400 and "Departments" in js(r)["error"]
    assert not await w.service.store.list_items()


async def test_recommend_marks_departments_from_the_names_and_text(rig: Any) -> None:
    _w, d = rig
    r = await handle_http(ev("POST", "/departments/recommend", {"text": "Q3 budget and invoices.xlsx"}), d)
    assert r["statusCode"] == 200
    assert "finance" in [x["key"] for x in js(r)["recommended"]]
    r = await handle_http(ev("POST", "/departments/recommend", {"text": "zzz"}), d)
    assert js(r)["recommended"] == []
