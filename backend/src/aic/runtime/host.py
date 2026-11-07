"""One agent turn inside the AgentCore runtime.

Read the ledger, build the prompt, run the gated turn with the role's tools, and tidy up. The same code runs
for all four roles; the role comes from the invocation (each runtime is configured with one role and refuses
others).
"""

from __future__ import annotations

import os
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

from aic.mail.service import MailService
from aic.shared.apps import drafts_of_ticket
from aic.shared.connectors import ConnectorStore
from aic.shared.events import now_iso
from aic.shared.hierarchy.actions import CityDeps, move
from aic.shared.ids import manager_id
from aic.shared.knowledge.search import always_block
from aic.shared.log import log, metric
from aic.shared.models import resolve_role_from_env
from aic.shared.turn import BackoffOptions, GateDeps, GatedTurn, TurnInput, TurnOutput, run_gated_turn

from .connector_tool import add_connector_tool
from .engine import AgentEngine, EngineRequest
from .gateway import GatewayClient, turn_connector_tools
from .live import LiveReply, Send
from .mail_tools import mail_level, mail_tools
from .prompts import department_template, load_prompt
from .skills import SkillStore, empty_home, use_skill_tool
from .tools import ToolSpec, TurnCtx, file_approval, gate_tools, tools_for

WORKER_BUILTINS: dict[str, list[str]] = {
    "Bash": ["Bash"],
    "Read": ["Read", "Glob", "Grep"],
    "Glob": ["Glob"],
    "Grep": ["Grep"],
    "Write": ["Write"],
    "Edit": ["Edit"],
    "WebSearch": ["WebSearch"],
    "WebFetch": ["WebFetch"],
    "git": ["Bash"],
    "code_interpreter": ["mcp__agentcore__code_interpreter"],
    "browser": ["mcp__agentcore__browser"],
}


@dataclass
class HostOptions:
    engine: AgentEngine
    role: str | None = None
    """The role this runtime serves. An invocation for another role is refused."""
    env: Mapping[str, str] | None = None
    backoff: BackoffOptions | None = None
    timeout_ms: int | None = None
    live_sender: Callable[[dict[str, Any]], Send | None] | None = None
    """For an AIC turn: how to send reply pieces straight to the HUD, or None to use the event bus."""
    gateway: GatewayClient | None = None
    """The connectors Gateway (``AIC_GATEWAY_URL``), or None: no connector tools."""
    skills: SkillStore | None = None
    """Owner-added skills (``AIC_SKILLS_BUCKET``), or None: no skills."""
    mail: MailService | None = None
    """Mail and calendar accounts (``AIC_MAIL_WORKLOAD``), or None: no mail tools."""


class AgentHost:
    def __init__(self, d: CityDeps, o: HostOptions) -> None:
        self.d = d
        self.o = o

    async def ensure_core(self) -> None:
        at = now_iso(self.d.ledger.now())
        for id, role, model in (("ace", "AIC", "haiku-5-5"), ("orchestrator", "Orchestrator", "fable-5-1")):
            if not await self.d.ledger.get_agent(id):
                await self.d.ledger.put_agent(
                    {
                        "id": id,
                        "kind": "core",
                        "role": role,
                        "department": None,
                        "model": model,
                        "parent": None if id == "ace" else "ace",
                        "state": "active",
                        "worker_state": None,
                        "total_cost_usd": 0,
                        "hired_at": at,
                    }
                )

    async def run_turn(self, inv: dict[str, Any]) -> str:
        if self.o.role and self.o.role != inv["role"]:
            raise RuntimeError(f"this runtime serves {self.o.role}, not {inv['role']}")
        ledger, bus = self.d.ledger, self.d.bus
        try:
            await self.ensure_core()
            agent = await ledger.get_agent(inv["agentId"])
            if not agent or agent.get("state") == "retired":
                log("warn", "turn.skipped", agent=inv["agentId"], reason="no such agent or retired")
                return ""
            if agent.get("state") == "dormant":
                await ledger.update_agent(agent["id"], {"state": "active"})
            ticket = await ledger.get_ticket(inv["ticketId"])
            if ticket and ticket["status"] == "open" and ticket["to"] == agent["id"]:
                await move(self.d, ticket["id"], "in_progress", "picked up")
            if agent.get("kind") == "worker" and agent.get("worker_state") != "working":
                await ledger.update_agent(agent["id"], {"worker_state": "working", "ticket_id": inv["ticketId"]})
                await bus.put({"type": "worker.state", "id": agent["id"], "state": "working"})
            await bus.put({"type": "activity", "id": agent["id"], "activity": "understanding"})

            conversation = inv.get("conversation")
            ctx = TurnCtx(
                agent_id=agent["id"],
                role=inv["role"],
                department=inv.get("department"),
                ticket_id=inv["ticketId"],
                task_id=inv["taskId"],
                conversation=conversation,
                message_id=inv.get("id"),
                # add_connector is offered only when the input is the owner's own message (typed or spoken),
                # never on reports, results, answers, approvals or reminders.
                from_owner=inv.get("from") == "owner" and inv.get("kind") == "task",
            )
            system, builtins = await self._system(agent, inv)
            system += await self._owner_knowledge()
            city_tools = tools_for(self.d, ctx)
            if ctx.role == "ace" and ctx.from_owner:
                city_tools.append(add_connector_tool(self.d, ctx))
            skill_rows = await self._skills(ctx.role)
            if ctx.role == "ace" and skill_rows and self.o.skills:
                city_tools.append(use_skill_tool(self.o.skills, skill_rows))
            if self.o.mail is not None:
                level = mail_level(ctx.role, await self.d.settings())
                if level and await self.o.mail.store.connected():
                    city_tools += mail_tools(self.d, ctx, self.o.mail, level)
            tools: list[ToolSpec] = gate_tools(self.d, ctx, city_tools)
            hire = await self._hire_connectors(agent) if ctx.role == "worker" else None
            tools += await turn_connector_tools(
                self.o.gateway, ConnectorStore(ledger.table, ledger.now), bus, ctx.role, hire
            )
            skills_dir = None
            if ctx.role != "ace" and skill_rows and self.o.skills:
                skills_dir = await self.o.skills.materialize(skill_rows)
            prompt = await self._prompt(agent, inv)
            models = resolve_role_from_env(inv["role"], self.o.env if self.o.env is not None else os.environ)
            settings = await self.d.settings()
            is_ace = inv["role"] == "ace"

            async def on_needs_approval(tool: str, input: dict[str, Any], hash: str, reason: str) -> None:
                await file_approval(self.d, ctx, tool, input, hash, reason)

            async def on_activity(activity: str, detail: str | None) -> None:
                e: dict[str, Any] = {"type": "activity", "id": agent["id"], "activity": activity}
                if detail:
                    e["detail"] = detail
                await bus.put(e)

            direct = self.o.live_sender(inv) if self.o.live_sender and is_ace else None

            async def send(event: dict[str, Any]) -> None:
                if direct:
                    try:
                        await direct(event)
                        if not event.get("done"):
                            return
                    except Exception as e:  # the reply still arrives through the bus
                        log("warn", "live.send_failed", error=type(e).__name__)
                # The final reply always also goes the reliable way (the HUD ignores a repeat).
                await bus.put(event)

            live = LiveReply(send, conversation or "")

            async def on_text(text: str) -> None:
                await live.add(text)

            async def runner(turn: TurnInput) -> TurnOutput:
                return await self.o.engine(
                    EngineRequest(
                        turn=turn,
                        system=system,
                        tools=tools,
                        builtins=builtins,
                        ctx=ctx,
                        ledger=ledger,
                        cwd=f"/tmp/work/{agent['id']}" if agent.get("kind") == "worker" else None,  # noqa: S108
                        on_needs_approval=on_needs_approval,
                        on_activity=on_activity,
                        on_text=on_text if is_ace and conversation else None,
                        skills_dir=str(skills_dir) if skills_dir else None,
                        skill_names=frozenset(r["name"] for r in skill_rows) if skills_dir else frozenset(),
                        home=str(empty_home()) if self.o.skills and not is_ace else None,
                    )
                )

            result = await run_gated_turn(
                GatedTurn(
                    kind=inv["role"],
                    role=inv["role"],
                    agent_id=agent["id"],
                    session_id=inv["sessionId"],
                    department=inv.get("department"),
                    ticket_id=inv["ticketId"],
                    models=models,
                    prompt=prompt,
                    prefix=settings.get("profile_prefix"),
                    turn_id=inv["id"],
                    timeout_ms=self.o.timeout_ms,
                ),
                GateDeps(ledger=ledger, bus=bus, settings=settings, backoff=self.o.backoff, runner=runner),
            )
            u = result.output.usage
            metric(
                {"Role": inv["role"], "Model": result.model.name},
                {
                    "Turns": 1,
                    "InputTokens": u.input,
                    "OutputTokens": u.output,
                    "CacheReadTokens": u.cache_read,
                    "CacheWriteTokens": u.cache_write_5m + u.cache_write_1h,
                    "Refusals": 1 if result.output.stop_reason == "refusal" else 0,
                    "Fallbacks": 1 if result.fallback else 0,
                    "SpendUsd": result.usd,
                },
            )
            if is_ace and conversation:
                await live.done(result.output.text)
                if inv.get("from") == "owner":
                    await ledger.add_conversation_line(conversation, "owner", inv["body"])
                else:
                    await ledger.add_conversation_line(conversation, "owner", f"[{inv['kind']} from {inv.get('from')}]")
                await ledger.add_conversation_line(conversation, "ace", result.output.text)
            await bus.put({"type": "activity", "id": agent["id"], "activity": "idle"})
            await ledger.finish_work(inv["id"])
            return result.output.text
        finally:
            if inv["role"] == "worker" and inv.get("department"):
                await ledger.release_worker_slot(inv["department"])

    async def _owner_knowledge(self) -> str:
        """The ``always`` summaries, after the stable system prompt so the cached prefix stays the same."""
        k = self.d.knowledge
        if not k:
            return ""
        try:
            block = await always_block(k.store)
        except Exception as e:
            log("warn", "knowledge.always_failed", error=type(e).__name__)
            return ""
        return f"\n\n{block}" if block else ""

    async def _skills(self, role: str) -> list[dict[str, Any]]:
        if not self.o.skills:
            return []
        try:
            return await self.o.skills.skills_for(role)
        except Exception as e:  # the turn goes on without skills
            log("warn", "skills.unavailable", error=type(e).__name__)
            return []

    async def _hire_connectors(self, agent: dict[str, Any]) -> list[str]:
        spec = await self.d.ledger.table.get(f"AGENT#{agent['id']}", "SPEC") or {}
        return [str(c) for c in spec.get("connectors") or []]

    async def _system(self, agent: dict[str, Any], inv: dict[str, Any]) -> tuple[str, list[str]]:
        role = inv["role"]
        if role == "ace":
            return load_prompt("ace.md").body, []
        if role == "orchestrator":
            return load_prompt("orchestrator.md").body, []
        if role == "manager":
            dept = await self.d.ledger.get_department(inv.get("department") or "") or {}
            return (
                load_prompt(
                    "manager.md",
                    {
                        "id": agent["id"],
                        "department": dept.get("name", ""),
                        "mission": dept.get("mission", ""),
                        "department_template": department_template(dept.get("name", "")),
                    },
                ).body,
                [],
            )
        spec = await self.d.ledger.table.get(f"AGENT#{agent['id']}", "SPEC") or {}
        granted: list[str] = list(spec.get("tools") or [])
        builtins = list(dict.fromkeys(b for t in granted for b in WORKER_BUILTINS.get(t, [])))
        return (
            load_prompt(
                "worker.md",
                {
                    "id": agent["id"],
                    "specialty": agent.get("specialty") or agent["role"],
                    "parent": agent.get("parent") or manager_id(inv.get("department") or ""),
                    "instructions": str(spec.get("instructions", "")),
                    "tools": ", ".join(granted),
                },
            ).body,
            builtins,
        )

    async def _prompt(self, agent: dict[str, Any], inv: dict[str, Any]) -> str:
        """The turn's input: the message, plus what the ledger says now, so a re-run after a crash carries on."""
        ledger = self.d.ledger
        role = inv["role"]
        lines = [f"Message ({inv['kind']}) from {inv.get('from')}:", inv["body"], "", "Current state from the ledger:"]
        if role == "ace":
            conns = await ConnectorStore(ledger.table).list()
            if conns:
                lines.append(
                    "Connectors: "
                    + "; ".join(
                        f"{c.get('label') or c['id']} [{c['id']}] {c.get('status')}"
                        + (f", {len(c.get('tools') or [])} tools" if c.get("status") == "ready" else "")
                        + (f", needs {c['needs']}" if c.get("needs") else "")
                        for c in conns
                    )
                )
        if role == "ace" and inv.get("conversation"):
            recent = await ledger.recent_conversation(inv["conversation"])
            if recent:
                lines = [
                    "Conversation so far (most recent last):",
                    *[f"{'AIC' if r['who'] == 'ace' else 'Owner'}: {r['text']}" for r in recent],
                    "",
                    *lines,
                ]
        elif role == "orchestrator":
            task = await ledger.get_ticket(inv["taskId"]) or {}
            lines.append(f"Task {inv['taskId']}: {task.get('goal', '')} [{task.get('status', '?')}]")
            names = ", ".join(d["name"] for d in await ledger.list_departments()) or "none yet"
            lines.append(f"Departments: {names}")
            for k in await ledger.child_tickets(inv["taskId"]):
                if k.get("kind") == "assignment":
                    lines.append(f"- {k.get('department')}: {k['id']} [{k['status']}]")
        elif role == "manager":
            mine = await ledger.get_ticket(inv["ticketId"]) or {}
            lines.append(f"Your goal {inv['ticketId']}: {mine.get('goal', '')} [{mine.get('status', '?')}]")
            for w in await ledger.department_agents(inv.get("department") or ""):
                if w.get("kind") == "worker" and w.get("parent") == agent["id"] and w.get("state") != "retired":
                    lines.append(f"- worker {w['id']} ({w['role']}) state {w.get('worker_state') or '?'}")
            for k in await ledger.child_tickets(inv["ticketId"]):
                if k.get("kind") == "assignment":
                    lines.append(
                        f"- assignment {k['id']} to {k['to']} [{k['status']}], review rounds {k.get('review_rounds', 0)}"
                    )
                    lines += [_draft_line(dr, "  ") for dr in await drafts_of_ticket(ledger, k["id"])]
            for_workers = [
                c
                for c in await ConnectorStore(ledger.table).list()
                if c.get("status") == "ready" and (c.get("roles") or {}).get("worker")
            ]
            if for_workers:
                lines.append(
                    "Connectors you can give a worker (hire_worker connectors): "
                    + ", ".join(f"{c['id']} ({c.get('label') or c['id']})" for c in for_workers)
                )
            saved = [s for s in await ledger.list_specialists() if s.get("department") == inv.get("department")]
            if saved:
                lines.append(f"Saved specialists: {', '.join(f'{s["id"]} ({s["specialty"]})' for s in saved)}")
        elif role == "worker":
            t = await ledger.get_ticket(inv["ticketId"]) or {}
            lines.append(
                f"Your assignment {inv['ticketId']}: {t.get('goal', '')}\nAcceptance: {t.get('acceptance', '')} [{t.get('status', '?')}]"
            )
            lines += [_draft_line(dr, "") for dr in await drafts_of_ticket(ledger, inv["ticketId"])]
        return "\n".join(lines)


def _draft_line(dr: dict[str, Any], indent: str) -> str:
    """An app draft as the city checked it (the reason is the city's own words, not the worker's)."""
    reason = f": {dr['reason']}" if dr.get("reason") else ""
    return f"{indent}- app draft {dr['draft_id']} [{dr.get('status')}]{reason}"
