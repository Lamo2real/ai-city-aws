"""Mail and calendar account rows (``MAIL`` / ``ACCT#<id>``, ``docs/MAIL_CALENDAR.md`` §2)."""

from __future__ import annotations

import json
import secrets as _secrets
from collections.abc import Callable
from functools import cache
from typing import Any

from aic.shared.config import config_dir
from aic.shared.events import now_iso
from aic.shared.table import Table, UpdateOptions

PK = "MAIL"
PROVIDERS = ("google", "microsoft", "imap")
STATUSES = ("signing_in", "connected", "needs_sign_in", "error")
PRIVATE = ("pk", "sk", "session_uri", "session_expires_at", "secret_name", "state")
SIGNIN_SECONDS = 600

Account = dict[str, Any]


@cache
def mail_config() -> dict[str, Any]:
    with (config_dir() / "mail.json").open(encoding="utf-8") as f:
        data: dict[str, Any] = json.load(f)
    return data


def new_account_id() -> str:
    return f"ma-{_secrets.token_hex(4)}"


def public(a: Account) -> Account:
    return {k: v for k, v in a.items() if k not in PRIVATE}


class AccountStore:
    def __init__(self, table: Table, now: Callable[[], Any] | None = None) -> None:
        self.table = table
        self.now = now

    def _iso(self) -> str:
        return now_iso(self.now()) if self.now else now_iso()

    async def all(self) -> list[Account]:
        return [a for a in await self.table.query(PK, "ACCT#")]

    async def get(self, id: str) -> Account | None:
        return await self.table.get(PK, f"ACCT#{id}")

    async def create(self, provider: str, label: str) -> Account:
        palette = mail_config()["palette"]
        existing = await self.all()
        at = self._iso()
        a: Account = {
            "pk": PK,
            "sk": "",
            "id": new_account_id(),
            "provider": provider,
            "label": label[:40],
            "address": "",
            "color": palette[len(existing) % len(palette)],
            "status": "signing_in",
            "mail": True,
            "calendar": True,
            "created_at": at,
            "updated_at": at,
        }
        a["sk"] = f"ACCT#{a['id']}"
        await self.table.put(a, if_not_exists=True)
        return a

    async def update(self, id: str, patch: dict[str, Any]) -> Account | None:
        """Sets fields (None clears one). None when the account is gone."""
        return await self.table.update(
            PK, f"ACCT#{id}", UpdateOptions(set={**patch, "updated_at": self._iso()}, must_exist=True)
        )

    async def delete(self, id: str) -> None:
        await self.table.delete(PK, f"ACCT#{id}")

    async def connected(self) -> list[Account]:
        return [a for a in await self.all() if a.get("status") == "connected"]
