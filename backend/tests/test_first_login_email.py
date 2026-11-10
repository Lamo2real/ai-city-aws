"""The one route that works before sign-in: "send me a new first-login email"."""

import json
from datetime import UTC, datetime, timedelta
from typing import Any

from vaic.lambdas.api import ApiDeps, handle_http
from vaic.shared.caps import default_settings
from vaic.shared.events import MemoryBus
from vaic.shared.hierarchy.queue import MemoryQueue
from vaic.shared.ledger import Ledger
from vaic.shared.table import MemoryTable

OWNER = "owner@example.com"


class Clock:
    def __init__(self) -> None:
        self.t = datetime(2026, 11, 6, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.t


class FakeCognito:
    def __init__(self, fail_with: str | None = None) -> None:
        self.calls: list[dict[str, Any]] = []
        self.fail_with = fail_with

    def admin_create_user(self, **kw: Any) -> dict[str, Any]:
        self.calls.append(kw)
        if self.fail_with:
            e = Exception("no")
            e.response = {"Error": {"Code": self.fail_with}}  # type: ignore[attr-defined]
            raise e
        return {}


def make(cognito: FakeCognito, clock: Clock) -> ApiDeps:
    ledger = Ledger(MemoryTable(), clock)

    async def settings() -> dict[str, Any]:
        return await ledger.settings(default_settings())

    return ApiDeps(
        ledger=ledger,
        bus=MemoryBus(),
        queue=MemoryQueue(),
        settings=settings,
        cognito=cognito,
        user_pool_id="eu-north-1_pool",
        owner_email=OWNER,
    )


def ev(email: Any, groups: Any = None) -> dict[str, Any]:
    claims = {} if groups is None else {"cognito:groups": groups}
    return {
        "rawPath": "/auth/first-login-email",
        "requestContext": {"http": {"method": "POST"}, "authorizer": {"jwt": {"claims": claims}}},
        "body": json.dumps({"email": email}),
    }


async def test_re_sends_the_owners_invitation_without_a_token() -> None:
    c = FakeCognito()
    r = await handle_http(ev("  Owner@Example.com "), make(c, Clock()))
    assert r["statusCode"] == 202
    assert c.calls == [
        {
            "UserPoolId": "eu-north-1_pool",
            "Username": OWNER,
            "MessageAction": "RESEND",
            "DesiredDeliveryMediums": ["EMAIL"],
        }
    ]


async def test_answers_the_same_for_any_other_email_and_sends_nothing() -> None:
    c = FakeCognito()
    d = make(c, Clock())
    mine = await handle_http(ev(OWNER), d)
    other = await handle_http(ev("someone@else.com"), make(FakeCognito(), Clock()))
    assert json.loads(other["body"]) == json.loads(mine["body"])
    assert other["statusCode"] == mine["statusCode"] == 202
    c2 = FakeCognito()
    await handle_http(ev("someone@else.com"), make(c2, Clock()))
    assert c2.calls == []


async def test_sends_at_most_once_every_10_minutes() -> None:
    c, clock = FakeCognito(), Clock()
    d = make(c, clock)
    for _ in range(3):
        assert (await handle_http(ev(OWNER), d))["statusCode"] == 202
    assert len(c.calls) == 1
    clock.t += timedelta(minutes=11)
    await handle_http(ev(OWNER), d)
    assert len(c.calls) == 2


async def test_an_owner_who_already_chose_a_password_gets_the_same_answer() -> None:
    c = FakeCognito(fail_with="UnsupportedUserStateException")
    r = await handle_http(ev(OWNER), make(c, Clock()))
    assert r["statusCode"] == 202
    assert len(c.calls) == 1


async def test_a_missing_email_is_a_plain_400() -> None:
    r = await handle_http(ev(""), make(FakeCognito(), Clock()))
    assert r["statusCode"] == 400
    assert "email" in json.loads(r["body"])["error"]


async def test_every_other_route_still_needs_the_owner_group() -> None:
    e = ev(OWNER)
    e["rawPath"] = "/city"
    e["requestContext"]["http"]["method"] = "GET"
    assert (await handle_http(e, make(FakeCognito(), Clock())))["statusCode"] == 403
