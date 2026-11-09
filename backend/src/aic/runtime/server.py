"""The AgentCore Runtime container: plain HTTP on port 8080 (TLS ends at AgentCore), ARM64.

GET /ping reports Healthy or HealthyBusy (an async worker job is still running).
POST /invocations runs one turn; worker jobs are accepted at once and run in the background.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import time
from collections.abc import AsyncIterator, Awaitable, Callable, Mapping
from typing import Any, Protocol

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route, WebSocketRoute
from starlette.websockets import WebSocket, WebSocketDisconnect

from aic.shared.apps import workspace_from_env
from aic.shared.aws import LambdaFactoryClient, aws_city, require_env
from aic.shared.clients import client
from aic.shared.config import caps_config
from aic.shared.guard import startup_guard
from aic.shared.hierarchy.actions import CityDeps
from aic.shared.hierarchy.factory import Factory, FactoryClient
from aic.shared.knowledge.service import KnowledgeAccess, KnowledgeService
from aic.shared.knowledge.wiring import knowledge_from_env
from aic.shared.log import log
from aic.shared.utility import bedrock_converse_runner

MAX_BODY = 1_000_000


class TurnRunner(Protocol):
    async def run_turn(self, inv: dict[str, Any]) -> str: ...


Warm = Callable[[dict[str, Any]], Awaitable[Any]]
VoiceFactory = Callable[[Callable[[dict[str, Any]], Awaitable[None]], dict[str, str]], Any]
"""``voice(send, live)``: a voice session (``aic.runtime.voice.SonicSession``) for one browser connection. ``live`` is
where AIC streams replies to the HUD, as last seen on an invocation."""


def create_app(
    host: TurnRunner,
    warm: Warm | None = None,
    on_startup: list[Callable[[], Any]] | None = None,
    voice: VoiceFactory | None = None,
) -> Starlette:
    """``warm`` runs in the background on every warm-keeper ping (AIC only); ``on_startup`` runs when the server
    starts (eager client creation). Neither may fail a request: both are logged and dropped."""
    state = {"running": 0, "last_update": int(time.time())}
    live: dict[str, str] = {}  # where AIC's replies stream to the HUD, remembered from invocations for voice turns
    background: set[asyncio.Task[Any]] = set()

    def spawn(coro: Awaitable[Any], what: str) -> None:
        async def run() -> None:
            try:
                await coro
            except Exception as e:
                log("warn", f"{what}.failed", error=type(e).__name__)

        task = asyncio.create_task(run())
        background.add(task)
        task.add_done_callback(background.discard)

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
            if isinstance(inv, dict) and inv.get("kind") == "warm":
                # The warm-keeper's ping: answer at once; AIC's warmer then heats the reply path in the background.
                if warm is not None:
                    spawn(warm(inv), "aic.warm")
                return JSONResponse({"status": "warm"})
            if isinstance(inv, dict) and inv.get("wsEndpoint") and inv.get("connectionsTable"):
                live.update(wsEndpoint=str(inv["wsEndpoint"]), connectionsTable=str(inv["connectionsTable"]))
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

            spawn(job(), "turn")
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

    async def voice_ws(ws: WebSocket) -> None:
        """AIC's real-time voice (decision 120): one Nova Sonic session per connection, AIC as its tool."""
        await ws.accept()
        if voice is None:
            await ws.send_text(json.dumps({"type": "error", "message": "Voice is not available here."}))
            await ws.close()
            return
        lock = asyncio.Lock()

        async def send(msg: dict[str, Any]) -> None:
            async with lock:
                await ws.send_text(json.dumps(msg))

        session = voice(send, live)
        state["running"] += 1  # HealthyBusy while someone talks, so the session is never recycled mid-sentence
        try:
            try:
                await session.start()
            except Exception as e:
                log("warn", "voice.start_failed", error=type(e).__name__, detail=str(e)[:300])
                await send({"type": "error", "message": str(e)[:300] or "Nova Sonic is not available"})
                return
            while True:
                raw = await ws.receive_text()
                try:
                    msg = json.loads(raw)
                except ValueError:
                    continue
                if isinstance(msg, dict):
                    await session.on_client(msg)
                    if msg.get("type") == "stop":
                        break
        except WebSocketDisconnect:
            pass
        finally:
            state["running"] -= 1
            state["last_update"] = int(time.time())
            await session.close()
            with contextlib.suppress(Exception):
                await ws.close()

    async def not_found(_: Request, __: Exception) -> JSONResponse:
        return JSONResponse({"error": "not found"}, status_code=404)

    @contextlib.asynccontextmanager
    async def lifespan(_: Starlette) -> AsyncIterator[None]:
        for f in on_startup or []:
            try:
                r = f()
                if asyncio.iscoroutine(r):
                    spawn(r, "startup")
            except Exception as e:
                log("warn", "startup.failed", error=type(e).__name__)
        yield

    return Starlette(
        routes=[
            Route("/ping", ping, methods=["GET"]),
            Route("/invocations", invocations, methods=["POST"]),
            WebSocketRoute("/ws", voice_ws),
        ],
        exception_handlers={404: not_found, 405: not_found},
        lifespan=lifespan,
    )


def _gateway(city: Any, e: Mapping[str, str]) -> Any:
    from aic.shared.gateway import GatewayClient, sigv4_headers

    url = e.get("AIC_GATEWAY_URL")
    return GatewayClient(url, sigv4_headers(city.session, city.region)) if url else None


def _skills(city: Any, e: Mapping[str, str]) -> Any:
    from .skills import SkillStore

    bucket = e.get("AIC_SKILLS_BUCKET")
    return SkillStore(city.ledger.table, city.session.client("s3"), bucket) if bucket else None


def factory_for(role: str, city: Any, e: Mapping[str, str]) -> FactoryClient:
    """Managers hire through the Agent Factory Lambda (it holds the hiring logic and rights). AIC never hires;
    it only sends workers home (`send_workers_home`, `cancel_task`), which is a ledger write and one event, so
    it uses the in-process factory: no Lambda invoke, and nothing for IAM to refuse."""
    if role == "ace":
        return Factory(city.ledger, city.bus, city.settings)
    return LambdaFactoryClient(client(city.session, "lambda"), e.get("AIC_FACTORY_FUNCTION", ""))


def build_app(env: Mapping[str, str] | None = None) -> Starlette:
    """Production wiring inside the container."""
    from .direct import _bedrock
    from .engine import sdk_engine
    from .host import AgentHost, HostOptions
    from .live import websocket_sender

    e = os.environ if env is None else env
    startup_guard(e)  # refuse to start without Bedrock, or with any other credential
    role = require_env("AIC_ROLE", e)
    city = aws_city(e)
    caps = caps_config()
    factory = factory_for(role, city, e)
    minutes = caps["async_job_soft_limit_minutes"] if role == "worker" else caps["turn_timeout_minutes"]
    git_auth = _git_auth(city, e) if role in ("ace", "worker") else None
    host = AgentHost(
        CityDeps(
            ledger=city.ledger,
            bus=city.bus,
            queue=city.queue,
            factory=factory,
            settings=city.settings,
            max_review_rounds=caps["max_review_rounds"],
            # AIC's quick triage before delegating runs on the utility model through the runtime's own Bedrock client.
            utility_runner=bedrock_converse_runner(_bedrock()) if role == "ace" else None,
            # The executives (decision 140): advice for AIC (when the owner asks) and the Orchestrator (big decisions).
            advisor_runner=bedrock_converse_runner(_bedrock()) if role in ("ace", "orchestrator") else None,
            workspace=workspace_from_env(city.session, e) if role == "worker" else None,
            knowledge=_knowledge(city.session, city.bus, role, e),
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
            mail=_mail(city, e, role),
            git_auth=git_auth,
        ),
    )
    warmer = _warmer(city, e) if role == "ace" else None
    if warmer:
        warmer.prepare()
    log("info", "runtime.started", role=role)
    startup = ([warmer.warm] if warmer else []) + ([git_auth.ensure] if git_auth else [])
    return create_app(
        host,
        warm=warmer.warm if warmer else None,
        on_startup=startup or None,
        voice=_voice(host, city) if role == "ace" else None,
    )


def _voice(host: TurnRunner, city: Any) -> VoiceFactory:
    """AIC's voice: Nova Sonic speaks and listens; every request runs as a normal AIC turn, here, in-process."""
    from aic.shared.config import voice_config
    from aic.shared.ids import new_id

    from .prompts import load_prompt
    from .voice import SonicSession, bedrock_opener

    cfg = voice_config()
    cues: dict[str, Any] = cfg.get("cues") or {}
    opener = bedrock_opener(city.session)
    prompt = load_prompt("voice.md").body

    def make(send: Callable[[dict[str, Any]], Awaitable[None]], live: dict[str, str]) -> SonicSession:
        async def ask(text: str) -> str:
            inv = {
                "id": new_id("voice"),
                "role": "ace",
                "agentId": "ace",
                "department": None,
                "ticketId": "conv-main",
                "taskId": "conv-main",
                "kind": "task",
                "from": "owner",
                "body": text,
                "conversation": "main",
                "voice": True,
                **live,
            }
            return await host.run_turn(inv)

        return SonicSession(
            send_client=send,
            ask_aic=ask,
            open_stream=opener,
            system_prompt=prompt,
            voice_id=str(cfg.get("voiceId") or "tiffany"),
            sensitivity=str(cfg.get("endpointingSensitivity") or "MEDIUM"),
            cue_after_s=float(cues.get("afterMs", 1500)) / 1000,
            cue_again_s=float(cues.get("againMs", 10000)) / 1000,
            max_cues=int(cues.get("max", 2)),
        )

    return make


def _git_auth(city: Any, e: Mapping[str, str]) -> Any:
    """git and gh signed in with the owner's token (docs/GITHUB_ACCESS.md): AIC's run_command and workers' shells."""
    from aic.shared.github import GitHubDeps

    from .github_auth import GitAuth

    return GitAuth(
        GitHubDeps(
            secrets=client(city.session, "secretsmanager"),
            secret_name=e.get("AIC_GITHUB_SECRET", "aic/prod/github"),
        )
    )


def _warmer(city: Any, e: Mapping[str, str]) -> Any:
    """AIC's warmer: the Bedrock client, the HUD's WebSocket sender, a ledger read and a one-token model call."""
    from aic.shared.models import resolve_role_from_env

    from .direct import _bedrock
    from .live import websocket_sender
    from .warm import AceWarmer

    async def ledger_read() -> Any:
        return await city.ledger.table.get("WARM", "PING")

    return AceWarmer(
        bedrock=_bedrock,
        model_id=resolve_role_from_env("ace", e).primary.invoke_id,
        ledger_read=ledger_read,
        sender=lambda endpoint, table: websocket_sender(endpoint, table, city.region),
    )


def _knowledge(session: Any, bus: Any, role: str, env: Mapping[str, str]) -> KnowledgeAccess | None:
    """Search for every role; AIC also adds links and texts (it may write ``raw/*`` and ``ITEM#*``)."""
    k = knowledge_from_env(session, env)
    if not k:
        return None
    service = KnowledgeService(store=k.store, blobs=k.blobs, bus=bus) if role == "ace" and k.blobs else None
    return KnowledgeAccess(store=k.store, kb=k.kb, service=service)


def _mail(city: Any, e: Mapping[str, str], role: str | None) -> Any:
    """Mail and calendar for the roles that may have it (never workers, decision 79)."""
    if role == "worker" or not e.get("AIC_MAIL_WORKLOAD"):
        return None
    from aic.mail.service import MailService

    async def on_status(a: dict[str, Any]) -> None:
        from aic.mail.accounts import public

        await city.bus.put({"type": "mail.account", "account": public(a)})

    s = MailService.from_env(city.ledger.table, city.session, city.ledger.now)
    s.on_status = on_status
    return s


def main() -> None:
    import uvicorn

    uvicorn.run(build_app(), host="0.0.0.0", port=int(os.environ.get("PORT", "8080")), log_level="warning")  # noqa: S104


if __name__ == "__main__":
    main()
