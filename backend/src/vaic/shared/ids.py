"""Session and record IDs. AgentCore session IDs must be at least 33 characters, so short ones are padded."""

from __future__ import annotations

import re
import uuid


def _slug(s: str) -> str:
    out = re.sub(r"[^a-z0-9]+", "-", s.strip().lower()).strip("-")[:40]
    return out or "x"


def department_key(name: str) -> str:
    return _slug(name)


def _pad(s: str) -> str:
    return s if len(s) >= 33 else f"{s}-{'0' * (33 - len(s) - 1)}"


class SessionIds:
    @staticmethod
    def vaic(owner: str, conversation: str) -> str:
        return _pad(f"vaic-{_slug(owner)}-{_slug(conversation)}")

    @staticmethod
    def orchestrator(task_id: str) -> str:
        return _pad(f"orch-{_slug(task_id)}")

    @staticmethod
    def manager(department: str, task_id: str) -> str:
        return _pad(f"mgr-{_slug(department)}-{_slug(task_id)}")

    @staticmethod
    def worker(department: str, hire_id: str) -> str:
        return _pad(f"wkr-{_slug(department)}-{_slug(hire_id)}")


session_ids = SessionIds()


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def manager_id(department: str) -> str:
    return f"mgr-{department_key(department)}"
