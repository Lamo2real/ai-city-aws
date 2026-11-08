"""Plain IMAP + SMTP with an app password (stdlib ``imaplib`` / ``smtplib`` in a thread, TLS only, §2.2).

Message ids are ``<folder>/<UID>``; the folder's UIDVALIDITY is checked when it was recorded on the id
(``<folder>/<UIDVALIDITY>.<UID>``)."""

from __future__ import annotations

import asyncio
import contextlib
import email
import email.policy
import imaplib
import re
import smtplib
import ssl
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from email.utils import format_datetime, parsedate_to_datetime
from typing import Any

from ..http import ProviderError, Unauthorized
from .base import BODY_MAX, Json, cap, fmt_addrs, html_to_text, parse_addr, parse_addrs, summary

ImapFactory = Callable[[str, int], Any]
"""(host, port) -> an ``imaplib.IMAP4_SSL``-like object."""
SmtpFactory = Callable[[str, int, bool], Any]
"""(host, port, starttls) -> a logged-out ``smtplib.SMTP``-like object."""

_SPECIAL = {"sent": "\\Sent", "drafts": "\\Drafts", "archive": "\\Archive", "trash": "\\Trash", "all": "\\All"}
_FALLBACK = {
    "sent": ["Sent", "Sent Items", "Sent Messages"],
    "drafts": ["Drafts"],
    "archive": ["Archive"],
    "trash": ["Trash", "Deleted Items", "Deleted Messages"],
    "all": ["INBOX"],
}
_LIST = re.compile(r'\((?P<flags>[^)]*)\) "(?P<sep>[^"]*)" (?P<name>.+)$')


def default_imap(host: str, port: int) -> Any:
    return imaplib.IMAP4_SSL(host, port, ssl_context=ssl.create_default_context(), timeout=10)


def default_smtp(host: str, port: int, starttls: bool) -> Any:
    ctx = ssl.create_default_context()
    if starttls:
        s = smtplib.SMTP(host, port, timeout=10)
        s.starttls(context=ctx)
        return s
    return smtplib.SMTP_SSL(host, port, context=ctx, timeout=10)


def imap_criteria(query: str, unread_only: bool, after: str | None, before: str | None) -> list[str]:
    """Plain words + ``from:``/``to:``/``subject:`` → IMAP SEARCH keys (values quoted, quotes removed)."""
    keys: list[str] = []
    for tok in re.findall(r'(\w+:"[^"]*"|\w+:\S+|"[^"]*"|\S+)', query or ""):
        k, _, v = tok.partition(":") if re.match(r"^(from|to|subject):", tok, re.I) else ("", "", tok)
        v = v.strip('"').replace('"', "").replace("\\", "")
        if not v:
            continue
        keys += [k.upper() if k else "TEXT", f'"{v}"']
    if unread_only:
        keys.append("UNSEEN")
    for key, d in (("SINCE", after), ("BEFORE", before)):
        if d:
            keys += [key, datetime.fromisoformat(d[:10]).strftime("%d-%b-%Y")]
    return keys or ["ALL"]


def _text_of(msg: Any) -> tuple[str, list[Json]]:
    plain, htm, files = "", "", []
    for part in msg.walk():
        if part.is_multipart():
            continue
        name = part.get_filename()
        ctype = part.get_content_type()
        if name:
            files.append({"name": str(name), "size": len(part.get_payload(decode=True) or b""), "mime": ctype})
        elif ctype == "text/plain" and not plain:
            plain = part.get_content()
        elif ctype == "text/html" and not htm:
            htm = part.get_content()
    return (plain or html_to_text(htm)), files


class Imap:
    def __init__(
        self,
        conf: Json,
        address: str,
        password: Callable[[], Any],
        imap_factory: ImapFactory = default_imap,
        smtp_factory: SmtpFactory = default_smtp,
    ) -> None:
        self.conf = conf
        self.address = address
        self.password = password
        self.imap_factory = imap_factory
        self.smtp_factory = smtp_factory

    async def _run(self, fn: Callable[[Any], Any]) -> Any:
        pw = await self.password()

        def go() -> Any:
            c = self.imap_factory(self.conf["imap_host"], int(self.conf.get("imap_port", 993)))
            try:
                try:
                    c.login(self.conf.get("username") or self.address, pw)
                except imaplib.IMAP4.error as e:
                    raise Unauthorized("The mail server refused the app password.") from e
                return fn(c)
            finally:
                with contextlib.suppress(Exception):
                    c.logout()

        try:
            return await asyncio.to_thread(go)
        except (ProviderError, ValueError):
            raise
        except Exception as e:
            raise ProviderError(f"The mail server failed: {type(e).__name__}") from e

    @staticmethod
    def _folder(c: Any, which: str) -> str:
        if which in ("inbox", "", None):
            return "INBOX"
        _typ, data = c.list()
        names: list[tuple[str, str]] = []
        for raw in data or []:
            line = raw.decode() if isinstance(raw, bytes) else str(raw)
            m = _LIST.match(line)
            if m:
                names.append((m.group("flags"), m.group("name").strip().strip('"')))
        for flags, name in names:
            if _SPECIAL.get(which, "") and _SPECIAL[which].lower() in flags.lower():
                return name
        for name in _FALLBACK.get(which, []):
            if any(n.lower() == name.lower() for _, n in names):
                return name
        raise ProviderError(f"This mailbox has no {which} folder.")

    @staticmethod
    def _split(id: str) -> tuple[str, str]:
        folder, _, uid = id.rpartition("/")
        if not folder or not uid.isdigit():
            raise ProviderError("That isn't an IMAP message id.")
        return folder, uid

    @staticmethod
    def _select(c: Any, folder: str) -> None:
        typ, _ = c.select(f'"{folder}"', readonly=False)
        if typ != "OK":
            raise ProviderError(f"Couldn't open the folder {folder}.")

    async def search(
        self, query: str, folder: str | None, unread_only: bool, after: str | None, before: str | None, limit: int
    ) -> list[Json]:
        keys = imap_criteria(query, unread_only, after, before)

        def fn(c: Any) -> list[Json]:
            name = self._folder(c, folder or "inbox")
            self._select(c, name)
            _typ, data = c.uid("SEARCH", None, *keys)
            uids = (data[0] or b"").split()[-limit:][::-1]
            out = []
            for uid in uids:
                _typ, got = c.uid("FETCH", uid, "(FLAGS BODY.PEEK[HEADER] BODY.PEEK[TEXT]<0.400>)")
                hdr, text, flags = b"", b"", ""
                for item in got or []:
                    if isinstance(item, tuple):
                        meta = item[0].decode(errors="replace")
                        if "HEADER" in meta:
                            hdr = item[1]
                            flags = meta
                        else:
                            text = item[1]
                msg = email.message_from_bytes(hdr, policy=email.policy.default)
                out.append(
                    summary(
                        f"{name}/{uid.decode()}",
                        str(msg.get("Message-ID", "")),
                        parse_addr(str(msg.get("From", ""))),
                        parse_addrs(str(msg.get("To", ""))),
                        parse_addrs(str(msg.get("Cc", ""))),
                        str(msg.get("Subject", "")),
                        str(msg.get("Date", "")),
                        text.decode("utf-8", "replace"),
                        "\\Seen" not in flags,
                        [],
                        "multipart/mixed" in str(msg.get("Content-Type", "")),
                    )
                )
            return out

        result: list[Json] = await self._run(fn)
        return result

    async def read(self, id: str) -> Json:
        folder, uid = self._split(id)

        def fn(c: Any) -> Json:
            self._select(c, folder)
            _typ, got = c.uid("FETCH", uid, "(FLAGS BODY.PEEK[])")
            raw = next((i[1] for i in got or [] if isinstance(i, tuple)), None)
            if raw is None:
                raise ProviderError("That message is gone.")
            flags = next((i[0].decode(errors="replace") for i in got if isinstance(i, tuple)), "")
            msg = email.message_from_bytes(raw, policy=email.policy.default)
            text, files = _text_of(msg)
            s = summary(
                id,
                str(msg.get("Message-ID", "")),
                parse_addr(str(msg.get("From", ""))),
                parse_addrs(str(msg.get("To", ""))),
                parse_addrs(str(msg.get("Cc", ""))),
                str(msg.get("Subject", "")),
                str(msg.get("Date", "")),
                text,
                "\\Seen" not in flags,
                [],
                bool(files),
            )
            s.update(body_text=cap(text, BODY_MAX), attachments=files)
            if msg.get("List-Unsubscribe"):
                s["list_unsubscribe"] = str(msg["List-Unsubscribe"])[:500]
            return s

        result: Json = await self._run(fn)
        return result

    def _message(self, f: Json) -> EmailMessage:
        msg = EmailMessage()
        msg["From"] = self.address
        msg["To"] = fmt_addrs(f.get("to"))
        if f.get("cc"):
            msg["Cc"] = fmt_addrs(f["cc"])
        msg["Subject"] = f.get("subject", "")
        msg["Date"] = format_datetime(datetime.now().astimezone())
        msg.set_content(f.get("body", ""))
        return msg

    async def draft(self, f: Json) -> str:
        msg = self._message(f)
        if f.get("bcc"):
            msg["Bcc"] = fmt_addrs(f["bcc"])

        def fn(c: Any) -> str:
            name = self._folder(c, "drafts")
            _typ, data = c.append(f'"{name}"', "(\\Draft)", None, msg.as_bytes())
            m = re.search(rb"APPENDUID \d+ (\d+)", (data or [b""])[0] or b"")
            if not m:
                raise ProviderError("The server saved the draft but didn't say its id.")
            return f"{name}/{m.group(1).decode()}"

        result: str = await self._run(fn)
        return result

    async def send(self, draft_id: str) -> str:
        folder, uid = self._split(draft_id)

        def fetch(c: Any) -> bytes:
            self._select(c, folder)
            _typ, got = c.uid("FETCH", uid, "(BODY.PEEK[])")
            raw = next((i[1] for i in got or [] if isinstance(i, tuple)), None)
            if raw is None:
                raise ProviderError("That draft is gone.")
            return bytes(raw)

        raw = await self._run(fetch)
        msg = email.message_from_bytes(raw, policy=email.policy.default)
        rcpts = [a["email"] for h in ("To", "Cc", "Bcc") for a in parse_addrs(str(msg.get(h, ""))) if a["email"]]
        del msg["Bcc"]
        pw = await self.password()

        def go() -> None:
            s = self.smtp_factory(
                self.conf["smtp_host"], int(self.conf.get("smtp_port", 465)), bool(self.conf.get("smtp_starttls"))
            )
            try:
                s.login(self.conf.get("username") or self.address, pw)
                s.send_message(msg, from_addr=self.address, to_addrs=rcpts)
            finally:
                with contextlib.suppress(Exception):
                    s.quit()

        await asyncio.to_thread(go)

        def tidy(c: Any) -> None:
            self._select(c, folder)
            c.uid("STORE", uid, "+FLAGS", "(\\Deleted)")
            c.expunge()
            with contextlib.suppress(ProviderError):
                c.append(f'"{self._folder(c, "sent")}"', "(\\Seen)", None, msg.as_bytes())

        await self._run(tidy)
        return draft_id

    async def label(self, ids: list[str], add: list[str], remove: list[str], archive: bool, read: bool | None) -> int:
        def fn(c: Any) -> int:
            for id in ids:
                folder, uid = self._split(id)
                self._select(c, folder)
                for kw in add:
                    c.uid("STORE", uid, "+FLAGS", f"({re.sub(r'[^A-Za-z0-9_-]', '', kw)})")
                for kw in remove:
                    c.uid("STORE", uid, "-FLAGS", f"({re.sub(r'[^A-Za-z0-9_-]', '', kw)})")
                if read is not None:
                    c.uid("STORE", uid, "+FLAGS" if read else "-FLAGS", "(\\Seen)")
                if archive:
                    c.uid("MOVE", uid, f'"{self._folder(c, "archive")}"')
            return len(ids)

        result: int = await self._run(fn)
        return result

    async def trash(self, ids: list[str]) -> int:
        def fn(c: Any) -> int:
            trash = self._folder(c, "trash")
            for id in ids:
                folder, uid = self._split(id)
                self._select(c, folder)
                c.uid("MOVE", uid, f'"{trash}"')
            return len(ids)

        result: int = await self._run(fn)
        return result

    async def invitations(self, state: Json | None, since_days: int = 30, limit: int = 200) -> tuple[list[str], Json]:
        """The iCalendar texts (meeting invitations, ``.ics``) on INBOX messages newer than ``state``
        (``{uidvalidity, last_uid}`` from the last call), opened read-only so nothing is marked read. The first
        call, or a changed UIDVALIDITY, looks back ``since_days``. Answers the texts and the next state."""

        def fn(c: Any) -> tuple[list[str], Json]:
            typ, _ = c.select('"INBOX"', readonly=True)
            if typ != "OK":
                raise ProviderError("Couldn't open the inbox.")
            got_uv = c.response("UIDVALIDITY")[1] or [b"0"]
            uv = int((got_uv[0] or b"0").decode() if isinstance(got_uv[0], bytes) else got_uv[0])
            st = state or {}
            last = int(st.get("last_uid") or 0) if st.get("uidvalidity") == uv else 0
            if last:
                _typ, data = c.uid("SEARCH", None, "UID", f"{last + 1}:*")
            else:
                since = (datetime.now(UTC) - timedelta(days=since_days)).strftime("%d-%b-%Y")
                _typ, data = c.uid("SEARCH", None, "SINCE", since)
            uids = sorted(int(u) for u in (data[0] or b"").split() if int(u) > last)[-limit:]
            texts: list[str] = []
            if uids:
                _typ, got = c.uid("FETCH", ",".join(map(str, uids)), "(UID BODYSTRUCTURE)")
                with_cal: list[str] = []
                for item in got or []:
                    line = b" ".join(x for x in item if isinstance(x, bytes)) if isinstance(item, tuple) else item
                    text = (line or b"").decode(errors="replace") if isinstance(line, bytes) else str(line or "")
                    m = re.search(r"UID (\d+)", text)
                    if m and re.search(r'"text" "calendar"|\.ics"|"application" "ics"', text, re.I):
                        with_cal.append(m.group(1))
                for uid in with_cal:
                    _typ, got = c.uid("FETCH", uid, "(BODY.PEEK[])")
                    raw = next((i[1] for i in got or [] if isinstance(i, tuple)), None)
                    if not raw:
                        continue
                    msg = email.message_from_bytes(raw, policy=email.policy.default)
                    for part in msg.walk():
                        name = str(part.get_filename() or "").lower()
                        if part.get_content_type() in ("text/calendar", "application/ics") or name.endswith(".ics"):
                            payload = part.get_payload(decode=True)
                            if isinstance(payload, bytes):
                                texts.append(payload.decode(part.get_content_charset() or "utf-8", "replace"))
            return texts, {"uidvalidity": uv, "last_uid": max([last, *uids])}

        result: tuple[list[str], Json] = await self._run(fn)
        return result

    async def check(self) -> None:
        """Logs in to IMAP and SMTP once (the app-password form's check)."""
        await self._run(lambda c: None)
        pw = await self.password()

        def go() -> None:
            s = self.smtp_factory(
                self.conf["smtp_host"], int(self.conf.get("smtp_port", 465)), bool(self.conf.get("smtp_starttls"))
            )
            try:
                s.login(self.conf.get("username") or self.address, pw)
            except smtplib.SMTPAuthenticationError as e:
                raise Unauthorized("The mail server refused the app password for sending.") from e
            finally:
                with contextlib.suppress(Exception):
                    s.quit()

        await asyncio.to_thread(go)


def parsed_date(s: str) -> str:
    try:
        return parsedate_to_datetime(s).isoformat()
    except (TypeError, ValueError):
        return s
