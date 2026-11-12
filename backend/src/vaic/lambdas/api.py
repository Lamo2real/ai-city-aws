"""The HTTP API (API Gateway HTTP API + Cognito JWT authorizer).

API Gateway validates the token; this handler checks again that the caller is in the ``owner`` group, on
every route. Replies are plain data for the HUD; errors are plain words, never stack traces.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Literal, cast

from vaic.shared import company, owner_api
from vaic.shared import executives as execs
from vaic.shared import sales_pipeline as deals
from vaic.shared import standing_orders as standing
from vaic.shared import support_desk as desk
from vaic.shared.app_activity import app_activity
from vaic.shared.app_bridge import Invoke, api_bridge, file_proposal, run_proposal
from vaic.shared.app_caps import Invalid, MailProposals, proposals_from_env
from vaic.shared.apps import (
    AppsOrigin,
    get_app,
    get_draft,
    list_apps,
    publish_draft,
    refuse_draft,
    remove_app,
    rollback_app,
    update_app,
)
from vaic.shared.aws import aws_city
from vaic.shared.caps import settings_patch
from vaic.shared.chief_of_staff import CHIEF, away_summary, record_decision
from vaic.shared.chief_of_staff import status as chief_status
from vaic.shared.clients import client
from vaic.shared.config import caps_config
from vaic.shared.connectors import ConnectorStore, city_signs
from vaic.shared.events import EventBus, now_iso
from vaic.shared.files.service import FilesError, FilesService
from vaic.shared.files.service import NotFound as FileNotFound
from vaic.shared.files.wiring import files_from_env
from vaic.shared.github import GitHubDeps, GitHubError, github_token_secret, whoami
from vaic.shared.hierarchy.actions import CityDeps, answer_question, send_home, send_workers_home, sweep_stale_asks
from vaic.shared.hierarchy.departments import (
    DepartmentError,
    build_department,
    demolish_department,
    find_standing,
    merge_replaced_departments,
)
from vaic.shared.hierarchy.factory import Factory
from vaic.shared.hierarchy.queue import Queue, WorkMessage
from vaic.shared.hierarchy.tasks import DONE_OR_GONE, cancel_task, job_rows
from vaic.shared.ids import new_id
from vaic.shared.knowledge.builtin import GUIDE_ID, ensure_builtin_guide, remove_legacy_copies
from vaic.shared.knowledge.download import item_download
from vaic.shared.knowledge.entries import EntryError
from vaic.shared.knowledge.entry_service import EntryNotFound, EntryService
from vaic.shared.knowledge.projection import EntryProjector
from vaic.shared.knowledge.registry import EntryRegistry
from vaic.shared.knowledge.service import KnowledgeError, KnowledgeService, NotFound
from vaic.shared.knowledge.wiring import knowledge_from_env
from vaic.shared.ledger import Ledger, Record
from vaic.shared.log import log
from vaic.shared.models import model_label
from vaic.shared.presets import ensure_presets, public_presets
from vaic.shared.push import DeviceStore, PushApps, PushDeps, apns_key_secret, store_apns_secret
from vaic.shared.speech import (
    DEFAULT_VOICE,
    VOICES,
    NotConfigured,
    SpeechDeps,
    SpeechError,
    create_live_session,
    openai_key_secret,
    store_secret,
    synthesize,
)
from vaic.shared.turn import ModelRunner
from vaic.shared.utility import UtilityDeps, bedrock_converse_runner, is_addressed_to_vaic
from vaic.shared.voice_url import EXPIRES_S, VoiceUrlDeps, check_voice_url, presigned_voice_url

from ._runtime import run
from .calendar_api import CalendarApi
from .calendar_api import route as calendar_route
from .connectors_api import ConnectorsApi, on_connector_approval
from .connectors_api import route as connectors_route
from .mail_api import MailApi
from .mail_api import route as mail_route
from .skills_api import SkillsApi
from .skills_api import route as skills_route

LIVE = ("open", "in_progress", "in_review", "waiting_on_owner")
RESET_ROUND_S = 18.0
"""How long one `POST /city/reset` round deletes before answering `done: false` (the Lambda and API Gateway allow 30)."""
ALL = (*LIVE, "parked", "done", "failed", "cancelled")

ROUTES: list[tuple[str, str]] = [
    ("GET", "/city"),
    ("GET", "/city/agent?id=x"),
    ("POST", "/city/instruct"),
    ("POST", "/messages"),
    ("POST", "/messages/o-12345678/stop"),
    ("POST", "/wake-check"),
    ("GET", "/tickets"),
    ("GET", "/tickets/t-1"),
    ("GET", "/jobs"),
    ("GET", "/departments"),
    ("POST", "/departments"),
    ("DELETE", "/departments/customer-success"),
    ("GET", "/departments/presets"),
    ("GET", "/agents"),
    ("GET", "/workforce"),
    ("GET", "/costs"),
    ("GET", "/health"),
    ("GET", "/questions"),
    ("POST", "/questions/q-1/answer"),
    ("POST", "/questions/q-1/default"),
    ("POST", "/approvals/a-1"),
    ("GET", "/settings"),
    ("PUT", "/settings"),
    ("GET", "/chief-of-staff"),
    ("GET", "/away-summary?since=2026-11-01T00:00:00Z"),
    ("GET", "/support-tickets"),
    ("GET", "/deals"),
    ("GET", "/company"),
    ("PUT", "/company"),
    ("DELETE", "/company"),
    ("GET", "/executives"),
    ("PUT", "/executives"),
    ("GET", "/standing-orders"),
    ("POST", "/standing-orders"),
    ("PUT", "/standing-orders/so-1"),
    ("DELETE", "/standing-orders/so-1"),
    ("GET", "/workflows"),
    ("GET", "/workflows/runs/wf-1"),
    ("POST", "/workflows/runs/wf-1/step"),
    ("POST", "/workflows/runs/wf-1/mode"),
    ("POST", "/workflows/runs/wf-1/cancel"),
    ("GET", "/workflows/taste"),
    ("POST", "/workflows/taste/tq-1"),
    ("POST", "/workers/home"),
    ("POST", "/tasks/t-1/cancel"),
    ("POST", "/city/reset"),
    ("POST", "/agents/wkr-1/home"),
    ("GET", "/memory"),
    ("POST", "/notes"),
    ("GET", "/connectors"),
    ("POST", "/connectors"),
    ("PUT", "/connectors/higgsfield"),
    ("DELETE", "/connectors/higgsfield"),
    ("POST", "/connectors/higgsfield/login"),
    ("POST", "/connectors/higgsfield/login/complete"),
    ("PUT", "/connectors/higgsfield/key"),
    ("POST", "/connectors/higgsfield/refresh"),
    ("GET", "/skills"),
    ("POST", "/skills"),
    ("GET", "/skills/pdf-report"),
    ("PUT", "/skills/pdf-report"),
    ("DELETE", "/skills/pdf-report"),
    ("GET", "/skills/catalog"),
    ("GET", "/skills/catalog/nda-triage"),
    ("POST", "/skills/catalog/nda-triage"),
    ("GET", "/mail/accounts"),
    ("POST", "/mail/accounts"),
    ("PUT", "/mail/accounts/ma-0000aaaa"),
    ("DELETE", "/mail/accounts/ma-0000aaaa"),
    ("POST", "/mail/accounts/ma-0000aaaa/signin"),
    ("POST", "/mail/accounts/ma-0000aaaa/complete"),
    ("POST", "/mail/accounts/ma-0000aaaa/imap"),
    ("GET", "/features"),
    ("PUT", "/features/calendar"),
    ("GET", "/calendar/events?from=2026-11-08&to=2026-11-15"),
    ("POST", "/calendar/refresh"),
    ("GET", "/mail/rules"),
    ("POST", "/mail/rules"),
    ("DELETE", "/mail/rules/rule-1"),
    ("GET", "/apps"),
    ("GET", "/apps/app-1/activity"),
    ("DELETE", "/apps/app-1"),
    ("PUT", "/apps/app-1"),
    ("POST", "/apps/app-1/bridge"),
    ("POST", "/apps/app-1/proposals"),
    ("POST", "/apps/app-1/rollback"),
    ("GET", "/knowledge"),
    ("GET", "/knowledge/k-aaaaaaaaaaaa"),
    ("POST", "/knowledge/uploads"),
    ("POST", "/knowledge/uploads/k-aaaaaaaaaaaa/complete"),
    ("POST", "/knowledge/links"),
    ("POST", "/knowledge/text"),
    ("PUT", "/knowledge/k-aaaaaaaaaaaa"),
    ("DELETE", "/knowledge/k-aaaaaaaaaaaa"),
    ("GET", "/knowledge/entries"),
    ("POST", "/knowledge/entries"),
    ("GET", "/knowledge/entries/marketing.seo.local-seo"),
    ("PUT", "/knowledge/entries/marketing.seo.local-seo"),
    ("DELETE", "/knowledge/entries/marketing.seo.local-seo"),
    ("POST", "/knowledge/entries/marketing.seo.local-seo/reset"),
    ("POST", "/knowledge/entries/marketing.seo.local-seo/reindex"),
    ("GET", "/knowledge/entries/marketing.seo.local-seo/download"),
    ("GET", "/knowledge/k-aaaaaaaaaaaa/download"),
    ("GET", "/files"),
    ("GET", "/files/f-aaaaaaaaaaaa"),
    ("POST", "/files/uploads"),
    ("POST", "/files/uploads/f-aaaaaaaaaaaa/complete"),
    ("PUT", "/files/f-aaaaaaaaaaaa"),
    ("DELETE", "/files/f-aaaaaaaaaaaa"),
    ("POST", "/files/f-aaaaaaaaaaaa/retry"),
    ("GET", "/devices"),
    ("POST", "/devices"),
    ("DELETE", "/devices/d-aaaaaaaaaaaaaaaaaaaaaaaa"),
    ("GET", "/calls/call-1"),
    ("POST", "/calls/call-1/answered"),
    ("POST", "/calls/call-1/missed"),
    ("POST", "/calls/call-1/ended"),
    ("GET", "/notifications/apns"),
    ("PUT", "/notifications/apns"),
    ("POST", "/speech"),
    ("GET", "/voice/openai"),
    ("PUT", "/voice/openai-key"),
    ("POST", "/voice/session"),
    ("POST", "/voice/check"),
    ("POST", "/voice/live"),
    ("GET", "/github"),
    ("PUT", "/github/token"),
    ("DELETE", "/github/token"),
]


@dataclass
class ApiDeps:
    ledger: Ledger
    bus: EventBus
    queue: Queue
    settings: Callable[[], Awaitable[dict[str, Any]]]
    sfn: Any = None
    """A boto3 ``stepfunctions`` client."""
    utility_runner: ModelRunner | None = None
    owner_id: str | None = None
    cognito: Any = None
    """A boto3 ``cognito-idp`` client, for re-sending the owner's first-login email."""
    user_pool_id: str | None = None
    owner_email: str | None = None
    apps: AppsOrigin | None = None
    """The apps bucket and distribution, for publishing and removing apps."""
    bridge_invoke: Invoke | None = None
    """Synchronous call to the app-bridge Lambda (``{app_id, cap, params}``); None answers "unavailable"."""
    proposals: MailProposals | None = None
    """The mail module's approvals (file / execute) for app proposals; None answers "unavailable"."""
    grants_changed: Callable[[], Awaitable[None]] | None = None
    """Asks the connectors Lambda to rewrite the Cedar policies after a publish, removal or grant change."""
    knowledge: KnowledgeService | None = None
    """None until the knowledge base is deployed (``KNOWLEDGE_*`` variables)."""
    files: FilesService | None = None
    """Files (docs/FILES.md); None until deployed (``FILES_*`` variables)."""
    connectors: ConnectorsApi | None = None
    """The ``/connectors*`` routes and the add-connector approval hook; None = built from ledger and bus."""
    skills: SkillsApi | None = None
    mail: MailApi | None = None
    calendar: CalendarApi | None = None
    """City → Features and the owner's calendar (``/features``, ``/calendar/*``); None = built from the ledger."""
    """The ``/mail/*`` routes (``VAIC_MAIL_WORKLOAD``); None = mail isn't set up (503)."""
    push: PushDeps | None = None
    """iPhone notifications: device registration and the owner's Apple key; None = not deployed (503)."""
    speech: SpeechDeps | None = None
    """VAIC's voice through OpenAI text-to-speech (``/speech``, ``/voice/openai*``); None = not configured (503)."""
    voice: VoiceUrlDeps | None = None
    """VAIC's real-time voice (Nova Sonic on VAIC's runtime): presigned WebSocket URLs; None = not deployed (503)."""
    github: GitHubDeps | None = None
    """The owner's GitHub token (``/github``, ``/github/token``); None = not configured (503 on store)."""


def _action_deps(d: ApiDeps) -> CityDeps:
    # The in-process factory: releasing a worker is a ledger write and one event, both of which the API may do.
    # Hiring stays with the managers (the factory Lambda); the API never hires.
    return CityDeps(
        ledger=d.ledger,
        bus=d.bus,
        queue=d.queue,
        factory=Factory(d.ledger, d.bus, d.settings),
        settings=d.settings,
        max_review_rounds=caps_config()["max_review_rounds"],
    )


def reply(status: int, body: Any) -> dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json", "cache-control": "no-store"},
        "body": json.dumps(body),
    }


def problem(status: int, message: str, fix: str | None = None) -> dict[str, Any]:
    return reply(status, {"error": message, "fix": fix})


def reply_binary(data: bytes, content_type: str) -> dict[str, Any]:
    """A binary body through API Gateway (base64), never cached."""
    return {
        "statusCode": 200,
        "headers": {"content-type": content_type, "cache-control": "no-store"},
        "isBase64Encoded": True,
        "body": base64.b64encode(data).decode("ascii"),
    }


def is_owner(event: dict[str, Any]) -> bool:
    """Cognito puts groups in ``cognito:groups``; through API Gateway it can arrive as "[owner other]" or "owner"."""
    claims = (((event.get("requestContext") or {}).get("authorizer") or {}).get("jwt") or {}).get("claims") or {}
    raw = claims.get("cognito:groups")
    if isinstance(raw, list):
        groups = [str(g) for g in raw]
    else:
        groups = re.split(r"[\s,]+", re.sub(r"^\[|\]$", "", str(raw or "")))
    return "owner" in groups


class BadRequest(ValueError):
    pass


def _body(event: dict[str, Any], max_len: int = 64_000) -> dict[str, Any]:
    raw = event.get("body")
    if not raw:
        return {}
    try:
        text = base64.b64decode(raw).decode("utf-8") if event.get("isBase64Encoded") else str(raw)
    except ValueError as e:  # not base64, or not text
        raise BadRequest("That request could not be read.") from e
    if len(text) > max_len:
        raise BadRequest("That message is too long.")
    try:
        v = json.loads(text)
    except ValueError as e:
        raise BadRequest("The request could not be read.") from e
    if not isinstance(v, dict):
        raise BadRequest("The request could not be read.")
    return v


def _str(v: Any, name: str, max_len: int = 4000) -> str:
    if not isinstance(v, str) or not v.strip():
        raise BadRequest(f"{name} is missing.")
    if len(v) > max_len:
        raise BadRequest(f"{name} is too long.")
    return v.strip()


async def _sweep(d: ApiDeps) -> None:
    """Questions and approvals of jobs that already stopped never reach Needs you (a failed sweep is not fatal)."""
    try:
        if n := await sweep_stale_asks(d.ledger, d.bus):
            log("info", "asks.swept", withdrawn=n)
    except Exception as e:
        log("warn", "asks.sweep_failed", error=type(e).__name__)


async def city_snapshot(d: ApiDeps) -> dict[str, Any]:
    s = await d.settings()
    await _sweep(d)
    try:
        if made := await ensure_presets(d.ledger):  # the preset departments stand from the start (decision 119)
            log("info", "departments.seeded", names=json.dumps(made))
    except Exception as e:  # the City still loads; the next snapshot tries again
        log("warn", "departments.seed_failed", error=type(e).__name__)
    try:  # "Apps" folded into Application (decision 220): normally done on deploy; one read once it has run
        await merge_replaced_departments(_action_deps(d), d.files.store if d.files is not None else None)
    except Exception as e:
        log("warn", "departments.merge_failed", error=type(e).__name__)
    lots: list[dict[str, Any]] = []
    try:  # every tower's lot, for good (decision 248): numbered the first time in today's order
        lots = await d.ledger.ensure_lots()
    except Exception as e:  # the City still draws; it numbers the lots itself until the next snapshot
        log("warn", "departments.lots_failed", error=type(e).__name__)
    if d.knowledge is not None:  # the built-in AI City guide, indexed in the Knowledge base
        await ensure_builtin_guide(d.knowledge.store, d.knowledge.blobs, d.knowledge.kb)
    results: list[Any] = await asyncio.gather(
        d.ledger.list_agents(),
        d.ledger.list_departments(),
        d.ledger.list_tickets(LIVE),
        d.ledger.list_tickets(["parked"]),
        d.ledger.open_questions(),
        d.ledger.pending_approvals(),
        d.ledger.spend("day", "GLOBAL"),
        d.ledger.spend("month", "GLOBAL"),
        d.ledger.spend_breakdown("day"),
        d.ledger.list_specialists(),
        list_apps(d.ledger),
        ConnectorStore(d.ledger.table).list(),
    )
    (
        agents,
        departments,
        tickets,
        parked,
        questions,
        approvals,
        today,
        month,
        day_breakdown,
        specialists,
        apps,
        connectors,
    ) = results
    spend = {dep["name"]: day_breakdown.get(f"DEPT#{dep['key']}", {}).get("usd", 0) for dep in departments}
    slot_of = {str(lot["holder"]): lot["slot"] for lot in lots if lot.get("holder")}
    return {
        "agents": [{**a, "model_label": model_label(a["model"])} for a in agents],
        "departments": [{**dep, "slot": slot_of[dep["key"]]} if dep["key"] in slot_of else dep for dep in departments],
        "lots": [
            {
                "slot": lot["slot"],
                "size": str(lot.get("size") or ""),
                **({"freed_at": lot["freed_at"]} if lot.get("freed_at") and not lot.get("holder") else {}),
            }
            for lot in lots
        ],
        "tickets": tickets,
        "parked": parked,
        "questions": questions,
        "approvals": approvals,
        "specialists": specialists,
        "apps": apps,
        "connectors": city_signs(
            connectors
        ),  # their signs hang by the doors of the towers that use them (decision 173)
        "usage": {"usd": today["usd"], "turns": today["turns"], "tokens": today["tokens"]},
        "month": {"usd": month["usd"]},
        "spend": spend,
        "caps": {
            "daily_global_usd": s.get("daily_global_usd"),
            "monthly_budget_usd": s.get("monthly_budget_usd"),
            "daily_department_usd": s.get("daily_department_usd"),
        },
        "city": {
            "running": sum(1 for t in tickets if t["status"] == "in_progress"),
            "waiting": sum(1 for t in tickets if t["status"] == "open"),
        },
        "region": os.environ.get("AWS_REGION", "eu-north-1"),
    }


async def _grants_changed(d: ApiDeps) -> None:
    """Best effort: the owner's action already happened; ``app_call`` re-checks grants until Cedar catches up."""
    if d.grants_changed is None:
        return
    try:
        await d.grants_changed()
    except Exception as e:
        log("warn", "apps.policies_refresh_failed", error=type(e).__name__)


async def _costs(d: ApiDeps) -> dict[str, Any]:
    s = await d.settings()
    day, month = await asyncio.gather(d.ledger.spend_breakdown("day"), d.ledger.spend_breakdown("month"))

    def group(b: dict[str, Any], prefix: str) -> dict[str, Any]:
        return {k[len(prefix) :]: v for k, v in b.items() if k.startswith(prefix)}

    zero = {"usd": 0, "turns": 0, "tokens": 0, "cache_savings_usd": 0}
    return {
        "estimate": True,
        "note": "Estimates from token counts at list prices. The AWS bill is the truth.",
        "today": day.get("GLOBAL", zero),
        "month": month.get("GLOBAL", zero),
        "by_department": group(month, "DEPT#"),
        "by_role": group(month, "ROLE#"),
        "by_model": {model_label(k): v for k, v in group(month, "MODEL#").items()},
        "caps": {
            "daily_global_usd": s.get("daily_global_usd"),
            "monthly_budget_usd": s.get("monthly_budget_usd"),
            "daily_department_usd": s.get("daily_department_usd"),
            "department_caps": s.get("department_caps", {}),
        },
        "cost_explorer_url": "https://console.aws.amazon.com/costmanagement/home#/cost-explorer",
    }


APNS_FLAG = ("NOTIFY#apns", "META")
OPENAI_FLAG = ("VOICE#openai", "META")


async def _speech_routes(method: str, path: str, event: dict[str, Any], d: ApiDeps) -> dict[str, Any] | None:
    """VAIC's voice through OpenAI: ``POST /speech`` (MP3 bytes), ``GET /voice/openai``, ``PUT /voice/openai-key``."""
    if path not in ("/speech", "/voice/openai", "/voice/openai-key", "/voice/live"):
        return None
    s = d.speech
    if method == "GET" and path == "/voice/openai":
        flag = await d.ledger.table.get(*OPENAI_FLAG)
        return reply(
            200,
            {
                "configured": bool(s and await s.key()),
                "voices": list(VOICES),
                "default": DEFAULT_VOICE,
                "key_saved_at": flag.get("saved_at") if flag else None,
            },
        )
    if method == "PUT" and path == "/voice/openai-key":
        if s is None or s.secrets is None:
            return reply(503, {"error": "not_deployed", "message": "The key can't be stored yet. Deploy first."})
        try:
            value = openai_key_secret(_body(event))
        except ValueError as e:
            return reply(400, {"error": "bad_request", "message": str(e)})
        try:
            await asyncio.to_thread(store_secret, s.secrets, s.secret_name, value, s.kms_key, s.tags)
        except Exception as e:
            log("warn", "speech.key_store_failed", error=type(e).__name__)
            return reply(
                502, {"error": "store_failed", "message": "The key couldn't be stored. Try again in a moment."}
            )
        s.forget_key()
        at = now_iso(d.ledger.now())
        await d.ledger.table.put({"pk": OPENAI_FLAG[0], "sk": OPENAI_FLAG[1], "saved_at": at})
        log("info", "speech.key_saved")
        return reply(200, {"ok": True, "saved_at": at})
    if method == "POST" and path == "/voice/live":
        # VAIC's real-time voice on GPT-Live (decision 128): the browser's WebRTC offer in, OpenAI's answer out.
        try:
            if s is None:
                raise NotConfigured()
            return reply(200, await create_live_session(s, _body(event).get("sdp")))
        except ValueError as e:
            return reply(400, {"error": "bad_request", "message": str(e)})
        except SpeechError as e:
            return reply(e.status, {"error": e.error, "message": e.message})
    if method == "POST" and path == "/speech":
        b = _body(event)
        try:
            if s is None:
                raise NotConfigured()
            data = await synthesize(s, b.get("text"), b.get("voice"))
        except ValueError as e:
            return reply(400, {"error": "bad_request", "message": str(e)})
        except SpeechError as e:
            return reply(e.status, {"error": e.error, "message": e.message})
        return reply_binary(data, "audio/mpeg")
    return None


GITHUB_FLAG = ("GITHUB#token", "META")


async def _github_routes(method: str, path: str, event: dict[str, Any], d: ApiDeps) -> dict[str, Any] | None:
    """The owner's GitHub token (docs/GITHUB_ACCESS.md): ``GET /github`` says who it belongs to, ``PUT /github/token``
    stores one, ``DELETE /github/token`` clears it. The token itself is never echoed or logged."""
    if path not in ("/github", "/github/token"):
        return None
    g = d.github
    if method == "GET" and path == "/github":
        flag = await d.ledger.table.get(*GITHUB_FLAG)
        st = await g.status() if g else {"configured": False, "login": None, "error": None}
        return reply(200, {**st, "saved_at": flag.get("saved_at") if flag else None})
    if path != "/github/token":
        return None
    if g is None or g.secrets is None:
        return reply(503, {"error": "not_deployed", "message": "The token can't be stored yet. Deploy first."})
    if method == "PUT":
        try:
            value = github_token_secret(_body(event))
        except ValueError as e:
            return reply(400, {"error": "bad_request", "message": str(e)})
        try:
            user = await whoami(g.get, json.loads(value)["token"])
        except GitHubError as e:
            if e.error == "bad_token":
                return reply(400, {"error": e.error, "message": e.message})
            user = None  # GitHub was unreachable: keep the token, the status will say who it belongs to later
        try:
            await asyncio.to_thread(store_secret, g.secrets, g.secret_name, value, g.kms_key, g.tags)
        except Exception as e:
            log("warn", "github.token_store_failed", error=type(e).__name__)
            return reply(
                502, {"error": "store_failed", "message": "The token couldn't be stored. Try again in a moment."}
            )
        g.forget()
        at = now_iso(d.ledger.now())
        await d.ledger.table.put({"pk": GITHUB_FLAG[0], "sk": GITHUB_FLAG[1], "saved_at": at})
        log("info", "github.token_saved", known_owner=user is not None)
        return reply(200, {"ok": True, "saved_at": at, "login": user["login"] if user else None})
    if method == "DELETE":
        try:
            await asyncio.to_thread(store_secret, g.secrets, g.secret_name, "{}", g.kms_key, g.tags)
        except Exception as e:
            log("warn", "github.token_remove_failed", error=type(e).__name__)
            return reply(
                502, {"error": "store_failed", "message": "The token couldn't be removed. Try again in a moment."}
            )
        g.forget()
        await d.ledger.table.delete(GITHUB_FLAG[0], GITHUB_FLAG[1])
        log("info", "github.token_removed")
        return reply(200, {"ok": True})
    return None


async def _call_routes(method: str, path: str, d: ApiDeps) -> dict[str, Any] | None:
    """VAIC's calls (decision 245): the iPhone reports a call answered, missed (declined or unanswered: the message
    goes out once) or ended. Each move is conditional on the call's state, so a late or repeated report changes
    nothing."""
    m = re.fullmatch(r"/calls/(call-[\w-]{1,80})(?:/(answered|missed|ended))?", path)
    if not m:
        return None
    from vaic.shared import calls

    p = d.push
    store = calls.Calls(d.ledger.table, d.ledger.now)
    id, what = m.group(1), m.group(2)
    call = await store.get(id)
    if call is None:
        return problem(404, "No such call.")
    if method == "GET" and not what:
        return reply(200, {"call": calls.public(call)})
    if method != "POST" or not what:
        return problem(404, "No such route.")
    moved: bool
    if what == "answered":
        moved = await store.move(id, "ringing", "answered") is not None
    elif what == "ended":
        moved = await store.move(id, "answered", "ended") is not None
    else:
        if p is None:
            return problem(503, "iPhone notifications aren't turned on yet.")
        deps = calls.CallDeps(d.ledger.table, d.ledger.now, p.store, p.sns, p.apps)
        moved = await calls.missed(deps, id)
    log("info", "call.report", call=id, what=what, moved=moved)
    return reply(200, {"call": calls.public(await store.get(id) or call), "moved": moved})


async def _push_routes(method: str, path: str, event: dict[str, Any], d: ApiDeps) -> dict[str, Any] | None:
    """iPhone notifications: the owner's phones (``/devices``) and the Apple key (``/notifications/apns``)."""
    if path.startswith("/calls/"):
        return await _call_routes(method, path, d)
    if not (path == "/devices" or path.startswith("/devices/") or path == "/notifications/apns"):
        return None
    p = d.push
    if method == "GET" and path == "/notifications/apns":
        flag = await d.ledger.table.get(*APNS_FLAG)
        return reply(
            200,
            {
                "key_saved_at": flag.get("saved_at") if flag else None,
                "enabled": bool(p and p.apps.configured),
                "devices": await p.store.list() if p else [],
                "secret_name": p.secret_name if p else None,
            },
        )
    if p is None:
        return problem(
            503, "iPhone notifications aren't deployed yet.", "Deploy first, then paste the Apple key in Settings."
        )
    if method == "PUT" and path == "/notifications/apns":
        if p.secrets is None:
            return problem(503, "The Apple key can't be stored yet.", "Deploy first.")
        try:
            value = apns_key_secret(_body(event))
        except ValueError as e:
            return problem(400, str(e))
        try:
            await asyncio.to_thread(store_apns_secret, p.secrets, p.secret_name, value, p.kms_key, p.tags)
        except Exception as e:
            log("warn", "push.key_failed", error=type(e).__name__)
            return problem(502, "The key couldn't be stored.", "Try again in a moment.")
        at = now_iso(d.ledger.now())
        await d.ledger.table.put({"pk": APNS_FLAG[0], "sk": APNS_FLAG[1], "saved_at": at})
        log("info", "push.key_saved")
        return reply(200, {"ok": True, "saved_at": at, "next": "Turn on VAIC_APNS_ENABLED in GitHub and deploy once."})
    if method == "GET" and path == "/devices":
        return reply(200, {"devices": await p.store.list()})
    if method == "POST" and path == "/devices":
        if not p.apps.configured:
            return problem(
                503, "iPhone notifications aren't turned on yet.", "Paste the Apple key in Settings and deploy once."
            )
        b = _body(event)
        sandbox = bool(b.get("sandbox", False))
        kind = str(b.get("kind") or "alert")
        if not p.apps.for_build(sandbox, kind):
            return problem(503, "That build's notifications aren't turned on.", "Deploy with the Apple key first.")
        try:
            device = await p.store.register(
                p.sns,
                p.apps,
                str(b.get("token") or ""),
                str(b.get("platform") or "ios"),
                sandbox,
                kind,
                str(b.get("bundle") or ""),
            )
        except ValueError as e:
            return problem(400, str(e))
        return reply(200, {"device": device})
    m = re.fullmatch(r"/devices/(d-[0-9a-f]{24})", path)
    if method == "DELETE" and m:
        return reply(200, {"removed": await p.store.remove(p.sns, m.group(1))})
    return problem(404, "No such route.")


async def _workflow_routes(method: str, path: str, event: dict[str, Any], d: ApiDeps) -> dict[str, Any] | None:
    """AI workflows (decision 126): the walkthrough's pages, its mode and Stop. Saying yes to the money is never a
    route: it is the owner's own words to VAIC (``run_workflow``)."""
    if not path.startswith("/workflows"):
        return None
    from vaic.shared import workflow_jobs as jobs
    from vaic.shared import workflows as wf
    from vaic.shared.connectors import ConnectorStore

    runs = wf.Runs(d.ledger.table, d.ledger.now)
    records = await ConnectorStore(d.ledger.table).list()

    async def shown(r: dict[str, Any]) -> dict[str, Any] | None:
        w = wf.definition(str(r.get("workflow_id")))
        if not w:
            return None
        if r.get("status") == "running" and r.get("task_id"):
            t = await d.ledger.get_ticket(str(r["task_id"]))
            if t and t.get("status") in ("done", "failed", "cancelled"):
                status = "done" if t["status"] == "done" else "cancelled"
                r = await runs.update(r["id"], {"status": status}) or r
        return await jobs.shown(cd, r, w, wf.connector_info(w, records))

    cd = _action_deps(d)
    m = re.fullmatch(r"/workflows/taste/(tq-[\w-]{1,40})", path)
    if m and method == "POST":
        # A tap on the card: the owner's own choice, applied like their words to VAIC (decision 127).
        b = _body(event)
        try:
            said = await jobs.answer(cd, m.group(1), str(b.get("answer") or ""))
        except wf.Invalid as e:
            return problem(400, str(e))
        if said.startswith("That question was already answered"):
            return problem(409, said)
        return reply(200, {"result": said})
    if method == "GET" and path == "/workflows/taste":
        return reply(200, {"taste": [wf.taste_public(q) for q in await wf.Taste(d.ledger.table).all(open_only=True)]})
    if method == "GET" and path == "/workflows":
        out = [p for r in (await runs.list())[: wf.MAX_RUNS_SHOWN] if (p := await shown(r))]
        defs = [
            {
                "id": w["id"],
                "name": w["name"],
                "summary": w.get("summary", ""),
                "connector": wf.connector_info(w, records),
                "steps": [{"id": s["id"], "title": s["title"]} for s in w.get("steps") or []],
            }
            for w in wf.definitions()
        ]
        return reply(200, {"workflows": defs, "runs": out})
    m = re.fullmatch(r"/workflows/runs/(wf-[\w-]{1,40})(?:/(step|mode|cancel))?", path)
    if not m:
        return problem(404, "No such route.")
    run = await runs.get(m.group(1))
    w = wf.definition(str(run.get("workflow_id"))) if run else None
    if not run or not w:
        return problem(404, "That workflow doesn't exist.")
    action = m.group(2)
    if method == "GET" and not action:
        return reply(200, {"run": await shown(run)})
    if method != "POST" or not action:
        return problem(404, "No such route.")
    b = _body(event)
    try:
        if action == "step":
            run = await wf.move(runs, run, w, str(b.get("to") or "next"))
        elif action == "mode":
            run = await wf.set_mode(runs, run, str(b.get("mode") or ""))
        else:
            run = await wf.cancel(runs, run)
    except wf.Invalid as e:
        return problem(400, str(e))
    conn = wf.connector_info(w, records)
    if wf.next_need(run, w, bool(conn["connected"]))["kind"] == "go":  # away, nothing paid: the team starts
        run, _ = await jobs.hand_off(cd, runs, run, w)
    pub = await jobs.shown(cd, run, w, conn)
    if pub["next"]["kind"] == "confirm":  # the card now shows the money: the owner's next message may say yes
        await runs.update(run["id"], {"confirm_shown_in": "hud"})
    await d.bus.put({"type": "workflow.updated", "run": pub})
    return reply(200, {"run": pub})


async def _route(event: dict[str, Any], d: ApiDeps) -> dict[str, Any]:
    method = event["requestContext"]["http"]["method"].upper()
    path = event.get("rawPath", "/").rstrip("/") or "/"
    q = event.get("queryStringParameters") or {}
    seg = [s for s in path.split("/") if s]

    def is_(m: str, pattern: str) -> bool:
        return method == m and re.fullmatch(pattern, path) is not None

    pushed = await _push_routes(method, path, event, d)
    if pushed is not None:
        return pushed
    spoken = await _speech_routes(method, path, event, d)
    if spoken is not None:
        return spoken
    gh = await _github_routes(method, path, event, d)
    if gh is not None:
        return gh
    flows = await _workflow_routes(method, path, event, d)
    if flows is not None:
        return flows
    if is_("GET", r"/city"):
        return reply(200, await city_snapshot(d))
    if is_("GET", r"/city/agent"):
        id = _str(q.get("id"), "Agent")
        a = await d.ledger.get_agent(id)
        if not a:
            return problem(404, "That agent does not exist.")
        turns, tools, tickets = await asyncio.gather(
            d.ledger.turns_of(id), d.ledger.tool_calls(id), d.ledger.tickets_of(id, LIVE)
        )
        return reply(
            200,
            {
                "agent": {**a, "model_label": model_label(a["model"])},
                "ticket": tickets[0] if tickets else None,
                "recent": tools[-10:],
                "turns": len(turns),
                "cost_usd": sum(t.get("usd", 0) for t in turns),
            },
        )
    if is_("POST", r"/city/instruct"):
        b = _body(event)
        agent_id = _str(b.get("agent_id"), "Agent")
        text = _str(b.get("text"), "Instruction")
        # The instruction goes through VAIC like every owner message, so the same gate applies.
        conversation = b["conversation"] if isinstance(b.get("conversation"), str) else "hud"
        await d.queue.send(
            cast(
                WorkMessage,
                {
                    "id": new_id("m"),
                    "role": "vaic",
                    "agentId": "vaic",
                    "department": None,
                    "ticketId": f"conv-{conversation}",
                    "taskId": f"conv-{conversation}",
                    "kind": "instruction",
                    "from": "owner",
                    "body": f"@{agent_id} {text}",
                    "conversation": conversation,
                },
            )
        )
        return reply(202, {"accepted": True})
    if is_("POST", r"/messages"):
        b = _body(event)
        text = _str(b.get("text"), "Message", 8000)
        conv = b.get("conversation")
        conversation = conv if isinstance(conv, str) and re.fullmatch(r"[\w-]{1,64}", conv) else "main"
        cid = b.get("client_id")
        id = f"owner-{cid}" if isinstance(cid, str) and re.fullmatch(r"[\w-]{8,64}", cid) else new_id("owner")
        await d.queue.send(
            cast(
                WorkMessage,
                {
                    "id": id,
                    "role": "vaic",
                    "agentId": "vaic",
                    "department": None,
                    "ticketId": f"conv-{conversation}",
                    "taskId": f"conv-{conversation}",
                    "kind": "task",
                    "from": "owner",
                    "body": text,
                    "conversation": conversation,
                    **({"voice": True} if b.get("voice") is True else {}),
                },
            )
        )
        return reply(202, {"accepted": True, "conversation": conversation})
    if is_("POST", r"/messages/[\w-]{8,64}/stop"):
        # The owner's Stop (decision 183): VAIC's runtime drops that turn; work it already handed on keeps going.
        await d.ledger.stop_turn(f"owner-{seg[1]}")
        return reply(202, {"stopped": True})
    if is_("POST", r"/wake-check"):
        transcript = _str(_body(event).get("transcript"), "Transcript", 2000)
        if not d.utility_runner:
            return reply(200, {"addressed": re.match(r"^\s*\S*\s*vaic\b", transcript, re.I) is not None})
        addressed = await is_addressed_to_vaic(
            transcript, UtilityDeps(ledger=d.ledger, bus=d.bus, settings=await d.settings(), runner=d.utility_runner)
        )
        return reply(200, {"addressed": addressed})
    if is_("GET", r"/jobs"):
        return reply(200, {"jobs": await job_rows(d.ledger, finished=q.get("status") == "done")})
    if is_("GET", r"/tickets"):
        status = q.get("status")
        which = ALL if status == "all" else ("done", "failed", "cancelled") if status == "done" else LIVE
        tickets = sorted(await d.ledger.list_tickets(which), key=lambda t: t["updated_at"], reverse=True)
        return reply(200, {"tickets": tickets[:200]})
    if is_("GET", r"/tickets/[\w-]+"):
        t = await d.ledger.get_ticket(seg[1])
        if not t:
            return problem(404, "That ticket does not exist.")
        history, trace, children = await asyncio.gather(
            d.ledger.ticket_history(t["id"]), d.ledger.trace(t["id"]), d.ledger.child_tickets(t["id"])
        )
        return reply(200, {"ticket": t, "history": history, "trace": trace, "children": children})
    if is_("POST", r"/voice/session"):
        if d.voice is None:
            return reply(503, {"error": "not_configured", "message": "VAIC's real-time voice isn't set up here."})
        try:
            url = await asyncio.to_thread(presigned_voice_url, d.voice)
        except Exception as e:
            log("warn", "voice.presign_failed", error=type(e).__name__)
            return reply(503, {"error": "unavailable", "message": "VAIC's voice could not start. Try again."})
        return reply(200, {"url": url, "expires_in": EXPIRES_S})
    if is_("POST", r"/voice/check"):
        # Why the browser's WebSocket to VAIC's voice was refused: the API opens the same handshake and reports AWS's
        # answer (browsers never show it). Read-only; it opens and closes one connection.
        if d.voice is None:
            return reply(200, {"ok": False, "reason": "VAIC's real-time voice isn't set up here."})
        try:
            url = await asyncio.to_thread(presigned_voice_url, d.voice)
            status, body = await check_voice_url(url)
        except Exception as e:
            log("warn", "voice.check_failed", error=type(e).__name__)
            return reply(200, {"ok": False, "reason": f"the check itself failed ({type(e).__name__})"})
        log("info", "voice.check", status=status)
        if status == 101:
            return reply(200, {"ok": True, "reason": "AWS accepts the connection; the voice stopped after it opened"})
        return reply(200, {"ok": False, "status": status, "reason": f"AWS answered {status}: {body or 'no details'}"})
    if is_("GET", r"/departments/presets"):
        return reply(200, public_presets())
    if is_("GET", r"/departments"):
        return reply(200, {"departments": await d.ledger.list_departments()})
    if is_("POST", r"/departments"):
        # The owner builds a department (City "+ Build", Settings): the same path as asking VAIC (decision 134).
        b = _body(event)
        try:
            dept, outcome = await build_department(
                _action_deps(d), b.get("name"), b.get("mission"), b.get("worker_model")
            )
        except DepartmentError as e:
            return problem(400, str(e))
        if outcome == "exists":
            return problem(409, f"{dept['name']} is already standing.", "Pick another name.")
        return reply(201, {"department": dept, "outcome": outcome})
    if is_("DELETE", r"/departments/[\w-]+"):
        # The owner demolishes a department (City or Settings, after an inline "Demolish …?" with Yes / Keep).
        if _body(event).get("confirm") is not True:
            return problem(400, "Nothing was demolished.", "Confirm the demolition first.")
        try:
            dept = await find_standing(_action_deps(d), seg[1])
        except DepartmentError as e:
            return problem(404, str(e))
        return reply(200, await demolish_department(_action_deps(d), dept))
    if is_("GET", r"/agents"):
        return reply(200, {"agents": await d.ledger.list_agents()})
    if is_("GET", r"/workforce"):
        workers = [a for a in await d.ledger.list_agents() if a.get("kind") == "worker"]
        return reply(200, {"workers": workers, "specialists": await d.ledger.list_specialists()})
    if is_("GET", r"/costs"):
        return reply(200, await _costs(d))
    if is_("GET", r"/health"):
        s = await d.settings()
        return reply(
            200,
            {
                "workers_busy": await d.ledger.active_workers(),
                "worker_ceiling": s.get("max_concurrent_workers_global"),
                "stale_turns": len(await d.ledger.stale_work()),
            },
        )
    if is_("GET", r"/questions"):
        await _sweep(d)
        return reply(
            200, {"questions": await d.ledger.open_questions(), "approvals": await d.ledger.pending_approvals()}
        )
    if is_("POST", r"/questions/[\w-]+/(answer|default)"):
        given = None if seg[2] == "default" else _str(_body(event).get("answer"), "Answer")
        return await decide_question(d, seg[1], given, "owner")
    if is_("POST", r"/approvals/[\w-]+"):
        b = _body(event)
        if not isinstance(b.get("approved"), bool):
            raise BadRequest("Say approve or refuse.")
        return await decide_approval(d, seg[1], b["approved"], b.get("grants"), b.get("pinned"))
    if is_("GET", r"/apps"):
        return reply(200, {"apps": await list_apps(d.ledger)})
    if is_("GET", r"/apps/[\w-]+/activity"):
        items = await app_activity(d.ledger, seg[1])
        if items is None:
            return problem(404, "That app does not exist.")
        return reply(200, {"items": items})
    if is_("DELETE", r"/apps/[\w-]+"):
        if d.apps is None:
            return problem(503, "Apps are not set up yet.")
        gone = await remove_app(d.ledger, d.bus, d.apps, seg[1])
        if not gone:
            return problem(404, "That app does not exist.")
        await _grants_changed(d)
        return reply(200, {"removed": seg[1]})
    if is_("PUT", r"/apps/[\w-]+"):
        b = _body(event)
        try:
            updated = await update_app(d.ledger, d.bus, seg[1], {k: b[k] for k in ("grants", "pinned") if k in b})
        except ValueError as e:
            return problem(400, str(e))
        if not updated:
            return problem(404, "That app does not exist.")
        if "grants" in b:
            await _grants_changed(d)
        return reply(200, {"app": updated})
    if is_("POST", r"/apps/[\w-]+/rollback"):
        if d.apps is None:
            return problem(503, "Apps are not set up yet.")
        try:
            back = await rollback_app(d.ledger, d.bus, d.apps, seg[1])
        except ValueError as e:
            return problem(409, str(e))
        if not back:
            return problem(404, "That app does not exist.")
        await _grants_changed(d)
        return reply(200, {"app": back})
    if is_("POST", r"/apps/[\w-]+/(bridge|proposals)"):
        if len(str(event.get("body") or "")) > 32_000:
            raise BadRequest("That request is too big.")
        b = _body(event)
        target = await get_app(d.ledger, seg[1])
        if not target:
            return reply(404, {"ok": False, "error": "unavailable", "message": "That app does not exist."})
        if seg[2] == "bridge":
            ans = await api_bridge(d.ledger, target, b.get("cap"), b.get("params"), d.bridge_invoke)
        else:
            ans = await file_proposal(d.ledger, d.bus, target, b, d.proposals)
        return reply(ans.status, ans.body)
    if is_("GET", r"/chief-of-staff"):
        return reply(200, await chief_status(d.ledger, await d.settings()))
    if is_("GET", r"/away-summary"):
        since = str(q.get("since") or "")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?", since):
            since = now_iso(d.ledger.now() - timedelta(days=7))
        return reply(200, await away_summary(d.ledger, since))
    if is_("GET", r"/support-tickets"):
        # The support desk's board (decision 131): every customer ticket and where it stands.
        status = str(q.get("status") or "") or None
        return reply(200, {"tickets": await desk.list_tickets(d.ledger, status), "board": desk.BOARD})
    if is_("GET", r"/executives"):
        # The Executive Leadership layer (decision 140): the four, on or off; their advice; the optional reviews.
        return reply(200, await execs.status(d.ledger))
    if is_("PUT", r"/executives"):
        try:
            await execs.set_config(d.ledger, _body(event))
        except execs.Invalid as e:
            return problem(400, str(e))
        return reply(200, await execs.status(d.ledger))
    if is_("GET", r"/company"):
        # The company brief and its operating mode (decision 136), for Settings → Company.
        return reply(200, {"brief": await company.get_brief(d.ledger),
                           "orders": await company.operating_orders(d.ledger)})  # fmt: skip
    if is_("PUT", r"/company"):
        try:
            await company.set_brief(d.ledger, _body(event))
        except company.Invalid as e:
            return problem(400, str(e))
        return reply(200, {"brief": await company.get_brief(d.ledger),
                           "orders": await company.operating_orders(d.ledger)})  # fmt: skip
    if is_("DELETE", r"/company"):
        await company.clear_brief(d.ledger)
        return reply(200, {"brief": None, "orders": await company.operating_orders(d.ledger)})
    if is_("GET", r"/deals"):
        # AI City's own sales pipeline (decision 133); the stale ones are what Sales follows up next.
        stage = str(q.get("stage") or "") or None
        return reply(200, {"deals": await deals.list_deals(d.ledger, None, stage), "stale_days": deals.STALE_DAYS})
    if is_("GET", r"/standing-orders"):
        return reply(200, {"standing_orders": await standing.list_orders(d.ledger)})
    if is_("POST", r"/standing-orders"):
        try:
            return reply(201, {"standing_order": await standing.add_order(d.ledger, _body(event))})
        except standing.Invalid as e:
            return problem(400, str(e))
    if is_("PUT", r"/standing-orders/[\w-]+"):
        try:
            o = await standing.update_order(d.ledger, seg[1], _body(event))
        except standing.Invalid as e:
            return problem(400, str(e))
        return reply(200, {"standing_order": o}) if o else problem(404, "That standing order does not exist.")
    if is_("DELETE", r"/standing-orders/[\w-]+"):
        if not await standing.delete_order(d.ledger, seg[1]):
            return problem(404, "That standing order does not exist.")
        return reply(200, {"removed": seg[1]})
    if is_("GET", r"/settings"):
        return reply(200, {"settings": await d.settings()})
    if is_("PUT", r"/settings"):
        return await _put_settings(_body(event), d)
    if is_("POST", r"/workers/home"):
        # The owner's "send everyone home", straight from the HUD: no model in the loop, instant.
        return reply(200, await send_workers_home(_action_deps(d)))
    if is_("POST", r"/agents/[\w-]+/home"):
        # The owner clicked a worker in the City and chose "Send home": that one worker, nothing else.
        w = await d.ledger.get_agent(seg[1])
        if not w or w.get("kind") != "worker":
            return problem(404, "That is not a worker.", "Managers stay with their department; send its workers home.")
        if w.get("state") == "retired" or w.get("worker_state") == "released":
            return problem(409, "That worker is already home.")
        r = await send_home(_action_deps(d), [w])
        if not r["workers"]:  # the HUD must never say "walking home" about someone still at a desk
            return problem(
                500,
                "That worker could not be sent home.",
                "Try again. If it keeps failing, use Start over in Settings.",
            )
        return reply(200, r)
    if is_("POST", r"/city/reset"):
        # The owner's "start over" (Settings): the city is emptied and nothing runs afterwards. No model in the
        # loop; the HUD asks for a held button first and sends confirm=true, nothing else resets anything.
        if _body(event).get("confirm") is not True:
            return problem(400, "Nothing was reset.", "Hold the Start over button in Settings to confirm.")
        # One round fits the Lambda's 30 s; a big city takes several, and the HUD keeps calling until `done`.
        res = await d.ledger.reset_city(budget_s=RESET_ROUND_S)
        cleared: dict[str, int] = res["gone"]
        if res["done"]:
            await d.queue.purge()
        log("info", "city.reset", records=sum(cleared.values()), kinds=json.dumps(cleared), done=res["done"])
        return reply(200, {"gone": cleared, "records": sum(cleared.values()), "done": res["done"]})
    if is_("POST", r"/tasks/[\w-]+/cancel"):
        task = await d.ledger.get_ticket(seg[1])
        if not task or task.get("kind") != "task":
            return problem(404, "That job does not exist.")
        if task.get("status") in DONE_OR_GONE:
            return problem(409, "That job is not running.")
        return reply(200, await cancel_task(_action_deps(d), task))
    if is_("GET", r"/memory"):
        return reply(
            200, {"notes": await d.ledger.list_notes("note"), "reminders": await d.ledger.list_notes("reminder")}
        )
    if is_("POST", r"/notes"):
        b = _body(event)
        kind: Literal["note", "reminder"] = "reminder" if b.get("kind") == "reminder" else "note"
        due = _str(b.get("due_at"), "Due time", 40) if kind == "reminder" else None
        if due:
            try:
                datetime.fromisoformat(due.replace("Z", "+00:00"))
            except ValueError as e:
                raise BadRequest("That due time is not a date.") from e
        return reply(201, await d.ledger.add_note(_str(b.get("text"), "Note"), kind, due))
    if seg and seg[0] == "connectors":
        found = await connectors_route(_connectors(d), method, seg, lambda: _body(event))
        if found:
            return reply(*found)
    if seg and seg[0] in ("features", "calendar"):
        cal = d.calendar or CalendarApi(d.ledger.table, d.ledger.now, claim=d.ledger.claim)
        found = await calendar_route(cal, method, seg, lambda: _body(event), event.get("queryStringParameters") or {})
        if found:
            return reply(*found)
    if seg and seg[0] == "mail":
        if d.mail is None:
            return problem(503, "Mail and calendar aren't set up yet.", "The owner turns them on with a deploy.")
        found = await mail_route(d.mail, method, seg, lambda: _body(event))
        if found:
            return reply(*found)
    if seg and seg[0] == "skills":
        found = await skills_route(
            d.skills or SkillsApi(d.ledger), method, seg, lambda: _body(event), event.get("queryStringParameters") or {}
        )
        if found:
            return reply(*found)
    if path == "/knowledge" or path.startswith("/knowledge/"):
        return await _knowledge(event, method, path, d)
    if path == "/files" or path.startswith("/files/"):
        return await _files(event, method, path, d)
    return problem(404, "There is nothing here.")


_ITEM = r"k-[\w-]{12}"
_FILE = r"f-[\w-]{12}"


async def _files(event: dict[str, Any], method: str, path: str, d: ApiDeps) -> dict[str, Any]:
    """The Files routes (``docs/FILES.md`` §7). The owner check already ran in ``handle_http``."""
    f = d.files
    if f is None:
        return problem(503, "Files isn't set up yet.", "Deploy it first, then try again.")

    def is_(m: str, pattern: str) -> bool:
        return method == m and re.fullmatch(pattern, path) is not None

    file_id = path.split("/")[2] if re.fullmatch(rf"/files/{_FILE}(/retry)?", path) else ""
    try:
        if is_("GET", r"/files"):
            return reply(200, await f.list(event.get("queryStringParameters") or {}))
        if is_("GET", rf"/files/{_FILE}"):
            return reply(200, await f.get(file_id))
        if is_("POST", r"/files/uploads"):
            return reply(201, await f.create_upload(_body(event)))
        if is_("POST", rf"/files/uploads/{_FILE}/complete"):
            return reply(200, {"file": await f.complete_upload(path.split("/")[3], _body(event))})
        if is_("PUT", rf"/files/{_FILE}"):
            return reply(200, {"file": await f.update(file_id, _body(event))})
        if is_("DELETE", rf"/files/{_FILE}"):
            await f.delete(file_id)
            return reply(200, {"ok": True})
        if is_("POST", rf"/files/{_FILE}/retry"):
            return reply(200, {"file": await f.retry(file_id)})
    except FileNotFound as e:
        return problem(404, str(e))
    except FilesError as e:
        return problem(400, str(e))
    return problem(404, "There is nothing here.")


async def _knowledge(event: dict[str, Any], method: str, path: str, d: ApiDeps) -> dict[str, Any]:
    """The knowledge routes (``docs/KNOWLEDGE.md`` §5). The owner check already ran in ``handle_http``."""
    k = d.knowledge
    if k is None:
        return problem(503, "The knowledge base is not set up yet.", "Deploy it first, then try again.")

    def is_(m: str, pattern: str) -> bool:
        return method == m and re.fullmatch(pattern, path) is not None

    if path == "/knowledge/entries" or path.startswith("/knowledge/entries/"):
        return await _entries(event, method, path, d)
    item_id = path.rsplit("/", maxsplit=1)[-1] if re.fullmatch(rf"/knowledge/{_ITEM}", path) else ""
    try:
        if is_("GET", r"/knowledge"):
            await ensure_builtin_guide(k.store, k.blobs, k.kb)  # the built-in guide, and how far its indexing is
            await remove_legacy_copies(k)
            return reply(200, await k.list())
        if is_("GET", rf"/knowledge/{_ITEM}"):
            return reply(200, await k.get(item_id))
        if is_("GET", rf"/knowledge/(?:{_ITEM}|{GUIDE_ID})/download"):
            return reply(200, await item_download(k.store, k.blobs, path.split("/")[2]))
        if is_("POST", r"/knowledge/uploads"):
            return reply(201, await k.create_upload(_body(event)))
        if is_("POST", rf"/knowledge/uploads/{_ITEM}/complete"):
            return reply(200, {"item": await k.complete_upload(path.split("/")[3], _body(event))})
        if is_("POST", r"/knowledge/links"):
            b = _body(event)
            return reply(201, {"item": await k.add_link(b.get("url"), b.get("title"), b.get("scope"))})
        if is_("POST", r"/knowledge/text"):
            b = _body(event, 1_200_000)
            return reply(201, {"item": await k.add_text(b.get("text"), b.get("title"), b.get("scope"))})
        if is_("PUT", rf"/knowledge/{_ITEM}"):
            return reply(200, {"item": await k.update(item_id, _body(event))})
        if is_("DELETE", rf"/knowledge/{_ITEM}"):
            await k.delete(item_id)
            return reply(200, {"ok": True})
    except NotFound as e:
        return problem(404, str(e))
    except KnowledgeError as e:
        return problem(400, str(e))
    return problem(404, "There is nothing here.")


_ENTRY = r"[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+"
_entry_service: EntryService | None = None


def entry_service(d: ApiDeps) -> EntryService:
    """One per process (it caches the seed files read from the package)."""
    global _entry_service
    k = d.knowledge
    assert k is not None
    if _entry_service is None or _entry_service.registry.table is not k.store.table:
        _entry_service = EntryService(EntryRegistry(k.store.table), EntryProjector(k.blobs, k.kb, k.store.graph))
    return _entry_service


async def _entries(event: dict[str, Any], method: str, path: str, d: ApiDeps) -> dict[str, Any]:
    """Department knowledge entries (``docs/KNOWLEDGE.md`` §17): owner-only like every route."""
    s = entry_service(d)
    m = re.fullmatch(rf"/knowledge/entries(?:/({_ENTRY}))?(?:/(reset|reindex|download))?", path)
    if not m:
        return problem(404, "There is nothing here.")
    eid, verb = m.group(1), m.group(2)
    try:
        if method == "GET" and not eid:
            q = {k: str(v) for k, v in (event.get("queryStringParameters") or {}).items() if v}
            return reply(200, await s.list(q))
        if method == "POST" and not eid:
            return reply(201, {"entry": await s.create(_body(event, 200_000))})
        if eid and not verb:
            if method == "GET":
                return reply(200, await s.get(eid))
            if method == "PUT":
                return reply(200, {"entry": await s.update(eid, _body(event, 200_000))})
            if method == "DELETE":
                return reply(200, {"entry": await s.delete(eid)})
        if eid and method == "POST" and verb == "reset":
            return reply(200, {"entry": await s.reset(eid)})
        if eid and method == "POST" and verb == "reindex":
            return reply(200, {"entry": await s.reindex(eid)})
        if eid and method == "GET" and verb == "download":
            return reply(200, await s.download(eid))
    except EntryNotFound as e:
        return problem(404, str(e))
    except EntryError as e:
        return problem(400, str(e))
    return problem(404, "There is nothing here.")


async def decide_question(d: ApiDeps, id: str, given: str | None, by: str) -> dict[str, Any]:
    """The owner's answer (``given``) or the default (None), from the HUD or the Chief of Staff (``by``)."""
    qn = await d.ledger.get_question(id)
    if not qn or qn.get("status") != "open":
        return problem(409, "That question was already answered.", "Refresh the list.")
    answer = qn["default_answer"] if given is None else given
    await answer_question(_action_deps(d), qn["id"], answer, by)
    return reply(200, {"answered": True, "answer": answer})


async def decide_approval(
    d: ApiDeps, id: str, approved: bool, grants: Any = None, pinned: Any = None
) -> dict[str, Any]:
    """Approve or refuse one pending approval: the same steps whether the owner or the Chief of Staff decides."""
    cur = await d.ledger.get_approval(id)
    if not cur:
        return problem(404, "That approval does not exist.")
    if cur.get("status") != "pending":
        return problem(409, "That approval was already decided.")
    app: Record | None = None
    if cur.get("kind") == "app.publish":
        draft_id = str(cur.get("draft_id") or "")
        if approved:
            if d.apps is None:
                return problem(503, "Apps are not set up yet.", "Deploy the apps origin, then try again.")
            dr = await get_draft(d.ledger, draft_id)
            if not dr:
                return problem(404, "That app draft is gone.")
            if grants is not None and not isinstance(grants, list):
                raise BadRequest("grants must be a list.")
            if pinned is not None and not isinstance(pinned, bool):
                raise BadRequest("pinned must be true or false.")
            # Publish first: if it fails, the approval stays pending and the owner can try again.
            try:
                app = await publish_draft(d.ledger, d.bus, d.apps, draft_id, grants, pinned)
            except Invalid as e:
                return problem(400, str(e))
            except ValueError as e:
                return problem(409, str(e))
        else:
            await refuse_draft(d.ledger, draft_id)
    a = await d.ledger.decide_approval(cur["id"], approved)
    if a is None:  # decided by someone else meanwhile
        return problem(409, "That approval was already decided.")
    if cur.get("kind") == "connector.add":
        # Only a yes (the owner's or the Chief of Staff's, decision 124) moves an add-connector request on (§1.3.4);
        # a no deletes the record.
        await on_connector_approval(_connectors(d), cur, approved)
    # Re-read for the token: the workflow may have stored it after ``cur`` was read (approvals.py sends the result
    # itself when it stores the token after this decision).
    token = (await d.ledger.get_approval(cur["id"]) or {}).get("task_token")
    if token and d.sfn is not None:
        try:
            if approved:
                await asyncio.to_thread(
                    d.sfn.send_task_success,
                    taskToken=token,
                    output=json.dumps({"approved": True, "id": cur["id"]}),
                )
            else:
                await asyncio.to_thread(
                    d.sfn.send_task_failure, taskToken=token, error="Refused", cause="The owner refused."
                )
        except Exception as e:  # the workflow already got the result from approvals.py
            log("info", "approval.sfn_already_sent", id=cur["id"], error=type(e).__name__)
    await d.bus.put({"type": "approval.decided", "id": a["id"], "approved": approved})
    if approved and str(cur.get("requested_by", "")).startswith("app:"):
        # An app's proposal: run that one tool once, exactly as the owner saw it.
        return reply(200, {"approval": a, "result": await run_proposal(cur, d.proposals)})
    if app:
        await _grants_changed(d)
        return reply(200, {"approval": a, "app": app})
    return reply(200, {"approval": a})


async def steward_apply(op: dict[str, Any], d: ApiDeps) -> dict[str, Any]:
    """Carries out one Chief of Staff decision (decision 124) through the routes' own code, then records it.

    Reached only by a direct invoke from the chief-of-staff Lambda (IAM: that role alone may invoke this
    function besides API Gateway); an HTTP event never has the ``chief_of_staff`` key."""
    kind, id, reason = op.get("kind"), str(op.get("id") or ""), str(op.get("reason") or "")[:240]
    if kind not in ("question", "approval") or not re.fullmatch(r"[\w-]{1,64}", id):
        return {"ok": False, "error": "bad op"}
    item = await (d.ledger.get_question(id) if kind == "question" else d.ledger.get_approval(id))
    if not item:
        return {"ok": False, "error": "gone"}
    which = op.get("op")
    if which == "stop_job":
        task = await d.ledger.get_ticket(str(item.get("ticket_id") or ""))
        for _ in range(20):
            if not task or task.get("kind", "task") == "task" or not task.get("parent_id"):
                break
            task = await d.ledger.get_ticket(str(task["parent_id"]))
        if not task or task.get("kind", "task") != "task" or task.get("status") in DONE_OR_GONE:
            return {"ok": False, "error": "no running job"}
        await cancel_task(_action_deps(d), task)
        choice = "Stopped the job"
    elif kind == "question" and which in ("answer", "default"):
        given = None if which == "default" else str(op.get("answer") or "")[:4000]
        if given == "":
            return {"ok": False, "error": "empty answer"}
        r = await decide_question(d, id, given, CHIEF)
        if r["statusCode"] != 200:
            return {"ok": False, "status": r["statusCode"]}
        choice = str(json.loads(r["body"])["answer"])
    elif kind == "approval" and which in ("approve", "refuse"):
        r = await decide_approval(d, id, which == "approve")
        if r["statusCode"] != 200:
            return {"ok": False, "status": r["statusCode"]}
        choice = "Approved" if which == "approve" else "Refused"
    else:
        return {"ok": False, "error": "bad op"}
    await record_decision(d.ledger, d.bus, kind, item, choice, reason)
    return {"ok": True, "choice": choice}


async def vaic_call(call: dict[str, Any], d: ApiDeps) -> dict[str, Any]:
    """One HUD route run for the owner by VAIC (decision 143): the same router and checks as the owner's own request.

    Reached only by a direct invoke from VAIC's runtime role (IAM); an HTTP event never has the ``vaic_call`` key, so
    nothing on the internet can take this path. The secret-taking and VAIC's own routes are refused here too."""
    method, path = str(call.get("method") or "GET").upper(), str(call.get("path") or "")
    why = owner_api.refusal(method, path)
    if why:
        return problem(403, why)
    event = owner_api.to_event(method, path, call.get("body"))
    log("info", "api.vaic_call", method=method, path=owner_api.clean_path(path))
    try:
        r = await _route(event, d)
        if int(r.get("statusCode", 200)) >= 400:  # refused: log why, so a failed save from the chat can be traced
            log("error", "api.vaic_refused", method=method, path=owner_api.clean_path(path),
                status=r.get("statusCode"), detail=str(r.get("body") or "")[:300])  # fmt: skip
        return r
    except BadRequest as e:
        log(
            "error", "api.vaic_refused", method=method, path=owner_api.clean_path(path), status=400, detail=str(e)[:300]
        )
        return problem(400, str(e))
    except (AttributeError, TypeError, KeyError) as e:
        # A body in a shape the route doesn't take (a list where it reads an object, a missing key): say so, so
        # VAIC can fix the call and ask again, instead of "something went wrong" (decision 209).
        log("error", "api.failed", path=path, error=type(e).__name__, via="vaic", detail=str(e)[:300])
        return problem(
            400,
            f"That body doesn't fit {method} {owner_api.clean_path(path)} ({type(e).__name__}: {str(e)[:200]}). "
            "Check the shape the route takes and send it again.",
        )
    except Exception as e:
        log("error", "api.failed", path=path, error=type(e).__name__, via="vaic")
        return problem(500, f"Something went wrong on our side ({type(e).__name__}: {str(e)[:300]}).")


def _connectors(d: ApiDeps) -> ConnectorsApi:
    from vaic.shared.connectors import ConnectorStore

    return d.connectors or ConnectorsApi(ConnectorStore(d.ledger.table, d.ledger.now), d.bus)


async def _put_settings(b: dict[str, Any], d: ApiDeps) -> dict[str, Any]:
    patch, bad = settings_patch(b, await d.settings())
    if bad:
        return problem(400, bad)
    await d.ledger.update_settings(patch)
    return reply(200, {"settings": await d.settings()})


FIRST_LOGIN_EMAIL_WINDOW_MS = 10 * 60_000
FIRST_LOGIN_ACCEPTED = {
    "accepted": True,
    "message": "If this is the owner's email, a new first-login email is on its way.",
}


async def first_login_email(event: dict[str, Any], d: ApiDeps) -> dict[str, Any]:
    """The one route that works without a token: re-sends the owner's invitation (a new temporary password).

    It answers the same way whatever the email, so it never tells anyone whether an account exists. It sends
    only to the owner's own address, and at most once every 10 minutes.
    """
    email = str(_body(event).get("email") or "").strip().lower()
    owner = (d.owner_email or "").strip().lower()
    if not email or len(email) > 254:
        raise BadRequest("Type your email.")
    if not owner or email != owner or d.cognito is None or not d.user_pool_id:
        return reply(202, FIRST_LOGIN_ACCEPTED)
    window = d.ledger.now_ms() // FIRST_LOGIN_EMAIL_WINDOW_MS
    if not await d.ledger.claim(f"first-login-email:{window}", 3600):
        log("info", "auth.first_login_email.throttled")
        return reply(202, FIRST_LOGIN_ACCEPTED)
    try:
        await asyncio.to_thread(
            d.cognito.admin_create_user,
            UserPoolId=d.user_pool_id,
            Username=owner,
            MessageAction="RESEND",
            DesiredDeliveryMediums=["EMAIL"],
        )
        log("info", "auth.first_login_email.sent")
    except Exception as e:
        # UnsupportedUserStateException: the owner already chose a password, so "Forgot password" is the way.
        code = (getattr(e, "response", None) or {}).get("Error", {}).get("Code", type(e).__name__)
        log("warn", "auth.first_login_email.not_sent", error=str(code))
    return reply(202, FIRST_LOGIN_ACCEPTED)


async def handle_http(event: dict[str, Any], d: ApiDeps) -> dict[str, Any]:
    method = ((event.get("requestContext") or {}).get("http") or {}).get("method", "").upper()
    if method == "POST" and (event.get("rawPath") or "").rstrip("/") == "/auth/first-login-email":
        try:
            return await first_login_email(event, d)
        except BadRequest as e:
            return problem(400, str(e))
        except Exception as e:
            log("error", "api.failed", path="/auth/first-login-email", error=type(e).__name__)
            return reply(202, FIRST_LOGIN_ACCEPTED)
    if not is_owner(event):
        return problem(403, "Only the owner can use AI City.", "Sign in again with the owner account.")
    try:
        return await _route(event, d)
    except BadRequest as e:
        return problem(400, str(e))
    except Exception as e:
        log("error", "api.failed", path=event.get("rawPath"), error=type(e).__name__)
        return problem(500, "Something went wrong on our side. Nothing was lost.", "Try again in a moment.")


_deps: ApiDeps | None = None


def _connectors_from_env(city: Any, github_token: Callable[[], Awaitable[str | None]]) -> ConnectorsApi:
    from vaic.shared.connectors import ConnectorStore

    fn = os.environ.get("VAIC_CONNECTORS_FUNCTION")
    lam = city.session.client("lambda")

    async def invoke(payload: dict[str, Any]) -> None:
        if not fn:
            raise RuntimeError("VAIC_CONNECTORS_FUNCTION is not set")
        await asyncio.to_thread(
            lam.invoke, FunctionName=fn, InvocationType="Event", Payload=json.dumps(payload).encode()
        )

    return ConnectorsApi(
        store=ConnectorStore(city.ledger.table, city.ledger.now),
        bus=city.bus,
        invoke=invoke,
        identity=city.session.client("bedrock-agentcore"),
        control=city.session.client("bedrock-agentcore-control"),
        secrets=city.session.client("secretsmanager"),
        workload=os.environ.get("VAIC_CONNECTORS_WORKLOAD"),
        hud_origin=os.environ.get("VAIC_HUD_ORIGIN"),
        kms_key=os.environ.get("VAIC_KMS_KEY_ARN"),
        github_token=github_token,
    )


def _mail_from_env(city: Any) -> MailApi | None:
    if not os.environ.get("VAIC_MAIL_WORKLOAD"):
        return None
    from vaic.mail.service import MailService

    return MailApi(
        service=MailService.from_env(city.ledger, city.session),
        secrets=city.session.client("secretsmanager"),
        hud_origin=os.environ.get("VAIC_HUD_ORIGIN"),
        kms_key=os.environ.get("VAIC_KMS_KEY_ARN"),
        bus_put=city.bus.put,
    )


def _bridge_invoke(session: Any, fn: str | None) -> Invoke | None:
    if not fn:
        return None
    client = session.client("lambda")

    async def invoke(payload: dict[str, Any]) -> dict[str, Any]:
        r = await asyncio.to_thread(
            client.invoke, FunctionName=fn, InvocationType="RequestResponse", Payload=json.dumps(payload).encode()
        )
        if r.get("FunctionError"):
            raise RuntimeError("the app bridge failed")
        out = json.loads(r["Payload"].read())
        return out if isinstance(out, dict) else {}

    return invoke


def _job_starter(session: Any, fn: str | None, job: str) -> Callable[[], Awaitable[None]] | None:
    """Async-invokes the scheduler Lambda with one job (the calendar's "Refresh now"); None when not deployed."""
    if not fn:
        return None
    client = session.client("lambda")

    async def start() -> None:
        await asyncio.to_thread(
            client.invoke, FunctionName=fn, InvocationType="Event", Payload=json.dumps({"job": job}).encode()
        )

    return start


def _policies_refresh(session: Any, fn: str | None) -> Callable[[], Awaitable[None]] | None:
    """Async-invokes the connectors Lambda with ``{"action": "policies"}``; nothing when it isn't deployed."""
    if not fn:
        return None
    client = session.client("lambda")

    async def refresh() -> None:
        await asyncio.to_thread(
            client.invoke, FunctionName=fn, InvocationType="Event", Payload=json.dumps({"action": "policies"}).encode()
        )

    return refresh


def _apps_origin(session: Any) -> AppsOrigin | None:
    bucket, url = os.environ.get("VAIC_APPS_BUCKET"), os.environ.get("VAIC_APPS_URL")
    if not bucket or not url:
        return None
    return AppsOrigin(
        s3=session.client("s3"),
        bucket=bucket,
        url=url,
        cloudfront=session.client("cloudfront"),
        distribution_id=os.environ.get("VAIC_APPS_DISTRIBUTION_ID"),
    )


def _knowledge_service(session: Any, bus: EventBus) -> KnowledgeService | None:
    k = knowledge_from_env(session)
    if not k or not k.blobs:
        return None
    return KnowledgeService(store=k.store, blobs=k.blobs, bus=bus, kb=k.kb)


def _files_service(session: Any, bus: EventBus) -> FilesService | None:
    f = files_from_env(session)
    if not f:
        return None
    fn = os.environ.get("FILES_FUNCTION")
    reindex = None
    if fn:
        lam = client(session, "lambda")

        async def reindex(file_id: str) -> None:
            await asyncio.to_thread(
                lam.invoke,
                FunctionName=fn,
                InvocationType="Event",
                Payload=json.dumps({"action": "index", "file_id": file_id}).encode(),
            )

    from vaic.shared.files.cdn import cdn_from_env

    return FilesService(
        store=f.store,
        blobs=f.blobs,
        bus=bus,
        embedder=f.embedder,
        reindex=reindex,
        cdn=cdn_from_env(session, os.environ),
    )


def build_deps() -> ApiDeps:
    city = aws_city()
    github = GitHubDeps(
        secrets=client(city.session, "secretsmanager"),
        secret_name=os.environ.get("VAIC_GITHUB_SECRET", "vaic/prod/github"),
        kms_key=os.environ.get("VAIC_KMS_KEY_ARN"),
        tags={"Project": "ai-city", "Component": "github"},
    )
    return ApiDeps(
        ledger=city.ledger,
        bus=city.bus,
        queue=city.queue,
        settings=city.settings,
        sfn=client(city.session, "stepfunctions"),
        utility_runner=bedrock_converse_runner(client(city.session, "bedrock-runtime")),
        cognito=client(city.session, "cognito-idp"),
        user_pool_id=os.environ.get("VAIC_USER_POOL_ID"),
        owner_email=os.environ.get("VAIC_OWNER_EMAIL"),
        knowledge=_knowledge_service(city.session, city.bus),
        files=_files_service(city.session, city.bus),
        apps=_apps_origin(city.session),
        bridge_invoke=_bridge_invoke(city.session, os.environ.get("VAIC_APP_BRIDGE_FUNCTION")),
        proposals=proposals_from_env(city.ledger),
        grants_changed=_policies_refresh(city.session, os.environ.get("VAIC_CONNECTORS_FUNCTION")),
        connectors=_connectors_from_env(city, github.token),
        skills=SkillsApi(city.ledger, city.session.client("s3"), os.environ.get("VAIC_SKILLS_BUCKET")),
        mail=_mail_from_env(city),
        calendar=CalendarApi(
            city.ledger.table,
            city.ledger.now,
            refresh=_job_starter(city.session, os.environ.get("VAIC_SCHEDULER_FUNCTION"), "calendar_import"),
            claim=city.ledger.claim,
        ),
        push=_push_from_env(city),
        speech=_speech_from_env(city),
        github=github,
        voice=_voice_from_env(city),
    )


def _voice_from_env(city: Any) -> VoiceUrlDeps | None:
    arn = os.environ.get("VAIC_RUNTIME_ARN_VAIC")
    if not arn:
        return None
    from .dispatcher import session_id_for

    owner, version = os.environ.get("VAIC_OWNER_ID", "owner"), os.environ.get("VAIC_RUNTIME_VERSION", "")
    return VoiceUrlDeps(
        session=city.session,
        region=city.region,
        runtime_arn=arn,
        # VAIC's warm session (the same id the dispatcher uses), so the voice starts next to warm clients.
        session_id=lambda: session_id_for(cast(WorkMessage, {"role": "vaic", "conversation": "main"}), owner, version),
    )


def _speech_from_env(city: Any) -> SpeechDeps:
    return SpeechDeps(
        secrets=client(city.session, "secretsmanager"),
        secret_name=os.environ.get("VAIC_OPENAI_SECRET", "vaic/prod/openai"),
        kms_key=os.environ.get("VAIC_KMS_KEY_ARN"),
        tags={"Project": "ai-city", "Component": "voice"},
    )


def _push_from_env(city: Any) -> PushDeps:
    env = os.environ.get
    apps = PushApps(
        env("VAIC_APNS_ARN", ""),
        env("VAIC_APNS_SANDBOX_ARN", ""),
        env("VAIC_APNS_VOIP_ARN", ""),
        env("VAIC_APNS_VOIP_SANDBOX_ARN", ""),
    )
    return PushDeps(
        store=DeviceStore(city.ledger.table, city.ledger.now),
        sns=client(city.session, "sns"),
        apps=apps,
        secrets=client(city.session, "secretsmanager"),
        secret_name=os.environ.get("VAIC_APNS_SECRET", "vaic/prod/apns"),
        kms_key=os.environ.get("VAIC_KMS_KEY_ARN"),
        tags={"Project": "ai-city", "Component": "notifications"},
    )


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    global _deps
    if _deps is None:
        _deps = build_deps()
    if isinstance(event.get("chief_of_staff"), dict):  # a direct invoke from the chief-of-staff Lambda
        return run(steward_apply(event["chief_of_staff"], _deps))
    if isinstance(event.get("vaic_call"), dict):  # a direct invoke from VAIC's runtime (decision 143)
        return run(vaic_call(event["vaic_call"], _deps))
    return run(handle_http(event, _deps))


def _init_at_load() -> None:
    """Inside Lambda, build the clients while the module loads, so the SnapStart snapshot already holds them.
    If that fails (say, a missing variable), the first request tries again and reports it."""
    global _deps
    if not os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return
    try:
        _deps = build_deps()
    except Exception as e:
        log("warn", "api.init_deferred", error=type(e).__name__)


_init_at_load()
