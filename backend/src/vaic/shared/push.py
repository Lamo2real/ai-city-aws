"""iPhone push notifications through Amazon SNS mobile push (APNs).

The owner's phones register their APNs device tokens (``POST /devices``); each becomes an SNS platform
endpoint under the city's APNs application (production, or the sandbox one for debug builds). One push goes
out per finished job (see ``vaic.lambdas.notifier``). No email anywhere: the owner asked for exactly one
notification per large feature, on the phone, and nothing else.

Since decision 245 a phone can also register a PushKit VoIP token (``kind: "voip"``): that is how VAIC calls the
owner (``vaic.shared.calls``). VoIP endpoints live under the VoIP platform applications and only ever get a call.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from .events import now_iso
from .log import log
from .table import Item, Table

DEVICE_PREFIX = "DEVICE#"
DEVICE_INDEX_PK = "DEVICE"
_TOKEN = re.compile(r"^[0-9a-fA-F]{64,400}$")
_GONE = {"EndpointDisabled", "NotFound", "NotFoundException", "EndpointDisabledException"}


@dataclass(frozen=True)
class PushApps:
    """The SNS platform application ARNs; empty strings until the owner's Apple key is deployed."""

    production: str = ""
    sandbox: str = ""
    voip: str = ""
    voip_sandbox: str = ""

    @property
    def configured(self) -> bool:
        return bool(self.production or self.sandbox)

    def for_build(self, sandbox: bool, kind: str = "alert") -> str:
        if kind == "voip":
            return self.voip_sandbox if sandbox else self.voip
        return self.sandbox if sandbox else self.production


def device_id(token: str) -> str:
    """A stable id for a device token that never exposes the token itself."""
    return "d-" + hashlib.sha256(token.strip().lower().encode()).hexdigest()[:24]


def valid_token(token: Any) -> str:
    if not isinstance(token, str) or not _TOKEN.fullmatch(token.strip()):
        raise ValueError("The device token is missing or not an APNs token.")
    return token.strip().lower()


def _error_code(e: Exception) -> str:
    return str((getattr(e, "response", None) or {}).get("Error", {}).get("Code", ""))


def apns_payload(title: str, body: str, data: dict[str, Any] | None = None, category: str = "") -> str:
    """The SNS message for an APNs push: one alert, default sound, the extra data beside ``aps``; ``category``
    gives it the iPhone's action buttons (``VAIC_DECIDE``: Yes / No)."""
    aps: dict[str, Any] = {"alert": {"title": title, "body": body}, "sound": "default"}
    if category:
        aps["category"] = category
    alert = json.dumps({"aps": aps, **(data or {})})
    return json.dumps({"default": body, "APNS": alert, "APNS_SANDBOX": alert})


def voip_payload(data: dict[str, Any]) -> str:
    """The SNS message for a PushKit VoIP push: the app reports an incoming call the moment it arrives."""
    voip = json.dumps({"aps": {}, **data})
    return json.dumps({"default": "Vice is calling", "APNS_VOIP": voip, "APNS_VOIP_SANDBOX": voip})


KINDS = ("alert", "voip")


class DeviceStore:
    """The owner's registered phones, in the ledger table under ``DEVICE#<id>``."""

    def __init__(self, table: Table, now: Callable[[], datetime]) -> None:
        self.table = table
        self.now = now

    async def list(self) -> list[Item]:
        rows = await self.table.query_index("gsi1", DEVICE_INDEX_PK)
        return [self._public(r) for r in rows]

    async def voip_phones(self) -> Sequence[Item]:
        return [r for r in await self.table.query_index("gsi1", DEVICE_INDEX_PK) if r.get("kind") == "voip"]

    async def get(self, id: str) -> Item | None:
        return await self.table.get(f"{DEVICE_PREFIX}{id}", "META")

    async def register(
        self, sns: Any, apps: PushApps, token: str, platform: str, sandbox: bool, kind: str = "alert", bundle: str = ""
    ) -> Item:
        """Creates (or re-points) the SNS endpoint for this token and remembers it. Idempotent per token. ``kind``
        voip is the PushKit token VAIC calls (``bundle`` is the app's bundle id: VoIP pushes go to ``<bundle>.voip``)."""
        token = valid_token(token)
        if platform != "ios":
            raise ValueError("Only iPhone (ios) devices can be registered.")
        if kind not in KINDS:
            raise ValueError("kind is alert or voip.")
        if bundle and not _BUNDLE.fullmatch(bundle):
            raise ValueError("The bundle id looks like com.example.aicity.")
        app = apps.for_build(sandbox, kind)
        if not app:
            raise RuntimeError("push is not configured")
        id = device_id(token)
        existing = await self.get(id)
        r = await asyncio.to_thread(sns.create_platform_endpoint, PlatformApplicationArn=app, Token=token)
        endpoint = str(r["EndpointArn"])
        # Re-registration with the same token returns the same endpoint; make sure it is enabled and current.
        await asyncio.to_thread(
            sns.set_endpoint_attributes, EndpointArn=endpoint, Attributes={"Token": token, "Enabled": "true"}
        )
        at = now_iso(self.now())
        item: Item = {
            "pk": f"{DEVICE_PREFIX}{id}",
            "sk": "META",
            "gsi1pk": DEVICE_INDEX_PK,
            "gsi1sk": id,
            "id": id,
            "platform": platform,
            "sandbox": sandbox,
            "kind": kind,
            "endpoint_arn": endpoint,
            "created_at": existing["created_at"] if existing else at,
            "updated_at": at,
        }
        if bundle:
            item["bundle"] = bundle
        await self.table.put(item)
        log("info", "push.device_registered", device=id, sandbox=sandbox, kind=kind, new=existing is None)
        return self._public(item)

    async def remove(self, sns: Any, id: str) -> bool:
        item = await self.get(id)
        if not item:
            return False
        try:
            await asyncio.to_thread(sns.delete_endpoint, EndpointArn=item["endpoint_arn"])
        except Exception as e:  # a gone endpoint is already what we want
            if _error_code(e) not in _GONE:
                raise
        await self.table.delete(item["pk"], "META")
        log("info", "push.device_removed", device=id)
        return True

    async def push_all(
        self, sns: Any, title: str, body: str, data: dict[str, Any] | None = None, category: str = ""
    ) -> dict[str, int]:
        """Sends one push to every registered phone; phones whose endpoint APNs disabled are forgotten."""
        message = apns_payload(title, body, data, category)
        rows = [r for r in await self.table.query_index("gsi1", DEVICE_INDEX_PK) if r.get("kind", "alert") == "alert"]
        return await self._publish(sns, rows, lambda _: {"MessageStructure": "json", "Message": message})

    async def ring(self, sns: Any, data: dict[str, Any]) -> dict[str, int]:
        """A VoIP push to every phone that registered one: each rings (CallKit) as an incoming call from Vice."""
        message = voip_payload(data)

        def args(item: Item) -> dict[str, Any]:
            attrs = {
                "AWS.SNS.MOBILE.APNS.PUSH_TYPE": {"DataType": "String", "StringValue": "voip"},
                "AWS.SNS.MOBILE.APNS.PRIORITY": {"DataType": "String", "StringValue": "10"},
            }
            if item.get("bundle"):
                attrs["AWS.SNS.MOBILE.APNS.TOPIC"] = {"DataType": "String", "StringValue": f"{item['bundle']}.voip"}
            return {"MessageStructure": "json", "Message": message, "MessageAttributes": attrs}

        return await self._publish(sns, await self.voip_phones(), args)

    async def _publish(self, sns: Any, rows: Sequence[Item], args: Callable[[Item], dict[str, Any]]) -> dict[str, int]:
        counts = {"sent": 0, "removed": 0, "failed": 0}
        for item in rows:
            try:
                await asyncio.to_thread(sns.publish, TargetArn=item["endpoint_arn"], **args(item))
                counts["sent"] += 1
            except Exception as e:
                if _error_code(e) in _GONE:
                    await self.table.delete(item["pk"], "META")
                    counts["removed"] += 1
                    log("info", "push.device_gone", device=item.get("id"))
                else:
                    counts["failed"] += 1
                    log("warn", "push.failed", device=item.get("id"), error=type(e).__name__)
        return counts

    @staticmethod
    def _public(item: Item) -> Item:
        return {k: item[k] for k in ("id", "platform", "sandbox", "kind", "created_at", "updated_at") if k in item}


# ---------- the Apple key (what the owner pastes in Settings) ----------
APNS_SECRET_DEFAULT = "vaic/prod/apns"  # noqa: S105  (a secret's name, not a secret)
_KEY_ID = re.compile(r"^[A-Z0-9]{10}$")
_BUNDLE = re.compile(r"^[A-Za-z0-9.-]{3,160}$")


def apns_key_secret(b: dict[str, Any]) -> str:
    """Validates the pasted Apple key and returns the secret's JSON. Never logged, never echoed back."""
    key_id = str(b.get("key_id") or "").strip().upper()
    team_id = str(b.get("team_id") or "").strip().upper()
    bundle_id = str(b.get("bundle_id") or "").strip()
    p8 = str(b.get("p8") or "").strip()
    if not _KEY_ID.fullmatch(key_id):
        raise ValueError("The Key ID is 10 letters or digits (from Apple Developer → Keys).")
    if not _KEY_ID.fullmatch(team_id):
        raise ValueError("The Team ID is 10 letters or digits (top right in Apple Developer).")
    if not _BUNDLE.fullmatch(bundle_id):
        raise ValueError("The Bundle ID looks like com.example.aicity.")
    if "BEGIN PRIVATE KEY" not in p8 or "END PRIVATE KEY" not in p8 or len(p8) > 8192:
        raise ValueError("Paste the whole .p8 file, from BEGIN PRIVATE KEY to END PRIVATE KEY.")
    return json.dumps({"key_id": key_id, "team_id": team_id, "bundle_id": bundle_id, "p8": p8})


def store_apns_secret(secrets: Any, name: str, value: str, kms_key: str | None, tags: dict[str, str]) -> None:
    """Creates the secret's value, or updates it when Terraform already created the (empty) secret."""
    try:
        secrets.put_secret_value(SecretId=name, SecretString=value)
    except Exception as e:
        if _error_code(e) != "ResourceNotFoundException":
            raise
        secrets.create_secret(
            Name=name,
            SecretString=value,
            **({"KmsKeyId": kms_key} if kms_key else {}),
            Tags=[{"Key": k, "Value": v} for k, v in tags.items()],
        )


@dataclass
class PushDeps:
    """What the API needs for ``/devices`` and ``/notifications/apns``."""

    store: DeviceStore
    sns: Any
    apps: PushApps
    secrets: Any = None
    secret_name: str = APNS_SECRET_DEFAULT
    kms_key: str | None = None
    tags: dict[str, str] = field(default_factory=dict)
