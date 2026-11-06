"""The Agent Factory Lambda, invoked by manager runtimes. It owns hire validation and the agent records."""

from __future__ import annotations

from typing import Any

from aic.shared.aws import aws_city
from aic.shared.hierarchy.factory import Factory, FactoryClient
from aic.shared.log import log

from ._runtime import run


async def handle_factory(req: dict[str, Any], factory: FactoryClient) -> dict[str, Any]:
    try:
        if req.get("action") == "hire":
            agent = await factory.hire(req["spec"], req["managerId"], req["department"])
        elif req.get("action") == "release":
            agent = await factory.release(req["workerId"], req["managerId"])
        else:
            return {"ok": False, "error": f"unknown action {req.get('action')!r}"}
        log("info", f"factory.{req['action']}", agent=agent["id"], department=agent.get("department"))
        return {"ok": True, "agent": agent}
    except Exception as e:
        return {"ok": False, "error": str(e)}


_cached: Factory | None = None


def handler(req: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    global _cached
    if _cached is None:
        city = aws_city()
        _cached = Factory(city.ledger, city.bus, city.settings)
    return run(handle_factory(req, _cached))
