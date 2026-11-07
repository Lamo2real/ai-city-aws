"""Connector records and the rules every part of the city shares (``docs/CONNECTORS_SKILLS.md`` §1).

A connector is one account on one remote MCP server, stored in the ledger as ``CONNECTORS`` / ``CONN#<id>``.
This module holds the record store, the URL and registry checks used when one is added, the per-role filter
and the approval levels. No credentials ever pass through here.
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import re
import socket
import urllib.parse
from collections.abc import Callable, Iterable, Mapping
from typing import Any

from .events import now_iso
from .mcp_http import HttpResponse, Transport, urllib_transport
from .policy import action_hash
from .table import Table, UpdateOptions

PK = "CONNECTORS"
ROLES = ("ace", "orchestrator", "manager", "worker")
LEVELS = ("read", "all")
APPROVALS = ("destructive", "writes", "none")
DEFAULT_ROLES: dict[str, str] = {"ace": "all", "manager": "all", "worker": "all"}
ID_RE = re.compile(r"^(?=.{2,31}$)[a-z][a-z0-9]*(-[a-z0-9]+)*$")
"""The contract's ``^[a-z][a-z0-9-]{1,30}$``, without double or trailing dashes (Gateway target names forbid them)."""
TOOL_RE = re.compile(r"^[A-Za-z0-9_-]+$")
MAX_NAME = 64
"""Converse tool names are ``[a-zA-Z0-9_-]{1,64}``, so ``<id>___<tool>`` must fit in 64 characters."""
SEP = "___"
GATEWAY_SERVER = "gateway"
REGISTRY_URL = "https://registry.modelcontextprotocol.io/v0/servers"
KEY_PARAM = re.compile(r"key|token|secret|password|auth", re.I)
KEY_IN_LINK = "Leave the key out of the link; I'll ask for it in a safe field."

Record = dict[str, Any]


def resource_tags(env: Mapping[str, str] | None = None) -> dict[str, str]:
    """Tags for what the city creates at runtime (secrets, Identity providers): ``AIC_DEFAULT_TAGS`` (JSON, the
    project's full set) with ``Project`` and ``Component=connectors`` always present, because IAM requires them at
    create time (``aws:RequestTag``)."""
    import os

    raw = (os.environ if env is None else env).get("AIC_DEFAULT_TAGS") or "{}"
    try:
        base = {str(k): str(v) for k, v in dict(json.loads(raw)).items()}
    except (ValueError, TypeError):
        base = {}
    return {"Project": "ai-city", **base, "Component": "connectors"}


Resolver = Callable[[str], list[str]]
"""host -> the IP addresses it resolves to."""


def sk(id: str) -> str:
    return f"CONN#{id}"


def gateway_name(id: str, tool: str) -> str:
    """The Gateway's tool name, and the Converse name on AIC's direct path."""
    return f"{id}{SEP}{tool}"


def full_name(id: str, tool: str) -> str:
    """The name the gate, the audit and the SDK use."""
    return f"mcp__{GATEWAY_SERVER}__{gateway_name(id, tool)}"


def public(rec: Mapping[str, Any]) -> Record:
    """The record as the HUD sees it: no keys, no sign-in state."""
    out = {k: v for k, v in rec.items() if k not in ("pk", "sk")}
    if isinstance(out.get("oauth"), dict):
        out["oauth"] = {k: v for k, v in out["oauth"].items() if k not in ("state", "session_uri")}
    return out


def event(rec: Mapping[str, Any], status: str | None = None) -> dict[str, Any]:
    e: dict[str, Any] = {
        "type": "connector.updated",
        "id": rec["id"],
        "label": rec.get("label") or rec["id"],
        "status": status or rec.get("status", "error"),
        "auth": rec.get("auth") or "unknown",
    }
    if rec.get("needs"):
        e["needs"] = rec["needs"]
    if rec.get("error"):
        e["error"] = str(rec["error"])[:300]
    return e


def approval_hash(id: str, url: str, roles: Mapping[str, str]) -> str:
    """Binds an add-connector approval to the exact id, URL and roles."""
    return action_hash("connector.add", {"id": id, "url": url, "roles": dict(roles)})


# ---------- the store ----------
class ConnectorStore:
    def __init__(self, table: Table, now: Callable[[], Any] | None = None) -> None:
        self.table = table
        self._now = now

    def _iso(self) -> str:
        return now_iso(self._now() if self._now else None)

    async def list(self) -> list[Record]:
        return [r for r in await self.table.query(PK, "CONN#") if r.get("id")]

    async def get(self, id: str) -> Record | None:
        return await self.table.get(PK, sk(id)) if ID_RE.match(id) else None

    async def create(self, rec: Record) -> bool:
        at = self._iso()
        return await self.table.put({"pk": PK, "sk": sk(rec["id"]), "created_at": at, "updated_at": at, **rec}, True)

    async def update(self, id: str, patch: Mapping[str, Any], expect: Mapping[str, Any] | None = None) -> Record | None:
        return await self.table.update(
            PK,
            sk(id),
            UpdateOptions(set={**patch, "updated_at": self._iso()}, must_exist=True, expect=dict(expect or {})),
        )

    async def delete(self, id: str) -> None:
        await self.table.delete(PK, sk(id))

    async def stamp(self) -> str:
        """Changes when any connector changes: the runtimes' tool cache key."""
        return "|".join(f"{r['id']}@{r.get('updated_at', '')}" for r in await self.list())


# ---------- validation ----------
def valid_roles(v: Any) -> dict[str, str] | None:
    if not isinstance(v, dict) or not v:
        return None
    if any(k not in ROLES or lv not in LEVELS for k, lv in v.items()):
        return None
    return {k: str(lv) for k, lv in v.items()}


def make_id(name: str, label: str | None = None) -> str:
    """``higgsfield``, or ``outlook-work`` for a labelled second account."""

    def slug(s: str) -> str:
        return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")

    base = slug(name) or "mcp"
    if not base[0].isalpha():
        base = f"mcp-{base}"
    base = base[:20].strip("-")
    if label:
        base = f"{base}-{slug(label)[:9]}".strip("-")
    return base[:31].strip("-")


def name_from_url(url: str) -> str:
    host = urllib.parse.urlsplit(url).hostname or "mcp"
    parts = [p for p in host.split(".")[:-1] if p not in ("www", "mcp", "api", "server", "remote")]
    return parts[-1] if parts else host.split(".")[0]


def system_resolver(host: str) -> list[str]:
    return list({str(i[4][0]) for i in socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)})


def _blocked(ip: str) -> bool:
    a = ipaddress.ip_address(ip.split("%", maxsplit=1)[0])
    if isinstance(a, ipaddress.IPv6Address) and a.ipv4_mapped:
        a = a.ipv4_mapped
    return (
        a.is_private
        or a.is_loopback
        or a.is_link_local
        or a.is_multicast
        or a.is_reserved
        or a.is_unspecified
        or not a.is_global
        or str(a) in ("169.254.169.254", "fd00:ec2::254")
    )


def check_url(url: str, resolve: Resolver = system_resolver) -> str | None:
    """None when the URL may be used for a connector; otherwise the plain reason it may not."""
    try:
        p = urllib.parse.urlsplit(url.strip())
    except ValueError:
        return "That is not a link I can use."
    if p.scheme != "https":
        return "Only https links can be connectors."
    if p.username or p.password or "@" in p.netloc:
        return KEY_IN_LINK
    if any(KEY_PARAM.search(k) for k, _ in urllib.parse.parse_qsl(p.query, keep_blank_values=True)):
        return KEY_IN_LINK
    host = p.hostname or ""
    if not host or len(url) > 2000:
        return "That is not a link I can use."
    if host == "localhost" or host.endswith((".localhost", ".internal", ".local")):
        return "That address is private; connectors must be on the public internet."
    try:
        ips = [host] if _is_ip(host) else resolve(host)
    except OSError:
        return f"I couldn't find the server {host}."
    if not ips or any(_blocked(i) for i in ips):
        return "That address is private; connectors must be on the public internet."
    return None


def _is_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


# ---------- the official MCP Registry ----------
async def registry_search(name: str, transport: Transport = urllib_transport) -> list[Record]:
    """Up to five remote servers matching ``name``. Registry text is untrusted data: shown, never followed."""
    url = f"{REGISTRY_URL}?{urllib.parse.urlencode({'search': name[:80], 'limit': 5})}"
    resp: HttpResponse = await asyncio.to_thread(transport, url, {"accept": "application/json"}, b"", 5)
    if resp.status != 200:
        return []
    try:
        data = json.loads(resp.body)
    except json.JSONDecodeError:
        return []
    out: list[Record] = []
    for entry in data.get("servers") or []:
        srv = entry.get("server", entry) if isinstance(entry, dict) else {}
        for rem in srv.get("remotes") or []:
            if not isinstance(rem, dict) or rem.get("type") not in ("streamable-http", "sse"):
                continue
            if not isinstance(rem.get("url"), str):
                continue
            secret_header = next(
                (
                    h
                    for h in rem.get("headers") or []
                    if isinstance(h, dict) and h.get("isSecret") and isinstance(h.get("name"), str)
                ),
                None,
            )
            out.append(
                {
                    "name": str(srv.get("name", ""))[:120],
                    "title": str(srv.get("title") or srv.get("name") or "")[:120],
                    "description": str(srv.get("description", ""))[:300],
                    "url": rem["url"],
                    "key_header": secret_header["name"][:80] if secret_header else None,
                }
            )
            break
        if len(out) >= 5:
            break
    return out


# ---------- tools: annotations, per-role filter, approval levels ----------
def tool_entry(t: Mapping[str, Any]) -> Record:
    """A record tool from an MCP tool. Unknown counts as a write and destructive."""
    ann = t.get("annotations") or {}
    read_only = ann.get("readOnlyHint") is True
    return {
        "name": str(t["name"]),
        "description": str(t.get("description") or "")[:1000],
        "read_only": read_only,
        "destructive": not read_only and ann.get("destructiveHint") is not False,
    }


def is_read_only(t: Mapping[str, Any]) -> bool:
    return t.get("read_only") is True and t.get("destructive") is False


def connectors_for(records: Iterable[Record], role: str, hire: Iterable[str] | None = None) -> list[Record]:
    """The ready connectors this role may use, each with only the tools its level allows. For a worker, only
    the connectors on its hire."""
    allowed = set(hire) if hire is not None else None
    out: list[Record] = []
    for r in records:
        level = (r.get("roles") or {}).get(role)
        if r.get("status") != "ready" or level not in LEVELS:
            continue
        if role == "worker" and (allowed is None or r["id"] not in allowed):
            continue
        tools = [t for t in r.get("tools") or [] if level == "all" or is_read_only(t)]
        if tools:
            out.append({**r, "tools": tools})
    return out


def approval_reason(rec: Mapping[str, Any], tool: Mapping[str, Any]) -> str | None:
    """Why this call needs the owner, by the connector's ``approval`` setting; None when it doesn't."""
    level = rec.get("approval") or "destructive"
    label = rec.get("label") or rec.get("id")
    if level == "none":
        return None
    if level == "writes" and not is_read_only(tool):
        return f"{label}: {tool['name']} changes something outside the city."
    if tool.get("destructive") is not False and not is_read_only(tool):
        return f"{label}: {tool['name']} may delete or overwrite something outside the city."
    return None


def record_tool(rec: Mapping[str, Any], tool: str) -> Record | None:
    return next((t for t in rec.get("tools") or [] if t.get("name") == tool), None)
