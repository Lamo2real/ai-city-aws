"""The HTTP API (API Gateway HTTP API + Cognito JWT authorizer).

API Gateway validates the token; this handler checks again that the caller is in the ``owner`` group, on
every route. Replies are plain data for the HUD; errors are plain words, never stack traces.
"""

from __future__ import annotations

import asyncio
import base64
import json
import math
import os
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal, cast

from aic.shared.app_bridge import Invoke, api_bridge, file_proposal, run_proposal
from aic.shared.app_caps import Invalid, MailProposals, proposals_from_env
from aic.shared.apps import (
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
from aic.shared.aws import aws_city
from aic.shared.caps import validate_caps
from aic.shared.clients import client
from aic.shared.config import caps_config
from aic.shared.events import EventBus
from aic.shared.hierarchy.actions import CityDeps, answer_question
from aic.shared.hierarchy.queue import Queue, WorkMessage
from aic.shared.ids import department_key, new_id
from aic.shared.knowledge.service import KnowledgeError, KnowledgeService, NotFound
from aic.shared.knowledge.wiring import knowledge_from_env
from aic.shared.ledger import Ledger, Record
from aic.shared.log import log
from aic.shared.models import model_label
from aic.shared.turn import ModelRunner
from aic.shared.utility import UtilityDeps, bedrock_converse_runner, is_addressed_to_ace

from ._runtime import run
from .connectors_api import ConnectorsApi, on_connector_approval
from .connectors_api import route as connectors_route
from .mail_api import MailApi
from .mail_api import route as mail_route
from .skills_api import SkillsApi
from .skills_api import route as skills_route

LIVE = ("open", "in_progress", "in_review", "waiting_on_owner")
ALL = (*LIVE, "parked", "done", "failed", "cancelled")

ROUTES: list[tuple[str, str]] = [
    ("GET", "/city"),
    ("GET", "/city/agent?id=x"),
    ("POST", "/city/instruct"),
    ("POST", "/messages"),
    ("POST", "/wake-check"),
    ("GET", "/tickets"),
    ("GET", "/tickets/t-1"),
    ("GET", "/departments"),
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
    ("POST", "/city/pause"),
    ("POST", "/city/resume"),
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
    ("GET", "/mail/accounts"),
    ("POST", "/mail/accounts"),
    ("PUT", "/mail/accounts/ma-0000aaaa"),
    ("DELETE", "/mail/accounts/ma-0000aaaa"),
    ("POST", "/mail/accounts/ma-0000aaaa/signin"),
    ("POST", "/mail/accounts/ma-0000aaaa/complete"),
    ("POST", "/mail/accounts/ma-0000aaaa/imap"),
    ("GET", "/mail/rules"),
    ("POST", "/mail/rules"),
    ("DELETE", "/mail/rules/rule-1"),
    ("GET", "/apps"),
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
    connectors: ConnectorsApi | None = None
    """The ``/connectors*`` routes and the add-connector approval hook; None = built from ledger and bus."""
    skills: SkillsApi | None = None
    mail: MailApi | None = None
    """The ``/mail/*`` routes (``AIC_MAIL_WORKLOAD``); None = mail isn't set up (503)."""


class _NoFactory:
    """The actions need the factory only for hiring, which the API never does."""

    async def hire(self, spec: dict[str, Any], manager_id: str, department: str) -> Record:
        raise RuntimeError("the API does not hire")

    async def release(self, worker_id: str, manager_id: str) -> Record:
        raise RuntimeError("the API does not release")


def _action_deps(d: ApiDeps) -> CityDeps:
    return CityDeps(
        ledger=d.ledger,
        bus=d.bus,
        queue=d.queue,
        factory=_NoFactory(),
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
    text = base64.b64decode(raw).decode("utf-8") if event.get("isBase64Encoded") else str(raw)
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


def _is_whole(v: Any) -> bool:
    return isinstance(v, int | float) and not isinstance(v, bool) and math.isfinite(v) and float(v).is_integer()


def _as_number(v: Any) -> float:
    if isinstance(v, bool):
        return float(v)
    try:
        return float(v)
    except (TypeError, ValueError):
        return math.nan


async def city_snapshot(d: ApiDeps) -> dict[str, Any]:
    s = await d.settings()
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
    )
    agents, departments, tickets, parked, questions, approvals, today, month, day_breakdown, specialists, apps = results
    spend = {dep["name"]: day_breakdown.get(f"DEPT#{dep['key']}", {}).get("usd", 0) for dep in departments}
    return {
        "agents": [{**a, "model_label": model_label(a["model"])} for a in agents],
        "departments": departments,
        "tickets": tickets,
        "parked": parked,
        "questions": questions,
        "approvals": approvals,
        "specialists": specialists,
        "apps": apps,
        "usage": {"usd": today["usd"], "turns": today["turns"], "tokens": today["tokens"]},
        "month": {"usd": month["usd"]},
        "spend": spend,
        "caps": {
            "daily_global_usd": s.get("daily_global_usd"),
            "monthly_budget_usd": s.get("monthly_budget_usd"),
            "daily_department_usd": s.get("daily_department_usd"),
        },
        "city": {
            "paused": s.get("paused"),
            "reason": s.get("pause_reason"),
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


async def _route(event: dict[str, Any], d: ApiDeps) -> dict[str, Any]:
    method = event["requestContext"]["http"]["method"].upper()
    path = event.get("rawPath", "/").rstrip("/") or "/"
    q = event.get("queryStringParameters") or {}
    seg = [s for s in path.split("/") if s]

    def is_(m: str, pattern: str) -> bool:
        return method == m and re.fullmatch(pattern, path) is not None

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
        # The instruction goes through AIC like every owner message, so the same gate applies.
        conversation = b["conversation"] if isinstance(b.get("conversation"), str) else "hud"
        await d.queue.send(
            cast(
                WorkMessage,
                {
                    "id": new_id("m"),
                    "role": "ace",
                    "agentId": "ace",
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
                    "role": "ace",
                    "agentId": "ace",
                    "department": None,
                    "ticketId": f"conv-{conversation}",
                    "taskId": f"conv-{conversation}",
                    "kind": "task",
                    "from": "owner",
                    "body": text,
                    "conversation": conversation,
                },
            )
        )
        return reply(202, {"accepted": True, "conversation": conversation})
    if is_("POST", r"/wake-check"):
        transcript = _str(_body(event).get("transcript"), "Transcript", 2000)
        if not d.utility_runner:
            return reply(200, {"addressed": re.match(r"^\s*\S*\s*ace\b", transcript, re.I) is not None})
        addressed = await is_addressed_to_ace(
            transcript, UtilityDeps(ledger=d.ledger, bus=d.bus, settings=await d.settings(), runner=d.utility_runner)
        )
        return reply(200, {"addressed": addressed})
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
    if is_("GET", r"/departments"):
        return reply(200, {"departments": await d.ledger.list_departments()})
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
                "paused": s.get("paused"),
                "workers_busy": await d.ledger.active_workers(),
                "worker_ceiling": s.get("max_concurrent_workers_global"),
                "stale_turns": len(await d.ledger.stale_work()),
            },
        )
    if is_("GET", r"/questions"):
        return reply(
            200, {"questions": await d.ledger.open_questions(), "approvals": await d.ledger.pending_approvals()}
        )
    if is_("POST", r"/questions/[\w-]+/(answer|default)"):
        qn = await d.ledger.get_question(seg[1])
        if not qn or qn.get("status") != "open":
            return problem(409, "That question was already answered.", "Refresh the list.")
        answer = qn["default_answer"] if seg[2] == "default" else _str(_body(event).get("answer"), "Answer")
        await answer_question(_action_deps(d), qn["id"], answer, "owner")
        return reply(200, {"answered": True, "answer": answer})
    if is_("POST", r"/approvals/[\w-]+"):
        b = _body(event)
        if not isinstance(b.get("approved"), bool):
            raise BadRequest("Say approve or refuse.")
        approved: bool = b["approved"]
        cur = await d.ledger.get_approval(seg[1])
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
                grants = b.get("grants")
                if grants is not None and not isinstance(grants, list):
                    raise BadRequest("grants must be a list.")
                pinned = b.get("pinned")
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
            # Only the owner's yes moves an add-connector request on (§1.3.4); a no deletes the record.
            await on_connector_approval(_connectors(d), cur, approved)
        if cur.get("task_token") and d.sfn is not None:
            if approved:
                await asyncio.to_thread(
                    d.sfn.send_task_success,
                    taskToken=cur["task_token"],
                    output=json.dumps({"approved": True, "id": cur["id"]}),
                )
            else:
                await asyncio.to_thread(
                    d.sfn.send_task_failure, taskToken=cur["task_token"], error="Refused", cause="The owner refused."
                )
        await d.bus.put({"type": "approval.decided", "id": a["id"], "approved": approved})
        if approved and str(cur.get("requested_by", "")).startswith("app:"):
            # An app's proposal: run that one tool once, exactly as the owner saw it.
            return reply(200, {"approval": a, "result": await run_proposal(cur, d.proposals)})
        if app:
            await _grants_changed(d)
            return reply(200, {"approval": a, "app": app})
        return reply(200, {"approval": a})
    if is_("GET", r"/apps"):
        return reply(200, {"apps": await list_apps(d.ledger)})
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
    if is_("GET", r"/settings"):
        return reply(200, {"settings": await d.settings()})
    if is_("PUT", r"/settings"):
        return await _put_settings(_body(event), d)
    if is_("POST", r"/city/(pause|resume)"):
        paused = seg[1] == "pause"
        reason = "Paused by the owner" if paused else None
        await d.ledger.update_settings({"paused": paused, "pause_reason": reason})
        await d.bus.put({"type": "city.state", "paused": paused, "reason": reason})
        return reply(200, {"paused": paused})
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
        ans = await connectors_route(_connectors(d), method, seg, lambda: _body(event))
        if ans:
            return reply(*ans)
    if seg and seg[0] == "mail":
        if d.mail is None:
            return problem(503, "Mail and calendar aren't set up yet.", "The owner turns them on with a deploy.")
        ans = await mail_route(d.mail, method, seg, lambda: _body(event))
        if ans:
            return reply(*ans)
    if seg and seg[0] == "skills":
        ans = await skills_route(d.skills or SkillsApi(d.ledger), method, seg, lambda: _body(event))
        if ans:
            return reply(*ans)
    if path == "/knowledge" or path.startswith("/knowledge/"):
        return await _knowledge(event, method, path, d)
    return problem(404, "There is nothing here.")


_ITEM = r"k-[\w-]{12}"


async def _knowledge(event: dict[str, Any], method: str, path: str, d: ApiDeps) -> dict[str, Any]:
    """The knowledge routes (``docs/KNOWLEDGE.md`` §5). The owner check already ran in ``handle_http``."""
    k = d.knowledge
    if k is None:
        return problem(503, "The knowledge base is not set up yet.", "Deploy it first, then try again.")

    def is_(m: str, pattern: str) -> bool:
        return method == m and re.fullmatch(pattern, path) is not None

    item_id = path.rsplit("/", maxsplit=1)[-1] if re.fullmatch(rf"/knowledge/{_ITEM}", path) else ""
    try:
        if is_("GET", r"/knowledge"):
            return reply(200, await k.list())
        if is_("GET", rf"/knowledge/{_ITEM}"):
            return reply(200, await k.get(item_id))
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


def _connectors(d: ApiDeps) -> ConnectorsApi:
    from aic.shared.connectors import ConnectorStore

    return d.connectors or ConnectorsApi(ConnectorStore(d.ledger.table, d.ledger.now), d.bus)


_CAP_KEYS = ("daily_global_usd", "monthly_budget_usd", "daily_department_usd")
_WHOLE_KEYS = ("max_concurrent_workers_per_department", "max_concurrent_workers_global", "max_new_sessions_per_second")


async def _put_settings(b: dict[str, Any], d: ApiDeps) -> dict[str, Any]:
    patch: dict[str, Any] = {k: b[k] for k in (*_CAP_KEYS, *_WHOLE_KEYS) if k in b}
    if "profile_prefix" in b:
        if str(b["profile_prefix"]) not in ("global", "eu", "us"):
            raise BadRequest("Pick global, eu or us.")
        patch["profile_prefix"] = b["profile_prefix"]
    if isinstance(b.get("notify_email"), bool):
        patch["notify_email"] = b["notify_email"]
    if isinstance(b.get("first_run_done"), bool):
        patch["first_run_done"] = b["first_run_done"]
    if isinstance(b.get("mail_access"), dict):
        # Orchestrator and managers may read mail when the owner turns it on; workers never (decision 79).
        ma = b["mail_access"]
        if any(k not in ("orchestrator", "manager") or v not in ("none", "read") for k, v in ma.items()):
            raise BadRequest("mail_access takes orchestrator and manager, each none or read.")
        patch["mail_access"] = dict(ma)
    if isinstance(b.get("integrations"), dict):
        patch["integrations"] = {k: bool(v) for k, v in b["integrations"].items()}
    if isinstance(b.get("department_caps"), dict):
        patch["department_caps"] = {department_key(k): _as_number(v) for k, v in b["department_caps"].items()}
    bad = validate_caps({k: patch[k] for k in _CAP_KEYS if k in patch})
    if bad:
        return problem(400, bad)
    for k in _WHOLE_KEYS:
        if k in patch and (not _is_whole(patch[k]) or patch[k] < 1):
            return problem(400, f"{k.replace('_', ' ')} must be a whole number of at least 1.")
    if patch.get("max_new_sessions_per_second", 0) > 25:
        return problem(400, "New sessions per second can't go above AgentCore's limit of 25.")
    cur = await d.settings()
    daily = patch["daily_global_usd"] if "daily_global_usd" in patch else cur.get("daily_global_usd")
    for v in (patch.get("department_caps") or {}).values():
        if not math.isfinite(v) or v < 0 or (daily is not None and v > daily):
            return problem(400, "A department cap must be $0 or more, and not above the daily cap if one is set.")
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


def _connectors_from_env(city: Any) -> ConnectorsApi:
    from aic.shared.connectors import ConnectorStore

    fn = os.environ.get("AIC_CONNECTORS_FUNCTION")
    lam = city.session.client("lambda")

    async def invoke(payload: dict[str, Any]) -> None:
        if not fn:
            raise RuntimeError("AIC_CONNECTORS_FUNCTION is not set")
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
        workload=os.environ.get("AIC_CONNECTORS_WORKLOAD"),
        hud_origin=os.environ.get("AIC_HUD_ORIGIN"),
        kms_key=os.environ.get("AIC_KMS_KEY_ARN"),
    )


def _mail_from_env(city: Any) -> MailApi | None:
    if not os.environ.get("AIC_MAIL_WORKLOAD"):
        return None
    from aic.mail.service import MailService

    return MailApi(
        service=MailService.from_env(city.ledger, city.session),
        secrets=city.session.client("secretsmanager"),
        hud_origin=os.environ.get("AIC_HUD_ORIGIN"),
        kms_key=os.environ.get("AIC_KMS_KEY_ARN"),
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
    bucket, url = os.environ.get("AIC_APPS_BUCKET"), os.environ.get("AIC_APPS_URL")
    if not bucket or not url:
        return None
    return AppsOrigin(
        s3=session.client("s3"),
        bucket=bucket,
        url=url,
        cloudfront=session.client("cloudfront"),
        distribution_id=os.environ.get("AIC_APPS_DISTRIBUTION_ID"),
    )


def _knowledge_service(session: Any, bus: EventBus) -> KnowledgeService | None:
    k = knowledge_from_env(session)
    if not k or not k.blobs:
        return None
    return KnowledgeService(store=k.store, blobs=k.blobs, bus=bus, kb=k.kb)


def build_deps() -> ApiDeps:
    city = aws_city()
    return ApiDeps(
        ledger=city.ledger,
        bus=city.bus,
        queue=city.queue,
        settings=city.settings,
        sfn=client(city.session, "stepfunctions"),
        utility_runner=bedrock_converse_runner(client(city.session, "bedrock-runtime")),
        cognito=client(city.session, "cognito-idp"),
        user_pool_id=os.environ.get("AIC_USER_POOL_ID"),
        owner_email=os.environ.get("AIC_OWNER_EMAIL"),
        knowledge=_knowledge_service(city.session, city.bus),
        apps=_apps_origin(city.session),
        bridge_invoke=_bridge_invoke(city.session, os.environ.get("AIC_APP_BRIDGE_FUNCTION")),
        proposals=proposals_from_env(city.ledger),
        grants_changed=_policies_refresh(city.session, os.environ.get("AIC_CONNECTORS_FUNCTION")),
        connectors=_connectors_from_env(city),
        skills=SkillsApi(city.ledger, city.session.client("s3"), os.environ.get("AIC_SKILLS_BUCKET")),
        mail=_mail_from_env(city),
    )


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    global _deps
    if _deps is None:
        _deps = build_deps()
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
