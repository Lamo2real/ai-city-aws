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
        "max_open_jobs": c["max_open_jobs"],
        "max_departments": c["max_departments"],
        "max_new_sessions_per_second": c["max_new_sessions_per_second"],
        "worker_idle_release_minutes": c["worker_idle_release_minutes"],
        "profile_prefix": "global",
        "notify_push": True,
        # VAIC calls the owner's iPhone when it needs them (decision 245); off = only the message, no ringing.
        "call_owner": True,
        "first_run_done": False,
        # The Chief of Staff decides Needs you items the moment they appear (decision 124); off = they wait.
        "chief_of_staff_enabled": True,
        # Autopilot (decision 125): nothing waits on the owner; off = the behaviour before it.
        "autopilot": True,
        # The job sizes built on the project board (decision 289, stage 2: small); [] = every job through the
        # Orchestrator chain. The single switch back to the old path.
        "board_sizes": ["small"],
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


CAP_KEYS = ("daily_global_usd", "monthly_budget_usd", "daily_department_usd")
WHOLE_KEYS = (
    "max_open_jobs",
    "max_departments",
    "max_new_sessions_per_second",
    "worker_idle_release_minutes",
)
SWITCH_KEYS = ("notify_push", "first_run_done", "chief_of_staff_enabled", "autopilot", "call_owner")
SETTING_KEYS = (*CAP_KEYS, *WHOLE_KEYS, *SWITCH_KEYS, "profile_prefix", "mail_access", "department_caps")
"""Every key ``PUT /settings`` takes; anything else in a body is ignored by the route."""


def _whole(v: Any) -> bool:
    return isinstance(v, int | float) and not isinstance(v, bool) and math.isfinite(v) and float(v).is_integer()


def _number(v: Any) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return math.nan


def settings_patch(b: dict[str, Any], cur: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
    """The checks of ``PUT /settings``, shared by the route and VAIC's staged changes (decision 206).

    Returns (the patch to save, a problem in the owner's words or None)."""
    patch: dict[str, Any] = {k: b[k] for k in (*CAP_KEYS, *WHOLE_KEYS) if k in b}
    if "profile_prefix" in b:
        if str(b["profile_prefix"]) not in ("global", "eu", "us"):
            return patch, "Pick global, eu or us."
        patch["profile_prefix"] = b["profile_prefix"]
    for k in SWITCH_KEYS:
        if isinstance(b.get(k), bool):
            patch[k] = b[k]
    if isinstance(b.get("mail_access"), dict):
        # Orchestrator and managers have full mail unless the owner turns it off (decision 237); workers never
        # (decision 79). "read" is an older client's word for access and means all.
        ma = b["mail_access"]
        if any(k not in ("orchestrator", "manager") or v not in ("none", "read", "all") for k, v in ma.items()):
            return patch, "mail_access takes orchestrator and manager, each none or all."
        patch["mail_access"] = dict(ma)
    # "integrations" (four dead switches, removed 2026-11-08) is ignored when an old client still sends it.
    if isinstance(b.get("department_caps"), dict):
        patch["department_caps"] = {department_key(k): _number(v) for k, v in b["department_caps"].items()}
    bad = validate_caps({k: patch[k] for k in CAP_KEYS if k in patch})
    if bad:
        return patch, bad
    for k in WHOLE_KEYS:
        if k in patch and (not _whole(patch[k]) or patch[k] < 1):
            return patch, f"{k.replace('_', ' ')} must be a whole number of at least 1."
    if patch.get("max_new_sessions_per_second", 0) > 25:
        return patch, "New sessions per second can't go above AgentCore's limit of 25."
    daily = patch["daily_global_usd"] if "daily_global_usd" in patch else cur.get("daily_global_usd")
    for v in (patch.get("department_caps") or {}).values():
        if not math.isfinite(v) or v < 0 or (daily is not None and v > daily):
            return patch, "A department cap must be $0 or more, and not above the daily cap if one is set."
    return patch, None
