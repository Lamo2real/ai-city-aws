"""The warm-keeper: a "warm" ping on exactly the session the dispatcher uses for the owner's chat."""

from typing import Any

from vaic.lambdas.dispatcher import session_id_for
from vaic.lambdas.scheduler import WARM_CONVERSATIONS, run_job, warm_invoker, warm_vaic
from vaic.shared.events import MemoryBus
from vaic.shared.hierarchy.queue import MemoryQueue
from vaic.shared.ledger import Ledger
from vaic.shared.table import MemoryTable

ENV = {"VAIC_OWNER_ID": "owner", "VAIC_RUNTIME_VERSION": "rt-abc123"}


class FakeInvoker:
    def __init__(self, fail: bool = False) -> None:
        self.calls: list[dict[str, Any]] = []
        self.fail = fail

    async def invoke(self, inv: dict[str, Any]) -> None:
        self.calls.append(inv)
        if self.fail:
            raise RuntimeError("runtime answered 500")


async def test_pings_the_owners_conversation_on_the_dispatchers_session_id() -> None:
    inv = FakeInvoker()
    assert await warm_vaic(inv, ENV) == {"warmed": 1, "failed": 0}
    assert WARM_CONVERSATIONS == ("main",)  # what the HUD's POST /messages uses
    (call,) = inv.calls
    assert call["kind"] == "warm" and call["role"] == "vaic" and call["agentId"] == "vaic" and call["async"] is False
    owner_message: Any = {"role": "vaic", "agentId": "vaic", "conversation": "main"}
    assert call["sessionId"] == session_id_for(owner_message, "owner", "rt-abc123")
    assert len(call["sessionId"]) >= 33


async def test_a_new_runtime_version_warms_a_new_session() -> None:
    a, b = FakeInvoker(), FakeInvoker()
    await warm_vaic(a, ENV)
    await warm_vaic(b, {**ENV, "VAIC_RUNTIME_VERSION": "rt-def456"})
    assert a.calls[0]["sessionId"] != b.calls[0]["sessionId"]


async def test_a_failed_ping_is_counted_never_raised_and_the_job_runs_through_run_job() -> None:
    assert await warm_vaic(FakeInvoker(fail=True), ENV) == {"warmed": 0, "failed": 1}
    assert await warm_vaic(None, ENV) == {"skipped": "no runtime to warm"}
    ledger = Ledger(MemoryTable(), None)  # type: ignore[arg-type]
    inv = FakeInvoker()
    assert await run_job("warm_vaic", ledger, MemoryQueue(), MemoryBus(), ENV, invoker=inv) == {
        "warmed": 1,
        "failed": 0,
    }


class FakeAgentCore:
    def __init__(self) -> None:
        self.payloads: list[dict[str, Any]] = []

    def invoke_agent_runtime(self, **kw: Any) -> dict[str, Any]:
        import json

        self.payloads.append(json.loads(kw["payload"]))
        return {"statusCode": 200}


async def test_the_ping_carries_the_huds_websocket_target_so_the_runtime_can_ready_its_sender() -> None:
    client = FakeAgentCore()
    env = {
        **ENV,
        "VAIC_RUNTIME_ARN_VAIC": "arn:vaic",
        "VAIC_WS_ENDPOINT": "https://ws.example/prod",
        "VAIC_CONNECTIONS_TABLE": "conns",
    }
    await warm_vaic(warm_invoker(client, env), env)
    assert client.payloads[0]["kind"] == "warm"
    assert client.payloads[0]["wsEndpoint"] == "https://ws.example/prod"
    assert client.payloads[0]["connectionsTable"] == "conns"
    bare = FakeAgentCore()
    await warm_vaic(warm_invoker(bare, {**ENV, "VAIC_RUNTIME_ARN_VAIC": "arn:vaic"}), ENV)
    assert "wsEndpoint" not in bare.payloads[0]
