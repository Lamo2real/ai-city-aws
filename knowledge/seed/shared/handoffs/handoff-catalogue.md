---
id: shared.handoffs.handoff-catalogue
department: shared
domain: handoffs
title: 'Shared: Handoff catalogue'
summary: 'A named artefact, explicit statuses, a rejection reason and a time target: lead statuses (Marketing to Sales), the post-sale packet (Sales to Customer support), bug severity (Support to Application), definition of ready, production readiness and change approval, launch tiers, incidents, the deal desk (Sales to Finance), privacy triggers for Legal, the proposed catalogue and each department''s inputs and outputs.'
type: playbook
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- handoffs
sources:
- https://handbook.gitlab.com/handbook/marketing/marketing-operations/lead-lifecycle/
- https://blog.hubspot.com/blog/tabid/6307/bid/31902/how-to-calculate-track-a-leads-goal-that-sales-supports.aspx
- https://hbr.org/2011/03/the-short-life-of-online-sales-leads
- https://handbook.gitlab.com/handbook/customer-success/pre-sales-post-sales-transition/
- https://handbook.gitlab.com/handbook/product-development/how-we-work/issue-triage/
- https://www.atlassian.com/incident-management/kpis/severity-levels
- https://www.atlassian.com/agile/project-management/definition-of-ready
- https://commoncog.com/working-backwards/
- https://sre.google/sre-book/evolving-sre-engagement-model/
- https://dora.dev/capabilities/streamlining-change-approval/
- https://www.atlassian.com/itsm/change-management
- https://www.pragmaticinstitute.com/blog/post/prioritize-product-launch-resources-with-launch-tiers
- https://sre.google/sre-book/managing-incidents/
- https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/incident-management/
- https://sre.google/sre-book/postmortem-culture/
- https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/
- https://handbook.gitlab.com/handbook/finance/authorization-matrix/
- https://gdpr-info.eu/art-35-gdpr/
- https://gdpr-info.eu/art-22-gdpr/
- https://www.nngroup.com/articles/research-ops-101/
- https://commoncog.com/the-amazon-weekly-business-review/
related:
- shared.responsibilities.responsibility-map
- shared.processes.end-to-end-processes
- shared.routing.routing-rule-and-message-template
cross_refs:
  '4':
  - shared.processes.end-to-end-processes
seed_version: 1
---

**When to use this:** Whenever work passes between two departments: the named artefact, its statuses, the rejection reasons and the time target, and what each department hands over and receives.

**Source section:** 2. Handoff catalogue: a named artefact, explicit statuses, a rejection reason and a time target

## 2. Handoff catalogue: a named artefact, explicit statuses, a rejection reason and a time target

### 2.1 The pattern shared by every well-documented handoff

[DURABLE] [INFERENCE] The best-documented handoffs (lead lifecycle, pre-sales to post-sales, bug triage, production readiness, incident command, deal desk, GDPR requests) share four features: a named artefact, explicit status values, an accepting party that can reject with a reason code, and time targets. This generalisation is the researchers' synthesis across the sources cited in 2.2 to 2.12; no single source states it. Design every cross-department handoff to have all four.

[INFERENCE] For AI agents, acceptance should be an explicit state transition made by the receiving department (accept, reject with reason, or needs input), mirroring GitLab's lead statuses and A2A task states, and never an implicit assumption that a sent message was taken on. A request that has not been accepted is still owned by the sender.

### 2.2 Marketing to Sales: lead statuses and required rejection reasons

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] GitLab's lead lifecycle uses the statuses Raw, Inquiry, MQL, Accepted (a rep is actively trying to reach the lead), Qualifying (a two-way conversation exists) and Qualified (a sales-accepted opportunity is created and handed to Sales), plus Disqualified, Recycle and Ineligible, and each status has a named owner queue or role ([GitLab lead lifecycle](https://handbook.gitlab.com/handbook/marketing/marketing-operations/lead-lifecycle/)). Adopt a status list of this kind as the shared vocabulary between Marketing and Sales agents.

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] A rejected lead at GitLab must carry a reason code. Examples are Disqualified (competitor, no authority, bad data, unsubscribe), Recycle (no budget, no response, still evaluating, product limitation) and Ineligible (support request, student, employee or candidate) ([GitLab lead lifecycle](https://handbook.gitlab.com/handbook/marketing/marketing-operations/lead-lifecycle/)). Reason codes turn rejections into data that Marketing can act on.

[VENDOR] [DURABLE] HubSpot describes the marketing-to-sales service-level agreement as Marketing committing to a quantity and quality of leads per period, derived backwards from the customer target and the close rate. Its worked example is 20 customers at a 5% close rate requiring 400 leads, with quality weighted by lead type (a demo request weighted ten times a whitepaper download) and progress reported daily to both teams ([HubSpot blog, read November 2026](https://blog.hubspot.com/blog/tabid/6307/bid/31902/how-to-calculate-track-a-leads-goal-that-sales-supports.aspx)). The numbers are illustrative arithmetic, not benchmarks.

[GAP] GitLab's MQL scoring threshold and its follow-up time for an MQL were not in the portion of the page that was read. The lead response-time statistics in Harvard Business Review's 2011 article on online sales leads could not be read behind the paywall ([HBR, 2011](https://hbr.org/2011/03/the-short-life-of-online-sales-leads)); do not quote specific multiples from it.

### 2.3 Sales to Customer Support: the post-sale transition packet

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] GitLab's pre-sales to post-sales transition has four steps: the Solutions Architect requests a Customer Success Manager with account and opportunity links and the expected close date; an internal account-team meeting defines **6 to 12 month objectives**, each with an initiative, business outcome, success criteria and timeline, plus decision makers, stakeholders and open support tickets; a customer introduction call follows; and kickoff happens once the deal is Closed Won, after which most sales responsibilities move to the CSM ([GitLab pre-sales to post-sales](https://handbook.gitlab.com/handbook/customer-success/pre-sales-post-sales-transition/)).

[PLATFORM CLAIM] [DURABLE] The artefacts GitLab hands over are customer meeting notes, the command plan, the account plan, the customer strategy or value plan, the collaboration project and open support tickets, and the Solutions Architect must not commit the CSM to specific activities ([GitLab pre-sales to post-sales](https://handbook.gitlab.com/handbook/customer-success/pre-sales-post-sales-transition/)). The general rule for agents: a sending department must not promise a customer work on behalf of the receiving department.

### 2.4 Customer Support to Application: bug severity, acceptance and resolution targets

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] GitLab defines four bug severities: S1 blocker (a broken feature with no workaround, or any data loss), S2 critical (an unacceptably complex workaround), S3 major (a workaround exists) and S4 low (an inconvenience) ([GitLab issue triage](https://handbook.gitlab.com/handbook/product-development/how-we-work/issue-triage/)).

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] GitLab's resolution targets for bugs by severity are about **30 days for S1** (the current release plus the next deployment), about 60 days for S2, about 90 days for S3 and beyond 120 days for S4; by priority they are 30 days for P1, 60 to 90 days for P2, 90 to 120 days for P3 and no timeline for P4 ([GitLab issue triage](https://handbook.gitlab.com/handbook/product-development/how-we-work/issue-triage/)). These are one large company's targets, useful as example service levels and not as benchmarks.

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] For availability bugs on its SaaS, GitLab's targets are: S1 (20% or more of users affected with no workaround, or data loss) **mitigate in 8 hours and resolve in 48 hours**; S2 mitigate in 24 hours and resolve in 7 days; S3 mitigate in 72 hours and resolve in 30 days; S4 mitigate in 7 days and resolve in 60 days ([GitLab issue triage](https://handbook.gitlab.com/handbook/product-development/how-we-work/issue-triage/)).

[PLATFORM CLAIM] [DURABLE] GitLab's acceptance criteria for a bug report are reproduction steps and version information; without them the report is closed with a request for more information. A bug counts as fully triaged when it has a type, group, severity, priority, backlog label and milestone, and when unsure the reporter should overestimate severity and get expert confirmation ([GitLab issue triage](https://handbook.gitlab.com/handbook/product-development/how-we-work/issue-triage/)).

[VENDOR] [DURABLE] Atlassian's incident severity scheme pages on-call at any hour for SEV1 critical (service down for all customers, a privacy breach or data loss) and SEV2 major (down for some customers, or a core function significantly impaired), and handles SEV3 minor in working hours ([Atlassian severity levels, read November 2026](https://www.atlassian.com/incident-management/kpis/severity-levels)).

### 2.5 Product to Application: definition of ready and narrative documents

[VENDOR] [DURABLE] A Definition of Ready is a set of agreed criteria that a backlog item is clear, feasible and actionable before work starts. It commonly follows INVEST (independent, negotiable, valuable, estimable, small, testable), is created and owned by the team with stakeholder input, and is distinct from the Definition of Done, which says when work is complete ([Atlassian, definition of ready, read November 2026](https://www.atlassian.com/agile/project-management/definition-of-ready)). Use it as the acceptance criterion when Product hands work to Application.

[DURABLE] Amazon's working-backwards practice, as described by Bryar and Carr and summarised by Commoncog in 2021, uses narrative documents (the PR/FAQ and six-page memos read silently for roughly the first 20 minutes of a meeting) in place of slides, and proposals usually need several drafts and reviews ([Commoncog, Working Backwards, 2021](https://commoncog.com/working-backwards/)). The contents of a PR/FAQ were not on the page read.

### 2.6 Application to IT infrastructure: production readiness and risk-tiered change approval

[DURABLE] Google's Production Readiness Review checks six areas: architecture and inter-service dependencies; instrumentation, metrics and monitoring; emergency response; capacity planning; change management; and performance (availability, latency, efficiency) ([Google SRE book, chapter 32](https://sre.google/sre-book/evolving-sre-engagement-model/)). Use these areas as the acceptance checklist before IT infrastructure takes operational responsibility for a service.

[DURABLE] The review runs in phases: engagement (agreeing the service-level objective and agreement), analysis against a checklist and recent postmortems, improvements negotiated and implemented jointly, training, progressive onboarding with developers as backup, and continuous improvement; engaging early at design time is cheaper ([Google SRE book, chapter 32](https://sre.google/sre-book/evolving-sre-engagement-model/)).

[DURABLE] DORA's research finds that heavyweight external approval, by a change advisory board or senior manager, negatively affects delivery performance and shows no evidence of lowering change-failure rates. It recommends peer review recorded in the development platform, automated testing, and extra scrutiny only for flagged high-risk changes, and suggests measuring the share of changes needing no manual approval and the time spent waiting on approvals ([DORA, streamlining change approval, read November 2026](https://dora.dev/capabilities/streamlining-change-approval/)).

[VENDOR] [DURABLE] ITIL 4 change enablement, read only through Atlassian's description, distinguishes standard changes (low-risk, repeatable and pre-approved), normal changes (risk-assessed, with only high-risk ones going to a change advisory board and low-risk ones approved by a delegated change authority, peer review or automated checks) and emergency changes (expedited) ([Atlassian, change management, read November 2026](https://www.atlassian.com/itsm/change-management)).

[INFERENCE] DORA's finding argues for pre-approved "standard change" classes that agents may execute with peer review by another agent or a human, reserving human gates for high-risk changes and not gating every deployment.

### 2.7 Product to Marketing: launch tiers decide how many departments mobilise

[VENDOR] [DURABLE] Pragmatic Institute's launch tiers are Tier 1 (strategic, infrequent, the largest resources), Tier 2 (incremental improvement with some market attention) and Tier 3 (maintenance, general communications only). The tier is driven by expected market and business impact and not by development effort, so the same feature can be Tier 1 or Tier 3 depending on business purpose ([Pragmatic Institute, read November 2026](https://www.pragmaticinstitute.com/blog/post/prioritize-product-launch-resources-with-launch-tiers)). Product sets the tier; the tier determines whether Marketing, Media, Legal, Sales and Support are engaged.

### 2.8 Incident coordination across all departments: roles, declaration and communication targets

[DURABLE] Google's incident roles are the incident commander (holds the overall picture, assigns work and covers any role not delegated), the operations lead (whose group is the only one changing the system), the communications lead (periodic updates and keeping the incident document current) and the planning lead (bugs, handoffs and tracking changes for later revert) ([Google SRE book, chapter 14](https://sre.google/sre-book/managing-incidents/)).

[DURABLE] Google's guidance is to declare an incident if a second team is needed, the outage is customer-visible, or the problem is unsolved after an hour, and command changes hands only after a full briefing and explicit acknowledgement ([Google SRE book, chapter 14](https://sre.google/sre-book/managing-incidents/)). The explicit-acknowledgement rule is the human precedent for agent handoff acceptance.

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] GitLab staffs an Incident Lead, an Incident Responder and, for S1 and S2, a Communications Lead who usually comes from Support. Incidents lasting over 5 minutes should be communicated publicly as quickly as possible and **within 1 hour**, an incident still "investigating" after **30 minutes** is escalated to the incident manager on call, and all S1 and S2 incidents require a review with specific, time-bound corrective actions ([GitLab incident management](https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/incident-management/)).

[DURABLE] Google's postmortem triggers are user-visible downtime beyond a threshold, any data loss, on-call intervention such as a rollback, resolution time above a threshold, a monitoring failure, or any stakeholder request. Postmortems are blameless, the review checks cover data collected, impact assessed, depth of root cause, the action plan and sharing, and postmortems are stored in a shared repository without end-user identifying data ([Google SRE book, chapter 15](https://sre.google/sre-book/postmortem-culture/)).

### 2.9 Sales to Finance: the deal desk as a worked internal service

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] GitLab requires its deal desk for non-standard deal elements: payment schedules other than prepaid annual, price locks, deals contingent on a future release, terms under 12 months, non-standard payment terms (net 30 is standard), custom order-form language and custom statements of work. Legal language is obtained through a legal request case after commercial approval, and deal contingencies also need executive approval ([GitLab deal desk](https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/)).

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] GitLab's deal desk publishes internal service levels that apply when all information is supplied: basic quote help **6 hours to first response and 8 hours to resolution**; a ramp deal 6 hours and 24 hours; a private offer 24 hours and 48 hours. A case unresolved after 24 hours can be escalated, and the target is 92% quarterly satisfaction ([GitLab deal desk](https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/)). It also publishes business hours per region and an explicit out-of-scope list, which makes it the best worked example of an inter-department service catalogue entry in the notes.

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] GitLab's booking acceptance criteria include a signed order form, a **VAT ID for EU customers**, and for custom statements of work the customer's and revenue accounting's signatures plus a purchase order or a statement that none is needed. The deal desk reviews before booking and the invoice is issued **within 24 hours of Closed Won** ([GitLab deal desk](https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/)). The VAT ID check is GitLab's company practice; Swedish and EU VAT invoicing rules themselves are unverified and were not researched.

[GAP] GitLab's finance authorisation matrix is a linked document not exposed on the handbook page, so no monetary approval thresholds were obtained ([GitLab authorization matrix page](https://handbook.gitlab.com/handbook/finance/authorization-matrix/)). GitLab's quote approval matrix with discount thresholds was not obtained either. All monetary thresholds in this document must be set locally.

### 2.10 Any department to Legal: privacy triggers under GDPR Articles 35 and 22

[DURABLE] Legal status: article text read on gdpr-info.eu, not checked on EUR-Lex; orientation and not professional advice. GDPR Article 35 requires a data protection impact assessment before processing likely to result in high risk, in particular when new technologies are used. It is mandatory for systematic and extensive automated evaluation or profiling with legal or similar effects, large-scale processing of special-category data, and large-scale systematic monitoring of public areas, and the data protection officer's advice must be sought ([GDPR Article 35](https://gdpr-info.eu/art-35-gdpr/)). Treat any new personal-data processing or new technology as a trigger to send a DPIA screening request to Legal.

[DURABLE] Legal status: article text read on gdpr-info.eu, not checked on EUR-Lex; orientation and not professional advice. GDPR Article 22 gives individuals the right not to be subject to solely automated decisions with legal or similarly significant effects, and where exceptions apply the safeguards include the right to obtain human intervention ([GDPR Article 22](https://gdpr-info.eu/art-22-gdpr/)). For an agent-run company this is the legal root of the human gate on personnel decisions and on any decision with a significant effect on a person.

### 2.11 Research to all departments and Data and AI to all departments

[DURABLE] A shared research repository and standard templates prevent repeated studies, and research governance covers consent, privacy and the retention of recordings ([NN/g ResearchOps 101, read November 2026](https://www.nngroup.com/articles/research-ops-101/)). A research request should therefore be accepted only after the repository has been checked.

[DURABLE] In Amazon's weekly business review each metric has an owner who can answer how it is measured, Finance can audit, and the deck format is fixed from week to week ([Commoncog, Amazon WBR](https://commoncog.com/the-amazon-weekly-business-review/)). A data request that proposes a new metric should name the metric's owner before Data and AI accepts it.

### 2.12 Proposed handoff catalogue (editable proposal)

[INFERENCE] The table below is the proposed company-wide handoff catalogue. Rows marked "Sourced" rest on the cited practice in 2.2 to 2.11; rows marked "[INFERENCE]" are templates for which no primary source was retrieved. Every example service level marked "inference" or "local" is a placeholder the owner must set. In every row the receiving department may reject with a reason code.

| Handoff | Artefact that passes | Acceptance criteria | Example service level | Basis |
|---|---|---|---|---|
| Marketing to Sales | Lead record at MQL status with source, score, consent and activity history | Meets the agreed MQL definition; contact data valid; not on the ineligible list | GitLab's follow-up time was not found; set locally (inference: same business day) | Sourced: [GitLab lead lifecycle](https://handbook.gitlab.com/handbook/marketing/marketing-operations/lead-lifecycle/) |
| Sales to Customer Support | Handoff packet: objectives with success criteria and timeline, stakeholders, promised commitments, contract terms, technical environment, open tickets | Internal handoff meeting held; no undocumented promises; kickoff scheduled at Closed Won | Inference: packet before Closed Won, kickoff within 5 business days | Sourced: [GitLab transition](https://handbook.gitlab.com/handbook/customer-success/pre-sales-post-sales-transition/) |
| Customer Support to Application | Bug ticket: reproduction steps, version, impact (share of users, workaround), severity proposal, customer references | Reproduction steps and version present; severity confirmed by the engineering DRI | GitLab availability targets: S1 mitigate 8 h and resolve 48 h; S2 mitigate 24 h and resolve 7 days | Sourced: [GitLab issue triage](https://handbook.gitlab.com/handbook/product-development/how-we-work/issue-triage/) |
| Customer Support and Sales to Product | Feedback item: verbatim, customer, segment, revenue at stake, frequency, problem statement (not a solution) | Deduplicated against existing items; linked to the account | Inference: weekly triage; requester told accept, decline or merge | [INFERENCE]; no source |
| Product to Application | Specification or PR/FAQ plus backlog items | Definition of Ready (INVEST, acceptance tests, dependencies known) | Set by the team | Sourced: [Atlassian definition of ready](https://www.atlassian.com/agile/project-management/definition-of-ready) |
| Application to IT infrastructure | Production readiness checklist, runbook, service-level objectives, rollback plan | Review areas passed; monitoring and alerts live; on-call named | Standard changes pre-approved; only high-risk changes go to a human change authority | Sourced: [Google SRE ch. 32](https://sre.google/sre-book/evolving-sre-engagement-model/) and [DORA](https://dora.dev/capabilities/streamlining-change-approval/) |
| Product to Marketing | Launch brief with tier, audience, positioning, date and proof points | Tier agreed; claims substantiated; Legal reviewed if needed | Inference: several weeks' lead time for Tier 1; release notes only for Tier 3 | Sourced: [Pragmatic Institute](https://www.pragmaticinstitute.com/blog/post/prioritize-product-launch-resources-with-launch-tiers) |
| Marketing to Media | Creative brief: objective, audience, key message, deliverables and specifications, brand rules, deadline, approver | All fields complete; a single approver named; source assets supplied | Local | [INFERENCE]; no source |
| Any department to Research | Research request: decision to be informed, question, deadline, existing knowledge | Repository checked first; decision owner named | Local | [INFERENCE]; repository rule from [NN/g](https://www.nngroup.com/articles/research-ops-101/) |
| Any department to Data and AI | Data request or metric definition proposal | Metric owner named; definition does not duplicate a catalogue entry | Local | [INFERENCE]; owner rule from [Commoncog WBR](https://commoncog.com/the-amazon-weekly-business-review/) |
| Any department to Legal | Contract review request; claims review; privacy review (DPIA screening) | Triggers: non-standard terms, new personal-data processing or new technology, automated decisions about people, comparative or quantitative marketing claims | Local | Partly sourced: [GDPR Art. 35](https://gdpr-info.eu/art-35-gdpr/) and [Art. 22](https://gdpr-info.eu/art-22-gdpr/); claims-review trigger is inference |
| Any department to Finance | Budget request, purchase request, deal-desk case, invoice request | Within budget line; approver per authority matrix; VAT ID for EU customers | GitLab deal desk: 6 h to first response | Partly sourced: [GitLab deal desk](https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/) |
| Any department to Operations | Hiring requisition, vendor onboarding request, planning input | Budget confirmed by Finance; security and privacy review of the vendor done | Local | [INFERENCE]; no source |

[GAP] No retrievable primary source was found for creative brief contents (the Asana page failed to load), research request intake, the data request process, vendor onboarding, the hiring requisition or marketing-claims review. No dedicated source on security review triggers was fetched beyond GDPR Article 35 and the production readiness areas. The "Team API" idea from Team Topologies is not defined on the page that was read and is not sourced here.

### 2.13 What each department hands over and receives (company-wide view of the catalogue)

[INFERENCE] The table below restates the proposed handoff catalogue in 2.12 and the process flows in section 4 from each department's point of view, so that a department-level knowledge-base entry can be cut from one row. It adds no new handoffs and is inference throughout.

| Department | Mainly hands over | Mainly receives | Basis |
|---|---|---|---|
| IT infrastructure | Deployed and monitored services; accounts and access by least privilege; security review of vendors; data-location and erasure actions for GDPR requests | Production readiness packages from Application; access requests from Operations and all departments; incident detections | [INFERENCE] from 2.12 and section 4 |
| Marketing | MQL lead records to Sales; creative briefs to Media; claims-review requests to Legal | Launch briefs from Product; assets from Media; market input from Research; lead rejection reason codes from Sales | [INFERENCE] from 2.12 and section 4 |
| Application | Production readiness packages to IT infrastructure; fixes and severity confirmations to Support | Specifications from Product; bug tickets from Support; data-request actions from Legal | [INFERENCE] from 2.12 and section 4 |
| Data and AI | Metric definitions and catalogue entries; funnel, revenue, adoption, ticket and spend metrics; data location and export for GDPR requests | Data requests and metric proposals from all departments; AI screening requests from Product | [INFERENCE] from 2.12 and section 4 |
| Finance | Budget confirmations; deal-desk approvals; invoices; payment releases; service-credit decisions | Deal-desk cases from Sales; purchase and budget requests from all departments; source transactions and accrual inputs | [INFERENCE] from 2.12 and section 4 |
| Sales | Post-sale handoff packet to Support; deal-desk cases to Finance; contract requests to Legal; customer feedback to Product | MQL records from Marketing; enablement from Product and Marketing; renewal and expansion triggers from Support | [INFERENCE] from 2.12 and section 4 |
| Customer Support | Bug tickets to Application; feedback items to Product; GDPR request intake to Legal; incident communications | Handoff packets from Sales; fixes from Application; enablement and help-centre input from Product; approved response packages from Legal | [INFERENCE] from 2.12 and section 4 |
| Legal | Contract language; claims-review outcomes; DPIA screening outcomes; GDPR request classification and response review | Review requests from every department; possible personal-data or SLA-breach incidents | [INFERENCE] from 2.12 and section 4 |
| Media | Finished assets and the asset library | Creative briefs from Marketing | [INFERENCE] from 2.12 and section 4 |
| Operations (including people operations) | Hiring, onboarding and offboarding actions; vendor onboarding; tracking of postmortem actions; planning cadence | Hiring requisitions and vendor requests from all departments; budget confirmations from Finance | [INFERENCE] from 2.12 and section 4 |
| Product | Specifications to Application; launch briefs with tier to Marketing; accept, decline or merge decisions on feedback | Evidence from Research; feedback from Support and Sales; adoption metrics from Data and AI | [INFERENCE] from 2.12 and section 4 |
| Research | Findings in the shared repository; ICP and market input | Research requests naming the decision to be informed | [INFERENCE] from 2.12 and section 4 |
