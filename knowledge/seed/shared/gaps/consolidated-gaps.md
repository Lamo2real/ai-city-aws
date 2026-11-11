---
id: shared.gaps.consolidated-gaps
department: shared
domain: gaps
title: 'Shared: Consolidated gaps and conclusion'
summary: Everything the research did not verify or could not find, by area (responsibilities, handoffs, decision rights, processes, rhythms, multi-agent coordination, human approval and law), and the conclusion.
type: checklist
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives: []
sources: []
related:
- shared.overview.about-this-knowledge-base
cross_refs:
  '4':
  - shared.processes.end-to-end-processes
  '9':
  - shared.compliance.sweden-and-eu
seed_version: 1
---

**When to use this:** Whenever the shared documents seem silent: check whether the point is a known gap, and say so instead of guessing; and the three decisions that fall to the owner.

**Source section:** 10. Consolidated gaps, and the Conclusion

## 10. Consolidated gaps

[GAP] Responsibilities and grey zones. No primary source lays out a twelve-department SaaS split. No survey data on who owns pricing was retrievable (the OpenView survey link is dead). APQC process groups beneath each category were unreadable and the current 7.x version was not fetched. No primary source supports the proposed owners of brand, website, internal tools or documentation. The original RACI definition was not fetched. Winning by Design, MIT Sloan and ITIL 4 primary texts were not retrieved.

[GAP] Handoffs and service levels. Lead response-time statistics from the 2011 HBR article were not readable. GitLab's MQL scoring threshold and MQL follow-up time were not found. No primary source was retrieved for creative briefs, research request intake, data requests, vendor onboarding, hiring requisitions or marketing-claims review. GitLab's finance authorisation matrix and quote approval matrix were inaccessible, so no monetary or discount thresholds exist in this document. No dedicated source on security review triggers was fetched. The "Team API" concept is not sourced.

[GAP] Decision rights and coordination. Revenue operations and the bowtie model are unsourced. The body of the 2015 HBR article on cross-functional teams was paywalled, so its 75% figure rests on the headline alone. ITIL 4 was read only through Atlassian. Amazon's OP1 and OP2 planning timing and the contents of a PR/FAQ were not on the pages read. No primary source on inter-team ticket intake design was retrieved beyond GitLab.

[GAP] End-to-end processes. No canonical step lists were retrieved for procure-to-pay, record-to-report or hire-to-retire; every step-by-department map in section 4 is a proposal. GDPR Article 33 was not fetched.

[GAP] Rhythms and metrics. No primary source was fetched on OKRs, annual operating plans, quarterly business reviews, SaaS metric standards (ARR, net revenue retention), semantic layers, metric stores or metric trees. GitLab's KPI and data-team pages were not read.

[GAP] Multi-agent coordination. No published guidance addresses manager-to-manager versus worker-to-worker routing. No empirical study was found of departmental AI-agent companies running real businesses. The A2A task-state names and the full 1.0 specification were not read. The claim that A2A now sits under the Agentic AI Foundation is secondary and unconfirmed. The OWASP Agentic Top 10 was read through a vendor summary only, so the "least agency" principle and per-risk mitigations are not sourced. The Google Research "capability saturation" threshold was not on the blog page and is not cited. AWS pages carried no date; AWS Bedrock multi-agent product documentation and Microsoft agent identity (Entra) documentation were not fetched. The OpenAI guide is undated.

[GAP] Human approval and law. No source gives a definitive always-human list. EU AI Act dates come from a third-party explainer and must be verified against the Official Journal; whether any of the company's agent uses are high-risk, including HR-related uses under Annex III, was not assessed. GDPR articles were read on an unofficial reproduction. All Sweden-specific law listed in section 9 is unresearched.

## Conclusion

[INFERENCE] The research changes the question the owner needs to answer. The starting question was which department owns what; the sources show that mature organisations do not settle that with a universal chart but with a mechanism: one decider per decision, a receiver who must explicitly accept, and a written service entry per team. The multi-agent evidence then raises the stakes on that mechanism, because the measured failures of agent systems (repetition, missed termination, unverified output, ignored input) are exactly the failures that implicit handoffs between departments produce. An agent company therefore needs its handoff contract to be machine-checked at intake, which a human company can leave to habit.

[INFERENCE] Three decisions fall to the owner before any of this can run, and no source can make them: the monetary and discount thresholds behind every spending and contract gate, the single owner where the proposal offers two (website hosting, between Application and IT infrastructure), and the Swedish legal checks that sit under hiring, signing, bookkeeping and marketing claims. The most useful early measurement is the handoff rejection rate by reason code, since it shows within weeks which rows of the responsibility map and catalogue are wrong, and whether twelve departments is too many boundaries for the volume of work crossing them.
