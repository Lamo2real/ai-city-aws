"""The live working copy of an app while workers build it (the owner, 2026-11-12, decision 278).

Worker side (``LivePreview``, in the worker runtime): after a worker's file tool call, the app/ folder is scanned at
most about once a second; files that changed are put in the worker's own ``hires/<hire_id>/app/`` (the prefix
``submit_app`` uses, so no new permission) and ``app.preview.files`` goes on the bus with the changed paths and,
where the edit itself shows it, a CSS selector it touched. Nothing is sent until ``index.html`` exists.

Apps Lambda side (``stage_preview``): copies just those paths to ``drafts/<preview_id>/`` on the apps origin (the
same sandboxed origin, CSP and content-type rules as every draft; ``no-cache``), with the city's bridge (which
answers ``preview`` to everything: no owner data) and ``vaic-live.js`` (scroll kept across reloads, pointers on the
changed elements) added. One preview per job (``PREVIEW#<task_id>`` in ``APPDRAFTS``), its id 128 random bits,
handed only to the owner's HUD in ``app.preview``. A preview is never a draft or a version: nothing here writes a
``DRAFT#`` record, an app, ``live/`` or an approval. ``drafts/`` expire after 30 days.
"""

from __future__ import annotations

import asyncio
import os
import re
import secrets
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

from .apps import (
    BRIDGE,
    BRIDGE_JS,
    DRAFTS_PK,
    MAX_FILE_BYTES,
    MAX_FILES,
    AppsOrigin,
    content_type,
    extension,
    is_hire_id,
    path_problem,
    submission_prefix,
)
from .events import EventBus, now_iso
from .ledger import Ledger, Record, strip
from .log import log
from .table import ABSENT, UpdateOptions

LIVE = "vaic-live.js"
LIVE_JS = (Path(__file__).resolve().parents[1] / "assets" / LIVE).read_bytes()
MAX_PATHS = 40
"""Paths per event; a bigger change is cut (the next change sends the rest)."""
FILE_TOOLS = frozenset({"Write", "Edit", "MultiEdit", "NotebookEdit", "Bash"})
_PREVIEW = re.compile(r"prv-[0-9a-f]{32}")


# ---------- where an edit landed ----------
_ID = re.compile(r"""\bid\s*=\s*["']?([A-Za-z][\w-]{0,60})""")
_CLASS = re.compile(r"""\bclass\s*=\s*["']([A-Za-z][\w-]{0,60})""")
_TAG = re.compile(r"<(header|main|nav|footer|section|button|canvas|h1|h2|h3|form|ul|table|img)\b", re.I)
_CSS = re.compile(r"(?:^|})\s*([#.]?[A-Za-z][\w-]{0,60})(?:[\s:,>.#\[][^{}]{0,80})?\{")
_JS = re.compile(
    r"""(?:getElementById\(\s*["']([A-Za-z][\w-]{0,60})["']|querySelector(?:All)?\(\s*["']([#.]?[A-Za-z][\w-]{0,60})["'])"""
)


def selector_for(path: str, text: str) -> str | None:
    """The element an edit most likely changed, from the text it wrote (agent text: only a plain selector of
    letters, digits, '-' and '_' is ever kept)."""
    ext = extension(path)
    if not text:
        return None
    if ext == "html":
        if m := _ID.search(text):
            return f"#{m.group(1)}"
        if m := _CLASS.search(text):
            return f".{m.group(1)}"
        if m := _TAG.search(text):
            return m.group(1).lower()
        return None
    if ext == "css":
        m = _CSS.search(text)
        return m.group(1) if m and m.group(1) not in ("from", "to") else None
    if ext in ("js", "mjs"):
        m = _JS.search(text)
        if not m:
            return None
        return f"#{m.group(1)}" if m.group(1) else m.group(2)
    return None


def _written(tool: str, args: dict[str, Any]) -> str:
    if tool == "Write":
        return str(args.get("content") or "")
    if tool == "Edit":
        return str(args.get("new_string") or "")
    if tool == "MultiEdit":
        return "\n".join(str(e.get("new_string") or "") for e in args.get("edits") or [] if isinstance(e, dict))
    return ""


# ---------- the worker's side ----------
class LivePreview:
    """One worker turn's live sync of its app/ folder. ``touched`` is called for every allowed tool call; the scan
    runs ``delay`` seconds later (calls in between share it), and once more when the turn ends."""

    def __init__(
        self,
        bus: EventBus,
        s3_for: Callable[[str], Any],
        bucket: str,
        root: str,
        hire_id: str,
        ticket_id: str,
        task_id: str,
        delay: float = 1.0,
        min_gap: float = 1.0,
    ) -> None:
        self.bus, self.s3_for, self.bucket = bus, s3_for, bucket
        self.hire_id, self.ticket_id, self.task_id = hire_id, ticket_id, task_id
        self.app = Path(root) / hire_id / "app"
        self.delay, self.min_gap = delay, min_gap
        self.sent: dict[str, tuple[int, int]] = {}
        self.hints: dict[str, str | None] = {}
        self._timer: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()
        self._last = 0.0
        self._s3: Any = None
        self.events = 0

    def touched(self, tool: str, args: dict[str, Any]) -> None:
        if tool not in FILE_TOOLS:
            return
        fp = str(args.get("file_path") or args.get("notebook_path") or "")
        if fp:
            rel = self._rel(fp)
            if rel is None:
                return  # a file outside app/: nothing to show
            self.hints[rel] = selector_for(rel, _written(tool, args)) or self.hints.get(rel)
        if self._timer is None or self._timer.done():
            self._timer = asyncio.create_task(self._later())

    def _rel(self, fp: str) -> str | None:
        p = Path(fp)
        if not p.is_absolute():
            p = self.app.parent / p
        try:
            return p.resolve().relative_to(self.app.resolve()).as_posix()
        except ValueError:
            return None

    async def _later(self) -> None:
        await asyncio.sleep(max(self.delay, self.min_gap - (time.monotonic() - self._last)))
        await self.flush()

    async def close(self) -> None:
        """At the end of the turn: whatever changed since the last scan goes out now."""
        if self._timer is not None and not self._timer.done():
            self._timer.cancel()
        await self.flush()

    def _scan(self) -> dict[str, tuple[int, int]]:
        out: dict[str, tuple[int, int]] = {}
        if not self.app.is_dir() or self.app.is_symlink():
            return out
        base = self.app.resolve()
        for dirpath, dirnames, filenames in os.walk(base, followlinks=False):
            dirnames[:] = [n for n in dirnames if not n.startswith(".") and not (Path(dirpath) / n).is_symlink()]
            for n in filenames:
                f = Path(dirpath) / n
                rel = f.relative_to(base).as_posix()
                if f.is_symlink() or path_problem(rel) is not None:
                    continue
                st = f.stat()
                if st.st_size <= MAX_FILE_BYTES:
                    out[rel] = (st.st_mtime_ns, st.st_size)
                if len(out) >= MAX_FILES:
                    return out
        return out

    async def flush(self) -> None:
        async with self._lock:
            try:
                await self._flush()
            except Exception as e:  # the preview is a help: a failed upload never fails the worker's turn
                log("warn", "preview.flush_failed", hire=self.hire_id, error=type(e).__name__)

    async def _flush(self) -> None:
        now = await asyncio.to_thread(self._scan)
        if "index.html" not in now:
            return
        changed = sorted(p for p, sig in now.items() if self.sent.get(p) != sig)
        if not changed:
            return
        changed = changed[:MAX_PATHS]
        if self._s3 is None:
            self._s3 = await asyncio.to_thread(self.s3_for, self.hire_id)
        prefix = submission_prefix(self.hire_id)
        for p in changed:
            body = await asyncio.to_thread((self.app / p).read_bytes)
            if len(body) > MAX_FILE_BYTES:
                continue
            await asyncio.to_thread(self._s3.put_object, Bucket=self.bucket, Key=prefix + p, Body=body)
            self.sent[p] = now[p]
        hints = [{"path": p, "selector": self.hints.get(p)} for p in changed if p in self.hints]
        self.hints = {}
        self._last = time.monotonic()
        self.events += 1
        await self.bus.put(
            {
                "type": "app.preview.files",
                "hire_id": self.hire_id,
                "ticket_id": self.ticket_id,
                "task_id": self.task_id,
                "paths": changed,
                "hints": hints,
            }
        )


# ---------- the apps Lambda's side ----------
def _with_live_script(path: str, body: bytes) -> bytes:
    """Adds the city's live helper to an HTML page, relative to where the page sits."""
    tag = f'<script src="{"../" * path.count("/")}{LIVE}"></script>'.encode()
    low = body.lower()
    at = low.rfind(b"</body>")
    return body[:at] + tag + body[at:] if at != -1 else body + tag


async def get_preview(ledger: Ledger, task_id: str) -> Record | None:
    return strip(await ledger.table.get(DRAFTS_PK, f"PREVIEW#{task_id}"))


def preview_url(origin: AppsOrigin, preview_id: str) -> str:
    return f"{origin.url.rstrip('/')}/drafts/{preview_id}/index.html"


async def stage_preview(
    detail: dict[str, Any], ledger: Ledger, bus: EventBus, origin: AppsOrigin, workspace_s3: Any, workspaces_bucket: str
) -> Record | None:
    """``app.preview.files`` → the changed files in the job's live copy, and ``app.preview`` for the HUD.
    None when the event is not one to act on (not a worker, no job, nothing allowed in it)."""
    hire_id, task_id = str(detail.get("hire_id") or ""), str(detail.get("task_id") or "")
    if not is_hire_id(hire_id) or not task_id:
        return None
    paths = [
        p
        for p in dict.fromkeys(str(p) for p in detail.get("paths") or [])
        if path_problem(p) is None and p not in (BRIDGE, LIVE)  # the city's own files are never the worker's
    ]
    paths = paths[:MAX_PATHS]
    if not paths:
        return None
    rec = await get_preview(ledger, task_id)
    fresh = False
    if rec is None:  # the job's first change: one id, even when two changes arrive at once
        claim = {"preview_id": f"prv-{secrets.token_hex(16)}", "task_id": task_id, "created_at": now_iso(ledger.now())}
        won = await ledger.table.update(
            DRAFTS_PK, f"PREVIEW#{task_id}", UpdateOptions(set=claim, expect={"preview_id": ABSENT})
        )
        fresh = won is not None
        rec = strip(won) if won is not None else await get_preview(ledger, task_id)
        if rec is None:
            return None
    pid = str(rec["preview_id"])
    if not _PREVIEW.fullmatch(pid):
        return None

    async def put(path: str, body: bytes) -> None:
        await asyncio.to_thread(
            origin.s3.put_object,
            Bucket=origin.bucket,
            Key=f"drafts/{pid}/{path}",
            Body=body,
            ContentType=content_type(path),
            CacheControl="no-cache",
        )

    if fresh:
        await put(BRIDGE, BRIDGE_JS)
        await put(LIVE, LIVE_JS)
    prefix = submission_prefix(hire_id)
    done: list[str] = []
    for p in paths:
        try:
            obj = await asyncio.to_thread(workspace_s3.get_object, Bucket=workspaces_bucket, Key=prefix + p)
        except Exception as e:  # deleted again since: the next change sends the folder as it is
            log("info", "preview.file_gone", path=p, error=type(e).__name__)
            continue
        body = await asyncio.to_thread(obj["Body"].read)
        if len(body) > MAX_FILE_BYTES:
            continue
        await put(p, _with_live_script(p, body) if extension(p) == "html" else body)
        done.append(p)
    if not done:
        return None
    saved = strip(
        await ledger.table.update(
            DRAFTS_PK,
            f"PREVIEW#{task_id}",
            UpdateOptions(
                set={"updated_at": now_iso(ledger.now()), "hire_id": hire_id},
                add={"seq": 1},
            ),
        )
    )
    assert saved is not None
    hints = [
        {"path": str(h.get("path")), "selector": h.get("selector") or None}
        for h in detail.get("hints") or []
        if isinstance(h, dict) and str(h.get("path")) in done
    ]
    await bus.put(
        {
            "type": "app.preview",
            "task_id": task_id,
            "hire_id": hire_id,
            "preview_url": preview_url(origin, pid),
            "seq": int(saved.get("seq") or 1),
            "paths": done,
            "hints": hints,
        }
    )
    return saved
