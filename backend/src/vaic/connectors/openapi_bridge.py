"""The bridge Lambda's calls for ``transport = "openapi"`` (``docs/CONNECTORS_SKILLS.md`` §1.11).

One tool call becomes one HTTPS request to the spec's base host: path parameters URL-encoded, query, headers and
a JSON body, plus the credential from AgentCore Identity (in memory, at call time). Redirects are followed only
to https on the same host, the call has 30 s, the answer at most 5 MB and must be JSON or text. Any copy of the
credential in an answer is cut out, and logs carry only the connector id, the tool, the status and the time.
"""

from __future__ import annotations

import asyncio
import base64
import contextlib
import json
import time
import urllib.parse
from collections.abc import Callable, Mapping
from dataclasses import replace
from typing import Any

from vaic.shared.connectors import Record, check_url, system_resolver
from vaic.shared.log import log
from vaic.shared.mcp_http import HttpResponse

from .openapi import ApiRequest, ArgError, Credential, Spec, build_request, host_of, redact, spec_store

OWNER_USER = "owner"
CALL_TIMEOUT = 30.0
MAX_ANSWER = 5_000_000
ERROR_CHARS = 2000
MAX_REDIRECTS = 3
LOGIN_EXPIRED = "login_expired"


class NeedsLogin(Exception):
    """No usable OAuth token for the owner: sign in (again)."""


class NeedsKey(Exception):
    """The API key or OAuth client isn't there (yet)."""


class TooLarge(Exception):
    pass


class CallError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


ApiSend = Callable[[ApiRequest, float, int], HttpResponse]
"""(request, timeout seconds, max body bytes) -> response. Blocking, never follows redirects, raises TooLarge."""


def httpx_send(req: ApiRequest, timeout: float, cap: int) -> HttpResponse:
    """The production sender: httpx, no redirects, no proxies from the environment, streamed under the cap and
    the overall deadline."""
    import httpx

    deadline = time.monotonic() + timeout
    with (
        httpx.Client(follow_redirects=False, timeout=timeout, trust_env=False) as client,
        client.stream(req.method, req.url, headers=dict(req.headers), content=req.body) as r,
    ):
        length = r.headers.get("content-length")
        if length and length.isdigit() and int(length) > cap:
            raise TooLarge
        buf = bytearray()
        for chunk in r.iter_bytes():
            buf += chunk
            if len(buf) > cap:
                raise TooLarge
            if time.monotonic() > deadline:
                raise httpx.ReadTimeout("deadline")
        return HttpResponse(r.status_code, {k.lower(): v for k, v in r.headers.items()}, bytes(buf))


SEND: ApiSend = httpx_send
RESOLVE: Callable[[str], list[str]] = system_resolver


# ---------- credentials ----------
def credential(rec: Mapping[str, Any], identity: Any, workload: str) -> Credential:
    """Where the connector's credential goes, from ``openapi.auth``. Raises NeedsLogin / NeedsKey."""
    auth = (rec.get("openapi") or {}).get("auth") or {"kind": "none"}
    if auth.get("kind") == "none":
        return Credential()
    provider = rec.get("provider_name") or f"vaic-conn-{rec['id']}"
    wt = identity.get_workload_access_token_for_user_id(workloadName=workload, userId=OWNER_USER)["workloadAccessToken"]
    if auth["kind"] == "api_key":
        try:
            key = str(
                identity.get_resource_api_key(workloadIdentityToken=wt, resourceCredentialProviderName=provider)[
                    "apiKey"
                ]
            )
        except Exception as e:
            raise NeedsKey from e
        value = base64.b64encode(key.encode()).decode() if auth.get("basic") else key
        full = f"{auth.get('prefix') or ''}{value}"
        secrets = (full, value, key)
        if auth.get("in") == "query":
            return Credential(query={str(auth["name"]): full}, secrets=secrets)
        return Credential(headers={str(auth["name"]): full}, secrets=secrets)
    m2m = (rec.get("oauth") or {}).get("flow") == "client_credentials"
    try:
        r = identity.get_resource_oauth2_token(
            workloadIdentityToken=wt,
            resourceCredentialProviderName=provider,
            scopes=list((rec.get("oauth") or {}).get("scopes") or []),
            oauth2Flow="M2M" if m2m else "USER_FEDERATION",
        )
    except Exception as e:
        if m2m:
            raise NeedsKey from e
        raise
    token = r.get("accessToken")
    if not token:  # an authorization URL instead: nobody is signed in, or the vault can't refresh
        raise NeedsKey if m2m else NeedsLogin
    return Credential(headers={"Authorization": f"Bearer {token}"}, secrets=(str(token),))


# ---------- one call ----------
_JSON = ("application/json",)


def _readable(ctype: str) -> bool:
    base = ctype.split(";", maxsplit=1)[0].strip().lower()
    return base in _JSON or base.endswith("+json") or base.startswith("text/")


async def execute(
    spec: Spec,
    op: Mapping[str, Any],
    args: Mapping[str, Any],
    cred: Credential,
    send: ApiSend,
    resolve: Callable[[str], list[str]],
) -> tuple[int, str]:
    """(status, body text, credential cut out). Raises ArgError, CallError or TooLarge."""
    req = build_request(spec, op, args, cred)
    host = host_of(str(spec["base_url"]))
    if bad := check_url(f"https://{host}/", resolve):  # again at call time: the name may now point elsewhere
        raise CallError("blocked", bad)
    for _ in range(MAX_REDIRECTS + 1):
        r = await asyncio.to_thread(send, req, CALL_TIMEOUT, MAX_ANSWER)
        loc = r.headers.get("location")
        if r.status in (301, 302, 303, 307, 308) and loc:
            nxt = urllib.parse.urljoin(req.url, loc)
            p = urllib.parse.urlsplit(nxt)
            if p.scheme != "https" or p.netloc.lower() != host:
                raise CallError(
                    "redirected", "The API sent the call to another address, which the city doesn't follow."
                )
            if r.status == 303:
                req = replace(
                    req, method="GET", body=None, headers={k: v for k, v in req.headers.items() if k != "content-type"}
                )
            req = replace(req, url=nxt)
            continue
        break
    else:
        raise CallError("redirected", "The API redirected the call too many times.")
    ctype = r.headers.get("content-type", "")
    if r.body and not _readable(ctype):
        raise CallError(
            "unsupported", f"The API answered with {ctype.split(';')[0][:60] or 'a file'}, which the city doesn't read."
        )
    text = r.body.decode("utf-8", "replace")
    if "json" in ctype.lower():
        with contextlib.suppress(ValueError):
            text = json.dumps(json.loads(text), ensure_ascii=False)
    return r.status, redact(text, cred.secrets)


def _error(code: str, message: str) -> dict[str, Any]:
    return {"isError": True, "vaic_error": code, "content": [{"type": "text", "text": message}]}


_cache: dict[str, Spec] = {}


async def load_spec(rec: Mapping[str, Any], store: Any = None) -> Spec:
    key = str((rec.get("openapi") or {}).get("spec_key") or "")
    if key not in _cache:
        raw = await asyncio.to_thread((store or spec_store()).get, key)
        if len(_cache) >= 32:
            _cache.clear()
        _cache[key] = json.loads(raw)
    return _cache[key]


async def call(
    rec: Record,
    tool: str,
    args: dict[str, Any],
    d: Any,
    *,
    send: ApiSend | None = None,
    resolve: Callable[[str], list[str]] | None = None,
    store: Any = None,
) -> dict[str, Any]:
    """One tool call for the bridge Lambda. ``d`` is its ``BridgeDeps`` (store, identity, workload)."""
    cid, label = rec["id"], rec.get("label") or rec["id"]
    t0 = time.monotonic()
    status: int | str = "-"
    try:
        spec = await load_spec(rec, store)
        op = next((o for o in spec["operations"] if o["name"] == tool), None)
        if op is None:
            return _error("unknown_tool", f"{label} has no tool {tool}.")
        cred = Credential() if op.get("no_auth") else await asyncio.to_thread(credential, rec, d.identity, d.workload)
        status, text = await execute(spec, op, args, cred, send or SEND, resolve or RESOLVE)
    except (NeedsLogin, NeedsKey) as e:
        what = "sign in again" if isinstance(e, NeedsLogin) else "enter its key or client again in Settings"
        msg = f"{label} needs the owner to {what}."
        await d.store.update(cid, {"status": LOGIN_EXPIRED, "error": msg})
        log("warn", "connector.login_expired", connector=cid)
        return _error(LOGIN_EXPIRED, msg)
    except ArgError as e:
        return _error("bad_input", str(e))
    except CallError as e:
        log("warn", "connector.call_failed", connector=cid, tool=tool, error=e.code)
        return _error(e.code, str(e))
    except TooLarge:
        log("warn", "connector.call_failed", connector=cid, tool=tool, error="too_large")
        return _error("too_large", f"{label} answered with more than 5 MB.")
    except Exception as e:
        log("warn", "connector.call_failed", connector=cid, tool=tool, error=type(e).__name__)
        return _error("failed", f"{label} could not be reached.")
    ms = round((time.monotonic() - t0) * 1000)
    log("info", "connector.call", connector=cid, tool=tool, status=status, ms=ms)
    if not 200 <= int(status) < 300:
        return _error("http_error", f"{label} answered HTTP {status}: {text[:ERROR_CHARS]}")
    return {"isError": False, "content": [{"type": "text", "text": f"HTTP {status}\n{text}"}]}
