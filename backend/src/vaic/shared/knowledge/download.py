"""Download of a knowledge document's original (the owner, 2026-11-11): a short-lived presigned S3 GET.

- The owner's items and the built-in AI City guide: the object under ``raw_key`` as uploaded (the guide's is its
  PDF), byte for byte. A link has no file (the HUD opens the link instead); an upload that has not arrived is 404.
- Department and shared entries (§17): the version agents read (``served``). While that is the shipped default, the
  seed file exactly as shipped (front matter included; a whole document byte for byte); once the owner has edited it,
  or for the owner's own entry, the same seed-file form made from the record (a whole document: its text). The bytes
  are written to ``downloads/entries/<entry id>/<sha256>.md`` on every request (the lifecycle rule expires
  ``downloads/`` after a day) and that object is presigned.

Only the owner reaches the routes (``handle_http``'s Cognito check); agents have no tool for it.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

from .blobs import Blobs
from .builtin import TITLE as GUIDE_TITLE
from .entries import EntryError, SeedSet, entry_from_fields, entry_markdown
from .registry import served
from .service import KnowledgeError, NotFound
from .store import KnowledgeStore

DOWNLOAD_SECONDS = 300
"""The presigned address works for five minutes: enough to start the download, too short to pass around."""
DOWNLOAD_PREFIX = "downloads/"
_MARKDOWN = "text/markdown; charset=utf-8"


def file_name(title: str, ext: str) -> str:
    """A name every file system accepts: the title without path or reserved characters, then the extension."""
    base = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', " ", title)
    base = " ".join(base.split()).strip(" .")[:120] or "document"
    return f"{base}{ext}"


async def item_download(store: KnowledgeStore, blobs: Blobs, item_id: str) -> dict[str, Any]:
    """``{url, file_name, expires_in}`` for one of the owner's items or the built-in guide."""
    item = await store.get_item(item_id)
    if not item:
        raise NotFound("That item does not exist.")
    if item.get("kind") == "link":
        raise KnowledgeError("A link has no file to download: open the link instead.")
    key = str(item.get("raw_key") or "")
    head = await blobs.head(key) if key else None
    if head is None:
        raise NotFound("That file is not there yet: wait until it has finished uploading.")
    raw_name = key.rsplit("/", maxsplit=1)[-1]
    if item.get("builtin"):
        name = file_name(GUIDE_TITLE, ".pdf")
    elif raw_name == "note.md":  # pasted text: named after its title
        name = file_name(str(item.get("title") or "note"), ".md")
    else:
        name = file_name(raw_name, "")
    ct = str(item.get("content_type") or head.content_type or "application/octet-stream")
    url = await blobs.presign_get(key, name, False, ct, DOWNLOAD_SECONDS)
    return {"url": url, "file_name": name, "expires_in": DOWNLOAD_SECONDS}


def entry_bytes(rec: dict[str, Any], seeds: SeedSet) -> bytes:
    """The active version of an entry as a file: the shipped seed file, or the owner's version in the same form."""
    s = served(rec) or rec
    eid = str(s.get("entry_id") or "")
    seed, path = seeds.entries.get(eid), seeds.paths.get(eid)
    if s.get("origin") == "system" and seed and path and s.get("content_hash") == seed.content_hash():
        try:
            return path.read_bytes()
        except OSError:
            pass  # made from the record below
    content = str(s.get("content") or "")
    tax = seeds.taxonomies.get(str(s.get("department") or ""))
    if s.get("document") or not tax:
        return f"{content}\n".encode()
    try:
        return entry_markdown(entry_from_fields(s, tax)).encode()
    except EntryError:
        return f"{content}\n".encode()


async def entry_download(rec: dict[str, Any] | None, seeds: SeedSet, blobs: Blobs) -> dict[str, Any] | None:
    """``{url, file_name, expires_in}``, or None for a missing, deleted or retired entry."""
    if not rec or rec.get("deleted") or rec.get("retired"):
        return None
    body = entry_bytes(rec, seeds)
    eid = str(rec.get("entry_id") or "")
    key = f"{DOWNLOAD_PREFIX}entries/{eid}/{hashlib.sha256(body).hexdigest()[:32]}.md"
    await blobs.put(key, body, _MARKDOWN)
    name = file_name(str((served(rec) or rec).get("title") or eid), ".md")
    url = await blobs.presign_get(key, name, False, _MARKDOWN, DOWNLOAD_SECONDS)
    return {"url": url, "file_name": name, "expires_in": DOWNLOAD_SECONDS}
