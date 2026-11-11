"""One agent turn inside the AgentCore runtime.

Read the ledger, build the prompt, run the gated turn with the role's tools, and tidy up. The same code runs
for all four roles; the role comes from the invocation (each runtime is configured with one role and refuses
others).
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from vaic.mail.service import MailService
from vaic.shared import company
from vaic.shared import workflows as wf
from vaic.shared.app_guide import app_guide
from vaic.shared.apps import drafts_of_ticket, get_app
from vaic.shared.connectors import ConnectorStore
from vaic.shared.events import now_iso
from vaic.shared.executives import ensure_executives
from vaic.shared.hierarchy.actions import CityDeps, move
from vaic.shared.ids import manager_id
from vaic.shared.knowledge.search import always_block
from vaic.shared.leads import is_job_report, save_lead_csvs
from vaic.shared.log import log, metric
from vaic.shared.models import resolve_role_from_env
from vaic.shared.presets import orchestrator_note
from vaic.shared.skills_bundled import department_skills
from vaic.shared.turn import BackoffOptions, GateDeps, GatedTurn, TurnInput, TurnOutput, run_gated_turn

from .brand_context import BrandContext, BrandLoader, brands_from_items, is_bare_link
from .connector_tool import add_connector_tool
from .engine import AgentEngine, EngineRequest, clean_text
from .gateway import GatewayClient, turn_connector_tools
from .github_auth import GitAuth
from .live import LiveReply, Send
from .mail_tools import mail_level, mail_tools
from .prompts import department_template, department_worker_rules, load_prompt
from .references import refs_note, task_refs, worker_material
from .skills import SkillStore, empty_home, use_skill_tool
from .stop import unless_stopped
from .tools import (
    ToolSpec,
    TurnCtx,
    app_of_conversation,
    brief_note,
    file_approval,
    gate_tools,
    task_brief,
    tools_for,
)

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
    """For an VAIC turn: how to send reply pieces straight to the HUD, or None to use the event bus."""
    gateway: GatewayClient | None = None
    """The connectors Gateway (``VAIC_GATEWAY_URL``), or None: no connector tools."""
    skills: SkillStore | None = None
    """Owner-added skills (``VAIC_SKILLS_BUCKET``), or None: no skills."""
    mail: MailService | None = None
    """Mail and calendar accounts (``VAIC_MAIL_WORKLOAD``), or None: no mail tools."""
    git_auth: GitAuth | None = None
    """git and gh signed in with the owner's GitHub token (VAIC and workers), or None."""


class AgentHost:
    def __init__(self, d: CityDeps, o: HostOptions) -> None:
        self.d = d
        self.o = o

    async def ensure_core(self) -> None:
        await ensure_executives(self.d.ledger)  # decision 140: permanent, at home until the Orchestrator calls them in
        at = now_iso(self.d.ledger.now())
        for id, role, model in (("vaic", "VAIC", "haiku-5-5"), ("orchestrator", "Orchestrator", "fable-5-1")):
            if not await self.d.ledger.get_agent(id):
                await self.d.ledger.put_agent(
                    {
                        "id": id,
                        "kind": "core",
                        "role": role,
                        "department": None,
                        "model": model,
                        "parent": None if id == "vaic" else "vaic",
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
        failed = False
        if inv["role"] == "vaic" and not await ledger.claim(f"vaic-turn:{inv['id']}"):
            # One owner message gets exactly one VAIC turn and one reply (decision 192). The same message can arrive
            # again while or after its turn runs: the dispatcher's call retried, SQS redelivering it, the crash
            # sweep. Running it again repeated what VAIC had done ("already exists") and contradicted its first reply.
            log(
                "info",
                "turn.skipped",
                agent=inv["agentId"],
                message=inv["id"],
                reason="this message already had its turn",
            )
            return ""
        acted = False  # VAIC called a tool: a failed turn is not given back for a retry (it would act twice)
        try:
            await self.ensure_core()
            if self.o.git_auth is not None:
                try:
                    await self.o.git_auth.ensure()  # a token pasted since the last turn takes effect now
                except Exception as e:  # the turn goes on without GitHub
                    log("warn", "github.auth_failed", error=type(e).__name__)
            agent = await ledger.get_agent(inv["agentId"])
            if not agent or agent.get("state") == "retired":
                log("warn", "turn.skipped", agent=inv["agentId"], reason="no such agent or retired")
                await ledger.finish_work(inv["id"])  # nothing to run: the crash sweep must not send it again
                return ""
            if agent.get("state") == "dormant":
                await ledger.update_agent(agent["id"], {"state": "active"})
            ticket = await ledger.get_ticket(inv["ticketId"])
            if ticket and ticket["status"] == "cancelled":
                log("info", "turn.skipped", agent=inv["agentId"], reason="the owner stopped this job")
                await ledger.finish_work(inv["id"])
                return ""
            if inv["role"] == "vaic" and await ledger.turn_stopped(inv["id"]):
                log("info", "turn.skipped", agent=inv["agentId"], reason="the owner pressed Stop")
                await self._remember_stopped(inv, "", [])
                await ledger.finish_work(inv["id"])
                return ""
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
            if ctx.role == "vaic" and ctx.from_owner:
                city_tools.append(add_connector_tool(self.d, ctx))
            skill_rows = await self._skills(ctx.role)
            if ctx.role in ("manager", "worker"):  # a preset department's bundled skills; the owner's win on a name
                own = {r["name"] for r in skill_rows}
                dept = await self._department_name(agent, inv)
                skill_rows = skill_rows + [r for r in department_skills(dept) if r["name"] not in own]
            if ctx.role == "vaic" and skill_rows and self.o.skills:
                city_tools.append(use_skill_tool(self.o.skills, skill_rows))
            if self.o.mail is not None:
                level = mail_level(ctx.role, await self.d.settings())
                if level and await self.o.mail.store.connected():
                    city_tools += mail_tools(self.d, ctx, self.o.mail, level)
            tools: list[ToolSpec] = gate_tools(self.d, ctx, city_tools)
            hire = await self._hire_connectors(agent) if ctx.role == "worker" else None
            tools += await turn_connector_tools(
                self.o.gateway,
                ConnectorStore(ledger.table, ledger.now),
                bus,
                ctx.role,
                hire,
                self._brand_loader(inv, ticket),
            )
            skills_dir = None
            if ctx.role != "vaic" and skill_rows and self.o.skills:
                skills_dir = await self.o.skills.materialize(skill_rows)
            if is_job_report(ctx.role, inv) and self.d.knowledge is not None:
                saved = await save_lead_csvs(ledger, self.d.knowledge.service, inv["taskId"])
                if saved:  # lead-research: the table goes to the chat, the CSV is already in Knowledge
                    inv = {**inv, "body": inv["body"] + "\n\n[Saved to the owner's knowledge base as a CSV: "
                           + "; ".join(f"“{t}”" for t in saved) + "]"}  # fmt: skip
            prompt = await self._prompt(agent, inv)
            attachments: tuple[dict[str, Any], ...] = ()
            if ctx.role == "worker" and inv.get("kind") == "task" and self.d.files is not None:
                # The owner's reference files ride with the assignment itself: images as images, documents as text.
                refs = await task_refs(self.d, inv["ticketId"])
                if refs:
                    text, attachments = await worker_material(self.d, agent["id"], refs)
                    prompt = f"{prompt}\n\n{text}"
            # A department built on demand may carry its own worker model (decision 134).
            own_dept = (
                await ledger.get_department(str(agent["department"]))
                if inv["role"] == "worker" and agent.get("department")
                else None
            )
            models = resolve_role_from_env(
                inv["role"], self.o.env if self.o.env is not None else os.environ, agent.get("department"), own_dept
            )
            if agent.get("model") and agent["model"] != models.primary.name and inv["role"] in ("manager", "worker"):
                # The City shows what the agent really runs on (the model rules changed, decision 129).
                await ledger.update_agent(agent["id"], {"model": models.primary.name})
            settings = await self.d.settings()
            is_vaic = inv["role"] == "vaic"

            async def on_needs_approval(tool: str, input: dict[str, Any], hash: str, reason: str) -> None:
                await file_approval(self.d, ctx, tool, input, hash, reason)

            started: list[dict[str, Any]] = []  # VAIC's tool calls so far, said plainly if the owner presses Stop

            async def on_activity(activity: str, detail: str | None) -> None:
                if is_vaic:
                    started.append({"activity": activity, "detail": detail})
                e: dict[str, Any] = {"type": "activity", "id": agent["id"], "activity": activity}
                if detail:
                    e["detail"] = detail
                await bus.put(e)

            direct = self.o.live_sender(inv) if self.o.live_sender and is_vaic else None

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

            live = LiveReply(send, conversation or "", message_id=inv["id"] if is_vaic else None)

            streamed: list[str] = []  # what VAIC had written so far, kept in the history if the owner presses Stop

            async def on_text(text: str) -> None:
                streamed.append(text)
                await live.add(text)

            async def on_tool_done(tool: str, args: dict[str, Any], out: str, error: bool) -> None:
                nonlocal acted
                acted = True
                if is_vaic and conversation and tool not in READ_ONLY_TOOLS:
                    await ledger.add_conversation_line(
                        conversation, "vaic", action_line(tool, args, out, error, now_iso())
                    )

            # A worker's own folder. It must exist before Claude starts there: the SDK refuses a missing working
            # directory, and every worker turn failed on it while its card said "Understanding" (decision 205).
            workdir = None
            if agent.get("kind") == "worker":
                workdir = f"/tmp/work/{agent['id']}"  # noqa: S108
                await asyncio.to_thread(Path(workdir).mkdir, parents=True, exist_ok=True)

            async def runner(turn: TurnInput) -> TurnOutput:
                return await self.o.engine(
                    EngineRequest(
                        turn=turn,
                        system=system,
                        tools=tools,
                        builtins=builtins,
                        ctx=ctx,
                        ledger=ledger,
                        cwd=workdir,
                        on_needs_approval=on_needs_approval,
                        on_activity=on_activity,
                        on_tool_done=on_tool_done,
                        on_text=on_text if is_vaic and conversation else None,
                        skills_dir=str(skills_dir) if skills_dir else None,
                        skill_names=frozenset(r["name"] for r in skill_rows) if skills_dir else frozenset(),
                        home=str(empty_home()) if self.o.skills and not is_vaic else None,
                    )
                )

            if is_vaic and conversation:
                # The owner's line goes in before the turn runs (the prompt above already holds it), so the actions
                # VAIC logs while it works sit after the message that asked for them, and before its reply.
                await ledger.add_conversation_line(conversation, "owner", _owner_body(inv))
            gated = run_gated_turn(
                GatedTurn(
                    kind=inv["role"],
                    role=inv["role"],
                    agent_id=agent["id"],
                    session_id=inv.get("sessionId") or inv["id"],  # a spoken turn comes with no session id
                    department=inv.get("department"),
                    ticket_id=inv["ticketId"],
                    models=models,
                    prompt=prompt,
                    prefix=settings.get("profile_prefix"),
                    turn_id=inv["id"],
                    timeout_ms=self.o.timeout_ms,
                    attachments=attachments,
                ),
                GateDeps(ledger=ledger, bus=bus, settings=settings, backoff=self.o.backoff, runner=runner),
            )
            if not is_vaic:
                result = await gated
            else:
                done, stopped = await unless_stopped(gated, lambda: ledger.turn_stopped(inv["id"]))
                if stopped or done is None:
                    await self._stopped(inv, "".join(streamed), started, send)
                    return ""
                result = done
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
            if is_vaic and conversation:
                await live.done(result.output.text)
                await ledger.add_conversation_line(conversation, "vaic", result.output.text)
            await bus.put({"type": "activity", "id": agent["id"], "activity": "idle"})
            await ledger.finish_work(inv["id"])
            return result.output.text
        except BaseException as e:
            failed = True
            if isinstance(e, Exception):
                # The city shows a failed turn at once, with the reason, instead of the "Understanding" it started
                # with (the owner's rule: errors in full). The crash sweep may still try it again.
                try:
                    await bus.put(
                        {
                            "type": "activity",
                            "id": inv["agentId"],
                            "activity": "failed",
                            "detail": f"Its last try failed: {clean_text(f'{type(e).__name__}: {e}', 400)}",
                        }
                    )
                except Exception as put_error:  # the failure itself must still reach the log and the retry
                    log("warn", "turn.failed_event", error=type(put_error).__name__)
            if inv["role"] == "vaic" and not acted:
                # Nothing was done yet: a retry of this message may run (a model error, a throttle).
                await ledger.unclaim(f"vaic-turn:{inv['id']}")
            raise
        finally:
            if inv["role"] == "worker" and inv.get("department"):
                await ledger.release_worker_slot(inv["department"])
                await ledger.worker_turn_ended(inv["id"], failed)

    async def _stopped(self, inv: dict[str, Any], partial: str, started: list[dict[str, Any]], send: Send) -> None:
        """The owner pressed Stop mid-turn (decision 183): nothing more is said for that message. The HUD hears it
        was dropped, with the tool calls already made; the exchange stays in VAIC's history, marked stopped."""
        ledger, conversation = self.d.ledger, str(inv.get("conversation") or "")
        log("info", "vaic.stopped", message=inv["id"], tools=len(started))
        if conversation:
            # "done" sends it the reliable way too (the bus), not only straight to the open HUDs.
            event = {"type": "vaic.stopped", "conversation": conversation, "message_id": inv["id"], "tools": started}
            await send({**event, "done": True})
            await self._remember_stopped(inv, partial, started, owner_line=False)
        await self.d.bus.put({"type": "activity", "id": "vaic", "activity": "idle"})
        await ledger.finish_work(inv["id"])

    async def _remember_stopped(
        self, inv: dict[str, Any], partial: str, started: list[dict[str, Any]], owner_line: bool = True
    ) -> None:
        """A stopped exchange stays in the conversation for context (the owner, 2026-11-10: "still save them as chat
        history"), like a stopped turn in ChatGPT or Claude: the owner's message, then VAIC's line starting with the
        marker (first, so the 4,000-character cap can only cut the partial answer), so a later turn reads it as
        dropped, not as a request to carry on."""
        conversation = str(inv.get("conversation") or "")
        if not conversation:
            return
        note = "(stopped by the owner"
        note += " before VAIC answered" if not partial.strip() else ""
        if started:
            note += "; tools already called: " + ", ".join(str(t.get("detail") or t.get("activity")) for t in started)
        note += ". Not an open request: do not carry it on unless the owner asks again.)"
        text = f"{note} {partial.strip()}".strip() if partial.strip() else note
        if owner_line:  # a turn stopped mid-way wrote the owner's line when it started
            await self.d.ledger.add_conversation_line(conversation, "owner", _owner_body(inv))
        await self.d.ledger.add_conversation_line(conversation, "vaic", text)

    async def _project_lines(self, conversation: str, recent: list[dict[str, Any]]) -> list[str]:
        """A project chat in the Apps studio: which app it is about (and the chat it began in), or that it is
        a new project whose plan is still being agreed. Extends ``recent`` with the earlier chat."""
        if conversation.startswith("app-new-"):
            return [
                "This chat is a new project in the owner's Apps studio. Agree the plan with the owner first "
                "(see Projects in your instructions), then build it with delegate_to_orchestrator and the brief.",
                "",
            ]
        app_id = app_of_conversation(conversation)
        app = await get_app(self.d.ledger, app_id) if app_id else None
        if not app:
            return []
        if app.get("conversation") and len(recent) < 12:
            earlier = await self.d.ledger.recent_conversation(str(app["conversation"]), 12 - len(recent))
            recent[:0] = earlier
        out = [
            f"This chat is about the owner's app “{app.get('title')}” (app_id {app['app_id']}, version "
            f"{app.get('version') or 1}). Changes to it go to delegate_to_orchestrator, which already knows the app."
        ]
        if app.get("brief"):
            out.append(f"The plan the owner agreed for it: {app['brief']}")
        return [*out, ""]

    async def _workflow_lines(self, inv: dict[str, Any]) -> list[str]:
        """AI workflows (decision 126): the run in progress in this chat, and the workflow the owner's words point
        at, so VAIC asks "Is this what you mean" or starts it, and never asks for an answer it already has."""
        ledger = self.d.ledger
        runs = wf.Runs(ledger.table, ledger.now)
        live = await runs.live_in(str(inv.get("conversation") or "main"))
        from_owner = inv.get("from") == "owner" and inv.get("kind") == "task"
        found = wf.recognise(str(inv.get("body") or "")) if from_owner else []
        conversation = str(inv.get("conversation") or "main")
        if conversation.startswith("app-") and not conversation.startswith("app-new-"):
            found = [f for f in found if f["id"] != "app-build"]  # in an app's own chat, "make…" changes that app
        out: list[str] = []
        if from_owner and (line := wf.taste_line(await wf.Taste(ledger.table, ledger.now).all(open_only=True))):
            out.append(line)
        if not live and not found:
            return out
        records = await ConnectorStore(ledger.table).list()
        if live and (w := wf.definition(str(live.get("workflow_id")))):
            out.append(wf.run_line(live, w, wf.connector_info(w, records)))
        if found and not (live and all(f["id"] == live.get("workflow_id") for f in found)):
            conn_of = {x["id"]: wf.connector_info(x, records) for x in wf.definitions()}
            if line := wf.match_line(str(inv.get("body") or ""), conn_of):
                out.append(line)
        return out

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

    async def _department_name(self, agent: dict[str, Any], inv: dict[str, Any]) -> str:
        key = inv.get("department") or agent.get("department") or ""
        try:
            dept = await self.d.ledger.get_department(str(key)) if key else None
        except Exception:
            dept = None
        return str((dept or {}).get("name") or key)

    async def _hire_connectors(self, agent: dict[str, Any]) -> list[str]:
        spec = await self.d.ledger.table.get(f"AGENT#{agent['id']}", "SPEC") or {}
        return [str(c) for c in spec.get("connectors") or []]

    async def _system(self, agent: dict[str, Any], inv: dict[str, Any]) -> tuple[str, list[str]]:
        body, builtins = await self._system_base(agent, inv)
        if inv["role"] == "vaic":
            return body, builtins
        # The owner's company brief (decision 136): every team member knows the business and who it hands work to.
        brief = await company.get_brief(self.d.ledger)
        return body + company.context(brief, inv["role"], inv.get("department")), builtins

    async def _system_base(self, agent: dict[str, Any], inv: dict[str, Any]) -> tuple[str, list[str]]:
        role = inv["role"]
        if role == "vaic":
            # The app guide rides with VAIC's instructions so "how do I…" is answered at once (the owner, 2026-11-09).
            return load_prompt("vaic.md").body + "\n\n" + app_guide(), []
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
                    "department_rules": department_worker_rules(str(inv.get("department") or "")),
                    "tools": ", ".join(granted),
                },
            ).body,
            builtins,
        )

    def _brand_loader(self, inv: dict[str, Any], ticket: dict[str, Any] | None) -> BrandLoader | None:
        """The stored brands for the Canva and Higgsfield calls of this turn (decision 190), read only when the
        turn has such a connector. The task's own words say which brand it is for."""
        k = self.d.knowledge
        if k is None:
            return None
        fields = ("title", "goal", "body", "brief", "description")
        hint = " ".join([str(inv.get("body") or ""), *(str((ticket or {}).get(f) or "") for f in fields)])

        async def load() -> BrandContext | None:
            return brands_from_items(await k.store.list_items(), hint)

        return load

    async def _prompt(self, agent: dict[str, Any], inv: dict[str, Any]) -> str:
        """The turn's input: the message, plus what the ledger says now, so a re-run after a crash carries on."""
        ledger = self.d.ledger
        role = inv["role"]
        lines = [f"Message ({inv['kind']}) from {inv.get('from')}:", inv["body"], "", "Current state from the ledger:"]
        if role == "vaic" and inv.get("from") == "owner" and is_bare_link(str(inv.get("body") or "")):
            # A link and nothing else (decision 190): the owner wants it learnt.
            lines[2:2] = [
                "",
                "The owner pasted only a web link: store it with add_to_knowledge (url) now, then say in a sentence "
                "or two what was learnt: the brand's colours, fonts and what the site is.",
            ]
        if role == "vaic" and inv.get("voice") is True:
            lines[2:2] = [
                "",
                "The owner said this out loud and will hear your answer spoken: reply in one to three short, "
                "conversational sentences, with no lists, tables, headings or code.",
            ]
        if role == "vaic":
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
        if role == "vaic":
            lines += await self._workflow_lines(inv)
        if role == "vaic" and inv.get("conversation"):
            recent = await ledger.recent_conversation(inv["conversation"], 16)  # room for its action log lines
            lines = [*(await self._project_lines(inv["conversation"], recent)), *lines]
            if recent:
                lines = [
                    "Conversation so far (most recent last):",
                    *[f"{'VAIC' if r['who'] == 'vaic' else 'Owner'}: {r['text']}" for r in recent],
                    "",
                    *lines,
                ]
        elif role == "orchestrator":
            task = await ledger.get_ticket(inv["taskId"]) or {}
            lines.append(f"Task {inv['taskId']}: {task.get('goal', '')} [{task.get('status', '?')}]")
            if task.get("brief"):
                lines.append(brief_note(str(task["brief"])) + "\nPass it on whole in every assignment.")
            if task.get("references"):
                lines.append(refs_note(list(task["references"])))
            every = await ledger.list_departments(include_demolished=True)
            names = ", ".join(d["name"] for d in every if d.get("state") != "demolished") or "none yet"
            lines.append(f"Departments: {names}")
            gone = [d for d in every if d.get("state") == "demolished"]
            if gone:  # decision 134: the owner's demolition stands until the owner builds it again
                lines.append(
                    "Demolished by the owner (never use or create these; only the owner can build them again): "
                    + ", ".join(d["name"] for d in gone)
                )
            lines.append(orchestrator_note({str(d.get("key")) for d in gone}))
            for k in await ledger.child_tickets(inv["taskId"]):
                if k.get("kind") == "assignment":
                    lines.append(f"- {k.get('department')}: {k['id']} [{k['status']}]")
        elif role == "manager":
            mine = await ledger.get_ticket(inv["ticketId"]) or {}
            lines.append(f"Your goal {inv['ticketId']}: {mine.get('goal', '')} [{mine.get('status', '?')}]")
            if brief := await task_brief(self.d, inv["ticketId"]):
                lines.append(brief_note(brief))
            if refs := await task_refs(self.d, inv["ticketId"]):
                lines.append(refs_note(refs))
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
            if brief := await task_brief(self.d, inv["ticketId"]):
                lines.append(brief_note(brief))
            if refs := await task_refs(self.d, inv["ticketId"]):
                lines.append(refs_note(refs))
            lines += [_draft_line(dr, "") for dr in await drafts_of_ticket(ledger, inv["ticketId"])]
        return "\n".join(lines)


def _draft_line(dr: dict[str, Any], indent: str) -> str:
    """An app draft as the city checked it (the reason is the city's own words, not the worker's)."""
    reason = f": {dr['reason']}" if dr.get("reason") else ""
    return f"{indent}- app draft {dr['draft_id']} [{dr.get('status')}]{reason}"


def _owner_body(inv: dict[str, Any]) -> str:
    return str(inv["body"]) if inv.get("from") == "owner" else f"[{inv['kind']} from {inv.get('from')}]"


ACTION_MARK = "[VAIC action"
"""How VAIC's own action log starts in its conversation (``agents/vaic.md``: trust your action log)."""

READ_ONLY_TOOLS = frozenset(
    {
        "get_status",
        "get_task_status",
        "list_notes",
        "list_knowledge",
        "search_knowledge",
        "find_files",
        "show_files",
        "get_file",
        "get_reports",
        "list_standing_orders",
        "list_workflows",
        "list_deals",
        "list_customer_tickets",
        "calendar_agenda",
        "my_workers",
        "load_app",
        "offer_choices",
        "use_skill",
    }
)
"""VAIC's tools that only read: they change nothing, so they are not written into its action log."""


def action_line(tool: str, args: dict[str, Any], out: str, error: bool, at: str) -> str:
    """One finished tool call, as VAIC's history keeps it: what it ran, when, and what came back (decision 192).

    "[VAIC action 2026-11-10 19:40 UTC] run_command: gh repo delete ProjectVAIC/test-repo-1 --yes → ok: exit 0"
    """
    what = str(args.get("command") or "") if tool == "run_command" else ""
    if not what:
        what = ", ".join(f"{k}={str(v)[:120]}" for k, v in args.items() if k != "confirm" or v)
    what = " ".join(what.split())[:300]
    said = " ".join(str(out).split())[:300]
    failed = (
        error
        or said.startswith(("Denied by policy", "Invalid input", "The tool failed"))
        or (tool == "run_command" and not said.startswith("exit 0"))
    )
    when = at[:16].replace("T", " ") + " UTC"
    return f"{ACTION_MARK} {when}] {tool}: {what} → {'FAILED' if failed else 'ok'}: {said}"
