---
id: shared.processes.end-to-end-processes
department: shared
domain: processes
title: 'Shared: End-to-end processes'
summary: 'Eight end-to-end processes mapped step by step to departments: lead-to-cash, idea-to-launch, issue-to-resolution, incident-to-postmortem, hire-to-retire (including provisioning and retiring agents), procure-to-pay, record-to-report and a GDPR data-subject request.'
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
- https://www.forgov.qld.gov.au/__data/assets/pdf_file/0027/319842/apqc_pcf_ver_6.1.1-final.pdf
- https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/
- https://handbook.gitlab.com/handbook/marketing/marketing-operations/lead-lifecycle/
- https://handbook.gitlab.com/handbook/customer-success/pre-sales-post-sales-transition/
- https://commoncog.com/working-backwards/
- https://www.atlassian.com/agile/project-management/definition-of-ready
- https://sre.google/sre-book/evolving-sre-engagement-model/
- https://www.pragmaticinstitute.com/blog/post/prioritize-product-launch-resources-with-launch-tiers
- https://gdpr-info.eu/art-35-gdpr/
- https://dora.dev/capabilities/streamlining-change-approval/
- https://handbook.gitlab.com/handbook/product-development/how-we-work/issue-triage/
- https://sre.google/sre-book/managing-incidents/
- https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/incident-management/
- https://sre.google/sre-book/postmortem-culture/
- https://gdpr-info.eu/art-22-gdpr/
- https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
- https://commoncog.com/the-amazon-weekly-business-review/
- https://gdpr-info.eu/art-12-gdpr/
related:
- shared.handoffs.handoff-catalogue
- shared.guardrails.company-wide-guardrails
cross_refs:
  '8':
  - shared.guardrails.company-wide-guardrails
seed_version: 1
---

**When to use this:** When a piece of work is one step of a longer company process: which department does each step, and where the human approval gates (H) sit.

**Source section:** 4. Eight end-to-end processes, mapped step by step to departments

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
