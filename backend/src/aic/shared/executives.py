"""The Executive Leadership layer: CEO, COO, CFO and CTO (decision 140). Advisory only.

Executives govern direction and judge outcomes; they never run the work. The chain stays owner → AIC →
Orchestrator → Department Managers → Workers, and every earlier rule of the owner's comes first. So:

- **They only read, and recommend.** Each has a fixed set of read-only tools (``READ_TOOLS``: the city's
  status, jobs, costs, handoffs, deals, department reports, the company brief and the knowledge base), run by
  code through the policy gate before the model is called, and one write: ``send_recommendation``, which files
  the advice for AIC or the Orchestrator. There is no hire, assign, start or execute tool, and the gate denies
  any such name for the ``executive`` role (``FORBIDDEN``), whoever asks.
- **They never start on their own** (decision 138): they answer when the owner asks (AIC's ``ask_executive``,
  only on the owner's own message), when the Orchestrator consults them on a big decision (``ask_executives``)
  or in a review the owner switched on (``REVIEWS``, all off by default; a review is a short report in AIC's
  chat, never work).
- **Advice is advice.** The Orchestrator and managers decide what to do; under Autopilot the Chief of Staff
  reads the recent recommendations as context.

Each executive is one stateless call on the ``executive`` role (Claude Fable 5.1, Opus 5.5 once on a refusal),
with its own application inference profile so the bill shows what the executives cost.
"""

from __future__ import annotations

import asyncio
import json
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Final, Literal

from . import company
from . import sales_pipeline as deals
from . import support_desk as desk
from .config import models_config
from .events import EventBus, now_iso
from .ledger import Ledger, Record
from .log import log
from .models import model_label, resolve_role_from_env
from .policy import gate
from .table import UpdateOptions
from .turn import GateDeps, GatedTurn, ModelRunner, run_gated_turn
from .utility import agents_dir

ROLE: Final = "executive"
Exec = Literal["ceo", "coo", "cfo", "cto"]
ORDER: tuple[Exec, ...] = ("ceo", "coo", "cfo", "cto")
KEEP_DAYS = 62
MAX_QUESTION = 4000

EXECUTIVES: Final[dict[str, dict[str, Any]]] = {
    "ceo": {
        "title": "CEO",
        "name": "Chief Executive Officer",
        "about": "Strategy and direction: does it serve the business, what is the opportunity, what matters most now.",
        "reads": ("company_brief", "city_status", "jobs", "deals", "department_reports", "knowledge"),
    },
    "coo": {
        "title": "COO",
        "name": "Chief Operating Officer",
        "about": "How well the city delivers: bottlenecks, duplicated work, stalled handoffs, operating standards.",
        "reads": ("company_brief", "city_status", "jobs", "handoffs", "department_reports"),
    },
    "cfo": {
        "title": "CFO",
        "name": "Chief Financial Officer",
        "about": "The money: what it costs, whether it pays off, forecasts and financial risks. Never spends.",
        "reads": ("company_brief", "costs", "deals", "city_status", "knowledge"),
    },
    "cto": {
        "title": "CTO",
        "name": "Chief Technology Officer",
        "about": "Technology: architecture, scale, security and technical debt across IT, Application, Data & AI.",
        "reads": ("company_brief", "city_status", "jobs", "handoffs", "department_reports", "knowledge"),
    },
}

TECH_DEPARTMENTS = ("IT Infrastructure", "Application", "Data & AI")

REVIEWS: Final[dict[str, dict[str, Any]]] = {
    "cfo-cost-review": {
        "executive": "cfo",
        "title": "Cost review",
        "question": "Review what AI City cost this week and this month: where the money went, what it bought, "
        "anything growing without a matching result, and one or two ways to spend less for the same outcome.",
        "every_days": 7,
    },
    "coo-bottleneck-review": {
        "executive": "coo",
        "title": "Bottleneck review",
        "question": "Review how work is flowing: jobs stuck or failing, handoffs that stall or bounce, departments "
        "with too much open, duplicated work. Name the one or two changes that would help most.",
        "every_days": 7,
    },
}
REVIEW_DAYS = (1, 7, 14, 30)

READ_TOOLS: Final = (
    "city_status",
    "jobs",
    "costs",
    "handoffs",
    "deals",
    "department_reports",
    "company_brief",
    "knowledge",
)
"""The executives' read-only tools. Each passes the policy gate as ``mcp__executive__<name>``."""
WRITE_TOOLS: Final = ("send_recommendation",)
"""Their one write: filing advice for AIC or the Orchestrator. Nothing else."""
ALLOWED: Final = frozenset(f"mcp__executive__{t}" for t in (*READ_TOOLS, *WRITE_TOOLS))
"""The only calls an executive can make. Anything else (hire, assign, start, execute…) is denied (tested)."""


async def exec_gate(d_ledger: Ledger, who: str, name: str, args: dict[str, Any]) -> tuple[bool, str]:
    """The executives' gate: the allowlist first, then the city's policy gate like every agent; both audited."""
    agent = f"exec-{who}"
    if name not in ALLOWED:
        reason = "Executives only read and recommend; they never hire, assign, start or execute work."
        await d_ledger.audit_tool(agent, name, "deny", reason)
        return False, reason
    g = await gate(name, args, ROLE, agent)
    await d_ledger.audit_tool(agent, name, g.decision, g.reason)
    return g.decision == "allow", g.reason


# Words that route a question to an executive when the caller didn't name one.
_ROUTES: dict[str, re.Pattern[str]] = {
    "cfo": re.compile(
        r"\b(cost|costs|price|pricing|money|budget|spend|spending|roi|return|pay(s)? off|profit|revenue|margin|"
        r"cash|forecast|financ\w*|invest\w*|afford|expensive|cheap\w*|\$|€|£)",
        re.I,
    ),
    "cto": re.compile(
        r"\b(tech\w*|architect\w*|infra\w*|scal\w*|secur\w*|debt|database|cloud|aws|api|stack|migrat\w*|"
        r"platform|code|software|system design|performance|outage|data pipeline)",
        re.I,
    ),
    "coo": re.compile(
        r"\b(operat\w*|process\w*|bottleneck\w*|efficien\w*|deliver\w*|throughput|handoff\w*|workflow\w*|"
        r"stuck|slow|duplicat\w*|capacity|staffing|sla)",
        re.I,
    ),
    "ceo": re.compile(
        r"\b(strateg\w*|direction|market|opportunit\w*|compet\w*|vision|priorit\w*|growth|expand\w*|launch\w*|"
        r"new (project|product|business|initiative|market)|pivot|should we|worth)",
        re.I,
    ),
}
_INITIATIVE = re.compile(r"\b(new (project|product|business|initiative|market|venture|department)|launch|expand)", re.I)


def route(question: str, who: list[str] | None = None) -> list[str]:
    """Which executives a question goes to. Named ones win (unknown names dropped). Otherwise by subject; a new
    initiative goes to all four (strategy, operations, money, technology); nothing recognised goes to the CEO."""
    named = [w for w in dict.fromkeys(str(x).strip().lower() for x in (who or [])) if w in EXECUTIVES]
    if named:
        return named
    if _INITIATIVE.search(question):
        return [*ORDER]
    hits: list[str] = [e for e in ORDER if _ROUTES[e].search(question)]
    return hits or ["ceo"]


# ---------- the owner's switches ----------
async def config(ledger: Ledger) -> dict[str, Any]:
    """Which executives are on (all by default: they only speak when asked) and which reviews (none by default)."""
    r = await ledger.table.get("EXEC", "config") or {}
    on = r.get("enabled") or {}
    rv = r.get("reviews") or {}
    return {
        "enabled": {e: on.get(e) is not False for e in ORDER},
        "reviews": {
            k: {
                "enabled": (rv.get(k) or {}).get("enabled") is True,
                "every_days": int((rv.get(k) or {}).get("every_days") or v["every_days"]),
                "last_run_at": (rv.get(k) or {}).get("last_run_at"),
            }
            for k, v in REVIEWS.items()
        },
    }


class Invalid(ValueError):
    """A bad change from the owner's screen, in words the screen can show."""


async def set_config(ledger: Ledger, body: dict[str, Any]) -> dict[str, Any]:
    """``PUT /executives``: ``enabled: {ceo: bool, …}`` and ``reviews: {id: {enabled, every_days}}``. Only the owner
    calls this (the HUD's switches); no agent has a tool for it."""
    cur = await ledger.table.get("EXEC", "config") or {}
    enabled = dict(cur.get("enabled") or {})
    reviews = {k: dict(v) for k, v in (cur.get("reviews") or {}).items()}
    for k, v in (body.get("enabled") or {}).items():
        if k not in EXECUTIVES or not isinstance(v, bool):
            raise Invalid("enabled takes ceo, coo, cfo and cto, each true or false.")
        enabled[k] = v
    for k, v in (body.get("reviews") or {}).items():
        if k not in REVIEWS or not isinstance(v, dict):
            raise Invalid(f"There is no review called {k}.")
        row = reviews.setdefault(k, {})
        if "enabled" in v:
            if not isinstance(v["enabled"], bool):
                raise Invalid("A review is switched with true or false.")
            row["enabled"] = v["enabled"]
        if "every_days" in v:
            if v["every_days"] not in REVIEW_DAYS:
                raise Invalid("A review runs every 1, 7, 14 or 30 days.")
            row["every_days"] = v["every_days"]
    await ledger.table.update(
        "EXEC",
        "config",
        UpdateOptions(set={"enabled": enabled, "reviews": reviews, "updated_at": now_iso(ledger.now())}),
    )
    return await config(ledger)


# ---------- read-only tools ----------
@dataclass
class ExecDeps:
    ledger: Ledger
    bus: EventBus
    runner: ModelRunner
    settings: Callable[[], Awaitable[dict[str, Any]]]
    knowledge: Callable[[str], Awaitable[str]] | None = None
    """Searches the owner's knowledge base and returns the results as text; None when it isn't set up."""
    env: dict[str, str] | None = None


def _one(v: Any, n: int = 240) -> str:
    return " ".join(str(v or "").split())[:n]


async def _read(d: ExecDeps, tool: str, question: str) -> Any:
    led = d.ledger
    if tool == "company_brief":
        return await company.get_brief(led) or "No company brief yet."
    if tool == "city_status":
        live = await led.list_tickets(("open", "in_progress", "in_review", "waiting_on_owner", "parked"))
        agents = await led.list_agents("active")
        return {
            "departments": [x["name"] for x in await led.list_departments()],
            "jobs_open": sum(1 for t in live if t.get("kind", "task") == "task" and not t.get("parent_id")),
            "parts_waiting_on_owner": sum(1 for t in live if t["status"] == "waiting_on_owner"),
            "workers_at_work": sum(1 for a in agents if a.get("kind") == "worker"),
            "questions_open": len(await led.open_questions()),
        }
    if tool == "jobs":
        since = now_iso(led.now() - timedelta(days=30))
        rows = await led.list_tickets(
            ("open", "in_progress", "in_review", "waiting_on_owner", "parked", "done", "failed", "cancelled")
        )
        rows = [t for t in rows if str(t.get("updated_at", "")) >= since]
        rows.sort(key=lambda t: str(t.get("updated_at", "")), reverse=True)
        return [
            {
                "id": t["id"],
                "kind": t.get("kind", "task"),
                "goal": _one(t.get("owner_words") or t.get("goal"), 160),
                "department": t.get("department") or "",
                "status": t.get("status"),
                "updated": str(t.get("updated_at", ""))[:16],
                "review_rounds": t.get("review_rounds") or 0,
            }
            for t in rows[:60]
        ]
    if tool == "costs":
        day, month = await asyncio.gather(led.spend_breakdown("day"), led.spend_breakdown("month"))
        s = await d.settings()

        def group(b: dict[str, Any], prefix: str) -> dict[str, Any]:
            return {k[len(prefix) :]: round(float(v.get("usd", 0)), 2) for k, v in b.items() if k.startswith(prefix)}

        return {
            "note": "Estimates from token counts at list prices, in USD. The AWS bill is the truth.",
            "today_usd": round(float(day.get("GLOBAL", {}).get("usd", 0)), 2),
            "month_usd": round(float(month.get("GLOBAL", {}).get("usd", 0)), 2),
            "month_turns": int(month.get("GLOBAL", {}).get("turns", 0)),
            "month_by_department": group(month, "DEPT#"),
            "month_by_role": group(month, "ROLE#"),
            "month_by_model": {model_label(k): v for k, v in group(month, "MODEL#").items()},
            "caps": {
                k: s.get(k)
                for k in ("daily_global_usd", "monthly_budget_usd", "daily_department_usd")
                if s.get(k) is not None
            }
            or "none set",
        }
    if tool == "handoffs":
        rows = await desk.list_tickets(led)
        return [
            {
                "id": t.get("id"),
                "kind": t.get("kind"),
                "from": t.get("from_department"),
                "to": t.get("department"),
                "title": _one(t.get("title") or t.get("summary"), 160),
                "status": t.get("words") or t.get("status"),
                "created": str(t.get("created_at", ""))[:16],
            }
            for t in rows[:40]
        ]
    if tool == "deals":
        rows = await deals.list_deals(led)
        return [
            {k: r.get(k) for k in ("name", "value", "currency", "stage", "team", "last_contact_at") if r.get(k)}
            for r in rows[:40]
        ]
    if tool == "department_reports":
        rows = await led.list_tickets(("done", "failed"))
        rows = [t for t in rows if t.get("result")]
        rows.sort(key=lambda t: str(t.get("updated_at", "")), reverse=True)
        return [
            {
                "department": t.get("department") or "the Orchestrator",
                "goal": _one(t.get("goal"), 120),
                "status": t.get("status"),
                "report": _one(t.get("result"), 500),
                "at": str(t.get("updated_at", ""))[:16],
            }
            for t in rows[:15]
        ]
    if tool == "knowledge":
        if d.knowledge is None:
            return "The knowledge base isn't set up."
        return (await d.knowledge(question[:900]))[:6000]
    raise ValueError(f"unknown read tool {tool}")


async def read_records(d: ExecDeps, who: str, question: str) -> dict[str, Any]:
    """Runs this executive's read-only tools, each through the policy gate and the audit log, and returns what
    they read. A tool that fails is reported as unavailable; the advice says what it couldn't see."""
    out: dict[str, Any] = {}
    for tool in EXECUTIVES[who]["reads"]:
        ok, why = await exec_gate(d.ledger, who, f"mcp__executive__{tool}", {"question": question[:200]})
        if not ok:
            out[tool] = f"Not read: {why}"
            continue
        try:
            out[tool] = await _read(d, tool, question)
        except Exception as e:  # one missing source never stops the advice
            log("warn", "exec.read_failed", executive=who, tool=tool, error=type(e).__name__)
            out[tool] = "Unavailable right now."
    return out


# ---------- the call ----------
def prompt_of(who: str) -> str:
    base = agents_dir() / "executives"
    return (
        (base / f"{who}.md").read_text(encoding="utf-8").strip()
        + "\n\n"
        + (base / "common.md").read_text(encoding="utf-8").strip()
    )


def _strs(v: Any, n: int) -> list[str]:
    return [_one(x, 300) for x in (v if isinstance(v, list) else []) if _one(x)][:n]


def parse_advice(text: str) -> dict[str, Any]:
    """The model's JSON, tolerant of fences and stray words; plain text becomes the recommendation itself."""
    m = re.search(r"\{.*\}", text, re.S)
    j: Any = None
    if m:
        try:
            j = json.loads(m.group(0))
        except ValueError:
            j = None
    if not isinstance(j, dict) or not _one(j.get("recommendation")):
        return {
            "recommendation": _one(text, 600) or "No recommendation came back.",
            "reasons": [],
            "risks": [],
            "facts": [],
            "assumptions": [],
            "confidence": "low",
        }
    conf = str(j.get("confidence") or "").lower()
    return {
        "recommendation": _one(j["recommendation"], 600),
        "reasons": _strs(j.get("reasons"), 4),
        "risks": _strs(j.get("risks"), 3),
        "facts": _strs(j.get("facts"), 6),
        "assumptions": _strs(j.get("assumptions"), 4),
        "confidence": conf if conf in ("high", "medium", "low") else "medium",
    }


async def advise(
    d: ExecDeps, who: str, question: str, asked_by: str, ticket_id: str | None = None, review: str | None = None
) -> dict[str, Any]:
    """One executive's recommendation, filed with ``send_recommendation``. Never raises for a bad reply."""
    records = await read_records(d, who, question)
    settings = await d.settings()
    prompt = (
        f'{prompt_of(who)}\n\n<question asked_by="{asked_by}">\n{question[:MAX_QUESTION]}\n</question>\n\n'
        f'<records read_at="{now_iso(d.ledger.now())}">\n'
        f"{json.dumps(records, ensure_ascii=False, default=str)[:60_000]}\n</records>"
    )
    r = await run_gated_turn(
        GatedTurn(
            kind=ROLE,
            role=ROLE,
            agent_id=f"exec-{who}",
            session_id="executive-calls-are-stateless-000",
            department=None,
            ticket_id=ticket_id,
            models=resolve_role_from_env(ROLE, d.env),
            prompt=prompt,
            prefix=settings.get("profile_prefix"),
            timeout_ms=180_000,
            max_tokens=1500,
        ),
        GateDeps(ledger=d.ledger, bus=d.bus, settings=settings, runner=d.runner),
    )
    advice = parse_advice(r.output.text)
    to: Literal["ace", "orchestrator"] = "ace" if asked_by in ("owner", "ace", "review") else "orchestrator"
    return await send_recommendation(
        d, who, question, advice, to, sources=list(records), ticket_id=ticket_id, review=review
    )


async def send_recommendation(
    d: ExecDeps,
    who: str,
    question: str,
    advice: dict[str, Any],
    to: Literal["ace", "orchestrator"],
    sources: list[str],
    ticket_id: str | None = None,
    review: str | None = None,
) -> dict[str, Any]:
    """The executives' one write: the recommendation is kept (62 days) and sent on the bus for the HUD. It goes back
    to whoever asked (AIC or the Orchestrator) as the answer of their tool; it never starts work."""
    ok, why = await exec_gate(d.ledger, who, "mcp__executive__send_recommendation", {"to": to})
    at = now_iso(d.ledger.now())
    rec: Record = {
        "id": f"rec-{d.ledger.now_ms()}-{who}",
        "executive": who,
        "title": EXECUTIVES[who]["title"],
        "question": _one(question, 400),
        "to": to,
        "sources": sources,
        "at": at,
        **advice,
    }
    if ticket_id:
        rec["ticket_id"] = ticket_id
    if review:
        rec["review"] = review
    if not ok:
        return {**rec, "recommendation": f"Not sent: {why}", "sent": False}
    await d.ledger.table.put(
        {"pk": "EXECREC", "sk": f"{at}#{rec['id']}", **rec, "ttl": d.ledger.now_ms() // 1000 + KEEP_DAYS * 86_400}
    )
    await d.bus.put({"type": "executive.recommended", "recommendation": rec})
    return {**rec, "sent": True}


async def recent(ledger: Ledger, days: int = 30, limit: int = 50) -> list[Record]:
    since = now_iso(ledger.now() - timedelta(days=days))
    rows = [r for r in await ledger.table.query("EXECREC") if str(r.get("at", "")) >= since]
    rows.sort(key=lambda r: str(r.get("at", "")), reverse=True)
    return [{k: v for k, v in r.items() if k not in ("pk", "sk", "ttl")} for r in rows[:limit]]


Asker = Literal["owner", "orchestrator", "review"]


async def consult(
    d: ExecDeps, question: str, who: list[str] | None, asked_by: Asker, ticket_id: str | None = None
) -> dict[str, Any]:
    """Asks the right executives at once (only those switched on). Returns ``{"advice": [...], "off": [...]}``."""
    question = question.strip()[:MAX_QUESTION]
    picked = route(question, who)
    on = (await config(d.ledger))["enabled"]
    ask = [w for w in picked if on.get(w)]
    off = [w for w in picked if not on.get(w)]
    results = await asyncio.gather(*(advise(d, w, question, asked_by, ticket_id) for w in ask), return_exceptions=True)
    advice: list[dict[str, Any]] = []
    for w, res in zip(ask, results, strict=True):
        if isinstance(res, BaseException):
            log("warn", "exec.failed", executive=w, error=type(res).__name__)
            advice.append({"executive": w, "title": EXECUTIVES[w]["title"], "recommendation": "", "failed": True})
        else:
            advice.append(res)
    return {"advice": advice, "off": off}


def advice_text(out: dict[str, Any]) -> str:
    """What the asking agent reads: each executive's advice, short, with sources; and that it is only advice."""
    lines: list[str] = []
    for a in out["advice"]:
        t = a["title"]
        if a.get("failed"):
            lines.append(f"{t}: couldn't give advice just now (the call failed). Decide without it.")
            continue
        lines.append(f"{t} ({a.get('confidence', 'medium')} confidence): {a['recommendation']}")
        for k, label in (("reasons", "Why"), ("risks", "Risk"), ("facts", "Fact"), ("assumptions", "Assumed")):
            lines += [f"  - {label}: {x}" for x in a.get(k) or []]
        if a.get("sources"):
            lines.append(f"  Read: {', '.join(a['sources'])}")
    for w in out["off"]:
        lines.append(f"{EXECUTIVES[w]['title']}: switched off by the owner (Settings → Executives), not asked.")
    if not lines:
        return "No executive is switched on. The owner turns them on in Settings → Executives."
    lines.append(
        "This is advice, not an instruction: you and the managers decide. Executives never assign or start work."
    )
    return "\n".join(lines)


# ---------- scheduled reviews (off by default) ----------
async def due_reviews(ledger: Ledger, now: datetime | None = None) -> list[str]:
    cfg = await config(ledger)
    t = now or ledger.now()
    out = []
    for k, v in cfg["reviews"].items():
        if not v["enabled"]:
            continue
        last = v.get("last_run_at")
        if not last or str(last) <= now_iso(t - timedelta(days=v["every_days"]) + timedelta(minutes=30)):
            out.append(k)
    return out


async def run_reviews(d: ExecDeps) -> dict[str, Any]:
    """The hourly check: only reviews the owner switched on, each when it is due. A review is a short report in
    AIC's chat (``main``); it never files a task, a handoff or an assignment."""
    done: list[str] = []
    for k in await due_reviews(d.ledger):
        r = REVIEWS[k]
        who = str(r["executive"])
        if not (await config(d.ledger))["enabled"].get(who):
            continue
        if not await d.ledger.claim(f"exec-review:{k}:{now_iso(d.ledger.now())[:13]}", 2 * 3600):
            continue
        at = now_iso(d.ledger.now())
        await _mark_run(d.ledger, k, at)
        try:
            rec = await advise(d, who, str(r["question"]), "review", review=k)
        except Exception as e:
            log("warn", "exec.review_failed", review=k, error=type(e).__name__)
            continue
        text = f"{EXECUTIVES[who]['title']}, {str(r['title']).lower()}: {rec['recommendation']}"
        if rec.get("reasons"):
            text += " " + " ".join(f"({i + 1}) {x}" for i, x in enumerate(rec["reasons"][:3]))
        text += " This is advice only; nothing was started. Settings → Executives has the details."
        await d.ledger.add_conversation_line("main", "ace", text)
        await d.bus.put({"type": "ace.reply", "conversation": "main", "text": text, "done": True})
        done.append(k)
    return {"reviews": done}


async def _mark_run(ledger: Ledger, review: str, at: str) -> None:
    cur = await ledger.table.get("EXEC", "config") or {}
    reviews = {k: dict(v) for k, v in (cur.get("reviews") or {}).items()}
    reviews.setdefault(review, {})["last_run_at"] = at
    await ledger.table.update("EXEC", "config", UpdateOptions(set={"reviews": reviews}))


async def status(ledger: Ledger) -> dict[str, Any]:
    """``GET /executives``: the four, on or off; the latest recommendations; the optional reviews."""
    cfg = await config(ledger)
    return {
        "executives": [
            {
                "id": e,
                "title": EXECUTIVES[e]["title"],
                "name": EXECUTIVES[e]["name"],
                "about": EXECUTIVES[e]["about"],
                "enabled": cfg["enabled"][e],
                "model": model_label(str(models_config()["roles"][ROLE]["model"])),
            }
            for e in ORDER
        ],
        "recommendations": await recent(ledger),
        "reviews": [
            {"id": k, "executive": v["executive"], "title": v["title"], **cfg["reviews"][k]} for k, v in REVIEWS.items()
        ],
    }
