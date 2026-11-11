"""Department knowledge entries for the owner (§17): list, read, create, edit, delete, reset to default, re-index.

Every write goes to the registry first, then to the projections (S3 parts, vector store, graph). A projection
that fails leaves the record marked ``sync: failed`` with the reason, shown on the card; Re-index and the next
deploy's seeder repair it, so the three never drift silently. Every change is audited. The API is owner-only
(the existing permission model); agents only read, through ``search_knowledge``, limited to their department.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from datetime import date, timedelta
from typing import Any

from .entries import (
    AUDIENCES,
    CONFIDENCES,
    ENTRY_TYPES,
    VOLATILITIES,
    Entry,
    EntryError,
    SeedSet,
    Taxonomy,
    embedding_model,
    entry_from_fields,
    load_seeds,
)
from .projection import EntryProjector, safe
from .registry import EntryRegistry, entry_fields, keep_active, list_row, record_json
from .seeder import all_uris, project_many, refresh_status, settle

EDITABLE = (
    "title", "summary", "content", "domain", "type", "audience", "platforms", "objectives", "confidence",
    "volatility", "as_of", "review_by", "sources", "related", "requires", "supersedes",
)  # fmt: skip
REFRESH_AT_MOST = 30
"""Entries whose indexing state is checked per list call (the deploy step waits for the rest)."""
_REVIEW_DAYS = {"fast-moving": 92, "annual": 365, "evergreen": 730}


class EntryNotFound(LookupError):
    pass


def _slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:60].strip("-") or "entry"


class EntryService:
    def __init__(
        self,
        registry: EntryRegistry,
        projector: EntryProjector,
        seeds: Callable[[], SeedSet] = load_seeds,
        model: Callable[[], str] = embedding_model,
        today: Callable[[], date] = date.today,
    ) -> None:
        self.registry = registry
        self.projector = projector
        self._seeds = seeds
        self._model = model
        self._today = today
        self._seed_cache: SeedSet | None = None

    def seeds(self) -> SeedSet:
        if self._seed_cache is None:
            self._seed_cache = self._seeds()
        return self._seed_cache

    def taxonomy(self, department: str) -> Taxonomy:
        tax = self.seeds().taxonomies.get(department)
        if not tax:
            raise EntryError(f"{department} has no knowledge base yet (no taxonomy).")
        return tax

    async def _require(self, entry_id: str) -> dict[str, Any]:
        rec = await self.registry.get(entry_id)
        if not rec:
            raise EntryNotFound("That knowledge entry does not exist.")
        return rec

    # ---------- read ----------
    async def list(self, q: dict[str, str]) -> dict[str, Any]:
        depts = [q["department"]] if q.get("department") else list(self.seeds().taxonomies)
        recs = [r for d in depts for r in await self.registry.in_department(d)]
        stale = [r for r in recs if r.get("status") == "processing" and r.get("sync") == "done"][:REFRESH_AT_MOST]
        for r in stale:
            if await settle(self.registry, self.projector, r, self.seeds().taxonomies) != "processing":
                r.update(await self.registry.get(str(r["entry_id"])) or {})
        words = (q.get("q") or "").lower().split()

        def keep(r: dict[str, Any]) -> bool:
            if q.get("domain") and r.get("domain") != q["domain"]:
                return False
            if q.get("platform") and q["platform"] not in (r.get("platforms") or []):
                return False
            if q.get("type") and r.get("type") != q["type"]:
                return False
            if q.get("origin") and r.get("origin") != q["origin"]:
                return False
            hay = f"{r.get('title', '')} {r.get('summary', '')} {r.get('entry_id', '')}".lower()
            return all(w in hay for w in words)

        rows = sorted((list_row(r) for r in recs if keep(r)), key=lambda r: (r.get("domain", ""), r["title"]))
        return {
            "entries": rows,
            "taxonomies": {
                d: {
                    "label": t.label,
                    "domains": t.domains,
                    "platforms": t.platforms,
                    "objectives": t.objectives,
                }
                for d, t in self.seeds().taxonomies.items()
            },
            "choices": {
                "type": list(ENTRY_TYPES),
                "audience": list(AUDIENCES),
                "confidence": list(CONFIDENCES),
                "volatility": list(VOLATILITIES),
            },
        }

    async def get(self, entry_id: str) -> dict[str, Any]:
        rec = await self._require(entry_id)
        return {"entry": record_json(rec), "history": await self.registry.history(entry_id)}

    # ---------- write ----------
    async def _project(self, e: Entry, rec: dict[str, Any]) -> dict[str, Any]:
        await project_many([(e, rec)], self.seeds().taxonomies, self.registry, self.projector)
        return record_json(await self._require(e.id))

    def _fill(self, b: dict[str, Any]) -> dict[str, Any]:
        """Defaults for an owner's entry: today as ``as_of`` and a review date from the volatility."""
        out = {k: b[k] for k in (*EDITABLE, "department", "entry_id") if k in b and b[k] is not None}
        out.setdefault("type", "playbook")
        out.setdefault("audience", "both")
        out.setdefault("confidence", "established")
        out.setdefault("volatility", "evergreen")
        today = self._today()
        out.setdefault("as_of", today.isoformat())
        if "review_by" not in out:
            base = (
                date.fromisoformat(str(out["as_of"])) if re.fullmatch(r"\d{4}-\d\d-\d\d", str(out["as_of"])) else today
            )
            out["review_by"] = (base + timedelta(days=_REVIEW_DAYS.get(str(out["volatility"]), 365))).isoformat()
        return out

    async def create(self, b: dict[str, Any], by: str = "owner") -> dict[str, Any]:
        dept = str(b.get("department") or "")
        tax = self.taxonomy(dept)
        f = self._fill(b)
        if not f.get("entry_id"):
            base = f"{dept}.{f.get('domain', '')}.{_slug(str(f.get('title') or ''))}"
            eid, n = base, 2
            while await self.registry.get(eid) or eid in self.seeds().entries:
                eid, n = f"{base}-{n}", n + 1
            f["entry_id"] = eid
        elif await self.registry.get(str(f["entry_id"])) or f["entry_id"] in self.seeds().entries:
            raise EntryError("An entry with that id already exists.")
        e = entry_from_fields({**f, "department": dept, "seed_version": 1}, tax)
        rec = await self.registry.put(
            {
                **entry_fields(e, "user"),
                "user_modified": False,
                "deleted": False,
                "status": "processing",
                "sync": "pending",
                "embed_model": self._model(),
                "changed_by": by,
            }
        )
        await self.registry.audit(e.id, "create", by, e.title, e.content_hash())
        return await self._project(e, rec)

    async def update(self, entry_id: str, b: dict[str, Any], by: str = "owner") -> dict[str, Any]:
        rec = await self._require(entry_id)
        if rec.get("deleted"):
            raise EntryError("This entry is deleted. Reset it to the default first.")
        patch = {k: b[k] for k in EDITABLE if k in b}
        if not patch:
            raise EntryError("Nothing to change.")
        tax = self.taxonomy(str(rec["department"]))
        if "domain" in patch and patch["domain"] != rec.get("domain"):
            raise EntryError("An entry cannot move to another domain; create a new one instead.")
        e = entry_from_fields({**rec, **patch}, tax)
        if e.content_hash() == rec.get("content_hash"):
            raise EntryError("Nothing to change.")
        new = await self.registry.put(
            {
                **rec,
                **entry_fields(e, str(rec.get("origin") or "user")),
                "user_modified": rec.get("origin") == "system" or bool(rec.get("user_modified")),
                "status": "processing",
                "error": None,
                "sync": "pending",
                "embed_model": self._model(),
                "changed_by": by,
                **keep_active(rec),
            }
        )
        await self.registry.audit(entry_id, "update", by, ", ".join(sorted(patch)), e.content_hash())
        return await self._project(e, new)

    async def delete(self, entry_id: str, by: str = "owner") -> dict[str, Any]:
        """A tombstone: the record stays (a deploy never brings a deleted default back); the index and the graph
        lose it; S3 keeps the old versions for 30 days."""
        rec = await self._require(entry_id)
        if rec.get("deleted"):
            return record_json(rec)
        await self.registry.update(
            entry_id, {"deleted": True, "status": "deleted", "sync": "pending", "changed_by": by}
        )
        err = await safe(
            self.projector.unproject(str(rec["department"]), entry_id, all_uris(rec)),
            "removing from the index and graph",
        )
        await self.registry.update(
            entry_id, {"sync": "failed" if err else "done", "error": err, "ingest_uris": [], "active": None}
        )
        await self.registry.audit(entry_id, "delete", by, err or "")
        return record_json(await self._require(entry_id))

    async def reset(self, entry_id: str, by: str = "owner") -> dict[str, Any]:
        """Back to the shipped default (also brings back a deleted default, and takes a newer default)."""
        rec = await self._require(entry_id)
        if rec.get("origin") != "system":
            raise EntryError("Only built-in entries have a default to go back to.")
        e = self.seeds().entries.get(entry_id)
        if not e:
            raise EntryError("This default is no longer shipped, so there is nothing to reset to.")
        new = await self.registry.put(
            {
                **rec,
                **entry_fields(e, "system"),
                "seed_hash": e.content_hash(),
                "seed_version": e.seed_version,
                "user_modified": False,
                "deleted": False,
                "retired": False,
                "newer_default": None,
                "status": "processing",
                "error": None,
                "sync": "pending",
                "embed_model": self._model(),
                "changed_by": by,
                **keep_active(rec),
            }
        )
        await self.registry.audit(entry_id, "reset", by, "", e.content_hash())
        return await self._project(e, new)

    async def reindex(self, entry_id: str, by: str = "owner") -> dict[str, Any]:
        """Repairs the projections from the record (the outbox retry the owner can press)."""
        rec = await self._require(entry_id)
        await self.registry.audit(entry_id, "reindex", by)
        if rec.get("deleted") or rec.get("retired"):
            err = await safe(
                self.projector.unproject(str(rec["department"]), entry_id, all_uris(rec)),
                "removing from the index and graph",
            )
            await self.registry.update(entry_id, {"sync": "failed" if err else "done", "error": err, "active": None})
            return record_json(await self._require(entry_id))
        e = entry_from_fields(rec, self.taxonomy(str(rec["department"])))
        patch = {**keep_active(rec), "status": "processing", "sync": "pending", "error": None}
        return await self._project(e, await self.registry.update(entry_id, patch) or {**rec, **patch})

    async def status(self) -> dict[str, int]:
        taxes = self.seeds().taxonomies
        return await refresh_status(self.registry, self.projector, list(taxes), taxes)
