"""The policy gate, ported from upstream ``city/src/policy.ts``.

Called before every tool call of every agent. Workers are held by it too (``policy_applies_to_workers``,
default true).
"""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from functools import cache
from typing import Any, Literal

from .config import policy_config

Decision = Literal["allow", "ask", "deny"]


def load_policy() -> dict[str, Any]:
    return policy_config()


def sorted_json(value: Any) -> str:
    """Same text the upstream hook matched: JSON with sorted keys and ``", "`` / ``": "`` separators."""
    if isinstance(value, list | tuple):
        return "[" + ", ".join(sorted_json(v) for v in value) + "]"
    if isinstance(value, Mapping):
        return (
            "{"
            + ", ".join(f"{json.dumps(k, ensure_ascii=False)}: {sorted_json(value[k])}" for k in sorted(value))
            + "}"
        )
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return json.dumps(value, ensure_ascii=False)


@cache
def _compile(pattern: str) -> re.Pattern[str]:
    return re.compile(pattern)


def decide(
    tool_name: str, tool_input: Mapping[str, Any], policy: Mapping[str, Any] | None = None
) -> tuple[Decision, str]:
    pol = policy or load_policy()
    blob = sorted_json(tool_input)
    found: tuple[Decision, str] = ("allow", "")
    for r in pol["rules"]:
        if _compile(r["tool"]).search(tool_name) and _compile(r["match"]).search(blob):
            if r["decision"] == "deny":
                return ("deny", r["reason"])
            found = ("ask", r["reason"])
    return found


def action_hash(tool_name: str, tool_input: Mapping[str, Any]) -> str:
    """Hash that binds an owner approval to one exact call."""
    return hashlib.sha256(f"{tool_name}\n{sorted_json(tool_input)}".encode()).hexdigest()


@dataclass(frozen=True)
class NeedsApproval:
    hash: str
    reason: str
    kind: str = "tool"
    """``ad.spend`` for the owner's ad spend limit: only the owner answers it (decision 240)."""


@dataclass(frozen=True)
class GateResult:
    decision: Literal["allow", "deny"]
    reason: str
    needs_approval: NeedsApproval | None = None
    """Set when the call needs the owner: the caller files an approval bound to this hash."""


ConsumeApproval = Callable[[str], Awaitable[bool]]


async def gate(
    tool_name: str,
    tool_input: Mapping[str, Any],
    role: str,
    agent_id: str,
    consume_approval: ConsumeApproval | None = None,
    policy: Mapping[str, Any] | None = None,
    spend_ask: str | None = None,
) -> GateResult:
    """The gate as the runtime uses it: "ask" becomes deny-until-approved, bound to the exact action. Since
    decision 237 no rule asks (connectors have no approval level, there is no ad budget cap), so a call is
    allowed or denied; the "ask" path stays for a rule the owner may add to the policy file.

    ``spend_ask`` (from ``ad_spend.spend_ask``) is the one gate left, decision 240: a call that plans more ad
    spend than the owner's limit waits for the owner's own yes. A deny in the policy file still wins."""
    pol = policy or load_policy()
    if role == "worker" and not pol.get("policy_applies_to_workers", True) and not spend_ask:
        return GateResult("allow", "policy off for workers")
    d, reason = decide(tool_name, tool_input, pol)
    kind = "tool"
    if d == "allow" and spend_ask:
        d, reason, kind = "ask", spend_ask, "ad.spend"
    if d == "allow":
        return GateResult("allow", "")
    if d == "deny":
        return GateResult("deny", reason)
    h = action_hash(tool_name, tool_input)
    if consume_approval and await consume_approval(h):
        return GateResult("allow", f"approved by the owner: {reason}")
    if kind == "ad.spend":
        return GateResult(
            "deny",
            f"Over the owner's ad spend limit: {reason} The city asked the owner to confirm in the chat; don't ask "
            "again with ask_owner. Once they confirm, make exactly the same call again; if they refuse, don't start it.",
            NeedsApproval(h, reason, kind),
        )
    return GateResult(
        "deny",
        f"Needs the owner's approval: {reason} Ask for it with ask_owner; the exact action will be approved or refused.",
        NeedsApproval(h, reason),
    )
