"""Apps the city builds (docs/APPS.md): validation, slugs, the APPDRAFTS / APPS ledger items, staging a
worker's submission as a draft, and publishing or removing an app.

Shared by the worker tool ``submit_app`` (early checks), the apps Lambda (the checks that count) and the API
(publish, refuse, remove). S3 and CloudFront clients are injected (boto3 clients in production, fakes in
tests), so nothing here talks to AWS by itself. Agent-written text and file lists are untrusted: every check
runs again on what is actually in the bucket.
"""

from __future__ import annotations

import asyncio
import hashlib
import re
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .app_caps import MANIFEST, Capability, Invalid, cap_key, check_manifest, clean_cap, labelled, subset
from .app_state import delete_state
from .events import EventBus, now_iso
from .ids import new_id
from .ledger import Ledger, Record, strip
from .presets import replaced_by
from .table import UpdateOptions

MAX_HISTORY = 5

MAX_FILES = 300
MAX_TOTAL_BYTES = 10 * 1024 * 1024
MAX_FILE_BYTES = 2 * 1024 * 1024
TITLE_MAX = 40
DESCRIPTION_MAX = 200
DRAFTS_PK = "APPDRAFTS"
APPS_PK = "APPS"

CONTENT_TYPES: dict[str, str] = {
    "html": "text/html; charset=utf-8",
    "css": "text/css; charset=utf-8",
    "js": "text/javascript; charset=utf-8",
    "mjs": "text/javascript; charset=utf-8",
    "json": "application/json",
    "txt": "text/plain; charset=utf-8",
    "md": "text/markdown; charset=utf-8",
    "svg": "image/svg+xml",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "ico": "image/x-icon",
    "mp3": "audio/mpeg",
    "ogg": "audio/ogg",
    "wav": "audio/wav",
    "woff": "font/woff",
    "woff2": "font/woff2",
}
ICON_EXTENSIONS = ("svg", "png")
_PATH = re.compile(r"[A-Za-z0-9._/-]+")
_HIRE = re.compile(r"wkr-[a-z0-9-]{1,80}")
_CONTROL = re.compile(r"[\x00-\x1f\x7f]+")
BRIDGE = "vaic-bridge.js"
BRIDGE_JS = (Path(__file__).resolve().parents[1] / "assets" / BRIDGE).read_bytes()
"""The city's own bridge script, added to every staged app (never the worker's file of that name)."""
MAX_PINNED = 6


# ---------- validation (same code for the tool and the Lambda) ----------
def extension(path: str) -> str:
    name = path.rsplit("/", 1)[-1]
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def path_problem(path: str) -> str | None:
    """Why this relative path is not allowed, or None."""
    if not path or len(path) > 200:
        return f"{path!r}: the path is empty or too long"
    if not _PATH.fullmatch(path):
        return f"{path}: only letters, digits, '.', '_', '-' and '/' are allowed"
    if path.startswith("/"):
        return f"{path}: paths must be relative"
    parts = path.split("/")
    if any(p in ("", ".", "..") for p in parts):
        return f"{path}: no empty, '.' or '..' parts"
    if any(p.startswith(".") for p in parts):
        return f"{path}: hidden files are not allowed"
    if extension(path) not in CONTENT_TYPES:
        return f"{path}: the file type is not allowed"
    return None


def validate_files(files: Iterable[dict[str, Any]], icon: str | None = None) -> str | None:
    """Checks a submission's file list ([{path, size}]). Returns the first problem, or None."""
    items = list(files)
    if not items:
        return "the app folder is empty"
    if len(items) > MAX_FILES:
        return f"{len(items)} files is more than the {MAX_FILES}-file limit"
    seen: set[str] = set()
    total = 0
    for f in items:
        path, size = str(f.get("path", "")), int(f.get("size", 0))
        bad = path_problem(path)
        if bad:
            return bad
        if path in seen:
            return f"{path}: listed twice"
        seen.add(path)
        if size > MAX_FILE_BYTES:
            return f"{path}: {size} bytes is over the 2 MB per-file limit"
        total += size
    if total > MAX_TOTAL_BYTES:
        return f"{total} bytes in total is over the 10 MB limit"
    if "index.html" not in seen:
        return "index.html is missing at the top of the app folder"
    if icon is not None:
        if icon not in seen:
            return f"the icon {icon} is not in the app folder"
        if extension(icon) not in ICON_EXTENSIONS:
            return "the icon must be an .svg or .png file"
    return None


def content_type(path: str) -> str:
    """Set by the city from the extension, never taken from the worker."""
    return CONTENT_TYPES[extension(path)]


def cache_control(path: str) -> str:
    return "no-cache" if extension(path) == "html" else "max-age=300"


def clean_text(value: Any, cap: int) -> str:
    """Agent text for the HUD: one line, no control characters, capped."""
    return _CONTROL.sub(" ", str(value or "")).strip()[:cap]


def slugify(title: str, taken: Iterable[str] = ()) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40].strip("-") or "app"
    used = set(taken)
    if base not in used:
        return base
    n = 2
    while True:
        tail = f"-{n}"
        slug = f"{base[: 40 - len(tail)].rstrip('-')}{tail}"
        if slug not in used:
            return slug
        n += 1


def home_department(name: Any) -> str:
    """The department an app belongs to: one a preset took over ("Apps") belongs to that preset (Application,
    decision 220), so a late submission from the old department still lands in the right building."""
    s = str(name or "")
    p = replaced_by(s)
    return str(p["name"]) if p else s


def is_hire_id(hire_id: str) -> bool:
    return _HIRE.fullmatch(hire_id) is not None


# ---------- ledger helpers ----------
async def get_draft(ledger: Ledger, draft_id: str) -> Record | None:
    return strip(await ledger.table.get(DRAFTS_PK, f"DRAFT#{draft_id}"))


async def put_draft(ledger: Ledger, draft: Record) -> None:
    await ledger.table.put({"pk": DRAFTS_PK, "sk": f"DRAFT#{draft['draft_id']}", **draft})


async def update_draft(ledger: Ledger, draft_id: str, patch: Record, expect: Record | None = None) -> Record | None:
    """Patches a draft; with ``expect``, only when those fields still match (None when they did not)."""
    return strip(
        await ledger.table.update(
            DRAFTS_PK, f"DRAFT#{draft_id}", UpdateOptions(set=patch, expect=expect or {}, must_exist=True)
        )
    )


async def list_drafts(ledger: Ledger) -> list[Record]:
    return sorted(
        (r for r in (strip(i) for i in await ledger.table.query(DRAFTS_PK, "DRAFT#")) if r),
        key=lambda r: str(r.get("created_at", "")),
    )


async def drafts_of_ticket(ledger: Ledger, ticket_id: str) -> list[Record]:
    return [r for r in await list_drafts(ledger) if r.get("ticket_id") == ticket_id]


async def list_apps(ledger: Ledger) -> list[Record]:
    """Published apps, newest first."""
    apps = [r for r in (strip(i) for i in await ledger.table.query(APPS_PK, "APP#")) if r]
    return sorted(apps, key=lambda r: str(r.get("published_at", "")), reverse=True)


async def get_app(ledger: Ledger, app_id: str) -> Record | None:
    return strip(await ledger.table.get(APPS_PK, f"APP#{app_id}"))


# ---------- S3 helpers (boto3-shaped clients; calls run in a thread) ----------
async def list_objects(s3: Any, bucket: str, prefix: str) -> list[dict[str, Any]]:
    """[{key, size}] under a prefix, every page."""
    out: list[dict[str, Any]] = []
    token: str | None = None
    while True:
        kw: dict[str, Any] = {"Bucket": bucket, "Prefix": prefix}
        if token:
            kw["ContinuationToken"] = token
        r = await asyncio.to_thread(s3.list_objects_v2, **kw)
        out += [{"key": o["Key"], "size": int(o.get("Size", 0))} for o in r.get("Contents") or []]
        token = r.get("NextContinuationToken") if r.get("IsTruncated") else None
        if not token:
            return out


async def delete_prefix(s3: Any, bucket: str, prefix: str) -> int:
    keys = [o["key"] for o in await list_objects(s3, bucket, prefix)]
    for i in range(0, len(keys), 1000):
        chunk = keys[i : i + 1000]
        await asyncio.to_thread(
            s3.delete_objects, Bucket=bucket, Delete={"Objects": [{"Key": k} for k in chunk], "Quiet": True}
        )
    return len(keys)


# ---------- the worker's side: submit_app ----------
@dataclass
class Workspace:
    """Where a worker's files are and how it reaches its own S3 prefix."""

    bucket: str
    s3_for: Callable[[str], Any]
    """hire_id → an S3 client on the workspace role, assumed with the session tag ``hire_id``."""
    root: str = "/tmp/work"  # noqa: S108
    apps_url: str | None = None
    """The public apps origin (``VAIC_APPS_URL``), read by ``load_app`` to fetch an app's current version."""


def workspace_from_env(session: Any, env: dict[str, str] | Any) -> Workspace | None:
    """Production wiring for the worker runtime (None when the env does not name a workspace)."""
    bucket, role = env.get("VAIC_WORKSPACES_BUCKET"), env.get("VAIC_WORKSPACE_ROLE_ARN")
    if not bucket or not role:
        return None
    sts = session.client("sts")

    def s3_for(hire_id: str) -> Any:
        c = sts.assume_role(
            RoleArn=role,
            RoleSessionName=hire_id[:64],
            Tags=[{"Key": "hire_id", "Value": hire_id}],
            DurationSeconds=900,
        )["Credentials"]
        return session.client(
            "s3",
            aws_access_key_id=c["AccessKeyId"],
            aws_secret_access_key=c["SecretAccessKey"],
            aws_session_token=c["SessionToken"],
        )

    return Workspace(bucket=bucket, s3_for=s3_for, apps_url=env.get("VAIC_APPS_URL") or None)


def submission_prefix(hire_id: str) -> str:
    return f"hires/{hire_id}/app/"


# ---------- the apps Lambda's side: stage a submission ----------
@dataclass
class AppsOrigin:
    """The apps bucket and its CloudFront distribution."""

    s3: Any
    bucket: str
    url: str
    """https://<apps distribution domain>, no trailing slash."""
    cloudfront: Any = None
    distribution_id: str | None = None

    def preview_url(self, draft_id: str) -> str:
        return f"{self.url.rstrip('/')}/drafts/{draft_id}/index.html"

    def live_url(self, app_id: str, path: str = "index.html") -> str:
        return f"{self.url.rstrip('/')}/live/{app_id}/{path}"


async def stage_submission(
    detail: dict[str, Any], ledger: Ledger, bus: EventBus, origin: AppsOrigin, workspace_s3: Any, workspaces_bucket: str
) -> Record:
    """``app.submitted`` → a draft: re-checks what is actually in the worker's prefix, copies it to
    ``drafts/<draft_id>/`` with the city's content types, and records the draft (``ready`` or ``rejected``)."""
    hire_id = str(detail.get("hire_id", ""))
    draft_id = new_id("drf")
    title = clean_text(detail.get("title"), TITLE_MAX)
    icon = detail.get("icon") or None
    draft: Record = {
        "draft_id": draft_id,
        "hire_id": hire_id,
        "ticket_id": str(detail.get("ticket_id", "")),
        "task_id": str(detail.get("task_id", "")),
        "department": home_department(detail.get("department")),
        "title": title,
        "description": clean_text(detail.get("description"), DESCRIPTION_MAX),
        "icon": str(icon) if icon else None,
        "status": "staging",
        "reason": None,
        "files": [],
        "total_bytes": 0,
        "preview_url": None,
        "approval_id": None,
        "capabilities": [],
        "pin": False,
        "replaces": None,
        "created_at": now_iso(ledger.now()),
    }
    # A task about an existing app (VAIC passed its app_id) makes a new version of that app.
    task = await ledger.get_ticket(draft["task_id"]) if draft["task_id"] else None
    target = str((task or {}).get("app_id") or "")
    if target and await get_app(ledger, target):
        draft["replaces"] = target
    await put_draft(ledger, draft)
    # A new submission replaces the hire's older drafts that are not yet with the owner.
    for old in await list_drafts(ledger):
        if old["draft_id"] != draft_id and old.get("hire_id") == hire_id and old.get("status") in ("staging", "ready"):
            await update_draft(ledger, old["draft_id"], {"status": "rejected", "reason": "replaced"})

    problem: str | None = None
    files: list[dict[str, Any]] = []
    if not is_hire_id(hire_id):
        problem = "the submission does not come from a worker"
    elif len(title) < 3:
        problem = "the title is missing"
    else:
        prefix = submission_prefix(hire_id)
        files = [
            {"path": o["key"][len(prefix) :], "size": o["size"]}
            for o in await list_objects(workspace_s3, workspaces_bucket, prefix)
        ]
        problem = validate_files(files, draft["icon"])

    caps: list[Capability] = []
    pin = False
    if problem is None and any(f["path"] == MANIFEST for f in files):
        obj = await asyncio.to_thread(
            workspace_s3.get_object, Bucket=workspaces_bucket, Key=submission_prefix(hire_id) + MANIFEST
        )
        try:
            caps, pin = await check_manifest(await asyncio.to_thread(obj["Body"].read), ledger)
        except Invalid as e:
            problem = str(e)

    if problem is None:
        prefix = submission_prefix(hire_id)
        staged: list[dict[str, Any]] = []
        for f in [f for f in files if f["path"] != BRIDGE]:
            obj = await asyncio.to_thread(workspace_s3.get_object, Bucket=workspaces_bucket, Key=prefix + f["path"])
            body = await asyncio.to_thread(obj["Body"].read)
            if len(body) > MAX_FILE_BYTES:  # the listing said otherwise; trust the bytes
                problem = f"{f['path']}: over the 2 MB per-file limit"
                break
            await asyncio.to_thread(
                origin.s3.put_object,
                Bucket=origin.bucket,
                Key=f"drafts/{draft_id}/{f['path']}",
                Body=body,
                ContentType=content_type(f["path"]),
                CacheControl=cache_control(f["path"]),
            )
            staged.append({"path": f["path"], "size": len(body), "type": content_type(f["path"])})
        if problem is None:
            await asyncio.to_thread(
                origin.s3.put_object,
                Bucket=origin.bucket,
                Key=f"drafts/{draft_id}/{BRIDGE}",
                Body=BRIDGE_JS,
                ContentType=content_type(BRIDGE),
                CacheControl=cache_control(BRIDGE),
            )
            staged.append({"path": BRIDGE, "size": len(BRIDGE_JS), "type": content_type(BRIDGE)})
        files = staged

    if problem is None:
        patch: Record = {
            "status": "ready",
            "files": files,
            "total_bytes": sum(f["size"] for f in files),
            "preview_url": origin.preview_url(draft_id),
            "capabilities": await labelled(ledger, caps),
            "pin": pin,
        }
    else:
        patch = {"status": "rejected", "reason": problem}
    out = await update_draft(ledger, draft_id, patch)
    assert out is not None
    event: dict[str, Any] = {
        "type": "app.draft",
        "draft_id": draft_id,
        "ticket_id": out["ticket_id"],
        "task_id": out["task_id"],
        "department": out["department"],
        "title": out["title"],
        "status": out["status"],
    }
    if problem is not None:
        event["reason"] = problem
    else:
        event["preview_url"] = out["preview_url"]
    await bus.put(event)
    return out


# ---------- sign-off: ask the owner to publish ----------
def publish_hash(draft_id: str) -> str:
    return hashlib.sha256(f"app.publish\n{draft_id}".encode()).hexdigest()


async def request_publish_approvals(ledger: Ledger, bus: EventBus, task_id: str, agent_id: str) -> list[Record]:
    """One ``app.publish`` approval per ready draft of the task (city code, not the prompt). Idempotent: a
    draft that already waits for the owner is not asked again."""
    filed: list[Record] = []
    for dr in await list_drafts(ledger):
        if dr.get("task_id") != task_id or dr.get("status") != "ready":
            continue
        claimed = await update_draft(ledger, dr["draft_id"], {"status": "awaiting_owner"}, expect={"status": "ready"})
        if claimed is None:
            continue
        old = await get_app(ledger, str(dr.get("replaces"))) if dr.get("replaces") else None
        version = int((old or {}).get("version") or 1) + 1 if old else 1
        action = (
            f"Update the app “{old['title']}” to version {version}"
            if old
            else f"Publish the app “{dr['title']}” under Apps"
        )
        update = {"replaces": old["app_id"], "version": version} if old else {}
        reason = "Apps run in AI City only after the owner approves them."
        a = await ledger.request_approval(
            {
                "agent": agent_id,
                "ticket_id": task_id,
                "tool": "app.publish",
                "action": action,
                "hash": publish_hash(dr["draft_id"]),
                "reason": reason,
                "kind": "app.publish",
                "draft_id": dr["draft_id"],
                "preview_url": dr["preview_url"],
                "title": dr["title"],
                "description": dr.get("description", ""),
                "capabilities": dr.get("capabilities") or [],
                "pin": bool(dr.get("pin")),
                **update,
            }
        )
        await update_draft(ledger, dr["draft_id"], {"approval_id": a["id"]})
        await bus.put(
            {
                "type": "approval.requested",
                "id": a["id"],
                "agent": agent_id,
                "action": action,
                "reason": reason,
                "kind": "app.publish",
                "draft_id": dr["draft_id"],
                "preview_url": dr["preview_url"],
                "title": dr["title"],
                "description": dr.get("description", ""),
                "capabilities": dr.get("capabilities") or [],
                "pin": bool(dr.get("pin")),
                **update,
            }
        )
        filed.append(a)
    return filed


# ---------- the owner's side: publish, refuse, remove ----------
async def publish_draft(
    ledger: Ledger,
    bus: EventBus,
    origin: AppsOrigin,
    draft_id: str,
    grants: list[Capability] | None = None,
    pinned: bool | None = None,
) -> Record:
    """Copies ``drafts/<draft_id>/`` to ``live/<app_id>/`` and records the app with the owner's grants (a subset
    of the draft's capabilities; default all) and pin (default the manifest's suggestion, while fewer than 6 are
    pinned). Idempotent on draft_id. Raises ValueError for grants the draft didn't ask for."""
    # Two approvals of one draft at the same moment (a double tap, the Chief of Staff and the owner together)
    # would each pass the check below and publish the app twice. One at a time; the second finds it published.
    lock = f"publish:{draft_id}"
    if not await ledger.claim(lock, 300):
        raise ValueError("That app is being published right now. Give it a moment.")
    try:
        return await _publish_draft(ledger, bus, origin, draft_id, grants, pinned)
    finally:
        await ledger.table.delete(f"IDEMP#{lock}", "META")


async def _publish_draft(
    ledger: Ledger,
    bus: EventBus,
    origin: AppsOrigin,
    draft_id: str,
    grants: list[Capability] | None,
    pinned: bool | None,
) -> Record:
    for existing in await list_apps(ledger):
        if existing.get("draft_id") == draft_id:
            return existing
    dr = await get_draft(ledger, draft_id)
    if not dr or dr.get("status") not in ("awaiting_owner", "ready"):
        raise ValueError("That app draft is not ready to publish.")
    asked: list[Capability] = list(dr.get("capabilities") or [])
    chosen = asked if grants is None else [clean_cap(g) for g in grants]
    if not subset(chosen, asked):
        raise Invalid("An app can only be granted what it asked for.")
    # Grants keep exactly {id, connector?, tool?}: app_call and the Cedar rewrite read this list.
    chosen = [clean_cap(c) for c in {cap_key(c): c for c in chosen}.values()]
    old = await get_app(ledger, str(dr.get("replaces"))) if dr.get("replaces") else None
    if old:
        return await _publish_version(ledger, bus, origin, dr, old, asked, chosen)
    apps_now = await list_apps(ledger)
    want_pin = bool(dr.get("pin")) if pinned is None else pinned
    if want_pin and sum(1 for a in apps_now if a.get("pinned")) >= MAX_PINNED:
        if pinned:
            raise ValueError(f"You can pin up to {MAX_PINNED} apps. Unpin one first.")
        want_pin = False
    app_id = new_id("app")
    for f in dr.get("files") or []:
        await asyncio.to_thread(
            origin.s3.copy_object,
            Bucket=origin.bucket,
            Key=f"live/{app_id}/{f['path']}",
            CopySource={"Bucket": origin.bucket, "Key": f"drafts/{draft_id}/{f['path']}"},
            MetadataDirective="REPLACE",
            ContentType=content_type(str(f["path"])),
            CacheControl=cache_control(str(f["path"])),
        )
    taken = [str(a.get("slug")) for a in apps_now]
    icon = dr.get("icon")
    # A project started in the Apps studio (conversation "app-new-…") is linked to the app it became, so its
    # chat goes on as "app-<app_id>" with what was said before.
    task = await ledger.get_ticket(str(dr["task_id"])) if dr.get("task_id") else None
    chat = str((task or {}).get("conversation") or "")
    brief = (task or {}).get("brief")
    app: Record = {
        "app_id": app_id,
        "slug": slugify(str(dr["title"]), taken),
        "title": dr["title"],
        "description": dr.get("description", ""),
        "icon_url": origin.live_url(app_id, str(icon)) if icon else None,
        "url": origin.live_url(app_id),
        "draft_id": draft_id,
        "task_id": dr.get("task_id"),
        "department": home_department(dr.get("department")),
        "capabilities": asked,
        "grants": chosen,
        "granted_at": now_iso(ledger.now()),
        "pinned": want_pin,
        "version": 1,
        "history": [],
        "revoked": [],
        "published_at": now_iso(ledger.now()),
        **({"conversation": chat} if chat.startswith("app-new-") else {}),
        **({"brief": str(brief)} if brief else {}),
    }
    await ledger.table.put({"pk": APPS_PK, "sk": f"APP#{app_id}", **app})
    await update_draft(ledger, draft_id, {"status": "published"})
    event: dict[str, Any] = {
        "type": "app.published",
        "app_id": app_id,
        "slug": app["slug"],
        "title": app["title"],
        "url": app["url"],
        "task_id": str(app["task_id"] or ""),
        "department": str(app["department"] or ""),
    }
    if app["icon_url"]:
        event["icon_url"] = app["icon_url"]
    if app.get("conversation"):
        event["conversation"] = app["conversation"]
    await bus.put(event)
    return app


async def refuse_draft(ledger: Ledger, draft_id: str) -> Record | None:
    dr = await get_draft(ledger, draft_id)
    if not dr or dr.get("status") == "published":
        return dr
    return await update_draft(ledger, draft_id, {"status": "refused"})


async def remove_app(ledger: Ledger, bus: EventBus, origin: AppsOrigin, app_id: str) -> Record | None:
    """Deletes the live files, invalidates the CDN, deletes the record. None if there is no such app."""
    app = await get_app(ledger, app_id)
    if not app:
        return None
    await delete_prefix(origin.s3, origin.bucket, f"live/{app_id}/")
    if origin.cloudfront is not None and origin.distribution_id:
        await asyncio.to_thread(
            origin.cloudfront.create_invalidation,
            DistributionId=origin.distribution_id,
            InvalidationBatch={
                "Paths": {"Quantity": 1, "Items": [f"/live/{app_id}/*"]},
                "CallerReference": new_id("inv"),
            },
        )
    await ledger.table.delete(APPS_PK, f"APP#{app_id}")
    await delete_state(ledger, app_id)
    await bus.put({"type": "app.removed", "app_id": app_id, "slug": app["slug"]})
    return app


async def update_app(ledger: Ledger, bus: EventBus, app_id: str, patch: dict[str, Any]) -> Record | None:
    """``PUT /apps/<id>``: grants may only shrink (a new grant needs a new publish); ``pinned`` up to 6 apps.
    None if there is no such app; ValueError with plain words when the change isn't allowed."""
    app = await get_app(ledger, app_id)
    if not app:
        return None
    sets: Record = {}
    if "grants" in patch:
        raw = patch["grants"]
        if not isinstance(raw, list):
            raise ValueError("grants must be a list.")
        try:
            wanted = [clean_cap(g) for g in raw]
        except Invalid as e:
            raise ValueError(str(e)) from e
        current = list(app.get("grants") or [])
        if not subset(wanted, current):
            raise ValueError("Grants can only be taken away here. Ask for a new version of the app to add one.")
        keep = {cap_key(c) for c in wanted}
        sets["grants"] = [clean_cap(c) for c in current if cap_key(c) in keep]
        gone = {cap_key(c) for c in current} - keep
        sets["revoked"] = sorted(set(app.get("revoked") or []) | gone)
    if "pinned" in patch:
        if not isinstance(patch["pinned"], bool):
            raise ValueError("pinned must be true or false.")
        if patch["pinned"] and not app.get("pinned"):
            others = sum(1 for a in await list_apps(ledger) if a.get("pinned") and a["app_id"] != app_id)
            if others >= MAX_PINNED:
                raise ValueError(f"You can pin up to {MAX_PINNED} apps. Unpin one first.")
        sets["pinned"] = patch["pinned"]
    if not sets:
        return app
    out = strip(await ledger.table.update(APPS_PK, f"APP#{app_id}", UpdateOptions(set=sets, must_exist=True)))
    if out is None:
        return None
    await bus.put({"type": "app.updated", "app": out})
    return out


# ---------- new versions of an existing app (docs/APPS.md § v3) ----------
def _version_of(app: Record) -> Record:
    """What ``history`` keeps of a version, enough to make it current again."""
    keys = ("draft_id", "url", "icon_url", "title", "description", "capabilities", "grants", "version", "published_at")
    return {k: app.get(k) for k in keys}


def _version_prefix(app_id: str, draft_id: str | None, version: int) -> str | None:
    """A version's own S3 prefix; version 1 lives at the app's root, which only removing the app deletes."""
    return f"live/{app_id}/{draft_id}/" if version > 1 and draft_id else None


async def _publish_version(
    ledger: Ledger,
    bus: EventBus,
    origin: AppsOrigin,
    dr: Record,
    old: Record,
    asked: list[Capability],
    chosen: list[Capability],
) -> Record:
    app_id, draft_id = str(old["app_id"]), str(dr["draft_id"])
    base = f"live/{app_id}/{draft_id}/"
    for f in dr.get("files") or []:
        await asyncio.to_thread(
            origin.s3.copy_object,
            Bucket=origin.bucket,
            Key=base + str(f["path"]),
            CopySource={"Bucket": origin.bucket, "Key": f"drafts/{draft_id}/{f['path']}"},
            MetadataDirective="REPLACE",
            ContentType=content_type(str(f["path"])),
            CacheControl=cache_control(str(f["path"])),
        )
    history = [_version_of(old), *(old.get("history") or [])]
    for gone in history[MAX_HISTORY:]:
        prefix = _version_prefix(app_id, gone.get("draft_id"), int(gone.get("version") or 1))
        if prefix:
            await delete_prefix(origin.s3, origin.bucket, prefix)
    icon = dr.get("icon")
    url = f"{origin.url.rstrip('/')}/{base}"
    sets: Record = {
        "url": url + "index.html",
        "icon_url": url + str(icon) if icon else None,
        "title": dr["title"],
        "description": dr.get("description", ""),
        "capabilities": asked,
        "grants": chosen,
        "granted_at": now_iso(ledger.now()),
        "draft_id": draft_id,
        "task_id": dr.get("task_id"),
        "version": int(old.get("version") or 1) + 1,
        "history": history[:MAX_HISTORY],
        "revoked": [],
        "published_at": now_iso(ledger.now()),
    }
    out = strip(await ledger.table.update(APPS_PK, f"APP#{app_id}", UpdateOptions(set=sets, must_exist=True)))
    if out is None:
        raise ValueError("That app was removed meanwhile.")
    await update_draft(ledger, draft_id, {"status": "published"})
    await bus.put({"type": "app.updated", "app": out})
    return out


async def rollback_app(ledger: Ledger, bus: EventBus, origin: AppsOrigin, app_id: str) -> Record | None:
    """``POST /apps/<id>/rollback``: the newest earlier version becomes current again; the one rolled back from is
    deleted. Grants are that version's minus what the owner revoked since. None if there is no such app;
    ValueError when there is no earlier version."""
    app = await get_app(ledger, app_id)
    if not app:
        return None
    history = list(app.get("history") or [])
    if not history:
        raise ValueError("There is no earlier version of this app.")
    prev, rest = history[0], history[1:]
    revoked = set(app.get("revoked") or [])
    grants = [clean_cap(g) for g in prev.get("grants") or [] if cap_key(g) not in revoked]
    sets: Record = {**{k: v for k, v in prev.items() if k != "grants"}, "grants": grants, "history": rest}
    sets["version"] = int(prev.get("version") or 1)
    out = strip(await ledger.table.update(APPS_PK, f"APP#{app_id}", UpdateOptions(set=sets, must_exist=True)))
    if out is None:
        return None
    prefix = _version_prefix(app_id, app.get("draft_id"), int(app.get("version") or 1))
    if prefix:
        await delete_prefix(origin.s3, origin.bucket, prefix)
    await bus.put({"type": "app.updated", "app": out})
    return out


def version_files(app: Record, draft: Record | None) -> list[tuple[str, str]]:
    """(path, URL) of the current version's own files, for ``load_app``; the city's bridge file is left out."""
    base = str(app.get("url") or "").rsplit("/", 1)[0] + "/"
    return [
        (str(f["path"]), base + str(f["path"]))
        for f in (draft or {}).get("files") or []
        if f.get("path") != BRIDGE and path_problem(str(f.get("path"))) is None
    ]
