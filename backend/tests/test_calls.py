"""VAIC calls the owner (decision 245): one call, a message only when it isn't answered, all through SNS to the
AI City app. Fake SNS, fake clock, no AWS."""

import json
from typing import Any

from test_api import ev, js, make
from test_push import TOKEN, FakeSns
from vaic.lambdas.api import handle_http
from vaic.lambdas.notifier import call
from vaic.shared import calls
from vaic.shared.ad_spend import AdLimitStore, over_limit, planned_spend, spend_ask
from vaic.shared.push import DeviceStore, PushApps, PushDeps

VOIP_TOKEN = "cd" * 32
APPS = PushApps(
    "arn:aws:sns:eu-north-1:111122223333:app/APNS/vaic-prod-apns",
    "",
    "arn:aws:sns:eu-north-1:111122223333:app/APNS_VOIP/vaic-prod-apns-voip",
    "",
)
AD = {"type": "approval.requested", "id": "a-1", "agent": "w-1", "kind": "ad.spend",
      "action": "Start this ad campaign? ...", "reason": 'Meta campaign "Boots" plans 500 SEK a day; your daily ad '
      "ceiling is 300 SEK a day. Confirm to go above it.", "at": "2026-11-11T20:00:00Z"}  # fmt: skip


class Sns(FakeSns):
    """FakeSns that also takes the VoIP message attributes and remembers them."""

    def publish(self, TargetArn: str, MessageStructure: str, Message: str, **kw: Any) -> dict[str, str]:  # type: ignore[override]
        r = super().publish(TargetArn, MessageStructure, Message)
        self.published[-1]["attrs"] = kw.get("MessageAttributes")
        return r


async def phones(d: Any, sns: Sns) -> None:
    d.push = PushDeps(store=DeviceStore(d.ledger.table, d.ledger.now), sns=sns, apps=APPS)
    for body in (
        {"token": TOKEN, "platform": "ios"},
        {"token": VOIP_TOKEN, "platform": "ios", "kind": "voip", "bundle": "com.example.aicity"},
    ):
        assert (await handle_http(ev("POST", "/devices", body), d))["statusCode"] == 200


def deps(d: Any, sns: Sns, answer: str | None = None, after: int = 2) -> calls.CallDeps:
    """CallDeps whose sleep plays the phone: after ``after`` polls it reports ``answer`` (or stays silent)."""
    polls = {"n": 0}
    c = calls.CallDeps(d.ledger.table, d.ledger.now, d.push.store, sns, APPS)

    async def sleep(_: float) -> None:
        polls["n"] += 1
        if answer and polls["n"] == after:
            open_calls = [r for (pk, _), r in d.ledger.table.items.items() if pk.startswith(calls.PREFIX)]
            await handle_http(ev("POST", f"/calls/{open_calls[-1]['id']}/{answer}"), d)

    c.sleep = sleep
    return c


def sent(sns: Sns) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """(VoIP rings, alert messages)."""
    ring = [p for p in sns.published if "APNS_VOIP" in p["message"]]
    alert = [p for p in sns.published if "APNS" in p["message"]]
    return ring, alert


async def test_answered_call_rings_once_and_sends_no_message() -> None:
    d, sns = make(), Sns()
    await phones(d, sns)
    r = await call(AD, d.ledger, deps(d, sns, "answered"))
    assert r == {"called": True, "state": "answered", "call": r["call"]}
    ring, alert = sent(sns)
    assert len(ring) == 1 and alert == []
    payload = json.loads(ring[0]["message"]["APNS_VOIP"])
    assert payload["vaic_call"]["approval"] == "a-1" and "300 SEK a day" in payload["vaic_call"]["reason"]
    assert ring[0]["attrs"]["AWS.SNS.MOBILE.APNS.PUSH_TYPE"]["StringValue"] == "voip"
    assert ring[0]["attrs"]["AWS.SNS.MOBILE.APNS.TOPIC"]["StringValue"] == "com.example.aicity.voip"
    assert ring[0]["to"].split("/")[-2] == "vaic-prod-apns-voip"  # the VoIP endpoint only
    ended = js(await handle_http(ev("POST", f"/calls/{r['call']}/ended"), d))
    assert ended["call"]["state"] == "ended" and ended["moved"] is True
    # the same event again (EventBridge retries) never rings twice
    assert (await call(AD, d.ledger, deps(d, sns)))["reason"] == "already called"
    assert len(sent(sns)[0]) == 1


async def test_unanswered_call_sends_one_message_with_yes_no() -> None:
    d, sns = make(), Sns()
    await phones(d, sns)
    r = await call(AD, d.ledger, deps(d, sns))  # the phone never answers: the ring timeout
    assert r["state"] == "messaged"
    ring, alert = sent(sns)
    assert len(ring) == 1 and len(alert) == 1
    msg = json.loads(alert[0]["message"]["APNS"])
    assert msg["aps"]["category"] == calls.CATEGORY and msg["aps"]["alert"]["title"] == "Vice called you"
    assert msg["vaic_call"] == {"id": r["call"], "approval": "a-1"} and msg["aps"]["alert"]["body"].endswith(
        "Yes or No?"
    )
    # a late "missed" from the phone, or a late "answered", changes nothing and sends nothing
    late = js(await handle_http(ev("POST", f"/calls/{r['call']}/missed"), d))
    assert late["moved"] is False
    assert js(await handle_http(ev("POST", f"/calls/{r['call']}/answered"), d))["moved"] is False
    assert len(sent(sns)[1]) == 1


async def test_declined_on_the_phone_messages_at_once_and_the_timeout_adds_nothing() -> None:
    d, sns = make(), Sns()
    await phones(d, sns)
    r = await call(AD, d.ledger, deps(d, sns, "missed", after=1))
    assert r["state"] == "messaged"
    assert len(sent(sns)[1]) == 1


async def test_calls_off_means_the_message_only_and_no_phone_means_the_message_at_once() -> None:
    d, sns = make(), Sns()
    await phones(d, sns)
    await d.ledger.update_settings({"call_owner": False})
    r = await call(AD, d.ledger, deps(d, sns))
    assert r == {"called": False, "reason": "calls off", "messaged": True}
    assert sent(sns)[0] == [] and len(sent(sns)[1]) == 1

    d2, sns2 = make(), Sns()
    d2.push = PushDeps(store=DeviceStore(d2.ledger.table, d2.ledger.now), sns=sns2, apps=APPS)
    await handle_http(ev("POST", "/devices", {"token": TOKEN, "platform": "ios"}), d2)  # no VoIP token yet
    r2 = await call({**AD, "id": "a-2"}, d2.ledger, deps(d2, sns2))
    assert r2["state"] == "messaged" and sent(sns2)[0] == [] and len(sent(sns2)[1]) == 1


async def test_owner_call_me_and_other_events() -> None:
    d, sns = make(), Sns()
    await phones(d, sns)
    me = {"type": "call.requested", "reason": "Testing the call.", "at": "2026-11-11T20:01:00Z"}
    r = await call(me, d.ledger, deps(d, sns, "answered"))
    assert r["called"] is True
    msg = json.loads(sent(sns)[0][0]["message"]["APNS_VOIP"])
    assert msg["vaic_call"] == {"id": r["call"], "reason": "Testing the call.", "approval": ""}
    tool_ask = {**AD, "kind": "tool", "id": "a-9"}
    assert await call(tool_ask, d.ledger, deps(d, sns)) is None  # only the ad spend gate calls
    assert await call({"type": "nonsense"}, d.ledger, deps(d, sns)) is None


async def test_call_routes_are_owner_only_and_unknown_calls_404() -> None:
    d, sns = make(), Sns()
    await phones(d, sns)
    assert (await handle_http(ev("POST", "/calls/call-nope/answered"), d))["statusCode"] == 404
    c = await calls.Calls(d.ledger.table, d.ledger.now).create("Why", "a-1")
    got = js(await handle_http(ev("GET", f"/calls/{c['id']}"), d))["call"]
    assert got == {"id": c["id"], "reason": "Why", "approval": "a-1", "state": "ringing", "created_at": c["created_at"]}
    assert (await handle_http(ev("POST", f"/calls/{c['id']}/answered", {}, "[friends]"), d))["statusCode"] == 403
    devices = js(await handle_http(ev("GET", "/devices"), d))["devices"]
    assert sorted(x["kind"] for x in devices) == ["alert", "voip"]


async def test_a_voip_token_needs_the_voip_app_and_a_valid_bundle() -> None:
    d, sns = make(), Sns()
    d.push = PushDeps(store=DeviceStore(d.ledger.table, d.ledger.now), sns=sns, apps=PushApps("arn:x:app/APNS/a"))
    r = await handle_http(ev("POST", "/devices", {"token": VOIP_TOKEN, "kind": "voip"}), d)
    assert r["statusCode"] == 503
    d.push.apps = APPS
    bad = await handle_http(ev("POST", "/devices", {"token": VOIP_TOKEN, "kind": "voip", "bundle": "no spaces!"}), d)
    assert bad["statusCode"] == 400
    assert (await handle_http(ev("POST", "/devices", {"token": VOIP_TOKEN, "kind": "fax"}), d))["statusCode"] == 400


# ---------- the daily ceiling (300 kr a day) ----------
META = "mcp__gateway__meta-ads___create_adset"


async def test_daily_ceiling_asks_above_it_and_for_a_raise_after_the_budget_is_spent() -> None:
    d = make()
    rec = await AdLimitStore(d.ledger.table, d.ledger.now).set(300, "SEK", "day")
    assert rec["per"] == "day"
    within = {
        "name": "Boots",
        "daily_budget": 25000,
        "end_time": "2026-11-30T00:00:00Z",
    }  # 250 a day (Meta: minor units)
    assert await spend_ask(d.ledger.table, META, within) is None
    raised = {"adset_id": "1", "daily_budget": 50000}  # spent it, wants 500 a day
    why = await spend_ask(d.ledger.table, "mcp__gateway__meta-ads___update_adset", raised)
    assert why is not None and "500 SEK a day" in why and "daily ad ceiling is 300 SEK a day" in why
    life = planned_spend(META, {"lifetime_budget": 600000, "start_time": "2026-11-11", "end_time": "2026-11-21"})
    assert life is not None and life.per_day == 600  # 6,000 over ten days
    assert over_limit(life, {"amount": 300, "currency": "SEK", "per": "day"}) is not None
    assert over_limit(life, {"amount": 10000, "currency": "SEK"}) is None  # per campaign: 6,000 is within 10,000
