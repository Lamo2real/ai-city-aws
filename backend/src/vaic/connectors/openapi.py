"""Web APIs without an MCP server, from their OpenAPI 3 document (``docs/CONNECTORS_SKILLS.md`` §1.11).

The pure part, shared by VAIC's ``add_connector`` (to write the card), the connectors Lambda (provision, sync) and
the bridge Lambda (calls): fetching and parsing the document, resolving its local ``$ref``s, turning each
operation into a tool, reading the auth scheme, and building one pinned HTTPS request from a tool call.
The document is untrusted data: its text is only ever shown or used as tool descriptions, never followed.
No credential passes through here except in ``build_request``, which only places it in the request.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import urllib.parse
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from vaic.shared.mcp_http import HttpResponse, Transport

MAX_SPEC = 2_000_000
MAX_OPS = 200
OP_NODES = 20_000
ALL_NODES = 500_000
FETCH_TIMEOUT = 5
METHODS = ("get", "put", "post", "delete", "patch", "head")
ARG_RE = re.compile(r"^[a-zA-Z0-9_.-]{1,64}$")
IGNORED_HEADERS = {"accept", "content-type", "authorization"}
BODY_ARG = "body"
SWAGGER = "That's a Swagger 2.0 document; the city reads only OpenAPI 3. Ask the provider for an OpenAPI 3 link."
CHANGED = "The API description changed after the card was made. Ask VAIC again."

Spec = dict[str, Any]
"""The normalized spec: ``{version, title, base_url, auth, operations[], skipped[], total, capped}``."""


class SpecError(ValueError):
    """The document can't be used; the message is plain words for the owner."""


class _Skip(Exception):
    """One operation can't be mapped; the message says why."""


# ---------- fetch and parse ----------
def parse(body: bytes) -> Any:
    """JSON or YAML (safe loader). None when it is neither."""
    if len(body) > MAX_SPEC:
        raise SpecError("The API description is over 2 MB; the city reads at most 2 MB.")
    try:
        text = body.decode("utf-8-sig")
    except UnicodeDecodeError:
        return None
    try:
        return json.loads(text)
    except ValueError:
        pass
    import yaml

    try:
        return yaml.safe_load(text)
    except Exception:  # yaml.YAMLError, or a RecursionError on absurd nesting
        return None


def kind(doc: Any) -> str | None:
    """``openapi`` (3.0/3.1), ``swagger`` (2.0) or None (not an API description)."""
    if not isinstance(doc, dict):
        return None
    v = doc.get("openapi")
    if isinstance(v, str) and v.startswith("3."):
        if re.match(r"^3\.[01](\.|$)", v):
            return "openapi"
        raise SpecError(f"OpenAPI {v[:10]} isn't supported yet. Ask the provider for an OpenAPI 3.0 or 3.1 link.")
    if "swagger" in doc:
        return "swagger"
    return None


async def fetch_doc(url: str, transport: Transport) -> dict[str, Any] | None:
    """GET the link (the caller has checked it). The parsed OpenAPI 3 document, or None when the link is not an
    API description (then it's treated as an MCP server). Raises SpecError for Swagger 2.0 or a broken spec."""
    try:
        r: HttpResponse = await asyncio.to_thread(
            transport, url, {"accept": "application/json, application/yaml;q=0.9, text/yaml;q=0.8"}, b"", FETCH_TIMEOUT
        )
    except Exception:
        return None  # a timeout (an MCP endpoint that streams) or a refused connection: not a spec
    if r.status != 200 or "text/event-stream" in r.headers.get("content-type", ""):
        return None
    doc = parse(r.body)
    k = kind(doc)
    if k == "swagger":
        raise SpecError(SWAGGER)
    return doc if k == "openapi" else None


# ---------- $ref resolution ----------
class _Cycle(Exception):
    pass


class _Refs:
    """Resolves local ``$ref``s (``#/...``) inline, with node budgets. A remote ``$ref`` refuses the spec."""

    def __init__(self, doc: Mapping[str, Any]) -> None:
        self.doc = doc
        self.total = 0
        self.op = 0

    def pointer(self, ref: str) -> Any:
        if not ref.startswith("#/"):
            if ref == "#":
                raise _Cycle
            raise SpecError(
                f"The API description refers to another file ({ref[:80]}); the city reads only one self-contained "
                "document. Ask the provider for a bundled OpenAPI 3 file."
            )
        node: Any = self.doc
        for raw in ref[2:].split("/"):
            part = urllib.parse.unquote(raw).replace("~1", "/").replace("~0", "~")
            if isinstance(node, dict) and part in node:
                node = node[part]
            elif isinstance(node, list) and part.isdigit() and int(part) < len(node):
                node = node[int(part)]
            else:
                raise _Skip(f"broken reference {ref[:80]}")
        return node

    def inline(self, node: Any, stack: tuple[str, ...] = ()) -> Any:
        self.total += 1
        self.op += 1
        if self.total > ALL_NODES:
            raise SpecError("The API description is too large to turn into tools.")
        if self.op > OP_NODES:
            raise _Skip("too complex")
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str):
                if ref in stack:
                    raise _Cycle
                target = self.inline(self.pointer(ref), (*stack, ref))
                if isinstance(target, dict) and isinstance(node.get("description"), str):
                    target = {**target, "description": node["description"]}
                return target
            return {str(k): self.inline(v, stack) for k, v in node.items()}
        if isinstance(node, list):
            return [self.inline(v, stack) for v in node]
        return node


# ---------- schemas ----------
def _flatten(s: Any) -> Any:
    """Make an OpenAPI schema fit the Gateway's inline format: ``allOf`` of objects merged, a nested
    ``oneOf``/``anyOf`` with several shapes reduced to its first one (described as such)."""
    if isinstance(s, list):
        return [_flatten(x) for x in s]
    if not isinstance(s, dict):
        return s
    s = {k: _flatten(v) for k, v in s.items()}
    parts = s.get("allOf")
    if isinstance(parts, list) and parts and all(isinstance(p, dict) for p in parts):
        merged: dict[str, Any] = {k: v for k, v in s.items() if k != "allOf"}
        if len(parts) == 1:
            merged = {**parts[0], **merged}
        else:
            props: dict[str, Any] = dict(merged.get("properties") or {})
            req: list[Any] = list(merged.get("required") or [])
            for p in parts:
                props.update(p.get("properties") or {})
                req += list(p.get("required") or [])
                for k in ("description", "type"):
                    if k in p and k not in merged:
                        merged[k] = p[k]
            merged.update({"type": "object", "properties": props, "required": req})
        s = merged
    for k in ("oneOf", "anyOf"):
        opts = s.get(k)
        if isinstance(opts, list):
            real = [o for o in opts if isinstance(o, dict) and o.get("type") != "null"]
            if len(real) > 1:
                rest = {x: v for x, v in s.items() if x != k}
                note = "One of several shapes; this is the first. See the API's documentation."
                s = {**real[0], **rest, "description": str(rest.get("description") or note)}
    return s


def _schema(s: Any) -> dict[str, Any]:
    from vaic.lambdas.connectors import map_schema

    m = map_schema(_flatten(s if isinstance(s, dict) else {"type": "string"}), False)
    if m is None:
        raise _Skip("its inputs can't be described to the Gateway")
    return m


def _json_media(content: Mapping[str, Any]) -> Any:
    for mt, media in content.items():
        base = str(mt).split(";")[0].strip().lower()
        if base == "application/json" or base.endswith("+json"):
            return media if isinstance(media, dict) else {}
    return None


# ---------- names ----------
def clean_name(s: str) -> str:
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s)
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_") or "op"


def _unique(base: str, taken: set[str], limit: int) -> str:
    base = base[:limit].rstrip("_") or "op"
    name, n = base, 1
    while name in taken:
        n += 1
        suffix = f"_{n}"
        name = f"{base[: limit - len(suffix)].rstrip('_')}{suffix}"
    taken.add(name)
    return name


def _arg(name: str, taken: set[str]) -> str:
    a = re.sub(r"[^a-zA-Z0-9_.-]", "_", name)[:64] or "arg"
    return _unique(a, taken, 64)


# ---------- operations ----------
def _operation(refs: _Refs, path: str, method: str, op: Mapping[str, Any], item: Mapping[str, Any]) -> dict[str, Any]:
    refs.op = 0
    params: dict[tuple[str, str], dict[str, Any]] = {}
    for raw in [*(item.get("parameters") or []), *(op.get("parameters") or [])]:
        p = refs.inline(raw)
        if isinstance(p, dict) and isinstance(p.get("name"), str):
            params[(p["name"], str(p.get("in")))] = p
    taken: set[str] = {BODY_ARG}
    props: dict[str, Any] = {}
    required: list[str] = []
    out_params: list[dict[str, Any]] = []
    for (name, where), p in params.items():
        if where == "cookie":
            raise _Skip("it needs a cookie parameter")
        if where not in ("path", "query", "header"):
            raise _Skip(f"unknown parameter location {where[:20]}")
        if where == "header" and name.lower() in IGNORED_HEADERS:
            continue
        if where == "header" and not re.fullmatch(r"[A-Za-z0-9!#$%&'*+.^_`|~-]{1,128}", name):
            raise _Skip("it has a header parameter with an invalid name")
        ps = p.get("schema")
        if ps is None and isinstance(p.get("content"), dict):
            ps = (_json_media(p["content"]) or {}).get("schema")
        m = _schema(ps or {"type": "string"})
        if isinstance(p.get("description"), str):
            m["description"] = p["description"][:1000]
        arg = _arg(name, taken)
        props[arg] = m
        req = where == "path" or p.get("required") is True
        if req:
            required.append(arg)
        out_params.append({"arg": arg, "name": name, "in": where, "required": req})
    body: dict[str, Any] | None = None
    rb = refs.inline(op["requestBody"]) if "requestBody" in op else None
    if isinstance(rb, dict) and rb.get("content"):
        media = _json_media(rb["content"]) if isinstance(rb["content"], dict) else None
        if media is None:
            types = ", ".join(str(k) for k in rb["content"])[:60]
            raise _Skip(f"its body isn't JSON ({types})")
        m = _schema(media.get("schema") or {"type": "object"})
        if isinstance(rb.get("description"), str) and "description" not in m:
            m["description"] = rb["description"][:1000]
        props[BODY_ARG] = m
        body = {"arg": BODY_ARG, "required": rb.get("required") is True}
        if body["required"]:
            required.append(BODY_ARG)
    for name in re.findall(r"\{([^}]+)\}", path):
        if not any(p["in"] == "path" and p["name"] == name for p in out_params):
            raise _Skip(f"the path parameter {name[:40]} isn't described")
    schema: dict[str, Any] = {"type": "object", "properties": props}
    if required:
        schema["required"] = required
    verb = method.upper()
    text = op.get("summary") or op.get("description") or f"{verb} {path}"
    return {
        "method": verb,
        "path": path,
        "description": str(text)[:1000],
        "read_only": verb in ("GET", "HEAD"),
        "destructive": verb == "DELETE",
        "no_auth": op.get("security") == [],
        "params": out_params,
        "body": body,
        "input_schema": schema,
        "_name": str(op.get("operationId") or f"{method}_{path}"),
    }


def base_url(doc: Mapping[str, Any], spec_url: str) -> str:
    """The first ``servers[].url`` (variables at their defaults), absolute, https, without a trailing slash."""
    servers = doc.get("servers")
    first: dict[str, Any] = (
        servers[0] if isinstance(servers, list) and servers and isinstance(servers[0], dict) else {"url": "/"}
    )
    url = str(first.get("url") or "/")
    for name, var in (first.get("variables") or {}).items():
        if isinstance(var, dict) and "default" in var:
            url = url.replace("{" + str(name) + "}", str(var["default"]))
    if "{" in url:
        raise SpecError("The API's address has a placeholder without a default value.")
    p = urllib.parse.urlsplit(urllib.parse.urljoin(spec_url, url))
    if p.scheme != "https" or not p.hostname:
        raise SpecError("The API's address must be an https link.")
    if p.username or p.password or p.query or p.fragment:
        raise SpecError("The API's address can't carry a login, a query or a fragment.")
    return urllib.parse.urlunsplit(("https", p.netloc, p.path.rstrip("/"), "", ""))


def _https(url: Any, spec_url: str) -> str:
    u = urllib.parse.urljoin(spec_url, str(url or ""))
    if urllib.parse.urlsplit(u).scheme != "https":
        raise SpecError("The API's sign-in addresses must be https links.")
    return u


def _scheme(s: Mapping[str, Any], spec_url: str) -> tuple[dict[str, Any] | None, str]:
    t = str(s.get("type", ""))
    if t == "apiKey":
        where, name = s.get("in"), s.get("name")
        if where in ("header", "query") and isinstance(name, str) and re.fullmatch(r"[A-Za-z0-9_.-]{1,128}", name):
            return {"kind": "api_key", "in": where, "name": name, "prefix": "", "basic": False}, ""
        return None, "an API key in a cookie"
    if t == "http":
        sch = str(s.get("scheme", "")).lower()
        if sch == "bearer":
            return {"kind": "api_key", "in": "header", "name": "Authorization", "prefix": "Bearer ", "basic": False}, ""
        if sch == "basic":
            return {"kind": "api_key", "in": "header", "name": "Authorization", "prefix": "Basic ", "basic": True}, ""
        return None, f"HTTP {sch[:20]} authentication"
    if t == "oauth2":
        flows = s.get("flows") or {}
        for flow, key in (("authorization_code", "authorizationCode"), ("client_credentials", "clientCredentials")):
            f = flows.get(key)
            if isinstance(f, dict):
                token = _https(f.get("tokenUrl"), spec_url)
                auth = _https(f.get("authorizationUrl"), spec_url) if flow == "authorization_code" else token
                scopes = [str(x) for x in (f.get("scopes") or {})][:20]
                return {
                    "kind": "oauth",
                    "flow": flow,
                    "authorization_url": auth,
                    "token_url": token,
                    "scopes": scopes,
                }, ""
        return None, "an OAuth flow other than authorization code or client credentials"
    return None, {"openIdConnect": "OpenID Connect discovery", "mutualTLS": "client certificates"}.get(t, t[:30])


def auth_of(doc: Mapping[str, Any], refs: _Refs, spec_url: str) -> dict[str, Any]:
    """The connector's auth: the first scheme named by the top-level ``security``, else the first supported one."""
    raw = (doc.get("components") or {}).get("securitySchemes") or {}
    schemes = {str(k): refs.inline(v) for k, v in raw.items()} if isinstance(raw, dict) else {}
    security = doc.get("security")
    if not schemes or security == []:
        return {"kind": "none"}
    named = [str(n) for req in security or [] if isinstance(req, dict) for n in req]
    order = [n for n in named if n in schemes] or list(schemes)
    reason = ""
    for name in order:
        if not isinstance(schemes[name], dict):
            continue
        mapped, why = _scheme(schemes[name], spec_url)
        if mapped:
            return mapped
        reason = reason or why
    raise SpecError(f"This API signs in with {reason or 'a method'} the city can't use yet.")


def normalize(doc: Mapping[str, Any], spec_url: str, connector_id: str) -> Spec:
    """The stored spec: tools named and cut to fit ``<id>___<name>`` in 64 characters."""
    refs = _Refs(doc)
    base = base_url(doc, spec_url)
    try:
        auth = auth_of(doc, refs, spec_url)
    except (_Skip, _Cycle):
        raise SpecError("The API's sign-in description can't be read.") from None
    ops: list[dict[str, Any]] = []
    skipped: list[str] = []
    paths = doc.get("paths") or {}
    for path, raw in paths.items() if isinstance(paths, dict) else []:
        if not isinstance(raw, dict) or not str(path).startswith("/"):
            continue
        try:
            item = refs.inline(raw) if "$ref" in raw else raw
        except (_Skip, _Cycle):
            skipped.append(str(path)[:80])
            continue
        for method in METHODS:
            op = item.get(method)
            if not isinstance(op, dict):
                continue
            label = f"{method.upper()} {path}"[:100]
            try:
                ops.append(_operation(refs, str(path), method, op, item))
            except _Cycle:
                skipped.append(f"{label} (a schema refers to itself)")
            except _Skip as e:
                skipped.append(f"{label} ({e})")
    total = len(ops)
    capped = total > MAX_OPS
    if capped:
        ops = [o for o in ops if o["read_only"]][:MAX_OPS]
    limit = 64 - len(connector_id) - 3
    taken: set[str] = set()
    for o in ops:
        o["name"] = _unique(clean_name(o.pop("_name")), taken, limit)
    info: dict[str, Any] = doc["info"] if isinstance(doc.get("info"), dict) else {}
    return {
        "version": 1,
        "title": re.sub(r"[\x00-\x1f]", " ", str(info.get("title") or ""))[:80].strip(),
        "base_url": base,
        "auth": auth,
        "operations": ops,
        "skipped": skipped,
        "total": total,
        "capped": capped,
    }


def dumps(spec: Spec) -> bytes:
    return json.dumps(spec, sort_keys=True, separators=(",", ":"), default=str).encode()


def sha256(spec: Spec) -> str:
    return hashlib.sha256(dumps(spec)).hexdigest()


def spec_key(id: str, digest: str) -> str:
    return f"specs/{id}/{digest}.json"


def card(label: str, spec: Spec, spec_url: str, used_by: str) -> str:
    ops = spec["operations"]
    ro = sum(1 for o in ops if o["read_only"])
    de = sum(1 for o in ops if o["destructive"])
    capped = f" (the first {len(ops)} read-only ones of {spec['total']})" if spec.get("capped") else ""
    return (
        f"Connect the {label} at {spec['base_url']} (from {spec_url}): {len(ops)} actions{capped}, {ro} read-only, "
        f"{de} delete. Used by: {used_by}. Approve?"
    )


def tools_of(spec: Spec) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """(record tools, Gateway inline tool schemas)."""
    tools, schemas = [], []
    for o in spec["operations"]:
        tools.append(
            {
                "name": o["name"],
                "description": o["description"],
                "read_only": o["read_only"],
                "destructive": o["destructive"],
            }
        )
        schemas.append({"name": o["name"], "description": o["description"], "inputSchema": o["input_schema"]})
    return tools, schemas


# ---------- requests ----------
@dataclass(frozen=True)
class Credential:
    headers: Mapping[str, str] = field(default_factory=dict)
    query: Mapping[str, str] = field(default_factory=dict)
    secrets: tuple[str, ...] = ()
    """Every form of the credential, so it can be cut out of answers."""


@dataclass(frozen=True)
class ApiRequest:
    method: str
    url: str
    headers: Mapping[str, str]
    body: bytes | None = None


class ArgError(ValueError):
    """The tool call's arguments don't fit the operation; plain words for the agent."""


def _scalar(v: Any) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float, str)):
        return str(v)
    raise ArgError("must be a single value")


def host_of(url: str) -> str:
    return urllib.parse.urlsplit(url).netloc.lower()


def build_request(spec: Spec, op: Mapping[str, Any], args: Mapping[str, Any], cred: Credential) -> ApiRequest:
    """The HTTPS request for one call, pinned to the spec's base host."""
    base = str(spec["base_url"])
    path = str(op["path"])
    query: list[tuple[str, str]] = []
    headers: dict[str, str] = {"accept": "application/json, text/*;q=0.9", "user-agent": "ai-city"}
    for p in op["params"]:
        v = args.get(p["arg"])
        if v is None:
            if p["required"]:
                raise ArgError(f"{p['arg']} is required.")
            continue
        try:
            if p["in"] == "path":
                s = _scalar(v)
                if s in ("", ".", ".."):
                    raise ArgError("can't be empty, . or ..")
                path = path.replace("{" + p["name"] + "}", urllib.parse.quote(s, safe=""))
            elif p["in"] == "query":
                query += [(p["name"], _scalar(x)) for x in (v if isinstance(v, list) else [v])]
            else:
                s = _scalar(v)
                if "\r" in s or "\n" in s:
                    raise ArgError("can't contain line breaks")
                headers[p["name"]] = s
        except ArgError as e:
            raise ArgError(f"{p['arg']} {e}") from None
    body: bytes | None = None
    if op.get("body"):
        if BODY_ARG in args and args[BODY_ARG] is not None:
            body = json.dumps(args[BODY_ARG]).encode()
            headers["content-type"] = "application/json"
        elif op["body"]["required"]:
            raise ArgError("body is required.")
    if not op.get("no_auth"):
        headers.update(cred.headers)
        query += list(cred.query.items())
    url = base + path + (f"?{urllib.parse.urlencode(query)}" if query else "")
    p = urllib.parse.urlsplit(url)
    if p.scheme != "https" or p.netloc.lower() != host_of(base):
        raise ArgError("That call would leave the API's host.")
    return ApiRequest(str(op["method"]), url, headers, body)


def redact(text: str, secrets: tuple[str, ...]) -> str:
    for s in secrets:
        if len(s) >= 4:
            text = text.replace(s, "[redacted]").replace(urllib.parse.quote(s, safe=""), "[redacted]")
    return text


# ---------- the stored spec (S3 ``vaic-prod-connectors``) ----------
class S3Specs:
    def __init__(self, s3: Any, bucket: str) -> None:
        self.s3 = s3
        self.bucket = bucket

    def put(self, key: str, data: bytes) -> None:
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType="application/json")

    def get(self, key: str) -> bytes:
        body: bytes = self.s3.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        return body

    def delete_prefix(self, prefix: str) -> None:
        page = self.s3.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
        keys = [{"Key": o["Key"]} for o in page.get("Contents") or []]
        if keys:
            self.s3.delete_objects(Bucket=self.bucket, Delete={"Objects": keys, "Quiet": True})


_specs: Any = None


def spec_store() -> Any:
    """The process's spec store (``VAIC_CONNECTORS_BUCKET``). Tests call ``set_spec_store`` with a fake."""
    global _specs
    if _specs is None:
        import os

        import boto3

        region = os.environ.get("AWS_REGION") or os.environ.get("VAIC_REGION")
        _specs = S3Specs(boto3.session.Session(region_name=region).client("s3"), os.environ["VAIC_CONNECTORS_BUCKET"])
    return _specs


def set_spec_store(store: Any) -> None:
    global _specs
    _specs = store
