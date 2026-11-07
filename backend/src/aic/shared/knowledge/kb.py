"""The Bedrock Knowledge Base: hybrid ``Retrieve`` with the scope filter, and direct ingestion (§9, §10, §14).

Documents are added, re-ingested and deleted one item at a time with ``IngestKnowledgeBaseDocuments``,
``GetKnowledgeBaseDocuments`` and ``DeleteKnowledgeBaseDocuments`` (at most 25 per call); there are no
data-source syncs.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Protocol

MAX_DOCS_PER_CALL = 25
INDEXED = ("INDEXED", "PARTIALLY_INDEXED")
FAILED = ("FAILED", "METADATA_UPDATE_FAILED", "IGNORED", "NOT_FOUND")


@dataclass(frozen=True)
class Hit:
    item_id: str
    text: str
    score: float
    scope: str = ""
    kind: str = ""


class ThrottlingException(RuntimeError):
    """Bedrock throttled the ingestion call. The pipeline retries this by its exact name."""


class KnowledgeBase(Protocol):
    async def retrieve(self, query: str, max_results: int, scopes: list[str]) -> list[Hit]: ...
    async def ingest(self, docs: list[tuple[str, dict[str, str]]]) -> None:
        """(S3 URI, metadata attributes) per document; the same call re-ingests with new metadata."""
        ...

    async def statuses(self, uris: list[str]) -> dict[str, str]: ...
    async def delete(self, uris: list[str]) -> None: ...


def scope_filter(scopes: list[str]) -> dict[str, Any]:
    return {"in": {"key": "scope", "value": list(scopes)}}


def retrieval_config(max_results: int, scopes: list[str]) -> dict[str, Any]:
    return {
        "vectorSearchConfiguration": {
            "numberOfResults": max_results,
            "overrideSearchType": "HYBRID",
            "filter": scope_filter(scopes),
        }
    }


def s3_identifier(uri: str) -> dict[str, Any]:
    return {"dataSourceType": "S3", "s3": {"uri": uri}}


def ingest_document(uri: str, metadata: dict[str, str]) -> dict[str, Any]:
    return {
        "content": {"dataSourceType": "S3", "s3": {"s3Location": {"uri": uri}}},
        "metadata": {
            "type": "IN_LINE_ATTRIBUTE",
            "inlineAttributes": [
                {"key": k, "value": {"type": "STRING", "stringValue": v}} for k, v in sorted(metadata.items())
            ],
        },
    }


def _chunks(xs: list[Any]) -> list[list[Any]]:
    return [xs[i : i + MAX_DOCS_PER_CALL] for i in range(0, len(xs), MAX_DOCS_PER_CALL)]


def _is_throttle(e: Exception) -> bool:
    code = (getattr(e, "response", None) or {}).get("Error", {}).get("Code")
    return code in ("ThrottlingException", "TooManyRequestsException") or type(e).__name__ == "ThrottlingException"


class BedrockKnowledgeBase:
    """``runtime`` is a boto3 ``bedrock-agent-runtime`` client, ``agent`` a ``bedrock-agent`` client."""

    def __init__(self, kb_id: str, data_source_id: str, runtime: Any = None, agent: Any = None) -> None:
        self.kb_id = kb_id
        self.data_source_id = data_source_id
        self._runtime = runtime
        self._agent = agent

    def _ids(self) -> dict[str, str]:
        return {"knowledgeBaseId": self.kb_id, "dataSourceId": self.data_source_id}

    async def retrieve(self, query: str, max_results: int, scopes: list[str]) -> list[Hit]:
        r = await asyncio.to_thread(
            self._runtime.retrieve,
            knowledgeBaseId=self.kb_id,
            retrievalQuery={"text": query},
            retrievalConfiguration=retrieval_config(max_results, scopes),
        )
        out: list[Hit] = []
        for res in r.get("retrievalResults", []):
            meta = res.get("metadata") or {}
            item_id = meta.get("item_id")
            if not isinstance(item_id, str):
                continue
            out.append(
                Hit(
                    item_id=item_id,
                    text=str((res.get("content") or {}).get("text", "")),
                    score=float(res.get("score") or 0),
                    scope=str(meta.get("scope", "")),
                    kind=str(meta.get("kind", "")),
                )
            )
        return out

    async def ingest(self, docs: list[tuple[str, dict[str, str]]]) -> None:
        for chunk in _chunks(docs):
            try:
                await asyncio.to_thread(
                    self._agent.ingest_knowledge_base_documents,
                    **self._ids(),
                    documents=[ingest_document(u, m) for u, m in chunk],
                )
            except Exception as e:
                if _is_throttle(e):
                    raise ThrottlingException("The knowledge base is busy; trying again shortly.") from e
                raise

    async def statuses(self, uris: list[str]) -> dict[str, str]:
        out: dict[str, str] = {}
        for chunk in _chunks(uris):
            r = await asyncio.to_thread(
                self._agent.get_knowledge_base_documents,
                **self._ids(),
                documentIdentifiers=[s3_identifier(u) for u in chunk],
            )
            for d in r.get("documentDetails", []):
                uri = ((d.get("identifier") or {}).get("s3") or {}).get("uri")
                if uri:
                    out[str(uri)] = str(d.get("status", ""))
        return out

    async def delete(self, uris: list[str]) -> None:
        for chunk in _chunks(uris):
            try:
                await asyncio.to_thread(
                    self._agent.delete_knowledge_base_documents,
                    **self._ids(),
                    documentIdentifiers=[s3_identifier(u) for u in chunk],
                )
            except Exception as e:
                if _is_throttle(e):
                    raise ThrottlingException("The knowledge base is busy; trying again shortly.") from e
                raise


@dataclass
class FakeKnowledgeBase:
    """For tests: scripted hits that pass the scope filter, and a document table like direct ingestion keeps."""

    hits: list[Hit] = field(default_factory=list)
    calls: list[dict[str, Any]] = field(default_factory=list)
    docs: dict[str, dict[str, str]] = field(default_factory=dict)
    """S3 URI → inline metadata of the documents in the index."""
    status: dict[str, str] = field(default_factory=dict)
    ingest_calls: list[list[str]] = field(default_factory=list)
    throttle: int = 0
    """Throttle the next N ingest calls."""

    async def retrieve(self, query: str, max_results: int, scopes: list[str]) -> list[Hit]:
        self.calls.append(
            {
                "query": query,
                "max_results": max_results,
                **retrieval_config(max_results, scopes)["vectorSearchConfiguration"],
            }
        )
        return [h for h in self.hits if h.scope in scopes][:max_results]

    async def ingest(self, docs: list[tuple[str, dict[str, str]]]) -> None:
        for chunk in _chunks(docs):
            if self.throttle > 0:
                self.throttle -= 1
                raise ThrottlingException("The knowledge base is busy; trying again shortly.")
            self.ingest_calls.append([u for u, _ in chunk])
            for u, m in chunk:
                self.docs[u] = dict(m)
                self.status.setdefault(u, "STARTING")

    async def statuses(self, uris: list[str]) -> dict[str, str]:
        return {u: self.status.get(u, "NOT_FOUND") for u in uris}

    async def delete(self, uris: list[str]) -> None:
        for u in uris:
            self.docs.pop(u, None)
            self.status.pop(u, None)
