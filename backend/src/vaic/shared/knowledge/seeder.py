"""The seeder (§17): reconciles ``knowledge/seed/**`` with the entry registry, the vector store and the graph.

Run by the deploy pipeline after Terraform (knowledge Lambda action ``seed_knowledge``) and locally with
``backend/scripts/seed_knowledge.py``. Idempotent: a second run plans nothing. The rules, per seed entry:

- not in the registry → created;
- a system entry nobody touched → updated when its seed changed (content hash), re-embedded when the embedding
  model changed, re-projected when its projections never caught up (``sync`` not ``done``);
- a system entry the owner edited or deleted → left alone; a changed seed is recorded as ``newer_default`` for the
  Knowledge tab to offer; a deleted one is never resurrected;
- an owner's own entry with the same id → never touched (reported as a conflict).

A system entry whose seed file is gone is retired (out of the index and the graph, the record kept) unless the
owner edited it. Any record of any origin whose projections are behind is repaired: the seeder is also the outbox.
Validation errors stop the run before anything is written.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from ..log import log
from .entries import Entry, EntryError, SeedSet, Taxonomy, entry_from_fields
from .projection import EntryProjector, entry_row, safe, taxonomy_rows
from .registry import EntryRegistry, entry_fields

PROJECT = ("create", "update", "reembed", "resync", "revive", "repair")
NO_CHANGE = ("skip", "keep_deleted", "keep_modified", "keep_user", "keep_removed")


@dataclass(frozen=True)
class Change:
    action: str
    entry_id: str
    detail: str = ""


@dataclass
class SeedReport:
    ok: bool
    dry_run: bool
    changes: list[Change] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def counts(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for c in self.changes:
            out[c.action] = out.get(c.action, 0) + 1
        return out

    def changed(self) -> list[Change]:
        return [c for c in self.changes if c.action not in NO_CHANGE]

    def as_json(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "dry_run": self.dry_run,
            "counts": self.counts(),
            "changes": [c.__dict__ for c in self.changed()],
            "errors": self.errors,
        }


def plan(seeds: SeedSet, records: dict[str, dict[str, Any]], embed_model: str) -> list[Change]:
    """What a run would do; ``records`` are the registry records of the seeded departments by entry id."""
    out: list[Change] = []
    for eid, e in sorted(seeds.entries.items()):
        rec = records.get(eid)
        h = e.content_hash()
        if rec is None:
            out.append(Change("create", eid))
        elif rec.get("origin") != "system":
            out.append(Change("keep_user", eid, "an entry of yours has this id; the default was not applied"))
        elif rec.get("deleted") and not rec.get("retired"):
            newer = h != rec.get("seed_hash") and (rec.get("newer_default") or {}).get("seed_hash") != h
            out.append(Change("newer_default", eid, "deleted by the owner") if newer else Change("keep_deleted", eid))
        elif rec.get("user_modified"):
            newer = h != rec.get("seed_hash") and (rec.get("newer_default") or {}).get("seed_hash") != h
            out.append(Change("newer_default", eid, "edited by the owner") if newer else Change("keep_modified", eid))
        elif rec.get("retired"):
            out.append(Change("revive", eid))
        elif h != rec.get("seed_hash"):
            out.append(Change("update", eid))
        elif rec.get("embed_model") != embed_model:
            out.append(Change("reembed", eid, f"{rec.get('embed_model')} → {embed_model}"))
        elif rec.get("sync") != "done":
            out.append(Change("resync", eid))
        else:
            out.append(Change("skip", eid))
        lagging = rec is not None and rec.get("sync") not in (None, "done")
        if (
            lagging
            and rec is not None
            and out[-1].action in ("keep_user", "keep_modified", "keep_deleted", "newer_default")
        ):
            gone = rec.get("deleted") or rec.get("retired")
            out.append(Change("repair_delete" if gone else "repair", eid, "the last change did not reach the index"))
    for eid, rec in sorted(records.items()):
        if eid in seeds.entries:
            continue
        if rec.get("origin") == "system" and not rec.get("retired") and not rec.get("deleted"):
            if rec.get("user_modified"):
                act = "keep_removed" if rec.get("seed_removed") else "mark_removed"
                out.append(Change(act, eid, "edited by the owner, so kept"))
            else:
                out.append(Change("retire", eid))
        elif rec.get("sync") != "done":
            gone = rec.get("deleted") or rec.get("retired")
            out.append(Change("repair_delete" if gone else "repair", eid))
    return out


async def run_seed(
    seeds: SeedSet,
    registry: EntryRegistry,
    projector: EntryProjector,
    embed_model: str,
    dry_run: bool = False,
    by: str = "deploy",
) -> SeedReport:
    if seeds.errors:
        return SeedReport(ok=False, dry_run=dry_run, errors=list(seeds.errors))
    records: dict[str, dict[str, Any]] = {}
    for dept in seeds.taxonomies:
        for r in await registry.in_department(dept):
            records[str(r["entry_id"])] = r
    report = SeedReport(ok=True, dry_run=dry_run, changes=plan(seeds, records, embed_model))
    if dry_run:
        return report
    for tax in seeds.taxonomies.values():
        if err := await safe(projector.graph.upsert_taxonomy(taxonomy_rows(tax)), f"graph taxonomy {tax.department}"):
            report.errors.append(err)
    todo: list[tuple[Entry, dict[str, Any]]] = []
    for c in report.changes:
        rec = records.get(c.entry_id)
        try:
            if c.action in ("create", "update", "reembed", "resync", "revive"):
                e = seeds.entries[c.entry_id]
                new = await registry.put(
                    {
                        **(rec or {}),
                        **entry_fields(e, "system"),
                        "seed_hash": e.content_hash(),
                        "seed_version": e.seed_version,
                        "user_modified": False,
                        "deleted": False,
                        "retired": False,
                        "seed_removed": False,
                        "newer_default": None,
                        "status": "processing",
                        "error": None,
                        "sync": "pending",
                        "embed_model": embed_model,
                        "changed_by": by,
                    }
                )
                todo.append((e, new))
            elif c.action == "repair" and rec:
                todo.append((entry_from_fields(rec, seeds.taxonomies[str(rec["department"])]), rec))
            elif c.action == "newer_default":
                e = seeds.entries[c.entry_id]
                await registry.update(c.entry_id, {"newer_default": {**e.fields(), "seed_hash": e.content_hash()}})
            elif c.action in ("retire", "repair_delete") and rec:
                err = await safe(
                    projector.unproject(str(rec["department"]), c.entry_id, list(rec.get("ingest_uris") or [])),
                    "removing from the index and graph",
                )
                patch: dict[str, Any] = {"sync": "failed" if err else "done", "error": err}
                if c.action == "retire":
                    patch.update({"retired": True, "status": "retired", "changed_by": by})
                await registry.update(c.entry_id, patch)
                if err:
                    report.errors.append(f"{c.entry_id}: {err}")
            elif c.action == "mark_removed":
                await registry.update(c.entry_id, {"seed_removed": True})
            else:
                continue
            await registry.audit(c.entry_id, f"seed.{c.action}", by, c.detail)
        except (EntryError, KeyError) as e:
            report.errors.append(f"{c.entry_id}: {e}")
    report.errors.extend(await project_many(todo, seeds.taxonomies, registry, projector))
    report.ok = not report.errors
    log("info", "knowledge.seeded", counts=json.dumps(report.counts()), errors=len(report.errors))
    return report


async def project_many(
    todo: list[tuple[Entry, dict[str, Any]]],
    taxonomies: dict[str, Taxonomy],
    registry: EntryRegistry,
    projector: EntryProjector,
) -> list[str]:
    """S3 parts, then the vector store (batched), then the graph; every record ends ``done`` or ``failed`` with
    the reason, so the next deploy (or Re-index) picks the failures up again."""
    errors: list[str] = []
    if not todo:
        return errors
    docs: dict[str, list[tuple[str, dict[str, Any]]]] = {}
    for e, rec in todo:
        label = taxonomies[e.department].label if e.department in taxonomies else e.department
        try:
            docs[e.id] = await projector.write_parts(e, str(rec.get("origin") or "system"), label)
        except Exception as write_err:
            why = f"writing the entry files failed ({type(write_err).__name__})"
            errors.append(await _fail(registry, e.id, why))
    ok = [(e, rec) for e, rec in todo if e.id in docs]
    flat = [d for e, _ in ok for d in docs[e.id]]
    ingest_err = await safe(projector.ingest(flat), "indexing")
    if ingest_err:
        for e, _ in ok:
            errors.append(await _fail(registry, e.id, ingest_err))
        return errors
    rows = [entry_row(e, taxonomies[e.department], "processing") for e, _ in ok if e.department in taxonomies]
    graph_err = await safe(projector.graph.upsert_entries(rows), "graph")
    for e, rec in ok:
        uris = [u for u, _ in docs[e.id]]
        stale_err = await safe(projector.drop_stale(list(rec.get("ingest_uris") or []), uris), "removing old parts")
        err = graph_err or stale_err
        await registry.update(
            e.id,
            {"ingest_uris": uris, "sync": "failed" if err else "done", "error": err, "status": "processing"},
        )
        if err:
            errors.append(f"{e.id}: {err}")
    return errors


async def _fail(registry: EntryRegistry, entry_id: str, why: str) -> str:
    await registry.update(entry_id, {"sync": "failed", "error": why, "status": "failed"})
    return f"{entry_id}: {why}"


async def refresh_status(registry: EntryRegistry, projector: EntryProjector, departments: list[str]) -> dict[str, int]:
    """Moves ``processing`` entries to ``ready`` or ``failed`` from the index's document states."""
    counts = {"ready": 0, "processing": 0, "failed": 0, "deleted": 0, "retired": 0, "total": 0}
    for dept in departments:
        for rec in await registry.in_department(dept):
            status = str(rec.get("status") or "")
            if status == "processing" and rec.get("sync") == "done":
                done, err = await projector.indexed(list(rec.get("ingest_uris") or []))
                if err:
                    await registry.update(str(rec["entry_id"]), {"status": "failed", "error": err})
                    status = "failed"
                elif done:
                    await registry.update(str(rec["entry_id"]), {"status": "ready", "error": None})
                    status = "ready"
            counts["total"] += 1
            if status in counts:
                counts[status] += 1
    return counts
