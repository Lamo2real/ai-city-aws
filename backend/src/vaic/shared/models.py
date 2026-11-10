"""The one mapping module from roles to models.

Ledger, caps and prices use the plain names; only this file and ``config/models.json`` know Bedrock IDs.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal, cast

from .config import models_config

Role = Literal["vaic", "orchestrator", "manager", "worker", "utility", "chief_of_staff", "executive"]
ROLES: tuple[Role, ...] = ("vaic", "orchestrator", "manager", "worker", "utility", "chief_of_staff", "executive")
ProfilePrefix = Literal["global", "us", "eu"]
CacheTtl = Literal["5m", "1h"]


@dataclass(frozen=True)
class ResolvedModel:
    name: str
    label: str
    profile_id: str
    """System inference profile ID, e.g. ``<prefix>.<modelId>``."""
    invoke_id: str
    """What to pass as the model: the role's application inference profile ARN when one exists, else profile_id."""


@dataclass(frozen=True)
class RoleModels:
    role: Role
    primary: ResolvedModel
    fallback: ResolvedModel | None
    """One retry target on refusal / no verdict / unavailable. None when the role has none."""
    cache_ttl: CacheTtl
    degraded: bool
    """True when the configured model is not reachable with this prefix and the fallback became primary."""


LEGACY_MODELS = {"fable-5-2": "fable-5-1"}
"""Names that agents and departments may still carry on their ledger records from another Fable version: they resolve
to the Fable this city runs. The owner moved every Fable agent to Fable 5.2 on 2026-11-09 (decision 154) and back to
Fable 5.1 on 2026-11-10 (decision 182), because the account cannot subscribe to Fable 5.2 in AWS Marketplace."""


def current_name(name: str) -> str:
    return LEGACY_MODELS.get(name, name)


def _resolve_name(name: str, prefix: str, cfg: Mapping[str, Any], app_arn: str | None = None) -> ResolvedModel | None:
    name = current_name(name)
    m = cfg["models"].get(name)
    if not m:
        raise ValueError(f"unknown model name: {name}")
    if prefix not in m["prefixes"]:
        return None
    profile_id = f"{prefix}.{m['modelId']}"
    return ResolvedModel(name=name, label=m["label"], profile_id=profile_id, invoke_id=app_arn or profile_id)


WORKER_MODELS = ("opus-5-5", "fable-5-1")
"""What the owner may pick for a department's workers (decision 134): Opus 5.5 unless they say Fable 5.1."""


def department_override(
    role: str,
    department: str | None,
    config: Mapping[str, Any] | None = None,
    dept: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """The model an agent of ``role`` in ``department`` uses instead of its role's (``departmentModels``, decision
    129: Fable for the workers of Media, Research and Legal); None for every other department and role.

    ``dept`` is the department's ledger record: a department the owner built on demand carries its own
    ``worker_model`` (decision 134), which wins over the config for its workers."""
    cfg = config or models_config()
    dm = cfg.get("departmentModels") or {}
    own = current_name(str((dept or {}).get("worker_model") or ""))
    if role == "worker" and own in WORKER_MODELS:
        default = cfg["roles"]["worker"]
        if own == default["model"]:
            return None
        return {"model": own, "fallback": dm.get("fallback") if own == dm.get("model") else default["model"]}
    if role not in (dm.get("roles") or ("manager", "worker")) or not department:
        return None
    names = {str(n).strip().lower() for n in dm.get("departments") or []}
    return dict(dm) if department.strip().lower() in names and dm.get("model") else None


def model_name_for(role: str, department: str | None = None, dept: Mapping[str, Any] | None = None) -> str:
    """The plain model name an agent of ``role`` in ``department`` runs on (what the ledger and the City show)."""
    o = department_override(role, department, dept=dept)
    return str(o["model"]) if o else str(models_config()["roles"][role]["model"])


def resolve_role(
    role: Role,
    prefix: ProfilePrefix | None = None,
    application_profiles: Mapping[str, str] | None = None,
    config: Mapping[str, Any] | None = None,
    department: str | None = None,
    dept: Mapping[str, Any] | None = None,
) -> RoleModels:
    cfg = config or models_config()
    pfx = prefix or cfg["profilePrefix"]
    r = cfg["roles"].get(role)
    if not r:
        raise ValueError(f"unknown role: {role}")
    app_arn = (application_profiles or {}).get(role)
    o = department_override(role, department, cfg, dept)
    if o:
        # The role's application profile copies the role's own model, so a department's model goes through its
        # system profile (its cost is still split by the runtime's AgentRole tag).
        r, app_arn = {**r, "model": o["model"], "fallback": o.get("fallback")}, None
    primary = _resolve_name(r["model"], pfx, cfg, app_arn)
    # An application profile copies one model, so a fallback model is always called through its system profile.
    fallback = _resolve_name(r["fallback"], pfx, cfg) if r.get("fallback") else None
    ttl = cast(CacheTtl, r["cacheTtl"])
    if primary:
        return RoleModels(role=role, primary=primary, fallback=fallback, cache_ttl=ttl, degraded=False)
    if not fallback:
        raise ValueError(f"{r['model']} is not available on {pfx}. profiles and {role} has no fallback")
    return RoleModels(role=role, primary=fallback, fallback=None, cache_ttl=ttl, degraded=True)


def resolve_role_from_env(
    role: Role,
    env: Mapping[str, str] | None = None,
    department: str | None = None,
    dept: Mapping[str, Any] | None = None,
) -> RoleModels:
    """Environment-driven resolution used inside Lambdas and the runtime container."""
    e = os.environ if env is None else env
    prefix = cast(ProfilePrefix | None, e.get("VAIC_PROFILE_PREFIX") or None)
    arn = e.get(f"VAIC_APP_PROFILE_{role.upper()}")
    return resolve_role(
        role, prefix=prefix, application_profiles={role: arn} if arn else {}, department=department, dept=dept
    )


def model_label(name: str) -> str:
    m = models_config()["models"].get(current_name(name))
    return str(m["label"]) if m else name
