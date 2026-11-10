"""Consulting the executives (decision 140): VAIC's ``ask_executive`` and the Orchestrator's ``ask_executives``.

Both return advice as the tool's answer; neither starts work. VAIC asks only on the owner's own message ("ask the
CFO if this pays off"); the Orchestrator asks on big or cross-department decisions (its prompt says when).
"""

from __future__ import annotations

from typing import Any

from vaic.shared import executives as ex
from vaic.shared.hierarchy.actions import CityDeps
from vaic.shared.knowledge.search import search

from .tools import ToolSpec, TurnCtx, _obj, _s

_WHO = {"type": "array", "items": {"type": "string", "enum": list(ex.ORDER)}, "maxItems": 4}


def exec_deps(d: CityDeps) -> ex.ExecDeps | None:
    if d.advisor_runner is None:
        return None
    k = d.knowledge

    async def knowledge(q: str) -> str:
        if not k or not k.kb:
            return "The knowledge base isn't set up."
        return (await search(k.kb, k.store, q, 5, False, cache=k.cache)).text()

    return ex.ExecDeps(
        ledger=d.ledger, bus=d.bus, runner=d.advisor_runner, settings=d.settings, knowledge=knowledge if k else None
    )


def executive_tools(d: CityDeps, c: TurnCtx) -> list[ToolSpec]:
    if c.role not in ("vaic", "orchestrator"):
        return []
    deps = exec_deps(d)
    if deps is None:
        return []

    async def ask(a: dict[str, Any]) -> str:
        if c.role == "vaic" and not c.from_owner:  # decision 138: executives speak when the owner asks
            return (
                "Only the owner's own message can ask the executives (decision 138). Tell the owner you can ask "
                "them if they want."
            )
        who = [str(w) for w in a.get("who") or []]
        out = await ex.consult(
            deps,
            str(a["question"]),
            who,
            "owner" if c.role == "vaic" else "orchestrator",
            ticket_id=c.task_id if c.role == "orchestrator" else None,
        )
        return ex.advice_text(out)

    if c.role == "vaic":
        return [
            ToolSpec(
                "ask_executive",
                'Only when the owner asks for an executive\'s view ("ask the CFO if this pays off", "what does the CTO '
                'think", "what would the CEO say"). question: what the owner wants judged, with the facts they gave; '
                "who: the executives they named (ceo, coo, cfo, cto), or leave it out to pick by subject. Returns "
                "advice with its sources; pass it on in a few plain sentences. It never starts work: if the owner "
                "then wants something done, that is a normal request to the Orchestrator.",
                _obj({"question": _s(3, ex.MAX_QUESTION), "who": _WHO}, ("who",)),
                ask,
                step=lambda a: "Asking the executives",
            )
        ]
    return [
        ToolSpec(
            "ask_executives",
            "Advice from the executives (CEO strategy, COO operations, CFO money, CTO technology) before a big or "
            "cross-department decision: a new project or product, a large spend, an infrastructure or architecture "
            "change, or work that crosses several departments. Not for routine work. question: the decision and "
            "the facts; who: only the executives who add value (ceo, coo, cfo, cto), or leave it out to pick by "
            "subject. It is advice only: you still decide and assign; executives never assign or start work.",
            _obj({"question": _s(3, ex.MAX_QUESTION), "who": _WHO}, ("who",)),
            ask,
            step=lambda a: "Asking the executives",
        )
    ]
