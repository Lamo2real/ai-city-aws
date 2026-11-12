"""One owner message, one VAIC turn, and VAIC remembers what it did (decision 192).

The owner asked VAIC to delete two repos: it did, said "Done", and then three more turns for the same message said
it had never deleted anything. The dispatcher's call to the runtime timed out after 10 s and botocore retried it,
starting the same message's turn again; and VAIC's history kept only its final words, so a later turn could not
see the delete it had already run.
"""

import asyncio
from typing import Any

import pytest
from botocore.exceptions import ReadTimeoutError

from city_support import make_city
from test_direct_engine import FakeBedrock, request, text_round, tool_round
from vaic.lambdas.dispatcher import VAIC_CALL, AgentCoreInvoker
from vaic.runtime.direct import direct_engine
from vaic.runtime.engine import EngineRequest
from vaic.runtime.host import ACTION_MARK, action_line
from vaic.runtime.prompts import load_prompt
from vaic.runtime.tools import ToolSpec
from vaic.shared.cost import Usage
from vaic.shared.turn import TurnOutput

DELETE = "gh repo delete ProjectVAIC/test-repo-1 --yes && gh repo delete ProjectVAIC/test-repo-2 --yes"


def inv(body: str = "Yes, delete both. Do it now.", id: str = "owner-del-1") -> dict[str, Any]:
    return {
        "id": id,
        "role": "vaic",
        "agentId": "vaic",
        "department": None,
        "ticketId": "conv-c1",
        "taskId": "conv-c1",
        "kind": "task",
        "from": "owner",
        "body": body,
        "conversation": "c1",
    }


def deleting_engine(prompts: list[str], seen_mid_turn: list[list[str]] | None = None, city: list[Any] | None = None):
    async def engine(req: EngineRequest) -> TurnOutput:
        prompts.append(req.turn.prompt)
        await asyncio.sleep(0.01)  # long enough for a second delivery to arrive while this turn runs
        assert req.on_tool_done
        await req.on_tool_done("run_command", {"command": DELETE}, "exit 0\n✓ Deleted repository", False)
        if seen_mid_turn is not None and city:
            seen_mid_turn.append([r["text"] for r in await city[0].ledger.recent_conversation("c1")])
        return TurnOutput(text="Done, Sir: both repos are deleted.", usage=Usage(input=10, output=8))

    return engine


def replies(city: Any) -> list[dict[str, Any]]:
    return [e for e in city.bus.of_type("vaic.reply") if e.get("done")]


async def test_a_retried_call_for_the_same_message_runs_no_second_turn() -> None:
    prompts: list[str] = []
    city = make_city(deleting_engine(prompts))
    await city.host.ensure_core()
    m = inv()
    await city.host.run_turn(m)
    # botocore retrying the dispatcher's call, SQS redelivering, the crash sweep: the same message again
    assert await city.host.run_turn(m) == ""
    assert await city.host.run_turn({**m, "sessionId": "another"}) == ""
    assert len(prompts) == 1
    assert [e["text"] for e in replies(city)] == ["Done, Sir: both repos are deleted."]
    lines = await city.ledger.recent_conversation("c1")
    assert [r["who"] for r in lines] == ["owner", "vaic", "vaic"]  # message, action, reply: once each


async def test_two_deliveries_at_once_still_run_one_turn() -> None:
    prompts: list[str] = []
    city = make_city(deleting_engine(prompts))
    await city.host.ensure_core()
    await asyncio.gather(city.host.run_turn(inv()), city.host.run_turn(inv()), city.host.run_turn(inv()))
    assert len(prompts) == 1
    assert len(replies(city)) == 1


async def test_a_message_sent_twice_through_the_queue_gets_one_reply() -> None:
    prompts: list[str] = []
    city = make_city(deleting_engine(prompts))
    await city.owner_says("delete both repos")
    await city.owner_says("delete both repos")  # the same message id: the HUD sending twice
    await city.run()
    assert len(prompts) == 1
    assert len(replies(city)) == 1


async def test_the_action_is_in_the_history_while_the_turn_still_runs() -> None:
    prompts: list[str] = []
    mid: list[list[str]] = []
    holder: list[Any] = []
    city = make_city(deleting_engine(prompts, mid, holder))
    holder.append(city)
    await city.host.ensure_core()
    await city.host.run_turn(inv())
    # Before VAIC said a word: the owner's message, then the action, with the command and what came back.
    assert mid[0][0] == "Yes, delete both. Do it now."
    assert mid[0][1].startswith(ACTION_MARK) and "gh repo delete ProjectVAIC/test-repo-1" in mid[0][1]
    assert "→ ok: exit 0" in mid[0][1]
    assert len(mid[0]) == 2


async def test_a_later_turn_reads_the_earlier_delete() -> None:
    prompts: list[str] = []
    city = make_city(deleting_engine(prompts))
    await city.host.ensure_core()
    await city.host.run_turn(inv())

    later: list[str] = []

    async def checking(req: EngineRequest) -> TurnOutput:
        later.append(req.turn.prompt)
        return TurnOutput(text="Already done, Sir: I deleted both a minute ago.", usage=Usage(input=10, output=8))

    city.host.o.engine = checking
    await city.host.run_turn(inv("are there any test repos left?", "owner-check-2"))
    p = later[0]
    log_at = p.index(ACTION_MARK)
    assert "gh repo delete ProjectVAIC/test-repo-2" in p[log_at:]
    assert p.index("Owner: Yes, delete both") < log_at < p.index("VAIC: Done, Sir: both repos are deleted.")


async def test_read_only_tools_are_not_logged() -> None:
    async def engine(req: EngineRequest) -> TurnOutput:
        assert req.on_tool_done
        await req.on_tool_done("get_status", {}, "2 jobs running", False)
        return TurnOutput(text="Two jobs running, Sir.", usage=Usage(input=10, output=8))

    city = make_city(engine)
    await city.host.ensure_core()
    await city.host.run_turn(inv("status?", "owner-s"))
    assert [r["text"] for r in await city.ledger.recent_conversation("c1")] == ["status?", "Two jobs running, Sir."]


async def test_a_turn_that_failed_before_acting_may_run_again_but_not_after() -> None:
    calls: list[str] = []

    async def flaky(req: EngineRequest) -> TurnOutput:
        calls.append("x")
        raise RuntimeError("throttled")

    city = make_city(flaky)
    await city.host.ensure_core()
    with pytest.raises(RuntimeError):
        await city.host.run_turn(inv(id="owner-f"))
    first = len(calls)  # the gated turn's own backoff retries
    with pytest.raises(RuntimeError):
        await city.host.run_turn(inv(id="owner-f"))
    assert len(calls) == 2 * first  # nothing was done: the message's next delivery ran again

    async def acts_then_fails(req: EngineRequest) -> TurnOutput:
        calls.append("y")
        assert req.on_tool_done
        await req.on_tool_done("run_command", {"command": DELETE}, "exit 0", False)
        raise RuntimeError("stream broke")

    city.host.o.engine = acts_then_fails
    with pytest.raises(RuntimeError):
        await city.host.run_turn(inv(id="owner-g"))
    tries = calls.count("y")
    assert await city.host.run_turn(inv(id="owner-g")) == ""  # it already acted: the next delivery never runs
    assert calls.count("y") == tries


async def test_the_direct_engine_reports_each_finished_tool_before_the_next_round() -> None:
    done: list[tuple[str, dict[str, Any], str, bool]] = []
    ran: list[str] = []

    async def run(a: dict[str, Any]) -> str:
        ran.append(a["command"])
        return "exit 0\n✓ Deleted"

    async def on_tool_done(name: str, args: dict[str, Any], out: str, error: bool) -> None:
        assert ran  # after the tool ran
        done.append((name, args, out, error))

    tool = ToolSpec("run_command", "Run a command.", {"type": "object"}, run)
    req = request([tool], [])
    req.on_tool_done = on_tool_done
    fake = FakeBedrock([tool_round("run_command", '{"command": "gh repo delete a/b --yes"}'), text_round("Done.")])
    await direct_engine(req, fake)
    assert done == [("run_command", {"command": "gh repo delete a/b --yes"}, "exit 0\n✓ Deleted", False)]


def test_the_action_line_says_what_ran_when_and_whether_it_worked() -> None:
    ok = action_line("run_command", {"command": DELETE}, "exit 0\n✓ Deleted", False, "2026-11-10T19:40:12.000Z")
    assert ok.startswith("[VAIC action 2026-11-10 19:40 UTC] run_command: gh repo delete ProjectVAIC/test-repo-1")
    assert "→ ok: exit 0 ✓ Deleted" in ok
    bad = action_line(
        "run_command", {"command": "gh repo delete x/y --yes"}, "exit 1\nnot found", False, "2026-11-10T19:41Z"
    )
    assert "→ FAILED: exit 1 not found" in bad
    denied = action_line(
        "cancel_task", {"which": "porsche", "confirm": True}, "Denied by policy: no", False, "2026-11-10T19:41Z"
    )
    assert "cancel_task: which=porsche, confirm=True → FAILED" in denied
    assert len(action_line("run_command", {"command": "x" * 5000}, "y" * 5000, False, "2026-11-10T19:41Z")) < 700


class _Client:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.calls = 0

    def invoke_agent_runtime(self, **_: Any) -> dict[str, Any]:
        self.calls += 1
        if self.error:
            raise self.error
        return {"statusCode": 200}


async def test_vaic_is_called_once_on_its_own_client_and_a_slow_turn_is_left_running() -> None:
    shared, own = _Client(), _Client(ReadTimeoutError(endpoint_url="https://agentcore"))
    invoker = AgentCoreInvoker(shared, {"vaic": "arn:vaic", "worker": "arn:worker"}, vaic_client=own)
    await invoker.invoke({**inv(), "sessionId": "s"})  # no exception: the message is not sent again
    assert (own.calls, shared.calls) == (1, 0)
    await invoker.invoke({**inv(), "role": "worker", "sessionId": "s"})
    assert shared.calls == 1


async def test_other_roles_still_fail_on_a_timeout() -> None:
    slow = _Client(ReadTimeoutError(endpoint_url="https://agentcore"))
    invoker = AgentCoreInvoker(slow, {"worker": "arn:worker"})
    with pytest.raises(ReadTimeoutError):
        await invoker.invoke({**inv(), "role": "worker", "sessionId": "s"})


def test_vaics_call_never_retries_and_outwaits_a_tool_turn() -> None:
    assert VAIC_CALL.retries == {"mode": "standard", "max_attempts": 1}
    assert 60 <= VAIC_CALL.read_timeout < 120  # the dispatcher Lambda's timeout


def test_the_prompt_asks_for_simple_informal_structured_answers() -> None:
    body = load_prompt("vaic.md").body
    for rule in (
        "always answer me in a simple and structured manner",
        "casual, chill, informal",
        "Answer first, in the first line",
        "short bullets or numbered steps",
        "Say each thing once. No corporate filler",
        'You call the owner "bro"',
        "no lists, tables, headings or code",  # spoken replies stay speech
    ):
        assert rule in body, rule
    for name in ("voice.md", "voice_live.md"):
        assert "Informal and simple" in load_prompt(name).body or "Simple and informal" in load_prompt(name).body


def test_the_prompt_trusts_its_own_action_log() -> None:
    body = load_prompt("vaic.md").body
    assert ACTION_MARK in body
    assert "Never deny, doubt or apologise for an action the log shows" in body
    assert 'Say "Done" only after the tool actually came back successful' in body
