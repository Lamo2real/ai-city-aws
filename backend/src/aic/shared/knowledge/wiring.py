"""Production wiring of the knowledge base from the environment (§8). None when it is not configured."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from ..table import DynamoTable
from .blobs import S3Blobs
from .kb import BedrockKnowledgeBase
from .store import KnowledgeStore


@dataclass
class KnowledgeAws:
    store: KnowledgeStore
    blobs: S3Blobs | None
    kb: BedrockKnowledgeBase | None


def knowledge_from_env(session: Any, env: Mapping[str, str] | None = None) -> KnowledgeAws | None:
    """``session`` is a boto3 session. Only ``KNOWLEDGE_TABLE`` is required; bucket and KB are used when set."""
    e = os.environ if env is None else env
    table_name = e.get("KNOWLEDGE_TABLE")
    if not table_name:
        return None
    from botocore.config import Config

    store = KnowledgeStore(DynamoTable(session.resource("dynamodb").Table(table_name)))
    bucket = e.get("KNOWLEDGE_BUCKET")
    blobs = S3Blobs(session.client("s3", config=Config(signature_version="s3v4")), bucket) if bucket else None
    kb_id, ds_id = e.get("KNOWLEDGE_BASE_ID"), e.get("KNOWLEDGE_DATA_SOURCE_ID")
    kb = (
        BedrockKnowledgeBase(
            kb_id, ds_id, runtime=session.client("bedrock-agent-runtime"), agent=session.client("bedrock-agent")
        )
        if kb_id and ds_id
        else None
    )
    return KnowledgeAws(store=store, blobs=blobs, kb=kb)
