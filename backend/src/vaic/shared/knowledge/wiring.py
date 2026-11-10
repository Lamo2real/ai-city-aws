"""Production wiring of the knowledge base from the environment (§8). None when it is not configured.

Clients come from ``vaic.shared.clients``: one per service per process, with the shared ``Config``.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from ..clients import client, resource
from ..table import DynamoTable
from .blobs import S3Blobs
from .graph import NeptuneGraph
from .kb import BedrockKnowledgeBase
from .store import KnowledgeStore


@dataclass
class KnowledgeAws:
    store: KnowledgeStore
    blobs: S3Blobs | None
    kb: BedrockKnowledgeBase | None


def knowledge_from_env(session: Any, env: Mapping[str, str] | None = None) -> KnowledgeAws | None:
    """``session`` is a boto3 session. Only ``KNOWLEDGE_TABLE`` is required; bucket, KB and graph when set."""
    e = os.environ if env is None else env
    table_name = e.get("KNOWLEDGE_TABLE")
    if not table_name:
        return None
    graph_id = e.get("KNOWLEDGE_GRAPH_ID")
    graph = NeptuneGraph(client(session, "neptune-graph"), graph_id) if graph_id else None
    store = KnowledgeStore(DynamoTable(resource(session, "dynamodb").Table(table_name)), graph)
    bucket = e.get("KNOWLEDGE_BUCKET")
    blobs = S3Blobs(client(session, "s3"), bucket) if bucket else None
    kb_id, ds_id = e.get("KNOWLEDGE_BASE_ID"), e.get("KNOWLEDGE_DATA_SOURCE_ID")
    kb = (
        BedrockKnowledgeBase(
            kb_id, ds_id, runtime=client(session, "bedrock-agent-runtime"), agent=client(session, "bedrock-agent")
        )
        if kb_id and ds_id
        else None
    )
    return KnowledgeAws(store=store, blobs=blobs, kb=kb)
