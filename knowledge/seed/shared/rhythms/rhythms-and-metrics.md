---
id: shared.rhythms.rhythms-and-metrics
department: shared
domain: rhythms
title: 'Shared: Rhythms and shared metrics'
summary: 'One weekly business review, one owner and one definition per metric: the weekly business review practice and the proposed rhythm, metric hierarchy and single source of truth.'
type: playbook
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives: []
sources:
- https://commoncog.com/the-amazon-weekly-business-review/
- https://commoncog.com/working-backwards/
- https://blog.hubspot.com/blog/tabid/6307/bid/31902/how-to-calculate-track-a-leads-goal-that-sales-supports.aspx
- https://www.nngroup.com/articles/research-ops-101/
- https://sre.google/sre-book/postmortem-culture/
related:
- shared.handoffs.handoff-catalogue
- shared.coordination.multi-agent-coordination
cross_refs:
  '2':
  - shared.handoffs.handoff-catalogue
  '6':
  - shared.coordination.multi-agent-coordination
seed_version: 1
---

**When to use this:** When reporting across departments or defining a metric: the weekly review, one owner and one definition per metric, and the single source of truth.

**Source section:** 5. Company-wide rhythms and shared metrics: one weekly review, one owner and one definition per metric

## 5. Company-wide rhythms and shared metrics: one weekly review, one owner and one definition per metric

### 5.1 The weekly business review is the best-documented rhythm

[DURABLE] Amazon's Weekly Business Review, as described by Commoncog, runs on a fixed cadence: the prior week's metrics are generated after Sunday midnight, owners review on Monday, departmental reviews happen on Tuesday, and the company-level review happens on Wednesday, capped at **60 minutes** ([Commoncog, Amazon WBR](https://commoncog.com/the-amazon-weekly-business-review/)).

[DURABLE] In the weekly business review, metrics are ordered causally, with controllable inputs first, then outputs, ending with financials; the article carries a correction that Amazon's own deck opens with financials. Output metrics are reported but effort goes to inputs, and one process's output can be another's input ([Commoncog, Amazon WBR](https://commoncog.com/the-amazon-weekly-business-review/)). Input versus output metrics and metric ownership with independent finance audit are core to Amazon's method per Bryar and Carr ([Commoncog, Working Backwards, 2021](https://commoncog.com/working-backwards/)).

[DURABLE] The meeting rules are that the review is exception-driven, no metric is skipped, owners say they do not know instead of inventing explanations, no strategy or problem-solving happens in the meeting (it is taken offline with follow-ups), and the deck is static in a fixed format. Amazon runs roughly **400 to 500 metrics** and the article's author runs 47 at his own company ([Commoncog, Amazon WBR](https://commoncog.com/the-amazon-weekly-business-review/)). For agents, the "say I do not know" rule matters most: a manager agent must not fabricate an explanation for a metric movement.

[DURABLE] Three further shared-record practices are sourced. Marketing-to-sales SLA progress is reported daily to both teams and executives against a cumulative goal ([HubSpot blog, read November 2026](https://blog.hubspot.com/blog/tabid/6307/bid/31902/how-to-calculate-track-a-leads-goal-that-sales-supports.aspx)). Research findings live in a shared repository to avoid repeated studies ([NN/g ResearchOps 101](https://www.nngroup.com/articles/research-ops-101/)). Postmortems are stored in a shared repository and reviewed in regular sessions ([Google SRE book, chapter 15](https://sre.google/sre-book/postmortem-culture/)).

### 5.2 Proposed rhythm, metric hierarchy and single source of truth (editable proposal)

[INFERENCE] The proposed company-wide rhythm is below. Only the weekly review format rests on a source; the rest is the researchers' proposal.

| Cadence | Event | Who runs it | Basis |
|---|---|---|---|
| Daily | Automated handoff-SLA and queue report per department | Each manager agent | [INFERENCE]; daily reporting precedent in [HubSpot blog](https://blog.hubspot.com/blog/tabid/6307/bid/31902/how-to-calculate-track-a-leads-goal-that-sales-supports.aspx) |
| Weekly | Cross-department metrics review in WBR format | Manager agents with a human chair | [INFERENCE]; format from [Commoncog WBR](https://commoncog.com/the-amazon-weekly-business-review/) |
| Weekly | Incident and postmortem review | Not specified in the notes | [INFERENCE]; regular review from [Google SRE ch. 15](https://sre.google/sre-book/postmortem-culture/) |
| Monthly | Business review and budget versus actual | Finance | [INFERENCE] |
| Quarterly | Planning: objectives, capacity, cross-department dependencies, launch calendar | Not specified in the notes | [INFERENCE] |
| Annual | Strategy and budget | Not specified in the notes | [INFERENCE] |

[INFERENCE] The proposed metrics hierarchy runs from company output metrics (ARR, net revenue retention, gross margin, cash) to department outputs to controllable inputs per department, such as MQL-to-accepted time, first-response time, deployment frequency, change-failure rate, days to close a data-subject request and handoff rejection rate. Each metric has one owning department and one definition record. No primary source on SaaS metric standards, including ARR and net revenue retention definitions, was fetched, so those definitions must be written locally.

[INFERENCE] The proposed single source of truth is a versioned metric catalogue maintained by Data and AI, holding for each metric the name, formula, source tables, owner, refresh schedule and caveats. Agents must cite the catalogue ID and not recompute a metric, and Finance audits financial metrics. A glossary of lifecycle terms (MQL, accepted, qualified, Closed Won, severity levels) sits beside it, because the handoffs in section 2 depend on shared status definitions.

[INFERENCE] Four handoff-quality metrics are worth adding for an agent organisation: rejection rate with reason code, rework loops per handoff, time in "awaiting input", and duplicate-work detections. They measure the specific failure modes named in section 6.

[GAP] No primary source was fetched on OKRs, annual operating plans, quarterly business reviews, semantic layers, metric stores or metric trees, and GitLab's KPI and data-team handbook pages were not read. The quarterly and annual rows of the rhythm and the catalogue proposal are inference.
