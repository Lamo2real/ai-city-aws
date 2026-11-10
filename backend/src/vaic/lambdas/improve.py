"""The weekly self-improvement loop, ported from upstream improve.ts and fenced harder.

It is built and disabled: it runs only when VAIC_SELF_IMPROVE=on (Terraform never sets it), and even then a
change touching infra/, IAM, spend caps, the policy file or CI is refused outright.
"""

from __future__ import annotations

import re
from collections.abc import Mapping

_FORBIDDEN = [
    re.compile(r"^infra/"),
    re.compile(r"^\.github/"),
    re.compile(r"^config/(policy|caps|mail)\.json$"),
    re.compile(r"(^|/)iam[^/]*\.(tf|json)$"),
    re.compile(r"(^|/)package(-lock)?\.json$"),
    re.compile(r"(^|/)(pyproject\.toml|uv\.lock)$"),
    re.compile(r"^backend/src/vaic/shared/(policy|caps|guard)\.py$"),
    re.compile(r"^scripts/check[-_](tags|iam)\.(mjs|py)$"),
]
_TEST = re.compile(r"(^|/)tests?/|(\.test\.[a-z]+|_test\.py|(^|/)test_[^/]*\.py)$")


def improvement_allowed(env: Mapping[str, str]) -> tuple[bool, str]:
    if env.get("VAIC_SELF_IMPROVE") != "on":
        return False, "the self-improvement loop is disabled"
    return True, ""


def barred(status: str, path: str) -> bool:
    """True when a changed path may never be changed by the loop. Existing tests are barred too."""
    p = re.sub(r"^\./", "", path.replace("\\", "/"))
    if any(r.search(p.lower()) or r.search(p) for r in _FORBIDDEN):
        return True
    return bool(_TEST.search(p)) and status != "A"


def review_changes(changes: list[dict[str, str]]) -> tuple[bool, list[str]]:
    refused = [c["path"] for c in changes if barred(c["status"], c["path"])]
    return not refused, refused
