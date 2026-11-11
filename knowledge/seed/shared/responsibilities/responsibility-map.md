---
id: shared.responsibilities.responsibility-map
department: shared
domain: responsibilities
title: 'Shared: Responsibility map'
summary: 'One accountable owner per item, because no twelve-department standard exists: the sourced boundary examples, the proposed responsibility map for the twelve departments and the proposed owners for the common grey zones (editable proposals).'
type: principle
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- ownership
sources:
- https://www.forgov.qld.gov.au/__data/assets/pdf_file/0027/319842/apqc_pcf_ver_6.1.1-final.pdf
- https://www.apqc.org/sites/default/files/files/PCF%20Collateral/Intro%20to%20PCF%20-%20FINAL.pdf
- https://handbook.gitlab.com/handbook/people-group/directly-responsible-individuals/
- https://www.bain.com/insights/rapid-decision-making/
- https://www.atlassian.com/team-playbook/plays/daci
- https://handbook.gitlab.com/handbook/customer-success/pre-sales-post-sales-transition/
- https://sre.google/sre-book/evolving-sre-engagement-model/
- https://teamtopologies.com/key-concepts
- https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/incident-management/
- https://handbook.gitlab.com/handbook/product-development/how-we-work/issue-triage/
- https://commoncog.com/the-amazon-weekly-business-review/
- https://www.nngroup.com/articles/research-ops-101/
- https://diginomica.com/what-agentic-ai-foundations-rule-changes-mean-building-mcp-a2a
- https://labs.openviewpartners.com/survey-of-1000-saas-executives-reveals-major-blind-spot-around-pricing/
related:
- shared.handoffs.handoff-catalogue
- shared.decision-rights.decision-rights
- shared.routing.routing-rule-and-message-template
seed_version: 1
---

**When to use this:** Before taking on, passing on or refusing work: who is the one accountable owner of a responsibility or a grey zone (pricing, website, onboarding, invoicing, data requests and the rest) across the twelve departments.

**Source section:** 1. Responsibility map: one accountable owner per item, because no twelve-department standard exists

## 1. Responsibility map: one accountable owner per item, because no twelve-department standard exists

### 1.1 What the sources do and do not provide on departmental responsibilities

[GAP] [DURABLE] No single primary source was found that lays out a twelve-department SaaS responsibility split. The closest neutral reference is the APQC Process Classification Framework, which organises work by process category and not by department. The cross-industry version 6.1.1 (July 2015) has **12 top-level categories**: develop vision and strategy; develop and manage products and services; market and sell; deliver; manage customer service; develop and manage human capital; manage information technology; manage financial resources; acquire, construct and manage assets; manage enterprise risk, compliance, remediation and resiliency; manage external relationships; and develop and manage business capabilities ([APQC PCF v6.1.1, July 2015](https://www.forgov.qld.gov.au/__data/assets/pdf_file/0027/319842/apqc_pcf_ver_6.1.1-final.pdf)). The framework has five levels, from category down through process group, process and activity to task ([APQC introduction to the PCF, 2018](https://www.apqc.org/sites/default/files/files/PCF%20Collateral/Intro%20to%20PCF%20-%20FINAL.pdf)). The current 7.x version was not fetched and may have a different category count.

[DURABLE] Published practice resolves ownership grey zones by naming one accountable individual per item, not by publishing a universal owner list. GitLab's Directly Responsible Individual owns a project or initiative with final decision power while still gathering input, each task has only one accountable person, and in a RACI chart the DRI is normally the "Accountable" ([GitLab handbook, DRI, read November 2026](https://handbook.gitlab.com/handbook/people-group/directly-responsible-individuals/)). Bain's RAPID asks for ideally one decider per decision ([Bain, RAPID, 13 October 2023](https://www.bain.com/insights/rapid-decision-making/)), and Atlassian's DACI requires exactly one Approver ([Atlassian DACI play, read November 2026](https://www.atlassian.com/team-playbook/plays/daci)). Use this rule for every row of the maps below: one owning department, one named decider.

### 1.2 Sourced boundary examples that anchor the proposed map

[PLATFORM CLAIM] [DURABLE] Pricing is treated as a cross-functional decision and not as one department's right. GitLab lists cross-functional pricing initiatives and Terms of Service changes as cases where some teams use DACI ([GitLab handbook, DRI, read November 2026](https://handbook.gitlab.com/handbook/people-group/directly-responsible-individuals/)). Use a decision framework with one approver for pricing and packaging; do not let Product, Sales or Finance change price alone.

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] The sales-to-post-sales boundary at GitLab sits at Closed Won. The Customer Success Manager is introduced during technical evaluation or the proposal stage and takes primary responsibility after Closed Won; the Account Executive and Solutions Architect are re-engaged only on defined triggers, namely expansion, a new proof of value, an enablement request, an ROI analysis or services that need a statement of work ([GitLab handbook, pre-sales to post-sales transition](https://handbook.gitlab.com/handbook/customer-success/pre-sales-post-sales-transition/)). For a company with no customer-success department, this argues for splitting the role by trigger between Support and Sales.

[DURABLE] The reliability boundary in Google's framework model gives platform infrastructure (load shedding, traffic management, monitoring) to site reliability engineering, and application bugs plus on-call for functional issues to development teams; SRE takes over a service only after it passes a Production Readiness Review ([Google SRE book, chapter 32](https://sre.google/sre-book/evolving-sre-engagement-model/)). Map this to IT infrastructure owning the platform and Application owning functional defects.

[DURABLE] Team Topologies describes four team types: stream-aligned teams that build and run what they ship along a flow of work, platform teams that provide an internal product to speed up stream-aligned teams, enabling teams that help others overcome obstacles, and complicated-subsystem teams that hold specialist expertise ([Team Topologies key concepts, read November 2026](https://teamtopologies.com/key-concepts)). The proposed map in 1.3 assigns each of the twelve departments one of these roles.

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] Security incident ownership at GitLab is split: a security on-call is engaged for incidents that are possibly security-related, and a separate Security Incident Response Team investigates when the on-call engineer cannot determine malice ([GitLab incident management](https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/incident-management/)). Bug severity is assigned by a triage DRI that depends on bug category (engineering manager for general bugs, product designers for UX bugs, application security for vulnerabilities), and priority is set by the product manager or engineering manager ([GitLab issue triage](https://handbook.gitlab.com/handbook/product-development/how-we-work/issue-triage/)).

[DURABLE] Metric ownership in Amazon's practice, as described by Commoncog (articles dated 2021 to 2024), gives every metric a named owner who must be able to explain how it is instrumented, while Finance administers the review meeting, sets weekly targets and can audit any metric ([Commoncog, Amazon WBR](https://commoncog.com/the-amazon-weekly-business-review/)). This supports splitting analytics between a definitions owner, a business owner per metric and Finance as auditor.

[DURABLE] Research governance and the research repository belong to a ResearchOps function in Nielsen Norman Group's model, which covers participants, governance (consent, GDPR, retention), knowledge management (a shared repository and templates), tools, competency and advocacy ([NN/g ResearchOps 101, read November 2026](https://www.nngroup.com/articles/research-ops-101/)).

[FAST-MOVING, 14 October 2026] AI and agent governance has no standard answer to adopt. Secondary reporting says the Agentic AI Foundation does not offer a standard stack or reference answers for agent identity, authentication, security or governance, so teams must make and document their own choices ([diginomica, 14 October 2026](https://diginomica.com/what-agentic-ai-foundations-rule-changes-mean-building-mcp-a2a)). The company must therefore write its own AI governance ownership, as proposed in 1.4.

### 1.3 Proposed responsibility map for the twelve departments (editable proposal)

[INFERENCE] The table below is the researchers' proposed baseline, built by mapping the twelve departments onto the APQC categories ([APQC PCF v6.1.1, July 2015](https://www.forgov.qld.gov.au/__data/assets/pdf_file/0027/319842/apqc_pcf_ver_6.1.1-final.pdf)) and the boundary examples in 1.2. It is not a published standard. The owner should edit it, then record each row as the department manager agent's standing scope.

| Department | Proposed ownership | Team Topologies role | APQC category | Basis |
|---|---|---|---|---|
| IT infrastructure | Cloud and platform, CI/CD platform, monitoring, identity and access, corporate IT, backup and disaster recovery, infrastructure cost | Platform | 7 | [INFERENCE]; platform boundary from [Google SRE ch. 32](https://sre.google/sre-book/evolving-sre-engagement-model/) |
| Application | Product code, tests, application on-call for functional defects, technical design, API documentation | Stream-aligned | 2 and 4 | [INFERENCE]; functional on-call from [Google SRE ch. 32](https://sre.google/sre-book/evolving-sre-engagement-model/) |
| Data and AI | Warehouse, pipelines, metric layer, business intelligence, ML and LLM features, model evaluation | Platform plus complicated-subsystem | Not assigned in the notes | [INFERENCE] |
| Product | Strategy, roadmap, discovery, specifications, prioritisation, packaging, launch-tier decision | Not assigned in the notes | 2 | [INFERENCE] |
| Research | Market, competitor, user and technology research; repository of findings | Enabling | Not assigned in the notes | [INFERENCE]; repository from [NN/g](https://www.nngroup.com/articles/research-ops-101/) |
| Marketing | Positioning, demand generation, website content, campaigns, lifecycle email, brand guardianship | Stream-aligned (customer-facing) | 3 | [INFERENCE] |
| Media | Production of video, audio, image and design assets to brief; asset library | Complicated-subsystem, run as a service | Not assigned in the notes | [INFERENCE] |
| Sales | Pipeline, qualification, demos, quotes, negotiation, closing, commercial terms of renewals and expansion | Stream-aligned (customer-facing) | 3 | [INFERENCE] |
| Customer Support | Tickets, onboarding help, knowledge base, bug intake, customer-facing incident communications | Stream-aligned (customer-facing) | 5 | [INFERENCE] |
| Finance | Budget, billing, collections, accounts payable, accounting close, tax and VAT, forecasting, deal-desk approvals | Not assigned in the notes | 8 | [INFERENCE] |
| Legal | Contracts, privacy and DPO liaison, marketing-claims review, intellectual property, corporate matters, regulatory positions | Enabling | 10 and 11 | [INFERENCE] |
| Operations (including people operations) | Hiring, onboarding and offboarding, vendor onboarding, planning cadence, internal process, facilities | Enabling | 6 and 12 | [INFERENCE] |

### 1.4 Proposed owners for the common grey zones (editable proposal)

[INFERENCE] The table below proposes a single owner for each common grey zone. Each row should be recorded as a DACI or RAPID line with exactly one approver or decider. No primary source was found for the recommended owners of brand, website, internal tools or documentation; those rows are inference only.

| Grey zone | Proposed owner and split | Other roles | Basis |
|---|---|---|---|
| Pricing and packaging | Product as Driver and Recommender | Finance and Sales as required Contributors (margin model, discount policy); Legal in "Agree" on terms; a human executive as Approver | [INFERENCE]; pricing as a DACI case from [GitLab DRI](https://handbook.gitlab.com/handbook/people-group/directly-responsible-individuals/) |
| Customer onboarding | Customer Support owns post-sale customer onboarding | Product owns in-app onboarding flows; Sales owns the handoff packet | [INFERENCE]; mirrors the Closed Won takeover in [GitLab transition](https://handbook.gitlab.com/handbook/customer-success/pre-sales-post-sales-transition/) |
| Customer success (no dedicated department) | Split by trigger: Support owns adoption and account health | Sales owns commercial expansion and the renewal quote; a RevOps-style coordination is needed but is unsourced | [INFERENCE]; trigger list from [GitLab transition](https://handbook.gitlab.com/handbook/customer-success/pre-sales-post-sales-transition/) |
| Analytics | Data and AI owns definitions, pipelines and the metric catalogue | Each metric has a business owner in the consuming department; Finance audits financial metrics | [INFERENCE]; owner-per-metric and Finance audit from [Commoncog WBR](https://commoncog.com/the-amazon-weekly-business-review/) |
| Security | IT infrastructure owns platform security controls and incident response for infrastructure | Application owns secure code and vulnerability fixes; Legal owns notification obligations; a named human owns risk acceptance | [INFERENCE]; split responder model in [GitLab incident management](https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/incident-management/) |
| Documentation | Split by document type | Application owns API and technical reference; Support owns the help centre and knowledge base; Product owns release notes; Marketing owns website copy | [INFERENCE]; no source |
| Brand | Marketing owns brand strategy and guidelines | Media owns execution and the asset library; Legal owns trademark | [INFERENCE]; no source |
| Website | Marketing owns content and conversion | Application or IT infrastructure owns hosting, performance and security (the owner must pick one); Media supplies assets | [INFERENCE]; no source |
| Internal tools | IT infrastructure owns bought SaaS and access | Application owns custom-built internal apps; Operations owns the tool register and vendor list | [INFERENCE]; no source |
| AI governance | Data and AI owns the model inventory, evaluation and the agent platform | Legal owns the regulatory position (EU AI Act, GDPR Article 22); IT infrastructure owns identity and permissions for agents; a human owner signs off policy | [INFERENCE]; absence of a standard from [diginomica, 14 Oct 2026](https://diginomica.com/what-agentic-ai-foundations-rule-changes-mean-building-mcp-a2a) |

[GAP] No survey data was retrieved on which function owns pricing in SaaS companies. The OpenView pricing survey of SaaS executives now redirects to the firm's homepage ([dead link](https://labs.openviewpartners.com/survey-of-1000-saas-executives-reveals-major-blind-spot-around-pricing/)), so no percentage-by-function figure is available. The original RACI definition was not fetched from a primary source either; only GitLab's mention of it was read.
