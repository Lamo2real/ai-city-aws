# Twelve agent departments run on explicit handoffs

As of 11 November 2026 the research supports one design for a Sweden-based SaaS company whose twelve departments are each run by a manager AI agent directing worker agents: give every responsibility and every grey zone exactly one accountable owner, make every cross-department handoff a named artefact that the receiving department explicitly accepts or rejects with a reason code, route new cross-department work through the manager agents, and attach human approval to a short list of tools (pay, sign, publish, deploy high-risk changes, grant access) instead of to every output. No published source lays out a twelve-department split, a canonical owner for pricing, onboarding or AI governance, or a definitive list of actions that always need a human; the responsibility map, handoff catalogue, message template and approval list in this document are therefore a proposal for the owner to edit, labelled [INFERENCE] wherever the notes do not source them. What is sourced is the pattern underneath: GitLab's lead statuses and deal-desk service levels, Google's production readiness review and incident roles, Bain's RAPID and Atlassian's DACI with one decider each, Amazon's weekly business review with one owner per metric, and the GDPR one-month clock for data-subject requests. The agent-coordination evidence points the same way: Google Research measured error amplification of 17.2x for independent agents against 4.4x under centralised coordination, the Berkeley MAST study attributes most multi-agent failures to system design, misalignment and weak verification, and Anthropic, OpenAI, Microsoft and Google Cloud all advise the simplest workable design with explicit briefs, artefact references and iteration caps. Two cautions matter for this company in particular: a twelve-department structure is itself a role-based split, which Anthropic's January 2026 guidance warns loses context at each handoff, and DORA's evidence says blanket approval boards slow delivery without lowering failure rates, so gates must be risk-tiered. Nearly everything specific to Sweden (IMY guidance, bookkeeping and VAT rules, employment law, who may sign for the company) was not researched and is listed as a gap, not filled from memory.

## How to read and split this document

This document is written to be cut into atomic knowledge-base entries. Every body paragraph is meant to stand alone: it opens with one or more labels, names its subject in full, and keeps each number next to its date and source link. Section numbers group domains; sub-headings name the single topic of the paragraphs beneath them. Tables carry a basis or source cell in every row so that a row can be split out as its own entry. When splitting, keep the label, the date and the link with the claim.

The labels mean the following. **[DURABLE]** marks a principle, definition or long-standing rule that has held for years. **[FAST-MOVING, date]** marks a figure, service level, specification status or handbook detail that will age, with the date of the source or the date it was read. **[VENDOR]** marks a figure or recommendation from a party with a commercial interest in the conclusion; in this document that includes the AI model and cloud vendors (Anthropic, OpenAI, Microsoft, Google Cloud, AWS, LangChain, Cognition) and the tool and training vendors (Atlassian, HubSpot, Pragmatic Institute, Giskard). **[PLATFORM CLAIM]** marks a company's or project's own statement about itself that nobody independently verified, such as GitLab's handbook describing GitLab's practice or a standards body describing its own adoption. **[CONTESTED]** marks a point where sources disagree. **[INFERENCE]** marks synthesis by the researchers that no single fetched source states; adopt it as an editable default. **[GAP]** marks something the research did not verify or could not find. The [HOUSE STYLE] label is not used in this document.

Three markers are used inside the proposal tables. "Sourced" means the row rests on a cited page that the researchers read. "Partly sourced" means the trigger or one element is cited and the rest is the researchers' template. "[INFERENCE]" means no primary source was retrieved for the row. The letter **H** in a process table marks a step where the proposal places a human approval gate; every H is the researchers' inference, justified in section 8.

For legal, tax and regulatory points the document states one of three statuses. "Article text read" means the article was read during the research on gdpr-info.eu, an unofficial reproduction of the GDPR, and was not checked against EUR-Lex. "Secondary source only" means a third-party explainer or press report was read and the official text was not. "Unverified, not researched" means the notes contain no source at all and the point is named only so that someone checks it. Agents must not gate a live decision on a secondary or unverified legal point without confirmation.

Six caveats apply to the whole document. First, legal and regulatory content is orientation as of 11 November 2026 and not professional legal, tax or employment advice. Second, several pages were read through a summarising fetch tool, so all wording is paraphrase and figures are as that tool returned them. Third, the worked examples of human practice come overwhelmingly from a handful of large US technology companies (GitLab, Google, Amazon, Atlassian); none is a twelve-department SaaS company and none is run by AI agents. Fourth, no empirical study was found of AI-agent "companies" with departmental structure running a real business; the multi-agent evidence comes from benchmark tasks and vendor engineering reports. Fifth, GitLab handbook pages are living documents read in November 2026 and their numbers will change. Sixth, the research found no gap-fill or correction notes for this topic and no earlier research to build on, so this document rests on a single set of notes.

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

## 3. Decision rights: three frameworks converge on one decider with input kept separate from approval

### 3.1 RAPID, DACI and DRI

[DURABLE] Bain's RAPID assigns five roles: Recommend (one recommender per decision, who builds the proposal), Agree (sign-off on mandatory requirements such as legal or regulatory ones, to be assigned sparingly), Perform (executes, and should be assigned promptly), Input (expertise, including from those affected) and Decide (ideally one decider, close to implementation, who communicates the rationale). Bain advises applying it first to high-value or frequent decisions ([Bain, RAPID, 13 October 2023](https://www.bain.com/insights/rapid-decision-making/)).

[VENDOR] [DURABLE] Atlassian's DACI assigns a Driver who runs the process to a date, exactly one Approver, Contributors who have a voice but no vote, and Informed parties who are told afterwards. The decision document records status, impact, due date, background, relevant data, decision factors, options with pros, cons and cost, action items and the outcome ([Atlassian DACI play, read November 2026](https://www.atlassian.com/team-playbook/plays/daci)). That document layout is one of the inputs to the handoff message template in section 7.

[PLATFORM CLAIM] [DURABLE] GitLab's DRI model gives a single accountable individual final decision power; a DRI who is overruled by another decision maker makes the case and then disagrees and commits ([GitLab DRI, read November 2026](https://handbook.gitlab.com/handbook/people-group/directly-responsible-individuals/)).

[INFERENCE] For each grey zone in 1.4, record a DACI or RAPID line with exactly one Approver or Decider. Put Legal and Finance in the "Agree" role only where a mandatory requirement exists, in line with Bain's advice to assign Agree sparingly ([Bain, RAPID, 13 October 2023](https://www.bain.com/insights/rapid-decision-making/)); everywhere else they are Contributors with a voice and no veto.

### 3.2 Interaction modes, single-threaded ownership and service catalogues

[DURABLE] Team Topologies defines three interaction modes: Collaboration (time-boxed joint discovery), X-as-a-Service (one team provides and another consumes) and Facilitation (one team helps or mentors another). It holds that team cognitive load is limited and should be actively reduced, and that a "thinnest viable platform" avoids creating new dependencies ([Team Topologies key concepts, read November 2026](https://teamtopologies.com/key-concepts)).

[DURABLE] Amazon's single-threaded leadership gives one leader with no competing responsibilities one major initiative, with a separable team, a defined purpose, clear boundaries and agreed metrics, as described by Bryar and Carr and summarised by Commoncog ([Commoncog, Working Backwards, 2021](https://commoncog.com/working-backwards/)).

[INFERENCE] Mapped to the twelve agent departments, Application and the customer-facing departments behave as stream-aligned teams; IT infrastructure and Data and AI behave as platform teams offered as a service through a service catalogue; Research, Legal and Operations act mostly as enabling or facilitating teams; and Media acts as a service or complicated-subsystem team that takes briefs. Collaboration mode should be time-boxed, for example to a launch or an incident, because it is the most expensive mode.

[INFERENCE] Each department should publish a service catalogue entry that states its request types, required inputs, first-response and resolution targets, out-of-scope items, escalation rule and accepting role. This follows the single worked example of the GitLab deal desk ([GitLab deal desk](https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/)) and is not a published standard.

### 3.3 Temporary coordination: incident command, change authority and escalation

[DURABLE] In Google's incident command model clear role separation gives responders autonomy, only the operations group changes the system during an incident, a live shared incident document is the commander's key tool, and overloaded responders can spin off sub-incidents ([Google SRE book, chapter 14](https://sre.google/sre-book/managing-incidents/)). The model shows how cross-department coordination can be made temporary and tightly scoped.

[DURABLE] DORA recommends that the change advisory board move from gatekeeper to process architect, keeping cross-team coordination and high-level trade-offs ([DORA, read November 2026](https://dora.dev/capabilities/streamlining-change-approval/)), and ITIL 4, as described by Atlassian, encourages delegating change authority to peers and automation with the board reserved for the riskiest changes ([Atlassian, change management, read November 2026](https://www.atlassian.com/itsm/change-management)).

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] Two worked escalation rules exist in the notes: GitLab's deal desk allows escalation of a case unresolved after 24 hours ([GitLab deal desk](https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/)), and GitLab's incident process escalates to the incident manager on call when an incident is still under investigation after 30 minutes ([GitLab incident management](https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/incident-management/)). Write a time-based escalation rule of this kind into every catalogue entry.

[CONTESTED] The evidence on cross-functional governance pulls in two directions. A 2015 Harvard Business Review article by Tabrizi carries the headline claim that 75% of cross-functional teams are dysfunctional, and its summary says fixing them requires strong governance ([HBR, 23 June 2015](https://hbr.org/2015/06/75-of-cross-functional-teams-are-dysfunctional)); the article body, including the study size and criteria, was behind a paywall and was not read. DORA's research cuts the other way on one specific form of governance, finding that heavy external change approval slows delivery without lowering failure rates ([DORA, read November 2026](https://dora.dev/capabilities/streamlining-change-approval/)). The reading that reconciles them is the researchers' inference: clear single-owner decision rights, yes; approval boards on routine work, no.

[GAP] [INFERENCE] A revenue operations function coordinating Marketing, Sales, Support and Finance (shared funnel definitions, the CRM data model, handoff service levels) is a reasonable design for this company, but no primary source was retrieved for it. Searches for revenue operations and the Winning by Design bowtie model returned only vendor and agency blogs, so any description of RevOps is unsourced. MIT Sloan material on cross-functional coordination was not found, Amazon's OP1 and OP2 planning timing was not on the page read, and no primary source on inter-team ticket intake design was retrieved beyond the GitLab examples.

## 4. Eight end-to-end processes, mapped step by step to departments

### 4.1 Status of the process maps

[INFERENCE] [GAP] Only parts of these flows are documented in sources that were read: quote-to-cash at GitLab, incident-to-postmortem at Google and GitLab, the GDPR request timing in the Regulation, and production readiness for idea-to-launch. The step-by-department mappings below are the researchers' own construction anchored on those sources and are a proposed design, not a published standard. No primary source was retrieved for canonical step lists of procure-to-pay, record-to-report or hire-to-retire; APQC places hire-to-retire under category 6 and finance processes under category 8 ([APQC PCF v6.1.1, July 2015](https://www.forgov.qld.gov.au/__data/assets/pdf_file/0027/319842/apqc_pcf_ver_6.1.1-final.pdf)), but the process groups beneath them were unreadable in the accessible file.

### 4.2 Lead-to-cash

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] The sourced anchor for lead-to-cash is GitLab's quote-to-cash sequence: create the quote on the opportunity; select the billing account, dates, term and contacts; add products and discounts; submit for approvals; generate the order form and obtain the customer's signature; capture payment where card-based; close as won; and invoice the customer within 24 hours. The deal desk reviews before booking and handles month-end close duties with billing, accounts receivable and legal ([GitLab deal desk](https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/)). The lead stages before the opportunity are in 2.2 and the post-sale kickoff is in 2.3.

[INFERENCE] The proposed lead-to-cash flow for the twelve departments is below.

| Step | Department | What happens | Human gate | Basis |
|---|---|---|---|---|
| 1 | Research | ICP and market input | None | [INFERENCE] |
| 2 | Marketing | Campaign, lead capture, MQL | None | [INFERENCE]; statuses from [GitLab lead lifecycle](https://handbook.gitlab.com/handbook/marketing/marketing-operations/lead-lifecycle/) |
| 3 | Sales | Accept and qualify, demo, quote | None | [INFERENCE]; statuses from [GitLab lead lifecycle](https://handbook.gitlab.com/handbook/marketing/marketing-operations/lead-lifecycle/) |
| 4 | Finance (deal desk) | Non-standard pricing and terms | H | [INFERENCE]; pattern from [GitLab deal desk](https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/) |
| 5 | Legal | Non-standard contract language | H for signature | [INFERENCE]; pattern from [GitLab deal desk](https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/) |
| 6 | Sales | Close | None | [INFERENCE] |
| 7 | Finance | Invoice, VAT ID check, collections, revenue recognition | None stated | [INFERENCE]; invoice and VAT ID practice from [GitLab deal desk](https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/) |
| 8 | Customer Support | Kickoff and onboarding | None | [INFERENCE]; kickoff from [GitLab transition](https://handbook.gitlab.com/handbook/customer-success/pre-sales-post-sales-transition/) |
| 9 | Data and AI | Funnel and revenue metrics | None | [INFERENCE] |
| 10 | Sales and Customer Support | Renewal and expansion triggers | None | [INFERENCE]; triggers from [GitLab transition](https://handbook.gitlab.com/handbook/customer-success/pre-sales-post-sales-transition/) |

### 4.3 Idea-to-launch

[INFERENCE] The proposed idea-to-launch flow is below. Its sourced anchors are the working-backwards narrative ([Commoncog, 2021](https://commoncog.com/working-backwards/)), the definition of ready ([Atlassian](https://www.atlassian.com/agile/project-management/definition-of-ready)), the production readiness review ([Google SRE ch. 32](https://sre.google/sre-book/evolving-sre-engagement-model/)) and launch tiers ([Pragmatic Institute](https://www.pragmaticinstitute.com/blog/post/prioritize-product-launch-resources-with-launch-tiers)).

| Step | Department | What happens | Human gate | Basis |
|---|---|---|---|---|
| 1 | Research, Customer Support, Sales | Evidence and feedback | None | [INFERENCE] |
| 2 | Product | Problem framing, PR/FAQ or specification, prioritisation | None | [INFERENCE]; narrative from [Commoncog](https://commoncog.com/working-backwards/) |
| 3 | Legal and Data and AI | Privacy or DPIA screening and AI screening, when triggered | None stated | [INFERENCE]; trigger from [GDPR Art. 35](https://gdpr-info.eu/art-35-gdpr/) |
| 4 | Application | Design, build, test under the definitions of ready and done | None | [INFERENCE]; [Atlassian](https://www.atlassian.com/agile/project-management/definition-of-ready) |
| 5 | IT infrastructure | Production readiness, deploy, monitoring | H for high-risk change | [INFERENCE]; [Google SRE ch. 32](https://sre.google/sre-book/evolving-sre-engagement-model/) and [DORA](https://dora.dev/capabilities/streamlining-change-approval/) |
| 6 | Product | Launch tier | None | [INFERENCE]; [Pragmatic Institute](https://www.pragmaticinstitute.com/blog/post/prioritize-product-launch-resources-with-launch-tiers) |
| 7 | Marketing | Positioning, messaging, launch plan | None | [INFERENCE] |
| 8 | Media | Assets | None | [INFERENCE] |
| 9 | Legal | Claims review | None stated at this step; novel claims are gated in section 8 | [INFERENCE] |
| 10 | Sales and Customer Support | Enablement, help-centre articles | None | [INFERENCE] |
| 11 | Data and AI | Adoption metrics | None | [INFERENCE] |
| 12 | Product | Post-launch review | None | [INFERENCE] |

### 4.4 Issue-to-resolution

[INFERENCE] The proposed issue-to-resolution flow is below; severity definitions, triage completeness criteria and resolution targets come from 2.4 ([GitLab issue triage](https://handbook.gitlab.com/handbook/product-development/how-we-work/issue-triage/)).

| Step | Department | What happens | Human gate | Basis |
|---|---|---|---|---|
| 1 | Customer Support | Intake, reproduce, propose severity, communicate with the customer | None | [INFERENCE]; criteria from [GitLab issue triage](https://handbook.gitlab.com/handbook/product-development/how-we-work/issue-triage/) |
| 2 | Application | Triage DRI confirms severity; fix | None | [INFERENCE]; DRI from [GitLab issue triage](https://handbook.gitlab.com/handbook/product-development/how-we-work/issue-triage/) |
| 3 | IT infrastructure | Deploys the fix; owns the fix if the cause is infrastructure | None stated | [INFERENCE] |
| 4 | Customer Support | Confirms with the customer; updates the knowledge base | None | [INFERENCE] |
| 5 | Product | Pattern review of recurring issues | None | [INFERENCE] |
| 6 | Data and AI | Ticket and defect metrics | None | [INFERENCE] |

### 4.5 Incident-to-postmortem

[INFERENCE] The proposed incident-to-postmortem flow is below; the roles, declaration criteria, communication targets and postmortem triggers come from 2.8.

| Step | Department | What happens | Human gate | Basis |
|---|---|---|---|---|
| 1 | Any department | Detects and declares | None | [INFERENCE]; declaration criteria from [Google SRE ch. 14](https://sre.google/sre-book/managing-incidents/) |
| 2 | IT infrastructure or Application | Provides the incident commander and operations lead | None stated | [INFERENCE]; roles from [Google SRE ch. 14](https://sre.google/sre-book/managing-incidents/) |
| 3 | Customer Support | Provides the communications lead and status page | None for templated status updates | [INFERENCE]; Support staffing from [GitLab incident management](https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/incident-management/) |
| 4 | Legal | Engaged if personal data or a contractual SLA breach is possible | H | [INFERENCE] |
| 5 | Marketing | Public statement beyond the status page | H | [INFERENCE] |
| 6 | Finance | SLA credits | None stated | [INFERENCE] |
| 7 | Commander's department | Drafts the blameless postmortem | None | [INFERENCE]; [Google SRE ch. 15](https://sre.google/sre-book/postmortem-culture/) |
| 8 | Product, Application, IT infrastructure | Own corrective actions with dates | None | [INFERENCE]; time-bound actions from [GitLab incident management](https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/incident-management/) |
| 9 | Operations | Tracks completion | None | [INFERENCE] |

### 4.6 Hire-to-retire, including provisioning and retiring agents

[INFERENCE] The proposed hire-to-retire flow sits with people operations inside Operations. Because the workers in this company are largely AI agents, the same flow also covers agent provisioning and decommissioning. No canonical source was retrieved, and Swedish employment and co-determination law (MBL, LAS) is unverified and was not researched.

| Step | Department | What happens | Human gate | Basis |
|---|---|---|---|---|
| 1 | Requesting department | States the need | None | [INFERENCE] |
| 2 | Finance | Budget | H | [INFERENCE] |
| 3 | Operations | Requisition, recruiting, offer | H for hire, fire and pay | [INFERENCE]; logic from [GDPR Art. 22](https://gdpr-info.eu/art-22-gdpr/) |
| 4 | Legal | Employment contract; Swedish labour-law position | H | [INFERENCE]; Swedish law unverified |
| 5 | IT infrastructure | Accounts and access by least privilege | None stated; privileged agent access is gated in section 8 | [INFERENCE] |
| 6 | Hiring department | Onboarding | None | [INFERENCE] |
| 7 | Operations | Performance cycle, offboarding | H for ratings and termination, per section 8 | [INFERENCE] |
| 8 | IT infrastructure | Access removal | None | [INFERENCE] |
| 9 | Finance | Final payroll | None stated | [INFERENCE] |

### 4.7 Procure-to-pay

[INFERENCE] The proposed procure-to-pay flow is below. No canonical source was retrieved for the steps.

| Step | Department | What happens | Human gate | Basis |
|---|---|---|---|---|
| 1 | Requesting department | Need and business case | None | [INFERENCE] |
| 2 | Operations | Vendor selection and onboarding | None | [INFERENCE] |
| 3 | IT infrastructure | Security review | None | [INFERENCE] |
| 4 | Legal | Contract and data processing agreement | H for signature, per section 8 | [INFERENCE] |
| 5 | Finance | Budget check and purchase approval | H | [INFERENCE] |
| 6 | Requesting department | Confirms receipt | None | [INFERENCE] |
| 7 | Finance | Invoice matching and payment | H for payment release | [INFERENCE]; payment example from [OpenAI guide](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf) |
| 8 | Data and AI | Spend reporting | None | [INFERENCE] |

### 4.8 Record-to-report

[INFERENCE] The proposed record-to-report flow is below. No canonical source was retrieved, and Swedish bookkeeping retention rules, annual-report filing and VAT invoicing rules are unverified and were not researched.

| Step | Department | What happens | Human gate | Basis |
|---|---|---|---|---|
| 1 | All departments | Source transactions and accrual inputs | None | [INFERENCE] |
| 2 | Finance | Sub-ledger close, reconciliations, journal entries, consolidation, management and statutory reports | H for sign-off | [INFERENCE] |
| 3 | Data and AI | Reconciles operational metrics to finance figures | None | [INFERENCE]; Finance audit role from [Commoncog WBR](https://commoncog.com/the-amazon-weekly-business-review/) |
| 4 | Legal | Statutory filings | None stated | [INFERENCE]; Swedish filing rules unverified |
| 5 | Leadership (human) | Review | Human by definition | [INFERENCE] |

### 4.9 GDPR data-subject request from a customer

[DURABLE] Legal status: article text read on gdpr-info.eu, not checked on EUR-Lex; orientation and not professional advice. Under GDPR Article 12 the controller must respond to a data-subject request without undue delay and **within one month of receipt**. The period can be extended by **two further months** for complexity or volume, with notice and reasons given inside the first month. The controller may request extra information where identity is in reasonable doubt, must act free of charge unless a request is manifestly unfounded or excessive (the controller bears the burden of proof), and if it does not act must tell the person within one month, with reasons and their right to complain to a supervisory authority and seek a judicial remedy ([GDPR Article 12](https://gdpr-info.eu/art-12-gdpr/)).

[INFERENCE] The proposed GDPR data-subject request flow is below. Guidance from IMY, the Swedish data protection authority, on access requests is unverified and was not researched.

| Step | Department | What happens | Human gate | Basis |
|---|---|---|---|---|
| 1 | Customer Support | Intake from any channel; logs the receipt date; starts the one-month clock | None | [INFERENCE]; clock from [GDPR Art. 12](https://gdpr-info.eu/art-12-gdpr/) |
| 2 | Legal | Classifies the request type; identity check where reasonable doubt exists; decides scope and exemptions | H for refusals and extensions | [INFERENCE]; [GDPR Art. 12](https://gdpr-info.eu/art-12-gdpr/) |
| 3 | Data and AI, IT infrastructure, Application | Locate, export, rectify or erase across systems and backups; processors notified | None stated | [INFERENCE] |
| 4 | Legal | Reviews the response package | None stated | [INFERENCE] |
| 5 | Customer Support | Sends the response; records completion | None | [INFERENCE] |
| 6 | Operations and Legal | Keep the register of requests for audit | None | [INFERENCE] |

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

## 6. Multi-agent coordination: centralised orchestration contains errors that independent agents amplify 17.2x

### 6.1 Patterns and when to use multiple agents at all

[VENDOR] [DURABLE] Anthropic distinguishes workflows, which follow predefined code paths, from agents, which direct their own process. Its patterns are prompt chaining, routing, parallelisation, orchestrator-workers and evaluator-optimiser. Its advice is to find the simplest solution and add complexity only when needed, and because agents carry compounding-error risk, to use stopping conditions, human checkpoints and sandboxed testing ([Anthropic, Building effective agents, 19 December 2024](https://www.anthropic.com/engineering/building-effective-agents)).

[VENDOR] [PLATFORM CLAIM] [FAST-MOVING, 13 June 2025] Anthropic's research system uses a lead agent that plans, spawns parallel subagents and synthesises. Anthropic reported a **90.2% improvement** over a single agent on an internal research evaluation, with agents using about **4x** the tokens of chat and multi-agent systems about **15x**. It describes multi-agent as a poor fit where agents need shared context or have many inter-dependencies, including most coding tasks ([Anthropic, multi-agent research system, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system)). The figures are self-reported on an internal evaluation.

[VENDOR] [FAST-MOVING, 23 January 2026] Anthropic's later guidance says multi-agent is justified by context protection, parallelisation or specialisation, and typically costs **3 to 10x** more tokens than a single agent for equivalent tasks. It advises splitting by context boundaries and not by type of work, because role-based splits (planner, implementer, tester, reviewer) lost context at each handoff and spent more tokens coordinating than working, and it suggests considering a split at roughly 15 to 20 or more tools, after trying tool search ([Claude, Building multi-agent systems, 23 January 2026](https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them)).

[VENDOR] [FAST-MOVING, undated; third-party coverage places it in April 2025] OpenAI contrasts the manager pattern, in which a central agent calls specialists as tools and keeps control, with decentralised handoffs between peers. It advises maximising a single agent first and splitting when prompts have many conditional branches or tools overlap ([OpenAI, practical guide to building agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)).

[VENDOR] [FAST-MOVING, 12 February 2026] Microsoft's Azure Architecture Center lists five orchestration patterns: sequential, concurrent, group chat, handoff and magentic (a manager maintaining a task ledger). It advises the lowest complexity that works, justifies multi-agent for cross-domain work, separate security boundaries or parallel specialisation, recommends keeping group chats to three or fewer agents, and recommends a deterministic dispatcher when the right agent is identifiable from the input ([Microsoft, AI agent orchestration patterns, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).

[VENDOR] [FAST-MOVING, 28 May 2026] Google Cloud describes a coordinator pattern that routes sub-tasks to specialists at higher cost and latency; hierarchical task decomposition, which uses layered delegation and is hard to build and maintain; review-and-critique, which adds a critic working against defined criteria; a swarm with no coordinator, which has the highest complexity and may not converge; and human-in-the-loop, which pauses at checkpoints such as large financial transactions ([Google Cloud, choose a design pattern for agentic AI, last reviewed 28 May 2026](https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system)). A company of manager agents directing worker agents is a form of hierarchical decomposition, the pattern Google Cloud flags as hard to maintain.

[VENDOR] [FAST-MOVING, undated page read November 2026] AWS Prescriptive Guidance describes multi-agent collaboration as decentralised or peer coordination through shared memory (a "blackboard") or messaging and event routing, with an optional supervising agent. AWS positions it for open-ended reasoning and says enterprise process automation fits centrally controlled workflow agents better ([AWS, multi-agent collaboration](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-patterns/multi-agent-collaboration.html)).

[VENDOR] [FAST-MOVING, read November 2026] LangChain's documentation lists the patterns subagents (a main agent calls subagents as tools), handoffs, skills, router and custom workflow, and rates subagents highest for distributed development and parallelisation. In its example a multi-domain request cost about **9K tokens** with subagents or a router in parallel against **14K or more** with sequential handoffs, and it calls context engineering, deciding what each agent sees, the core of multi-agent design ([LangChain, multi-agent](https://docs.langchain.com/oss/python/langchain/multi-agent)).

[CONTESTED] [VENDOR] [FAST-MOVING, 12 June 2025] Cognition's Walden Yan dissents from the multi-agent consensus. His argument is that agents should share full traces and not single messages, that actions embed implicit decisions, and that parallel subagents built mismatched parts in his example; he recommends a single-threaded agent with context compression and called multi-agent collaboration fragile in 2025 ([Cognition, Don't build multi-agents, 12 June 2025](https://cognition.com/blog/dont-build-multi-agents)). Anthropic's own guidance concedes part of this, since it excludes most coding tasks and tightly inter-dependent work from multi-agent designs ([Anthropic, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system)).

[INFERENCE] The twelve-department design is itself a role-based split, the kind Anthropic's January 2026 guidance warns about ([Claude, 23 January 2026](https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them)). The proposed mitigation is to keep whole tasks inside one department where context is shared, hand off only at genuine context boundaries, and pass artefacts in place of summaries.

### 6.2 Handoff message design and shared artefacts versus message passing

[VENDOR] [DURABLE] Anthropic found that each delegation needs four things: an objective, an output format, guidance on tools and sources, and clear task boundaries. Vague briefs caused one subagent to research the wrong period while two others duplicated work. Effort-scaling rules were written into prompts, from one agent with 3 to 10 tool calls for simple fact-finding up to more than 10 subagents for complex research ([Anthropic, multi-agent research system, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system)).

[VENDOR] [DURABLE] Anthropic advises having subagents write outputs to external storage and return lightweight references, which avoids the loss it likens to a game of telephone, and summarising completed phases to external memory before handing off to fresh agents near context limits ([Anthropic, multi-agent research system, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system)).

[VENDOR] [FAST-MOVING, 12 February 2026] Microsoft advises deciding per handoff whether the next agent needs the full raw context, a compacted summary or only new instructions; persisting shared state externally and scoping it to the minimum necessary; validating outputs before passing them downstream because malformed or low-confidence output cascades; and avoiding mutable state shared between concurrent agents ([Microsoft, AI agent orchestration patterns, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).

[VENDOR] [FAST-MOVING, read November 2026] In the OpenAI Agents SDK, handoffs are exposed as tools. A handoff can carry structured input such as a reason or priority validated against a schema, the receiver sees the full history by default unless an input filter trims it, and authorisation checks can run in the handoff callback and block the transfer ([OpenAI Agents SDK, handoffs](https://openai.github.io/openai-agents-python/handoffs/)).

[INFERENCE] A shared artefact store with messages that carry references is better supported than pure message passing, on the strength of the Anthropic and Microsoft guidance above. Because concurrent writes to shared mutable state are a named anti-pattern ([Microsoft, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)), each artefact should have one owning department and versioning; other departments read it and request changes, they do not edit it.

### 6.3 Protocols: MCP for tools and data, A2A between agents, governance left to the company

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] The A2A protocol's core objects are the Agent Card (identity, capabilities, skills, endpoint and authentication requirements), the Task (a stateful unit with an ID and lifecycle), the Message, the Part, the Artifact (a deliverable) and a context ID that groups related tasks. Remote agents are opaque, meaning their internal memory and tools stay hidden, and long tasks are supported through streaming and webhook push ([A2A key concepts](https://a2a-protocol.org/latest/topics/key-concepts/)).

[PLATFORM CLAIM] [FAST-MOVING, 9 April 2026] A Linux Foundation press release describes A2A version 1.0 as the first stable specification, adding multi-protocol support, enterprise multi-tenancy, signed Agent Cards for cryptographic identity and version negotiation. It reports **more than 150 supporting organisations**, up from more than 50 a year earlier, integrations in Azure AI Foundry, Copilot Studio and Amazon Bedrock AgentCore, and SDKs in five languages, and positions A2A as complementary to MCP: A2A between agents, MCP for tools and data ([Linux Foundation, 9 April 2026](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)).

[PLATFORM CLAIM] [FAST-MOVING, 28 July 2026] The MCP specification dated 2026-07-28 makes the core stateless: the initialise handshake and session header are retired and each request carries the version, client identity and capabilities. Server-initiated elicitation and sampling are replaced by multi-round-trip requests that return "input required". Method and name headers are mandatory so that gateways can route and meter. Authorisation is hardened (issuer validation, issuer-bound credentials, Dynamic Client Registration deprecated in favour of Client ID Metadata Documents). Tasks move to an extension, Roots, Sampling and Logging are deprecated with at least twelve months' support, and Enterprise Managed Authorization is listed as an extension ([MCP blog, 28 July 2026](https://blog.modelcontextprotocol.io/posts/2026-07-28/)).

[PLATFORM CLAIM] [FAST-MOVING, 24 February 2026] The Agentic AI Foundation was formed under the Linux Foundation with a launch date given as 9 December 2025. Its February 2026 blog says it hosts MCP, goose and AGENTS.md, has **146 members**, and runs working groups that include identity and trust, security and privacy, observability and traceability, and governance, risk and regulatory alignment ([AAIF blog, 24 February 2026](https://aaif.io/blog/aaifs-first-quarter-success-story-new-members-technical-wins-and-open-governance)).

[CONTESTED] [FAST-MOVING, 14 October 2026] The governance home of A2A is reported inconsistently. A secondary report says A2A maintainers were newly accepted into the Agentic AI Foundation, which it describes as hosting both MCP and A2A, and that the foundation moved to sandbox, growth and impact project stages and opened working groups to non-members ([diginomica, 14 October 2026](https://diginomica.com/what-agentic-ai-foundations-rule-changes-mean-building-mcp-a2a)). The April 2026 Linux Foundation release describes A2A simply as a Linux Foundation project ([Linux Foundation, 9 April 2026](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)). The later claim was not confirmed on a primary page.

[INFERENCE] Each department's manager agent should publish something like an A2A Agent Card or service catalogue entry (skills, required inputs, authentication, service level), and a common task-status vocabulary should be used across departments. The researchers suggest submitted, working, input-required, completed, rejected and failed; the exact A2A state list was not on the page read and must be confirmed against the specification before adoption.

### 6.4 Failure modes measured in research

[FAST-MOVING, 26 October 2025] The MAST study from UC Berkeley (Cemri et al., arXiv 2503.13657, version 3) annotated **1,642 traces across 7 frameworks** and identified **14 failure modes in 3 categories**. It reported failure rates of **41% to 86.7%** across the systems studied, with annotator agreement at kappa 0.88 ([arXiv 2503.13657v3, 26 October 2025](https://arxiv.org/html/2503.13657v3)). The systems were frameworks such as MetaGPT and ChatDev on benchmark tasks, not companies in production.

[FAST-MOVING, 26 October 2025] The MAST failure-mode shares are in the table below. The category totals are sums of the mode figures as the fetch tool returned them, so treat them as approximate ([arXiv 2503.13657v3, 26 October 2025](https://arxiv.org/html/2503.13657v3)).

| MAST category | Approximate share | Modes and shares | Source |
|---|---|---|---|
| System design issues | About 44% | Step repetition 15.7%; unaware of termination conditions 12.4%; disobeying task specification 11.8%; loss of conversation history 2.8%; disobeying role specification 1.5% | [arXiv 2503.13657v3, 26 Oct 2025](https://arxiv.org/html/2503.13657v3) |
| Inter-agent misalignment | About 32% | Reasoning-action mismatch 13.2%; task derailment 7.4%; failing to ask for clarification 6.8%; conversation reset 2.2%; ignoring another agent's input 1.9%; information withholding 0.85% | [arXiv 2503.13657v3, 26 Oct 2025](https://arxiv.org/html/2503.13657v3) |
| Task verification | About 24% | Incorrect verification 9.1%; no or incomplete verification 8.2%; premature termination 6.2% | [arXiv 2503.13657v3, 26 Oct 2025](https://arxiv.org/html/2503.13657v3) |

[FAST-MOVING, 26 October 2025] The MAST interventions had modest effect. Clearer role specifications, or giving one agent the final say, raised task success by about **9.4%** in one system, and adding a high-level objective verification step raised it by about **15.6%**. Gains were inconsistent and completion stayed low, so the authors call for structural changes and multi-level verification ([arXiv 2503.13657v3, 26 October 2025](https://arxiv.org/html/2503.13657v3)). Prompt fixes alone will not make department handoffs reliable.

[FAST-MOVING, 28 January 2026] Google Research tested 180 configurations across five architectures and three model families (paper arXiv 2512.08296). Independent agents amplified errors **17.2x** against **4.4x** under centralised coordination. Centralised coordination improved a parallelisable finance task by **80.9%** over a single agent, whereas every multi-agent variant degraded a sequential planning task by **39 to 70%**. Coordination overhead grew with tool count, and a predictive model picked the best architecture for 87% of unseen configurations ([Google Research blog, 28 January 2026](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/)). The practical reading: use several agents for work that parallelises, keep sequential work in one agent, and always coordinate centrally.

[VENDOR] [FAST-MOVING, 23 January 2026] Anthropic names a verification-agent failure mode in which the verifier runs one or two checks and declares success early. The mitigation is concrete criteria, full test runs and negative tests ([Claude, Building multi-agent systems, 23 January 2026](https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them)).

[VENDOR] [FAST-MOVING, December 2025] The OWASP Top 10 for Agentic Applications, first published in December 2025 and read here only through Giskard's summary, lists goal hijack; tool misuse; identity and privilege abuse; agentic supply chain; unexpected code execution; memory and context poisoning; insecure inter-agent communication; cascading failures; human-agent trust exploitation; and rogue agents ([Giskard summary](https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026)). The OWASP document itself was not read, so its per-risk mitigations are not sourced here.

### 6.5 Permissions, logging and audit

[DURABLE] OWASP's LLM06:2025 entry on excessive agency attributes the risk to excessive functionality, permissions and autonomy. Its mitigations include minimal and granular tools, least-privilege downstream permissions, acting in the user's context, human approval for high-impact actions, enforcing authorisation in downstream systems and not in the model, and logging and rate limiting to limit damage ([OWASP GenAI, LLM06:2025](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)).

[VENDOR] [FAST-MOVING, 12 February 2026] Microsoft advises authenticating and securing agent-to-agent traffic; least privilege for agents and orchestrators; security trimming by every agent so that users never receive data they cannot access; audit trails; instrumentation of all operations and handoffs; guardrails at input, tool calls, tool responses and output; and timeouts, retries, circuit breakers and checkpoints ([Microsoft, AI agent orchestration patterns, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).

[VENDOR] [FAST-MOVING, 4 August 2025] Anthropic's framework says humans should keep control before high-stakes decisions, that agents should be read-only by default with user-granted persistent permissions for trusted routine tasks, and that administrators can restrict which connectors are available ([Anthropic, safe and trustworthy agents framework, 4 August 2025](https://www.anthropic.com/news/our-framework-for-developing-safe-and-trustworthy-agents)).

[INFERENCE] Least privilege should be applied by department: tool grants per department (for example only Finance agents hold payment tools and only IT infrastructure holds production deploy), a distinct identity per agent, authorisation enforced by downstream systems, cross-department data access by request and not by standing permission, and every tool call and handoff logged with the task ID. This is inferred from the OWASP and Microsoft guidance above.

[INFERENCE] Because MCP's built-in Logging feature is deprecated in the 2026-07-28 specification, audit logging should be done at the gateway or platform level; the mandatory method and name headers in that specification make this feasible ([MCP blog, 28 July 2026](https://blog.modelcontextprotocol.io/posts/2026-07-28/)). This reading of the specification is the researchers' inference.

### 6.6 Cost

[VENDOR] [FAST-MOVING, 12 February 2026] Microsoft advises matching model size to the task, monitoring tokens per agent and per run, and compacting context, and notes that magentic orchestration is the least predictable in cost ([Microsoft, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)). Anthropic reports that token usage alone explained **80% of performance variance** on one benchmark and says low-value tasks cannot justify multi-agent cost ([Anthropic, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system)). The vendor multipliers in 6.1 (about 15x chat tokens in June 2025; 3 to 10x a single agent in January 2026) set the order of magnitude.

[INFERENCE] The proposed cost controls are per-department token budgets, effort-scaling rules in manager prompts, smaller models for routing and formatting, caps on fan-out and loop iterations, and a weekly cost-per-task review.

### 6.7 Evaluation and verification

[VENDOR] [DURABLE] Anthropic recommends starting evaluation with about **20 representative cases**, LLM-judge rubrics (factual accuracy, citation accuracy, completeness, source quality, tool efficiency), human review for edge cases and judging the end state and not the path. For production it calls for tracing, checkpoints with resume and gradual "rainbow" deployments ([Anthropic, multi-agent research system, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system)). Microsoft recommends rubric or LLM-judge integration tests in place of exact-match assertions ([Microsoft, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).

[FAST-MOVING, 26 October 2025] MAST's LLM annotator reached **94% accuracy** against human experts (kappa 0.77), which suggests that labelling traces for failure modes can be automated ([arXiv 2503.13657v3, 26 October 2025](https://arxiv.org/html/2503.13657v3)). A company could run such a labeller over cross-department task logs; that application is the researchers' inference.

[VENDOR] [FAST-MOVING, 12 February 2026] On human-in-the-loop design, Microsoft advises deciding whether a gate is optional or mandatory and whether it approves or gives feedback, persisting state at mandatory gates, scoping gates to sensitive tool invocations and not to every output, and giving maker-checker loops acceptance criteria and an iteration cap with human escalation ([Microsoft, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)). OpenAI advises rating each tool low, medium or high risk by read-only versus write access, reversibility, permissions needed and financial impact, and escalating to a human when failure thresholds are exceeded or for sensitive, irreversible or high-stakes actions ([OpenAI, practical guide](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)).

[INFERENCE] Verification of a handoff deliverable should be independent of the producing department and based on stated criteria, following MAST and Anthropic, with an iteration cap followed by human escalation, following Microsoft.

## 7. Routing rule and message template: new work goes manager-to-manager, workers talk only inside an accepted task

### 7.1 When a cross-department request goes manager-to-manager versus worker-to-worker

[GAP] [INFERENCE] No published guidance was found that directly addresses manager-to-manager versus worker-to-worker routing in a hierarchical agent organisation; the rule in this section is inference. The evidence points to manager-mediated requests as the default: centralised coordination contained error amplification at 4.4x against 17.2x for independent agents ([Google Research blog, 28 January 2026](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/)), role, termination and verification failures dominate in MAST ([arXiv 2503.13657v3, 26 October 2025](https://arxiv.org/html/2503.13657v3)), and Anthropic warns that role-split handoffs lose context ([Claude, 23 January 2026](https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them)).

[INFERENCE] The proposed routing rule is below. It mirrors the incident rule that only one group changes the system ([Google SRE book, chapter 14](https://sre.google/sre-book/managing-incidents/)).

| Situation | Route | Condition | Basis |
|---|---|---|---|
| New work for another department | Manager-to-manager, through the receiving department's intake | Always | [INFERENCE] |
| Anything that changes another department's priorities | Manager-to-manager | Always | [INFERENCE] |
| Anything touching a human-approval class in section 8 | Manager-to-manager, then the human gate | Always | [INFERENCE] |
| Anything ambiguous in scope, owner or risk class | Manager-to-manager | Always | [INFERENCE] |
| Clarification question on an accepted task | Worker-to-worker | Only inside an already-accepted task with a shared task or context ID; thread logged to the task record | [INFERENCE]; context ID concept from [A2A key concepts](https://a2a-protocol.org/latest/topics/key-concepts/) |
| Exchange of artefacts on an accepted task | Worker-to-worker | Same condition; artefacts passed by reference | [INFERENCE]; references from [Anthropic, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system) |
| Where the right receiving agent is identifiable from the request itself | A deterministic dispatcher may route without a model deciding | Request type matches a catalogue entry | Sourced: [Microsoft, updated 12 Feb 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns); application to departments is inference |

### 7.2 Proposed handoff message template (editable proposal)

[INFERENCE] The proposed handoff message template for inter-department requests combines Anthropic's four delegation elements ([Anthropic, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system)), OpenAI's schema-validated handoff input ([OpenAI Agents SDK](https://openai.github.io/openai-agents-python/handoffs/)), A2A's task and artefact objects ([A2A key concepts](https://a2a-protocol.org/latest/topics/key-concepts/)) and the DACI decision document ([Atlassian DACI play](https://www.atlassian.com/team-playbook/plays/daci)). No source publishes this template as a whole. Validate it against a schema at the receiving department's intake and reject incomplete requests with a reason code.

| Field | What to put in it | Derived from |
|---|---|---|
| Requester and decision owner | Sending department, sending agent, and the one accountable decider | [INFERENCE]; single approver from [Atlassian DACI](https://www.atlassian.com/team-playbook/plays/daci) |
| Objective and why | The outcome wanted and the decision or goal it serves | [INFERENCE]; objective from [Anthropic, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system) |
| Definition of done and acceptance criteria | Testable criteria the receiver and an independent verifier can check | [INFERENCE]; criteria-based verification from [Claude, 23 Jan 2026](https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them) |
| Deliverable format | The artefact type, structure and where it must be stored | [INFERENCE]; output format from [Anthropic, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system) |
| Scope boundaries and what not to do | Explicit exclusions and limits of the task | [INFERENCE]; task boundaries from [Anthropic, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system) |
| Inputs as artefact references | Links or IDs of versioned artefacts, not pasted summaries | [INFERENCE]; references from [Anthropic, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system) |
| Constraints | Budget, deadline, permissions, data classification | [INFERENCE] |
| Decisions already made and assumptions | What is settled and what the sender is assuming | [INFERENCE]; implicit-decision risk from [Cognition, 12 June 2025](https://cognition.com/blog/dont-build-multi-agents) |
| Priority or severity | Using the shared glossary of severity and priority levels | [INFERENCE]; structured priority from [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/handoffs/) |
| Approval class required | Which human gate in section 8, if any, applies | [INFERENCE] |
| Return path and escalation contact | Where the result goes and who is contacted when the time target is missed | [INFERENCE]; escalation rule from [GitLab deal desk](https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/) |
| Task ID and status | A shared task or context ID and the current status from the common vocabulary | [INFERENCE]; task and context ID from [A2A key concepts](https://a2a-protocol.org/latest/topics/key-concepts/); state names unconfirmed |

## 8. Company-wide guardrails: gates sit on tools for pay, sign, publish, deploy and grant-access

### 8.1 What published practice says about human approval

[VENDOR] [DURABLE] Published practice gives criteria and examples, not a single list. OpenAI calls for human oversight of sensitive, irreversible or high-stakes actions, with cancelling orders, authorising large refunds and making payments as examples, until reliability is established, and also when retry or failure thresholds are exceeded ([OpenAI, practical guide](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)). Anthropic's example is an expense agent that must get approval before cancelling subscriptions or downgrading tiers, and it requires approval before actions that modify code or systems unless persistent permission was granted ([Anthropic framework, 4 August 2025](https://www.anthropic.com/news/our-framework-for-developing-safe-and-trustworthy-agents)). Google Cloud's checkpoints are approving large financial transactions, validating sensitive summaries and releasing a redacted dataset ([Google Cloud, last reviewed 28 May 2026](https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system)).

[DURABLE] Two design rules for gates are sourced. Microsoft advises scoping mandatory gates to sensitive tool invocations so that low-risk actions proceed autonomously, and persisting state at the gate ([Microsoft, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)). OWASP advises requiring human approval for high-impact actions and enforcing authorisation in downstream systems instead of trusting the model's own judgement ([OWASP LLM06:2025](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)).

[DURABLE] Legal status: GDPR article text read on gdpr-info.eu, not checked on EUR-Lex; orientation and not professional advice. Two GDPR provisions create human gates directly. Article 22 restricts solely automated decisions with legal or similarly significant effects on individuals, with a right to human intervention where such decisions are permitted ([GDPR Article 22](https://gdpr-info.eu/art-22-gdpr/)). Article 12 requires reasoned notice within one month when a data-subject request is refused or extended, with the controller bearing the burden of proof for "manifestly unfounded" ([GDPR Article 12](https://gdpr-info.eu/art-12-gdpr/)).

[FAST-MOVING, read November 2026] Legal status: secondary source only; the dates are unverified against the Official Journal; orientation and not professional advice. EU AI Act Article 14, for high-risk systems, requires that overseers can understand the system's limits, watch for automation bias, interpret output, override or reverse it, and halt the system. The third-party explainer page states application from **2 December 2027** for Annex III systems and **2 August 2028** for Annex I systems ([artificialintelligenceact.eu, Article 14](https://artificialintelligenceact.eu/article/14/)). Those dates appear to reflect a 2026 postponement and must be verified. Whether any of this company's agent uses are high-risk was not assessed, and the classification of HR-related AI uses was not checked against Annex III.

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] Human commercial practice at GitLab already gates the same categories: non-standard deal terms need approval, deal contingencies need executive approval, and custom statements of work need a named finance executive's signature ([GitLab deal desk](https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/)).

[CONTESTED] Blanket human approval of production changes conflicts with the evidence. DORA finds external approval bodies slow delivery without reducing failure rates and recommends peer review plus automation with extra scrutiny only for flagged high-risk changes ([DORA, read November 2026](https://dora.dev/capabilities/streamlining-change-approval/)), and ITIL 4 as described by Atlassian pre-approves standard changes ([Atlassian, read November 2026](https://www.atlassian.com/itsm/change-management)). The vendor agent guidance, by contrast, defaults to approval before any system-modifying action unless persistent permission is granted ([Anthropic framework, 4 August 2025](https://www.anthropic.com/news/our-framework-for-developing-safe-and-trustworthy-agents)). The proposal resolves this by risk-tiering: pre-approved standard changes run autonomously, high-risk changes are gated.

### 8.2 Proposed list of cross-department actions that always need human approval (editable proposal)

[INFERENCE] [GAP] No source gives a definitive, enumerated list of actions that always require human approval in an AI-agent-run company. The list below is the researchers' inference from the criteria and examples in 8.1. No monetary thresholds from published authority matrices were obtained, so every limit must be set locally by the owner.

| Category | Actions that always need a human | What may be delegated | Basis |
|---|---|---|---|
| Spending | Any payment release; a new recurring commitment; budget reallocation; refunds or credits above a set limit; cancelling or downgrading paid subscriptions | Refunds and credits under the locally set limit | [INFERENCE]; examples from [OpenAI guide](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf), [Anthropic framework](https://www.anthropic.com/news/our-framework-for-developing-safe-and-trustworthy-agents) and [Google Cloud](https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system) |
| Contracts | Signing or accepting any contract; an order form with non-standard terms; a data processing agreement, NDA or vendor terms; price locks; discounts beyond policy; non-standard payment terms | Standard quotes within policy | [INFERENCE]; pattern from [GitLab deal desk](https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/) |
| External communications | Press and public statements; incident communications beyond templated status updates; regulatory or authority correspondence; legal notices to customers; novel marketing claims (comparative, quantitative, security or compliance claims); first use of a new brand asset | Routine templated replies and templated status updates | [INFERENCE]; risk-tiering from [Microsoft](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) |
| Production changes | High-risk or irreversible changes: data migrations, deletions, schema-destructive changes, access-control or security configuration, infrastructure with cost impact, emergency changes | Standard pre-approved changes with automated checks and peer review | [INFERENCE]; [DORA](https://dora.dev/capabilities/streamlining-change-approval/) and [Atlassian on ITIL 4](https://www.atlassian.com/itsm/change-management) |
| Personnel decisions | Hiring, termination, compensation, performance ratings, disciplinary matters; provisioning or retiring agents with privileged access | None in this category | [INFERENCE]; logic from [GDPR Art. 22](https://gdpr-info.eu/art-22-gdpr/) |
| Legal positions | Any statement of the company's legal position; admissions of liability; settlement; refusal or extension of a GDPR request; breach-notification decisions; risk acceptance | None in this category | [INFERENCE]; refusal and extension from [GDPR Art. 12](https://gdpr-info.eu/art-12-gdpr/) |
| Data access | Granting an agent or department access to a new class of personal or confidential data; bulk export of customer data; cross-department sharing of personal data beyond the original purpose; releasing datasets externally; changes to retention or deletion | Access already granted within the original purpose | [INFERENCE]; dataset release from [Google Cloud](https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system) |
| Agent-system changes | Changing permission boundaries, system prompts or policies of manager agents, approval thresholds, or audit-log settings | None in this category | [INFERENCE]; least privilege from [OWASP LLM06:2025](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) |

[INFERENCE] Four situations should also escalate to a human regardless of category: an agent exceeds its retry or iteration limits; two departments still disagree after one manager-to-manager round; a verifier and a producer still disagree after the iteration cap; or an action's risk class is unclear. The first is supported by OpenAI's failure-threshold rule ([OpenAI, practical guide](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)) and the third by Microsoft's iteration cap ([Microsoft, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)); the rest is inference.

[INFERENCE] Gates should be attached to tools (payment, sign, deploy, publish, grant-access) and not to conversation outputs. Each approval should be logged with the approver's identity, the task ID and the version of the artefact approved. To counter automation bias in approvers, which EU AI Act Article 14 names ([artificialintelligenceact.eu, secondary source](https://artificialintelligenceact.eu/article/14/)), show the approver the verifier's findings and the diff, not only a recommendation.

### 8.3 Proposed three-tier guardrails for all department agents (editable proposal)

[INFERENCE] The table below condenses the company-wide guardrails into the three tiers the knowledge base uses: what agents may do alone, what needs human approval, and what they must never do. The first two tiers restate 8.2 and the routing rule in 7.1. The "never" tier is the researchers' inference drawn from the cited principles in each row; no source enumerates it.

| Tier | Rule | Basis |
|---|---|---|
| May do alone | Work inside the department's own scope in 1.3 with the department's own tools | [INFERENCE] |
| May do alone | Send, accept or reject a cross-department request through intake using the template in 7.2, with a reason code on rejection | [INFERENCE]; reason codes from [GitLab lead lifecycle](https://handbook.gitlab.com/handbook/marketing/marketing-operations/lead-lifecycle/) |
| May do alone | Execute pre-approved standard changes with automated checks and peer review | [INFERENCE]; [DORA](https://dora.dev/capabilities/streamlining-change-approval/) |
| May do alone | Send routine templated replies and templated incident status updates | [INFERENCE]; risk-tiering from [Microsoft](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) |
| May do alone | Read data already granted to the department; worker-to-worker clarification inside an accepted task, logged to the task record | [INFERENCE]; read-only default from [Anthropic framework](https://www.anthropic.com/news/our-framework-for-developing-safe-and-trustworthy-agents) |
| Needs human approval | Every action in the eight categories of 8.2, and the four escalation situations beneath it | [INFERENCE] |
| Must never do | Change its own or another agent's permissions, manager-agent prompts or policies, approval thresholds or audit-log settings | [INFERENCE]; [OWASP LLM06:2025](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) |
| Must never do | Treat its own judgement as authorisation; authorisation is enforced in the downstream system | [INFERENCE]; [OWASP LLM06:2025](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) |
| Must never do | Make a solely automated decision with legal or similarly significant effect on a person | [INFERENCE]; [GDPR Art. 22](https://gdpr-info.eu/art-22-gdpr/) (article text read on gdpr-info.eu) |
| Must never do | Commit another department to specific work or promise a customer something on another department's behalf | [INFERENCE]; [GitLab transition](https://handbook.gitlab.com/handbook/customer-success/pre-sales-post-sales-transition/) |
| Must never do | Change production during an incident unless it belongs to the operations group under the incident commander | [INFERENCE]; [Google SRE ch. 14](https://sre.google/sre-book/managing-incidents/) |
| Must never do | Write to an artefact owned by another department, or to mutable state shared with concurrent agents | [INFERENCE]; [Microsoft](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) |
| Must never do | Invent an explanation for a metric movement, or recompute a metric in place of citing the catalogue | [INFERENCE]; [Commoncog WBR](https://commoncog.com/the-amazon-weekly-business-review/) |
| Must never do | Assume a sent request was accepted, or declare a task verified after a partial check | [INFERENCE]; [Google SRE ch. 14](https://sre.google/sre-book/managing-incidents/) and [Claude, 23 Jan 2026](https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them) |
| Must never do | Rely on a secondary or unverified legal point in this document to gate a live decision without confirmation | [INFERENCE] |

## 9. Sweden and EU specifics: three legal anchors verified, the Swedish layer not researched

[DURABLE] General practice that fits any company makes up almost all of this document: single-owner decision rights, artefact-based handoffs with acceptance, risk-tiered change approval, the weekly metrics review and the multi-agent guidance apply regardless of country. The points specific to a Sweden-based SaaS company selling in the EU are few, and the notes verify only the EU-level ones.

[DURABLE] Legal status: article text read on gdpr-info.eu, not checked on EUR-Lex; orientation and not professional advice. Three GDPR provisions shape the cross-department design for an EU seller: the one-month response clock for data-subject requests with a two-month extension under Article 12 ([GDPR Article 12](https://gdpr-info.eu/art-12-gdpr/)), the impact-assessment duty before high-risk processing under Article 35 ([GDPR Article 35](https://gdpr-info.eu/art-35-gdpr/)), and the restriction on solely automated decisions with significant effects under Article 22 ([GDPR Article 22](https://gdpr-info.eu/art-22-gdpr/)). They drive the Support-to-Legal intake in 4.9, the Product-to-Legal screening in 4.3 and the personnel gate in 8.2.

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] The only EU tax-related item in the notes is a company practice, not a legal source: GitLab requires a VAT ID from EU customers before booking a deal ([GitLab deal desk](https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/)). Adopt the check as a booking acceptance criterion and have Finance confirm the underlying VAT rules with a qualified adviser. Legal status of the underlying rules: unverified, not researched.

[GAP] Legal status: unverified, not researched; orientation and not professional advice. The following Sweden-specific points were not researched and nothing about them should be taken from this document: IMY guidance on access requests; Swedish bookkeeping retention rules; annual-report filing; Swedish VAT invoicing rules; co-determination and employment law (MBL, LAS); who may bind the company (firmatecknare); liability for marketing claims under Marknadsföringslagen and consumer-agency guidance. These affect record-to-report, hire-to-retire, the GDPR request flow, the contract-signing gate and the claims-review trigger, and each needs a dedicated legal source check. GDPR breach-notification timing under Article 33 was also not fetched and is not cited.

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
