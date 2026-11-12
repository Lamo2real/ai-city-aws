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

from vaic.shared.apps import workspace_from_env
from vaic.shared.aws import LambdaFactoryClient, aws_city, require_env
from vaic.shared.clients import client
from vaic.shared.config import caps_config
from vaic.shared.files.service import FilesAccess, FilesService
from vaic.shared.files.wiring import files_from_env
from vaic.shared.guard import startup_guard
from vaic.shared.hierarchy.actions import CityDeps
from vaic.shared.hierarchy.factory import Factory, FactoryClient
from vaic.shared.knowledge.service import KnowledgeAccess, KnowledgeService
from vaic.shared.knowledge.wiring import knowledge_from_env
from vaic.shared.log import log
from vaic.shared.utility import bedrock_converse_runner

MAX_BODY = 1_000_000


class TurnRunner(Protocol):
    async def run_turn(self, inv: dict[str, Any]) -> str: ...


Warm = Callable[[dict[str, Any]], Awaitable[Any]]
VoiceFactory = Callable[[Callable[[dict[str, Any]], Awaitable[None]], dict[str, str]], Any]
"""``voice(send, live)``: a voice session (``vaic.runtime.voice.SonicSession``) for one browser connection. ``live`` is
where VAIC streams replies to the HUD, as last seen on an invocation."""


def create_app(
    host: TurnRunner,
    warm: Warm | None = None,
    on_startup: list[Callable[[], Any]] | None = None,
    voice: VoiceFactory | None = None,
) -> Starlette:
    """``warm`` runs in the background on every warm-keeper ping (VAIC only); ``on_startup`` runs when the server
    starts (eager client creation). Neither may fail a request: both are logged and dropped."""
    state = {"running": 0, "last_update": int(time.time())}
    live: dict[str, str] = {}  # where VAIC's replies stream to the HUD, remembered from invocations for voice turns
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
                # The warm-keeper's ping: answer at once; VAIC's warmer then heats the reply path in the background.
                if warm is not None:
                    spawn(warm(inv), "vaic.warm")
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
        """VAIC's real-time voice (decision 120): one Nova Sonic session per connection, VAIC as its tool."""
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
    from vaic.shared.gateway import GatewayClient, sigv4_headers

    url = e.get("VAIC_GATEWAY_URL")
    return GatewayClient(url, sigv4_headers(city.session, city.region)) if url else None


def _skills(city: Any, e: Mapping[str, str]) -> Any:
    from .skills import SkillStore

    bucket = e.get("VAIC_SKILLS_BUCKET")
    return SkillStore(city.ledger.table, city.session.client("s3"), bucket) if bucket else None


def _owner_api(city: Any, e: Mapping[str, str]) -> Callable[[dict[str, Any]], Awaitable[dict[str, Any]]] | None:
    """VAIC runs a HUD route as the owner by invoking the API Lambda directly (decision 143); IAM lets only VAIC's
    role do that, and the API refuses secret-taking routes on this path too."""
    fn = e.get("VAIC_API_FUNCTION")
    if not fn:
        return None
    lam = client(city.session, "lambda")

    def call(c: dict[str, Any]) -> dict[str, Any]:
        r = lam.invoke(FunctionName=fn, Payload=json.dumps({"vaic_call": c}).encode())
        out = json.loads(r["Payload"].read() or b"{}")
        if r.get("FunctionError"):
            return {"statusCode": 500, "body": json.dumps({"error": str(out.get("errorMessage") or out)[:400]})}
        return out if isinstance(out, dict) else {"statusCode": 500, "body": "unreadable answer"}

    async def run(c: dict[str, Any]) -> dict[str, Any]:
        try:
            return await asyncio.to_thread(call, c)
        except Exception as err:  # the invoke itself failed (IAM, network): say so plainly, and log it (decision 215)
            log("error", "vaic.owner_api_failed", error=type(err).__name__, detail=str(err)[:300])
            why = f"Couldn't reach the city's API ({type(err).__name__})."
            return {"statusCode": 502, "body": json.dumps({"error": why})}

    return run


def factory_for(role: str, city: Any, e: Mapping[str, str]) -> FactoryClient:
    """Managers hire through the Agent Factory Lambda (it holds the hiring logic and rights). VAIC never hires;
    it only sends workers home (`send_workers_home`, `cancel_task`), which is a ledger write and one event, so
    it uses the in-process factory: no Lambda invoke, and nothing for IAM to refuse."""
    if role == "vaic":
        return Factory(city.ledger, city.bus, city.settings)
    return LambdaFactoryClient(client(city.session, "lambda"), e.get("VAIC_FACTORY_FUNCTION", ""))


def build_app(env: Mapping[str, str] | None = None) -> Starlette:
    """Production wiring inside the container."""
    from .direct import _bedrock
    from .engine import sdk_engine
    from .host import AgentHost, HostOptions
    from .live import websocket_sender

    e = os.environ if env is None else env
    startup_guard(e)  # refuse to start without Bedrock, or with any other credential
    role = require_env("VAIC_ROLE", e)
    city = aws_city(e)
    caps = caps_config()
    factory = factory_for(role, city, e)
    minutes = caps["async_job_soft_limit_minutes"] if role == "worker" else caps["turn_timeout_minutes"]
    git_auth = _git_auth(city, e) if role in ("vaic", "worker") else None
    host = AgentHost(
        CityDeps(
            ledger=city.ledger,
            bus=city.bus,
            queue=city.queue,
            factory=factory,
            settings=city.settings,
            max_review_rounds=caps["max_review_rounds"],
            # VAIC's quick triage before delegating runs on the utility model through the runtime's own Bedrock client.
            utility_runner=bedrock_converse_runner(_bedrock()) if role == "vaic" else None,
            # The executives (decision 140): advice for VAIC (when the owner asks) and the Orchestrator (big decisions).
            advisor_runner=bedrock_converse_runner(_bedrock()) if role in ("vaic", "orchestrator") else None,
            # Workers' own S3 prefix; managers use the same session-tagged role to save into Files (decision 147).
            workspace=workspace_from_env(city.session, e) if role in ("worker", "manager") else None,
            knowledge=_knowledge(city.session, city.bus, role, e),
            files=_files(city.session, city.bus, role, e),
            owner_api=_owner_api(city, e) if role == "vaic" else None,
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
            browser=_browser(city, e) if role == "vaic" else None,
        ),
    )
    warmer = _warmer(city, e) if role == "vaic" else None
    if warmer:
        warmer.prepare()
    log("info", "runtime.started", role=role)
    startup = ([warmer.warm] if warmer else []) + ([git_auth.ensure] if git_auth else [])
    return create_app(
        host,
        warm=warmer.warm if warmer else None,
        on_startup=startup or None,
        voice=_voice(host, city) if role == "vaic" else None,
    )


def _voice(host: TurnRunner, city: Any) -> VoiceFactory:
    """VAIC's voice: Nova Sonic speaks and listens; every request runs as a normal VAIC turn, here, in-process."""
    from vaic.shared.config import voice_config
    from vaic.shared.ids import new_id
    from vaic.shared.utility import vaic_voice

    from .prompts import load_prompt
    from .voice import SonicSession, bedrock_opener

    cfg = voice_config()
    cues: dict[str, Any] = cfg.get("cues") or {}
    opener = bedrock_opener(city.session)
    prompt = load_prompt("voice.md").body + "\n\n" + vaic_voice()

    def make(send: Callable[[dict[str, Any]], Awaitable[None]], live: dict[str, str]) -> SonicSession:
        async def ask(text: str) -> str:
            inv = {
                "id": new_id("voice"),
                "role": "vaic",
                "agentId": "vaic",
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

        async def call_brief(call_id: str) -> str | None:
            from vaic.shared.calls import Calls

            call = await Calls(city.ledger.table, city.ledger.now).get(call_id)
            if not call or call.get("state") not in ("ringing", "answered"):
                return None
            about = f" It is about approval {call['approval']}." if call.get("approval") else ""
            return f"[call] You called the owner and they just picked up. You called because: {call['reason']}.{about}"

        return SonicSession(
            send_client=send,
            ask_vaic=ask,
            call_brief=call_brief,
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
    """git and gh signed in with the owner's token (docs/GITHUB_ACCESS.md): VAIC's run_command and workers' shells."""
    from vaic.shared.github import GitHubDeps

    from .github_auth import GitAuth

    return GitAuth(
        GitHubDeps(
            secrets=client(city.session, "secretsmanager"),
            secret_name=e.get("VAIC_GITHUB_SECRET", "vaic/prod/github"),
        )
    )


def _warmer(city: Any, e: Mapping[str, str]) -> Any:
    """VAIC's warmer: the Bedrock client, the HUD's WebSocket sender, a ledger read and a one-token model call."""
    from vaic.shared.models import resolve_role_from_env

    from .direct import _bedrock
    from .live import websocket_sender
    from .warm import VaicWarmer

    async def ledger_read() -> Any:
        return await city.ledger.table.get("WARM", "PING")

    return VaicWarmer(
        bedrock=_bedrock,
        model_id=resolve_role_from_env("vaic", e).primary.invoke_id,
        ledger_read=ledger_read,
        sender=lambda endpoint, table: websocket_sender(endpoint, table, city.region),
    )


def _knowledge(session: Any, bus: Any, role: str, env: Mapping[str, str]) -> KnowledgeAccess | None:
    """Search for every role; VAIC also adds links and texts (it may write ``raw/*`` and ``ITEM#*``)."""
    k = knowledge_from_env(session, env)
    if not k:
        return None
    service = KnowledgeService(store=k.store, blobs=k.blobs, bus=bus) if role == "vaic" and k.blobs else None
    return KnowledgeAccess(store=k.store, kb=k.kb, service=service)


def _files(session: Any, bus: Any, role: str, env: Mapping[str, str]) -> FilesAccess | None:
    """Search for VAIC, managers and workers (records + Titan for the query); VAIC presigns the chat's previews."""
    if role not in ("vaic", "manager", "worker"):
        return None
    f = files_from_env(session, env)
    if not f:
        return None
    service = FilesService(store=f.store, blobs=f.blobs, bus=bus, embedder=f.embedder)
    return FilesAccess(service=service, bucket=f.blobs.bucket)


def _browser(city: Any, e: Mapping[str, str]) -> Any:
    """VAIC's browser (decision 265): AgentCore Browser, screenshots in the files bucket under browser/."""
    if not e.get("FILES_BUCKET") or e.get("VAIC_BROWSER", "on") == "off":
        return None
    from .browser import BROWSER_ID, browse_factory

    return browse_factory(city.session, city.region, e["FILES_BUCKET"], e.get("VAIC_BROWSER_ID") or BROWSER_ID)


def _mail(city: Any, e: Mapping[str, str], role: str | None) -> Any:
    """Mail and calendar for the roles that may have it (never workers, decision 79)."""
    if role == "worker" or not e.get("VAIC_MAIL_WORKLOAD"):
        return None
    from vaic.mail.service import MailService

    async def on_status(a: dict[str, Any]) -> None:
        from vaic.mail.accounts import public

        await city.bus.put({"type": "mail.account", "account": public(a)})

    s = MailService.from_env(city.ledger.table, city.session, city.ledger.now)
    s.on_status = on_status
    return s


def main() -> None:
    import uvicorn

    uvicorn.run(build_app(), host="0.0.0.0", port=int(os.environ.get("PORT", "8080")), log_level="warning")  # noqa: S104


if __name__ == "__main__":
    main()
