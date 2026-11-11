---
id: data.stores.graph-and-vector-stores
department: data
domain: stores
title: 'Data and AI: Graph and vector stores'
summary: 'Graph and vector stores: when a graph database is right, Neptune Database versus Neptune Analytics, Neptune operations, choosing a vector store on AWS, vector index choice and tuning, hybrid search and operations in OpenSearch, and graph and memory tools on the maturity radar.'
type: principle
audience: both
confidence: platform-claim
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- aws
- opensearch
- neptune
objectives:
- data-platform
- ai-features
sources:
- https://aws.amazon.com/blogs/database/improving-generative-ai-accuracy-with-vector-and-graph-search-hybrid-queries/
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf
- https://docs.aws.eu/neptune-analytics/latest/userguide/neptune-analytics-vs-neptune-database.html
- https://docs.aws.amazon.com/neptune/latest/userguide/best-practices-general-basic.html
- https://docs.aws.amazon.com/neptune/latest/userguide/best-practices.html
- https://hidekazu-konishi.com/entry/aws_vector_database_selection_and_index_internals.html
- https://docs.opensearch.org/latest/mappings/supported-field-types/knn-methods-engines/
- https://docs.opensearch.org/latest/vector-search/optimizing-storage/disk-based-vector-search/
- https://docs.opensearch.org/latest/vector-search/filter-search-knn/efficient-knn-filtering/
- https://docs.opensearch.org/latest/vector-search/ai-search/hybrid-search/index/
- https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp.html
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before choosing, sizing or tuning a graph database (Neptune) or a vector store (OpenSearch and others) for a product or client.

**Source section:** 8. Graph and vector stores: Neptune for connections, OpenSearch for hybrid retrieval

### When a graph database is the right store

**[PLATFORM CLAIM] [FAST-MOVING, 18 May 2026]** Consider a graph database when data has complex many-to-many connections and queries depend on connection patterns, such as recommendations and community detection, and not on fetching single records. Model entities and relationships as nodes and edges, and choose property graph (Gremlin, openCypher) or RDF (SPARQL) at set-up ([AWS Database Blog, 18 May 2026](https://aws.amazon.com/blogs/database/improving-generative-ai-accuracy-with-vector-and-graph-search-hybrid-queries/)).

**[INFERENCE]** Graph decision rule: if the answer needs more than about two joins of variable depth across relationships (paths, neighbourhoods, communities), prototype a graph; if a recursive SQL query over a few million edges answers it, stay relational. Start with the simplest store, keyword or hybrid search before GraphRAG, because the Thoughtworks Radar of April 2026 notes that graph-grounded codebase reasoning (in Trial) can underperform simple search ([Thoughtworks Radar Vol 34, Apr 2026](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)).

### Neptune Database versus Neptune Analytics

**[PLATFORM CLAIM] [FAST-MOVING, 2026]** Amazon Neptune Database is a serverless transactional graph database for workloads scaling to 100,000 queries per second with Multi-AZ and multi-Region options, typically used for social networking, fraud alerting and Customer 360. Neptune Analytics is an in-memory engine that analyses graphs with tens of billions of relationships at thousands of analytic queries per second, typically used for recommendation, fraud investigation, network threat detection and analysing graph data from a data lake ([AWS docs, Neptune Analytics vs Neptune Database](https://docs.aws.eu/neptune-analytics/latest/userguide/neptune-analytics-vs-neptune-database.html)).

**[PLATFORM CLAIM] [FAST-MOVING, 18 May 2026]** Neptune Analytics stores vectors with the graph and combines traversal and similarity search in one openCypher query, while Neptune Database pairs with an external vector store such as OpenSearch Service or RDS PostgreSQL with pgvector ([AWS Database Blog, 18 May 2026](https://aws.amazon.com/blogs/database/improving-generative-ai-accuracy-with-vector-and-graph-search-hybrid-queries/)).

**[PLATFORM CLAIM] [FAST-MOVING, 18 May 2026]** AWS describes three hybrid graph and vector patterns: vector-first then graph, to find complementary items a top-K search misses; graph-first then vector, to rank connected candidates by similarity; and GraphRAG, to retrieve context that is connected but semantically dissimilar. The article gives no accuracy numbers ([AWS Database Blog, 18 May 2026](https://aws.amazon.com/blogs/database/improving-generative-ai-accuracy-with-vector-and-graph-search-hybrid-queries/)).

### Neptune operations

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Keep all instances in a Neptune cluster the same class; read replicas must be at least as large as the writer, otherwise replication lag causes repeated replica restarts. Watch `ClusterReplicaLag` and `VolumeWriteIOPs`. Low memory use with high CPU is normal because Neptune has its own memory manager; out-of-memory query errors are the sign that more memory is needed ([Neptune basic operational guidelines](https://docs.aws.amazon.com/neptune/latest/userguide/best-practices-general-basic.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** A deliberate Neptune failover causes about 3 to 5 seconds of downtime; test failover and reconnect logic, noting that the Gremlin Java client may need a new Client object. Before a major engine upgrade, clone the cluster and test the application on the clone. Enable automatic backups and choose the window, and run clients in the same region and VPC ([Neptune basic operational guidelines](https://docs.aws.amazon.com/neptune/latest/userguide/best-practices-general-basic.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** For Neptune bulk loads, load with a temporary larger writer (AWS's example is r5.12xlarge) and `"parallelism": "OVERSUBSCRIBE"`, then scale all instances down to one class; if replicas restart during the load, remove them and recreate them afterwards; and retry on "Data prefetch task interrupted" using `mode: AUTO` ([Neptune basic operational guidelines](https://docs.aws.amazon.com/neptune/latest/userguide/best-practices-general-basic.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Neptune data-model and query practice: more than about 1,000 distinct predicates (property and edge labels) hurts performance and cost, and the OSGP index should be enabled in that case; long-running transactions accumulate versions, raise read latency and over hours can throttle writes; and the reader endpoint balances by DNS, so long-lived WebSocket clients must reconnect to rebalance ([Neptune basic operational guidelines](https://docs.aws.amazon.com/neptune/latest/userguide/best-practices-general-basic.html)). **[INFERENCE]** The predicate warning argues for a small, stable vocabulary of edge labels and property keys: do not encode tenant IDs or dates into label or property names.

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Neptune query guidance seen as headings only on AWS's best-practices index: for openCypher, prefer directed edges, specify edge labels, parameterise queries, batch with `UNWIND`, use custom IDs, filter early, put the most restrictive node on the left of variable-length paths, set explicit read or write transaction modes, and add retry logic; for Gremlin, structure upserts for the DFE engine, send bytecode and not strings, batch writes, reuse the client across threads, and use separate clients for reader and writer endpoints ([Neptune best practices index](https://docs.aws.amazon.com/neptune/latest/userguide/best-practices.html)).

**[GAP]** Neptune backup facts (retention range, point-in-time restore, snapshot cost) were not retrieved, so the commonly stated 1 to 35 day retention is unverified (https://docs.aws.amazon.com/neptune/latest/userguide/backup-restore-overview.html). No supernode guidance was found on the pages read, and Neptune sub-pages on openCypher, Gremlin and metric thresholds were seen as headings only.

### Choosing a vector store on AWS

**[FAST-MOVING, July to September 2026]** An independent practitioner article from July to September 2026 gives this selection among AWS vector stores; treat it as opinion, with S3 Vectors limits not confirmed from AWS.

| Store | When to use it | Source |
|---|---|---|
| OpenSearch | Hybrid lexical plus semantic search, metadata pre-filtering, widest algorithm and quantisation control; Serverless supports Faiss HNSW only, and managed domains are needed for IVF, PQ and node tuning | [Hidekazu Konishi, 2026](https://hidekazu-konishi.com/entry/aws_vector_database_selection_and_index_internals.html) |
| Aurora pgvector | Postgres is already the system of record; practical ceiling is millions, not billions, of vectors | [Hidekazu Konishi, 2026](https://hidekazu-konishi.com/entry/aws_vector_database_selection_and_index_internals.html) |
| MemoryDB | Lowest latency (single-digit millisecond p99), for example semantic caching | [Hidekazu Konishi, 2026](https://hidekazu-konishi.com/entry/aws_vector_database_selection_and_index_internals.html) |
| S3 Vectors | Very large, infrequently queried corpora where about 100 ms latency is acceptable; up to 2 billion vectors per index | [Hidekazu Konishi, 2026](https://hidekazu-konishi.com/entry/aws_vector_database_selection_and_index_internals.html) |
| Neptune Analytics | Retrieval must traverse relationships | [Hidekazu Konishi, 2026](https://hidekazu-konishi.com/entry/aws_vector_database_selection_and_index_internals.html) |

**[FAST-MOVING, July to September 2026]** Hybrid BM25 plus k-NN search helps with exact-term matches such as product codes and error identifiers, according to the same practitioner article ([Hidekazu Konishi, 2026](https://hidekazu-konishi.com/entry/aws_vector_database_selection_and_index_internals.html)).

**[FAST-MOVING, July to September 2026]** Embedding size can often be reduced: Titan Text Embeddings V2 at 512 or 256 dimensions reportedly keeps about 99% and 97% of retrieval accuracy against 1,024 dimensions, per a practitioner article from July to September 2026 ([Hidekazu Konishi, 2026](https://hidekazu-konishi.com/entry/aws_vector_database_selection_and_index_internals.html)). This is a secondary report, not an AWS statement read by the researchers.

### Vector index choice and tuning

**[FAST-MOVING, July to September 2026]** Index choice per the practitioner article: use exact (flat) search for tens of thousands of vectors and as the recall baseline; use HNSW for low-latency approximate search, with `m` of about 16 as a start, `ef_construction` for build quality and `ef_search` as the recall and latency dial (pgvector's default `ef_search` of 40 is often too low); and use IVF or IVF-PQ for very large memory-constrained corpora. HNSW's main cost is memory, which quantisation (FP16, byte, product, binary) or disk-based search with full-precision re-ranking reduces ([Hidekazu Konishi, 2026](https://hidekazu-konishi.com/entry/aws_vector_database_selection_and_index_internals.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** OpenSearch vector engines, per the project's documentation read by machine extraction in November 2026: Faiss (HNSW and IVF methods), Lucene (HNSW and flat) and JVector (DiskANN, needs a plugin); NMSLIB is deprecated; and the maximum dimension is 16,000 for Faiss, Lucene and JVector ([OpenSearch, Methods and engines](https://docs.opensearch.org/latest/mappings/supported-field-types/knn-methods-engines/)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** OpenSearch HNSW defaults are `m` of 16 (keep it between 2 and 100), `ef_construction` of 100 (512 for indexes created in version 2.11 or earlier) and Faiss `ef_search` of 100 (256 for binary indexes). Lucene ignores `ef_search` and uses the request's `k` ([OpenSearch, Methods and engines](https://docs.opensearch.org/latest/mappings/supported-field-types/knn-methods-engines/)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** OpenSearch memory estimates: HNSW needs about 1.1 × (4 × dimension + 8 × m) bytes per vector, so 1 million 256-dimension vectors at m of 16 need about 1.27 GB; IVF needs about 1.1 × ((4 × dimension × vectors) + (4 × nlist × dimension)) bytes, so the same data at nlist of 128 needs about 1.13 GB ([OpenSearch, Methods and engines](https://docs.opensearch.org/latest/mappings/supported-field-types/knn-methods-engines/)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** OpenSearch's guidance on choosing a method and engine: HNSW when memory is not the constraint; IVF for less memory and faster indexing at similar quality; product quantisation when memory is tight and lower recall is acceptable; `fp_16` encoding to halve memory with minimal quality loss; and byte vectors to cut memory by four when values fit the byte range. Use Faiss for large scale, Lucene for smaller deployments and "smart filtering", and JVector for high-update or memory-constrained large deployments ([OpenSearch, Methods and engines](https://docs.opensearch.org/latest/mappings/supported-field-types/knn-methods-engines/)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** OpenSearch disk-based vector search (`mode: on_disk`, introduced in version 2.17) uses a default compression of 32x (16x and 4x are also referenced, and Lucene is used at 4x). Search is two-phase: the compressed index first, then rescoring with full-precision vectors from disk, with a default oversample factor of 2.0. It trades slightly higher latency for large memory savings ([OpenSearch, Disk-based vector search](https://docs.opensearch.org/latest/vector-search/optimizing-storage/disk-based-vector-search/)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Efficient k-NN filtering is available in OpenSearch with the Lucene, Faiss and JVector engines; only the page's meta description was read ([OpenSearch, Efficient k-NN filtering](https://docs.opensearch.org/latest/vector-search/filter-search-knn/efficient-knn-filtering/)).

**[INFERENCE]** Vector sizing example, the researchers' arithmetic from the OpenSearch formula: 10 million 1,024-dimension vectors at m of 16 need about 1.1 × (4,096 + 128) × 10^7, or roughly 46 GB of native memory for one copy and about 93 GB with one replica; at 512 dimensions it is about 24 GB per copy. This memory sits outside the JVM heap, so it competes with the shard-per-heap guidance, and data nodes must be sized for both ([OpenSearch, Methods and engines](https://docs.opensearch.org/latest/mappings/supported-field-types/knn-methods-engines/)).

**[INFERENCE]** Default starting configuration for a RAG index on Amazon OpenSearch Service: Faiss HNSW with m of 16, ef_construction of 100 and ef_search of 100; measure recall against exact search before tuning; raise ef_search first; and move to `on_disk` at 32x when memory cost dominates and a few extra milliseconds are acceptable. Record the embedding model and version with every vector so that re-embedding is a planned migration ([OpenSearch, Methods and engines](https://docs.opensearch.org/latest/mappings/supported-field-types/knn-methods-engines/); [OpenSearch, Disk-based vector search](https://docs.opensearch.org/latest/vector-search/optimizing-storage/disk-based-vector-search/)).

### Hybrid search in OpenSearch

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** OpenSearch hybrid search, introduced in version 2.11, needs a search pipeline passed through `search_pipeline` that normalises and combines sub-query scores. The documented example uses `min_max` normalisation with `arithmetic_mean` combination and per-clause `weights`. A score-ranker processor offers reciprocal rank fusion, which combines by rank position and ignores raw scores. A top-level `filter` inside the `hybrid` query pre-filters, while `post_filter` filters after scoring ([OpenSearch, Hybrid search](https://docs.opensearch.org/latest/vector-search/ai-search/hybrid-search/index/)). **[GAP]** The default RRF `rank_constant`, the version that introduced the score-ranker processor, other normalisation techniques and the exact pre-filter versus exact-search decision logic were not readable.

### Amazon OpenSearch Service operations

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Amazon OpenSearch Service shard guidance: 10 to 30 GiB per shard for search workloads, 30 to 50 GiB for logs, 50 GiB maximum; at most 25 shards per GiB of JVM heap (800 on a 32 GiB heap); a per-node limit of 1,000 shards up to OpenSearch 2.15 and 4,000 from 2.17; start at about 1.5 vCPU per shard; make the primary shard count a multiple of the data-node count; and always keep at least one replica ([OpenSearch Service best practices](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp.html)). **[INFERENCE]** This shard guidance is written for text search; for vector indexes, memory per shard and not disk size is usually the binding limit, and AWS's page gives no vector-specific shard rule.

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Amazon OpenSearch Service availability guidance: three dedicated master nodes; Multi-AZ with Standby (three Availability Zones, two active and one standby, two replicas per index) as the recommended deployment; and for more than 99.9% availability a second domain with cross-cluster replication or dual writes ([OpenSearch Service best practices](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Amazon OpenSearch Service ingestion guidance: bulk requests of 3 to 5 MiB, starting at 3; a `refresh_interval` of 30 seconds or more; gzip compression; `"dynamic": "strict"` mappings for search indexes; and index templates with Index State Management for lifecycle ([OpenSearch Service best practices](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Amazon OpenSearch Service security and upkeep guidance: enable fine-grained access control, deploy in a VPC, encrypt at rest and node to node, and avoid open `Principal: *` policies; apply service software updates when they are `ELIGIBLE` (otherwise they are applied automatically after about two weeks); test upgrades on a separate domain; keep Auto-Tune on; and enable slow logs with thresholds ([OpenSearch Service best practices](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp.html)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Amazon OpenSearch Service cost guidance: gp3 volumes cost 9.6% less than gp2; avoid T2 and t3.small instances in production; `r6g.large` suits small production; UltraWarm pays off from about 2.5 TiB; and wait for at least 14 days of stable running before buying Reserved Instances, which give about a 30% to 50% discount ([OpenSearch Service best practices](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp.html)).

### Graph and memory tools on the maturity radar

**[FAST-MOVING, April and November 2026]** Thoughtworks' Radar Volume 34 of April 2026 places Graphiti (a temporal knowledge graph for agent memory) in Trial and FalkorDB and "context graph" in Assess; Radar Volume 35 of November 2026 places progressive context disclosure (on-demand retrieval through vector RAG or GraphRAG) in Adopt ([Thoughtworks Radar Vol 34, Apr 2026](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf); [Thoughtworks Radar Vol 35, Nov 2026](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf)).

### Gaps in the store evidence

**[GAP]** AWS's OpenSearch page gives no numbers for disk headroom, JVM pressure alarms or vector sizing; the vector-specific AWS page and OpenSearch Serverless vector limits were not read. The S3 Vectors general-availability date, limits and pricing were not confirmed from AWS.
