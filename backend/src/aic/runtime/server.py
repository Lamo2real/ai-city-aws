"""The AgentCore Runtime container: plain HTTP on port 8080 (TLS ends at AgentCore), ARM64.

GET /ping reports Healthy or HealthyBusy (an async worker job is still running).
POST /invocations runs one turn; worker jobs are accepted at once and run in the background.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from collections.abc import Mapping
from typing import Any, Protocol

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from aic.shared.aws import LambdaFactoryClient, aws_city, require_env
from aic.shared.config import caps_config
from aic.shared.guard import startup_guard
from aic.shared.hierarchy.actions import CityDeps
from aic.shared.log import log

MAX_BODY = 1_000_000


class TurnRunner(Protocol):
    async def run_turn(self, inv: dict[str, Any]) -> str: ...


def create_app(host: TurnRunner) -> Starlette:
    state = {"running": 0, "last_update": int(time.time())}
    background: set[asyncio.Task[None]] = set()

    async def track(inv: dict[str, Any]) -> str:
        state["running"] += 1
        state["last_update"] = int(time.time())
        try:
            return await host.run_turn(inv)
        finally:
            state["running"] -= 1
            state["last_update"] = int(time.time())

    async def ping(_: Request) -> JSONResponse:
        return JSONResponse(
            {"status": "HealthyBusy" if state["running"] else "Healthy", "time_of_last_update": state["last_update"]}
        )

    async def invocations(request: Request) -> JSONResponse:
        raw = await request.body()
        try:
            if len(raw) > MAX_BODY:
                raise ValueError("payload too large")
            inv = json.loads(raw)
            if not isinstance(inv, dict) or not inv.get("id") or not inv.get("role") or not inv.get("agentId"):
                raise ValueError("bad invocation")
        except ValueError:
            return JSONResponse({"status": "error", "error": "invalid invocation"}, status_code=400)
        if inv.get("async"):

            async def job() -> None:
                try:
                    await track(inv)
                except Exception as e:
                    log(
                        "error",
                        "turn.failed",
                        agent=inv["agentId"],
                        ticket=inv.get("ticketId"),
                        error=type(e).__name__,
                        detail=str(e)[:1500],
                    )

            task = asyncio.create_task(job())
            background.add(task)
            task.add_done_callback(background.discard)
            return JSONResponse({"status": "accepted"}, status_code=202)
        try:
            response = await track(inv)
            return JSONResponse({"status": "success", "response": response})
        except Exception as e:
            log(
                "error",
                "turn.failed",
                agent=inv["agentId"],
                ticket=inv.get("ticketId"),
                error=type(e).__name__,
                detail=str(e)[:1500],
            )
            return JSONResponse({"status": "error", "error": type(e).__name__}, status_code=500)

    async def not_found(_: Request, __: Exception) -> JSONResponse:
        return JSONResponse({"error": "not found"}, status_code=404)

    return Starlette(
        routes=[Route("/ping", ping, methods=["GET"]), Route("/invocations", invocations, methods=["POST"])],
        exception_handlers={404: not_found, 405: not_found},
    )


def _gateway(city: Any, e: Mapping[str, str]) -> Any:
    from .gateway import GatewayClient, sigv4_headers

    url = e.get("AIC_GATEWAY_URL")
    return GatewayClient(url, sigv4_headers(city.session, city.region)) if url else None


def _skills(city: Any, e: Mapping[str, str]) -> Any:
    from .skills import SkillStore

    bucket = e.get("AIC_SKILLS_BUCKET")
    return SkillStore(city.ledger.table, city.session.client("s3"), bucket) if bucket else None


def build_app(env: Mapping[str, str] | None = None) -> Starlette:
    """Production wiring inside the container."""
    from .engine import sdk_engine
    from .host import AgentHost, HostOptions
    from .live import websocket_sender

    e = os.environ if env is None else env
    startup_guard(e)  # refuse to start without Bedrock, or with any other credential
    role = require_env("AIC_ROLE", e)
    city = aws_city(e)
    caps = caps_config()
    factory = LambdaFactoryClient(city.session.client("lambda"), e.get("AIC_FACTORY_FUNCTION", ""))
    minutes = caps["async_job_soft_limit_minutes"] if role == "worker" else caps["turn_timeout_minutes"]
    host = AgentHost(
        CityDeps(
            ledger=city.ledger,
            bus=city.bus,
            queue=city.queue,
            factory=factory,
            settings=city.settings,
            max_review_rounds=caps["max_review_rounds"],
        ),
        HostOptions(
            engine=sdk_engine,
            role=role,
            timeout_ms=minutes * 60_000,
            live_sender=lambda inv: (
                websocket_sender(inv["wsEndpoint"], inv["connectionsTable"], city.region)
                if inv.get("wsEndpoint") and inv.get("connectionsTable")
                else None
            ),
            gateway=_gateway(city, e),
            skills=_skills(city, e),
        ),
    )
    log("info", "runtime.started", role=role)
    return create_app(host)


def main() -> None:
    import uvicorn

    uvicorn.run(build_app(), host="0.0.0.0", port=int(os.environ.get("PORT", "8080")), log_level="warning")  # noqa: S104


if __name__ == "__main__":
    main()
