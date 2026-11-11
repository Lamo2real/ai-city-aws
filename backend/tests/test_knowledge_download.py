"""Download of a knowledge document's original: owner only, existing documents only, the exact bytes."""

from __future__ import annotations

import dataclasses
from types import SimpleNamespace
from typing import Any
from urllib.parse import urlsplit

import pytest

import vaic.lambdas.api as api_mod
from knowledge_support import world
from test_api import ev, js, make
from vaic.lambdas.api import handle_http
from vaic.shared.knowledge.blobs import MemoryBlobs, S3Blobs
from vaic.shared.knowledge.builtin import GUIDE_ID
from vaic.shared.knowledge.builtin import KEY as GUIDE_KEY
from vaic.shared.knowledge.download import DOWNLOAD_SECONDS, file_name
from vaic.shared.knowledge.entries import SeedSet, load_seeds
from vaic.shared.knowledge.entry_service import EntryService
from vaic.shared.knowledge.projection import EntryProjector
from vaic.shared.knowledge.registry import EntryRegistry
from vaic.shared.knowledge.seeder import refresh_status, run_seed

SEEDS = load_seeds()
SEO = "marketing.seo.local-seo"  # a seed file with front matter
DOC = "marketing.house-style.hormozi-playbook"  # a whole document, kept byte for byte
SHARED = next(i for i in SEEDS.entries if i.startswith("shared."))


async def _no_sleep(_s: float) -> None:
    return None


def fetch(blobs: MemoryBlobs, url: str) -> bytes:
    """What the browser gets from a presigned GET on the fake bucket."""
    u = urlsplit(url)
    assert u.netloc == f"{blobs.bucket}.s3.test" and "attachment" in u.query
    assert f"expires={DOWNLOAD_SECONDS}" in u.query
    return blobs.objects[u.path.lstrip("/")][0]


def seeds(*ids: str) -> SeedSet:
    out = SeedSet(taxonomies=dict(SEEDS.taxonomies))
    for i in ids:
        e = SEEDS.entries[i]
        out.entries[i] = dataclasses.replace(e, related=(), requires=(), supersedes=())
        out.paths[i] = SEEDS.paths[i]
    return out


async def settle(w: Any) -> None:
    """The index finishes every part it was given; entries switch to their new versions."""
    s = api_mod._entry_service
    assert s is not None
    for u in w.kb.status:
        w.kb.status[u] = "INDEXED"
    await refresh_status(s.registry, s.projector, list(s.seeds().taxonomies))


@pytest.fixture
async def rig() -> Any:
    w = world()
    s = seeds(SEO, DOC, SHARED)
    reg, proj = EntryRegistry(w.table), EntryProjector(w.blobs, w.kb, w.graph, sleep=_no_sleep)
    await run_seed(s, reg, proj, "embed-model-1")
    for u in w.kb.status:
        w.kb.status[u] = "INDEXED"
    await refresh_status(reg, proj, list(s.taxonomies))
    api_mod._entry_service = EntryService(reg, proj, seeds=lambda: s)
    d = make(knowledge=w.service)
    d.bus = w.bus
    yield w, d
    api_mod._entry_service = None


def test_every_seed_entry_knows_its_file() -> None:
    assert set(SEEDS.paths) == set(SEEDS.entries)
    assert SEEDS.paths[DOC].name == "marketing-hormozi-playbook.md"


@pytest.mark.parametrize("path", [f"/knowledge/entries/{SEO}/download", "/knowledge/k-aaaaaaaaaaaa/download"])
async def test_only_the_owner_gets_an_address(rig: Any, path: str) -> None:
    _w, d = rig
    for groups in (None, "[]", "[friends]"):
        r = await handle_http(ev("GET", path, None, groups), d)
        assert r["statusCode"] == 403 and "Only the owner" in js(r)["error"]


@pytest.mark.parametrize("eid", [SEO, DOC, SHARED])
async def test_a_built_in_document_downloads_as_the_seed_file_byte_for_byte(rig: Any, eid: str) -> None:
    w, d = rig
    r = await handle_http(ev("GET", f"/knowledge/entries/{eid}/download"), d)
    assert r["statusCode"] == 200
    b = js(r)
    assert b["expires_in"] == DOWNLOAD_SECONDS and b["file_name"].endswith(".md")
    assert fetch(w.blobs, b["url"]) == SEEDS.paths[eid].read_bytes()
    assert urlsplit(b["url"]).path.startswith(f"/downloads/entries/{eid}/")


async def test_an_edited_entry_downloads_the_owners_version_and_reset_brings_the_seed_back(rig: Any) -> None:
    w, d = rig
    r = await handle_http(ev("PUT", f"/knowledge/entries/{SEO}", {"content": "## Ours\n\nOur own local SEO rules."}), d)
    assert r["statusCode"] == 200
    await settle(w)
    got = fetch(w.blobs, js(await handle_http(ev("GET", f"/knowledge/entries/{SEO}/download"), d))["url"]).decode()
    assert got.startswith("---\nid: marketing.seo.local-seo\n") and got.endswith(
        "## Ours\n\nOur own local SEO rules.\n"
    )
    await handle_http(ev("POST", f"/knowledge/entries/{SEO}/reset"), d)
    url = js(await handle_http(ev("GET", f"/knowledge/entries/{SEO}/download"), d))["url"]
    assert fetch(w.blobs, url).decode() == got  # the edit stays active until the default is indexed
    await settle(w)
    url = js(await handle_http(ev("GET", f"/knowledge/entries/{SEO}/download"), d))["url"]
    assert fetch(w.blobs, url) == SEEDS.paths[SEO].read_bytes()


async def test_while_a_new_version_indexes_the_active_one_downloads(rig: Any) -> None:
    w, d = rig
    await handle_http(ev("PUT", f"/knowledge/entries/{SEO}", {"content": "Not indexed yet."}), d)
    url = js(await handle_http(ev("GET", f"/knowledge/entries/{SEO}/download"), d))["url"]
    assert fetch(w.blobs, url) == SEEDS.paths[SEO].read_bytes()  # agents still read the shipped version


async def test_a_deleted_or_unknown_entry_is_404(rig: Any) -> None:
    _w, d = rig
    assert (await handle_http(ev("DELETE", f"/knowledge/entries/{SEO}"), d))["statusCode"] == 200
    r = await handle_http(ev("GET", f"/knowledge/entries/{SEO}/download"), d)
    assert r["statusCode"] == 404 and "deleted" in js(r)["error"]
    r = await handle_http(ev("GET", "/knowledge/entries/marketing.seo.nope/download"), d)
    assert r["statusCode"] == 404


async def test_an_upload_downloads_byte_for_byte_with_its_name(rig: Any) -> None:
    w, d = rig
    up = js(
        await handle_http(
            ev(
                "POST",
                "/knowledge/uploads",
                {"file_name": "Q3 report.pdf", "content_type": "application/pdf", "size_bytes": 9},
            ),
            d,
        )
    )["item"]
    r = await handle_http(ev("GET", f"/knowledge/{up['id']}/download"), d)
    assert r["statusCode"] == 404 and "not there yet" in js(r)["error"]  # still uploading
    pdf = b"%PDF-1.7\n\x00\xff\x10binary"
    await w.blobs.put(up["raw_key"], pdf, "application/pdf")
    b = js(await handle_http(ev("GET", f"/knowledge/{up['id']}/download"), d))
    assert b["file_name"] == "Q3 report.pdf" and fetch(w.blobs, b["url"]) == pdf

    await handle_http(ev("DELETE", f"/knowledge/{up['id']}"), d)
    r = await handle_http(ev("GET", f"/knowledge/{up['id']}/download"), d)
    assert r["statusCode"] == 404


async def test_pasted_text_is_named_after_its_title_and_a_link_has_no_file(rig: Any) -> None:
    w, d = rig
    note = await w.service.add_text("Remember: the office is in Solna.", "Office: where?", None)
    b = js(await handle_http(ev("GET", f"/knowledge/{note['id']}/download"), d))
    assert b["file_name"] == "Office where.md"
    assert fetch(w.blobs, b["url"]) == w.blobs.objects[note["raw_key"]][0]
    link = await w.service.add_link("https://example.com/a", "A page", None)
    r = await handle_http(ev("GET", f"/knowledge/{link['id']}/download"), d)
    assert r["statusCode"] == 400 and "open the link" in js(r)["error"]


async def test_the_ai_city_guide_downloads_as_its_pdf(rig: Any) -> None:
    w, d = rig
    await handle_http(ev("GET", "/knowledge"), d)  # puts the guide in place
    b = js(await handle_http(ev("GET", f"/knowledge/{GUIDE_ID}/download"), d))
    assert b["file_name"] == "AI City guide.pdf"
    assert fetch(w.blobs, b["url"]) == w.blobs.objects[GUIDE_KEY][0] and b["url"].count(GUIDE_KEY) == 1


def test_file_names_are_safe_everywhere() -> None:
    assert file_name('Sales: a/b "c" <d>?', ".md") == "Sales a b c d.md"
    assert file_name("  ..  ", ".md") == "document.md"


async def test_s3_presigns_a_five_minute_attachment() -> None:
    seen: dict[str, Any] = {}

    def presign(op: str, Params: dict[str, Any], ExpiresIn: int) -> str:
        seen.update(op=op, params=Params, expires=ExpiresIn)
        return "https://signed"

    b = S3Blobs(SimpleNamespace(generate_presigned_url=presign), "bucket")
    assert await b.presign_get("raw/k/a.pdf", "a.pdf", False, "application/pdf", DOWNLOAD_SECONDS) == "https://signed"
    assert seen["op"] == "get_object" and seen["expires"] == 300
    assert seen["params"]["ResponseContentDisposition"].startswith('attachment; filename="a.pdf"')
    assert seen["params"]["ResponseContentType"] == "application/pdf"
