"""Departments on demand: the owner builds one, or demolishes one (decision 134).

Shared by VAIC's tools and the HTTP API, so the City, Settings and a word to VAIC do exactly the same thing.
"""

from __future__ import annotations

import re
from typing import Any

from ..ids import department_key, manager_id
from ..ledger import Record
from ..log import log
from ..models import WORKER_MODELS
from ..presets import preset_for
from .actions import OPEN_ASSIGNMENT, CityDeps, _walk_home, move, send

NAME_MAX = 40
DEMOLISHED_NOTE = "the owner demolished the department"


def preset_named(name: str) -> dict[str, Any] | None:
    """The preset whose own name or key this is (aliases don't count: "Customer Success" is not Support)."""
    p = preset_for(name)
    if p and department_key(name) in (department_key(p["name"]), department_key(p["key"])):
        return dict(p)
    return None


class DepartmentError(ValueError):
    """A plain sentence for the owner: why nothing was built or demolished."""


def clean_name(raw: Any) -> str:
    """The department's name as the owner would write it: trimmed, single spaces, "Department" dropped."""
    name = " ".join(str(raw or "").split())
    name = re.sub(r"\s+department$", "", name, flags=re.IGNORECASE).strip()
    if len(name) < 2 or len(name) > NAME_MAX or not re.search(r"[A-Za-z]", name):
        raise DepartmentError(f"A department needs a name of 2 to {NAME_MAX} characters, like “Customer Success”.")
    if name.lower() in ("hq", "orchestrator", "aic", "ace", "plaza"):
        raise DepartmentError(f"“{name}” is part of the city already; pick another name.")
    return name[:1].upper() + name[1:]


def worker_model_choice(v: Any) -> str | None:
    """``None``/"" = the department's usual workers (Opus 5.5, or the config's Fable for Media, Research and
    Legal); "fable" / "fable-5-1" / ``True`` = Fable 5.1; "opus" / "opus-5-5" = Opus 5.5."""
    if v is None or v == "" or v is False:
        return None
    if v is True:
        return "fable-5-1"
    s = str(v).strip().lower().replace(" ", "-").replace(".", "-")
    for m in WORKER_MODELS:
        if s == m or m.startswith(s):
            return m
    raise DepartmentError("Workers run on Opus 5.5 or, when you say so, Fable 5.1.")


async def build_department(
    d: CityDeps, raw_name: Any, mission: Any = "", worker_model: Any = None
) -> tuple[Record, str]:
    """Builds a department the owner asked for. Returns the record and what happened: ``created``, ``rebuilt``
    (a demolished one stands again) or ``exists`` (already standing; nothing changed). Its manager is hired with
    its first goal, as for the presets, and runs on the managers' model (Fable 5.1); its workers run on Opus 5.5
    unless the owner chose Fable 5.1 for them."""
    name = clean_name(raw_name)
    model = worker_model_choice(worker_model)
    # Only a preset's own name or key is that preset: the owner asking for "Customer Success" wants a new
    # department, even though the Orchestrator's aliases would send that word to Customer Support.
    preset = preset_named(name)
    if preset:
        name = preset["name"]
    why = " ".join(str(mission or "").split())[:400]
    why = why or (preset["mission"] if preset else f"Everything the business needs from {name}.")
    extra: Record = {"built_by": "owner", **({"worker_model": model} if model else {})}
    every = await d.ledger.list_departments(include_demolished=True)
    current = next((x for x in every if x.get("key") == department_key(name)), None)
    if current and current.get("state") != "demolished":
        return current, "exists"
    if not preset and not current:
        cap = int((await d.settings()).get("max_departments") or 6)
        own = [x for x in every if x.get("state") != "demolished" and not preset_named(str(x.get("name", "")))]
        if len(own) >= cap:
            raise DepartmentError(
                f"The city already has {len(own)} departments of your own beyond the pre-configured ones (the "
                f"limit is {cap}). Demolish one, or raise “Your own departments” in Settings."
            )
    if current:
        dept = await d.ledger.rebuild_department(name, why, extra)
        outcome = "rebuilt"
    else:
        dept, created = await d.ledger.create_department(name, why, manager_id(name), extra)
        outcome = "created" if created else "exists"
        if not created:
            return dept, outcome
    await d.bus.put(
        {
            "type": "department.created",
            "name": dept["name"],
            "mission": dept["mission"],
            "manager_id": dept["manager_id"],
            **({"worker_model": model} if model else {}),
        }
    )
    log("info", "department.built", name=dept["name"], outcome=outcome, worker_model=model or "default")
    return dept, outcome


async def find_standing(d: CityDeps, raw_name: Any) -> Record:
    """The standing department the owner means (its name, a preset alias, or a close match)."""
    q = " ".join(str(raw_name or "").split())
    q = re.sub(r"\s+department$", "", q, flags=re.IGNORECASE)
    standing = await d.ledger.list_departments()
    names = {str(x.get("key")): x for x in standing}
    preset = preset_for(q)
    for key in (department_key(q), department_key(preset["name"]) if preset else ""):
        if key and key in names:
            return names[key]
    hits = [x for x in standing if department_key(q) and department_key(q) in str(x.get("key"))]
    if len(hits) == 1:
        return hits[0]
    raise DepartmentError(f"There is no standing department called “{q}”.")


async def demolition_plan(d: CityDeps, dept: Record) -> dict[str, Any]:
    """What a demolition would touch, for the one-line question before it happens."""
    workers = [
        w
        for w in await d.ledger.department_agents(dept["name"])
        if w.get("kind") == "worker" and w.get("state") != "retired" and w.get("worker_state") != "released"
    ]
    parts = [
        t
        for t in await d.ledger.list_tickets(list(OPEN_ASSIGNMENT))
        if t.get("kind") == "assignment" and department_key(str(t.get("department") or "")) == dept["key"]
    ]
    return {"name": dept["name"], "workers": workers, "parts": parts}


async def demolish_department(d: CityDeps, dept: Record) -> dict[str, Any]:
    """Demolishes a standing department: every worker goes home, every open part of it is cancelled and handed
    back to the Orchestrator (one message per job, so it can re-plan with the other departments or tell VAIC),
    the manager retires, and the record stays in the ledger as history (``state: demolished``) so a demolished
    preset is not put back. One ``department.demolished`` event; the City plays the demolition."""
    plan = await demolition_plan(d, dept)
    sent = 0
    for w in plan["workers"]:
        if await _walk_home(d, w) is not None:
            sent += 1
    jobs: dict[str, list[str]] = {}
    parts = 0
    for t in plan["parts"]:
        try:
            await move(d, t["id"], "cancelled", f"{DEMOLISHED_NOTE} ({dept['name']})")
            parts += 1
        except Exception as e:  # one stuck part never stops the demolition
            log("warn", "department.part_cancel_failed", ticket=t.get("id"), error=type(e).__name__)
            continue
        # The manager's goal sits under the owner's job; workers' parts sit under the goal.
        if t.get("from") == "orchestrator" and t.get("parent_id"):
            jobs.setdefault(str(t["parent_id"]), []).append(str(t.get("goal") or ""))
    for task_id, goals in jobs.items():
        task = await d.ledger.get_ticket(task_id)
        if not task or task.get("status") not in OPEN_ASSIGNMENT:
            continue
        await send(
            d,
            {
                "role": "orchestrator",
                "agentId": "orchestrator",
                "department": None,
                "ticketId": task_id,
                "taskId": task_id,
                "kind": "instruction",
                "from": "owner",
                "body": (
                    f"The owner demolished the {dept['name']} department. Its part of this job was cancelled: "
                    + "; ".join(g for g in goals if g)
                    + ". Hand that part to another standing department if one fits, or report to VAIC what is "
                    f"left undone. Do not create or use {dept['name']} again."
                ),
            },
        )
    mgr = await d.ledger.get_agent(str(dept.get("manager_id") or ""))
    if mgr and mgr.get("state") != "retired":
        await d.ledger.update_agent(mgr["id"], {"state": "retired"})
        await d.bus.put({"type": "agent.retired", "id": mgr["id"]})
    await d.ledger.demolish_department(dept["name"])
    await d.bus.put({"type": "department.demolished", "name": dept["name"], "workers": sent, "parts": parts})
    log("info", "department.demolished", name=dept["name"], workers=sent, parts=parts, jobs=len(jobs))
    return {"name": dept["name"], "workers": sent, "parts": parts, "jobs": len(jobs)}
