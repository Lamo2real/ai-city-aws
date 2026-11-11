"""The owner's ad spend limit (decision 240): the one approval gate left.

The owner sets it by talking to VAIC ("confirm with me before any campaign over $500"). It is a total per campaign
(the daily budget times the days it runs, or the lifetime budget) or, since decision 245, a daily ceiling ("300 kr a
day": the campaign's spend per day; raising a spent budget above it asks again). ``planned_spend`` reads that total from any tool
call that sets an ad budget (a connector tool, any MCP tool, or a shell call to an ads API), whoever makes it;
``spend_ask`` turns a call over the limit into an "ask" in ``policy.gate``, and only the owner can answer it (the
Chief of Staff and Autopilot skip ``kind: "ad.spend"`` approvals). No limit set means no check.

Rows live under ``CONFIG``, which only the coordinator roles may write (workers can read it): ``CONFIG`` /
``ADLIMIT`` is the current limit, ``CONFIG`` / ``ADLIMIT#<at>#<id>`` one history row per change. Amounts are
compared in the ad account's currency; the limit's currency is the owner's label for it."""

from __future__ import annotations

import math
import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

from .events import now_iso
from .ids import new_id
from .table import Table

PK = "CONFIG"
SK = "ADLIMIT"
HIST = "ADLIMIT#"
KIND = "ad.spend"
PERS = ("campaign", "day")

_DAILY = {"dailybudget", "dailybudgetamount", "dailybudgetmicros", "dailybudgetcents", "budgetamountmicros"}
_DAILY |= {"amountmicros", "dailyamount", "dailyspend", "budgetperday"}
_LIFETIME = {"lifetimebudget", "lifetimebudgetamount", "lifetimebudgetmicros", "lifetimebudgetcents"}
_LIFETIME |= {"totalbudget", "totalbudgetmicros", "totalamountmicros", "campaigntotalbudget"}
_START = {"starttime", "startdate", "start", "startat"}
_END = {"endtime", "enddate", "end", "endat", "stoptime", "stopdate"}
_NAME = ("name", "campaignname", "title", "campaignid", "adsetid", "adgroupid", "id")
_SHELL = re.compile(r"^(Bash|exec|bash|process|mcp__city__run_command)$")
_HOSTS = {
    "graph.facebook.com": "Meta",
    "googleads.googleapis.com": "Google Ads",
    "business-api.tiktok.com": "TikTok",
    "api.linkedin.com": "LinkedIn",
}
_PAIR = re.compile(
    r"""["']?([A-Za-z_]*(?:budget|amount_micros|start_time|end_time|start_date|end_date|name)[A-Za-z_]*)["']?"""
    r"""\s*[:=]\s*["']?([^"'&\s,}]+)"""
)


def _key(k: str) -> str:
    return re.sub(r"[^a-z]", "", k.lower())


def _num(v: Any) -> float | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, int | float):
        return float(v)
    if isinstance(v, str):
        try:
            return float(v.strip().replace(",", ""))
        except ValueError:
            return None
    return None


def _when(v: Any) -> datetime | None:
    if isinstance(v, int | float) and not isinstance(v, bool) and v > 1e9:
        return datetime.fromtimestamp(v / 1000 if v > 1e12 else v, UTC)
    if not isinstance(v, str) or not v.strip():
        return None
    s = v.strip()
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        try:
            d = datetime.combine(date.fromisoformat(s[:10]), datetime.min.time())
        except ValueError:
            return None
    return d if d.tzinfo else d.replace(tzinfo=UTC)


def platform_of(tool_name: str) -> str:
    """A readable platform name from the tool's server (``mcp__gateway__meta-ads___create_adset`` → Meta)."""
    n = tool_name.lower()
    for words, name in (
        (("meta", "facebook", "instagram", "fb-"), "Meta"),
        (("google",), "Google Ads"),
        (("tiktok",), "TikTok"),
        (("linkedin",), "LinkedIn"),
    ):
        if any(w in n for w in words):
            return name
    m = re.match(r"^mcp__gateway__(.+?)___", tool_name) or re.match(r"^mcp__([^_]+(?:-[^_]+)*)__", tool_name)
    return m.group(1) if m else tool_name


def _scale(platform: str, key: str) -> float:
    if key.endswith("micros"):
        return 1_000_000
    if key.endswith("cents"):
        return 100
    if platform == "Meta" and key in ("dailybudget", "lifetimebudget"):
        return 100  # Meta's API takes budgets in the account currency's minor units
    return 1


@dataclass(frozen=True)
class Spend:
    platform: str
    campaign: str
    total: float | None
    """The planned total in the ad account's currency; None when a daily budget has no end date."""
    detail: str
    per_day: float = 0.0
    """The planned spend per day: the daily budgets, plus a lifetime budget spread over its days (all of it in one day
    when it has no end date)."""


def _walk(v: Any, out: list[tuple[str, Any]], depth: int = 0) -> None:
    if depth > 6:
        return
    if isinstance(v, Mapping):
        for k, x in v.items():
            out.append((_key(str(k)), x))
            _walk(x, out, depth + 1)
    elif isinstance(v, list):
        for x in v[:50]:
            _walk(x, out, depth + 1)


def _shell_fields(command: str) -> tuple[str, dict[str, Any]] | None:
    host = next((h for h in _HOSTS if h in command), None)
    if host is None:
        return None
    fields: dict[str, Any] = {}
    for k, v in _PAIR.findall(command):
        fields.setdefault(k, v)
    return _HOSTS[host], fields


def _fmt(x: float) -> str:
    return f"{x:,.2f}".rstrip("0").rstrip(".")


def planned_spend(tool_name: str, tool_input: Mapping[str, Any], now: datetime | None = None) -> Spend | None:
    """The campaign's planned total when this call sets an ad budget; None when it sets none."""
    platform = platform_of(tool_name)
    data: Mapping[str, Any] = tool_input
    if _SHELL.match(tool_name):
        shell = _shell_fields(str(tool_input.get("command") or ""))
        if shell is None:
            return None
        platform, data = shell
    pairs: list[tuple[str, Any]] = []
    _walk(data, pairs)
    daily = [n / _scale(platform, k) for k, v in pairs if k in _DAILY and (n := _num(v)) is not None and n > 0]
    life = [n / _scale(platform, k) for k, v in pairs if k in _LIFETIME and (n := _num(v)) is not None and n > 0]
    if not daily and not life:
        return None
    start = next((d for k, v in pairs if k in _START and (d := _when(v))), None) or now or datetime.now(UTC)
    end = next((d for k, v in pairs if k in _END and (d := _when(v))), None)
    name = next((str(v)[:80] for want in _NAME for k, v in pairs if k == want and isinstance(v, str | int)), "")
    days = max(1, math.ceil((end - start) / timedelta(days=1))) if end else 0
    total = sum(life)
    per_day = sum(daily) + (total / days if days else total)
    parts = [f"lifetime budget {_fmt(total)}"] if life else []
    if daily:
        if end is None:
            return Spend(platform, name, None, f"{_fmt(sum(daily))} a day with no end date", per_day)
        total += sum(daily) * days
        parts.append(f"{_fmt(sum(daily))} a day for {days} day{'s' if days != 1 else ''}")
    return Spend(platform, name, total, " plus ".join(parts), per_day)


# ---------- the owner's limit ----------
class AdLimitStore:
    def __init__(self, table: Table, now: Callable[[], datetime] | None = None) -> None:
        self.table = table
        self.now = now

    def _iso(self) -> str:
        return now_iso(self.now()) if self.now else now_iso()

    async def get(self) -> dict[str, Any] | None:
        it = await self.table.get(PK, SK)
        return {k: v for k, v in it.items() if k not in ("pk", "sk")} if it else None

    async def _log(self, row: dict[str, Any]) -> None:
        n = len(await self.table.query(PK, HIST))  # orders changes made in the same instant
        await self.table.put({"pk": PK, "sk": f"{HIST}{row['at']}#{n:06d}#{new_id('lim')}", **row})

    async def set(self, amount: float, currency: str, per: str = "campaign") -> dict[str, Any]:
        """Sets (or replaces) the limit, per campaign or per day; one history row per change."""
        if not math.isfinite(amount) or amount <= 0:
            raise ValueError("The limit must be an amount above zero.")
        if per not in PERS:
            raise ValueError("The limit is per campaign or per day.")
        cur = (currency or "USD").strip().upper()[:8] or "USD"
        old = await self.get()
        rec = {"amount": round(amount, 2), "currency": cur, "per": per, "set_at": self._iso()}
        await self.table.put({"pk": PK, "sk": SK, **rec})
        await self._log({"action": "set", "amount": rec["amount"], "currency": cur, "per": per, "at": rec["set_at"],
                         "previous": old.get("amount") if old else None})  # fmt: skip
        return rec

    async def remove(self) -> bool:
        old = await self.get()
        if old is None:
            return False
        await self.table.delete(PK, SK)
        await self._log({"action": "removed", "amount": None, "previous": old.get("amount"), "at": self._iso()})
        return True

    async def history(self, limit: int = 20) -> list[dict[str, Any]]:
        rows = sorted(await self.table.query(PK, HIST), key=lambda r: str(r["sk"]), reverse=True)
        return [{k: v for k, v in r.items() if k not in ("pk", "sk")} for r in rows[:limit]]


def over_limit(spend: Spend, limit: Mapping[str, Any]) -> str | None:
    """The owner's words for a call over the limit; None when it is within it."""
    cap = float(limit["amount"])
    cur = str(limit.get("currency") or "")
    what = f'{spend.platform} campaign "{spend.campaign}"' if spend.campaign else f"A {spend.platform} campaign"
    if limit.get("per") == "day":
        if spend.per_day <= cap:
            return None
        return (
            f"{what} plans {_fmt(spend.per_day)} {cur} a day ({spend.detail}); your daily ad ceiling is "
            f"{_fmt(cap)} {cur} a day. Confirm to go above it."
        )
    if spend.total is not None and spend.total <= cap:
        return None
    plan = (
        f"plans {spend.detail}, so it has no total"
        if spend.total is None
        else f"plans {_fmt(spend.total)} {cur} ({spend.detail})"
    )
    return f"{what} {plan}; your ad spend limit is {_fmt(cap)} {cur} per campaign. Confirm to start it."


async def spend_ask(
    table: Table, tool_name: str, tool_input: Mapping[str, Any], now: datetime | None = None
) -> str | None:
    """Why this call needs the owner's confirmation under their ad spend limit; None when it doesn't (no budget in
    the call, no limit set, or within it). Reads the limit only for calls that set a budget."""
    spend = planned_spend(tool_name, tool_input, now)
    if spend is None:
        return None
    limit = await AdLimitStore(table).get()
    return over_limit(spend, limit) if limit else None
