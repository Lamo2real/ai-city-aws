"""Every build runs the fastest way by default (the owner's fixed rule, decision 287).

There is no speed mode to switch on: ``FASTEST`` is the pace of every task unless the owner's own words ask for
time ("take your time", "no rush"). The pace sets how many failed reviews a part gets before it goes back to its
manager, and how long a part may run before its manager is told it is stuck. Speed never loosens the policy
gate, the hard caps or the owner's ad spend limit; review still runs on every part.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

FASTEST = "fastest"
UNHURRIED = "unhurried"
DEFAULT_PACE = FASTEST


@dataclass(frozen=True)
class SpeedPolicy:
    pace: str
    review_fails_before_escalation: int  # this many FAILs and the part goes back to the manager, not the owner
    part_budget_minutes: int  # a part running longer than this is reported stuck to its manager, once


POLICIES = {
    FASTEST: SpeedPolicy(FASTEST, review_fails_before_escalation=2, part_budget_minutes=10),
    UNHURRIED: SpeedPolicy(UNHURRIED, review_fails_before_escalation=3, part_budget_minutes=30),
}

_SLOW = re.compile(
    r"\b(take (your|its|their|the) time|no rush|no hurry|not in a hurry|don'?t rush|slow(ly)? and careful|"
    r"take as long as)\b",
    re.I,
)


def pace_from_words(words: str) -> str:
    """The owner's pace: ``unhurried`` only when they asked for time in so many words, else the fastest."""
    return UNHURRIED if _SLOW.search(words or "") else DEFAULT_PACE


def policy_for(pace: Any) -> SpeedPolicy:
    return POLICIES.get(str(pace or DEFAULT_PACE), POLICIES[DEFAULT_PACE])


def speed_brief(pace: Any) -> str:
    """The line every manager's goal carries."""
    p = policy_for(pace)
    if p.pace == UNHURRIED:
        return "Pace: the owner said to take your time; quality first, no shortcuts on review."
    return (
        "Pace: fastest (the owner's fixed rule for every build). Run every independent part at the same time, "
        "assign all parts at once, review each part as soon as it reports, and give the worker the exact reason "
        f"on a FAIL. A part that fails review {p.review_fails_before_escalation} times comes back to you; a part "
        f"running over {p.part_budget_minutes} minutes is reported to you as stuck."
    )


def minutes_since(iso: str, now: datetime) -> float:
    try:
        then = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    return (now - then).total_seconds() / 60


def overdue(part: dict[str, Any], pace: Any, now: datetime) -> bool:
    """A worker's part that has run past its time budget and was not reported stuck yet."""
    if (
        part.get("kind") != "assignment"
        or part.get("status") not in ("open", "in_progress")
        or part.get("stuck_reported_at")
    ):
        return False
    if not str(part.get("to") or "").startswith("wkr-"):
        return False
    return minutes_since(str(part.get("updated_at") or ""), now) > policy_for(pace).part_budget_minutes
