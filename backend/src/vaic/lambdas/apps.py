"""EventBridge rule (``detail.type`` = ``app.submitted`` or ``app.preview.files``) → this Lambda (``vaic-prod-apps``).

Reads the worker's ``hires/<hire_id>/app/`` from the workspaces bucket, checks it again (never the worker's own
file list), copies it to ``drafts/<draft_id>/`` in the apps bucket with content types set by the city, records
the draft (``ready`` or ``rejected``) and puts ``app.draft``. It never touches ``live/``: only the owner
publishes, through the API. ``app.preview.files`` updates the job's live working copy instead
(``shared/app_preview.py``, decision 278): never a draft or a version.
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from vaic.shared.app_preview import stage_preview
from vaic.shared.apps import AppsOrigin, stage_submission
from vaic.shared.aws import aws_city, require_env
from vaic.shared.events import EventBus, parse_event
from vaic.shared.ledger import Ledger, Record
from vaic.shared.log import log

from ._runtime import run


async def on_submitted(
    raw: dict[str, Any], ledger: Ledger, bus: EventBus, origin: AppsOrigin, workspace_s3: Any, workspaces_bucket: str
) -> Record | None:
    try:
        e = parse_event(raw.get("detail") or {})
    except ValidationError:
        log("warn", "apps.bad_event")
        return None
    if e["type"] == "app.preview.files":
        live = await stage_preview(e, ledger, bus, origin, workspace_s3, workspaces_bucket)
        log("info", "apps.preview", task=e["task_id"], files=len(e["paths"]), staged=bool(live))
        return None
    if e["type"] != "app.submitted":
        return None
    draft = await stage_submission(e, ledger, bus, origin, workspace_s3, workspaces_bucket)
    log("info", "apps.draft", draft=draft["draft_id"], status=draft["status"], hire=draft["hire_id"])
    return draft


_wired: tuple[Ledger, EventBus, AppsOrigin, Any, str] | None = None


def handler(raw: dict[str, Any], _context: Any = None) -> str | None:
    global _wired
    if _wired is None:
        city = aws_city()
        s3 = city.session.client("s3")
        origin = AppsOrigin(s3=s3, bucket=require_env("VAIC_APPS_BUCKET"), url=require_env("VAIC_APPS_URL"))
        _wired = (city.ledger, city.bus, origin, s3, require_env("VAIC_WORKSPACES_BUCKET"))
    draft = run(on_submitted(raw, *_wired))
    return draft["status"] if draft else None
