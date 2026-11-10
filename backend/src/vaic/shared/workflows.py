"""AI workflows (decision 126): known processes the owner can start in plain words, defined as data.

``config/workflows.json`` holds each workflow: how it is recognised in the owner's words, the inputs it needs (asked
one at a time, only when missing), its steps (what the owner does by hand in ``guide`` mode, how the team does it in
``do`` mode), the connector it needs and which inputs make the money it spends. Adding a workflow is adding an entry
there; this module has no per-workflow code.

A run is one use of a workflow in one conversation, kept in the ledger as ``WORKFLOWS`` / ``<run id>``:
``{id, workflow_id, conversation, status, mode, values, asked, step, task_id, owner_words, created_at, updated_at}``.
``values`` maps an input key to its parsed answer (always with a ``text`` the owner can read). The next thing to ask
or do is worked out from the run each time (``next_need``), so nothing is asked twice: an input with a value is
never asked again, and the owner's own words are read for every input before anything is asked.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable, Mapping, Sequence
from datetime import date, datetime, timedelta
from typing import Any

from .config import _load
from .events import now_iso
from .ids import new_id
from .table import Table, UpdateOptions

PK = "WORKFLOWS"
MODES = ("guide", "do")
LIVE = ("active", "running")
MAX_RUNS_SHOWN = 20
MAX_TEXT = 300
CONNECT_WHERE = "Settings → Departments & tools → {department}"

Record = dict[str, Any]
Definition = dict[str, Any]


class Invalid(ValueError):
    pass


# ---------- definitions ----------
def definitions() -> list[Definition]:
    return list(_load("workflows.json").get("workflows") or [])


def definition(workflow_id: str) -> Definition | None:
    return next((w for w in definitions() if w.get("id") == workflow_id), None)


def check_definition(w: Mapping[str, Any]) -> list[str]:
    """What is wrong with one definition (empty = fine). Used by the tests on every entry in the config."""
    errs: list[str] = []
    for k in ("id", "name", "summary", "department", "inputs", "steps", "match"):
        if not w.get(k):
            errs.append(f"missing {k}")
    if any(m not in MODES for m in modes_of(w)) or not modes_of(w):
        errs.append("modes must be guide and/or do")
    if "do" in modes_of(w) and not w.get("connector") and w.get("connector") is not None:
        errs.append("connector must be a catalog key or null")
    keys = [str(i.get("key")) for i in w.get("inputs") or []]
    if len(set(keys)) != len(keys):
        errs.append("duplicate input keys")
    for i in w.get("inputs") or []:
        if i.get("type") not in TYPES:
            errs.append(f"input {i.get('key')}: unknown type {i.get('type')}")
        if not i.get("question") or not i.get("label"):
            errs.append(f"input {i.get('key')}: needs a label and a question")
        if i.get("type") == "choice" and len(i.get("options") or []) < 2:
            errs.append(f"input {i.get('key')}: a choice needs two options")
        if i.get("default") is not None:
            try:
                parse_answer(i, str(i["default"]), date(2026, 1, 1))
            except Invalid:
                errs.append(f"input {i.get('key')}: its default can't be read")
    for s in w.get("steps") or []:
        for k in s.get("inputs") or []:
            if k not in keys:
                errs.append(f"step {s.get('id')}: unknown input {k}")
        if not s.get("title") or not s.get("guide") or not s.get("do"):
            errs.append(f"step {s.get('id')}: needs a title, guide and do")
        for k in re.findall(r"\{(\w+)\}", f"{s.get('guide', '')} {s.get('do', '')}"):
            if k not in keys:
                errs.append(f"step {s.get('id')}: placeholder {{{k}}} is not an input")
    for k in (w.get("spend") or {}).values():
        if k not in keys:
            errs.append(f"spend: unknown input {k}")
    if not (w.get("match") or {}).get("subjects"):
        errs.append("match needs subjects")
    return errs


# ---------- recognising a workflow in the owner's words ----------
def norm(text: str) -> str:
    t = str(text or "").lower().replace("’", "'").replace("'", "")
    return " ".join(re.sub(r"[^a-z0-9$€£.:/]+", " ", t).split())


def _has(text: str, phrase: str) -> bool:
    p = norm(phrase)
    return bool(p) and re.search(rf"(?<![a-z0-9]){re.escape(p)}(?![a-z0-9])", text) is not None


def recognise(text: str) -> list[Record]:
    """The workflows the owner's words point at: ``[{id, name, direct}]``, direct ones first. ``direct`` = the owner
    asked to do it ("let's create Meta ads"), so it can start; otherwise VAIC asks "Is this what you mean". Words that
    mean something else (a report, pausing) match nothing."""
    t = norm(text)
    out: list[Record] = []
    for w in definitions():
        m = w.get("match") or {}
        if not any(_has(t, s) for s in m.get("subjects") or []):
            continue
        if any(_has(t, x) for x in m.get("not_when") or []):
            continue
        direct = any(_has(t, a) for a in m.get("actions") or [])
        if m.get("direct_only") and not direct:
            continue  # words like "app" are too common to ask "Is this what you mean" on their own
        out.append({"id": w["id"], "name": w["name"], "direct": direct})
    return sorted(out, key=lambda r: not r["direct"])


def modes_of(w: Mapping[str, Any]) -> list[str]:
    """The ways this workflow can run: guide (the owner by hand) and/or do (the team). Both unless it says."""
    return list(w.get("modes") or MODES)


_PRESENT = ("im here", "i am here", "im around", "i am around", "ask me", "check with me", "with me", "together",
            "walk me", "guide me", "step by step", "lets discuss", "let me decide", "i want to decide")  # fmt: skip
_AWAY = ("im away", "i am away", "ill be away", "i will be away", "im out", "without me", "dont ask", "do not ask",
         "by yourself", "on your own", "yourself", "you decide", "surprise me", "just build", "just do it")  # fmt: skip


def presence_in(text: str) -> bool | None:
    """True when the owner said they are here to decide with VAIC, False when they said they are away; else None."""
    t = norm(text)
    if any(_has(t, p) for p in _AWAY):
        return False
    if any(_has(t, p) for p in _PRESENT):
        return True
    return None


def mode_in(text: str) -> str | None:
    """'walk me through it' → guide, 'do it for me' → do; None when the owner said neither."""
    t = norm(text)
    if any(_has(t, p) for p in ("walk me", "guide me", "show me how", "step by step", "by hand", "myself", "teach me")):
        return "guide"
    if any(_has(t, p) for p in ("do it for me", "for me", "you do it", "do it yourself", "handle it", "take care of")):
        return "do"
    return None


# ---------- reading one answer ----------
_CURRENCY = {
    "$": "USD", "usd": "USD", "dollar": "USD", "dollars": "USD", "bucks": "USD",
    "€": "EUR", "eur": "EUR", "euro": "EUR", "euros": "EUR",
    "£": "GBP", "gbp": "GBP", "pound": "GBP", "pounds": "GBP",
    "sek": "SEK", "kr": "SEK", "kronor": "SEK", "krona": "SEK", "nok": "NOK", "dkk": "DKK",
}  # fmt: skip
_CUR = "|".join(sorted((re.escape(k) for k in _CURRENCY), key=len, reverse=True))
_AMOUNT = re.compile(
    rf"(?P<pre>{_CUR})?\s*(?P<n>\d{{1,3}}(?:[ ,]\d{{3}})+|\d+(?:\.\d+)?)\s*(?P<k>k\b)?\s*(?P<post>{_CUR})?(?![a-z0-9])"
)
_PER = re.compile(r"\b(?:a|per|each|every|/)\s*(day|week|month)\b|\b(daily|weekly|monthly)\b|/\s*(day|week|month)")
_UNIT = {"day": "day", "daily": "day", "week": "week", "weekly": "week", "month": "month", "monthly": "month"}
_PER_DAYS = {"day": 1, "week": 7, "month": 30}
_WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
_MONTHS = ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec")
_MONTH = r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?"
_OPEN = ("keep running", "keep it running", "no end", "no end date", "ongoing", "until i stop", "open ended",
         "dont stop", "do not stop", "until further notice", "indefinitely")  # fmt: skip
_URL = re.compile(r"\bhttps?://[^\s<>\"']+|\b(?:[a-z0-9-]+\.)+[a-z]{2,24}(?:/[^\s<>\"']*)?", re.I)


def _money_text(amount: float, currency: str | None, per: str = "day") -> str:
    n = f"{amount:,.2f}".rstrip("0").rstrip(".")
    return f"{n} {currency} per {per}" if currency else f"{n} per {per}"


def _parse_money(text: str, today: date, need_context: bool = False) -> Record | None:
    t = norm(text)
    for m in _AMOUNT.finditer(t):
        n = float(m.group("n").replace(",", "").replace(" ", ""))
        if m.group("k"):
            n *= 1000
        if n <= 0:
            continue
        per = _PER.match(t[m.end() : m.end() + 24].strip())
        if need_context and not per and "budget" not in t[max(0, m.start() - 30) : m.start()]:
            continue
        cur = m.group("pre") or m.group("post")
        unit = _UNIT[next((g for g in per.groups() if g), "day")] if per else "day"
        daily = round(n / _PER_DAYS[unit], 2)
        currency = _CURRENCY.get(cur) if cur else None
        out: Record = {"amount": daily, "currency": currency, "text": _money_text(daily, currency)}
        if unit != "day":
            out["text"] += f" ({_money_text(n, currency, unit)})"
        return out
    return None


def _nearest_weekday(today: date, name: str, next_week: bool) -> date:
    d = (_WEEKDAYS.index(name) - today.weekday()) % 7
    if d == 0 or next_week:
        d = d or 7
    return today + timedelta(days=d)


def _parse_day(t: str, today: date) -> date | None:
    if _has(t, "today") or _has(t, "now") or _has(t, "asap") or _has(t, "right away") or _has(t, "immediately"):
        return today
    if _has(t, "day after tomorrow"):
        return today + timedelta(days=2)
    if _has(t, "tomorrow"):
        return today + timedelta(days=1)
    if m := re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", t):
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    m = re.search(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?{_MONTH}", t) or None
    m2 = re.search(rf"\b{_MONTH}\s+(\d{{1,2}})(?:st|nd|rd|th)?\b", t)
    if m or m2:
        day = int(m.group(1)) if m else int(m2.group(2))  # type: ignore[union-attr]
        mon = _MONTHS.index((m.group(2) if m else m2.group(1))[:3]) + 1  # type: ignore[union-attr]
        try:
            d = date(today.year, mon, day)
        except ValueError:
            return None
        return d if d >= today else date(today.year + 1, mon, day)
    for name in _WEEKDAYS:
        if _has(t, name):
            return _nearest_weekday(today, name, _has(t, f"next {name}"))
    if m := re.search(r"\bin (\d{1,3}) (day|days|week|weeks)\b", t):
        return today + timedelta(days=int(m.group(1)) * (7 if m.group(2).startswith("week") else 1))
    if _has(t, "next week"):
        return _nearest_weekday(today, "monday", True)
    return None


def _day_text(d: date) -> str:
    return f"{d.strftime('%a')} {d.day} {d.strftime('%b %Y')}"


def _parse_date(text: str, today: date) -> Record | None:
    d = _parse_day(norm(text), today)
    if d is None:
        return None
    if d < today:
        raise Invalid("That date has passed. Which day from today on?")
    return {"date": d.isoformat(), "text": _day_text(d)}


def _duration(t: str, anchored: bool = False) -> int | None:
    rx = r"(?:the\s+next\s+)?(\d{1,3}|a|one|two|three|four|six)\s+(day|days|week|weeks|month|months)\b"
    m = re.match(rx, t.strip()) if anchored else re.search(rf"\b{rx}", t)
    if not m:
        return None
    words = {"a": 1, "one": 1, "two": 2, "three": 3, "four": 4, "six": 6}
    n = words.get(m.group(1)) or int(m.group(1))
    unit = m.group(2)
    return n * (30 if unit.startswith("month") else 7 if unit.startswith("week") else 1)


def _parse_end(text: str, today: date) -> Record | None:
    t = norm(text)
    if any(_has(t, p) for p in _OPEN):
        return {"open": True, "text": "keeps running until you stop it"}
    if (n := _duration(t)) is not None and n > 0:
        return {"days": n, "text": f"after {n} day{'s' if n != 1 else ''}"}
    d = _parse_day(t, today)
    if d is None:
        return None
    if d < today:
        raise Invalid("That date has passed. When should they stop?")
    return {"date": d.isoformat(), "text": _day_text(d)}


def _parse_url(text: str, _: date) -> Record | None:
    m = _URL.search(str(text or ""))
    if not m:
        return None
    u = m.group(0).rstrip(".,;:!?)")
    if not u.lower().startswith(("http://", "https://")):
        u = f"https://{u}"
    return {"url": u, "text": u}


def _parse_text(text: str, _: date) -> Record | None:
    t = " ".join(str(text or "").split())[:MAX_TEXT]
    return {"text": t} if t else None


def _choice(inp: Mapping[str, Any], text: str) -> Record | None:
    t = norm(text)
    exact = [o["label"] for o in inp.get("options") or [] if norm(o["label"]) == t]
    if exact:  # tapping an option sends its exact words
        return {"text": exact[0]}
    hits = []
    for o in inp.get("options") or []:
        if _has(t, o["label"]) or any(_has(t, w) for w in o.get("words") or []):
            hits.append(o["label"])
    return {"text": hits[0]} if len(hits) == 1 else None


PARSERS: dict[str, Callable[[str, date], Record | None]] = {
    "text": _parse_text,
    "money": _parse_money,
    "date": _parse_date,
    "end": _parse_end,
    "url": _parse_url,
}
TYPES = (*PARSERS, "choice")


def parse_answer(inp: Mapping[str, Any], text: str, today: date) -> Record:
    """The owner's answer to one input, read the way they said it ("300" → 300 per day). Raises ``Invalid`` with a
    plain sentence when it can't be read."""
    kind = inp.get("type")
    if kind == "choice":
        v = _choice(inp, text)
        if v is None:
            raise Invalid(f"Pick one: {', '.join(o['label'] for o in inp.get('options') or [])}.")
        return v
    v = PARSERS[str(kind)](text, today) if kind in PARSERS else None
    if v is None:
        raise Invalid(
            {
                "money": "I need an amount, for example 300 (per day).",
                "date": "I need a day, for example today, tomorrow, Monday or 12 November.",
                "end": "Say a date, a number of days (after 14 days), or keep running.",
                "url": "I need a web address, for example example.com/offer.",
                "text": "I need a few words.",
            }.get(str(kind), "I couldn't read that.")
        )
    return v


def extract(w: Mapping[str, Any], text: str, today: date) -> dict[str, Record]:
    """What the owner already said in their own words, before anything is asked. Only what is clear: an amount with
    a per-day word or 'budget', a start or end phrase, a web address, one option's words. Free-text inputs are VAIC's
    to pass from what it understood."""
    t = norm(text)
    out: dict[str, Record] = {}
    for inp in w.get("inputs") or []:
        k, kind = inp["key"], inp.get("type")
        try:
            if kind == "money":
                v = _parse_money(text, today, need_context=True)
            elif kind == "date":
                m = re.search(r"\b(?:start(?:ing|s)?|from|beginning|begin|go live|launch(?:ing)?|on)\b(.{0,30})", t)
                v = _parse_date(m.group(1), today) if m else None
                if v is None and any(_has(t, x) for x in ("today", "tomorrow", "right away", "asap")):
                    v = _parse_date(t, today)
            elif kind == "end":
                v = None
                for m in re.finditer(r"\b(for|until|till|ending|ends|end on|stop(?:ping)? on|through)\s+(.{0,30})", t):
                    seg = m.group(2)
                    if m.group(1) == "for":
                        n = _duration(seg, anchored=True)
                        v = {"days": n, "text": f"after {n} day{'s' if n != 1 else ''}"} if n else None
                    elif (d := _parse_day(seg, today)) is not None and d >= today:
                        v = {"date": d.isoformat(), "text": _day_text(d)}
                    if v:
                        break
                if v is None and any(_has(t, p) for p in _OPEN):
                    v = {"open": True, "text": "keeps running until you stop it"}
            elif kind == "url":
                v = _parse_url(text, today)
            elif kind == "choice":
                v = _choice(inp, text)
            else:
                v = None
        except Invalid:
            v = None
        if v is not None:
            out[k] = v
    return out


# ---------- the money shown before anything is created ----------
def _iso_day(v: Any) -> date | None:
    try:
        return date.fromisoformat(str(v)) if v else None
    except ValueError:
        return None


def spend(w: Mapping[str, Any], values: Mapping[str, Record]) -> Record | None:
    """``{daily, currency, start, end, days, total, text}`` from the inputs the definition names; None when the
    workflow spends nothing or the daily budget isn't known yet."""
    s = w.get("spend") or {}
    budget = values.get(s.get("daily", ""))
    if not s or not budget:
        return None
    daily, cur = float(budget["amount"]), budget.get("currency")
    start = _iso_day((values.get(s.get("start", "")) or {}).get("date"))
    e = values.get(s.get("end", "")) or {}
    end = _iso_day(e.get("date"))
    if start and e.get("days"):
        end = start + timedelta(days=int(e["days"]) - 1)
    days = (end - start).days + 1 if start and end and end >= start else None
    total = round(daily * days, 2) if days else None
    money = _money_text(daily, cur).replace(" per day", "")
    text = f"{_money_text(daily, cur)}"
    if start:
        text += f" from {_day_text(start)}"
    if end:
        text += f" to {_day_text(end)}"
    if total is not None:
        text += f": {_money_text(total, cur).replace(' per day', '')} in all ({days} day{'s' if days != 1 else ''})"
    elif e.get("open"):
        text += f", no end date: about {_money_text(daily * 30, cur).replace(' per day', '')} a month until you stop it"
    if not cur:
        text += " (in your ad account's currency)"
    return {
        "daily": daily,
        "currency": cur,
        "start": start.isoformat() if start else None,
        "end": end.isoformat() if end else None,
        "days": days,
        "total": total,
        "text": text,
        "per_day": money,
    }


# ---------- connectors ----------
def connector_info(w: Mapping[str, Any], records: Iterable[Mapping[str, Any]]) -> Record:
    """``{id, label, connected, where}``: connected = a ready connector with the catalog's id or address."""
    from .presets import catalog

    key = str(w.get("connector") or "")
    if not key:  # nothing outside the city is needed (an app the city builds)
        return {"id": None, "label": None, "connected": True, "where": None}
    cat = catalog().get(key) or {}
    url = str(cat.get("url") or "").rstrip("/")
    ready = any(
        r.get("status") == "ready" and (r.get("id") == key or (url and str(r.get("url") or "").rstrip("/") == url))
        for r in records
    )
    return {
        "id": key,
        "label": cat.get("label") or key,
        "connected": ready,
        "where": CONNECT_WHERE.format(department=w.get("department") or "the department"),
    }


# ---------- what comes next ----------
def _inputs(w: Mapping[str, Any]) -> dict[str, Record]:
    return {i["key"]: i for i in w.get("inputs") or []}


def _options(inp: Mapping[str, Any]) -> list[str]:
    if inp.get("type") == "choice":
        return [o["label"] for o in inp.get("options") or []]
    return list(inp.get("suggest") or [])


MODE_QUESTION = "Shall I walk you through it step by step, Sir, or do it for you?"
MODE_OPTIONS = ["Walk me through it", "Do it for me"]


def next_need(run: Mapping[str, Any], w: Mapping[str, Any], connected: bool) -> Record:
    """The one next thing: ``{kind, key?, question?, options?}``. Kinds: mode, connect, input, step, confirm, none."""
    if run.get("status") not in LIVE:
        return {"kind": "none"}
    if run.get("status") == "running":
        return {"kind": "none"}
    if run.get("mode") not in MODES:
        return {"kind": "mode", "question": MODE_QUESTION, "options": MODE_OPTIONS}
    values = run.get("values") or {}
    inputs = _inputs(w)
    if run["mode"] == "do":
        if not connected:
            return {"kind": "connect"}
        for k, inp in inputs.items():
            if k not in values:
                return {"kind": "input", "key": k, "question": inp["question"], "options": _options(inp)}
        if spend(w, values) is None and not run.get("present"):
            return {"kind": "go"}  # nothing paid and the owner is away: the team starts now (decision 127)
        return {"kind": "confirm", "question": "Shall I create it, Sir?", "options": ["Yes, create it", "Not yet"]}
    steps = w.get("steps") or []
    i = min(int(run.get("step") or 0), max(len(steps) - 1, 0))
    for k in (steps[i].get("inputs") if steps else []) or []:
        if k not in values:
            inp = inputs[k]
            return {"kind": "input", "key": k, "question": inp["question"], "options": _options(inp)}
    last = i >= len(steps) - 1
    return {
        "kind": "step",
        "question": "Tell me when it's done, Sir." if last else "Tell me when this page is done, Sir, and we'll go on.",
        "options": ["Done"] if last else ["Next"],
    }


def assume_defaults(w: Mapping[str, Any], values: Mapping[str, Record], present: bool) -> dict[str, Record]:
    """While the owner is away, an input with a default is not asked: the default is used and marked ``assumed``,
    so it becomes a taste question the owner can change later. Inputs without a default are always asked."""
    out = dict(values)
    if present:
        return out
    for inp in w.get("inputs") or []:
        if inp["key"] not in out and inp.get("default") is not None:
            v = parse_answer(inp, str(inp["default"]), date(2026, 1, 1))
            out[inp["key"]] = {**v, "assumed": True}
    return out


def fill(template: str, w: Mapping[str, Any], values: Mapping[str, Record]) -> str:
    inputs = _inputs(w)

    def one(m: re.Match[str]) -> str:
        k = m.group(1)
        v = values.get(k)
        if v:
            return str(v.get("text"))
        return f"(your {str(inputs.get(k, {}).get('label', k)).lower()})"

    return re.sub(r"\{(\w+)\}", one, template)


def public(
    run: Mapping[str, Any], w: Mapping[str, Any], conn: Mapping[str, Any], taste: Iterable[Mapping[str, Any]] = ()
) -> Record:
    """The run as the HUD and the ``workflow.updated`` event show it (``workflows-contract.md``)."""
    values = run.get("values") or {}
    step = int(run.get("step") or 0)
    sp = spend(w, values)
    return {
        "id": run["id"],
        "workflow_id": w["id"],
        "name": w["name"],
        "summary": w.get("summary", ""),
        "connector": dict(conn),
        "mode": run.get("mode") if run.get("mode") in MODES else None,
        "present": bool(run.get("present")),
        "status": run.get("status"),
        "inputs": [
            {
                "key": i["key"],
                "label": i["label"],
                "question": i["question"],
                "value": (values.get(i["key"]) or {}).get("text"),
                "assumed": bool((values.get(i["key"]) or {}).get("assumed")),
            }
            for i in w.get("inputs") or []
        ],
        "next": next_need(run, w, bool(conn.get("connected"))),
        "step": step,
        "steps": [
            {
                "id": s["id"],
                "title": s["title"],
                "guide": fill(s["guide"], w, values),
                "inputs": list(s.get("inputs") or []),
                "done": n < step or run.get("status") == "done",
            }
            for n, s in enumerate(w.get("steps") or [])
        ],
        "spend": {k: v for k, v in sp.items() if k != "per_day"} if sp else None,
        "task_id": run.get("task_id"),
        "taste": [taste_public(q) for q in taste],
        "conversation": run.get("conversation") or "main",
        "created_at": run.get("created_at"),
        "updated_at": run.get("updated_at"),
    }


def brief(run: Mapping[str, Any], w: Mapping[str, Any], limit: int = 4000) -> str:
    """The team's brief for ``do`` mode: the owner's answers, the approved spend and how each step is done."""
    values = run.get("values") or {}
    tools = f"the {w['connector']} connector (give it to the worker)" if w.get("connector") else "no connector"
    lines = [
        f"Workflow: {w['name']}, done by the team. Use the {w.get('skill') or 'matching'} skill and {tools}.",
        "The owner's answers (“assumed” = the owner is away and this is the default; they may change it later):",
        *[
            f"- {i['label']}: {(values.get(i['key']) or {}).get('text', '')}"
            + (" (assumed)" if (values.get(i["key"]) or {}).get("assumed") else "")
            for i in w.get("inputs") or []
        ],
    ]
    if not run.get("present"):
        lines.append(
            "The owner is away: build it to the end yourselves, never wait for them. Decide what is unclear with "
            "sensible simple defaults."
        )
    topics = "; ".join(w.get("taste_topics") or []) or "choices the owner may have an opinion on"
    lines.append(
        f"Taste questions: whenever you make a choice the owner may care about ({topics}), ask it with ask_taste "
        "(the question, two to five options, the default you are going with) and carry on with that default at "
        "once. If the owner picks something else, you get a message: change it then."
    )
    if sp := spend(w, values):
        lines.append(f"Spend the owner approved (their authorisation for this campaign, no more): {sp['text']}.")
    lines.append("Steps:")
    lines += [f"{n}. {s['title']}: {fill(s['do'], w, values)}" for n, s in enumerate(w.get("steps") or [], 1)]
    return "\n".join(lines)[:limit]


# ---------- the store ----------
class Runs:
    def __init__(self, table: Table, now: Any = None) -> None:
        self.table = table
        self._now = now

    def _iso(self) -> str:
        return now_iso(self._now() if self._now else None)

    def today(self) -> date:
        n = self._now() if self._now else datetime.now().astimezone()
        return n.date() if isinstance(n, datetime) else date.today()

    async def get(self, id: str) -> Record | None:
        return await self.table.get(PK, id) if re.fullmatch(r"wf-[\w-]{1,40}", id or "") else None

    async def list(self) -> list[Record]:
        rows = await self.table.query(PK)
        return sorted(rows, key=lambda r: str(r.get("created_at", "")), reverse=True)

    async def live_in(self, conversation: str) -> Record | None:
        """The newest live run in this conversation (the one the owner's next words are about)."""
        return next(
            (r for r in await self.list() if r.get("conversation") == conversation and r.get("status") in LIVE), None
        )

    async def create(self, w: Mapping[str, Any], conversation: str, owner_words: str, values: dict[str, Record],
                     mode: str | None, present: bool | None = None) -> Record:  # fmt: skip
        """``present``: the owner is here to decide (ask every input, confirm before the team starts); None = the
        workflow's own default (``away_by_default``: apps are built while the owner is away)."""
        at = self._iso()
        if len(modes_of(w)) == 1:
            mode = modes_of(w)[0]
        here = (not w.get("away_by_default")) if present is None else present
        for inp in w.get("inputs") or []:  # "build me an app where…": the owner's sentence is the idea
            if inp.get("from_words") and inp["key"] not in values and str(owner_words or "").strip():
                values = {**values, inp["key"]: {"text": " ".join(str(owner_words).split())[:MAX_TEXT]}}
        rec: Record = {
            "id": new_id("wf"),
            "workflow_id": w["id"],
            "conversation": conversation,
            "status": "active",
            "mode": mode if mode in MODES else None,
            "present": here,
            "values": assume_defaults(w, values, here),
            "asked": [],
            "step": 0,
            "owner_words": " ".join(str(owner_words or "").split())[:500],
            "created_at": at,
            "updated_at": at,
        }
        await self.table.put({"pk": PK, "sk": rec["id"], **rec})
        return rec

    async def update(self, id: str, patch: Mapping[str, Any]) -> Record | None:
        r = await self.table.update(PK, id, UpdateOptions(set={**patch, "updated_at": self._iso()}, must_exist=True))
        return {k: v for k, v in r.items() if k not in ("pk", "sk")} if r else None


def strip(r: Mapping[str, Any]) -> Record:
    return {k: v for k, v in r.items() if k not in ("pk", "sk")}


# ---------- changing a run (VAIC's tools and the HUD's routes share these) ----------
async def set_values(runs: Runs, run: Record, w: Mapping[str, Any], raw: Mapping[str, Any]) -> tuple[Record, list[str]]:
    """Reads the owner's words for each named input; returns the run and one plain sentence per answer that could
    not be read (that input stays missing)."""
    inputs = _inputs(w)
    values = dict(run.get("values") or {})
    problems: list[str] = []
    for k, said in raw.items():
        inp = inputs.get(str(k))
        if inp is None:
            problems.append(f"{k} is not part of the {w['name']} workflow.")
            continue
        try:
            values[str(k)] = parse_answer(inp, str(said), runs.today())
        except Invalid as e:
            problems.append(f"{inp['label']}: {e}")
    if values != (run.get("values") or {}):
        run = await runs.update(run["id"], {"values": values}) or run
    return run, problems


async def set_mode(runs: Runs, run: Record, mode: str) -> Record:
    if mode not in MODES:
        raise Invalid("The mode is guide (walk me through it) or do (do it for me).")
    if run.get("status") == "running":
        raise Invalid("The team is already doing it.")
    return await runs.update(run["id"], {"mode": mode}) or run


async def move(runs: Runs, run: Record, w: Mapping[str, Any], to: str) -> Record:
    """Guide mode's pages: next, back or done (done = the last page is finished)."""
    if run.get("status") != "active" or run.get("mode") != "guide":
        raise Invalid("Only a walkthrough has pages.")
    n = len(w.get("steps") or [])
    i = int(run.get("step") or 0)
    if to == "back":
        return await runs.update(run["id"], {"step": max(0, i - 1)}) or run
    if to not in ("next", "done"):
        raise Invalid("Say next, back or done.")
    if i >= n - 1:
        return await runs.update(run["id"], {"status": "done", "step": n}) or run
    return await runs.update(run["id"], {"step": i + 1}) or run


async def cancel(runs: Runs, run: Record) -> Record:
    if run.get("status") not in LIVE:
        return run
    return await runs.update(run["id"], {"status": "cancelled"}) or run


async def mark_asked(runs: Runs, run: Record, key: str) -> Record:
    asked = list(run.get("asked") or [])
    if key in asked:
        return run
    return await runs.update(run["id"], {"asked": [*asked, key]}) or run


# ---------- what VAIC is told each turn ----------
def match_line(text: str, conn_of: Mapping[str, Mapping[str, Any]]) -> str | None:
    """One line for VAIC's prompt when the owner's words point at a workflow (``conn_of``: workflow id → connector
    info)."""
    found = recognise(text)
    if not found:
        return None
    if len(found) > 1 and not found[0]["direct"]:
        names = " or ".join(f"the {f['name']} workflow" for f in found)
        return (
            f"Workflow: the owner's words may mean {names}. Ask which, with offer_choices, and start nothing until "
            "they pick one (then start_workflow with owner_confirmed=true)."
        )
    f = found[0]
    conn = conn_of.get(f["id"]) or {}
    state = f"{conn.get('label')} is {'connected' if conn.get('connected') else 'not connected yet'}"
    if f["direct"]:
        return (
            f"Workflow: the owner asked for the {f['name']} workflow [{f['id']}] ({state}). Start it now with "
            "start_workflow (pass owner_words, and values for anything they already said); don't ask whether they "
            "mean it."
        )
    return (
        f"Workflow: the owner's words may mean the {f['name']} workflow [{f['id']}] ({state}). Ask exactly “Is this "
        f'what you mean, Sir: the {f["name"]} workflow?” with offer_choices ["Yes", "No"], and start nothing '
        "until they say yes (then start_workflow with owner_confirmed=true)."
    )


def run_line(run: Mapping[str, Any], w: Mapping[str, Any], conn: Mapping[str, Any]) -> str:
    """The live run in this conversation, for VAIC's prompt: what is known and the one next thing."""
    values = run.get("values") or {}
    known = "; ".join(f"{i['label']}: {values[i['key']]['text']}" for i in w.get("inputs") or [] if i["key"] in values)
    need = next_need(run, w, bool(conn.get("connected")))
    mode = {"guide": "walking the owner through it", "do": "doing it for the owner"}.get(str(run.get("mode")), "")
    line = f"Workflow in progress: {w['name']} [{run['id']}]" + (f", {mode}" if mode else "") + "."
    if known:
        line += f" Already known (never ask these again): {known}."
    if need["kind"] == "input":
        line += (
            f" Waiting for: {need['key']} (“{need['question']}”). If the owner's message answers it, pass their words "
            f'with update_workflow values {{"{need["key"]}": …}}; pass any other answers they gave at the same time.'
        )
    elif need["kind"] == "mode":
        line += " Waiting for: walk through it or do it for them (update_workflow mode guide or do)."
    elif need["kind"] == "confirm":
        line += " Waiting for the owner's yes to create it (run_workflow confirm=true on a clear yes)."
    elif need["kind"] == "step":
        line += f" On page {int(run.get('step') or 0) + 1} of {len(w.get('steps') or [])}: when the owner says it's done, call workflow_step to=next."
    elif need["kind"] == "connect":
        line += f" Waiting for {conn.get('label')} to be connected in {conn.get('where')}."
    elif run.get("status") == "running":
        line += f" The team is doing it as task {run.get('task_id')}."
    return line + " If the owner wants to stop it, cancel_workflow."


# ---------- taste questions (decision 127): asked along the way, never waited on ----------
TASTE = "TASTE"
MAX_TASTE_SHOWN = 20


def taste_public(q: Mapping[str, Any]) -> Record:
    return {k: q.get(k) for k in ("id", "question", "options", "default", "status", "answer", "asked_by", "run_id",
                                  "task_id", "created_at")}  # fmt: skip


class Taste:
    """``TASTE`` / ``<id>``: ``{id, task_id, run_id, conversation, question, options, default, asked_by, status
    (open | answered), answer, created_at, answered_at}``. The work never waits on one: the asker goes on with the
    default, and an answer that differs is sent to whoever can still change it."""

    def __init__(self, table: Table, now: Any = None) -> None:
        self.table = table
        self._now = now

    def _iso(self) -> str:
        return now_iso(self._now() if self._now else None)

    async def add(self, q: Mapping[str, Any]) -> Record:
        options = [" ".join(str(o).split())[:60] for o in q.get("options") or [] if str(o).strip()][:5]
        default = " ".join(str(q.get("default") or "").split())[:120]
        question = " ".join(str(q.get("question") or "").split())[:300]
        if not question or len(options) < 2 or not default:
            raise Invalid("Give the question, two to five options and the default you are going with.")
        if default not in options:
            options = [default, *options][:5]
        rec: Record = {
            "id": new_id("tq"),
            "task_id": q.get("task_id"),
            "run_id": q.get("run_id"),
            "conversation": q.get("conversation") or "main",
            "question": question,
            "options": options,
            "default": default,
            "asked_by": q.get("asked_by") or "vaic",
            "status": "open",
            "created_at": self._iso(),
        }
        await self.table.put({"pk": TASTE, "sk": rec["id"], **rec})
        return rec

    async def get(self, id: str) -> Record | None:
        r = await self.table.get(TASTE, id) if re.fullmatch(r"tq-[\w-]{1,40}", id or "") else None
        return strip(r) if r else None

    async def all(self, open_only: bool = False) -> list[Record]:
        rows = [strip(r) for r in await self.table.query(TASTE)]
        rows.sort(key=lambda r: str(r.get("created_at", "")), reverse=True)
        return [r for r in rows if r.get("status") == "open"] if open_only else rows

    async def of_run(self, run_id: str) -> list[Record]:
        return [r for r in await self.all() if r.get("run_id") == run_id][:MAX_TASTE_SHOWN]

    async def answer(self, id: str, answer: str) -> Record | None:
        """None when it doesn't exist or was already answered."""
        a = " ".join(str(answer or "").split())[:300]
        if not a:
            raise Invalid("Say the answer.")
        try:
            r = await self.table.update(
                TASTE,
                id,
                UpdateOptions(
                    set={"status": "answered", "answer": a, "answered_at": self._iso()},
                    must_exist=True,
                    expect={"status": "open"},
                ),
            )
        except Exception:
            return None
        return strip(r) if r else None


def same_choice(a: str, b: str) -> bool:
    return norm(a) == norm(b)


def taste_line(open_qs: Sequence[Mapping[str, Any]]) -> str | None:
    """For VAIC's prompt: the open taste questions, so it can raise them while the owner is talking to it."""
    if not open_qs:
        return None
    shown = "; ".join(
        f"[{q['id']}] “{q['question']}” (going with “{q['default']}”; options: {', '.join(q.get('options') or [])})"
        for q in open_qs[:5]
    )
    more = f" and {len(open_qs) - 5} more" if len(open_qs) > 5 else ""
    return (
        f"Taste questions from the work in progress (nothing waits on them): {shown}{more}. When the owner is "
        "talking with you and it fits, ask one at a time, saying what the team went with; pass their answer with "
        "answer_taste."
    )
