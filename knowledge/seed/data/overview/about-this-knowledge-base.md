---
id: data.overview.about-this-knowledge-base
department: data
domain: overview
title: 'Data and AI: About this knowledge base'
summary: 'The Data and AI knowledge base in one page: the research''s headline findings, what each claim label means ([DURABLE], [FAST-MOVING], [VENDOR], [PLATFORM CLAIM], [CONTESTED], [INFERENCE], [GAP]), the primary-source qualifiers and the seven whole-document caveats.'
type: glossary
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- aws
- dbt
- iceberg
- snowflake
- databricks
- bigquery
objectives: []
sources: []
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before relying on any Data and AI document: what the labels and the "checked on primary source" qualifiers mean, and the caveats that apply to everything.

**Source section:** Title, introduction and "How to read and split this document"

# Model first, gate agents, verify everything

As of 11 November 2026 the foundational knowledge for a Data and AI department run by a manager agent and worker agents reduces to one pattern that repeats in every domain: put the meaning into governed, tested structures (an Iceberg lakehouse with a single catalogue, dimensional marts, contracts, a semantic layer, a labelled evaluation set) and put the control outside the model (least-privilege roles, hard query and spend limits, sandboxing, human approval for irreversible steps). The evidence for this is consistent. On data, trust rose from 66% to 83% as a team priority in a 2026 vendor survey while unclear ownership stayed the most cited obstacle, and a vendor-run test found a semantic layer answering 98 to 100% of covered questions where free text-to-SQL reached 84 to 90%; official leaderboards now show 96.7% on Spider 2.0-Snow but only 65.6% on dbt project tasks and about 16% on interactive tasks, so realistic work stays unreliable. On LLM systems, hybrid retrieval with a reranker remains the best-evidenced recipe, graph retrieval helps multi-hop questions at 4 to several hundred times the prompt tokens, multi-agent designs gained about 81% on a parallelisable task and lost 39 to 70% on a sequential one, and adaptive attacks broke 12 published prompt-injection defences, most at above 90% success. On law, Regulation (EU) 2026/1744 moved high-risk AI Act duties to 2 December 2027 and 2 August 2028 but left Article 50 transparency in force since 2 August 2026, with a 2 December 2026 deadline for marking output from older systems and two new prohibitions from the same date; the GDPR part of the Digital Omnibus is not law. For a Sweden-based SaaS company selling in the EU, the Data Act already applies to it as a data processing service, with all switching charges ending on 12 January 2027, and the permanent Swedish AI Act authority set-up could not be verified. The research ran out of search and fetch budget in every pass, so several areas (dashboard design, metric trees, tracking plans, Data Vault, feature stores, drift statistics, Swedish authority designation) are stated as gaps and not filled from memory. This document is orientation, not legal, tax or other professional advice.

## How to read and split this document

This document is written to be cut into atomic knowledge-base entries for a vector index and a graph database. Every body paragraph is meant to stand alone: it opens with one or more labels, names its subject in full, and keeps each number next to its date and its source link. Section numbers group domains; sub-headings name the single topic of the paragraphs beneath them. Tables repeat the source link in every row so that a row can be split out as its own entry. When splitting, keep the label, the date and the link with the claim.

The labels mean the following. **[DURABLE]** marks a principle, definition, formula or long-standing method that has held for years and is unlikely to age quickly. **[FAST-MOVING, date]** marks a figure, product limit, price, survey result, benchmark score or legal status that will age, with the date of the source or of the reading. **[VENDOR]** marks a figure or recommendation from a party with a commercial interest in the conclusion (tool vendors, consultancies, vendor-run surveys and benchmarks); treat it as directional. **[PLATFORM CLAIM]** marks a platform's or tool maker's own description of its product, limits, prices or recommended practice, which nobody independently verified. **[CONTESTED]** marks a point where sources disagree. **[INFERENCE]** marks a synthesis, checklist, threshold or convention written by the researchers that no single fetched source states; adopt it as a default and tune it against your own data. **[GAP]** marks something the research did not verify or could not find. **[HOUSE STYLE]** is reserved for Alex or Leila Hormozi's published frameworks; the research notes behind this document contain no Hormozi material for the data and AI domain, so the label is not used below and no house-style default exists here.

Three qualifiers are added inside the text where they matter. For legal and regulatory points, "checked on primary source" means the statute, regulator or official EU page was read during the research; "checked on primary source by machine extraction" means the official page was read through a scraper's question-answering mode and the wording should be re-opened before it is quoted; "secondary source only" means a law firm, news or commercial page was read and the primary text was not; and "unverified background, not fetched" means the point comes from the researchers' background knowledge (cutoff mid-2026) with a link to where it should be confirmed. For technical points, "unverified background, not fetched" has the same meaning. Agents must not gate a live decision on an unverified point without confirmation.

Seven caveats apply to the whole document. First, legal, tax and regulatory content is orientation as of 11 November 2026 and is not professional advice; classification of any product under the AI Act or GDPR needs a qualified reviewer. Second, the research budgets for web search and page fetching ran out in all three passes, so coverage is uneven and the consolidated gaps in section 21 are real holes. Third, where the later gap-fill pass corrected an earlier note (the sample-ratio-mismatch threshold, the text-to-SQL leaderboard scores, the content of the AI Act amendment, the status of the EDPB pseudonymisation guidelines), only the corrected claim appears here. Fourth, most product facts are AWS-centred because the reference company runs on AWS; Snowflake, Databricks and BigQuery appear only through a secondary market overview and their own layering documents. Fifth, many surveys are vendor-run or self-selected and many benchmarks are vendor-run; the label says so each time. Sixth, prices, limits, benchmark scores and legal dates are snapshots and must be re-read at decision time. Seventh, thresholds and checklists labelled [INFERENCE] are starting points, not sourced standards.
