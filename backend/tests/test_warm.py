"""AIC's warmer: every warm-keeper ping readies the WebSocket sender, the ledger and the model, in the background."""

import asyncio
import json
from typing import Any

import httpx

from aic.runtime.server import create_app
from aic.runtime.warm import AceWarmer


class FakeBedrock:
    def __init__(self, fail: bool = False) -> None:
        self.calls: list[dict[str, Any]] = []
        self.fail = fail

    def converse(self, **kw: Any) -> dict[str, Any]:
        self.calls.append(kw)
        if self.fail:
            raise RuntimeError("no model")
        return {"output": {"message": {"content": [{"text": "ok"}]}}}


def make(bedrock: FakeBedrock, ledger_calls: list[str], senders: list[tuple[str, str]]) -> AceWarmer:
    async def ledger_read() -> Any:
        ledger_calls.append("get")
        return None

    return AceWarmer(
        bedrock=lambda: bedrock,
        model_id="arn:profile/aic-ace",
        ledger_read=ledger_read,
        sender=lambda endpoint, table: senders.append((endpoint, table)),
    )


async def test_a_warm_pass_readies_the_sender_reads_the_ledger_and_asks_the_model_for_one_token() -> None:
    b, ledger, senders = FakeBedrock(), [], []
    out = await make(b, ledger, senders).warm({"wsEndpoint": "https://ws.example/prod", "connectionsTable": "conns"})
    assert senders == [("https://ws.example/prod", "conns")]
    assert ledger == ["get"]
    assert b.calls[0]["modelId"] == "arn:profile/aic-ace"
    assert b.calls[0]["inferenceConfig"] == {"maxTokens": 1}
    assert "toolConfig" not in b.calls[0]
    assert out["sender"] == "ready" and "model_ms" in out and "ledger_ms" in out and "total_ms" in out


async def test_without_a_websocket_target_the_sender_is_skipped_and_failures_are_reported_not_raised() -> None:
    b, ledger, senders = FakeBedrock(fail=True), [], []
    out = await make(b, ledger, senders).warm({})
    assert senders == [] and "sender" not in out
    assert out["model"] == "RuntimeError" and ledger == ["get"]


def test_prepare_creates_the_client_and_never_fails_startup() -> None:
    made: list[int] = []

    def bedrock() -> Any:
        made.append(1)
        return FakeBedrock()

    async def ledger_read() -> Any:
        return None

    AceWarmer(bedrock, "m", ledger_read).prepare()
    assert made == [1]

    def broken() -> Any:
        raise RuntimeError("no credentials")

    AceWarmer(broken, "m", ledger_read).prepare()  # logged, not raised


class NoTurns:
    async def run_turn(self, inv: dict[str, Any]) -> str:
        raise AssertionError("a warm ping must never run a turn")


async def test_the_server_answers_a_warm_ping_at_once_and_runs_the_warmer_in_the_background() -> None:
    seen: list[dict[str, Any]] = []
    started = asyncio.Event()

    async def warm(inv: dict[str, Any]) -> None:
        seen.append(inv)
        started.set()

    app = create_app(NoTurns(), warm=warm)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post(
            "/invocations", content=json.dumps({"kind": "warm", "wsEndpoint": "https://w", "connectionsTable": "t"})
        )
        assert r.status_code == 200 and r.json() == {"status": "warm"}
        await asyncio.wait_for(started.wait(), 2)
    assert seen[0]["wsEndpoint"] == "https://w"


async def test_a_warmer_that_fails_is_logged_and_the_ping_still_answers() -> None:
    async def warm(inv: dict[str, Any]) -> None:
        raise RuntimeError("boom")

    app = create_app(NoTurns(), warm=warm)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post("/invocations", content=json.dumps({"kind": "warm"}))
        assert r.status_code == 200
        await asyncio.sleep(0)  # let the background task run and fail
        assert (await c.get("/ping")).json()["status"] == "Healthy"
