---
id: operations.risk.risk-continuity-and-quality
department: operations
domain: risk
title: 'Operations: Risk, continuity and quality'
summary: 'Risk, continuity and quality: ISO 31000 (a guideline, not certifiable), the link between improvement and a quality
  system, business continuity and crisis management, and AI risk with the EU AI Act timeline.'
type: principle
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- reliability
- compliance
sources:
- https://www.iso.org/standard/65694.html
- https://asq.org/quality-resources/dmaic
- https://www.iso.org/standard/75106.html
- https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
- https://artificialintelligenceact.eu/implementation-timeline/
- https://artificialintelligenceact.eu/article/26/
related:
- operations.projects.project-and-programme-management
seed_version: 1
cross_refs:
  '6':
  - operations.projects.project-and-programme-management
---

**When to use this:** When building a risk register, a quality system, a continuity or crisis plan, or classifying AI risk: ISO 31000, quality, business continuity and the EU AI Act timeline.

**Source section:** 9. Risk, continuity and quality

### ISO 31000 is the current risk guideline and is not certifiable

**[DURABLE]** ISO 31000:2018, "Risk management — Guidelines", is edition 2, published in February 2018 and last reviewed and confirmed in 2023; the ISO page also shows the stage "International Standard to be revised". It provides principles, a framework and a process covering identifying, analysing, evaluating, treating, monitoring and communicating risk, applies to any organisation, and is guidance and not a certifiable standard, although it can serve as an audit benchmark ([ISO 31000:2018](https://www.iso.org/standard/65694.html)).

**[INFERENCE]** A minimal risk process following the ISO 31000 verbs: establish context and risk appetite; identify; analyse likelihood and impact; evaluate against appetite; treat; monitor and review monthly; communicate to the decider. Use the register columns in section 6.

### Quality: the link between improvement and a quality system

**[DURABLE]** The Control phase of DMAIC calls for mistake-proofing, long-term measurement, reaction plans and standard operating procedures, which is the practical link between improvement work and a quality system ([ASQ, DMAIC](https://asq.org/quality-resources/dmaic)).

**[INFERENCE]** Quality management in a small SaaS company: adopt the logic usually associated with ISO 9001 (documented processes with owners, measurement, internal review, corrective action) without certification unless customers demand it. This is the researchers' outline and was not verified against the ISO 9001 text.

**[GAP]** ISO's pages for ISO 9001 and ISO 22301 refused to load on two attempts. The current edition and revision status of ISO 9001, including whether a new edition was published in 2026, and the edition, amendments and status of ISO 22301 are unverified; do not assume. A national standards body such as SIS or BSI, or ASQ, is the place to check ([ISO page for ISO 22301, not loaded](https://www.iso.org/standard/75106.html)).

### Business continuity and crisis management

**[INFERENCE]** Business-continuity starter kit, a structure by the researchers that was not verified against ISO 22301: a business impact analysis listing critical processes with maximum tolerable downtime, recovery time objective and recovery point objective; dependencies on people, vendors and systems; continuity strategies; incident response roles and a contact tree; communication templates; an exercise at least annually; and a post-incident review.

**[INFERENCE]** Crisis management outline: severity levels with a named incident lead; a first-hour checklist; a single internal channel and a single external spokesperson; a decision log with timestamps; customer and regulator notification triggers, for GDPR and any NIS2 duty; stand-down criteria; and a blameless review within five working days.

### AI risk and the EU AI Act timeline

**[FAST-MOVING, 2026]** In McKinsey's 2026 survey, AI high performers are much more likely than others to work on mitigating risks such as unauthorised or unintended agent actions and exploitation of AI-driven vulnerabilities; the page gives no percentages ([McKinsey, The state of AI in 2026](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai)).

**[FAST-MOVING, Aug 2026]** Legal status: dates read on a non-official tracker of the AI Act (page updated 31 August 2026) and on its consolidated Article 113 text; the amending regulation itself was not read; orientation only. Prohibited practices and AI-literacy duties have applied since 2 February 2025 and general-purpose model rules and governance since 2 August 2025. High-risk rules for Annex III systems apply from 2 December 2027 and for Annex I product systems from 2 August 2028. Generative systems already on the market must comply with the marking duty in Article 50(2) by 2 December 2026 ([EU AI Act implementation timeline](https://artificialintelligenceact.eu/implementation-timeline/); [AI Act Art. 26 page showing Art. 113 dates](https://artificialintelligenceact.eu/article/26/)). Section 21 gives the detail that matters for people decisions.

**[GAP]** Not retrieved: crisis-management standards such as ISO 22361, COSO enterprise risk management, IMY breach-notification practice and Swedish civil-contingency guidance.
