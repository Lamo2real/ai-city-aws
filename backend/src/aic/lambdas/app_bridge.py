"""The app-bridge Lambda (``aic-prod-app-bridge``, role ``aic-prod-fn-app-bridge``).

Invoked synchronously by the api Lambda with ``{app_id, cap, params}`` after it checked the grant, the params and
the rate limit. Only this function reaches the owner's mail/calendar reads and the connectors Gateway for apps;
it is read-only and writes nothing but the audit and rate-limit rows. See ``aic.shared.app_bridge.serve_bridge``.
"""

from __future__ import annotations

from typing import Any

from aic.shared.app_bridge import BridgeDeps, serve_bridge
from aic.shared.app_caps import app_call_from_env, mail_from_env
from aic.shared.aws import aws_city
from aic.shared.config import caps_config
from aic.shared.hierarchy.actions import CityDeps
from aic.shared.ledger import Record

from ._runtime import run


class _NoFactory:
    async def hire(self, spec: dict[str, Any], manager_id: str, department: str) -> Record:
        raise RuntimeError("the app bridge does not hire")

    async def release(self, worker_id: str, manager_id: str) -> Record:
        raise RuntimeError("the app bridge does not release")


_deps: BridgeDeps | None = None


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    global _deps
    if _deps is None:
        city = aws_city()
        cd = CityDeps(
            ledger=city.ledger,
            bus=city.bus,
            queue=city.queue,
            factory=_NoFactory(),
            settings=city.settings,
            max_review_rounds=caps_config()["max_review_rounds"],
        )
        _deps = BridgeDeps(ledger=city.ledger, city=cd, mail=mail_from_env(city.ledger), app_call=app_call_from_env())
    return run(serve_bridge(event, _deps))
