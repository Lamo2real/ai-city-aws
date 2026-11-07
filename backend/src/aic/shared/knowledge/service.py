"""What the HTTP API and AIC's tools do with the knowledge base (§5, §7).

Adding something only writes the item record and an object under ``raw/<id>/``; that object starts the
pipeline (S3 → EventBridge → Step Functions). Errors are ``KnowledgeError`` with plain words.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Any

from ..events import EventBus
from ..log import log
from .blobs import Blobs
from .fetch import LinkRefused, check_url
from .kb import ConflictException, KnowledgeBase
from .model import (
    ALWAYS_BUDGET_TOKENS,
    DEFAULT_SCOPE,
    MAX_TEXT_CHARS,
    MAX_UPLOAD_BYTES,
    PART_SIZE_BYTES,
    SCOPES,
    SINGLE_PUT_MAX_BYTES,
    item_json,
    metadata_doc,
    new_item_id,
    safe_file_name,
)
from .routing import route_file
from .store import KnowledgeStore


class KnowledgeError(ValueError):
    """Plain words for the owner."""


class NotFound(KnowledgeError):
    pass


def check_scope(v: Any) -> str:
    if v is None:
        return DEFAULT_SCOPE
    if v not in SCOPES:
        raise KnowledgeError("Pick always, relevant or on_request.")
    return str(v)


def check_title(v: Any, fallback: str = "") -> str:
    if v is None or (isinstance(v, str) and not v.strip()):
        if fallback:
            return fallback[:200]
        raise KnowledgeError("Give it a title.")
    if not isinstance(v, str) or len(v) > 200:
        raise KnowledgeError("The title must be text of at most 200 characters.")
    return " ".join(v.split())


def updated_event(item: dict[str, Any]) -> dict[str, Any]:
    e = {
        "type": "knowledge.updated",
        "id": item["id"],
        "status": item["status"],
        "title": item.get("title", ""),
        "scope": item["scope"],
        "kind": item["kind"],
    }
    if item.get("error"):
        e["error"] = item["error"]
    return e


@dataclass
class KnowledgeService:
    store: KnowledgeStore
    blobs: Blobs
    bus: EventBus
    kb: KnowledgeBase | None = None
    """Only the API needs it (re-syncs after a scope change or a delete); AIC only adds."""

    async def _new(
        self, kind: str, title: str, source: str, content_type: str, size: int, scope: str, raw_key_name: str
    ) -> dict[str, Any]:
        item_id = new_item_id()
        return await self.store.create_item(
            {
                "id": item_id,
                "kind": kind,
                "title": title,
                "source": source,
                "content_type": content_type,
                "size_bytes": size,
                "scope": scope,
                "raw_key": f"raw/{item_id}/{raw_key_name}",
            }
        )

    async def add_link(self, url: Any, title: Any = None, scope: Any = None) -> dict[str, Any]:
        if not isinstance(url, str):
            raise KnowledgeError("The link is missing.")
        try:
            check_url(url)
        except LinkRefused as e:
            raise KnowledgeError(str(e)) from e
        url = url.strip()
        item = await self._new(
            "link", check_title(title, url), url, "text/uri-list", len(url), check_scope(scope), "link.json"
        )
        await self.blobs.put(item["raw_key"], json.dumps({"url": url}).encode(), "application/json")
        return item_json(item)

    async def add_text(self, text: Any, title: Any, scope: Any = None) -> dict[str, Any]:
        if not isinstance(text, str) or not text.strip():
            raise KnowledgeError("The text is missing.")
        if len(text) > MAX_TEXT_CHARS:
            raise KnowledgeError("That text is longer than 200,000 characters. Upload it as a file instead.")
        body = text.encode()
        item = await self._new(
            "text", check_title(title), "pasted text", "text/markdown", len(body), check_scope(scope), "note.md"
        )
        await self.blobs.put(item["raw_key"], body, "text/markdown; charset=utf-8")
        return item_json(item)

    async def create_upload(self, b: dict[str, Any]) -> dict[str, Any]:
        name = b.get("file_name")
        if not isinstance(name, str) or not name.strip():
            raise KnowledgeError("The file name is missing.")
        ct = b.get("content_type")
        ct = ct.strip()[:200] if isinstance(ct, str) and ct.strip() else "application/octet-stream"
        size = b.get("size_bytes")
        if isinstance(size, bool) or not isinstance(size, int | float) or not math.isfinite(size) or size <= 0:
            raise KnowledgeError("The file size is missing.")
        if size > MAX_UPLOAD_BYTES:
            raise KnowledgeError("That file is larger than 5 GB.")
        safe = safe_file_name(name)
        item = await self._new(
            route_file(safe, ct).kind,
            check_title(b.get("title"), safe),
            safe,
            ct,
            int(size),
            check_scope(b.get("scope")),
            safe,
        )
        key = item["raw_key"]
        upload: dict[str, Any]
        if size <= SINGLE_PUT_MAX_BYTES:
            upload = {"method": "PUT", "url": await self.blobs.presign_put(key, ct), "headers": {"content-type": ct}}
        else:
            upload_id = await self.blobs.start_multipart(key, ct)
            count = math.ceil(size / PART_SIZE_BYTES)
            upload = {
                "multipart": True,
                "upload_id": upload_id,
                "part_size": PART_SIZE_BYTES,
                "part_urls": [await self.blobs.presign_part(key, upload_id, n) for n in range(1, count + 1)],
            }
            item = await self.store.update_item(item["id"], {"upload_id": upload_id}) or item
        return {"item": item_json(item), "upload": upload}

    async def complete_upload(self, item_id: str, b: dict[str, Any]) -> dict[str, Any]:
        item = await self._get(item_id)
        upload_id = b.get("upload_id")
        if not item.get("upload_id") or upload_id != item["upload_id"]:
            raise KnowledgeError("That upload does not belong to this item.")
        if item.get("status") != "uploading":
            raise KnowledgeError("That upload is already finished.")
        parts = b.get("parts")
        if not isinstance(parts, list) or not parts:
            raise KnowledgeError("The uploaded parts are missing.")
        clean: list[dict[str, Any]] = []
        for p in parts:
            if (
                not isinstance(p, dict)
                or not isinstance(p.get("part_number"), int)
                or not isinstance(p.get("etag"), str)
            ):
                raise KnowledgeError("An uploaded part could not be read.")
            clean.append({"part_number": p["part_number"], "etag": p["etag"]})
        await self.blobs.complete_multipart(
            item["raw_key"], str(upload_id), sorted(clean, key=lambda p: p["part_number"])
        )
        return item_json(await self.store.update_item(item_id, {"upload_id": None}) or item)

    async def _get(self, item_id: str) -> dict[str, Any]:
        item = await self.store.get_item(item_id)
        if not item:
            raise NotFound("That item does not exist.")
        return item

    async def get(self, item_id: str) -> dict[str, Any]:
        item = await self._get(item_id)
        entities = await self.store.entities_of(item_id)
        return {**item_json(item), "entities": [{"name": e["name"], "type": e["type"]} for e in entities]}

    async def list(self, limit: int | None = None) -> dict[str, Any]:
        items = await self.store.list_items(limit)
        return {
            "items": [item_json(i) for i in items],
            "always_tokens": await self.store.always_tokens(),
            "always_budget": ALWAYS_BUDGET_TOKENS,
        }

    async def update(self, item_id: str, b: dict[str, Any]) -> dict[str, Any]:
        item = await self._get(item_id)
        patch: dict[str, Any] = {}
        if b.get("title") is not None:
            patch["title"] = check_title(b["title"])
        if b.get("scope") is not None:
            patch["scope"] = check_scope(b["scope"])
        if not patch:
            raise KnowledgeError("Nothing to change.")
        new = await self.store.update_item(item_id, patch) or item
        if patch.get("scope") and patch["scope"] != item.get("scope"):
            for key in new.get("normalized_keys") or []:
                await self.blobs.put(
                    f"{key}.metadata.json",
                    json.dumps(metadata_doc(item_id, new["scope"], new["kind"])).encode(),
                    "application/json",
                )
            if new.get("normalized_keys"):
                await self._sync()
        if new.get("scope") != item.get("scope") or new.get("title") != item.get("title"):
            await self.bus.put(updated_event(new))
        return item_json(new)

    async def delete(self, item_id: str) -> None:
        item = await self._get(item_id)
        if item.get("upload_id"):
            try:
                await self.blobs.abort_multipart(item["raw_key"], str(item["upload_id"]))
            except Exception as e:
                log("warn", "knowledge.abort_upload_failed", item=item_id, error=type(e).__name__)
        for prefix in ("raw", "work", "normalized"):
            await self.blobs.delete_prefix(f"{prefix}/{item_id}/")
        await self.store.delete_item(item_id)
        if item.get("normalized_keys"):
            await self._sync()

    async def _sync(self) -> None:
        """Re-sync after a change. Search already follows the item record, so a busy data source can wait."""
        if not self.kb:
            return
        try:
            await self.kb.start_sync()
        except ConflictException:
            log("info", "knowledge.sync_busy")


@dataclass
class KnowledgeAccess:
    """What agent turns get: search for every role (store + KB), adding for AIC (the service)."""

    store: KnowledgeStore
    kb: KnowledgeBase | None = None
    service: KnowledgeService | None = None
