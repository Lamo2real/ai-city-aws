---
id: research.operations.research-operations
department: research
domain: operations
title: 'Research: Research operations'
summary: 'Research operations: a repository, four roles and sunset dates. The research repository; Governance, intake and impact.'
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- decision-quality
sources:
- https://www.nngroup.com/articles/research-repositories/
- https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-introduction
- https://goodjudgment.com/philip-tetlocks-10-commandments-of-superforecasting/
- https://best-practice-and-impact.github.io/aqua_book_revision/engagement_and_scoping.html
- https://best-practice-and-impact.github.io/aqua_book_revision/delivery_and_communication.html
- https://klue.com/topics/what-is-win-loss-analysis-how-to-build-a-program
related:
- research.design.research-design
- research.handoffs.handoffs-with-other-departments
seed_version: 1
---

**When to use this:** When storing, finding or retiring research: the repository, roles, governance, intake, impact and sunset dates.

**Source section:** 10. Research operations: a repository, four roles and sunset dates

## 10. Research operations: a repository, four roles and sunset dates

### 10.1 The research repository

[FAST-MOVING, 5 Jul 2024] Keep a central research repository to prevent scattered insights and duplicated work. Nielsen Norman Group (5 July 2024) lists its contents as reports with themes and recommendations; individual insights as standalone entries; research plans, screeners, recordings, clips, transcripts and raw notes; and optionally non-research inputs such as support emails, advisory-board notes or market research ([NN/g, Research Repositories 101](https://www.nngroup.com/articles/research-repositories/)).

[FAST-MOVING, 5 Jul 2024] Combine the two repository types. NN/g distinguishes document libraries, which are easy to maintain but hard to search for insights, from insight databases, which make atomic insights findable but lose context and cost more to maintain, and notes they can be combined by linking each insight to its full study ([NN/g, Research Repositories 101](https://www.nngroup.com/articles/research-repositories/)).

[FAST-MOVING, 5 Jul 2024] Required repository attributes per NN/g: easy to access and learn; flexible permissions with participant data protected; intuitive navigation or a small set of global tags; keyword search; and export, sharing and chat-tool integrations. For adoption, get buy-in, study current sharing habits first, start with a few broad tags and common item types, test labels and iterate, then onboard and keep advocating ([NN/g, Research Repositories 101](https://www.nngroup.com/articles/research-repositories/)).

[VENDOR] [FAST-MOVING, 5 Jul 2024] In an NN/g survey whose sample size and date were not captured, repository tools reported were general collaboration tools (Confluence, SharePoint) at 43%, dedicated research tools (Dovetail, EnjoyHQ, Condens, Great Question) at 32% and database tools (Notion, Airtable) at 14% ([NN/g, Research Repositories 101](https://www.nngroup.com/articles/research-repositories/)). Treat as indicative; NN/g is a consultancy describing practitioner habits.

[DURABLE] Store the extracted data snapshot and the query with each study, because Eurostat keeps only the latest version of each dataset ([Eurostat, API introduction](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-introduction)), and keep a forecast and judgment log whose hits and misses are both reviewed to separate skill from luck ([Good Judgment, 10 commandments](https://goodjudgment.com/philip-tetlocks-10-commandments-of-superforecasting/)).

[INFERENCE] Repository record schema for an AI research department, mapping the Aqua Book audit trail onto NN/g's combined model: study ID; requester and decision supported; question and hypotheses; method; dates; sources with access dates and reliability class; data snapshots and queries; findings, each with likelihood, confidence and evidence links; recommendations; limits of use; sunset or review date; assurer and approver; model and tool versions; and the outcome of the decision.

[INFERENCE] Knowledge-management rule: before starting any request, the manager agent searches the repository for prior work and unexpired findings, applying AAPOR's is-new-research-needed gate internally; expired findings may be reused only after re-verification.

### 10.2 Governance, intake and impact

[DURABLE] Register and assure projects. Under the Aqua Book the approver registers each new project, confirms that resources and an assurance plan exist and secures a suitably qualified assurer ([Aqua Book revision, Engagement and scoping](https://best-practice-and-impact.github.io/aqua_book_revision/engagement_and_scoping.html)); the organisation maintains a register of business-critical analyses and models with thresholds aligned to its risk framework and gives each analysis a review schedule or sunset date ([Aqua Book revision, Delivery, communication and sign-off](https://best-practice-and-impact.github.io/aqua_book_revision/delivery_and_communication.html)).

[VENDOR] [FAST-MOVING, 20 Jul 2026] Measure outcomes, not activity. Klue warns that research programmes fail when they count outputs such as interviews and reports and have no owner or route to turn findings into changes ([Klue, 20 Jul 2026](https://klue.com/topics/what-is-win-loss-analysis-how-to-build-a-program)).

[INFERENCE] [GAP] No sourced framework was found for research intake, prioritisation or impact measurement, and no cited definition of ResearchOps. As the researchers' proposal: score each request on the value of the decision at stake, how much the research could change the decision (if the answer would not change the action, do not do it), urgency, cost and feasibility, and reuse potential; then assign a proportionate tier such as a quick answer in hours, a standard study in days, or a business-critical study with independent assurance.

[INFERENCE] Proposed impact measures: for each delivered study, log the decision it was meant to inform, whether a decision was taken, whether it cited the study, and the time from request to delivery, and review quarterly. Add forecast accuracy from the forecast log, the reuse rate of repository items, stakeholder satisfaction, and errors caught at assurance against errors found after delivery.

[GAP] No source was retrieved on retention periods and GDPR handling for research recordings and transcripts in Sweden or the EU. Retention for each study must be set with Legal until this is filled.
