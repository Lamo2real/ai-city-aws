"""What the HTTP API, VAIC's tools and the agents' tools do with Files (docs/FILES.md §7, §8).

Uploading writes the record and hands out presigned PUTs; the file landing under ``files/<id>/`` starts the
description (S3 → EventBridge → the files Lambda). Downloads and previews are presigned GETs that last 15 minutes.
Errors are ``FilesError`` with plain words.
"""

from __future__ import annotations

import contextlib
import json
import math
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from ..events import EventBus
from ..knowledge.blobs import Blobs
from .embed import Embedder, pack
from .model import (
    MAX_DESCRIPTION_CHARS,
    MAX_PARTS,
    MAX_UPLOAD_BYTES,
    PART_SIZE_BYTES,
    SINGLE_PUT_MAX_BYTES,
    clean_folder,
    clean_name,
    clean_tags,
    clean_when,
    file_json,
    file_kind,
    is_file_id,
    new_file_id,
    object_key,
)
from .search import Filters, Hit, rank, search_text
from .store import FilesStore

LINK_SECONDS = 900
LIST_LIMIT = 500


class FilesError(ValueError):
    """Plain words for the owner."""


class NotFound(FilesError):
    pass


def updated_event(rec: dict[str, Any]) -> dict[str, Any]:
    e = {
        "type": "files.updated",
        "id": rec["id"],
        "status": rec.get("status", ""),
        "name": rec.get("name", ""),
        "kind": rec.get("kind", ""),
        "folder": rec.get("folder", ""),
        "department": rec.get("department") or "",
    }
    if rec.get("error"):
        e["error"] = rec["error"]
    return e


def _note(v: Any) -> str:
    if v is None:
        return ""
    if not isinstance(v, str):
        raise FilesError("The description must be text.")
    return " ".join(v.split())[:MAX_DESCRIPTION_CHARS]


def part_size(size: int) -> int:
    """64 MB parts, larger for very large files (S3 allows 10,000 parts)."""
    return max(PART_SIZE_BYTES, math.ceil(size / MAX_PARTS / 1024**2) * 1024**2)


def check_after_before(after: Any, before: Any) -> tuple[str | None, str | None]:
    a = clean_when(after) if after else None
    b = clean_when(before) if before else None
    if (after and not a) or (before and not b):
        raise FilesError("Give dates like 2026-03-01.")
    if a and b and a > b:
        raise FilesError("'after' must come before 'before'.")
    return a, b


@dataclass
class FilesService:
    store: FilesStore
    blobs: Blobs
    bus: EventBus
    embedder: Embedder | None = None
    reindex: Callable[[str], Awaitable[None]] | None = None
    """Starts the description again for one file (an async invoke of the files Lambda); None = not wired."""

    # ---------- reading ----------
    async def require(self, file_id: str) -> dict[str, Any]:
        rec = await self.store.get(file_id) if is_file_id(file_id) else None
        if not rec:
            raise NotFound("That file doesn't exist (any more).")
        return rec

    async def links(self, rec: dict[str, Any], seconds: int = LINK_SECONDS) -> dict[str, Any]:
        """The file with short-lived addresses: ``url`` to show it, ``download_url`` to save it, ``thumb_url``."""
        out = file_json(rec)
        if rec.get("status") in ("ready", "processing", "failed") and rec.get("object_key"):
            ct = rec.get("content_type") or None
            out["url"] = await self.blobs.presign_get(rec["object_key"], rec["name"], True, ct, seconds)
            out["download_url"] = await self.blobs.presign_get(rec["object_key"], rec["name"], False, ct, seconds)
        if rec.get("thumb_key"):
            out["thumb_url"] = await self.blobs.presign_get(
                rec["thumb_key"], "thumbnail.jpg", True, "image/jpeg", seconds
            )
        out["links_expire_in"] = seconds
        return out

    async def get(self, file_id: str) -> dict[str, Any]:
        return await self.links(await self.require(file_id))

    async def find(
        self, query: str = "", filters: Filters | None = None, limit: int = LIST_LIMIT, include_uploading: bool = False
    ) -> list[Hit]:
        recs = [r for r in await self.store.all() if include_uploading or r.get("status") != "uploading"]
        return await rank(recs, query, self.embedder, filters, limit)

    async def list(self, q: dict[str, Any]) -> dict[str, Any]:
        """``GET /files``: newest first, or best first with ``q``; ``after``/``before``/``kind``/``folder``/
        ``department`` narrow it. Folders and departments are listed for the HUD's filters."""
        after, before = check_after_before(q.get("after"), q.get("before"))
        kind = str(q.get("kind") or "") or None
        f = Filters(after, before, kind, clean_folder(q.get("folder")) or None, str(q.get("department") or "") or None)
        every = await self.store.all()
        query = str(q.get("q") or "").strip()[:500]
        if query:
            hits = await rank([r for r in every if r.get("status") != "uploading"], query, self.embedder, f, 60)
        else:
            day_ago = _day_before(self.store.now_iso())
            live = [r for r in every if r.get("status") != "uploading" or str(r.get("created_at", "")) >= day_ago]
            hits = await rank(live, "", None, f, LIST_LIMIT)
        files = [{**await self.links(h.rec), **({"score": h.score} if query else {})} for h in hits]
        folders = sorted({str(r.get("folder") or "") for r in every if r.get("folder")})
        departments = sorted({str(r["department"]) for r in every if r.get("department")})
        return {"files": files, "folders": folders, "departments": departments, "total": len(every)}

    # ---------- uploads from the owner's device ----------
    async def create_upload(self, b: dict[str, Any]) -> dict[str, Any]:
        name = clean_name(b.get("file_name"))
        if not isinstance(b.get("file_name"), str) or not b["file_name"].strip():
            raise FilesError("The file name is missing.")
        ct = b.get("content_type")
        ct = ct.strip()[:200] if isinstance(ct, str) and ct.strip() else "application/octet-stream"
        size = b.get("size_bytes")
        if isinstance(size, bool) or not isinstance(size, int | float) or not math.isfinite(size) or size <= 0:
            raise FilesError("The file size is missing.")
        if size > MAX_UPLOAD_BYTES:
            raise FilesError("That file is larger than 50 GB.")
        file_id = new_file_id()
        rec: dict[str, Any] = {
            "id": file_id,
            "name": name,
            "kind": file_kind(name, ct),
            "content_type": ct,
            "size_bytes": int(size),
            "folder": clean_folder(b.get("folder")),
            "tags": clean_tags(b.get("tags")),
            "note": _note(b.get("note")),
            "object_key": object_key(file_id, name),
            "added_by": "owner",
            "description": "",
        }
        taken = clean_when(b.get("taken_at"))
        if taken:
            rec["taken_at"] = taken
            rec["taken_from"] = "device"
        rec = await self.store.create(rec)
        key = rec["object_key"]
        upload: dict[str, Any]
        if size <= SINGLE_PUT_MAX_BYTES:
            upload = {"method": "PUT", "url": await self.blobs.presign_put(key, ct), "headers": {"content-type": ct}}
        else:
            upload_id = await self.blobs.start_multipart(key, ct)
            ps = part_size(int(size))
            count = math.ceil(size / ps)
            upload = {
                "multipart": True,
                "upload_id": upload_id,
                "part_size": ps,
                "part_urls": [await self.blobs.presign_part(key, upload_id, n) for n in range(1, count + 1)],
            }
            rec = await self.store.update(file_id, {"upload_id": upload_id}) or rec
        await self.bus.put(updated_event(rec))
        return {"file": file_json(rec), "upload": upload}

    async def complete_upload(self, file_id: str, b: dict[str, Any]) -> dict[str, Any]:
        rec = await self.require(file_id)
        upload_id = b.get("upload_id")
        if not rec.get("upload_id") or upload_id != rec["upload_id"]:
            raise FilesError("That upload is not open any more. Upload the file again.")
        parts = b.get("parts")
        if not isinstance(parts, list) or not parts:
            raise FilesError("The upload's parts are missing.")
        try:
            pairs = sorted((int(p["part_number"]), str(p["etag"])) for p in parts)
            clean: list[dict[str, Any]] = [{"part_number": n, "etag": e} for n, e in pairs]
        except (KeyError, TypeError, ValueError) as e:
            raise FilesError("The upload's parts are not in the right shape.") from e
        try:
            await self.blobs.complete_multipart(rec["object_key"], str(upload_id), clean)
        except Exception as e:
            raise FilesError(f"S3 could not put the parts together ({type(e).__name__}: {e}). Upload it again.") from e
        new = await self.store.update(file_id, {"upload_id": None}) or rec
        return file_json(new)

    # ---------- changes ----------
    async def update(self, file_id: str, b: dict[str, Any]) -> dict[str, Any]:
        rec = await self.require(file_id)
        patch: dict[str, Any] = {}
        if "name" in b:
            if not isinstance(b["name"], str) or not b["name"].strip():
                raise FilesError("Give it a name.")
            patch["name"] = clean_name(b["name"])
        if "folder" in b:
            patch["folder"] = clean_folder(b["folder"])
        if "tags" in b:
            if not isinstance(b["tags"], list):
                raise FilesError("Tags are a list of words.")
            patch["tags"] = clean_tags(b["tags"])
        if "note" in b:
            patch["note"] = _note(b["note"])
        if "taken_at" in b:
            taken = clean_when(b["taken_at"])
            if b["taken_at"] and not taken:
                raise FilesError("Give the date like 2026-04-12.")
            patch["taken_at"], patch["taken_from"] = taken, "owner" if taken else None
        if not patch:
            raise FilesError("Nothing to change.")
        merged = {**rec, **patch}
        if rec.get("status") == "ready":
            text = search_text(merged) + (f"\n{rec['excerpt']}" if rec.get("excerpt") else "")
            patch["search_text"] = text
            if self.embedder:
                patch["vec"] = pack(await self.embedder.embed(text))
        new = await self.store.update(file_id, patch)
        if new is None:
            raise NotFound("That file doesn't exist (any more).")
        await self.bus.put(updated_event(new))
        return await self.links(new)

    async def delete(self, file_id: str) -> None:
        rec = await self.require(file_id)
        if rec.get("upload_id"):
            with contextlib.suppress(Exception):  # an upload already finished or expired: nothing left to abort
                await self.blobs.abort_multipart(rec["object_key"], str(rec["upload_id"]))
        await self.blobs.delete_prefix(f"files/{file_id}/")
        await self.blobs.delete_prefix(f"work/{file_id}/")
        if rec.get("thumb_key"):
            await self.blobs.delete(rec["thumb_key"])
        await self.store.delete(file_id)
        await self.bus.put({"type": "files.updated", "id": file_id, "status": "deleted", "name": rec.get("name", "")})

    async def retry(self, file_id: str) -> dict[str, Any]:
        rec = await self.require(file_id)
        if rec.get("status") == "uploading":
            raise FilesError("This file hasn't finished uploading. Upload it again.")
        if self.reindex is None:
            raise FilesError("Describing files again isn't wired here yet.")
        new = await self.store.update(file_id, {"status": "processing", "error": None, "warning": None}) or rec
        await self.bus.put(updated_event(new))
        await self.reindex(file_id)
        return file_json(new)


def _day_before(iso: str) -> str:
    """An upload still in flight is listed (the HUD shows its progress); one that never finished in a day is not."""
    from datetime import datetime, timedelta

    return (datetime.fromisoformat(iso.replace("Z", "+00:00")) - timedelta(days=1)).isoformat().replace("+00:00", "Z")


def chat_card(rec: dict[str, Any]) -> dict[str, Any]:
    """What a chat line keeps of a file: enough to draw the card; addresses are fetched fresh when shown."""
    return {
        "id": rec["id"],
        "name": rec.get("name", ""),
        "kind": rec.get("kind", "other"),
        "content_type": rec.get("content_type", ""),
        "size_bytes": int(rec.get("size_bytes") or 0),
        "description": str(rec.get("description") or "")[:300],
        "department": rec.get("department") or "",
        "taken_at": rec.get("taken_at") or "",
        "created_at": rec.get("created_at") or "",
    }


def agent_listing(hits: list[Hit]) -> str:
    """Search results for an agent: data, never instructions."""
    from .model import DATA_HEADER

    rows = [
        {
            "id": h.rec["id"],
            "name": h.rec.get("name"),
            "kind": h.rec.get("kind"),
            "folder": h.rec.get("folder") or "",
            "department": h.rec.get("department") or "",
            "added_by": h.rec.get("added_by"),
            "taken": h.rec.get("taken_at") or "",
            "added": h.rec.get("created_at"),
            "size_bytes": h.rec.get("size_bytes"),
            "status": h.rec.get("status"),
            "score": h.score,
            "description": str(h.rec.get("description") or "")[:400],
        }
        for h in hits
    ]
    return f"{DATA_HEADER}\n<files>\n{json.dumps(rows, ensure_ascii=False)}\n</files>"


@dataclass
class FilesAccess:
    """What agent turns get: search (every role), the chat card (VAIC), the bucket for get/save (managers, workers)."""

    service: FilesService
    bucket: str
