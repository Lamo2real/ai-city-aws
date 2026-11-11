---
id: data.handoffs.between-departments
department: data
domain: handoffs
title: 'Data and AI: Handoffs between departments'
summary: What the Data and AI department hands to and receives from every other department (IT infrastructure, Marketing, Application, Finance, Sales, Customer Support, Legal, Media, Operations, Product, Research), with the gate on each, and the three rules for every handoff.
type: playbook
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- aws
objectives: []
sources: []
cross_refs:
  '19':
  - data.guardrails.agent-guardrails
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before passing work to, or requesting work from, another department.

**Source section:** 20. Handoffs between the Data and AI department and other departments

**[INFERENCE]** This whole section is the researchers' inference; the research notes contain no sourced material on inter-department handoffs. It applies the ownership, contract and guardrail findings above. The Data and AI row describes handoffs between the manager agent and its own workers and between this department's data and ML functions.

| Department | Data and AI hands over | Data and AI receives | Gate or note |
|---|---|---|---|
| IT infrastructure | Capacity and region needs, IAM role and Lake Formation requirements, sandbox and egress allow-list specifications, cost forecasts | AWS accounts, networking, identity, base security controls, incident and change windows | Access grants and network changes need human approval |
| Marketing | Campaign and funnel marts, attribution and experiment read-outs, audience segments under a recorded purpose | Campaign plans, tracking requirements, channel cost data, event naming needs | Personal-data use needs a legal basis and purpose tag; no results from tests with an SRM |
| Application | Data contracts for product events, model and RAG endpoints, eval results, schema-change impact notices | Operational database change data, event streams, release notices, schema-change proposals | Breaking changes to contracted models need approval; land raw feeds in bronze first |
| Data and AI (internal) | Manager-to-worker briefs with objective, format, tools, boundaries and budget; platform-to-ML feature and training data snapshots | Condensed, sourced worker summaries; model cards and registry entries | Manager verifies before synthesis; promotion by audited alias change |
| Finance | Revenue, cost and unit-economics marts; forecasts with MASE against a naive baseline; spend reports per data product and per model | Budget envelopes, chart of accounts, invoicing data, commitment approvals | Board and audit numbers go through the semantic layer and human sign-off |
| Sales | Pipeline and win-rate marts, lead and account scoring, account-level usage signals | CRM data, stage definitions, questions to answer | Scores that drive decisions about people need Article 22 review |
| Customer Support | Ticket analytics, RAG knowledge indexes with tenant filters, assistant eval reports | Ticket data, knowledge articles, failure examples for the eval set | Customer-facing assistants need Article 50 disclosure; free text is hard to anonymise |
| Legal | AI use-case inventory, system cards, DPIA inputs, data-category map for Data Act export, supplier due-diligence files | Classification under the AI Act and GDPR, legal bases, contract terms, rulings on unverified points | Agents do not state legal conclusions; Legal decides |
| Media | Content performance marts; guidance on marking AI-generated content | Content metadata, asset catalogues, publication plans | Generated media needs Article 50 marking; Article 5 points (ba) and (bb) apply from 2 December 2026 |
| Operations | Operational KPIs, SLO dashboards, process forecasts, anomaly alerts | Process definitions, operational data sources, incident reports | Data incidents follow the severity process |
| Product | Product-analytics marts, experiment design and read-outs, metric trees, AI feature eval results and cost per feature | Roadmap, tracking-plan needs, feature specifications, success metrics | Experiments are pre-registered; AI features need a system card before launch |
| Research | Curated datasets with datasheets, benchmark and eval infrastructure, compute cost reports | Research questions, new methods and models to evaluate, findings to productionise | Training on personal data and web scraping need human approval and a legal basis |

**[INFERENCE]** Three rules govern every handoff in the table. Each dataset or model handed over has a named owner, a contract or card, and a stated freshness; each request received states the decision it supports; and anything touching personal data, production, money or the outside world follows the approval tiers in section 19.
