"""Standing rules: the owner's exceptions for named safe cases (``docs/MAIL_CALENDAR.md`` §5.3).

Rows ``MAIL`` / ``RULE#<id>``. Only the API writes them; a rule only *answers* the gate's "ask" for one exact
action and is audited. ``send_to``: a send from one account where every recipient is named or under a named
domain. ``accept_from``: accepting an invitation from a named organizer or domain when nothing conflicts."""

from __future__ import annotations

import re
from typing import Any

from aic.shared.events import now_iso
from aic.shared.ids import new_id
from aic.shared.table import Table

PK = "MAIL"
KINDS = ("send_to", "accept_from")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_DOMAIN = re.compile(r"^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$")

Rule = dict[str, Any]


class RuleInvalid(ValueError):
    pass


def check_rule(b: dict[str, Any], account_ids: set[str]) -> Rule:
    kind = b.get("kind")
    if kind not in KINDS:
        raise RuleInvalid("kind must be send_to or accept_from.")
    acc = b.get("account_id")
    if acc not in account_ids:
        raise RuleInvalid("Pick one of your connected accounts.")
    m = b.get("match") or {}
    addrs = [str(x).strip().lower() for x in m.get("addresses") or []]
    doms = [str(x).strip().lower().lstrip("@") for x in m.get("domains") or []]
    if not addrs and not doms:
        raise RuleInvalid("Name at least one address or domain.")
    if bad := [a for a in addrs if not _EMAIL.match(a)]:
        raise RuleInvalid(f"Not an email address: {bad[0][:80]}")
    if bad := [d for d in doms if not _DOMAIN.match(d)]:
        raise RuleInvalid(f"Not a domain: {bad[0][:80]}")
    if len(addrs) + len(doms) > 50:
        raise RuleInvalid("At most 50 addresses and domains per rule.")
    rule: Rule = {"kind": kind, "account_id": acc, "match": {"addresses": addrs, "domains": doms}}
    if b.get("expires_at"):
        rule["expires_at"] = str(b["expires_at"])[:40]
    return rule


def _matches(email: str, rule: Rule) -> bool:
    e = (email or "").strip().lower()
    m = rule.get("match") or {}
    dom = e.rpartition("@")[2]
    return e in m.get("addresses", []) or any(dom == d or dom.endswith("." + d) for d in m.get("domains", []))


class RuleStore:
    def __init__(self, table: Table, now: Any = None) -> None:
        self.table = table
        self.now = now

    def _iso(self) -> str:
        return now_iso(self.now()) if self.now else now_iso()

    async def all(self) -> list[Rule]:
        at = self._iso()
        return [
            {k: v for k, v in r.items() if k not in ("pk", "sk")}
            for r in await self.table.query(PK, "RULE#")
            if not r.get("expires_at") or str(r["expires_at"]) > at
        ]

    async def add(self, rule: Rule) -> Rule:
        r = {**rule, "id": new_id("rule"), "created_at": self._iso()}
        await self.table.put({"pk": PK, "sk": f"RULE#{r['id']}", **r})
        return r

    async def delete(self, id: str) -> bool:
        return await self.table.delete_if_exists(PK, f"RULE#{id}")

    async def allows_send(self, account_id: str, recipients: list[str]) -> Rule | None:
        if not recipients:
            return None
        for r in await self.all():
            if r["kind"] == "send_to" and r["account_id"] == account_id and all(_matches(x, r) for x in recipients):
                return r
        return None

    async def allows_accept(self, account_id: str, organizer: str, has_conflict: bool) -> Rule | None:
        if has_conflict:
            return None
        for r in await self.all():
            if r["kind"] == "accept_from" and r["account_id"] == account_id and _matches(organizer, r):
                return r
        return None
