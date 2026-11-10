"""Skills → Discover (decision 188): the bundled catalog, and adding a skill from it through the upload path."""

from __future__ import annotations

import base64
from typing import Any

from test_api import ev, js
from test_skills import SKILL_MD, api, b64
from vaic.lambdas.api import handle_http
from vaic.shared import skills_catalog
from vaic.shared.presets import presets
from vaic.shared.skills import NAME_RE, parse_frontmatter, reduce_frontmatter

CATEGORIES = {
    "Finance", "Product", "Operations", "Marketing", "Sales", "Research", "Legal", "Data & AI", "Media", "Application",
}  # fmt: skip


# ---------- the catalog itself ----------
def test_the_catalog_has_at_least_twenty_skills_across_the_asked_categories() -> None:
    cat = [e for e in skills_catalog.entries() if not e["builtin"]]
    assert len(cat) >= 20
    assert {d for e in cat for d in e["departments"]} >= CATEGORIES
    assert sum(e["featured"] for e in skills_catalog.entries()) == 1


def test_every_catalog_skill_is_a_valid_skill_with_city_departments() -> None:
    city = {p["name"] for p in presets()} | {skills_catalog.ALL_DEPARTMENTS}
    names = [e["name"] for e in skills_catalog.entries()]
    assert len(names) == len(set(names))
    for e in skills_catalog.entries():
        assert NAME_RE.match(e["name"]) and e["name"] != "catalog"
        assert e["description"] and len(e["description"]) <= 1024
        assert e["departments"] and set(e["departments"]) <= city, e["name"]
        meta, body = parse_frontmatter(skills_catalog.skill_md(e))
        assert set(meta) == {"name", "description"} and meta["name"] == e["name"] and body.strip()
        assert e["source"] == ("AI City catalog" if not e["builtin"] else e["source"])


def test_builtins_say_which_departments_use_them() -> None:
    bk = skills_catalog.find("bookkeeping")
    assert bk and bk["builtin"] and "Finance" in bk["departments"] and bk["source"].startswith("Built into")
    assert skills_catalog.find("knowledge-first")["source"] == "Built into every department"  # type: ignore[index]


def test_search_matches_every_word_and_the_department() -> None:
    assert [e["name"] for e in skills_catalog.search("cash runway")] == ["cash-flow-runway"]
    fin = skills_catalog.search(department="Finance")
    assert fin and all("Finance" in e["departments"] or "Every department" in e["departments"] for e in fin)
    assert skills_catalog.search("zzz-nothing") == []
    assert skills_catalog.departments()[0] == "Application"


# ---------- the API ----------
async def test_list_detail_add_and_remove_through_the_api() -> None:
    d, s3 = api()
    r = js(await handle_http(ev("GET", "/skills/catalog?q=finance"), d))
    assert r["skills"] and not any(e["added"] for e in r["skills"]) and "Finance" in r["departments"]
    one = js(await handle_http(ev("GET", "/skills/catalog/nda-triage"), d))
    assert one["title"] == "NDA triage" and one["skill_md"].startswith("---\nname: nda-triage")

    added = await handle_http(ev("POST", "/skills/catalog/nda-triage", {"roles": ["manager", "worker"]}), d)
    assert added["statusCode"] == 201
    skill = js(added)["skill"]
    assert skill["name"] == "nda-triage" and skill["roles"] == ["manager", "worker"] and skill["source"] == "catalog"
    # Stored exactly like an upload: versioned objects in S3 and a row in Yours.
    key = f"skills/nda-triage/{skill['version']}/SKILL.md"
    source = skills_catalog.skill_md(skills_catalog.find("nda-triage"))  # type: ignore[arg-type]
    assert s3.objects[key].decode() == reduce_frontmatter(source)[0]
    mine = js(await handle_http(ev("GET", "/skills"), d))["skills"]
    assert [x["name"] for x in mine] == ["nda-triage"]
    listed = js(await handle_http(ev("GET", "/skills/catalog?q=nda"), d))["skills"]
    assert listed[0]["added"] is True

    again = await handle_http(ev("POST", "/skills/catalog/nda-triage"), d)
    assert again["statusCode"] == 409 and "Remove it" in js(again)["fix"]

    assert (await handle_http(ev("DELETE", "/skills/nda-triage"), d))["statusCode"] == 200
    assert not s3.objects
    assert js(await handle_http(ev("GET", "/skills/catalog/nda-triage"), d))["added"] is False


async def test_adding_gives_every_role_by_default_and_works_for_builtins() -> None:
    d, _ = api()
    r = js(await handle_http(ev("POST", "/skills/catalog/bookkeeping"), d))
    assert r["skill"]["roles"] == ["vaic", "orchestrator", "manager", "worker"]


async def test_adding_goes_through_the_same_checks_as_an_upload(monkeypatch: Any) -> None:
    d, _ = api()
    bad = dict(skills_catalog.find("nda-triage") or {})
    monkeypatch.setattr(skills_catalog, "files", lambda e: {"SKILL.md": SKILL_MD.encode(), "hooks/x.sh": b"rm"})
    r = await handle_http(ev("POST", f"/skills/catalog/{bad['name']}"), d)
    assert r["statusCode"] == 400 and "refused" in js(r)["error"]
    assert (await handle_http(ev("POST", "/skills/catalog/nda-triage", {"roles": ["admin"]}), d))["statusCode"] == 400


async def test_unknown_skill_no_bucket_and_the_reserved_name() -> None:
    d, _ = api()
    assert (await handle_http(ev("GET", "/skills/catalog/nope"), d))["statusCode"] == 404
    assert (await handle_http(ev("POST", "/skills/catalog/nope"), d))["statusCode"] == 404
    from test_api import make

    bare = make()
    assert (await handle_http(ev("POST", "/skills/catalog/nda-triage"), bare))["statusCode"] == 503
    md = SKILL_MD.replace("name: pdf-report", "name: catalog")
    r = await handle_http(ev("POST", "/skills", {"files": [{"path": "SKILL.md", "content_base64": b64(md)}]}), d)
    assert r["statusCode"] == 400 and "catalog" in js(r)["error"]


def test_files_are_the_folder_as_an_upload_sends_it() -> None:
    e = skills_catalog.find("sql-review")
    assert e
    got = skills_catalog.files(e)
    assert list(got) == ["SKILL.md"] and base64.b64encode(got["SKILL.md"])


# ---------- VAIC ("add the finance skill") ----------
def test_vaic_may_browse_and_add_through_city_api_without_a_confirm() -> None:
    from vaic.shared import owner_api

    for m, p in (("GET", "/skills/catalog?q=finance"), ("GET", "/skills/catalog/x"), ("POST", "/skills/catalog/x")):
        assert owner_api.refusal(m, p) is None
        assert not owner_api.destructive(m, p)
    assert owner_api.destructive("DELETE", "/skills/x")
    ev_ = owner_api.to_event("GET", "/skills/catalog?q=cash runway&department=Finance")
    assert ev_["queryStringParameters"] == {"q": "cash runway", "department": "Finance"}


async def test_the_owner_api_event_finds_the_skill() -> None:
    from vaic.shared import owner_api

    d, _ = api()
    e = owner_api.to_event("GET", "/skills/catalog?q=cash runway&department=Finance")
    e["requestContext"]["authorizer"] = {"jwt": {"claims": {"cognito:groups": "[owner]"}}}
    got = js(await handle_http(e, d))["skills"]
    assert [x["name"] for x in got] == ["cash-flow-runway"]


def test_vaic_is_told_how_to_add_from_the_catalog() -> None:
    text = (skills_catalog.agents_dir() / "vaic.md").read_text(encoding="utf-8")
    assert "POST /skills/catalog/<name>" in text and "GET /skills/catalog?q=" in text
