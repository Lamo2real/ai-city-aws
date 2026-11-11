---
id: data.rag.retrieval-augmented-generation
department: data
domain: rag
title: 'Data and AI: Retrieval-augmented generation'
summary: 'RAG: the best-evidenced retrieval recipe (hybrid retrieval, contextual chunks, a reranker), choosing an embedding model, graph RAG and its token cost, Bedrock managed GraphRAG, hard access filters in retrieval, freshness and versioning, query rewriting, failure modes and evaluation metrics.'
type: playbook
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- aws
- bedrock
- opensearch
- neptune
objectives:
- ai-features
sources:
- https://www.anthropic.com/news/contextual-retrieval
- https://docs.opensearch.org/latest/vector-search/ai-search/hybrid-search/index/
- https://arxiv.org/abs/2502.13595
- https://arxiv.org/abs/2506.05690v3
- https://iclr.cc/virtual/2026/poster/10007992
- https://arxiv.org/html/2506.05690v2
- https://arxiv.org/abs/2404.16130
- https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-build-graphs.html
- https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns
- https://genai.owasp.org/llm-top-10/
- https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026
- https://arxiv.org/abs/2309.15217
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before designing, debugging or evaluating a retrieval or RAG system, choosing embeddings or chunking, or adding access filters to retrieval.

**Source section:** 11. Retrieval-augmented generation: hybrid retrieval, contextual chunks, a reranker, hard access filters

### The best-evidenced retrieval recipe

**[VENDOR] [FAST-MOVING, 19 September 2024]** Hybrid retrieval with chunk-level context and a reranker is still the best-evidenced recipe. On Anthropic's own tests of 19 September 2024, top-20 retrieval failure fell from 5.7% to 3.7% with contextual embeddings (35% lower), to 2.9% when contextual BM25 was added (49% lower), and to 1.9% when a reranker was added (67% lower). Passing the top 20 chunks beat passing 5 or 10; reranking took the top 150 down to 20; and one-off contextualising cost about $1.02 per million document tokens with prompt caching ([Anthropic, Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)). **[GAP]** No independent replication of these numbers was found.

**[INFERENCE]** Default RAG build for a SaaS company on AWS: OpenSearch (managed or Serverless) with one index holding BM25 text, a vector field and metadata; a hybrid query with rank fusion; a cross-encoder reranker; wide retrieval of about 100 to 150 candidates reranked to about 10 to 20; and document-level context added to each chunk before embedding. Start with structure-aware chunks of a few hundred tokens with small overlap and tune on the company's own eval set; no authoritative universal chunk size was found ([Anthropic, Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval); [OpenSearch, Hybrid search](https://docs.opensearch.org/latest/vector-search/ai-search/hybrid-search/index/)).

### Choosing an embedding model

**[FAST-MOVING, February to November 2025]** Model size does not decide embedding quality. MMTEB (peer-reviewed at ICLR; arXiv submitted 19 February 2025, revised 13 November 2025) extends MTEB to over 500 quality-controlled tasks across more than 250 languages, adding instruction following, long-document retrieval and code retrieval. It found that LLM-based embedders with billions of parameters lead on some language subsets and task types, but that the best-performing public model overall was multilingual-e5-large-instruct at 560 million parameters; it also introduces down-sampled benchmarks, including a zero-shot English benchmark, that preserve rankings at lower compute ([Enevoldsen et al., MMTEB, arXiv 2502.13595](https://arxiv.org/abs/2502.13595)).

**[INFERENCE]** Embedding selection procedure: shortlist from the MTEB leaderboard filtered to the company's languages (Swedish and English) and to retrieval tasks, then decide on the company's own labelled query set. Leaderboard rank is a prior and not a decision, because MMTEB shows rankings shift by language and task, and the paper's results date from early 2025, so newer models will have overtaken the named winner ([Enevoldsen et al., MMTEB, arXiv 2502.13595](https://arxiv.org/abs/2502.13595)). **[GAP]** The November 2026 MTEB standings and the Bedrock embedding models (Titan, Cohere, Nova) were not read.

### Graph RAG: helps multi-hop reasoning, costs many more tokens

**[CONTESTED] [FAST-MOVING, June 2025 to February 2026]** Whether graph RAG beats plain RAG depends on the task. The GraphRAG-Bench authors (arXiv June 2025, version 3 February 2026, accepted at ICLR 2026) note that earlier studies found GraphRAG often underperforming vanilla RAG on real tasks, and set out to test when graphs help ([Xiang et al., arXiv 2506.05690](https://arxiv.org/abs/2506.05690v3); [ICLR 2026 poster page](https://iclr.cc/virtual/2026/poster/10007992)).

**[FAST-MOVING, June 2025 to February 2026]** GraphRAG-Bench results with GPT-4o-mini, comparing vanilla RAG with reranking against the best graph method, are shown below ([arXiv 2506.05690v2](https://arxiv.org/html/2506.05690v2)).

| Task | Dataset | Vanilla RAG with rerank | Best graph method | Source |
|---|---|---|---|---|
| Fact retrieval | Novel | 60.92 | 60.14 | [arXiv 2506.05690v2](https://arxiv.org/html/2506.05690v2) |
| Fact retrieval | Medical | 64.73 | 66.28 | [arXiv 2506.05690v2](https://arxiv.org/html/2506.05690v2) |
| Complex reasoning | Novel | 42.93 | 53.38 | [arXiv 2506.05690v2](https://arxiv.org/html/2506.05690v2) |
| Complex reasoning | Medical | 58.64 | 61.98 | [arXiv 2506.05690v2](https://arxiv.org/html/2506.05690v2) |
| Contextual summarisation | Novel | 51.30 | 64.40 | [arXiv 2506.05690v2](https://arxiv.org/html/2506.05690v2) |
| Contextual summarisation | Medical | 65.75 | 67.88 | [arXiv 2506.05690v2](https://arxiv.org/html/2506.05690v2) |

**[FAST-MOVING, June 2025 to February 2026]** Some graph methods lose badly on fact lookup: in GraphRAG-Bench the Microsoft GraphRAG local method scored 38.63 against 64.73 for vanilla RAG on the medical set. Graph methods gave much higher faithfulness on creative generation, for example 78.76 against 36.74 on the medical set ([arXiv 2506.05690v2](https://arxiv.org/html/2506.05690v2)).

**[FAST-MOVING, June 2025 to February 2026]** Graph RAG costs far more prompt tokens per query in GraphRAG-Bench: about 880 to 950 for vanilla RAG, about 1,010 for HippoRAG2, about 4,200 for Fast-GraphRAG, about 39,000 for Microsoft GraphRAG local, about 100,000 for LightRAG and about 331,000 for Microsoft GraphRAG global. The paper's own text and tables disagree on some of these figures, so treat the magnitudes as approximate ([arXiv 2506.05690v2](https://arxiv.org/html/2506.05690v2)).

**[FAST-MOVING, June 2025 to February 2026]** The GraphRAG-Bench paper's guidance is basic RAG for simple fact lookup, graph methods for multi-hop reasoning and synthesis, quality graphs over large ones, and a cap on context growth ([arXiv 2506.05690v2](https://arxiv.org/html/2506.05690v2)). **[DURABLE]** Unverified background, not fetched: Microsoft's original GraphRAG paper targeted "global" sense-making questions over a whole corpus through community summaries, not point lookups ([Edge et al., arXiv 2404.16130](https://arxiv.org/abs/2404.16130)).

**[INFERENCE]** Use graph RAG only when the eval set contains a material share of multi-hop or corpus-wide questions and the graph can be kept clean; a cheaper middle path is entity and metadata links in the existing index. Neptune (Database or Analytics) fits when a curated knowledge graph already exists; LLM-extracted graphs need quality checks and a re-extraction budget.

### Bedrock managed GraphRAG on Neptune Analytics

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Amazon Bedrock Knowledge Bases offers managed GraphRAG on Neptune Analytics: vector search first, then graph traversal from retrieved chunks to related entities and chunks. Limits as documented in November 2026: S3 is the only data source; up to 1,000 files per data source, raisable to 10,000; no graph-build customisation; no autoscaling of the graph; and with hierarchical chunking only child chunks are returned ([AWS Bedrock GraphRAG docs](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-build-graphs.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Supported regions for Bedrock GraphRAG include Europe (Frankfurt), Europe (Ireland) and Europe (London); Europe (Stockholm) is not on the list as of November 2026. Deleting the knowledge base does not delete the Neptune Analytics graph, which keeps billing until it is removed ([AWS Bedrock GraphRAG docs](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-build-graphs.html)).

### Access control and security in retrieval

**[VENDOR] [FAST-MOVING, 12 February 2026]** Microsoft advises enforcing security trimming in every agent so that users see only the data they are authorised for ([Microsoft Azure Architecture Center, 12 Feb 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).

**[FAST-MOVING, 2025 list, current November 2026]** Retrieval stores are a named attack surface: "Vector and Embedding Weaknesses" is LLM08:2025 and "Sensitive Information Disclosure" is LLM02:2025 in the OWASP Top 10 for LLM applications ([OWASP GenAI LLM Top 10](https://genai.owasp.org/llm-top-10/)), and memory and context poisoning (ASI06 in the December 2025 agentic list) covers attackers corrupting RAG data or long-term memory to bias later decisions, per a secondary summary ([Giskard summary of OWASP Agentic Top 10](https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026)).

**[INFERENCE]** Enforce RAG access control at query time as a hard metadata filter (tenant ID, access-control group) inside the retrieval call, never by asking the model to withhold. Pre-filter instead of post-filtering so that top-k is not emptied and unauthorised text never enters the context; OpenSearch supports this with a top-level `filter` inside the `hybrid` query ([OpenSearch, Hybrid search](https://docs.opensearch.org/latest/vector-search/ai-search/hybrid-search/index/)). For a multi-tenant SaaS product, use an index per tenant or a mandatory tenant filter, plus automated tests that attempt cross-tenant queries.

### Freshness, versioning and query rewriting

**[INFERENCE]** For RAG freshness and versioning, store the source ID, version, effective date and content hash per chunk; re-index on change events; delete superseded chunks, which GDPR erasure also needs; filter by "current version" by default; and record the embedding model version and re-embed everything when it changes.

**[INFERENCE]** Query rewriting (multi-query, decomposition, hypothetical-document) helps conversational and under-specified queries but adds latency and can drift; gate it behind evals.

### RAG failure modes and evaluation metrics

**[INFERENCE]** Common RAG failure modes to test for: content missing from the corpus; the relevant chunk not retrieved; retrieved but ranked below the cut-off; retrieved but ignored or contradicted by the model; stale or duplicate versions; wrong-tenant leakage; tables or PDF layout lost in parsing; a question that needs aggregation retrieval cannot do (route it to SQL instead); and injected instructions inside documents.

**[DURABLE]** Usable metric sets for RAG exist in the literature. GraphRAG-Bench evaluates retrieval with evidence recall and context relevance, and generation with accuracy, coverage and faithfulness ([arXiv 2506.05690v2](https://arxiv.org/html/2506.05690v2)). Unverified background, not fetched: RAGAS defines reference-free metrics of faithfulness (the answer is supported by retrieved context), answer relevance and context relevance ([Es et al., arXiv 2309.15217](https://arxiv.org/abs/2309.15217)).

**[INFERENCE]** Evaluate RAG in two layers: retrieval (recall at k, precision at k, MRR or nDCG against labelled relevant chunks) and answer (faithfulness or groundedness, correctness against a reference, citation accuracy, and refusal when context is missing).

### Gaps in the RAG evidence

**[GAP]** Bedrock Knowledge Bases features for hybrid search, reranking, metadata filtering and chunking strategies were not confirmed. No verified numbers were found for late-interaction or multi-vector retrieval.
