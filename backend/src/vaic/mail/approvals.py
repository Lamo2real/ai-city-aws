"""Mail and calendar actions an app proposes (``docs/MAIL_CALENDAR.md`` §11, ``docs/APPS.md``).

An app can't act: the api files a normal approval with the §5.5 preview, bound to ``policy.action_hash`` of the
exact call. Only when the owner approves does ``execute`` run the same action function the tool uses, exactly
once (it consumes ``APPROVED#<hash>``). Standing rules never apply to app proposals."""

from __future__ import annotations

from typing import Any

from vaic.shared.ledger import Ledger
from vaic.shared.policy import action_hash, decide

from . import preview
from .actions import ACTIONS
from .service import MailError, MailService

PROPOSABLE = ("mcp__city__calendar_respond", "mcp__city__calendar_create", "mcp__city__mail_draft")


def _name(tool: str) -> str:
    if tool not in PROPOSABLE:
        raise MailError(f"Apps can't propose {tool}.")
    return tool.rsplit("__", 1)[-1]


async def file(
    ledger: Ledger, service: MailService, tool: str, args: dict[str, Any], requested_by: str
) -> dict[str, Any]:
    _name(tool)
    if decide(tool, args)[0] == "deny":
        raise MailError("The policy doesn't allow that.")
    h = action_hash(tool, args)
    rec = {
        "agent": requested_by,
        "ticket_id": None,
        "tool": tool,
        "action": f"{tool} (proposed by {requested_by})",
        "hash": h,
        "reason": "An app proposed this; it runs only if you approve.",
        "kind": "mail.proposal",
        "args": args,
        "requested_by": requested_by,
        "preview": await preview.build(service, tool, args),
    }
    return await ledger.request_approval(rec)


async def execute(ledger: Ledger, service: MailService, approval: dict[str, Any]) -> dict[str, Any]:
    """Runs an owner-approved proposal once. Raises MailError when it can't."""
    tool = str(approval.get("tool", ""))
    name = _name(tool)
    args = dict(approval.get("args") or {})
    if decide(tool, args)[0] == "deny":
        raise MailError("The policy doesn't allow that.")
    if approval.get("hash") != action_hash(tool, args):
        raise MailError("That approval doesn't match the proposed action.")
    if not await ledger.consume_approval(str(approval["hash"])):
        raise MailError("That approval was already used, or isn't approved.")
    return {"ok": True, "result": await ACTIONS[name](service, args)}
