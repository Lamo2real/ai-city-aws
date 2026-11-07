"""One push to the owner's iPhone per finished job, nothing for its parts, no email anywhere."""

import json
from typing import Any

from aic.lambdas.api import handle_http
from aic.lambdas.notifier import finished_job, notify, push_text
from aic.shared.caps import default_settings
from aic.shared.hierarchy.actions import move
from aic.shared.push import DeviceStore, PushApps, PushDeps, apns_key_secret, apns_payload, device_id
from city_support import City, make_city, scripted_engine
from test_api import ev, js, make

TOKEN = "ab" * 32
APPS = PushApps("arn:aws:sns:eu-north-1:111122223333:app/APNS/aic-prod-apns", "")


class FakeSns:
    def __init__(self) -> None:
        self.endpoints: dict[str, str] = {}
        self.published: list[dict[str, Any]] = []
        self.disabled: set[str] = set()
        self.deleted: list[str] = []

    def create_platform_endpoint(self, PlatformApplicationArn: str, Token: str) -> dict[str, str]:
        arn = f"{PlatformApplicationArn.replace(':app/', ':endpoint/')}/{Token[:8]}"
        self.endpoints[arn] = Token
        return {"EndpointArn": arn}

    def set_endpoint_attributes(self, EndpointArn: str, Attributes: dict[str, str]) -> None:
        assert EndpointArn in self.endpoints

    def delete_endpoint(self, EndpointArn: str) -> None:
        self.endpoints.pop(EndpointArn, None)
        self.deleted.append(EndpointArn)

    def publish(self, TargetArn: str, MessageStructure: str, Message: str) -> dict[str, str]:
        if TargetArn in self.disabled:
            e = Exception("disabled")
            e.response = {"Error": {"Code": "EndpointDisabled"}}  # type: ignore[attr-defined]
            raise e
        self.published.append({"to": TargetArn, "message": json.loads(Message)})
        return {"MessageId": "m"}


async def city_with_job() -> tuple[City, dict[str, Any], dict[str, Any]]:
    """A top-level job with one assignment part and a worker that has cost 0.4."""
    c = make_city(scripted_engine({}))
    await c.host.ensure_core()
    await c.ledger.create_department("Writing", "Writing work.", "mgr-writing")
    await c.ledger.put_agent(
        {"id": "mgr-writing", "kind": "manager", "role": "Writing Manager", "department": "Writing",
         "model": "fable-5-1", "parent": "orchestrator", "state": "active", "total_cost_usd": 0}
    )  # fmt: skip
    task = await c.ledger.create_ticket(
        {"goal": "A snake game", "from": "ace", "to": "orchestrator", "department": None, "parent_id": None,
         "kind": "task", "owner_words": "make me a snake game", "status": "in_progress"}
    )  # fmt: skip
    part = await c.ledger.create_ticket(
        {"goal": "build it", "from": "orchestrator", "to": "mgr-writing", "department": "Writing",
         "parent_id": task["id"], "kind": "assignment", "status": "in_progress"}
    )  # fmt: skip
    w = await c.factory.hire(
        {"specialty": "Dev", "instructions": "Build the game well.", "tools": ["Read"], "budget_hint_usd": 1},
        "mgr-writing",
        "Writing",
    )
    await c.ledger.update_agent(w["id"], {"ticket_id": part["id"], "worker_state": "working", "total_cost_usd": 0.4})
    return c, task, part


def status_event(ticket: dict[str, Any], previous: str | None) -> dict[str, Any]:
    return {"type": "ticket.status", "ticket": ticket, "previous": previous, "at": "2026-11-07T12:00:00.000Z"}


# ---------- which events notify ----------
async def test_only_a_top_level_job_reaching_its_end_counts() -> None:
    c, task, part = await city_with_job()
    done = await move(c.deps, task["id"], "done", "signed off")
    assert finished_job(status_event(done, "in_progress"))
    assert finished_job(status_event(done, "done")) is None  # was final already: not a second finish
    assert finished_job(status_event(part, "in_progress")) is None  # a part, even when done
    part_done = await move(c.deps, part["id"], "done", "review passed")
    assert finished_job(status_event(part_done, "in_progress")) is None
    assert (
        finished_job({"type": "result", "ticket_id": task["id"], "summary": "x", "at": "2026-11-07T12:00:00.000Z"})
        is None
    )
    assert finished_job({"nonsense": True}) is None


async def test_the_words_name_the_job_and_its_cost() -> None:
    c, task, _ = await city_with_job()
    for status, title, piece in (
        ("done", "Done", "is ready"),
        ("cancelled", "Stopped", "was stopped"),
        ("failed", "Could not finish", "failed"),
    ):
        t, body = await push_text(c.ledger, {**task, "status": status})
        assert t == title and piece in body and "snake" in body.lower() and "$0.40" in body


# ---------- the notifier ----------
async def test_one_push_per_finished_job_to_every_phone_and_never_twice() -> None:
    c, task, _ = await city_with_job()
    store = DeviceStore(c.ledger.table, c.ledger.now)
    sns = FakeSns()
    await store.register(sns, APPS, TOKEN, "ios", False)
    await store.register(sns, APPS, "cd" * 32, "ios", False)
    done = await move(c.deps, task["id"], "done", "signed off")
    r = await notify(status_event(done, "in_progress"), c.ledger, store, sns, APPS)
    assert r["sent"] == 2 and r["reason"] == "sent"
    msg = sns.published[0]["message"]
    assert json.loads(msg["APNS"])["aps"]["alert"] == {"title": "Done", "body": "A snake game is ready. About $0.40."}
    assert json.loads(msg["APNS"])["job"] == task["id"]
    again = await notify(status_event(done, "in_progress"), c.ledger, store, sns, APPS)
    assert again["sent"] == 0 and again["reason"] == "already notified"
    assert len(sns.published) == 2


async def test_parts_never_notify_and_the_switch_turns_it_off() -> None:
    c, task, part = await city_with_job()
    store = DeviceStore(c.ledger.table, c.ledger.now)
    sns = FakeSns()
    await store.register(sns, APPS, TOKEN, "ios", False)
    part_done = await move(c.deps, part["id"], "done", "review passed")
    assert (await notify(status_event(part_done, "in_progress"), c.ledger, store, sns, APPS))["sent"] == 0
    await c.ledger.update_settings({"notify_push": False})
    done = await move(c.deps, task["id"], "done", "signed off")
    r = await notify(status_event(done, "in_progress"), c.ledger, store, sns, APPS)
    assert r == {"sent": 0, "reason": "push off in settings"} and sns.published == []


async def test_without_the_apple_key_it_skips_cleanly() -> None:
    c, task, _ = await city_with_job()
    store = DeviceStore(c.ledger.table, c.ledger.now)
    done = await move(c.deps, task["id"], "done", "signed off")
    r = await notify(status_event(done, "in_progress"), c.ledger, store, None, PushApps())
    assert r == {"sent": 0, "reason": "apns not configured"}


async def test_a_phone_apns_disabled_is_forgotten_on_send() -> None:
    c, task, _ = await city_with_job()
    store = DeviceStore(c.ledger.table, c.ledger.now)
    sns = FakeSns()
    gone = await store.register(sns, APPS, TOKEN, "ios", False)
    await store.register(sns, APPS, "cd" * 32, "ios", False)
    sns.disabled.add(next(a for a in sns.endpoints if a.endswith(TOKEN[:8])))
    done = await move(c.deps, task["id"], "done", "signed off")
    r = await notify(status_event(done, "in_progress"), c.ledger, store, sns, APPS)
    assert r["sent"] == 1 and r["removed"] == 1
    assert [d["id"] for d in await store.list()] != [gone["id"]] and len(await store.list()) == 1


# ---------- devices and the Apple key through the API ----------
class FakeSecrets:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}

    def put_secret_value(self, SecretId: str, SecretString: str) -> None:
        if SecretId not in self.values:
            e = Exception("no")
            e.response = {"Error": {"Code": "ResourceNotFoundException"}}  # type: ignore[attr-defined]
            raise e
        self.values[SecretId] = SecretString

    def create_secret(self, Name: str, SecretString: str, **_: Any) -> None:
        self.values[Name] = SecretString


def push_deps(ledger: Any, sns: FakeSns, apps: PushApps = APPS) -> PushDeps:
    return PushDeps(store=DeviceStore(ledger.table, ledger.now), sns=sns, apps=apps, secrets=FakeSecrets())


async def test_the_phone_registers_once_lists_and_removes() -> None:
    sns = FakeSns()
    d = make()
    d.push = push_deps(d.ledger, sns)
    r = await handle_http(ev("POST", "/devices", {"token": TOKEN, "platform": "ios", "sandbox": False}), d)
    assert r["statusCode"] == 200
    dev = js(r)["device"]
    assert dev["id"] == device_id(TOKEN) and dev["sandbox"] is False and "endpoint_arn" not in dev
    again = js(await handle_http(ev("POST", "/devices", {"token": TOKEN.upper(), "platform": "ios"}), d))
    assert again["device"]["id"] == dev["id"] and len(sns.endpoints) == 1
    assert [x["id"] for x in js(await handle_http(ev("GET", "/devices"), d))["devices"]] == [dev["id"]]
    bad = await handle_http(ev("POST", "/devices", {"token": "not-a-token", "platform": "ios"}), d)
    assert bad["statusCode"] == 400
    assert js(await handle_http(ev("DELETE", f"/devices/{dev['id']}"), d))["removed"] is True
    assert sns.deleted and js(await handle_http(ev("GET", "/devices"), d))["devices"] == []


async def test_registration_waits_for_the_apple_key_and_debug_builds_need_the_sandbox_app() -> None:
    d = make()
    d.push = push_deps(d.ledger, FakeSns(), PushApps())
    r = await handle_http(ev("POST", "/devices", {"token": TOKEN, "platform": "ios"}), d)
    assert r["statusCode"] == 503 and "Apple key" in js(r)["fix"]
    d.push = push_deps(d.ledger, FakeSns(), APPS)  # production only
    r = await handle_http(ev("POST", "/devices", {"token": TOKEN, "platform": "ios", "sandbox": True}), d)
    assert r["statusCode"] == 503
    nothing = make()
    r = await handle_http(ev("POST", "/devices", {"token": TOKEN, "platform": "ios"}), nothing)
    assert r["statusCode"] == 503 and "deploy" in js(r)["error"].lower()


P8 = "-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg\n-----END PRIVATE KEY-----"


async def test_the_apple_key_is_checked_stored_as_a_secret_and_never_echoed() -> None:
    sns = FakeSns()
    d = make()
    d.push = push_deps(d.ledger, sns, PushApps())
    before = js(await handle_http(ev("GET", "/notifications/apns"), d))
    assert before == {"key_saved_at": None, "enabled": False, "devices": [], "secret_name": "aic/prod/apns"}
    bad = await handle_http(
        ev(
            "PUT", "/notifications/apns", {"key_id": "short", "team_id": "ABCDE12345", "bundle_id": "com.x.y", "p8": P8}
        ),
        d,
    )
    assert bad["statusCode"] == 400 and "Key ID" in js(bad)["error"]
    good = await handle_http(
        ev(
            "PUT",
            "/notifications/apns",
            {"key_id": "abcde12345", "team_id": "ABCDE12345", "bundle_id": "com.example.aicity", "p8": P8},
        ),
        d,
    )
    assert good["statusCode"] == 200 and "AIC_APNS_ENABLED" in js(good)["next"]
    assert P8 not in good["body"]
    stored = json.loads(d.push.secrets.values["aic/prod/apns"])  # type: ignore[union-attr]
    assert stored == {"key_id": "ABCDE12345", "team_id": "ABCDE12345", "bundle_id": "com.example.aicity", "p8": P8}
    after = js(await handle_http(ev("GET", "/notifications/apns"), d))
    assert after["key_saved_at"] and after["enabled"] is False


def test_the_payload_and_the_key_check_on_their_own() -> None:
    p = json.loads(apns_payload("Done", "x is ready.", {"job": "t-1"}))
    assert json.loads(p["APNS"]) == {
        "aps": {"alert": {"title": "Done", "body": "x is ready."}, "sound": "default"},
        "job": "t-1",
    }
    assert p["APNS_SANDBOX"] == p["APNS"] and p["default"] == "x is ready."
    try:
        apns_key_secret({"key_id": "ABCDE12345", "team_id": "ABCDE12345", "bundle_id": "com.x.y", "p8": "nope"})
        raise AssertionError("accepted a non-key")
    except ValueError as e:
        assert "p8" in str(e)
    assert default_settings()["notify_push"] is True and "notify_email" not in default_settings()
