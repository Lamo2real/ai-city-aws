"""The thin AWS wrappers, on fake boto3 clients: Retrieve parsing, sync conflicts, S3 calls, Converse blocks."""

from typing import Any, ClassVar

import pytest

from aic.shared.knowledge.blobs import S3Blobs
from aic.shared.knowledge.kb import BedrockKnowledgeBase, ThrottlingException
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


async def test_retrieve_is_hybrid_with_the_scope_filter_and_reads_item_metadata() -> None:
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
        "overrideSearchType": "HYBRID",
        "filter": {"in": {"key": "scope", "value": ["always", "relevant"]}},
    }


class Throttled(Exception):
    response: ClassVar[dict[str, Any]] = {"Error": {"Code": "ThrottlingException"}}


async def test_direct_ingestion_sends_s3_documents_with_inline_metadata_25_per_call() -> None:
    agent = Recorder(ingest_knowledge_base_documents={})
    kb = BedrockKnowledgeBase("KB1", "DS1", agent=agent)
    meta = {"item_id": "k-aaaaaaaaaaaa", "scope": "relevant", "kind": "text"}
    await kb.ingest([(f"s3://b/normalized/k/{n}.md", meta) for n in range(30)])
    assert [len(kw["documents"]) for _, kw in agent.calls] == [25, 5]
    _, kw = agent.calls[0]
    assert kw["knowledgeBaseId"] == "KB1" and kw["dataSourceId"] == "DS1"
    assert kw["documents"][0] == {
        "content": {"dataSourceType": "S3", "s3": {"s3Location": {"uri": "s3://b/normalized/k/0.md"}}},
        "metadata": {
            "type": "IN_LINE_ATTRIBUTE",
            "inlineAttributes": [
                {"key": "item_id", "value": {"type": "STRING", "stringValue": "k-aaaaaaaaaaaa"}},
                {"key": "kind", "value": {"type": "STRING", "stringValue": "text"}},
                {"key": "scope", "value": {"type": "STRING", "stringValue": "relevant"}},
            ],
        },
    }
    with pytest.raises(ThrottlingException):
        await BedrockKnowledgeBase("KB1", "DS1", agent=Recorder(ingest_knowledge_base_documents=Throttled())).ingest(
            [("s3://b/x", meta)]
        )


async def test_document_status_and_delete_use_s3_identifiers() -> None:
    agent = Recorder(
        get_knowledge_base_documents={
            "documentDetails": [
                {"identifier": {"dataSourceType": "S3", "s3": {"uri": "s3://b/a"}}, "status": "INDEXED"}
            ]
        },
        delete_knowledge_base_documents={},
    )
    kb = BedrockKnowledgeBase("KB1", "DS1", agent=agent)
    assert await kb.statuses(["s3://b/a"]) == {"s3://b/a": "INDEXED"}
    await kb.delete(["s3://b/a"])
    assert agent.calls[1][1]["documentIdentifiers"] == [{"dataSourceType": "S3", "s3": {"uri": "s3://b/a"}}]
    with pytest.raises(ThrottlingException):
        await BedrockKnowledgeBase("KB1", "DS1", agent=Recorder(delete_knowledge_base_documents=Throttled())).delete(
            ["s3://b/a"]
        )


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


def test_every_client_shares_one_config_and_is_made_once() -> None:
    from aic.shared.clients import CONFIG, client, config_for

    made: list[tuple[str, Any]] = []

    class Session:
        def client(self, service: str, config: Any) -> object:
            made.append((service, config))
            return object()

    s = Session()
    assert client(s, "s3") is client(s, "s3")
    assert client(s, "neptune-graph") is client(s, "neptune-graph")
    assert [m[0] for m in made] == ["s3", "neptune-graph"]
    assert CONFIG.max_pool_connections == 50 and CONFIG.tcp_keepalive is True
    assert CONFIG.retries == {"mode": "adaptive", "max_attempts": 5}
    assert (CONFIG.connect_timeout, CONFIG.read_timeout) == (2, 10)
    assert config_for("bedrock-runtime").read_timeout == 300 and config_for("transcribe").read_timeout == 60
    assert config_for("s3").signature_version == "s3v4" and config_for("s3").max_pool_connections == 50


def test_the_api_lambda_does_not_import_pypdf_or_pillow() -> None:
    import subprocess
    import sys

    code = (
        "import sys, aic.lambdas.api, aic.runtime.tools, aic.shared.knowledge.search; "
        "bad = [m for m in ('pypdf', 'PIL') if m in sys.modules]; "
        "sys.exit(1 if bad else 0)"
    )
    r = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, check=False)
    assert r.returncode == 0, r.stderr


async def test_dynamo_batch_get_reads_typed_answers_and_retries_unprocessed_keys() -> None:
    from aic.shared.table import DynamoTable

    answers = [
        {"Responses": {"t": [{"pk": {"S": "ITEM#a"}, "sk": {"S": "META"}, "n": {"N": "3"}}]},
         "UnprocessedKeys": {"t": {"Keys": [{"pk": {"S": "ITEM#b"}, "sk": {"S": "META"}}]}}},
        {"Responses": {"t": [{"pk": {"S": "ITEM#b"}, "sk": {"S": "META"}, "x": {"BOOL": True}}]}},
    ]  # fmt: skip
    sent: list[Any] = []

    class Client:
        def batch_get_item(self, RequestItems: Any) -> Any:
            sent.append(RequestItems)
            return answers.pop(0)

    class Meta:
        client = Client()

    class Tbl:
        name = "t"
        meta = Meta()

    got = await DynamoTable(Tbl()).batch_get([("ITEM#a", "META"), ("ITEM#b", "META"), ("ITEM#a", "META")])
    assert got == [{"pk": "ITEM#a", "sk": "META", "n": 3}, {"pk": "ITEM#b", "sk": "META", "x": True}]
    assert sent[0]["t"]["Keys"] == [
        {"pk": {"S": "ITEM#a"}, "sk": {"S": "META"}},
        {"pk": {"S": "ITEM#b"}, "sk": {"S": "META"}},
    ]
    assert sent[0]["t"]["ConsistentRead"] is True


def test_the_api_lambda_builds_its_clients_while_loading_inside_lambda(monkeypatch: pytest.MonkeyPatch) -> None:
    from aic.lambdas import api

    built: list[int] = []
    monkeypatch.setattr(api, "build_deps", lambda: built.append(1) or "deps")
    monkeypatch.setattr(api, "_deps", None)
    monkeypatch.delenv("AWS_LAMBDA_FUNCTION_NAME", raising=False)
    api._init_at_load()
    assert api._deps is None and built == []  # tests and scripts: nothing touches AWS
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_NAME", "aic-prod-api")
    api._init_at_load()
    assert api._deps == "deps" and built == [1]  # in the snapshot

    def broken() -> Any:
        raise RuntimeError("missing variable")

    monkeypatch.setattr(api, "build_deps", broken)
    monkeypatch.setattr(api, "_deps", None)
    api._init_at_load()  # never breaks the init; the first request tries again
    assert api._deps is None
