"""Which departments a skill or a knowledge document is for (decision 266).

The owner picks departments on a card in the chat (chips, with VAIC's recommended ones pre-selected) or says it in
words: "all", "all except Sales and Legal", "just Finance", "also Sales", "not Legal". ``parse`` turns the words into
department keys in code, so the selection never depends on the model reading it right. ``recommend`` is the fallback
when VAIC proposes none: a few departments whose names or usual words appear in the title and description, never all.

A selection is a list of department keys (``finance``, ``data``), or ``ALL`` (every department: a skill with no
department list, a knowledge document visible to every department). VAIC and the Orchestrator always see every one.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .ids import department_key
from .presets import presets

ALL = "all"
MAX_RECOMMENDED = 4
"""A recommendation is the sensible few (the owner's rule): never every department."""


@dataclass(frozen=True)
class Dept:
    key: str
    name: str
    words: tuple[str, ...] = field(default=())
    """Names the owner may use for it: the name, the key and the preset's aliases."""


def _norm(s: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", s.lower().replace("&", " and ")).split())


def canonical(name: str) -> str:
    """A department name or key → its key: a preset's own key ("IT Infrastructure" → ``infrastructure``), else the
    ledger's key for an on-demand department."""
    n = _norm(name)
    for p in presets():
        if n in {_norm(p["key"]), _norm(p["name"]), *(_norm(a) for a in p.get("aliases") or [])}:
            return str(p["key"])
    return department_key(name)


def choices(own: list[dict[str, Any]] | None = None) -> list[Dept]:
    """Every department the owner can pick: the pre-configured ones, then the owner's own (standing) departments."""
    out = [
        Dept(str(p["key"]), str(p["name"]), tuple(dict.fromkeys([p["name"], p["key"], *(p.get("aliases") or [])])))
        for p in presets()
    ]
    have = {d.key for d in out}
    for r in own or []:
        name = str(r.get("name") or "")
        if not name or r.get("state") == "demolished":
            continue
        k = canonical(name)
        if k not in have:
            have.add(k)
            out.append(Dept(k, name, (name,)))
    return out


def _short(word: str) -> bool:
    return len(_norm(word).replace(" ", "")) <= 2


def _mentions(text: str, depts: list[Dept]) -> list[tuple[int, str]]:
    """(position, key) of each department named in ``text``, longest names first so "data and ai" is one mention.
    Two-letter names (IT, AI, PM, UX) count only in capitals, so "add it for Finance" names Finance alone."""
    norm = f" {_norm(text)} "
    taken = [False] * len(norm)
    found: list[tuple[int, str]] = []
    words = sorted(((w, d.key) for d in depts for w in d.words), key=lambda x: -len(_norm(x[0])))
    for w, key in words:
        nw = _norm(w)
        if not nw:
            continue
        if _short(w):
            # Capitals only, matched against the original text.
            for m in re.finditer(rf"(?<![A-Za-z0-9]){re.escape(nw.upper())}(?![A-Za-z0-9])", text):
                found.append((len(_norm(text[: m.start()]).split()), key))
            continue
        for m in re.finditer(rf" {re.escape(nw)} ", norm):
            span = range(m.start() + 1, m.end() - 1)
            if any(taken[i] for i in span):
                continue
            for i in span:
                taken[i] = True
            found.append((len(norm[: m.start()].split()), key))
    return sorted(found)


_NOT = re.compile(
    r"\b(except|excluding|exclude|without|apart from|other than|but not|but|leave out|leaving out|minus|not|"
    r"remove|drop|take out|skip|no)\b(?! also)"
)
_EVERY = re.compile(r"\b(all|every|everyone|everybody|each|whole city|all of them)\b")
_NONE = re.compile(r"\b(none|nobody|no department|no departments|clear|nothing)\b")


def parse(text: str, depts: list[Dept], current: list[str] | str | None = None) -> list[str] | str | None:
    """The selection the owner's words describe: ``ALL``, a list of keys (``[]``: none), or None when the words
    name no departments at all (the caller keeps the current selection)."""
    t = _norm(text)
    if not t:
        return None
    keys = [d.key for d in depts]
    neg = _NOT.search(t)
    cut = len(t[: neg.start()].split()) if neg else None
    named = _mentions(text, depts)
    inc = list(dict.fromkeys(k for pos, k in named if cut is None or pos < cut))
    exc = list(dict.fromkeys(k for pos, k in named if cut is not None and pos >= cut))
    cur = keys if current == ALL else list(current or [])
    every = _EVERY.search(t[: neg.start()] if neg else t)
    if every and not inc:
        rest = [k for k in keys if k not in exc]
        return ALL if not exc else rest
    if inc:
        # "also Sales" adds to what is picked; "Finance and Data & AI" or "just Finance" is the whole answer.
        more = re.search(r"\b(also|plus|too|as well)\b", t)
        base = [*cur, *inc] if more else inc
        return [k for k in keys if k in base and k not in exc]
    if exc:
        return [k for k in keys if k in cur and k not in exc]
    if _NONE.search(t):
        return []
    return None


def check(v: Any, depts: list[Dept]) -> list[str] | str:
    """A selection sent to the API: ``"all"``, or a non-empty list of department names or keys."""
    if v == ALL or v is None:
        return ALL
    if not isinstance(v, list) or not v or not all(isinstance(x, str) and x.strip() for x in v):
        raise ValueError('Departments must be "all" or a list of department names.')
    known = {d.key for d in depts}
    out: list[str] = []
    for x in v:
        k = canonical(x)
        if k not in known:
            raise ValueError(f"There is no department called {x[:40]}.")
        if k not in out:
            out.append(k)
    return ALL if set(out) >= known else [d.key for d in depts if d.key in out]


def names(sel: list[str] | str | None, depts: list[Dept]) -> str:
    """ "Finance and Data & AI", "every department", "no department"."""
    if sel == ALL or sel is None:
        return "every department"
    by = {d.key: d.name for d in depts}
    ns = [by.get(k, k) for k in sel]
    if not ns:
        return "no department"
    return ns[0] if len(ns) == 1 else f"{', '.join(ns[:-1])} and {ns[-1]}"


# Words that point at a department when its own names don't appear (the fallback recommendation only).
_HINTS: dict[str, tuple[str, ...]] = {
    "application": ("python", "javascript", "typescript", "react", "code", "coding", "programming", "api",
                    "app", "website", "swift", "kotlin", "testing", "git", "github", "software"),
    "infrastructure": ("python", "aws", "terraform", "server", "servers", "docker", "kubernetes", "linux",
                       "deploy", "deployment", "network", "monitoring", "backup", "scripting", "bash"),
    "data": ("python", "sql", "dashboard", "dashboards", "analytics", "analytical", "chart", "charts", "metrics",
             "kpi", "kpis", "spreadsheet", "excel", "statistics", "forecast", "model", "dataset", "pandas"),
    "finance": ("dashboard", "dashboards", "budget", "invoice", "invoices", "tax", "taxes", "revenue", "cost",
                "costs", "pricing", "cash", "profit", "forecast", "spreadsheet", "excel", "kpi", "kpis"),
    "marketing": ("campaign", "campaigns", "brand", "copywriting", "newsletter", "email marketing", "meta ads",
                  "google ads", "landing page", "audience"),
    "sales": ("crm", "pipeline", "outreach", "cold email", "proposal", "quote", "customers", "prospect"),
    "support": ("customer", "customers", "ticket", "tickets", "faq", "refund", "complaint"),
    "legal": ("contract", "contracts", "terms", "gdpr", "law", "laws", "regulation", "license", "nda"),
    "product": ("roadmap", "feature", "features", "user research", "prototype", "requirements", "ux"),
    "operations": ("process", "processes", "supplier", "suppliers", "inventory", "schedule", "hiring", "onboarding"),
    "research": ("research", "study", "market", "competitor", "competitors", "trend", "trends"),
    "media": ("video", "videos", "animation", "editing", "thumbnail", "podcast", "reel", "reels", "youtube"),
}  # fmt: skip


def recommend(text: str, depts: list[Dept]) -> list[tuple[str, str]]:
    """(key, why) for at most ``MAX_RECOMMENDED`` departments whose names, or usual words, are in ``text``."""
    t = f" {_norm(text)} "
    score: dict[str, tuple[int, str]] = {}
    for d in depts:
        hits = [w for w in d.words if not _short(w) and f" {_norm(w)} " in t]
        hints = [w for w in _HINTS.get(d.key, ()) if f" {_norm(w)} " in t]
        n = 3 * len(hits) + len(hints)
        if n:
            word = (hits or hints)[0]
            score[d.key] = (n, f"it's about {word.lower()}")
    order = [d.key for d in depts]
    best = sorted(score, key=lambda k: (-score[k][0], order.index(k)))[:MAX_RECOMMENDED]
    return [(k, score[k][1]) for k in best]


def recommended(given: Any, text: str, depts: list[Dept]) -> list[tuple[str, str]]:
    """VAIC's recommendation ([{name, why}]) checked against the departments, at most ``MAX_RECOMMENDED``; the
    fallback ``recommend`` when VAIC gave none it could use."""
    known = {d.key for d in depts}
    out: list[tuple[str, str]] = []
    for r in given if isinstance(given, list) else []:
        name = r.get("name") if isinstance(r, dict) else r
        if not isinstance(name, str) or not name.strip():
            continue
        k = canonical(name)
        why = " ".join(str(r.get("why") or "").split())[:80] if isinstance(r, dict) else ""
        if k in known and k not in (x for x, _ in out):
            out.append((k, why))
    return out[:MAX_RECOMMENDED] or recommend(text, depts)


def card(depts: list[Dept], recs: list[tuple[str, str]], selected: list[str] | str) -> dict[str, Any]:
    """The picker on a chat card: every department, the recommended ones with a few words why, and the selection."""
    return {
        "choices": [{"key": d.key, "name": d.name} for d in depts],
        "recommended": [{"key": k, "why": w} for k, w in recs],
        "selected": [d.key for d in depts] if selected == ALL else list(selected),
    }
