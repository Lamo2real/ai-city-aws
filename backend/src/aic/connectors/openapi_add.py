"""``add_connector`` for an OpenAPI 3 link (``docs/CONNECTORS_SKILLS.md`` §1.11).

Called by VAIC's tool after the link passed the URL checks. It GETs the link once: anything that isn't an OpenAPI
document returns None, and the tool goes on as for an MCP server. For a spec, it parses it, writes the record
(``pending_approval``, ``transport = "openapi"``, the normalized spec's hash) and files the owner's card. Nothing
is fetched with a credential and nothing is provisioned until the owner says yes.
"""

from __future__ import annotations

from typing import Any

from aic.shared.connectors import ConnectorStore, Record, approval_hash, check_url, event, make_id, name_from_url
from aic.shared.mcp_http import Transport

from . import openapi


async def add_from_link(
    d: Any,
    c: Any,
    url: str,
    label: str | None,
    roles: dict[str, str],
    used_by: str,
    net: Transport,
    resolve: Any,
) -> str | None:
    """The tool's answer for a spec link, or None when the link isn't an OpenAPI document."""
    try:
        doc = await openapi.fetch_doc(url, net)
        if doc is None:
            return None
        name = name_from_url(openapi.base_url(doc, url))
        spec = openapi.normalize(doc, url, make_id(name, label))
    except openapi.SpecError as e:
        return str(e)
    if bad := check_url(spec["base_url"], resolve):
        return f"The API's address isn't usable: {bad}"
    if not spec["operations"]:
        reason = f" Skipped: {'; '.join(spec['skipped'][:5])}." if spec["skipped"] else ""
        return f"That API description has no operations the city can use.{reason}"
    store = ConnectorStore(d.ledger.table, d.ledger.now)
    existing = await store.list()
    same = [r for r in existing if r.get("url") == url]
    if same and not label:
        labels = ", ".join(str(r.get("label") or r["id"]) for r in same)
        return (
            f"That API is already connected ({labels}). If the owner wants another account on it, ask for a label "
            "(for example 'work' or 'personal') and call add_connector again with it."
        )
    id = make_id(name, label)
    if any(r["id"] == id for r in existing):
        return f"There is already a connector called {id}. Ask the owner for a different label."
    title = spec["title"] if 0 < len(spec["title"]) <= 40 else f"{name.capitalize()} API"
    if not title.lower().endswith("api"):
        title = f"{title} API"
    shown = f"{title[:30]} ({label})" if label else title
    digest = openapi.sha256(spec)
    rec: Record = {
        "id": id,
        "label": shown,
        "url": url,
        "source": "owner_url",
        "transport": "openapi",
        "openapi": {
            "spec_url": url,
            "spec_key": None,
            "base_url": spec["base_url"],
            "operations": len(spec["operations"]),
            "sha256": digest,
            "auth": spec["auth"],
        },
        "auth": None,
        "status": "pending_approval",
        "roles": roles,
        "approval": "destructive",
        "tools": [],
        "target_id": None,
        "provider_name": f"aic-conn-{id}",
        "requested_by": c.message_id or c.ticket_id,
    }
    if not await store.create(rec):
        return f"There is already a connector called {id}. Ask the owner for a different label."
    action = openapi.card(shown, spec, url, used_by)
    ap = await d.ledger.request_approval(
        {
            "agent": c.agent_id,
            "ticket_id": None,
            "tool": "connector.add",
            "kind": "connector.add",
            "connector_id": id,
            "action": action,
            "hash": approval_hash(id, url, roles),
            "reason": "Adding a connector lets agents reach an outside service.",
        }
    )
    await d.bus.put(
        {
            "type": "approval.requested",
            "id": ap["id"],
            "agent": c.agent_id,
            "action": action,
            "reason": ap["reason"],
            "kind": "connector.add",
            "connector_id": id,
        }
    )
    await d.bus.put(event(rec))
    return (
        f"A card is waiting for the owner to approve connecting {shown} ({spec['base_url']}, "
        f"{len(spec['operations'])} actions). Nothing is connected yet."
    )
