"""VAIC sizes every job in code, in microseconds, before anything is planned (decision 289).

Four sizes (``vaic.shared.build_models``): ``small`` (one worker, no planner), ``medium`` (a Sonnet planner),
``large`` (an Opus planner) and ``extreme`` (a whole app from business requirements with AWS infrastructure: a
Fable architect). The owner's own words always win ("go big", "use 10 agents", "just one worker"). When the signals
are unclear the job starts small: a single worker can still grow into a team when the job turns out bigger.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .build_models import Size

_NUM = {
    "one": 1, "a": 1, "single": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10, "twelve": 12, "fifteen": 15, "twenty": 20, "fifty": 50, "hundred": 100,
}  # fmt: skip
_WHO = r"(?:agents?|workers?|people|persons?|builders?|devs?|developers?|engineers?)"
_COUNT = re.compile(
    rf"\b(?:use|with|get|put|hire|have|need|assign|deploy|throw|send)\s+(?:only\s+|just\s+|exactly\s+|about\s+)?"
    rf"(\d{{1,4}}|{'|'.join(_NUM)})\s+(?:\w+\s+)?{_WHO}\b",
    re.I,
)
_COUNT_BARE = re.compile(rf"\b(\d{{1,4}})\s+{_WHO}\b", re.I)
_ONE = re.compile(
    rf"\b(?:just|only)\s+(?:one|a single|1)\s+{_WHO}\b|\b(?:a\s+)?single\s+{_WHO}\b|\bone\s+{_WHO}\s+(?:only|is enough)\b"
    r"|\bkeep it small\b|\bno team\b",
    re.I,
)
_EXTREME_SAID = re.compile(r"\b(?:go|make it|treat it as)\s+extreme\b|\bextreme (?:job|build|mode|size)\b", re.I)
_BIG_SAID = re.compile(
    r"\bgo (?:big|large|all[- ]out|all in)\b|\ball hands\b|\bfull (?:team|force|power)\b|\bbig team\b"
    r"|\bthrow everything at it\b|\bmax(?:imum)? (?:team|agents|workers)\b",
    re.I,
)
_MEDIUM_SAID = re.compile(r"\b(?:a small team|a few (?:agents|workers|people)|medium (?:job|size|team))\b", re.I)

_BUILD = re.compile(r"\b(?:build|make|create|develop|design|code|write|set up|spin up|launch|ship)\b", re.I)
_THING = re.compile(
    r"\b(?:app|application|game|website|site|web ?app|tool|dashboard|platform|product|saas|service|portal|system|"
    r"store|shop|landing page|api|crm|marketplace)s?\b",
    re.I,
)
_AWS = re.compile(
    r"\b(?:aws|amazon web services|infrastructure|infra|terraform|cloudformation|lambda|dynamodb|s3|api gateway|"
    r"cognito|cloudfront|rds|aurora|ecs|eks|fargate|kubernetes|vpc|iam|serverless|backend|database|auth(?:entication)?|"
    r"payments?|stripe|multi[- ]tenant|scal(?:e|able|ing)|production|deploy(?:ed|ment)? to)\b",
    re.I,
)
_BUSINESS = re.compile(r"\bbusiness (?:requirements?|case|plan|spec)\b|\bfrom (?:the|these|my) requirements\b", re.I)
_CHANGE = re.compile(
    r"\b(?:change|fix|tweak|adjust|rename|update|make (?:it|the)|set|turn|swap|replace|remove|add a|bump|move|"
    r"recolou?r|resize|bigger|smaller|faster|slower)\b",
    re.I,
)
_ITEM_SPLIT = re.compile(r",|;|\n|\band\b|\bplus\b|\balso\b|•|- ", re.I)


@dataclass(frozen=True)
class Sizing:
    size: Size
    reason: str
    workers: int | None = None
    """The owner's exact number of agents, when they gave one (decision 283 keeps it exact)."""
    by_owner: bool = False
    """True when the owner's own words set the size."""


def _count(words: str) -> int | None:
    m = _COUNT.search(words) or _COUNT_BARE.search(words)
    if not m:
        return None
    raw = m.group(1).lower()
    n = int(raw) if raw.isdigit() else _NUM.get(raw)
    return n if n and n > 0 else None


def _size_for_count(n: int) -> Size:
    return "small" if n <= 1 else "medium" if n <= 6 else "large"


def _items(text: str) -> int:
    return len([p for p in _ITEM_SPLIT.split(text) if len(p.strip()) > 3])


def size_job(owner_words: str, goal: str = "", *, existing_app: bool = False, workers: int | None = None) -> Sizing:
    """The job's size from the owner's words (which win) and the goal VAIC wrote. ``existing_app``: the job changes
    an app that already exists. ``workers``: the owner's count as VAIC passed it."""
    said = owner_words or ""
    text = f"{said}\n{goal}".strip()
    # 1. The owner's words win.
    if _EXTREME_SAID.search(said):
        return Sizing("extreme", "the owner asked for an extreme build", workers, True)
    n = workers or _count(said)
    if _ONE.search(said) or n == 1:
        return Sizing("small", "the owner asked for one worker", 1, True)
    if _BIG_SAID.search(said):
        return Sizing("large", "the owner said to go big", n, True)
    if n:
        return Sizing(_size_for_count(n), f"the owner asked for {n} agents", n, True)
    if _MEDIUM_SAID.search(said):
        return Sizing("medium", "the owner asked for a small team", None, True)
    # 2. Signals.
    words = len(re.findall(r"\w+", text))
    aws = {m.group(0).lower() for m in _AWS.finditer(text)}
    builds_thing = bool(_BUILD.search(text) and _THING.search(text))
    if (
        (builds_thing or _BUSINESS.search(text))
        and not existing_app
        and (_BUSINESS.search(text) or len(aws) >= 2 or ("aws" in aws and words > 12))
    ):
        return Sizing("extreme", "a whole app with its AWS infrastructure")
    items = _items(said or goal)
    if existing_app:
        if words > 120 or items >= 6:
            return Sizing("medium", "several changes to an existing app")
        return Sizing("small", "a change to an existing app")
    if builds_thing:
        if words > 90 or items >= 6:
            return Sizing("large", "a new app with many features")
        return Sizing("medium", "a new app")
    if _CHANGE.search(text) and words <= 60:
        return Sizing("small", "a small change")
    if words > 150 or items >= 8:
        return Sizing("medium", "a job with many parts")
    return Sizing("small", "unclear, so it starts small and grows if needed")
