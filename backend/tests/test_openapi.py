"""Web APIs as connectors through their OpenAPI 3 document (``docs/CONNECTORS_SKILLS.md`` §1.11).

Fakes only: petstore-like specs served by a fake transport, a fake HTTP sender for the API calls, an in-memory
spec store, recorded AgentCore clients. No network, no AWS.
"""

from __future__ import annotations

import base64
import copy
import json
from collections.abc import Callable
from typing import Any

import pytest

from aic.connectors import openapi, openapi_bridge
from aic.connectors.openapi import ApiRequest, Credential, SpecError
from aic.lambdas import connectors as lam
from aic.lambdas.api import handle_http
from aic.lambdas.connector_bridge import BridgeDeps
from aic.lambdas.connector_bridge import call as bridge_call
from aic.runtime.connector_tool import add_connector_tool
from aic.shared.connectors import DEFAULT_ROLES, ConnectorStore, approval_hash
from aic.shared.mcp_http import HttpResponse
from aic.shared.table import MemoryTable
from connector_fakes import FakeNet, Recorder, control, resolver
from test_api import ev
from test_connectors import _api, _ctx, _deps

SPEC_URL = "https://petstore.dev/openapi.json"
BASE = "https://api.petstore.dev/v1"
SECRET = "pk-test-DO-NOT-LEAK-0123456789abcdef"


def petstore() -> dict[str, Any]:
    return {
        "openapi": "3.0.3",
        "info": {"title": "Petstore", "version": "1"},
        "servers": [{"url": "https://api.petstore.dev/{version}", "variables": {"version": {"default": "v1"}}}],
        "security": [{"key": []}],
        "components": {
            "securitySchemes": {"key": {"type": "apiKey", "in": "header", "name": "X-Api-Key"}},
            "parameters": {"PetId": {"name": "petId", "in": "path", "required": True, "schema": {"type": "string"}}},
            "schemas": {
                "Base": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]},
                "Pet": {"allOf": [{"$ref": "#/components/schemas/Base"}, {"properties": {"tag": {"type": "string"}}}]},
                "Node": {"type": "object", "properties": {"child": {"$ref": "#/components/schemas/Node"}}},
            },
        },
        "paths": {
            "/pets": {
                "get": {
                    "operationId": "listPets",
                    "summary": "List pets.",
                    "parameters": [
                        {"name": "limit", "in": "query", "schema": {"type": "integer"}},
                        {"name": "page[size]", "in": "query", "schema": {"type": "integer"}},
                        {"name": "tags", "in": "query", "schema": {"type": "array", "items": {"type": "string"}}},
                        {"name": "X-Request-Id", "in": "header", "schema": {"type": "string"}},
                        {"name": "Accept", "in": "header", "schema": {"type": "string"}},
                    ],
                },
                "post": {
                    "operationId": "createPet",
                    "requestBody": {
                        "required": True,
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Pet"}}},
                    },
                },
            },
            "/pets/{petId}": {
                "parameters": [{"$ref": "#/components/parameters/PetId"}],
                "get": {"operationId": "showPetById"},
                "delete": {"operationId": "deletePet"},
                "head": {},
            },
            "/pets/{petId}/photo": {
                "post": {
                    "operationId": "uploadPhoto",
                    "requestBody": {"content": {"multipart/form-data": {"schema": {"type": "object"}}}},
                }
            },
            "/session": {"get": {"operationId": "whoAmI", "parameters": [{"name": "sid", "in": "cookie"}]}},
            "/tree": {
                "put": {
                    "operationId": "putTree",
                    "requestBody": {"content": {"application/json": {"schema": {"$ref": "#/components/schemas/Node"}}}},
                }
            },
            "/health": {"get": {"operationId": "health", "security": []}},
        },
    }


def norm(doc: dict[str, Any] | None = None, id: str = "petstore") -> openapi.Spec:
    return openapi.normalize(doc or petstore(), SPEC_URL, id)


def op(spec: openapi.Spec, name: str) -> dict[str, Any]:
    return next(o for o in spec["operations"] if o["name"] == name)


# ---------- the spec: tools, annotations, refs ----------
def test_each_operation_becomes_a_tool_with_annotations_from_the_http_method() -> None:
    s = norm()
    assert s["base_url"] == BASE
    names = {o["name"]: (o["method"], o["read_only"], o["destructive"]) for o in s["operations"]}
    assert names == {
        "list_pets": ("GET", True, False),
        "create_pet": ("POST", False, False),
        "show_pet_by_id": ("GET", True, False),
        "delete_pet": ("DELETE", False, True),
        "head_pets_pet_id": ("HEAD", True, False),
        "health": ("GET", True, False),
    }
    tools, schemas = openapi.tools_of(s)
    assert [t["name"] for t in tools] == [x["name"] for x in schemas]
    assert all(set(t) == {"name", "description", "read_only", "destructive"} for t in tools)
    # Skipped and listed: multipart body, cookie parameter, a self-referencing schema.
    skipped = " | ".join(s["skipped"])
    assert "uploadPhoto" not in skipped and "POST /pets/{petId}/photo" in skipped and "multipart" in skipped
    assert "GET /session (it needs a cookie parameter)" in skipped
    assert "PUT /tree (a schema refers to itself)" in skipped


def test_inputs_have_safe_argument_names_and_the_json_body_is_one_argument() -> None:
    s = norm()
    lp = op(s, "list_pets")
    assert [(p["arg"], p["name"], p["in"]) for p in lp["params"]] == [
        ("limit", "limit", "query"),
        ("page_size", "page[size]", "query"),
        ("tags", "tags", "query"),
        ("X-Request-Id", "X-Request-Id", "header"),
    ]  # Accept is ignored, as OpenAPI says
    assert lp["input_schema"]["properties"]["tags"] == {"type": "array", "items": {"type": "string"}}
    cp = op(s, "create_pet")
    assert cp["input_schema"] == {
        "type": "object",
        "properties": {
            "body": {
                "type": "object",
                "properties": {"name": {"type": "string"}, "tag": {"type": "string"}},
                "required": ["name"],
            }
        },
        "required": ["body"],
    }
    assert op(s, "show_pet_by_id")["input_schema"]["required"] == ["petId"]
    assert op(s, "health")["no_auth"] and not op(s, "list_pets")["no_auth"]


def test_a_yaml_spec_reads_like_the_json_one() -> None:
    import yaml

    doc = openapi.parse(yaml.safe_dump(petstore(), sort_keys=False).encode())
    assert openapi.kind(doc) == "openapi" and norm(doc) == norm()


def test_a_remote_ref_refuses_the_spec() -> None:
    doc = petstore()
    doc["paths"]["/pets"]["post"]["requestBody"]["content"]["application/json"]["schema"] = {
        "$ref": "https://evil.example.com/schemas.json#/Pet"
    }
    with pytest.raises(SpecError, match="another file"):
        norm(doc)
    doc = petstore()
    doc["paths"]["/pets/{petId}"]["parameters"] = [{"$ref": "other.yaml#/components/parameters/PetId"}]
    with pytest.raises(SpecError, match="self-contained"):
        norm(doc)


def test_tool_names_fit_64_characters_with_the_prefix_and_stay_unique() -> None:
    doc = petstore()
    long = "getTheVeryLongOperationNameThatGoesOnAndOnForeverAndEverAndEver"
    doc["paths"] = {f"/x{i}": {"get": {"operationId": f"{long}{i}"}} for i in range(3)}
    cid = "a-rather-long-connector-id"
    names = [o["name"] for o in norm(doc, cid)["operations"]]
    assert len(set(names)) == 3
    assert all(len(f"{cid}___{n}") <= 64 for n in names)
    assert names[1].endswith("_2") and names[2].endswith("_3")


def test_more_than_200_operations_offers_the_first_200_read_only_ones() -> None:
    doc = petstore()
    doc["paths"] = {f"/r{i}": {"post": {}, "get": {}} for i in range(250)}
    s = norm(doc)
    assert s["capped"] and s["total"] == 500 and len(s["operations"]) == 200
    assert all(o["method"] == "GET" for o in s["operations"]) and s["operations"][-1]["path"] == "/r199"
    assert "200 actions (the first 200 read-only ones of 500)" in openapi.card("Petstore API", s, SPEC_URL, "AIC")


def test_a_relative_or_plain_http_server_is_handled() -> None:
    doc = petstore()
    doc["servers"] = [{"url": "/api"}]
    assert norm(doc)["base_url"] == "https://petstore.dev/api"
    doc["servers"] = [{"url": "http://api.petstore.dev"}]
    with pytest.raises(SpecError, match="https"):
        norm(doc)


# ---------- auth from securitySchemes ----------
@pytest.mark.parametrize(
    ("scheme", "want"),
    [
        (
            {"type": "apiKey", "in": "header", "name": "X-Api-Key"},
            {"kind": "api_key", "in": "header", "name": "X-Api-Key", "prefix": "", "basic": False},
        ),
        (
            {"type": "apiKey", "in": "query", "name": "api_key"},
            {"kind": "api_key", "in": "query", "name": "api_key", "prefix": "", "basic": False},
        ),
        (
            {"type": "http", "scheme": "Bearer"},
            {"kind": "api_key", "in": "header", "name": "Authorization", "prefix": "Bearer ", "basic": False},
        ),
        (
            {"type": "http", "scheme": "basic"},
            {"kind": "api_key", "in": "header", "name": "Authorization", "prefix": "Basic ", "basic": True},
        ),
        (
            {
                "type": "oauth2",
                "flows": {
                    "authorizationCode": {
                        "authorizationUrl": "https://auth.petstore.dev/authorize",
                        "tokenUrl": "https://auth.petstore.dev/token",
                        "scopes": {"pets:read": "", "pets:write": ""},
                    }
                },
            },
            {
                "kind": "oauth",
                "flow": "authorization_code",
                "authorization_url": "https://auth.petstore.dev/authorize",
                "token_url": "https://auth.petstore.dev/token",
                "scopes": ["pets:read", "pets:write"],
            },
        ),
        (
            {"type": "oauth2", "flows": {"clientCredentials": {"tokenUrl": "/oauth/token", "scopes": {}}}},
            {
                "kind": "oauth",
                "flow": "client_credentials",
                "authorization_url": "https://petstore.dev/oauth/token",
                "token_url": "https://petstore.dev/oauth/token",
                "scopes": [],
            },
        ),
    ],
)
def test_each_security_scheme_maps_to_the_connectors_auth(scheme: dict[str, Any], want: dict[str, Any]) -> None:
    doc = petstore()
    doc["components"]["securitySchemes"] = {"key": scheme}
    assert norm(doc)["auth"] == want


@pytest.mark.parametrize(
    ("scheme", "words"),
    [
        ({"type": "openIdConnect", "openIdConnectUrl": "https://x.example.com"}, "OpenID Connect"),
        ({"type": "mutualTLS"}, "client certificates"),
        ({"type": "apiKey", "in": "cookie", "name": "sid"}, "cookie"),
        ({"type": "oauth2", "flows": {"implicit": {"authorizationUrl": "https://x.example.com"}}}, "OAuth flow"),
        ({"type": "http", "scheme": "digest"}, "digest"),
    ],
)
def test_unsupported_sign_ins_are_refused_in_plain_words(scheme: dict[str, Any], words: str) -> None:
    doc = petstore()
    doc["components"]["securitySchemes"] = {"key": scheme}
    with pytest.raises(SpecError, match=words):
        norm(doc)


def test_no_scheme_or_an_empty_security_means_no_auth_and_the_named_scheme_wins() -> None:
    doc = petstore()
    del doc["components"]["securitySchemes"]
    assert norm(doc)["auth"] == {"kind": "none"}
    doc = petstore()
    doc["security"] = []
    assert norm(doc)["auth"] == {"kind": "none"}
    doc = petstore()
    doc["components"]["securitySchemes"] = {
        "cookie": {"type": "apiKey", "in": "cookie", "name": "sid"},
        "bearer": {"type": "http", "scheme": "bearer"},
    }
    doc["security"] = [{"bearer": []}]
    assert norm(doc)["auth"]["prefix"] == "Bearer "


# ---------- add_connector ----------
def _served(net: FakeNet, doc: Any = None) -> None:
    net.get[SPEC_URL] = doc if doc is not None else petstore()


async def test_add_connector_with_a_spec_link_files_the_card_from_the_spec() -> None:
    d, city = _deps()
    _served(d.net)
    out = await add_connector_tool(d, _ctx()).handler({"query": SPEC_URL})
    assert "card is waiting" in out and "6 actions" in out
    rec = await ConnectorStore(d.ledger.table).get("petstore")
    assert rec and rec["status"] == "pending_approval" and rec["transport"] == "openapi" and rec["url"] == SPEC_URL
    assert rec["openapi"]["sha256"] == openapi.sha256(norm()) and rec["openapi"]["base_url"] == BASE
    [ap] = await d.ledger.pending_approvals()
    assert ap["hash"] == approval_hash("petstore", SPEC_URL, DEFAULT_ROLES)
    assert ap["action"] == (
        f"Connect the Petstore API at {BASE} (from {SPEC_URL}): 6 actions, 4 read-only, 1 delete. "
        "Used by: AIC, Managers, Workers. Approve?"
    )
    assert city.bus.of_type("approval.requested")[0]["connector_id"] == "petstore"


async def test_a_swagger_2_document_is_refused_in_plain_words() -> None:
    d, _ = _deps()
    _served(d.net, {"swagger": "2.0", "info": {"title": "Old"}, "paths": {}})
    out = await add_connector_tool(d, _ctx()).handler({"query": SPEC_URL})
    assert "OpenAPI 3 link" in out and await ConnectorStore(d.ledger.table).list() == []


async def test_a_spec_with_a_remote_ref_or_a_private_api_host_is_refused() -> None:
    d, _ = _deps()
    doc = petstore()
    doc["paths"]["/pets"]["get"]["parameters"] = [{"$ref": "https://evil.example.com/p.json"}]
    _served(d.net, doc)
    assert "another file" in await add_connector_tool(d, _ctx()).handler({"query": SPEC_URL})
    doc = petstore()
    doc["servers"] = [{"url": "https://internal.example.com/v1"}]
    _served(d.net, doc)
    assert "private" in await add_connector_tool(d, _ctx()).handler({"query": SPEC_URL})
    assert await ConnectorStore(d.ledger.table).list() == []


async def test_a_link_that_is_not_a_spec_is_still_an_mcp_server_and_a_name_gets_the_openapi_hint() -> None:
    d, _ = _deps()
    tool = add_connector_tool(d, _ctx())
    out = await tool.handler({"query": "https://mcp.example.com/mcp"})  # the fake answers its GET with 404
    [rec] = await ConnectorStore(d.ledger.table).list()
    assert "card is waiting" in out and rec.get("transport") is None
    [ap] = await d.ledger.pending_approvals()
    assert "MCP server at https://mcp.example.com/mcp" in ap["action"]
    assert "OpenAPI 3" in await tool.handler({"query": "nosuchthing"})


# ---------- the connectors Lambda ----------
class MemSpecs:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def put(self, key: str, data: bytes) -> None:
        self.objects[key] = data

    def get(self, key: str) -> bytes:
        return self.objects[key]

    def delete_prefix(self, prefix: str) -> None:
        for k in [k for k in self.objects if k.startswith(prefix)]:
            del self.objects[k]


def _lam(net: FakeNet, identity: Recorder | None = None) -> tuple[lam.ConnectorsDeps, Recorder]:
    from aic.shared.events import MemoryBus

    ctl = control()
    deps = lam.ConnectorsDeps(
        ConnectorStore(MemoryTable()),
        MemoryBus(),
        ctl,
        identity or Recorder({"get_workload_access_token_for_user_id": {"workloadAccessToken": "wt"}}),
        Recorder(),
        "gw-1",
        "pe-1",
        "arn:aws:lambda:eu-north-1:123456789012:function:aic-prod-connector-bridge",
        "aic-prod-connectors",
        transport=net,
        resolve=resolver,
    )
    return deps, ctl


async def _provisioning(store: ConnectorStore, doc: dict[str, Any] | None = None) -> None:
    await store.create(
        {
            "id": "petstore",
            "label": "Petstore API",
            "url": SPEC_URL,
            "transport": "openapi",
            "openapi": {"spec_url": SPEC_URL, "sha256": openapi.sha256(norm(doc))},
            "status": "provisioning",
            "roles": DEFAULT_ROLES,
            "tools": [],
        }
    )


def _no_auth() -> dict[str, Any]:
    doc = petstore()
    del doc["components"]["securitySchemes"]
    return doc


async def test_provision_stores_the_spec_and_sync_makes_a_lambda_target_with_cedar() -> None:
    net = FakeNet()
    _served(net, _no_auth())
    deps, ctl = _lam(net)
    specs = MemSpecs()
    await _provisioning(deps.store, _no_auth())
    assert await openapi_admin_dispatch({"action": "provision", "id": "petstore"}, deps, specs) == {"ok": True}
    rec = await deps.store.get("petstore")
    assert rec and rec["status"] == "ready" and rec["auth"] == "none" and rec["target_id"] == "tgt-1"
    digest = openapi.sha256(norm(_no_auth()))
    assert list(specs.objects) == [f"specs/petstore/{digest}.json"] == [rec["openapi"]["spec_key"]]
    assert rec["openapi"]["operations"] == 6 and "Skipped 3 operation(s)" in rec["error"]
    kw = dict(ctl.calls)["create_gateway_target"]
    payload = kw["targetConfiguration"]["mcp"]["lambda"]["toolSchema"]["inlinePayload"]
    assert [p["name"] for p in payload] == [t["name"] for t in rec["tools"]]
    statement = next(iter(ctl.policies.values()))["definition"]["cedar"]["statement"]  # type: ignore[attr-defined]
    assert 'AgentCore::Action::"petstore___delete_pet"' in statement
    # refresh rebuilds from the stored spec: the link is not fetched again.
    fetched = len(net.calls)
    assert await lam.handle({"action": "refresh", "id": "petstore"}, deps) == {"ok": True}
    assert len(net.calls) == fetched and "update_gateway_target" in ctl.names()


async def openapi_admin_dispatch(event: dict[str, Any], deps: lam.ConnectorsDeps, specs: MemSpecs) -> Any:
    openapi.set_spec_store(specs)  # the connectors Lambda's own dispatch line uses the process's store
    return await lam.handle(event, deps)


async def test_a_spec_that_changed_after_the_card_is_not_provisioned() -> None:
    net = FakeNet()
    doc = _no_auth()
    _served(net, doc)
    deps, ctl = _lam(net)
    await _provisioning(deps.store, doc)
    changed = copy.deepcopy(doc)
    changed["paths"]["/admin"] = {"delete": {"operationId": "dropEverything"}}
    _served(net, changed)
    specs = MemSpecs()
    await openapi_admin_dispatch({"action": "provision", "id": "petstore"}, deps, specs)
    rec = await deps.store.get("petstore")
    assert rec and rec["status"] == "error" and rec["error"] == openapi.CHANGED
    assert specs.objects == {} and "create_gateway_target" not in ctl.names()


async def test_an_api_key_spec_waits_for_the_key_then_syncs() -> None:
    net = FakeNet()
    _served(net)
    identity = Recorder(
        {
            "get_workload_access_token_for_user_id": {"workloadAccessToken": "wt"},
            "get_resource_api_key": RuntimeError("no key yet"),
        }
    )
    deps, _ = _lam(net, identity)
    specs = MemSpecs()
    await _provisioning(deps.store)
    await openapi_admin_dispatch({"action": "provision", "id": "petstore"}, deps, specs)
    rec = await deps.store.get("petstore")
    assert rec and rec["status"] == "needs_key" and rec["needs"] == "api_key" and rec["auth"] == "api_key"
    assert rec["openapi"]["auth"]["name"] == "X-Api-Key"
    await openapi_admin_dispatch({"action": "sync", "id": "petstore"}, deps, specs)
    assert (await deps.store.get("petstore"))["status"] == "needs_key"  # type: ignore[index]
    identity.answers["get_resource_api_key"] = {"apiKey": SECRET}
    await openapi_admin_dispatch({"action": "sync", "id": "petstore"}, deps, specs)
    rec = await deps.store.get("petstore")
    assert rec and rec["status"] == "ready"
    assert SECRET not in json.dumps(list(deps.store.table.items.values()), default=str)  # type: ignore[attr-defined]


def _oauth_doc(flow: str) -> dict[str, Any]:
    doc = petstore()
    f: dict[str, Any] = {"tokenUrl": "https://auth.petstore.dev/token", "scopes": {"pets": ""}}
    if flow == "authorizationCode":
        f["authorizationUrl"] = "https://auth.petstore.dev/authorize"
    doc["components"]["securitySchemes"] = {"key": {"type": "oauth2", "flows": {flow: f}}}
    return doc


@pytest.mark.parametrize(("flow", "after"), [("authorizationCode", "needs_login"), ("clientCredentials", "syncing")])
async def test_oauth_specs_get_a_custom_provider_and_wait_for_the_owners_client(flow: str, after: str) -> None:
    net = FakeNet()
    doc = _oauth_doc(flow)
    _served(net, doc)
    deps, ctl = _lam(net)
    await _provisioning(deps.store, doc)
    await openapi_admin_dispatch({"action": "provision", "id": "petstore"}, deps, MemSpecs())
    rec = await deps.store.get("petstore")
    assert rec and rec["status"] == "needs_key" and rec["needs"] == "oauth_client" and rec["auth"] == "oauth"
    assert rec["oauth"]["callback_url"] == "https://identity.example.com/callback/abc"
    assert rec["oauth"]["flow"] == ("authorization_code" if flow == "authorizationCode" else "client_credentials")
    created = dict(ctl.calls)["create_oauth2_credential_provider"]
    meta = created["oauth2ProviderConfigInput"]["customOauth2ProviderConfig"]["oauthDiscovery"]
    assert meta["authorizationServerMetadata"]["tokenEndpoint"] == "https://auth.petstore.dev/token"
    assert created["name"] == "aic-conn-petstore" and created["tags"]["Component"] == "connectors"
    # The owner enters the client in the secure field (api Lambda).
    d, invoked, c = _api(secrets=Recorder(), control=control())
    await c.store.create(rec)
    r = await handle_http(ev("PUT", "/connectors/petstore/key", {"client_id": "cid", "client_secret": SECRET}), d)
    assert r["statusCode"] == 200
    assert (await c.store.get("petstore"))["status"] == after  # type: ignore[index]
    assert invoked == ([{"action": "sync", "id": "petstore"}] if after == "syncing" else [])


async def test_remove_deletes_the_stored_specs_and_the_rest() -> None:
    net = FakeNet()
    _served(net, _no_auth())
    deps, ctl = _lam(net)
    specs = MemSpecs()
    await _provisioning(deps.store, _no_auth())
    await openapi_admin_dispatch({"action": "provision", "id": "petstore"}, deps, specs)
    specs.objects["specs/petstore-two/x.json"] = b"{}"
    await openapi_admin_dispatch({"action": "remove", "id": "petstore"}, deps, specs)
    assert await deps.store.get("petstore") is None and list(specs.objects) == ["specs/petstore-two/x.json"]
    assert "delete_gateway_target" in ctl.names()


# ---------- the bridge: requests, pinning, SSRF, credentials ----------
class FakeApi:
    def __init__(self, answer: Callable[[ApiRequest], HttpResponse] | None = None) -> None:
        self.requests: list[ApiRequest] = []
        self.answer = answer or (lambda r: HttpResponse(200, {"content-type": "application/json"}, b'{"ok": true}'))

    def __call__(self, req: ApiRequest, timeout: float, cap: int) -> HttpResponse:
        assert timeout == 30 and cap == 5_000_000
        self.requests.append(req)
        return self.answer(req)


def test_requests_encode_path_params_and_carry_query_headers_and_a_json_body() -> None:
    s = norm()
    cred = Credential(headers={"X-Api-Key": SECRET}, secrets=(SECRET,))
    r = openapi.build_request(
        s, op(s, "list_pets"), {"limit": 5, "page_size": 10, "tags": ["a b", "c"], "X-Request-Id": "r1"}, cred
    )
    assert r.method == "GET" and r.body is None
    assert r.url == f"{BASE}/pets?limit=5&page%5Bsize%5D=10&tags=a+b&tags=c"
    assert r.headers["X-Request-Id"] == "r1" and r.headers["X-Api-Key"] == SECRET
    r = openapi.build_request(s, op(s, "show_pet_by_id"), {"petId": "../../admin?x=1#y"}, cred)
    assert r.url == f"{BASE}/pets/..%2F..%2Fadmin%3Fx%3D1%23y"
    r = openapi.build_request(s, op(s, "create_pet"), {"body": {"name": "Rex"}}, cred)
    assert r.body == b'{"name": "Rex"}' and r.headers["content-type"] == "application/json"
    r = openapi.build_request(s, op(s, "health"), {}, cred)
    assert "X-Api-Key" not in r.headers  # security: [] on the operation
    for bad in ({"petId": ".."}, {}):
        with pytest.raises(openapi.ArgError):
            openapi.build_request(s, op(s, "show_pet_by_id"), bad, cred)
    with pytest.raises(openapi.ArgError, match="line breaks"):
        openapi.build_request(s, op(s, "list_pets"), {"X-Request-Id": "a\r\nHost: evil"}, cred)


def test_a_stored_path_that_would_leave_the_host_is_refused() -> None:
    s = {**norm(), "base_url": "https://api.petstore.dev"}
    evil = {**op(s, "health"), "path": "@evil.example.com/x"}
    with pytest.raises(openapi.ArgError, match="leave the API's host"):
        openapi.build_request(s, evil, {}, Credential())


async def _ready(store: ConnectorStore, specs: MemSpecs, doc: dict[str, Any] | None = None) -> dict[str, Any]:
    s = norm(doc)
    key = openapi.spec_key("petstore", openapi.sha256(s))
    specs.put(key, openapi.dumps(s))
    tools, _ = openapi.tools_of(s)
    rec = {
        "id": "petstore",
        "label": "Petstore API",
        "url": SPEC_URL,
        "transport": "openapi",
        "openapi": {"spec_url": SPEC_URL, "spec_key": key, "base_url": BASE, "auth": s["auth"]},
        "status": "ready",
        "auth": "api_key" if s["auth"]["kind"] == "api_key" else s["auth"]["kind"],
        "roles": DEFAULT_ROLES,
        "tools": tools,
    }
    await store.create(rec)
    return rec


def _identity(key: str = SECRET) -> Recorder:
    return Recorder(
        {
            "get_workload_access_token_for_user_id": {"workloadAccessToken": "wt"},
            "get_resource_api_key": {"apiKey": key},
            "get_resource_oauth2_token": {"accessToken": key},
        }
    )


@pytest.fixture
def specs(monkeypatch: pytest.MonkeyPatch) -> MemSpecs:
    m = MemSpecs()
    openapi.set_spec_store(m)
    openapi_bridge._cache.clear()
    monkeypatch.setattr(openapi_bridge, "RESOLVE", resolver)
    return m


async def test_the_bridge_dispatches_openapi_calls_and_never_leaks_the_key(
    specs: MemSpecs, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    def echo(req: ApiRequest) -> HttpResponse:  # a server that echoes the request, key included
        return HttpResponse(200, {"content-type": "application/json"}, json.dumps({"seen": dict(req.headers)}).encode())

    api = FakeApi(echo)
    monkeypatch.setattr(openapi_bridge, "SEND", api)
    store = ConnectorStore(MemoryTable())
    await _ready(store, specs)
    out = await bridge_call({"limit": 1}, "petstore___list_pets", BridgeDeps(store, _identity(), "wl", FakeNet()))
    assert not out["isError"] and out["content"][0]["text"].startswith("HTTP 200\n")
    assert api.requests[0].headers["X-Api-Key"] == SECRET  # it was sent...
    assert "[redacted]" in out["content"][0]["text"]
    logs = capsys.readouterr()
    assert SECRET not in json.dumps(out) + logs.out + logs.err  # ...but never returned or logged
    assert SECRET not in json.dumps(list(store.table.items.values()), default=str)  # type: ignore[attr-defined]


@pytest.mark.parametrize(
    ("scheme", "where"),
    [
        ({"type": "apiKey", "in": "query", "name": "api_key"}, "query"),
        ({"type": "http", "scheme": "basic"}, "basic"),
        ({"type": "http", "scheme": "bearer"}, "bearer"),
    ],
)
async def test_each_key_scheme_places_the_credential_and_errors_cut_it_out(
    specs: MemSpecs, scheme: dict[str, Any], where: str, capsys: pytest.CaptureFixture[str]
) -> None:
    doc = petstore()
    doc["components"]["securitySchemes"] = {"key": scheme}
    key = "user:" + SECRET if where == "basic" else SECRET

    def fail(req: ApiRequest) -> HttpResponse:  # a 401 that echoes the URL and headers
        return HttpResponse(401, {"content-type": "text/plain"}, f"bad {req.url} {dict(req.headers)}".encode())

    api = FakeApi(fail)
    store = ConnectorStore(MemoryTable())
    rec = await _ready(store, specs, doc)
    out = await openapi_bridge.call(rec, "list_pets", {}, BridgeDeps(store, _identity(key), "wl"), send=api)
    sent = api.requests[0]
    if where == "query":
        assert sent.url.endswith(f"api_key={SECRET}")
    elif where == "basic":
        assert sent.headers["Authorization"] == "Basic " + base64.b64encode(key.encode()).decode()
    else:
        assert sent.headers["Authorization"] == f"Bearer {SECRET}"
    text = out["content"][0]["text"]
    assert out["isError"] and out["aic_error"] == "http_error" and "HTTP 401" in text
    assert SECRET not in text and base64.b64encode(key.encode()).decode() not in text
    assert SECRET not in capsys.readouterr().err


async def test_client_credentials_use_the_m2m_flow(specs: MemSpecs) -> None:
    store = ConnectorStore(MemoryTable())
    rec = await _ready(store, specs, _oauth_doc("clientCredentials"))
    rec["oauth"] = {"flow": "client_credentials", "scopes": ["pets"]}
    identity = _identity()
    api = FakeApi()
    out = await openapi_bridge.call(rec, "show_pet_by_id", {"petId": "7"}, BridgeDeps(store, identity, "wl"), send=api)
    assert not out["isError"] and api.requests[0].headers["Authorization"] == f"Bearer {SECRET}"
    kw = dict(identity.calls)["get_resource_oauth2_token"]
    assert kw["oauth2Flow"] == "M2M" and kw["scopes"] == ["pets"]


async def test_calls_are_pinned_to_the_spec_host_with_no_off_host_redirects(specs: MemSpecs) -> None:
    store = ConnectorStore(MemoryTable())
    rec = await _ready(store, specs, _no_auth())
    d = BridgeDeps(store, _identity(), "wl")
    hops = iter(
        [
            HttpResponse(302, {"location": "/v1/pets/7/"}, b""),  # same host: followed
            HttpResponse(301, {"location": "https://evil.example.com/steal"}, b""),  # another host: refused
        ]
    )
    api = FakeApi(lambda r: next(hops))
    out = await openapi_bridge.call(rec, "show_pet_by_id", {"petId": "7"}, d, send=api)
    assert out["aic_error"] == "redirected" and [r.url for r in api.requests] == [f"{BASE}/pets/7", f"{BASE}/pets/7/"]
    api = FakeApi(lambda r: HttpResponse(307, {"location": "http://api.petstore.dev/v1/pets"}, b""))
    assert (await openapi_bridge.call(rec, "list_pets", {}, d, send=api))["aic_error"] == "redirected"


async def test_the_api_host_is_checked_again_at_call_time_against_private_addresses(specs: MemSpecs) -> None:
    store = ConnectorStore(MemoryTable())
    rec = await _ready(store, specs, _no_auth())
    api = FakeApi()

    def rebound(host: str) -> list[str]:  # the name now points at the metadata service
        return ["169.254.169.254"]

    out = await openapi_bridge.call(
        rec, "list_pets", {}, BridgeDeps(store, _identity(), "wl"), send=api, resolve=rebound
    )
    assert out["aic_error"] == "blocked" and "private" in out["content"][0]["text"] and api.requests == []


async def test_answers_must_be_json_or_text_under_5_mb_and_errors_are_cut_to_2000_characters(specs: MemSpecs) -> None:
    store = ConnectorStore(MemoryTable())
    rec = await _ready(store, specs, _no_auth())
    d = BridgeDeps(store, _identity(), "wl")
    img = FakeApi(lambda r: HttpResponse(200, {"content-type": "image/png"}, b"\x89PNG"))
    assert (await openapi_bridge.call(rec, "list_pets", {}, d, send=img))["aic_error"] == "unsupported"

    def big(req: ApiRequest, timeout: float, cap: int) -> HttpResponse:
        raise openapi_bridge.TooLarge

    assert (await openapi_bridge.call(rec, "list_pets", {}, d, send=big))["aic_error"] == "too_large"
    long = FakeApi(lambda r: HttpResponse(500, {"content-type": "text/plain"}, b"x" * 10_000))
    out = await openapi_bridge.call(rec, "list_pets", {}, d, send=long)
    assert out["isError"] and out["content"][0]["text"].count("x") == 2000
    unknown = await openapi_bridge.call(rec, "drop_tables", {}, d, send=long)
    assert unknown["aic_error"] == "unknown_tool"


async def test_a_missing_key_marks_the_connector_and_tells_the_agent(specs: MemSpecs) -> None:
    store = ConnectorStore(MemoryTable())
    rec = await _ready(store, specs)
    identity = Recorder(
        {
            "get_workload_access_token_for_user_id": {"workloadAccessToken": "wt"},
            "get_resource_api_key": RuntimeError("gone"),
        }
    )
    out = await openapi_bridge.call(rec, "list_pets", {}, BridgeDeps(store, identity, "wl"), send=FakeApi())
    assert out["aic_error"] == "login_expired" and "key" in out["content"][0]["text"]
    assert (await store.get("petstore"))["status"] == "login_expired"  # type: ignore[index]


def test_the_production_sender_does_not_follow_redirects_or_read_past_the_cap() -> None:
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/r":
            return httpx.Response(302, headers={"location": "https://evil.example.com/"})
        return httpx.Response(200, content=b"x" * 100, headers={"content-type": "text/plain"})

    real = httpx.Client

    class Mocked(real):  # type: ignore[misc,valid-type]
        def __init__(self, **kw: Any) -> None:
            assert kw["follow_redirects"] is False and kw["trust_env"] is False
            super().__init__(transport=httpx.MockTransport(handler), **kw)

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(httpx, "Client", Mocked)
        r = openapi_bridge.httpx_send(ApiRequest("GET", "https://api.example.com/r", {}), 30, 1000)
        assert r.status == 302 and r.headers["location"] == "https://evil.example.com/"
        with pytest.raises(openapi_bridge.TooLarge):
            openapi_bridge.httpx_send(ApiRequest("GET", "https://api.example.com/big", {}), 30, 10)


def test_the_parser_refuses_oversized_documents_and_treats_garbage_as_not_a_spec() -> None:
    with pytest.raises(SpecError, match="2 MB"):
        openapi.parse(b" " * 2_000_001)
    assert openapi.kind(openapi.parse(b"<html>hi</html>")) is None
    assert openapi.kind(openapi.parse(b"\xff\xfe")) is None
    with pytest.raises(SpecError, match=r"3\.0 or 3\.1"):
        openapi.kind({"openapi": "3.2.0"})


async def test_yaml_aliases_cannot_blow_up_the_tool_build() -> None:
    lines = ['openapi: "3.0.0"', "info: {title: Bomb}", "servers: [{url: 'https://api.bomb.example.com'}]"]
    lines.append("x0: &a0 {type: object, properties: {p: {type: string}}}")
    for i in range(1, 20):
        lines.append(f"x{i}: &a{i} {{type: object, properties: {{a: *a{i - 1}, b: *a{i - 1}, c: *a{i - 1}}}}}")
    lines.append("paths: {/b: {post: {requestBody: {content: {application/json: {schema: *a19}}}}}}")
    doc = openapi.parse("\n".join(lines).encode())
    s = openapi.normalize(doc, "https://bomb.example.com/o.yaml", "bomb")
    assert s["operations"] == [] and "too complex" in s["skipped"][0]
