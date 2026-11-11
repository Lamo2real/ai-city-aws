---
id: research.handoffs.handoffs-with-other-departments
department: research
domain: handoffs
title: 'Research: Handoffs with other departments'
summary: What Research receives from and hands over to each department, the commissioner and analyst roles, and three handoff rules (personal data, publication, interviews kept apart from selling).
type: playbook
audience: both
confidence: inference
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms: []
objectives:
- communication
sources: []
related:
- research.guardrails.agent-guardrails
- research.design.research-design
cross_refs:
  '1':
  - research.design.research-design
  '5.4':
  - research.competitive-intelligence.competitive-intelligence
  '8.2':
  - research.reporting.reporting
  '14':
  - research.compliance.personal-data-in-research
seed_version: 1
---

**When to use this:** When passing work to or requesting work from another department: what Research receives and hands over, and the three handoff rules.

**Source section:** 19. Handoffs with other departments

## 19. Handoffs with other departments

[INFERENCE] The handoff model below is the report writer's inference; the research notes contain no sourced material on inter-department handoffs. Its anchor is the Aqua Book role model from section 1: the requesting department is the commissioner and signs the specification, and the Research department is the analyst and returns findings with limits of use and a sunset date. Every inbound request should state the decision, its owner and the date it is needed; every outbound deliverable should carry the likelihood scale, confidence statements, the "not verified" list and the AI-use disclosure.

| Label | Department | Research receives | Research hands over |
|---|---|---|---|
| [INFERENCE] | IT infrastructure | Approved tool list, outbound-domain restrictions, API keys and shared IP rate budgets, incident route for prompt-injection events | Tool and data-source requirements, logs of suspected injection or blocked access |
| [INFERENCE] | Marketing | Questions on segments, messaging, competitor positioning; campaign results as evidence | Market and audience findings, competitor profiles, sourced statistics cleared for external use after human approval |
| [INFERENCE] | Application | Questions on technology choices and third-party components | Technology-scouting notes with TRL and evidence, licence and patent flags |
| [INFERENCE] | Data and AI | Internal datasets, model and retrieval support, evaluation help | Data-quality findings, source snapshots with queries, verification results on agent output |
| [INFERENCE] | Finance | Requests for market sizing, forecasts and investor figures; internal financial data under confidentiality | Sized ranges with assumptions log and sensitivity analysis; forecasts with reference class and probability |
| [INFERENCE] | Sales | Win/loss candidates, CRM records, field observations about competitors | Battlecards with evidence links and review dates, win/loss synthesis with coverage stated |
| [INFERENCE] | Customer Support | Ticket themes and customer language as non-research input to the repository | Customer-research findings, interview themes with participant counts |
| [INFERENCE] | Legal | Rulings on stop-and-escalate items, tool contracts, ethics-review and GDPR questions, sign-off on legal statements | Escalations with logs, legal-status tracking with verification labels, never legal conclusions |
| [INFERENCE] | Media | Requests to fact-check content and source statistics | Verified claims with primary sources and dates, quotation and originality checks |
| [INFERENCE] | Operations | Process and vendor questions | Vendor and benchmark research with source-quality ratings |
| [INFERENCE] | Product | Pricing, concept and feature-priority questions; usage data | Customer and pricing research, competitor feature tracking, scenario and forecast inputs |
| [INFERENCE] | Research (internal) | Worker findings in the agreed output schema | Manager briefs; verifier reports; repository entries |

[INFERENCE] Three handoff rules follow from sourced material elsewhere in this document. Personal data from Sales or Customer Support enters research only for the stated purpose and with minimisation (section 14). Material another department wants to publish needs the human-approval gate and the ICC/ESOMAR Article 9 disclosures (section 8.2). And research interviews with customers stay separate from selling, so a handoff to Sales after an interview needs the participant's fresh consent (section 5.4).
