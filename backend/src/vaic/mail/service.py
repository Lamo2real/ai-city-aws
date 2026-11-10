"""Mail and calendar across every connected account (``docs/MAIL_CALENDAR.md`` §1, §11).

Fans out with a per-account timeout of 8 s, merges and sorts, and answers ``errors: [{account_id, message}]``
for accounts that failed instead of failing the whole call. Ids are global: ``<account_id>:<provider id>``.
Importable from Lambdas (no runtime imports): the apps bridge uses the read methods."""

from __future__ import annotations

import asyncio
import os
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from vaic.shared.table import Table

from .accounts import Account, AccountStore, public
from .http import Http, ProviderError, Unauthorized, urllib_http
from .providers.base import FOLDERS, Json, Provider
from .providers.caldav import CalDav
from .providers.google import Google
from .providers.imap import Imap, ImapFactory, SmtpFactory, default_imap, default_smtp
from .providers.microsoft import Microsoft
from .tokens import NeedsSignIn, Tokens

PER_ACCOUNT_SECONDS = 8.0
MAX_RANGE_DAYS = 62


class MailError(RuntimeError):
    """A plain-words problem the tool or route shows as is."""


def split_id(gid: str) -> tuple[str, str]:
    account, sep, pid = gid.partition(":")
    if not sep or not account.startswith("ma-") or not pid:
        raise MailError(f"{gid[:80]!r} isn't a mail or calendar id (they look like ma-xxxxxxxx:…).")
    return account, pid


def gid(account_id: str, pid: str) -> str:
    return f"{account_id}:{pid}"


class _ImapCal:
    """An IMAP account with an optional CalDAV calendar: mail through IMAP, calendar through CalDAV."""

    def __init__(self, mail: Imap, cal: CalDav | None) -> None:
        self.mail = mail
        self.cal = cal

    def __getattr__(self, name: str) -> Any:
        if name in ("calendars", "events", "get_event", "create_event", "update_event", "respond", "delete_event"):
            if self.cal is None:
                if name in ("calendars", "events"):

                    async def none(*_: Any, **__: Any) -> list[Json]:
                        return []

                    return none
                raise MailError("This account has no calendar (no CalDAV address was given).")
            return getattr(self.cal, name)
        return getattr(self.mail, name)


@dataclass
class MailService:
    store: AccountStore
    tokens: Tokens
    http: Http = urllib_http
    imap_factory: ImapFactory = default_imap
    smtp_factory: SmtpFactory = default_smtp
    on_status: Callable[[Account], Awaitable[None]] | None = None
    """Told when an account's status changes (the bus event ``mail.account``)."""
    _providers: dict[str, Provider] = field(default_factory=dict)

    @classmethod
    def from_env(cls, ledger: Any, session: Any = None, now: Any = None) -> MailService:
        """Builds the service the way a Lambda or runtime does. ``ledger`` is a ``Ledger`` (the apps bridge calls
        ``MailService.from_env(ledger)``) or a ``Table``. Raises when ``VAIC_MAIL_WORKLOAD`` isn't set here."""
        import boto3

        if not os.environ.get("VAIC_MAIL_WORKLOAD"):
            raise RuntimeError("VAIC_MAIL_WORKLOAD is not set: mail isn't configured for this function")
        table: Table = getattr(ledger, "table", ledger)
        clock = now or getattr(ledger, "now", None)
        s = session or boto3.Session(region_name=os.environ.get("VAIC_REGION"))
        return cls(AccountStore(table, clock), Tokens.from_env(s))

    # ---------- providers ----------
    def provider(self, a: Account) -> Provider:
        if a["id"] in self._providers:
            return self._providers[a["id"]]

        async def oauth() -> str:
            return await self.tokens.access_token(a)

        async def password() -> str:
            return await self.tokens.imap_password(a)

        p: Any
        if a["provider"] == "google":
            p = Google(self.http, oauth, a.get("address", ""))
        elif a["provider"] == "microsoft":
            p = Microsoft(self.http, oauth)
        elif a["provider"] == "imap":
            conf = a.get("imap") or {}
            cal = None
            if conf.get("caldav_url"):
                cal = CalDav(self.http, conf["caldav_url"], conf.get("username") or a.get("address", ""), password)
            p = _ImapCal(Imap(conf, a.get("address", ""), password, self.imap_factory, self.smtp_factory), cal)
        else:
            raise MailError(f"Unknown provider {a['provider']!r}.")
        self._providers[a["id"]] = p
        return p

    async def _account(self, account_id: str) -> Account:
        a = await self.store.get(account_id)
        if a is None:
            raise MailError(f"There's no connected account {account_id}.")
        if a.get("status") != "connected":
            raise MailError(
                f"{a.get('label', account_id)} isn't connected ({a.get('status')}). Ask the owner to sign in."
            )
        return a

    async def _needs_signin(self, a: Account) -> None:
        self.tokens.forget(a["id"])
        self._providers.pop(a["id"], None)
        b = await self.store.update(a["id"], {"status": "needs_sign_in", "error": "Sign in again."})
        if b and self.on_status:
            await self.on_status(b)

    async def _one(self, a: Account, fn: Callable[[Provider], Awaitable[Any]]) -> Any:
        try:
            return await fn(self.provider(a))
        except (Unauthorized, NeedsSignIn) as e:
            await self._needs_signin(a)
            raise MailError(f"{a.get('label')} needs the owner to sign in again.") from e
        except ProviderError as e:
            raise MailError(f"{a.get('label')}: {e}") from e

    async def _fan(
        self, accounts: list[Account], fn: Callable[[Account, Provider], Awaitable[list[Json]]]
    ) -> tuple[list[Json], list[Json]]:
        async def one(a: Account) -> list[Json]:
            return await asyncio.wait_for(self._one(a, lambda p: fn(a, p)), PER_ACCOUNT_SECONDS)

        results = await asyncio.gather(*(one(a) for a in accounts), return_exceptions=True)
        items: list[Json] = []
        errors: list[Json] = []
        for a, r in zip(accounts, results, strict=True):
            if isinstance(r, BaseException):
                msg = "It took too long to answer." if isinstance(r, TimeoutError) else str(r)
                errors.append({"account_id": a["id"], "label": a.get("label", ""), "message": msg[:300]})
            else:
                items += r
        return items, errors

    async def _connected(self, kind: str, account_id: str | None = None) -> list[Account]:
        accts = [a for a in await self.store.connected() if a.get(kind, True)]
        if account_id:
            accts = [a for a in accts if a["id"] == account_id]
            if not accts:
                raise MailError(f"There's no connected {kind} account {account_id}.")
        return accts

    # ---------- reads (also the apps bridge's read API, §11) ----------
    async def accounts(self) -> list[Account]:
        return [
            {k: a.get(k) for k in ("id", "label", "provider", "address", "status", "mail", "calendar", "color")}
            for a in await self.store.all()
        ]

    async def calendars(self) -> Json:
        async def fn(a: Account, p: Provider) -> list[Json]:
            hidden = {c["id"] for c in a.get("calendars") or [] if c.get("hidden")}
            cals = await p.calendars()
            await self.store.update(a["id"], {"calendars": [{**c, "hidden": c["id"] in hidden} for c in cals]})
            return [
                {
                    **c,
                    "id": gid(a["id"], c["id"]),
                    "account_id": a["id"],
                    "hidden": c["id"] in hidden,
                    "color": c.get("color") or a.get("color"),
                }
                for c in cals
            ]

        items, errors = await self._fan(await self._connected("calendar"), fn)
        return {"calendars": items, "errors": errors}

    async def events(
        self, start: str, end: str, calendar_ids: list[str] | None = None, query: str | None = None
    ) -> Json:
        from datetime import datetime

        s = datetime.fromisoformat(start.replace("Z", "+00:00"))
        e = datetime.fromisoformat(end.replace("Z", "+00:00"))
        if (e - s).days > MAX_RANGE_DAYS or e <= s:
            raise MailError(f"Ask for at most {MAX_RANGE_DAYS} days at a time, with the end after the start.")
        wanted: dict[str, list[str]] = {}
        for c in calendar_ids or []:
            acc, pid = split_id(c)
            wanted.setdefault(acc, []).append(pid)

        async def fn(a: Account, p: Provider) -> list[Json]:
            hidden = {c["id"] for c in a.get("calendars") or [] if c.get("hidden")}
            ids = wanted.get(a["id"]) if calendar_ids else None
            evs = await p.events(start, end, ids, query)
            names = {c["id"]: c.get("name", "") for c in a.get("calendars") or []}
            return [
                {
                    **ev,
                    "id": gid(a["id"], ev["id"]),
                    "calendar_id": gid(a["id"], ev["calendar_id"]),
                    "account_id": a["id"],
                    "calendar_name": names.get(ev["calendar_id"], ""),
                    "color": a.get("color"),
                }
                for ev in evs
                if calendar_ids or ev["calendar_id"] not in hidden
            ]

        accts = await self._connected("calendar")
        if calendar_ids:
            accts = [a for a in accts if a["id"] in wanted]
        items, errors = await self._fan(accts, fn)
        items.sort(key=lambda x: x.get("start", ""))
        return {"events": items, "errors": errors}

    async def search(
        self,
        query: str = "",
        account_id: str | None = None,
        folder: str | None = None,
        unread_only: bool = False,
        after: str | None = None,
        before: str | None = None,
        limit: int = 25,
    ) -> Json:
        if folder and folder not in FOLDERS:
            raise MailError(f"folder must be one of {', '.join(FOLDERS)}.")
        limit = max(1, min(int(limit), 25))

        async def fn(a: Account, p: Provider) -> list[Json]:
            got = await p.search(query, folder, unread_only, after, before, limit)
            return [
                {**m, "id": gid(a["id"], m["id"]), "account_id": a["id"], "account": a.get("label", "")} for m in got
            ]

        items, errors = await self._fan(await self._connected("mail", account_id), fn)
        items.sort(key=lambda m: _sort_date(m.get("date", "")), reverse=True)
        return {"messages": items[:limit], "errors": errors}

    async def read(self, id: str) -> tuple[Account, Json]:
        acc, pid = split_id(id)
        a = await self._account(acc)
        m = await self._one(a, lambda p: p.read(pid))
        return a, {**m, "id": id, "account_id": acc}

    async def get_event(self, id: str) -> tuple[Account, Json]:
        acc, pid = split_id(id)
        a = await self._account(acc)
        ev = await self._one(a, lambda p: p.get_event(pid))
        return a, {**ev, "id": id, "account_id": acc, "calendar_id": gid(acc, ev["calendar_id"])}

    # ---------- writes (only through actions.py, after the gate) ----------
    async def draft(self, account_id: str, f: Json) -> str:
        a = await self._account(account_id)
        g = dict(f)
        if g.get("reply_to_id"):
            r_acc, r_pid = split_id(g["reply_to_id"])
            if r_acc != account_id:
                raise MailError("Reply from the account the message came to.")
            g["reply_to_id"] = r_pid
        pid = await self._one(a, lambda p: p.draft(g))
        return gid(account_id, pid)

    async def send(self, draft_id: str) -> str:
        acc, pid = split_id(draft_id)
        a = await self._account(acc)
        return gid(acc, await self._one(a, lambda p: p.send(pid)))

    async def _by_account(self, ids: list[str]) -> dict[str, list[str]]:
        out: dict[str, list[str]] = {}
        for i in ids:
            acc, pid = split_id(i)
            out.setdefault(acc, []).append(pid)
        return out

    async def label(self, ids: list[str], add: list[str], remove: list[str], archive: bool, read: bool | None) -> int:
        n = 0
        for acc, pids in (await self._by_account(ids)).items():
            a = await self._account(acc)
            n += int(await self._one(a, _labeler(pids, add, remove, archive, read)))
        return n

    async def trash(self, ids: list[str]) -> int:
        n = 0
        for acc, pids in (await self._by_account(ids)).items():
            a = await self._account(acc)
            n += int(await self._one(a, _trasher(pids)))
        return n

    async def create_event(self, calendar_id: str, f: Json) -> Json:
        acc, pid = split_id(calendar_id)
        a = await self._account(acc)
        ev = await self._one(a, lambda p: p.create_event(pid, f))
        return {**ev, "id": gid(acc, ev["id"]), "calendar_id": calendar_id, "account_id": acc}

    async def update_event(self, id: str, f: Json) -> Json:
        acc, pid = split_id(id)
        a = await self._account(acc)
        ev = await self._one(a, lambda p: p.update_event(pid, f))
        return {**ev, "id": id, "account_id": acc, "calendar_id": gid(acc, ev.get("calendar_id", ""))}

    async def respond(self, id: str, response: str, comment: str | None) -> None:
        acc, pid = split_id(id)
        a = await self._account(acc)
        await self._one(a, lambda p: p.respond(pid, response, comment))

    async def delete_event(self, id: str) -> None:
        acc, pid = split_id(id)
        a = await self._account(acc)
        await self._one(a, lambda p: p.delete_event(pid))

    async def label_of(self, account_id: str) -> str:
        a = await self.store.get(account_id)
        return f"{a.get('label', '')} {a.get('address', '')}".strip() if a else account_id


def _labeler(
    pids: list[str], add: list[str], remove: list[str], archive: bool, read: bool | None
) -> Callable[[Provider], Awaitable[int]]:
    def go(p: Provider) -> Awaitable[int]:
        return p.label(pids, add, remove, archive, read)

    return go


def _trasher(pids: list[str]) -> Callable[[Provider], Awaitable[int]]:
    def go(p: Provider) -> Awaitable[int]:
        return p.trash(pids)

    return go


def _sort_date(s: str) -> str:
    from email.utils import parsedate_to_datetime

    try:
        return parsedate_to_datetime(s).isoformat()
    except (TypeError, ValueError):
        return s


__all__ = ["MailError", "MailService", "gid", "public", "split_id"]
