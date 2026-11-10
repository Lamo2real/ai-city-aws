"""Production wiring of Files from the environment (docs/FILES.md §9). None when it is not deployed."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from ..clients import client, resource
from ..knowledge.blobs import S3Blobs
from ..table import DynamoTable
from .embed import TitanEmbedder
from .store import FilesStore


@dataclass
class FilesAws:
    store: FilesStore
    blobs: S3Blobs
    embedder: TitanEmbedder


def files_from_env(session: Any, env: Mapping[str, str] | None = None) -> FilesAws | None:
    """``FILES_TABLE`` and ``FILES_BUCKET``, both or nothing."""
    e = os.environ if env is None else env
    table, bucket = e.get("FILES_TABLE"), e.get("FILES_BUCKET")
    if not table or not bucket:
        return None
    return FilesAws(
        store=FilesStore(DynamoTable(resource(session, "dynamodb").Table(table))),
        blobs=S3Blobs(client(session, "s3"), bucket),
        embedder=TitanEmbedder(client(session, "bedrock-runtime")),
    )
