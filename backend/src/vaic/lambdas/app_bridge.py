"""The app-bridge Lambda (``vaic-prod-app-bridge``, role ``vaic-prod-fn-app-bridge``).

Invoked synchronously by the api Lambda with ``{app_id, cap, params}`` after it checked the grant, the params and
the rate limit. Only this function reaches the owner's mail/calendar reads and the connectors Gateway for apps;
it is read-only and writes nothing but the audit and rate-limit rows. See ``vaic.shared.app_bridge.serve_bridge``.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any

from vaic.shared.app_bridge import BridgeDeps, serve_bridge
from vaic.shared.app_caps import app_call_from_env, mail_from_env
from vaic.shared.aws import aws_city
from vaic.shared.connector_calls import AppCallDeps
from vaic.shared.gateway import GatewayClient, sigv4_headers

from ._runtime import run

_deps: BridgeDeps | None = None


def app_call_deps(city: Any, env: Mapping[str, str] | None = None) -> AppCallDeps:
    """What ``app_call`` needs: the ledger, and the connectors Gateway signed with this Lambda's own role
    (``VAIC_GATEWAY_URL``, set by Terraform from the connectors module). No URL: connector reads answer
    ``unavailable`` (the grant, rate and audit checks still run)."""
    e = os.environ if env is None else env
    url = e.get("VAIC_GATEWAY_URL")
    gateway = GatewayClient(url, sigv4_headers(city.session, city.region)) if url else None
    return AppCallDeps(ledger=city.ledger, gateway=gateway)


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    global _deps
    if _deps is None:
        city = aws_city()
        _deps = BridgeDeps(
            ledger=city.ledger, city=app_call_deps(city), mail=mail_from_env(city.ledger), app_call=app_call_from_env()
        )
    return run(serve_bridge(event, _deps))
