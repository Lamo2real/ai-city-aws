"""VAIC asks before it uses a connector in the owner's chat, like Claude's "wants to use … from …" card (decision 265).

On a turn that is the owner's own message, a connector tool call is not run: it is kept (``VAIC_CONN_ASK``, one per
conversation) and the chat shows a card with the tool, the service (a dropdown of the other connected services that
offer the same kind of tool), the inputs and the description, with Decline / Allow once / Always allow. The owner's
answer comes back as their next message (a tap, typed or spoken, like decision 206's Yes / No), and
``connector_permission`` runs the kept call, remembers "always" on the connector record (``always_allow``, listed and
editable in Settings → Connectors), or tells VAIC to do it another way.

When the owner says not to use connectors ("do it without any connectors", "don't use Descript"), those tools are
left out of VAIC's turns for ``NO_CONNECTORS_MINUTES`` (``VAIC_NO_CONN``): VAIC can't ask, and works another way (the
browser). A decline does the same for that one service. Agents and VAIC's turns that aren't the owner's message
(reports, results) never ask: decision 237 removed approval gates for autonomous work, and this card doesn't bring
them back.
"""

from __future__ import annotations

import json
import re
from collections.abc import Mapping
from dataclasses import replace
from datetime import timedelta
from typing import Any

from vaic.shared.ad_spend import spend_ask
from vaic.shared.connectors import GATEWAY_SERVER, SEP, ConnectorStore, Record
from vaic.shared.events import now_iso
from vaic.shared.hierarchy.actions import CityDeps
from vaic.shared.log import log
from vaic.shared.policy import gate

from .tools import ToolSpec, TurnCtx, _obj, _s, file_approval

ASK_PK = "VAIC_CONN_ASK"
"""The connector call waiting for the owner's answer, one per conversation (sk = the conversation)."""
NO_PK = "VAIC_NO_CONN"
"""Connectors the owner said not to use in this conversation: ``all`` and ``ids``, until ``until``."""
NO_CONNECTORS_MINUTES = 30
ANSWERS = ("allow_once", "always", "decline")
OPTIONS = ["Allow once", "Always allow", "Decline"]
_STOP = {
    "a", "an", "the", "and", "or", "of", "for", "to", "from", "by", "with", "in", "on", "get", "list", "run", "do",
    "new", "tool", "my", "your", "v1", "v2", "api", "mcp",
}  # fmt: skip
_NO_WORDS = r"(?:without|no|not|never|skip|avoid|don'?t|do\s+not|dont|stop)"
_ALL = re.compile(
    rf"\b{_NO_WORDS}\s+(?:\w+\s+){{0,3}}?(?:any\s+|the\s+|my\s+|your\s+)?(?:connectors?|integrations?|connected\s+(?:apps|services))\b",
    re.I,
)
_ALL_BACK = re.compile(
    r"\b(?:you\s+can|go\s+ahead\s+and|feel\s+free\s+to|ok(?:ay)?\s+to|please)?\s*use\s+(?:the\s+|my\s+|any\s+)?connectors?"
    r"(?:\s+again)?\b",
    re.I,
)


def _words(text: str) -> list[str]:
    spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)
    return [w for w in re.split(r"[^a-z0-9]+", spaced.lower()) if w and w not in _STOP]


def tool_title(name: str, listed: Mapping[str, Any] | None = None) -> str:
    """The tool's own title (MCP ``title`` or ``annotations.title``), else its name in words."""
    t = listed or {}
    title = t.get("title") or (t.get("annotations") or {}).get("title")
    if title:
        return str(title)[:80]
    words = re.sub(r"([a-z])([A-Z])", r"\1 \2", name).replace("_", " ").replace("-", " ").split()
    return " ".join(words).capitalize()[:80] or name


def similar(a: str, b: str) -> bool:
    """Two tools that do the same kind of thing: the same first word ("transcribe_…"), or most words shared."""
    wa, wb = _words(a), _words(b)
    if not wa or not wb:
        return False
    if wa[0] == wb[0]:
        return True
    sa, sb = set(wa), set(wb)
    return len(sa & sb) / len(sa | sb) >= 0.5


def _split(gname: str) -> tuple[str, str]:
    cid, _, tool = gname.partition(SEP)
    return cid, tool


def _label(text: str) -> str:
    return re.sub(r"\s*\(.*\)\s*$", "", text).strip()


def _mentions(text: str, rec: Record) -> list[re.Match[str]]:
    names = {str(rec["id"]).replace("-", " "), _label(str(rec.get("label") or ""))}
    found: list[re.Match[str]] = []
    for n in names:
        if len(n) >= 3:
            found += re.finditer(rf"\b{re.escape(n)}\b", text, re.I)
    return found


def _negated(text: str, m: re.Match[str]) -> bool:
    before = text[max(0, m.start() - 40) : m.start()]
    return re.search(rf"\b{_NO_WORDS}\b(?:\s+\w+){{0,3}}\s*$", before, re.I) is not None


async def no_connectors(d: CityDeps, conv: str, message: str, records: list[Record]) -> dict[str, Any]:
    """Reads and updates what the owner said not to use: ``{"all": bool, "ids": [..]}``, for this conversation.

    "without any connectors" / "don't use connectors" → all; "don't use Descript" → that one; "use connectors again"
    or naming a service without a no → back on."""
    row = await d.ledger.table.get(NO_PK, conv) or {}
    now = d.ledger.now()
    live = bool(row) and str(row.get("until", "")) > now_iso(now)
    every, ids = (bool(row.get("all")), set(row.get("ids") or [])) if live else (False, set())
    changed = False
    if message:
        if _ALL.search(message):
            every, changed = True, True
        elif _ALL_BACK.search(message) and not re.search(
            rf"\b{_NO_WORDS}\s+use\s+(?:the\s+|my\s+|any\s+)?connectors?", message, re.I
        ):
            every, ids, changed = False, set(), True
        for rec in records:
            hits = _mentions(message, rec)
            if not hits:
                continue
            if any(_negated(message, m) for m in hits):
                ids.add(rec["id"])
            else:
                ids.discard(rec["id"])
                every = False if not _ALL.search(message) else every
            changed = True
    if changed:
        if every or ids:
            until = now_iso(now + timedelta(minutes=NO_CONNECTORS_MINUTES))
            await d.ledger.table.put({"pk": NO_PK, "sk": conv, "all": every, "ids": sorted(ids), "until": until})
        elif row:
            await d.ledger.table.delete(NO_PK, conv)
    return {"all": every, "ids": sorted(ids)}


async def _avoid(d: CityDeps, conv: str, id: str) -> None:
    row = await d.ledger.table.get(NO_PK, conv) or {}
    live = bool(row) and str(row.get("until", "")) > now_iso(d.ledger.now())
    ids = set(row.get("ids") or []) if live else set()
    ids.add(id)
    until = now_iso(d.ledger.now() + timedelta(minutes=NO_CONNECTORS_MINUTES))
    await d.ledger.table.put(
        {"pk": NO_PK, "sk": conv, "all": bool(row.get("all")) and live, "ids": sorted(ids), "until": until}
    )


def _inputs(args: Mapping[str, Any]) -> list[list[str]]:
    out: list[list[str]] = []
    for k, v in list(args.items())[:12]:
        shown = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
        out.append([tool_title(str(k)), " ".join(str(shown).split())[:300]])
    return out


def owner_connector_tools(
    d: CityDeps,
    c: TurnCtx,
    tools: list[ToolSpec],
    records: list[Record],
    listed: Mapping[str, Mapping[str, Any]],
    avoid: Mapping[str, Any],
) -> list[ToolSpec]:
    """VAIC's tools for this turn: connector tools the owner said not to use are left out; on the owner's own message
    the rest ask first (unless always allowed), and ``connector_permission`` is added."""
    if c.role != "vaic":
        return tools
    skip = set(avoid.get("ids") or [])
    kept = [t for t in tools if t.server != GATEWAY_SERVER or (not avoid.get("all") and _split(t.name)[0] not in skip)]
    if not c.from_owner:
        return kept
    conv = c.conversation or "main"
    by_id = {str(r["id"]): r for r in records}
    connectors = [t for t in kept if t.server == GATEWAY_SERVER]
    real = {t.name: t for t in connectors}
    staged_now: list[str] = []
    allowed_now: set[str] = set()
    """Tools the owner allowed for this turn (a switch to another service in the dropdown)."""

    def card(t: ToolSpec, args: Mapping[str, Any]) -> dict[str, Any]:
        cid, tool = _split(t.name)
        rec = by_id.get(cid) or {"id": cid}
        mcp = listed.get(t.name) or {}
        props = dict((t.schema or {}).get("properties") or {})
        choices = [{"id": cid, "label": str(rec.get("label") or cid), "tool": tool}]
        for o in connectors:
            oid, otool = _split(o.name)
            if oid != cid and similar(tool, otool) and all(x["id"] != oid for x in choices):
                choices.append({"id": oid, "label": str((by_id.get(oid) or {}).get("label") or oid), "tool": otool})
        description = str(mcp.get("description") or "")
        if not description:
            description = re.sub(r"^\[[^\]]*\]\s*", "", t.description)
        return {
            "tool": tool,
            "title": tool_title(tool, mcp),
            "connector": cid,
            "label": str(rec.get("label") or cid),
            "inputs": _inputs(args),
            "description": description[:2000],
            "params": list(props)[:40],
            "schema": json.dumps(t.schema, ensure_ascii=False)[:6000],
            "choices": choices[:8],
        }

    def wrap(t: ToolSpec) -> ToolSpec:
        cid, tool = _split(t.name)

        async def ask_first(args: dict[str, Any]) -> str:
            rec = by_id.get(cid) or {}
            if tool in (rec.get("always_allow") or []) or t.name in allowed_now:
                return await t.handler(args)
            p = card(t, args)
            pid = f"perm-{d.ledger.now_ms()}"
            await d.ledger.table.put(
                {
                    "pk": ASK_PK,
                    "sk": conv,
                    "id": pid,
                    "tool": t.name,
                    "args_json": json.dumps(args, ensure_ascii=False),
                    "choices": p["choices"],
                    "at": now_iso(d.ledger.now()),
                }
            )
            staged_now.append(pid)
            await d.bus.put(
                {
                    "type": "vaic.question",
                    "conversation": conv,
                    "question": f"Vice wants to use {p['title']} from {p['label']}",
                    "options": OPTIONS,
                    "id": pid,
                    "title": p["title"],
                    "permission": p,
                }
            )
            others = ", ".join(x["label"] for x in p["choices"][1:])
            return (
                f"Waiting for the owner's OK, NOT run yet: {p['title']} from {p['label']}. Their screen shows it with "
                "Allow once / Always allow / Decline"
                + (f" and a choice of service ({others})" if others else "")
                + ". Say in one short sentence what you want to use it for and stop. When their next message answers "
                "(a tap, typed or spoken), call connector_permission. Don't call any other connector meanwhile."
            )

        return replace(t, handler=ask_first)

    async def permission(a: dict[str, Any]) -> str:
        row = await d.ledger.table.get(ASK_PK, conv)
        if not row:
            return "No connector call is waiting for the owner. Just carry on."
        if row["id"] in staged_now:
            return "You asked in this same turn: the owner answers in their next message. Stop and wait."
        answer = str(a.get("answer") or "")
        if answer not in ANSWERS:
            return "answer is allow_once, always or decline."
        await d.ledger.table.delete(ASK_PK, conv)
        gname = str(row["tool"])
        cid, tool = _split(gname)
        choices: list[dict[str, Any]] = list(row.get("choices") or [])
        pick = str(a.get("connector") or cid)
        chosen = next((x for x in choices if x["id"] == pick or _label(x["label"]).lower() == pick.lower()), None)
        chosen = chosen or {"id": cid, "label": cid, "tool": tool}
        settle = {"type": "vaic.change", "conversation": conv, "id": row["id"], "saved": answer != "decline"}
        if answer == "decline":
            await _avoid(d, conv, cid)
            await d.bus.put(settle)
            label = next((x["label"] for x in choices if x["id"] == cid), cid)
            return (
                f"The owner declined {label}. Don't use it for this; do the job another way (the browser, your own "
                "knowledge, or another connected service the owner didn't decline) and say how in one short sentence."
            )
        target = f"{chosen['id']}{SEP}{chosen['tool']}"
        if answer == "always":
            store = ConnectorStore(d.ledger.table, d.ledger.now)
            rec = await store.get(chosen["id"])
            if rec is not None:
                have = list(rec.get("always_allow") or [])
                if chosen["tool"] not in have:
                    await store.update(chosen["id"], {"always_allow": [*have, chosen["tool"]]})
                    by_id[chosen["id"]] = {**rec, "always_allow": [*have, chosen["tool"]]}
        await d.bus.put(settle)
        spec = real.get(target)
        if spec is None:
            return f"{chosen['label']} isn't available on this turn any more. Tell the owner in one short sentence."
        if target != gname:
            # Another service's tool takes its own inputs: VAIC makes that call itself, allowed for this turn.
            allowed_now.add(target)
            return (
                f"The owner chose {chosen['label']} instead. Call {target} now with the inputs it takes for the same job; "
                "it's allowed."
            )
        try:
            args = json.loads(str(row.get("args_json") or "{}"))
        except ValueError:
            args = {}
        # The kept call passes the policy gate (and the ad spend limit) under its own name, like any connector call.
        ask = await spend_ask(d.ledger.table, spec.full_name, args, d.ledger.now())
        r = await gate(
            spec.full_name, args, c.role, c.agent_id, consume_approval=d.ledger.consume_approval, spend_ask=ask
        )
        await d.ledger.audit_tool(c.agent_id, spec.full_name, r.decision, r.reason)
        if r.needs_approval:
            n = r.needs_approval
            await file_approval(d, c, spec.full_name, args, n.hash, n.reason, kind=n.kind)
        if r.decision != "allow":
            return f"Denied by policy: {r.reason}"
        log("info", "vaic.connector_allowed", tool=gname, answer=answer)
        return await spec.handler(args)

    out = [wrap(t) if t.server == GATEWAY_SERVER else t for t in kept]
    out.append(
        ToolSpec(
            "connector_permission",
            'The owner\'s answer to the connector card you showed ("Vice wants to use … from …"), from their new '
            "message: allow_once for 'Allow once' / yes / go ahead; always for 'Always allow'; decline for 'Decline' / "
            "no / don't. connector: the service they picked in the card's list (their message then says 'use <name>'); "
            "leave it out otherwise. Allowed calls run at once and return their result. Never in the turn you asked.",
            _obj({"answer": {"type": "string", "enum": list(ANSWERS)}, "connector": _s(1, 60)}, ("connector",)),
            permission,
            step=lambda a: {"decline": "Leaving that service out"}.get(
                str(a.get("answer")), "Using the service you allowed"
            ),
        )
    )
    return out
