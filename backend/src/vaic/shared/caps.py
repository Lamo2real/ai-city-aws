"""Optional brake.

Caps are off by default (None = no limit, the owner's choice). When the owner sets one it is checked before
every turn of every kind; at a cap the city starts no new turns and turns already running finish within the
turn timeout. Spend counters (DynamoDB ADD) are kept either way for the HUD.
"""

from __future__ import annotations

import copy
import math
from dataclasses import dataclass
from typing import Any, Literal

from .config import caps_config
from .ids import department_key
from .ledger import Ledger

CapName = Literal["daily_global", "daily_department", "monthly"]


def default_settings() -> dict[str, Any]:
    c = caps_config()
    return {
        "monthly_budget_usd": c["monthly_budget_usd"],
        "daily_global_usd": c["daily_global_usd"],
        "daily_department_usd": c["daily_department_usd"],
        "department_caps": {},
        "max_workers_per_goal": c["max_workers_per_goal"],
        "max_concurrent_workers_per_department": c["max_concurrent_workers_per_department"],
        "max_concurrent_workers_global": c["max_concurrent_workers_global"],
        "max_live_workers_city": c["max_live_workers_city"],
        "max_open_jobs": c["max_open_jobs"],
        "max_departments": c["max_departments"],
        "max_new_sessions_per_second": c["max_new_sessions_per_second"],
        "worker_idle_release_minutes": c["worker_idle_release_minutes"],
        "profile_prefix": "global",
        "notify_push": True,
        "first_run_done": False,
        # The Chief of Staff decides Needs you items the moment they appear (decision 124); off = they wait.
        "chief_of_staff_enabled": True,
        # Autopilot (decision 125): nothing waits on the owner; off = the behaviour before it.
        "autopilot": True,
    }


DEFAULT_SETTINGS: dict[str, Any] = default_settings()
"""Read-only view of the defaults; use ``default_settings()`` for a copy you may change."""


def settings_with(**overrides: Any) -> dict[str, Any]:
    return {**copy.deepcopy(DEFAULT_SETTINGS), **overrides}


def department_cap(s: dict[str, Any], department: str) -> float | None:
    v = s.get("department_caps", {}).get(department_key(department))
    return v if v is not None else s.get("daily_department_usd")


@dataclass(frozen=True)
class CapCheck:
    ok: bool
    cap: CapName | None = None
    spent: float = 0
    limit: float = 0
    department: str | None = None
    message: str = ""


OK = CapCheck(ok=True)


class SpendCapReached(RuntimeError):
    def __init__(self, check: CapCheck) -> None:
        super().__init__(check.message)
        self.check = check


def _block(cap: CapName, spent: float, limit: float, department: str | None, message: str) -> CapCheck:
    return CapCheck(
        ok=False,
        cap=cap,
        spent=spent,
        limit=limit,
        department=department,
        message=f"{message} No new work starts until the owner raises the cap or the period resets.",
    )


def _fmt(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else str(v)


async def check_caps(ledger: Ledger, settings: dict[str, Any], kind: str, department: str | None) -> CapCheck:
    """Every turn kind goes through here: vaic, orchestrator, manager, worker, utility, compaction, eval."""
    monthly = settings.get("monthly_budget_usd")
    daily = settings.get("daily_global_usd")
    if monthly is not None or daily is not None:
        day = await ledger.spend("day", "GLOBAL")
        month = await ledger.spend("month", "GLOBAL")
        if monthly is not None and month["usd"] >= monthly:
            return _block(
                "monthly", month["usd"], monthly, None, f"This month's spend cap of ${_fmt(monthly)} is reached."
            )
        if daily is not None and day["usd"] >= daily:
            return _block("daily_global", day["usd"], daily, None, f"Today's spend cap of ${_fmt(daily)} is reached.")
    if department:
        limit = department_cap(settings, department)
        if limit is None:
            return OK
        d = await ledger.spend("day", f"DEPT#{department_key(department)}")
        if d["usd"] >= limit:
            return _block(
                "daily_department",
                d["usd"],
                limit,
                department,
                f"{department}'s daily spend cap of ${_fmt(limit)} is reached.",
            )
    return OK


def validate_caps(patch: dict[str, Any]) -> str | None:
    """Validates a cap change from Settings: None (no limit) or zero or more dollars. Returns a problem, or None."""
    for k, v in patch.items():
        if v is None:
            continue
        if isinstance(v, bool) or not isinstance(v, int | float) or not math.isfinite(v) or v < 0:
            return f"{k.replace('_', ' ')} must be zero or more dollars, or empty for no limit."
    return None
