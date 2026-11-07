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

from aic.shared.events import now_iso
from aic.shared.hierarchy.actions import CityDeps, move
from aic.shared.ids import manager_id
from aic.shared.log import log, metric
from aic.shared.models import resolve_role_from_env
from aic.shared.turn import BackoffOptions, GateDeps, GatedTurn, TurnInput, TurnOutput, run_gated_turn

from .engine import AgentEngine, EngineRequest
from .live import LiveReply, Send
from .prompts import department_template, load_prompt
from .tools import TurnCtx, file_approval, gate_tools, tools_for

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
            )
            system, builtins = await self._system(agent, inv)
            tools = gate_tools(self.d, ctx, tools_for(self.d, ctx))
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
                        return await direct(event)
                    except Exception as e:  # the reply still arrives through the bus
                        log("warn", "live.send_failed", error=type(e).__name__)
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
            saved = [s for s in await ledger.list_specialists() if s.get("department") == inv.get("department")]
            if saved:
                lines.append(f"Saved specialists: {', '.join(f'{s["id"]} ({s["specialty"]})' for s in saved)}")
        elif role == "worker":
            t = await ledger.get_ticket(inv["ticketId"]) or {}
            lines.append(
                f"Your assignment {inv['ticketId']}: {t.get('goal', '')}\nAcceptance: {t.get('acceptance', '')} [{t.get('status', '?')}]"
            )
        return "\n".join(lines)
