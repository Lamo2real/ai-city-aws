"""Mail and calendar account rows (``MAIL`` / ``ACCT#<id>``, ``docs/MAIL_CALENDAR.md`` §2)."""

from __future__ import annotations

import json
import os
import secrets as _secrets
from collections.abc import Callable
from functools import cache
from typing import Any

from aic.shared.config import config_dir
from aic.shared.events import now_iso
from aic.shared.table import Table, UpdateOptions

PK = "MAIL"
PROVIDERS = ("google", "microsoft", "imap")

# Sign-in with Google or Microsoft needs an OAuth app the owner sets up (AIC_MAIL_PROVIDERS names the ones that are
# on). Until then such an account connects by app password instead, with the provider's servers filled in (the owner
# hit "Something went wrong" on "Sign in to Google", 2026-11-09).
APP_PASSWORD_PRESET = {"google": "Gmail (app password)", "microsoft": "Outlook.com"}
APP_PASSWORD_HELP = {
    "google": "Create a Gmail app password at myaccount.google.com/apppasswords (2-step verification must be on), "
    "then paste it with your Gmail address in the form.",
    "microsoft": "Create an app password at account.microsoft.com/security (Advanced security options), then paste "
    "it with your address in the form.",
}


def oauth_enabled(provider: str) -> bool:
    """Whether "Sign in to …" works for this provider here. Not wired at all (tests, local runs): assume it does."""
    raw = os.environ.get("AIC_MAIL_PROVIDERS")
    if raw is None:
        return True
    return provider in {p.strip() for p in raw.split(",") if p.strip()}


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
