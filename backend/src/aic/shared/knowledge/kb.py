"""The Bedrock Knowledge Base: ``Retrieve`` with the scope filter, and data-source syncs (ingestion jobs)."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class Hit:
    item_id: str
    text: str
    score: float
    scope: str = ""
    kind: str = ""


class ConflictException(RuntimeError):
    """An ingestion job is already running on the data source. The pipeline retries this by name."""


class KnowledgeBase(Protocol):
    async def retrieve(self, query: str, max_results: int, scopes: list[str]) -> list[Hit]: ...
    async def start_sync(self) -> str: ...
    async def sync_status(self, job_id: str) -> str:
        """STARTING, IN_PROGRESS, COMPLETE, FAILED, STOPPING or STOPPED."""
        ...


def scope_filter(scopes: list[str]) -> dict[str, Any]:
    return {"in": {"key": "scope", "value": list(scopes)}}


class BedrockKnowledgeBase:
    """``runtime`` is a boto3 ``bedrock-agent-runtime`` client, ``agent`` a ``bedrock-agent`` client."""

    def __init__(self, kb_id: str, data_source_id: str, runtime: Any = None, agent: Any = None) -> None:
        self.kb_id = kb_id
        self.data_source_id = data_source_id
        self._runtime = runtime
        self._agent = agent

    async def retrieve(self, query: str, max_results: int, scopes: list[str]) -> list[Hit]:
        r = await asyncio.to_thread(
            self._runtime.retrieve,
            knowledgeBaseId=self.kb_id,
            retrievalQuery={"text": query},
            retrievalConfiguration={
                "vectorSearchConfiguration": {"numberOfResults": max_results, "filter": scope_filter(scopes)}
            },
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

    async def start_sync(self) -> str:
        try:
            r = await asyncio.to_thread(
                self._agent.start_ingestion_job, knowledgeBaseId=self.kb_id, dataSourceId=self.data_source_id
            )
        except Exception as e:
            code = (getattr(e, "response", None) or {}).get("Error", {}).get("Code")
            if code == "ConflictException" or type(e).__name__ == "ConflictException":
                raise ConflictException("A knowledge base sync is already running.") from e
            raise
        return str(r["ingestionJob"]["ingestionJobId"])

    async def sync_status(self, job_id: str) -> str:
        r = await asyncio.to_thread(
            self._agent.get_ingestion_job,
            knowledgeBaseId=self.kb_id,
            dataSourceId=self.data_source_id,
            ingestionJobId=job_id,
        )
        return str(r["ingestionJob"]["status"])


@dataclass
class FakeKnowledgeBase:
    """For tests: returns the scripted hits that pass the scope filter, like the real filter would."""

    hits: list[Hit] = field(default_factory=list)
    calls: list[dict[str, Any]] = field(default_factory=list)
    syncs: list[str] = field(default_factory=list)
    status: str = "COMPLETE"
    busy: bool = False

    async def retrieve(self, query: str, max_results: int, scopes: list[str]) -> list[Hit]:
        self.calls.append({"query": query, "max_results": max_results, "filter": scope_filter(scopes)})
        return [h for h in self.hits if h.scope in scopes][:max_results]

    async def start_sync(self) -> str:
        if self.busy:
            raise ConflictException("A knowledge base sync is already running.")
        self.syncs.append(f"job-{len(self.syncs) + 1}")
        return self.syncs[-1]

    async def sync_status(self, job_id: str) -> str:
        return self.status
