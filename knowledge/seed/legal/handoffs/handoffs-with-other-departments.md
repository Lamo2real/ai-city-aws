---
id: legal.handoffs.handoffs-with-other-departments
department: legal
domain: handoffs
title: 'Legal: Hand-offs with the other departments'
summary: 'Hand-offs between Legal and the other departments: for each department what Legal receives, what it hands back and
  the mandatory triggers, plus the two cross-department rules (always state the verification status; silence from Legal is
  never approval). Orientation as of 11 November 2026, not legal advice.'
type: playbook
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives: []
sources: []
related:
- legal.guardrails.agent-guardrails
seed_version: 1
cross_refs:
  '2':
  - legal.contracts.saas-and-commercial-contracts
  '3':
  - legal.consumer.consumer-facing-terms
  '4':
  - legal.contracts.routine-documents
  '5':
  - legal.contracts.ai-contract-terms
  '6':
  - legal.corporate.corporate-law
  '7':
  - legal.ip.intellectual-property
  '8':
  - legal.employment.employment-law
  '9':
  - legal.disputes.disputes-and-enforcement
  '10':
  - legal.privacy.privacy-gdpr-imy
  '11':
  - legal.ai-regulation.eu-ai-act-and-swedish-supervision
  '12':
  - legal.digital-regulation.digital-and-data-regulation
  '13':
  - legal.marketing-sector.marketing-regulation-and-sector-add-ons
  '14':
  - legal.financial-crime.sanctions-export-aml-bribery-competition
  '15':
  - legal.compliance-programme.corporate-compliance-programme
  '18':
  - legal.guardrails.agent-guardrails
---

**When to use this:** When passing work to or receiving work from another department (IT infrastructure, Marketing, Application, Data and AI, Finance, Sales, Customer Support, Media, Operations, Product, Research) or the human lawyer.

**Source section:** 19. Hand-offs with the other departments

### How to read this section

**[INFERENCE]** The research did not source any model for inter-departmental hand-offs, so everything in this section is the researchers' inference from the legal findings in the earlier sections. Each row says what Legal receives, what Legal hands back, and the trigger that makes the hand-off mandatory. "Legal" in the department list refers to this department itself; the row for it covers hand-offs between its own agents and the human lawyer or external counsel.

| Department | Legal receives | Legal hands back | Mandatory triggers | Basis |
|---|---|---|---|---|
| IT infrastructure | Incident and vulnerability reports with an awareness timestamp; architecture, hosting-location and sub-processor changes; logs for legal holds | Classification of the incident and the running clocks; draft regulator and customer notices for human approval; security-annex and DPA requirements; legal-hold instructions | Any suspected breach or significant incident; new vendor with data access; new region or US vendor | Sections 10, 12, 15 |
| Marketing | Campaign copy, claims, discount mechanics, testimonials and logos, e-mail audiences, cookie and tracking plans | Cleared or amended copy; substantiation-file requirements; consent and opt-out requirements; a flag where a human must decide | Discount, comparative, environmental or AI-performance claims; e-mail to individuals without prior sale; any new tracking technology | Sections 10, 13 |
| Application | Feature plans touching user content, sign-up and checkout flows, open-source components, shipped clients or SDKs | Terms-of-use and acceptable-use requirements; DSA notice and statement-of-reasons templates; consumer checkout checklist; open-source licence review | Consumer-facing purchase flow; AGPL or other copyleft component; downloadable component; user-content storage or sharing | Sections 3, 4, 12 |
| Data and AI | AI inventory entries, model and vendor choices, training-data sources, scraping plans, new AI features | Role classification proposal for human sign-off; Article 50 controls; flow-down terms from model vendors; text-and-data-mining conditions; DPIA trigger | Any new AI feature; training on customer data; scraping; Annex III use case; image or video generation | Sections 5, 7, 10, 11 |
| Finance | Aged receivables, management accounts, payment-counterparty data, option and issue plans, insurance renewals | Reminder and demand drafts; limitation and claim-window calendar; control-balance-sheet alert; screening results; corporate documents for human approval | Equity approaching half of registered share capital; debt approaching limitation; third-party or third-country payment; share or option issue | Sections 6, 9, 14 |
| Sales | Deal requests, counterparty paper, redlines, reseller and partner proposals, customer sector and country | Template contracts; issues list against the playbook; approved fallbacks; signature-authority check; escalation where beyond fallback | Uncapped liability, exclusivity, most-favoured-customer or resale-price terms; regulated-sector or public buyer; sanctions-sensitive country; consumer buyer; gifts or hospitality in a tender | Sections 2, 3, 4, 13, 14 |
| Customer Support | Data-subject requests, complaints, withdrawal and cancellation requests, content notices, suspension decisions, threats of legal action | Request tracker with the one-month clock; response templates; statement-of-reasons text; escalation of disputes | Any data-subject request; any notice of illegal content; any consumer withdrawal; any threatened claim or regulator mention | Sections 3, 4, 9, 10 |
| Legal (human lawyer and external counsel) | Escalation packages from the manager agent; drafts for sign-off | Decisions, signed approvals, corrections to playbooks and to this knowledge base | Every item in the "needs human approval" tier; every "must never do" item that the business still requires | Section 18 |
| Media | Content plans using third-party works, AI-generated images, video or text, synthetic voices or likenesses | Rights and licence check; labelling requirements for synthetic content; consent requirements for persons depicted | Deepfake-type content; public-interest text generated by AI; use of works under a rights reservation; real persons' likeness | Sections 7, 11 |
| Operations | Vendor onboarding requests, contractor and consultant engagements, office and travel arrangements, policy roll-outs | Vendor due-diligence checklist; consultancy template; contractor-status screen; policy texts and training records | Vendor processing personal data; consultant integrated like an employee; agent or intermediary dealing with customers | Sections 4, 8, 14, 15 |
| Product | Roadmap items, pricing and packaging changes, term and renewal mechanics, exit and export features | Data Act switching requirements; consumer renewal and price-term rules; product-liability and accessibility flags; contract-template updates | Fixed terms, exit fees or notice above two months; auto-renewal for consumers; material service change; software with safety or data-loss impact | Sections 2, 3, 12 |
| Research | Source lists, competitor and market research plans, scraping or data-collection methods, survey designs | Lawful-access and rights-reservation conditions; privacy basis for personal data; limits on competitor contact and information exchange | Scraping; collection of personal data; any contact with competitors; use of leaked or confidential material | Sections 7, 10, 14 |

**[INFERENCE]** Two hand-off rules apply across all departments. First, Legal's output to another department always states the verification status of the legal point it relies on, so that a department does not treat an unverified pointer as a clearance. Second, no department's agent treats silence from Legal as approval; an item in the "needs human approval" tier stays blocked until a named human has signed.
