---
id: data.gaps.consolidated-gaps
department: data
domain: gaps
title: 'Data and AI: Consolidated gaps'
summary: Everything the research did not verify or could not find, by area (data platform, modelling and governance, analytics, stores, ML and LLM, legal and regulatory, cost and operating model), followed by the research's conclusion.
type: checklist
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- aws
- bedrock
- opensearch
- neptune
- sagemaker
- dbt
- iceberg
- snowflake
- databricks
- bigquery
- mlflow
objectives: []
sources: []
related:
- data.overview.about-this-knowledge-base
seed_version: 1
---

**When to use this:** Whenever the knowledge base seems silent: check here whether the point is a known gap, and say so instead of guessing.

**Source section:** 21. Consolidated gaps, and the Conclusion

**[GAP]** Data platform gaps: no Iceberg tuning thresholds from AWS prescriptive guidance (file sizes, snapshot retention, copy-on-write versus merge-on-read); no primary Snowflake, BigQuery or Databricks reference architecture beyond the medallion page; Delta Lake UniForm status; S3 Tables and SageMaker lakehouse availability in eu-north-1; Kinesis retention and on-demand mode, MSK Express brokers and Firehose schema evolution; Dagster documentation and Airflow 3.x point releases; Debezium or DMS practice, schema registries and Iceberg schema-evolution rules; SQLMesh and dbt Fusion; and the full dbt Labs 2026 report behind its form.

**[GAP]** Modelling and governance gaps: Kimball detail pages; any primary Data Vault source; activity-schema modelling; dbt snapshots; Snowflake semantic views, Databricks metric views and the Open Semantic Interchange; the 11 DMBOK knowledge areas and DMBOK 3.0 status; LF-Tag limits and cross-account behaviour; retention scheduling, master data, stewardship roles, DataZone and SageMaker Catalog; OpenLineage run-state events; and any benchmark for data downtime or SLO targets.

**[GAP]** Analytics gaps: dashboard design principles; self-service BI governance; metric trees and KPI definition; tracking plans and event taxonomies; statistical pitfalls such as Simpson's paradox, survivorship bias and regression to the mean; Kohavi's own papers, Twyman's law and the delta method; time-series cross-validation and benchmark forecasting methods; and BI adoption benchmarks.

**[GAP]** Store gaps: Neptune backup and restore facts, supernode guidance and metric thresholds; OpenSearch RRF defaults, other normalisation techniques, pre-filter decision logic, vector-specific sizing on AWS and Serverless vector limits; S3 Vectors details from AWS; and quantitative comparisons of graph and vector retrieval beyond one benchmark.

**[GAP]** ML and LLM gaps: feature stores, SageMaker Model Registry and Feature Store; AWS's successor recommendation for Model Monitor; drift statistics and thresholds; MLflow tracking and MLflow 3 changes; tabular foundation models; Gemini prompt guidance and OpenAI caching terms; current model list prices; the November 2026 MTEB standings and Bedrock embedding models; Bedrock Knowledge Bases features; independent replication of contextual retrieval; independent evidence on fine-tuning versus RAG; MCP authorisation and governance; A2A specification detail and adoption; production agent reliability statistics; judge self-preference and position bias; evaluation tooling; and vendor prompt-injection robustness figures.

**[GAP]** Legal and regulatory gaps, all unverified: the Swedish designation of AI Act authorities and what applies from 1 January 2027 (the top open item); the Swedish Data Act enforcement authority and penalties; IMY's general guidance on generative AI and DIGG's guidance; final status of the EDPB pseudonymisation guidelines and of the anonymisation and web-scraping drafts after consultation closed on 30 October 2026; GDPR article text on EUR-Lex; SCC and Data Privacy Framework status; the Article 50 Guidelines and Code themselves; AI Act Articles 3(14a), 3(14b), 14, 26, 27 and 73; the harmonised standard published on 19 October 2026; Article 6 high-risk guidelines; ISO/IEC 42001 clause and annex content; NIST AI 600-1 content; and Data Act dates against the regulation's own text. Items stated from background knowledge and not fetched are Google's Rules of ML, Sculley et al., Grinsztajn et al., the MAST study, Cognition's essay, CaMeL and the design-patterns paper, RAGAS, the original GraphRAG paper, model cards and datasheets, GDPR Article 22 and SCHUFA, and Anthropic's and OpenAI's training-use terms.

**[GAP]** Cost and operating-model gaps: GPU prices outside AWS and on-demand prices; SageMaker inference pricing; throughput per GPU for open-weight models; independent API-versus-self-host studies; the FinOps principles and AI scope pages; warehouse cost-control documentation; role definitions; and any evidence base on the return on data work. No Hormozi house-style material exists for this domain, and no sourced material exists on inter-department handoffs.

## Conclusion

**[INFERENCE]** The research changes one common assumption: the bottleneck for a trustworthy data and AI function in 2026 is neither model capability nor tooling. Benchmarks near 97% sit beside 16% on interactive tasks, survey respondents rank ownership far above tools as their pain, and every vendor now advises the simplest design that works. What separates reliable from unreliable systems in the evidence is where meaning and control live. Meaning that lives in a modelled, contracted, tested layer makes even mid-tier models accurate; control that lives in roles, limits and approval gates survives attacks that defeat every published filter. An agent-run department should therefore spend its first effort on marts, a semantic layer, an evaluation set and the permission model, and treat model choice as the cheapest thing to change later.

**[INFERENCE]** Three implications follow for a Sweden-based SaaS company. The legal calendar is front-loaded on transparency and exit rights, not on high-risk AI: 2 December 2026 for marking older generative features and for the two new prohibitions, and 12 January 2027 for the end of switching charges, both arrive before any high-risk duty. The regional detail matters operationally, since Stockholm has GPU capacity but lacks some Bedrock features and has a 1 MiB/s default on direct streaming to Iceberg. And the largest unknown is domestic: who supervises the AI Act in Sweden from 1 January 2027 could not be verified, so the first task for the department's human owner is to confirm it on regeringen.se, pts.se and imy.se, and the second is to close the analytics-practice gaps before agents are asked to design dashboards, metric trees or tracking plans from this knowledge base.
