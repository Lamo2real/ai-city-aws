"""Download of a knowledge document's original (the owner, 2026-11-11): a short-lived presigned S3 GET.

- The owner's items and the built-in AI City guide: the object under ``raw_key`` as uploaded (the guide's is its
  PDF), byte for byte, from the moment the upload has arrived (while it is still being read too); an upload that has
  not arrived is 404. A link: the page text the pipeline saved, as one ``.md`` (decision 270); before it is read, 400.
- Department and shared entries (§17): the version agents read (``served``). While that is the shipped default, the
  seed file exactly as shipped (front matter included; a whole document byte for byte); once the owner has edited it,
  or for the owner's own entry, the same seed-file form made from the record (a whole document: its text). The bytes
  are written to ``downloads/entries/<entry id>/<sha256>.md`` on every request (the lifecycle rule expires
  ``downloads/`` after a day) and that object is presigned.

A department's whole knowledge (the owner, 2026-11-12, decision 268): one ``<Department> knowledge.zip`` with the
active version of every entry that is not deleted or retired (``entry_bytes``, so the owner's edits are in and
deleted entries are out), each named after its title, and a ``README.md`` listing them. The zip is written entry by
entry into a spooled temporary file (memory up to 16 MB, then ``/tmp``) and uploaded from it to
``downloads/departments/<department>/<random>.zip``, so a large department never sits in memory twice.

Only the owner reaches the routes (``handle_http``'s Cognito check); agents have no tool for it.
"""

from __future__ import annotations

import hashlib
import re
import tempfile
import time
import uuid
import zipfile
from typing import Any

from .blobs import Blobs
from .builtin import TITLE as GUIDE_TITLE
from .entries import EntryError, SeedSet, entry_from_fields, entry_markdown
from .registry import EntryRegistry, served
from .service import KnowledgeError, NotFound
from .store import KnowledgeStore

DOWNLOAD_SECONDS = 300
"""The presigned address works for five minutes: enough to start the download, too short to pass around."""
DOWNLOAD_PREFIX = "downloads/"
_MARKDOWN = "text/markdown; charset=utf-8"
_ZIP = "application/zip"
_SPOOL = 16 * 1024 * 1024


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
        return await _link_download(blobs, item)
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


async def _link_download(blobs: Blobs, item: dict[str, Any]) -> dict[str, Any]:
    """A link's saved page as one Markdown file (decision 270): the text the pipeline read, its parts joined in
    order, without the site profile. Written under ``downloads/items/`` and presigned like an entry's file."""
    keys = [str(k) for k in item.get("normalized_keys") or [] if not str(k).endswith("/site-profile.md")]
    if not keys:
        raise KnowledgeError("This page hasn't been read yet: open the link instead, or try again in a minute.")
    body = b"\n".join([await blobs.get(k) for k in keys])
    key = f"{DOWNLOAD_PREFIX}items/{item['id']}/{hashlib.sha256(body).hexdigest()[:32]}.md"
    await blobs.put(key, body, _MARKDOWN)
    name = file_name(str(item.get("title") or "page"), ".md")
    url = await blobs.presign_get(key, name, False, _MARKDOWN, DOWNLOAD_SECONDS)
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


def _unique(name: str, taken: set[str]) -> str:
    """``name``, or ``name (2)`` and so on when two entries share a title (case-insensitive file systems too)."""
    base, ext = name.rsplit(".", 1)
    out, n = name, 2
    while out.lower() in taken:
        out, n = f"{base} ({n}).{ext}", n + 1
    taken.add(out.lower())
    return out


async def department_download(
    registry: EntryRegistry, seeds: SeedSet, blobs: Blobs, department: str
) -> dict[str, Any] | None:
    """``{url, file_name, expires_in, entries}`` for a department's whole knowledge as a zip; None if unknown."""
    tax = seeds.taxonomies.get(department)
    if not tax:
        return None
    recs = [r for r in await registry.in_department(department) if not r.get("deleted") and not r.get("retired")]
    recs.sort(key=lambda r: (str((served(r) or r).get("domain") or ""), str((served(r) or r).get("title") or "")))
    label = f"{tax.label} knowledge"
    stamp = time.localtime()[:6]
    taken: set[str] = {"readme.md"}
    listed: list[str] = []
    with tempfile.SpooledTemporaryFile(max_size=_SPOOL) as tmp:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
            for rec in recs:
                s = served(rec) or rec
                title = str(s.get("title") or s.get("entry_id") or "entry")
                name = _unique(file_name(title, ".md"), taken)
                z.writestr(zipfile.ZipInfo(name, stamp), entry_bytes(rec, seeds), zipfile.ZIP_DEFLATED)
                listed.append(f"- {name} — {title} (`{s.get('entry_id')}`)")
            readme = (
                f"# {label}\n\n{len(recs)} entries: the version the {tax.label} agents use today, with your edits. "
                f"Deleted entries are left out.\n\n" + "\n".join(listed) + "\n"
            )
            z.writestr(zipfile.ZipInfo("README.md", stamp), readme.encode(), zipfile.ZIP_DEFLATED)
        key = f"{DOWNLOAD_PREFIX}departments/{department}/{uuid.uuid4().hex}.zip"
        await blobs.put_file(key, tmp, _ZIP)
    zip_name = file_name(label, ".zip")
    url = await blobs.presign_get(key, zip_name, False, _ZIP, DOWNLOAD_SECONDS)
    return {"url": url, "file_name": zip_name, "expires_in": DOWNLOAD_SECONDS, "entries": len(recs)}
