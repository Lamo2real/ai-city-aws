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
from .entries import Entry, EntryError, SeedSet, Taxonomy, entry_from_fields, load_seeds
from .projection import EntryProjector, entry_row, safe, taxonomy_rows
from .registry import EntryRegistry, entry_fields, keep_active

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


def all_uris(rec: dict[str, Any]) -> list[str]:
    """Every indexed part of an entry: the version being indexed and the one agents still read."""
    active = list((rec.get("active") or {}).get("ingest_uris") or [])
    return list(dict.fromkeys([*(rec.get("ingest_uris") or []), *active]))


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
                        **keep_active(rec),
                    }
                )
                todo.append((e, new))
            elif c.action == "repair" and rec:
                e = entry_from_fields(rec, seeds.taxonomies[str(rec["department"])])
                fix = {**keep_active(rec), "status": "processing", "sync": "pending", "error": None}
                todo.append((e, await registry.update(c.entry_id, fix) or {**rec, **fix}))
            elif c.action == "newer_default":
                e = seeds.entries[c.entry_id]
                await registry.update(c.entry_id, {"newer_default": {**e.fields(), "seed_hash": e.content_hash()}})
            elif c.action in ("retire", "repair_delete") and rec:
                err = await safe(
                    projector.unproject(str(rec["department"]), c.entry_id, all_uris(rec)),
                    "removing from the index and graph",
                )
                patch: dict[str, Any] = {"sync": "failed" if err else "done", "error": err, "active": None}
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
    """Indexes a new version of each entry beside the one agents read (decision 235): its S3 parts, then the vector
    store (batched). Each record carries its ``active`` patch (``keep_active``) before it gets here. Switching to the
    new version, the graph and removing the old parts follow in ``settle`` once the index has every part. A failure
    deletes the new parts and marks the record failed; the previous version stays active. Every record ends with
    ``sync`` ``done`` or ``failed`` and the reason, so the next deploy (or Re-index) picks the failures up again."""
    errors: list[str] = []
    if not todo:
        return errors
    docs: dict[str, list[tuple[str, dict[str, Any]]]] = {}
    versions: dict[str, int] = {}
    for e, rec in todo:
        # Parts of a version that was never active (superseded before it finished) are never read again.
        keep = set((rec.get("active") or {}).get("ingest_uris") or [])
        await safe(
            projector.drop_stale([u for u in rec.get("ingest_uris") or [] if u not in keep], []),
            "removing an unfinished version",
        )
        label = taxonomies[e.department].label if e.department in taxonomies else e.department
        versions[e.id] = int(rec.get("version") or 0) + 1
        try:
            docs[e.id] = await projector.write_parts(e, str(rec.get("origin") or "system"), label, versions[e.id])
        except Exception as write_err:
            why = f"writing the entry files failed ({type(write_err).__name__})"
            errors.append(await _fail(registry, e.id, why))
    ok = [(e, rec) for e, rec in todo if e.id in docs]
    flat = [d for e, _ in ok for d in docs[e.id]]
    ingest_err = await safe(projector.ingest(flat), "indexing")
    for e, _ in ok:
        uris = [u for u, _ in docs[e.id]]
        if ingest_err:
            await safe(projector.drop_stale(uris, []), "removing the failed version")
            errors.append(await _fail(registry, e.id, ingest_err))
            continue
        await registry.update(
            e.id,
            {"ingest_uris": uris, "version": versions[e.id], "sync": "done", "error": None, "status": "processing"},
        )
    return errors


async def _fail(registry: EntryRegistry, entry_id: str, why: str) -> str:
    """The new version did not make it: the record says why; ``active`` (if any) is what agents keep reading."""
    await registry.update(entry_id, {"sync": "failed", "error": why, "status": "failed", "ingest_uris": []})
    return f"{entry_id}: {why}"


async def settle(
    registry: EntryRegistry, projector: EntryProjector, rec: dict[str, Any], taxonomies: dict[str, Taxonomy]
) -> str:
    """For a record whose new version is written and being indexed: once every part is indexed, switch to it, move
    the graph to it and delete the previous version's parts (decision 235); if the index reports a failure, delete
    the new parts and leave the previous version active. Returns the record's status afterwards."""
    eid, uris = str(rec["entry_id"]), list(rec.get("ingest_uris") or [])
    done, err = await projector.indexed(uris)
    if err:
        await safe(projector.drop_stale(uris, []), "removing the failed version")
        await _fail(registry, eid, err)
        return "failed"
    if not done:
        return "processing"
    tax = taxonomies.get(str(rec.get("department")))
    graph_err = None
    if tax:
        try:
            row = entry_row(entry_from_fields(rec, tax), tax, "ready")
            graph_err = await safe(projector.graph.upsert_entries([row]), "graph")
        except EntryError as bad:
            graph_err = f"graph failed ({bad})"
    old = list((rec.get("active") or {}).get("ingest_uris") or [])
    stale_err = await safe(projector.drop_stale(old, uris), "removing the old version")
    err = graph_err or stale_err
    await registry.update(eid, {"status": "ready", "active": None, "error": err, "sync": "failed" if err else "done"})
    return "ready"


async def refresh_status(
    registry: EntryRegistry,
    projector: EntryProjector,
    departments: list[str],
    taxonomies: dict[str, Taxonomy] | None = None,
) -> dict[str, int]:
    """Settles every entry whose new version is being indexed (``settle``) and counts the states."""
    taxes = taxonomies if taxonomies is not None else load_seeds().taxonomies
    counts = {"ready": 0, "processing": 0, "failed": 0, "deleted": 0, "retired": 0, "total": 0}
    for dept in departments:
        for rec in await registry.in_department(dept):
            status = str(rec.get("status") or "")
            if status == "processing" and rec.get("sync") == "done":
                status = await settle(registry, projector, rec, taxes)
            counts["total"] += 1
            if status in counts:
                counts[status] += 1
    return counts
