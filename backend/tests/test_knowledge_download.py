"""Download of a knowledge document's original: owner only, existing documents only, the exact bytes."""

from __future__ import annotations

import dataclasses
import io
import zipfile
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
from vaic.shared.knowledge.download import DOWNLOAD_SECONDS, _unique, file_name
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


# ---------- a department's whole knowledge as one zip (decision 268) ----------


def unzip(blobs: MemoryBlobs, url: str) -> dict[str, bytes]:
    with zipfile.ZipFile(io.BytesIO(fetch(blobs, url))) as z:
        return {n: z.read(n) for n in z.namelist()}


def active_files(names: dict[str, bytes]) -> dict[str, bytes]:
    return {n: b for n, b in names.items() if n != "README.md"}


async def test_a_department_downloads_as_a_zip_of_its_entries_byte_for_byte(rig: Any) -> None:
    w, d = rig
    r = await handle_http(ev("GET", "/knowledge/departments/marketing/download"), d)
    assert r["statusCode"] == 200
    b = js(r)
    assert b["file_name"] == "Marketing knowledge.zip" and b["expires_in"] == DOWNLOAD_SECONDS and b["entries"] == 2
    assert urlsplit(b["url"]).path.startswith("/downloads/departments/marketing/")
    files = unzip(w.blobs, b["url"])
    assert sorted(active_files(files).values()) == sorted(SEEDS.paths[i].read_bytes() for i in (SEO, DOC))
    readme = files["README.md"].decode()
    assert readme.startswith("# Marketing knowledge\n") and SEO in readme and DOC in readme
    shared = unzip(w.blobs, js(await handle_http(ev("GET", "/knowledge/departments/shared/download"), d))["url"])
    assert list(active_files(shared).values()) == [SEEDS.paths[SHARED].read_bytes()]


async def test_the_zip_has_the_owners_edits_and_leaves_deleted_entries_out(rig: Any) -> None:
    w, d = rig
    await handle_http(ev("PUT", f"/knowledge/entries/{SEO}", {"content": "## Ours\n\nOur own local SEO rules."}), d)
    await settle(w)
    assert (await handle_http(ev("DELETE", f"/knowledge/entries/{DOC}"), d))["statusCode"] == 200
    b = js(await handle_http(ev("GET", "/knowledge/departments/marketing/download"), d))
    files = active_files(unzip(w.blobs, b["url"]))
    one = js(await handle_http(ev("GET", f"/knowledge/entries/{SEO}/download"), d))
    assert b["entries"] == 1 and list(files.values()) == [fetch(w.blobs, one["url"])]
    assert next(iter(files.values())).decode().endswith("## Ours\n\nOur own local SEO rules.\n")
    assert list(files) == [one["file_name"]]  # named by the entry's title, like the single download


async def test_a_department_download_is_owner_only_and_an_unknown_department_is_404(rig: Any) -> None:
    _w, d = rig
    for groups in (None, "[]", "[friends]"):
        r = await handle_http(ev("GET", "/knowledge/departments/marketing/download", None, groups), d)
        assert r["statusCode"] == 403 and "Only the owner" in js(r)["error"]
    r = await handle_http(ev("GET", "/knowledge/departments/nope/download"), d)
    assert r["statusCode"] == 404 and "no knowledge base" in js(r)["error"]
    assert (await handle_http(ev("POST", "/knowledge/departments/marketing/download"), d))["statusCode"] == 404


def test_two_entries_with_one_title_get_two_files() -> None:
    taken: set[str] = set()
    assert [_unique("A.md", taken), _unique("a.md", taken), _unique("A.md", taken)] == ["A.md", "a (2).md", "A (3).md"]


async def test_s3_uploads_the_zip_from_its_file() -> None:
    seen: dict[str, Any] = {}

    def upload(f: Any, bucket: str, key: str, ExtraArgs: dict[str, str]) -> None:
        seen.update(body=f.read(), bucket=bucket, key=key, args=ExtraArgs)

    f = io.BytesIO(b"PK zip")
    f.seek(3)
    await S3Blobs(SimpleNamespace(upload_fileobj=upload), "bucket").put_file("downloads/x.zip", f, "application/zip")
    assert seen == {
        "body": b"PK zip",
        "bucket": "bucket",
        "key": "downloads/x.zip",
        "args": {"ContentType": "application/zip"},
    }


async def test_a_link_downloads_its_saved_page_text_once_read(rig: Any) -> None:
    w, d = rig
    link = await w.service.add_link("https://example.com/long", "A long page", None)
    r = await handle_http(ev("GET", f"/knowledge/{link['id']}/download"), d)
    assert r["statusCode"] == 400 and "open the link" in js(r)["error"]  # not read yet
    keys = [f"normalized/{link['id']}/page-part{n}.md" for n in (1, 2)]
    for n, k in enumerate(keys, 1):
        await w.blobs.put(k, f"part {n}".encode(), "text/markdown")
    await w.blobs.put(f"normalized/{link['id']}/site-profile.md", b"profile", "text/markdown")
    await w.service.store.update_item(
        link["id"], {"normalized_keys": [*keys, f"normalized/{link['id']}/site-profile.md"]}
    )
    b = js(await handle_http(ev("GET", f"/knowledge/{link['id']}/download"), d))
    assert b["file_name"] == "A long page.md" and fetch(w.blobs, b["url"]) == b"part 1\npart 2"
    assert urlsplit(b["url"]).path.startswith(f"/downloads/items/{link['id']}/")


async def test_an_upload_downloads_while_it_is_still_being_read(rig: Any) -> None:
    w, d = rig
    body = {"file_name": "plan.pdf", "content_type": "application/pdf", "size_bytes": 4}
    up = js(await handle_http(ev("POST", "/knowledge/uploads", body), d))["item"]
    await w.blobs.put(up["raw_key"], b"%PDF", "application/pdf")
    await w.service.store.update_item(up["id"], {"status": "processing"})
    b = js(await handle_http(ev("GET", f"/knowledge/{up['id']}/download"), d))
    assert fetch(w.blobs, b["url"]) == b"%PDF"
