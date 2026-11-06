"""The one mapping module from roles to models.

Ledger, caps and prices use the plain names; only this file and ``config/models.json`` know Bedrock IDs.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal, cast

from .config import models_config

Role = Literal["ace", "orchestrator", "manager", "worker", "utility"]
ROLES: tuple[Role, ...] = ("ace", "orchestrator", "manager", "worker", "utility")
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


def _resolve_name(name: str, prefix: str, cfg: Mapping[str, Any], app_arn: str | None = None) -> ResolvedModel | None:
    m = cfg["models"].get(name)
    if not m:
        raise ValueError(f"unknown model name: {name}")
    if prefix not in m["prefixes"]:
        return None
    profile_id = f"{prefix}.{m['modelId']}"
    return ResolvedModel(name=name, label=m["label"], profile_id=profile_id, invoke_id=app_arn or profile_id)


def resolve_role(
    role: Role,
    prefix: ProfilePrefix | None = None,
    application_profiles: Mapping[str, str] | None = None,
    config: Mapping[str, Any] | None = None,
) -> RoleModels:
    cfg = config or models_config()
    pfx = prefix or cfg["profilePrefix"]
    r = cfg["roles"].get(role)
    if not r:
        raise ValueError(f"unknown role: {role}")
    app_arn = (application_profiles or {}).get(role)
    primary = _resolve_name(r["model"], pfx, cfg, app_arn)
    # An application profile copies one model, so a fallback model is always called through its system profile.
    fallback = _resolve_name(r["fallback"], pfx, cfg) if r.get("fallback") else None
    ttl = cast(CacheTtl, r["cacheTtl"])
    if primary:
        return RoleModels(role=role, primary=primary, fallback=fallback, cache_ttl=ttl, degraded=False)
    if not fallback:
        raise ValueError(f"{r['model']} is not available on {pfx}. profiles and {role} has no fallback")
    return RoleModels(role=role, primary=fallback, fallback=None, cache_ttl=ttl, degraded=True)


def resolve_role_from_env(role: Role, env: Mapping[str, str] | None = None) -> RoleModels:
    """Environment-driven resolution used inside Lambdas and the runtime container."""
    e = os.environ if env is None else env
    prefix = cast(ProfilePrefix | None, e.get("AIC_PROFILE_PREFIX") or None)
    arn = e.get(f"AIC_APP_PROFILE_{role.upper()}")
    return resolve_role(role, prefix=prefix, application_profiles={role: arn} if arn else {})


def model_label(name: str) -> str:
    m = models_config()["models"].get(name)
    return str(m["label"]) if m else name
