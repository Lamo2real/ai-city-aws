"""The thin AWS wrappers, on fake boto3 clients: Retrieve parsing, sync conflicts, S3 calls, Converse blocks."""

from typing import Any, ClassVar

import pytest

from aic.shared.knowledge.blobs import S3Blobs
from aic.shared.knowledge.kb import BedrockKnowledgeBase, ConflictException
from aic.shared.models import resolve_role
from aic.shared.turn import TurnInput
from aic.shared.utility import bedrock_converse_runner


class Recorder:
    def __init__(self, **answers: Any) -> None:
        self.answers = answers
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def __getattr__(self, name: str) -> Any:
        def call(*a: Any, **kw: Any) -> Any:
            self.calls.append((name, kw))
            ans = self.answers.get(name)
            if isinstance(ans, Exception):
                raise ans
            return ans(*a, **kw) if callable(ans) else ans

        return call


async def test_retrieve_sends_the_scope_filter_and_reads_item_metadata() -> None:
    rt = Recorder(
        retrieve={
            "retrievalResults": [
                {
                    "content": {"text": "hello"},
                    "score": 0.7,
                    "metadata": {"item_id": "k-aaaaaaaaaaaa", "scope": "relevant", "kind": "text"},
                },
                {"content": {"text": "no id"}, "score": 0.9, "metadata": {}},
            ]
        }
    )
    kb = BedrockKnowledgeBase("KB1", "DS1", runtime=rt)
    hits = await kb.retrieve("q", 8, ["always", "relevant"])
    assert [(h.item_id, h.text, h.score, h.scope) for h in hits] == [("k-aaaaaaaaaaaa", "hello", 0.7, "relevant")]
    name, kw = rt.calls[0]
    assert name == "retrieve" and kw["knowledgeBaseId"] == "KB1"
    assert kw["retrievalConfiguration"]["vectorSearchConfiguration"] == {
        "numberOfResults": 8,
        "filter": {"in": {"key": "scope", "value": ["always", "relevant"]}},
    }


async def test_a_busy_data_source_raises_conflict_exception_by_name() -> None:
    class Busy(Exception):
        response: ClassVar[dict[str, Any]] = {"Error": {"Code": "ConflictException"}}

    kb = BedrockKnowledgeBase("KB1", "DS1", agent=Recorder(start_ingestion_job=Busy()))
    with pytest.raises(ConflictException):
        await kb.start_sync()
    ok = BedrockKnowledgeBase(
        "KB1",
        "DS1",
        agent=Recorder(
            start_ingestion_job={"ingestionJob": {"ingestionJobId": "J1"}},
            get_ingestion_job={"ingestionJob": {"status": "COMPLETE"}},
        ),
    )
    assert await ok.start_sync() == "J1"
    assert await ok.sync_status("J1") == "COMPLETE"


async def test_s3_presigns_put_and_parts_and_deletes_by_prefix() -> None:
    s3 = Recorder(
        generate_presigned_url=lambda op, Params, ExpiresIn: f"https://signed/{op}/{Params['Key']}/{ExpiresIn}",
        create_multipart_upload={"UploadId": "U1"},
        list_objects_v2={"Contents": [{"Key": "raw/k/a"}, {"Key": "raw/k/b"}]},
    )
    b = S3Blobs(s3, "bucket")
    assert await b.presign_put("raw/k/a", "application/pdf") == "https://signed/put_object/raw/k/a/3600"
    assert await b.start_multipart("raw/k/a", "video/mp4") == "U1"
    assert await b.presign_part("raw/k/a", "U1", 3) == "https://signed/upload_part/raw/k/a/3600"
    await b.complete_multipart("raw/k/a", "U1", [{"part_number": 1, "etag": "e"}])
    assert await b.delete_prefix("raw/k/") == 2
    calls = dict(s3.calls)
    assert calls["complete_multipart_upload"]["MultipartUpload"] == {"Parts": [{"PartNumber": 1, "ETag": "e"}]}
    assert calls["delete_objects"]["Delete"]["Objects"] == [{"Key": "raw/k/a"}, {"Key": "raw/k/b"}]


async def test_converse_runner_sends_attachments_before_the_prompt_and_reads_cited_text() -> None:
    bedrock = Recorder(
        converse={
            "output": {
                "message": {
                    "content": [{"citationsContent": {"content": [{"text": "## Page 1\n"}]}}, {"text": "words"}]
                }
            },
            "usage": {"inputTokens": 10, "outputTokens": 5},
            "stopReason": "end_turn",
        }
    )
    run = bedrock_converse_runner(bedrock)
    doc = {
        "document": {
            "format": "pdf",
            "name": "pages from 1",
            "source": {"bytes": b"%PDF"},
            "citations": {"enabled": True},
        }
    }
    out = await run(
        TurnInput(
            role="utility",
            agent_id="utility",
            session_id="s",
            model=resolve_role("utility").primary,
            cache_ttl="5m",
            prompt="read",
            attachments=(doc,),
            max_tokens=8192,
        )
    )
    assert out.text == "## Page 1\nwords" and out.usage.input == 10
    kw = bedrock.calls[0][1]
    assert kw["messages"][0]["content"] == [doc, {"text": "read"}]
    assert kw["inferenceConfig"] == {"maxTokens": 8192}
