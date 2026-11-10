"""WebSocket API.

A Lambda authorizer that validates the Cognito token on $connect, connection bookkeeping in DynamoDB with a
TTL, and a broadcaster that pushes every city event to the HUD.
"""

from __future__ import annotations

import asyncio
import json
import time
from datetime import UTC, datetime
from typing import Any, Literal, Protocol

from pydantic import ValidationError

from vaic.shared.aws import require_env
from vaic.shared.clients import config_for
from vaic.shared.events import now_iso, parse_event
from vaic.shared.log import log
from vaic.shared.table import DynamoTable, Table, UpdateOptions

from ._runtime import run

CONNECTION_TTL_SECONDS = 2 * 3600


# ---------- authorizer ----------
class TokenVerifier(Protocol):
    def verify(self, token: str) -> dict[str, Any]:
        """Returns the token's claims, or raises when the token is not valid."""
        ...


class CognitoVerifier:
    """Verifies a Cognito ID token: signature (JWKS), issuer, audience (the app client) and token_use."""

    def __init__(self, region: str, user_pool_id: str, client_id: str) -> None:
        import jwt

        self._issuer = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"
        self._client_id = client_id
        self._jwks = jwt.PyJWKClient(f"{self._issuer}/.well-known/jwks.json", cache_keys=True)

    def verify(self, token: str) -> dict[str, Any]:
        import jwt

        key = self._jwks.get_signing_key_from_jwt(token)
        claims: dict[str, Any] = jwt.decode(
            token, key.key, algorithms=["RS256"], audience=self._client_id, issuer=self._issuer
        )
        if claims.get("token_use") != "id":
            raise ValueError("not an id token")
        return claims


def _policy(principal: str, effect: Literal["Allow", "Deny"], arn: str) -> dict[str, Any]:
    return {
        "principalId": principal,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [{"Action": "execute-api:Invoke", "Effect": effect, "Resource": arn}],
        },
    }


def authorize(event: dict[str, Any], verifier: TokenVerifier) -> dict[str, Any]:
    # Browsers cannot set headers on a WebSocket, so the token travels as a subprotocol or query value.
    headers = event.get("headers") or {}
    proto = headers.get("Sec-WebSocket-Protocol") or headers.get("sec-websocket-protocol")
    token = (event.get("queryStringParameters") or {}).get("token")
    if not token and proto:
        token = next((s.strip() for s in proto.split(",") if len(s.strip().split(".")) == 3), None)
    deny = _policy("anonymous", "Deny", event["methodArn"])
    if not token:
        return deny
    try:
        claims = verifier.verify(token)
    except Exception:
        return deny
    if "owner" not in (claims.get("cognito:groups") or []):
        return deny
    return {**_policy(claims["sub"], "Allow", event["methodArn"]), "context": {"sub": claims["sub"]}}


# ---------- connect / disconnect / default ----------
async def on_connection(event: dict[str, Any], table: Table, now_ms: int | None = None) -> dict[str, Any]:
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    ctx = event["requestContext"]
    id = ctx["connectionId"]
    route = ctx["routeKey"]
    if route == "$connect":
        await table.put(
            {
                "pk": f"CONN#{id}",
                "sk": "META",
                "gsi1pk": "CONN",
                "gsi1sk": id,
                "connected_at": now_iso(datetime.fromtimestamp(now / 1000, UTC)),
                "ttl": now // 1000 + CONNECTION_TTL_SECONDS,
            }
        )
        return {"statusCode": 200}
    if route == "$disconnect":
        await table.delete(f"CONN#{id}", "META")
        return {"statusCode": 200}
    # Keep-alive: the HUD pings every few minutes; refreshing the TTL keeps the connection listed.
    await table.update(
        f"CONN#{id}", "META", UpdateOptions(set={"ttl": now // 1000 + CONNECTION_TTL_SECONDS}, must_exist=True)
    )
    return {"statusCode": 200, "body": json.dumps({"type": "pong"})}


# ---------- broadcast ----------
class Poster(Protocol):
    async def post(self, connection_id: str, data: str) -> Literal["ok", "gone"]: ...


async def broadcast(detail: Any, table: Table, poster: Poster) -> dict[str, int]:
    try:
        e = parse_event(detail)
    except (ValidationError, TypeError):
        return {"sent": 0, "gone": 0}
    data = json.dumps(e)
    counts = {"sent": 0, "gone": 0}

    async def one(c: dict[str, Any]) -> None:
        cid = str(c["gsi1sk"])
        if await poster.post(cid, data) == "gone":
            counts["gone"] += 1
            await table.delete(f"CONN#{cid}", "META")
        else:
            counts["sent"] += 1

    # One connection that fails never stops the others, or makes the whole event be delivered a second time.
    for r in await asyncio.gather(*(one(c) for c in await table.query_index("gsi1", "CONN")), return_exceptions=True):
        if isinstance(r, BaseException):
            log("error", "ws.post_failed", error=f"{type(r).__name__}: {r}")
    return counts


class ApiGatewayPoster:
    def __init__(self, client: Any) -> None:
        self._client = client

    async def post(self, connection_id: str, data: str) -> Literal["ok", "gone"]:
        try:
            await asyncio.to_thread(self._client.post_to_connection, ConnectionId=connection_id, Data=data.encode())
            return "ok"
        except Exception as e:
            if (getattr(e, "response", None) or {}).get("Error", {}).get("Code") == "GoneException":
                return "gone"
            raise


# ---------- wiring ----------
_table: Table | None = None
_verifier: TokenVerifier | None = None
_poster: Poster | None = None


def _connections() -> Table:
    global _table
    if _table is None:
        import boto3

        _table = DynamoTable(
            boto3.resource("dynamodb", region_name=require_env("AWS_REGION"), config=config_for("dynamodb")).Table(
                require_env("VAIC_CONNECTIONS_TABLE")
            )
        )
    return _table


def authorizer_handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    global _verifier
    if _verifier is None:
        _verifier = CognitoVerifier(
            require_env("AWS_REGION"), require_env("VAIC_USER_POOL_ID"), require_env("VAIC_USER_POOL_CLIENT_ID")
        )
    return authorize(event, _verifier)


def connection_handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    return run(on_connection(event, _connections()))


def broadcast_handler(event: dict[str, Any], _context: Any = None) -> dict[str, int]:
    global _poster
    if _poster is None:
        import boto3

        _poster = ApiGatewayPoster(
            boto3.client(
                "apigatewaymanagementapi",
                region_name=require_env("AWS_REGION"),
                endpoint_url=require_env("VAIC_WS_ENDPOINT"),
                config=config_for("apigatewaymanagementapi"),
            )
        )
    r = run(broadcast(event.get("detail"), _connections(), _poster))
    log("info", "ws.broadcast", **r)
    return r
