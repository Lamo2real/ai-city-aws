---
id: data.data-agents.semantic-layer-first
department: data
domain: data-agents
title: 'Data and AI: AI agents doing data work'
summary: 'AI agents doing data work: what the official text-to-SQL leaderboards show, why semantic-layer grounding beats free text-to-SQL on covered questions, and guardrail signals for data agents (free SQL labelled as unverified exploration).'
type: principle
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- aws
- bedrock
- dbt
- snowflake
- databricks
- bigquery
objectives:
- analytics
- ai-features
sources:
- https://spider2-sql.github.io/
- https://www.emergentmind.com/topics/spider-2-0
- https://bird-bench.github.io/
- https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026?version=2.0
- https://www.getcollate.io/blog/your-text-to-sql-problem-is-not-the-llm
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf
- https://aws.amazon.com/blogs/big-data/navigating-architectural-choices-for-a-lakehouse-using-amazon-sagemaker/
- https://docs.aws.amazon.com/athena/latest/ug/workgroups-setting-control-limits-cloudwatch.html
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before an agent answers a data question with SQL, or when building a text-to-SQL or analytics agent.

**Source section:** 13. AI agents doing data work: semantic layer first, free SQL as labelled exploration

### What the official text-to-SQL leaderboards show

**[FAST-MOVING, November 2026]** Official leaderboard scores for text-to-SQL, read by machine extraction in November 2026, are far higher than older reports suggest, but fall sharply as tasks become more realistic. The table gives the top entries; an earlier figure of about 53% for Spider 2.0-Lite came from an outdated vendor-hosted copy and is withdrawn.

| Benchmark | Top score and entry | Date of entry | Source |
|---|---|---|---|
| Spider 2.0-Snow | 96.70, Genloop Sentinel Agent v2 Pro | 1 March 2026 | [Spider 2.0](https://spider2-sql.github.io/) |
| Spider 2.0-Snow | 96.53, Native mini | 18 February 2026 | [Spider 2.0](https://spider2-sql.github.io/) |
| Spider 2.0-Snow | 94.15, QUVI-3 + Gemini 3 Pro preview | 9 February 2026 | [Spider 2.0](https://spider2-sql.github.io/) |
| Spider 2.0-Snow | 93.97, Tencent TCDataAgent-SQL | 3 February 2026 | [Spider 2.0](https://spider2-sql.github.io/) |
| Spider 2.0-Snow | 90.49, Paytm Prism Swarm + Claude Sonnet 4.5 | 27 January 2026 | [Spider 2.0](https://spider2-sql.github.io/) |
| Spider 2.0-Lite | 76.23, Tencent Tianqiong Data Agent + GLM 5.2 | 28 July 2026 | [Spider 2.0](https://spider2-sql.github.io/) |
| Spider 2.0-Lite | 74.95, DecisionX Agent | 28 July 2026 | [Spider 2.0](https://spider2-sql.github.io/) |
| Spider 2.0-Lite | 73.67, Kaelio ktx | 30 June 2026 | [Spider 2.0](https://spider2-sql.github.io/) |
| Spider 2.0-Lite | 73.13, Snowflake AI Research × UCSD DivSkill-SQL | 22 May 2026 | [Spider 2.0](https://spider2-sql.github.io/) |
| Spider 2.0-Lite | 72.02, Oracle SOMA-SQL | 11 April 2026 | [Spider 2.0](https://spider2-sql.github.io/) |
| Spider 2.0-DBT (68 repository-level tasks) | 65.6, SignalPilot Agent | 29 May 2026 | [Spider 2.0](https://spider2-sql.github.io/) |
| Spider 2.0-DBT | 60.29, Databao Agent (JetBrains); next entries 41.18 and 39.71 | 11 May 2026 | [Spider 2.0](https://spider2-sql.github.io/) |

**[FAST-MOVING, November 2026]** Spider 2.0 maintainer notices matter for interpretation: gold answers for all examples were released for self-evaluation on 24 December 2024; using the released gold SQL for fine-tuning is discouraged (7 January 2025); entries that use ground-truth tables are marked and excluded from ranking; and scores may shift slightly as evaluation is corrected ([Spider 2.0](https://spider2-sql.github.io/)). **[FAST-MOVING, 9 May 2026]** For scale, a secondary summary describes Spider 2.0 as 632 enterprise tasks over 213 databases, on which the original GPT-4o baselines scored 1.5% to 5.7% on Spider 2.0-Lite against 85 to 87% on Spider 1.0 ([Emergent Mind summary, 9 May 2026](https://www.emergentmind.com/topics/spider-2-0)).

**[FAST-MOVING, November 2026]** On the official BIRD leaderboard, human performance is 92.96% test execution accuracy and the top systems remain below it: AskData (AT&T) at 78.49 dev and 83.40 test (22 October 2026); GrainSQL (Purdue) at 77.77 and 82.95 (26 September 2026); DataGallery-Text2SQL (Huawei) at 78.10 and 82.39 (7 September 2026); SiriusAI-SQL (Tencent) at 77.77 and 82.28 (22 August 2026); and Agentar-Scale-SQL (Ant Group) at 74.90 and 81.67 (25 September 2025). The dataset has 12,751 question-SQL pairs over 95 databases, 33.4 GB and 37 domains ([BIRD-bench](https://bird-bench.github.io/)).

**[FAST-MOVING, 2025-era results read November 2026]** Harder variants on the BIRD site stay low: the best success rate on BIRD-Interact-Full (600 tasks) is 16.33%, and on LiveSQLBench-Base-Full-V1 (600 tasks) the best listed model reaches 28.67% on colloquial and 35.67% on normal queries; LiveSQLBench-Large has about 1,000 columns and 54 tables per database. The model names attached (o3-mini, Gemini 2.5 Pro, GPT-5) show these are 2025-era results ([BIRD-bench](https://bird-bench.github.io/)).

**[INFERENCE]** Reading the leaderboard gap: entries are engineered agent systems, often from vendors, on a public benchmark whose gold answers have been downloadable since December 2024, so over-fitting is possible. The 30-point drop from Spider 2.0-Snow to the dbt tasks and the low interactive scores suggest that multi-step, ambiguous, project-level work is still unreliable, and production accuracy on an unseen company schema should be expected to sit below leaderboard numbers. BIRD's top systems gained under 2 points in 13 months (81.67 to 83.40) and remain about 9.6 points under humans, which suggests a plateau on that benchmark ([Spider 2.0](https://spider2-sql.github.io/); [BIRD-bench](https://bird-bench.github.io/)).

### Semantic-layer grounding beats free text-to-SQL on covered questions

**[VENDOR] [FAST-MOVING, 7 April 2026]** dbt Labs' own benchmark of 7 April 2026 (ACME Insurance dataset, 15 tables, 11 questions run 20 times each) found, on the original schema, text-to-SQL rising from 32.7% (GPT-4, 2023) to 64.5% (Sonnet 4.6 and GPT-5.3 Codex) and the semantic layer from 60.5% to 72.7%, with 100% on in-scope questions and 0% on questions needing too many hops. After three models were added, Sonnet 4.6 scored 90.0% with text-to-SQL against 98.2% with the semantic layer, and GPT-5.3 Codex 84.1% against 100% ([dbt Developer Blog, 7 Apr 2026](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026?version=2.0)).

**[VENDOR] [FAST-MOVING, 7 April 2026]** The dbt Labs benchmark's own caveats: it was run by the semantic-layer vendor, uses 11 questions on one dataset, and gave text-to-SQL the whole schema, which is impractical at scale, so real text-to-SQL results may be worse ([dbt Developer Blog, 7 Apr 2026](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026?version=2.0)).

**[VENDOR] [FAST-MOVING, 30 April 2026]** A metadata vendor's self-run test of 30 April 2026 reports Sonnet 4.5 on a Spider 2.0-Snow subset at 10.8% without and 76.5% with semantic context, and an internal dataset moving from 78.5% to 93.8%. It names the failure causes as ambiguous business terms, schema complexity with opaque naming, and business logic that lives outside the data ([Collate blog, 30 Apr 2026](https://www.getcollate.io/blog/your-text-to-sql-problem-is-not-the-llm)).

**[VENDOR] [FAST-MOVING, 7 April 2026]** Routing rule for data questions from dbt Labs: use the semantic layer first; if the question is not covered, check whether a small modelling change closes the gap; only then fall back to text-to-SQL with maximum schema context ([dbt Developer Blog, 7 Apr 2026](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026?version=2.0)).

**[INFERENCE]** Set stakeholder expectations for data agents from the company's own measurements: build a golden set of 30 to 50 questions on the company's schema and rerun it on every model or schema change. The available evidence (64.5% unguided on a 15-table schema and 98 to 100% on semantic-layer-covered questions in a vendor-run test of 7 April 2026; 65.6% on dbt project tasks and 16.33% on interactive tasks on official boards) says covered metric questions can be trusted far more than free exploration ([dbt Developer Blog, 7 Apr 2026](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026?version=2.0); [Spider 2.0](https://spider2-sql.github.io/); [BIRD-bench](https://bird-bench.github.io/)). Investment in data modelling and documentation yields more accuracy than a larger model or higher reasoning effort, on vendor-run and therefore directional evidence.

### Guardrail signals for data agents

**[FAST-MOVING, November 2026]** The Thoughtworks Technology Radar Volume 35 of November 2026 places agent sandboxing (isolated, least-privilege execution) in Adopt as a default guardrail, toxic flow analysis (finding unsafe paths that combine private data, untrusted content and external communication) and stateful guardrails (checking whole sessions and tracking strikes) in Trial, and progressive context disclosure in Adopt ([Thoughtworks Radar Vol 35, Nov 2026](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf)).

**[PLATFORM CLAIM] [FAST-MOVING, 2026]** Enforcement points for data agents on AWS are Lake Formation row, column and cell permissions with credential vending per role ([AWS Big Data Blog, Jan 2026](https://aws.amazon.com/blogs/big-data/navigating-architectural-choices-for-a-lakehouse-using-amazon-sagemaker/)) and Athena per-query scan limits that cancel runaway queries ([Athena docs, data usage control limits](https://docs.aws.amazon.com/athena/latest/ug/workgroups-setting-control-limits-cloudwatch.html)).

**[INFERENCE]** Guardrail checklist for worker agents with data access: a dedicated IAM role per agent, read-only by default, with Lake Formation grants limited to gold and semantic objects and personal-data columns denied unless the task carries a recorded purpose; queries routed through a workgroup with a per-query scan cap and a daily budget alarm; writes only to a sandbox schema or through a pull request with CI and human or manager-agent approval before production; semantic-layer-first answering, with free SQL labelled as unverified exploration; every answer returning the query, the metric definition used and data freshness; no agent holding both private-data access and unrestricted outbound network in one context; and logging of all prompts, queries and results, noting that logs containing personal data fall under GDPR retention and erasure.

### Gaps in the data-agent evidence

**[GAP]** Vendor documentation for Snowflake Cortex Analyst, Databricks Genie, BigQuery conversational analytics, Amazon Q or Bedrock data agents and the dbt MCP server was not read, and no independent benchmark of commercial data agents was found. Whether Spider 2.0 submissions are independently re-run by the maintainers was not established.
