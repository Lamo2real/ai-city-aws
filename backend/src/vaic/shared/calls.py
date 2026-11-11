"""VAIC calls the owner (decision 245): one call, and a message only when it isn't answered.

The owner's words (2026-11-11): "call me … and if I don't answer when it calls, then it should send a message. So
call once, and then send message if I don't answer. But if I answer, don't send a message." All on AWS: the call is
a PushKit VoIP push through SNS to the AI City iPhone app, which rings as a real incoming call (CallKit, also when
locked). Answering opens VAIC's real-time voice (Nova Sonic, decision 120) with the reason it called; VAIC itself
decides and acts. Not answered (declined, or nothing after ``RING_S``) → one ordinary push with Yes / No buttons.

What calls: an ``ad.spend`` approval (the owner's ad spend limit, decision 240, the one gate left) and the owner's
own "Vice, call me" (``call.requested``). The notifier Lambda places the call; the app reports answered, missed and
ended through ``/calls/{id}/...``. Each move is a conditional write on the call's state, so a call is answered or
messaged exactly once, whoever reports first (the phone, or the notifier's own ring timeout).

Rows: ``CALL#<id>`` / ``META`` with the reason, the approval it is about, the state (ringing → answered → ended,
or ringing → missed → messaged) and a TTL. No phone number exists anywhere: the city rings the owner's own app.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from .events import now_iso
from .ids import new_id
from .log import log
from .push import DeviceStore, PushApps
from .table import Item, Table, UpdateOptions

PREFIX = "CALL#"
RING_S = 45.0
"""How long the notifier waits for the phone before it sends the message itself (the app gives up after 30 s)."""
POLL_S = 3.0
KEEP_S = 7 * 86_400
CATEGORY = "VAIC_DECIDE"
"""The iPhone notification category with the Yes / No buttons (they answer the approval)."""
STATES = ("ringing", "answered", "ended", "missed", "messaged")


@dataclass
class CallDeps:
    table: Table
    now: Callable[[], datetime]
    devices: DeviceStore
    sns: Any
    apps: PushApps
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep


def short(text: str, n: int = 180) -> str:
    t = " ".join(str(text or "").split())
    return t if len(t) <= n else t[: n - 1].rstrip() + "…"


class Calls:
    def __init__(self, table: Table, now: Callable[[], datetime]) -> None:
        self.table = table
        self.now = now

    async def create(self, reason: str, approval: str = "") -> Item:
        at = self.now()
        item: Item = {
            "pk": f"{PREFIX}{new_id('call')}",
            "sk": "META",
            "reason": short(reason, 300),
            "approval": approval,
            "state": "ringing",
            "created_at": now_iso(at),
            "ttl": int(at.timestamp()) + KEEP_S,
        }
        item["id"] = item["pk"][len(PREFIX) :]
        await self.table.put(item)
        return item

    async def get(self, id: str) -> Item | None:
        return await self.table.get(f"{PREFIX}{id}", "META")

    async def move(self, id: str, frm: str, to: str) -> Item | None:
        """``frm`` → ``to`` when the call is still in ``frm``; None when someone else moved it first (or no call)."""
        return await self.table.update(
            f"{PREFIX}{id}",
            "META",
            UpdateOptions(set={"state": to, f"{to}_at": now_iso(self.now())}, must_exist=True, expect={"state": frm}),
        )


def public(call: Item) -> Item:
    return {k: call[k] for k in ("id", "reason", "approval", "state", "created_at") if k in call}


async def send_message(d: CallDeps, call: Item) -> bool:
    """The missed call's message, once: Yes / No buttons when it is about an approval."""
    moved = await Calls(d.table, d.now).move(call["id"], "missed", "messaged")
    if moved is None:
        return False
    approval = str(call.get("approval") or "")
    body = call["reason"] + (" Yes or No?" if approval else "")
    counts = await d.devices.push_all(
        d.sns,
        "Vice called you",
        body,
        {"vaic_call": {"id": call["id"], "approval": approval}},
        CATEGORY if approval else "",
    )
    log("info", "call.messaged", call=call["id"], **counts)
    return True


async def missed(d: CallDeps, id: str) -> bool:
    """Declined or unanswered (the phone, or the ring timeout): the message goes out; False when it was answered."""
    calls = Calls(d.table, d.now)
    call = await calls.move(id, "ringing", "missed")
    if call is None:
        cur = await calls.get(id)
        if cur and cur.get("state") == "missed":  # a message that failed to go out before: try once more
            return await send_message(d, cur)
        return False
    log("info", "call.missed", call=id)
    return await send_message(d, call)


async def place(d: CallDeps, reason: str, approval: str = "") -> Item:
    """Rings the owner's iPhone; waits up to ``RING_S`` for an answer; no answer → the message."""
    calls = Calls(d.table, d.now)
    call = await calls.create(reason, approval)
    data = {"vaic_call": {"id": call["id"], "reason": call["reason"], "approval": approval}}
    rung = await d.devices.ring(d.sns, data) if d.apps.voip or d.apps.voip_sandbox else {"sent": 0}
    log("info", "call.placed", call=call["id"], approval=approval, **rung)
    if not rung.get("sent"):
        await missed(d, call["id"])  # no phone can ring (no VoIP token yet): the message goes out at once
        return await calls.get(call["id"]) or call
    waited = 0.0
    while waited < RING_S:
        await d.sleep(POLL_S)
        waited += POLL_S
        cur = await calls.get(call["id"])
        if not cur or cur.get("state") != "ringing":
            return cur or call
    await missed(d, call["id"])
    return await calls.get(call["id"]) or call


def reason_for(event: dict[str, Any]) -> tuple[str, str] | None:
    """(reason, approval id) for an event that calls the owner; None for anything else."""
    t = event.get("type")
    if t == "approval.requested" and event.get("kind") == "ad.spend":
        return short(str(event.get("reason") or event.get("action") or "An ad campaign needs your yes.")), str(
            event.get("id") or ""
        )
    if t == "call.requested":
        return short(str(event.get("reason") or "You asked me to call you.")), str(event.get("approval") or "")
    return None
