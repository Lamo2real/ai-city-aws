"""EventBridge Scheduler jobs. All are created DISABLED by Terraform; the owner enables them.

- sweep: re-send work whose lease ran out (a crashed turn), and send idle workers home (see below).
- retire_idle: managers with no open work go dormant (they cost nothing either way; this keeps the City tidy),
  and idle workers go home.

Idle workers go home: a worker with no turn for `worker_idle_release_minutes` (caps.json, 15) and no turn
running is released: it has nothing to do, and a released worker costs nothing. Its
assignments that were still open are cancelled with a note and its manager is told, so the manager hires
again (within the cap) when work resumes.
- reminders: due reminders become notifications.
- improve: the weekly self-improvement loop. Built, and refused here unless explicitly enabled.
- calendar_import: every 15 minutes, the owner's one calendar is read from every connected account (and the
  invitation emails of plain IMAP accounts), merged and stored (docs/MAIL_CALENDAR.md §12). Skipped when the
  Calendar feature is off. "Refresh now" in the HUD starts the same job.
- standing_orders: every 5 minutes, each due standing order starts one ordinary job for its department
  (decision 125); one live job per order at a time. On the same beat the support desk moves each open customer
  ticket one step (decision 131).
- merge_departments: run once by the deploy after Terraform (decision 220): a department a preset took over
  ("Apps", now Application) is demolished through the normal path and its apps and drafts are re-homed. Idempotent.
- warm_vaic: keeps VAIC's runtime container running (a "warm" ping every few minutes on the owner's conversation
  session), so a message never pays the container's cold start. Created ENABLED: an idle container costs nothing.
"""

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from datetime import timedelta
from typing import Any, Literal

from vaic.shared.aws import aws_city
from vaic.shared.caps import default_settings
from vaic.shared.events import EventBus, now_iso
from vaic.shared.hierarchy.actions import OPEN_ASSIGNMENT, CityDeps, move, send
from vaic.shared.hierarchy.departments import merge_replaced_departments
from vaic.shared.hierarchy.dispatch import resume_stale
from vaic.shared.hierarchy.factory import Factory, FactoryClient
from vaic.shared.hierarchy.queue import Queue
from vaic.shared.ledger import Ledger, Record
from vaic.shared.log import log
from vaic.shared.speed import overdue, policy_for
from vaic.shared.standing_orders import run_due
from vaic.shared.support_desk import advance as advance_tickets
from vaic.shared.table import UpdateOptions

from ._runtime import run
from .dispatcher import AgentCoreInvoker, AgentInvoker, session_id_for
from .improve import improvement_allowed

Job = Literal[
    "sweep",
    "retire_idle",
    "reminders",
    "improve",
    "warm_vaic",
    "calendar_import",
    "standing_orders",
    "merge_departments",
]

# The conversations the HUD talks to VAIC on (see api.py: POST /messages uses "main").
WARM_CONVERSATIONS = ("main",)


async def warm_vaic(invoker: AgentInvoker | None, env: Mapping[str, str]) -> dict[str, int | str]:
    """One "warm" invocation per owner conversation, on exactly the session id the dispatcher would use, so the
    container that answers the owner's next message is already running. A miss is logged, never raised."""
    if invoker is None:
        return {"skipped": "no runtime to warm"}
    owner, version = env.get("VAIC_OWNER_ID", "owner"), env.get("VAIC_RUNTIME_VERSION", "")
    warmed = failed = 0
    for c in WARM_CONVERSATIONS:
        sid = session_id_for({"role": "vaic", "agentId": "vaic", "conversation": c}, owner, version)  # type: ignore[typeddict-item]
        try:
            await invoker.invoke(
                {
                    "id": f"warm-{c}",
                    "kind": "warm",
                    "role": "vaic",
                    "agentId": "vaic",
                    "ticketId": f"conv-{c}",
                    "taskId": f"conv-{c}",
                    "conversation": c,
                    "sessionId": sid,
                    "async": False,
                }
            )
            warmed += 1
        except Exception as e:
            failed += 1
            log("warn", "warm.failed", conversation=c, error=type(e).__name__)
    return {"warmed": warmed, "failed": failed}


async def calendar_import(
    ledger: Ledger, bus: EventBus, env: Mapping[str, str], service: Any = None
) -> dict[str, int | str]:
    """The owner's calendar import (read-only). ``service`` is a ``MailService`` (tests pass a fake)."""
    from vaic.features import FeatureStore
    from vaic.features.calendar import CalendarStore, import_calendar

    if not await FeatureStore(ledger.table, ledger.now).enabled("calendar"):
        return {"skipped": "the Calendar feature is off"}
    if service is None:
        if not env.get("VAIC_MAIL_WORKLOAD"):
            return {"skipped": "mail and calendar aren't set up here"}
        from vaic.mail.service import MailService

        service = MailService.from_env(ledger)
    out = await import_calendar(CalendarStore(ledger.table, ledger.now), service, bus.put)
    return {k: v for k, v in out.items() if isinstance(v, int | str)}


async def _running_agents(ledger: Ledger, turn_timeout_minutes: int) -> set[str]:
    """Agents with a turn under a live lease right now. A lease is live only while it is in the future and no
    longer than a turn may take: anything stranger is a dead turn's leftover and must not keep a worker "busy"."""
    now = ledger.now_ms()
    longest = turn_timeout_minutes * 60_000 + 60_000
    out: set[str] = set()
    for w in await ledger.table.query_index("gsi1", "WORK#started"):
        until = float(w.get("lease_until", 0))
        if now < until <= now + longest:
            m = w.get("message") or {}
            if isinstance(m, dict) and m.get("agentId"):
                out.add(str(m["agentId"]))
    return out


async def release_idle_workers(
    ledger: Ledger,
    queue: Queue,
    bus: EventBus,
    factory: FactoryClient,
    minutes: int,
    turn_timeout_minutes: int = 15,
) -> int:
    """Workers with no turn for `minutes` and none running go home. Their assignments
    that were still open are cancelled with a note and their manager is told to hire again when work resumes.
    One worker that cannot be released never stops the others: it is logged and skipped."""
    cutoff = now_iso(ledger.now() - timedelta(minutes=minutes))
    running = await _running_agents(ledger, turn_timeout_minutes)
    d = CityDeps(ledger=ledger, bus=bus, queue=queue, factory=factory, settings=_no_settings, max_review_rounds=3)
    n = checked = failed = 0
    for w in await ledger.list_agents():
        # Dormant workers count too: the City still draws them at a desk until they are released.
        if w.get("kind") != "worker" or w.get("state") == "retired" or w.get("worker_state") == "released":
            continue
        checked += 1
        if w["id"] in running:
            continue
        # A worker that never had a turn has no last_active_at: its hire time counts instead.
        seen = str(w.get("last_active_at") or w.get("hired_at") or "")
        if seen > cutoff:
            continue
        try:
            n += await _release_idle(d, w, minutes)
        except Exception as e:
            failed += 1
            log("warn", "worker.release_failed", worker=w["id"], error=type(e).__name__)
    log("info", "sweep.idle", checked=checked, running=len(running), sent_home=n, failed=failed)
    return n


async def _release_idle(d: CityDeps, w: Record, minutes: int) -> int:
    ledger, factory = d.ledger, d.factory
    stale = await ledger.tickets_of(w["id"], OPEN_ASSIGNMENT)
    for t in stale:
        await move(d, t["id"], "cancelled", f"{w['id']} went home after {minutes} idle minutes; needs a new worker")
    await factory.release(w["id"], str(w.get("parent")))  # a no-op if the last cancel above sent it home
    log("info", "worker.released_idle", worker=w["id"], department=w.get("department"), assignments=len(stale))
    dept = await ledger.get_department(str(w.get("department") or "")) or {}
    if stale and w.get("parent") and not dept.get("stood_down_at"):
        # A stood-down department (the owner sent everyone home) is never invited to hire again.
        parts = "; ".join(f"{t['id']}: {t.get('goal', '')}" for t in stale)
        await send(
            d,
            {
                "role": "manager",
                "agentId": str(w["parent"]),
                "department": w.get("department"),
                "ticketId": str(stale[0].get("parent_id") or stale[0]["id"]),
                "taskId": str(stale[0].get("task_id") or stale[0].get("parent_id") or stale[0]["id"]),
                "kind": "task",
                "from": "city",
                "body": f"{w['id']} went home after {minutes} idle minutes. Assign again when you are ready: {parts}",
            },
        )
    return 1


async def report_stuck_parts(d: CityDeps) -> int:
    """Each worker's part past its time budget (decision 287: 10 minutes at the fastest pace) is reported to its
    manager once, with what to do, so a stuck part never just sits. Nothing is stopped by the sweep itself."""
    now = d.ledger.now()
    n = 0
    for part in await d.ledger.list_tickets(["open", "in_progress"]):
        if not overdue(part, part.get("pace"), now):
            continue
        goal = await d.ledger.get_ticket(str(part.get("parent_id") or "")) if part.get("parent_id") else None
        manager = str(part.get("from") or "")
        if not goal or not manager.startswith("mgr-"):
            continue
        budget = policy_for(part.get("pace")).part_budget_minutes
        await move(d, part["id"], str(part["status"]), f"over its {budget}-minute budget; manager told",
                   {"stuck_reported_at": now_iso(now)})  # fmt: skip
        await send(
            d,
            {
                "role": "manager",
                "agentId": manager,
                "department": part.get("department"),
                "ticketId": str(goal["id"]),
                "taskId": str(goal.get("parent_id") or goal["id"]),
                "kind": "instruction",
                "from": "city",
                "body": (
                    f"Part {part['id']} ({str(part.get('goal') or '')[:120]}) by {part.get('to')} has run over its "
                    f"{budget}-minute budget without reporting. Check it now with my_workers: answer its question if it "
                    "has one; if it is lost, narrow it, or cancel_assignment and give it to a fresh worker with what it was stuck on. Don't wait."
                ),
            },
        )
        log("info", "part.escalated", ticket=part["id"], reason="time budget", minutes=budget)
        n += 1
    return n


async def _no_settings() -> dict[str, Any]:
    return {}


async def run_job(
    job: str,
    ledger: Ledger,
    queue: Queue,
    bus: EventBus,
    env: Mapping[str, str] | None = None,
    invoker: AgentInvoker | None = None,
    factory: FactoryClient | None = None,
) -> dict[str, int | str]:
    if job == "warm_vaic":
        return await warm_vaic(invoker, os.environ if env is None else env)
    if job == "calendar_import":
        return await calendar_import(ledger, bus, os.environ if env is None else env)
    if job == "standing_orders":
        # Standing orders (decision 125): each due order starts one ordinary job for its department.

        async def city_settings() -> dict[str, Any]:
            return await ledger.settings(default_settings())

        d = CityDeps(
            ledger=ledger,
            bus=bus,
            queue=queue,
            factory=factory or Factory(ledger, bus, city_settings),
            settings=city_settings,
            max_review_rounds=3,
        )
        # The support desk moves each open customer ticket one step on the same beat (decision 131).
        return {**(await run_due(d)), **(await advance_tickets(d))}
    if job == "merge_departments":
        # Run by the deploy after Terraform (decision 220): "Apps" folded into Application, once. Idempotent.

        async def merge_settings() -> dict[str, Any]:
            return await ledger.settings(default_settings())

        md = CityDeps(
            ledger=ledger,
            bus=bus,
            queue=queue,
            factory=factory or Factory(ledger, bus, merge_settings),
            settings=merge_settings,
            max_review_rounds=3,
        )
        merged = await merge_replaced_departments(md)
        return {"merged": json.dumps(merged)}
    if job in ("sweep", "retire_idle"):
        settings: Record = await ledger.settings(default_settings())
        minutes = int(settings.get("worker_idle_release_minutes") or 15)

        async def current_settings() -> dict[str, Any]:
            return settings

        f = factory or Factory(ledger, bus, current_settings)
        timeout = int(settings.get("turn_timeout_minutes") or 15)
        # The crash sweep first: a dead turn's lease is abandoned before the idle pass judges who is busy.
        resent = await resume_stale(ledger, queue) if job == "sweep" else 0
        sent_home = await release_idle_workers(ledger, queue, bus, f, minutes, timeout)
    if job == "sweep":
        sd = CityDeps(ledger=ledger, bus=bus, queue=queue, factory=f, settings=current_settings, max_review_rounds=3)
        return {"resent": resent, "sent_home": sent_home, "stuck": await report_stuck_parts(sd)}
    if job == "retire_idle":
        n = 0
        open_ = await ledger.list_tickets(["open", "in_progress", "in_review", "waiting_on_owner"])
        for a in await ledger.list_agents("active"):
            if a.get("kind") != "manager":
                continue
            if any(t["to"] == a["id"] or t["from"] == a["id"] for t in open_):
                continue
            await ledger.update_agent(a["id"], {"state": "dormant"})
            n += 1
        return {"dormant": n, "sent_home": sent_home}
    if job == "reminders":
        now = now_iso(ledger.now())
        due = [r for r in await ledger.list_notes("reminder") if r.get("due_at") and r["due_at"] <= now]
        for r in due:
            await ledger.table.update(f"REMINDER#{r['id']}", "META", UpdateOptions(set={"gsi1pk": "REMINDER#sent"}))
        return {"due": len(due)}
    if job == "improve":
        ok, why = improvement_allowed(os.environ if env is None else env)
        if not ok:
            return {"skipped": why}
        return {"skipped": "the self-improvement loop has no runner in this build"}
    return {"skipped": f"unknown job {job}"}


def warm_invoker(client: Any, env: Mapping[str, str]) -> AgentInvoker:
    """The warm ping carries the HUD's WebSocket target, like the dispatcher's real invocations do, so the runtime
    can ready its sender before the owner's message arrives."""
    return AgentCoreInvoker(
        client,
        {"vaic": env["VAIC_RUNTIME_ARN_VAIC"]},
        {"wsEndpoint": env.get("VAIC_WS_ENDPOINT", ""), "connectionsTable": env.get("VAIC_CONNECTIONS_TABLE", "")},
    )


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, int | str]:
    city = aws_city()
    invoker: AgentInvoker | None = None
    if event.get("job") == "warm_vaic" and os.environ.get("VAIC_RUNTIME_ARN_VAIC"):
        invoker = warm_invoker(city.session.client("bedrock-agentcore"), os.environ)
    out = run(run_job(event["job"], city.ledger, city.queue, city.bus, invoker=invoker))
    log("info", f"job.{event['job']}", **out)
    return out
