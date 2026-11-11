"""Versions of a department knowledge entry (decision 235): a new version is indexed beside the one agents read; the
switch happens only once every part is indexed, then the old parts and graph edges go; a failure leaves the old
version active. Run for one document of each department that has a knowledge base. No AWS."""

from __future__ import annotations

from typing import Any

import pytest

from test_knowledge_entries import SEEDS, IgnoresFilters, Rig, _no_sleep, rig, settled, small
from vaic.shared.knowledge.entry_service import EntryService
from vaic.shared.knowledge.kb import Hit
from vaic.shared.knowledge.projection import EntryProjector
from vaic.shared.knowledge.search import Caller, search
from vaic.shared.knowledge.seeder import run_seed

MODEL = "embed-model-1"
ENTRIES = [
    ("marketing", "marketing.seo.local-seo"),
    ("sales", "sales.house-style.closer-framework"),
    ("application", "application.security.application-security"),
]
NEW = "## Short version\n\nThe owner's replacement text."


async def _ready(dept: str, eid: str) -> tuple[Rig, EntryService]:
    r = rig()
    r.kb = IgnoresFilters()
    r.projector = EntryProjector(r.blobs, r.kb, r.graph, sleep=_no_sleep)
    await run_seed(small(eid), r.registry, r.projector, MODEL)
    await settled(r)
    return r, EntryService(r.registry, r.projector, seeds=lambda: small(eid))


async def _read(r: Rig, dept: str, eid: str, *versions: int) -> list[dict[str, Any]]:
    """What an agent of the department gets when the index returns parts of these versions."""
    r.kb.hits = [
        Hit(f"kn-{eid}", f"part of v{v}", 0.9 - v / 10, "relevant", attributes={"department": dept, "version": v})
        for v in versions
    ]
    res = await search(r.kb, r.store, "q", caller=Caller(department=dept, role="manager", audience="all"))
    return [{"content": i["content"], "snippets": s} for i, s in res.items]


def _parts(r: Rig, eid: str) -> set[str]:
    return {u for u in r.kb.docs if f"/{eid}/" in u}


@pytest.mark.parametrize(("dept", "eid"), ENTRIES)
async def test_the_old_version_is_read_until_the_new_one_is_indexed(dept: str, eid: str) -> None:
    r, s = await _ready(dept, eid)
    old = _parts(r, eid)
    old_content = (await r.registry.get(eid) or {})["content"]
    edges = {e for e in r.graph.edges if e[1] == f"kn-{eid}"}
    shown = await s.update(eid, {"content": NEW})
    assert shown["status"] == "processing" and shown["active"]["version"] == 1  # the HUD shows "Indexing"
    # Both versions are in the index; agents read the old one and only its parts; the graph is unchanged.
    assert old < _parts(r, eid) and all("/v1/" in u for u in old)
    got = await _read(r, dept, eid, 1, 2)
    assert [g["content"] for g in got] == [old_content] and got[0]["snippets"] == ["part of v1"]
    assert {e for e in r.graph.edges if e[1] == f"kn-{eid}"} == edges
    # Indexed: the switch, then only the new version's parts and graph edges are left.
    await settled(r)
    rec = await r.registry.get(eid) or {}
    assert rec["status"] == "ready" and rec["version"] == 2 and not rec.get("active")
    assert _parts(r, eid) and all("/v2/" in u for u in _parts(r, eid))
    assert not [k for k in r.blobs.objects if f"/{eid}/v1/" in k]
    got = await _read(r, dept, eid, 1, 2)
    assert [g["content"] for g in got] == [NEW] and got[0]["snippets"] == ["part of v2"]
    assert {e for e in r.graph.edges if e[1] == f"kn-{eid}"} != edges


@pytest.mark.parametrize(("dept", "eid"), ENTRIES)
async def test_a_failed_index_leaves_the_old_version_active(dept: str, eid: str) -> None:
    r, s = await _ready(dept, eid)
    old, old_content = _parts(r, eid), (await r.registry.get(eid) or {})["content"]
    # The index refuses the new version after accepting it.
    await s.update(eid, {"content": NEW})
    for u in _parts(r, eid) - old:
        r.kb.status[u] = "FAILED"
    await settled_without_marking(r)
    rec = await r.registry.get(eid) or {}
    assert rec["status"] == "failed" and rec["sync"] == "failed" and rec["active"]["version"] == 1
    assert _parts(r, eid) == old and not [k for k in r.blobs.objects if f"/{eid}/v2/" in k]
    assert [g["content"] for g in await _read(r, dept, eid, 1)] == [old_content]
    # Re-index (or the next deploy) tries again and then switches.
    await s.reindex(eid)
    await settled(r)
    rec = await r.registry.get(eid) or {}
    assert rec["status"] == "ready" and rec["content"] == NEW and not rec.get("active")
    assert [g["content"] for g in await _read(r, dept, eid, rec["version"])] == [NEW]


@pytest.mark.parametrize(("dept", "eid"), ENTRIES)
async def test_a_refused_ingest_leaves_the_old_version_active(dept: str, eid: str) -> None:
    r, s = await _ready(dept, eid)
    old, old_content = _parts(r, eid), (await r.registry.get(eid) or {})["content"]
    r.kb.throttle = 100  # Bedrock stays busy for longer than the retries
    await s.reindex(eid)
    rec = await r.registry.get(eid) or {}
    assert rec["status"] == "failed" and rec["active"]["version"] == 1 and _parts(r, eid) == old
    assert [g["content"] for g in await _read(r, dept, eid, 1)] == [old_content]


@pytest.mark.parametrize(("dept", "eid"), ENTRIES)
async def test_deleting_while_a_new_version_indexes_removes_both(dept: str, eid: str) -> None:
    r, s = await _ready(dept, eid)
    await s.update(eid, {"content": NEW})
    await s.delete(eid)
    rec = await r.registry.get(eid) or {}
    assert rec["deleted"] and not rec.get("active") and not _parts(r, eid)
    assert not [k for k in r.blobs.objects if f"/{eid}/" in k]
    assert await _read(r, dept, eid, 1, 2) == []


async def test_a_second_edit_before_the_first_is_indexed_drops_the_unfinished_version() -> None:
    dept, eid = ENTRIES[2]
    r, s = await _ready(dept, eid)
    await s.update(eid, {"content": NEW})
    await s.update(eid, {"content": NEW + "\n\nAnd one more line."})
    rec = await r.registry.get(eid) or {}
    assert rec["version"] == 3 and rec["active"]["version"] == 1
    assert not [u for u in _parts(r, eid) if "/v2/" in u] and [u for u in _parts(r, eid) if "/v1/" in u]
    await settled(r)
    assert all("/v3/" in u for u in _parts(r, eid))


async def settled_without_marking(r: Rig) -> None:
    from vaic.shared.knowledge.seeder import refresh_status

    await refresh_status(r.registry, r.projector, list(SEEDS.taxonomies))
