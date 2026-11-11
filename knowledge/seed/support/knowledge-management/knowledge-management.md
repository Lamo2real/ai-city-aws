---
id: support.knowledge-management.knowledge-management
department: support
domain: knowledge-management
title: 'Customer support: Knowledge management'
summary: KCS (knowledge as a by-product of solving), the Evolve Loop for the manager agent, article structure, confidence, audience and governance attributes, who may validate and publish, the 90/0 publishing goal and the 13-element content standard.
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- resolution
sources:
- https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030
- https://library.serviceinnovation.org/KCS/KCS_Resources/New_in_Knowledge-Centered_Success
- https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030/040/010/020
- https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030/040/010/040
- https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030/040/010/030
related:
- support.ai-support.ai-led-support-and-limits
- support.agent-guardrails.ai-agent-guardrails
seed_version: 1
cross_refs:
  '25':
  - support.compliance.ai-disclosure-and-liability
---

**When to use this:** When writing, validating or publishing help articles and saved replies.

**Source section:** 15. Knowledge management

### KCS: knowledge is a by-product of solving

[DURABLE] Knowledge-Centered Service (KCS v6, Consortium for Service Innovation) holds that knowledge is captured as a by-product of the interaction and improved on demand through use, not through a separate up-front authoring project. The Solve Loop has four practices: Capture (in the moment, in the requestor's context, with searching treated as part of creating), Structure (a simple template; complete thoughts, not complete sentences), Reuse (search early and often, link), and Improve (reuse is review; flag it or fix it) ([KCS v6 Practices Guide](https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030)). The Consortium has since renamed the methodology "Knowledge-Centered Success" in a newer guide whose differences were not checked ([Consortium library](https://library.serviceinnovation.org/KCS/KCS_Resources/New_in_Knowledge-Centered_Success)).

### The Evolve Loop belongs to the manager agent

[DURABLE] The Evolve Loop has four practices: Content Health (article structure and state, content standard, archiving, knowledge domain analysis, self-service success and measures), Process Integration (structured problem solving, closed-loop feedback, process adherence review), Performance Assessment (roles and licensing, coaching, value creation), and Leadership and Communication ([KCS v6 Practices Guide](https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030)). [INFERENCE] In an AI-led department worker agents do Solve Loop tasks (every resolved conversation triggers search, then reuse or create or flag) and the manager agent owns Evolve Loop tasks.

### Article structure

[DURABLE] A KCS article has the fields issue, environment, resolution, cause and metadata. An internal-resolution field can hold content hidden from customers on an otherwise external article; if the tool cannot do this, keep a separate linked internal-only article ([KCS v6, Technique 5.1](https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030/040/010/020); [Technique 5.3](https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030/040/010/040)).

### Three article attributes: confidence, audience, governance

[DURABLE] KCS v6 gives every article three attributes, set out below.

| Attribute | Values and meaning | Source |
|---|---|---|
| Confidence | Work in Progress (problem captured, no resolution yet; temporary). Not Validated (has a resolution but low confidence through lack of feedback, little reuse or non-compliance with the content standard). Validated (complete, reusable, compliant, and confirmed by the customer, reproduction or experience). Archived (removed from search without deletion so old links survive; restorable). | [KCS v6, Technique 5.2](https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030/040/010/030) |
| Audience | Internal; Within a Domain (a product, topic or department group); Partners; Customers (registered users via a portal); Public (indexed by search engines). Anything beyond Internal counts as External. | [KCS v6, Technique 5.2](https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030/040/010/030) |
| Governance | Experience Based (many signed-in members may create and modify, with rights by licence level). Compliance Based (policy, regulatory or legal content; only designated people may create or change, everyone may comment). | [KCS v6, Technique 5.2](https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030/040/010/030) |

### Who may validate and publish

[DURABLE] Rights follow role: a KCS Candidate creates and modifies only Not Validated articles under coach review; a Contributor may validate; a Publisher may also modify Validated articles and decide on moving them to External audiences; Coaches and Knowledge Domain Experts may validate ([KCS v6, Technique 5.2](https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030/040/010/030)). [INFERENCE] Policy, pricing, refund and legal articles should be Compliance Based so that only named human owners can change them, and an AI agent should answer customers only from Validated articles with a Customers or Public audience, treating Not Validated content as internal hints. This matters more because of the chatbot liability decisions in section 25.

### Speed of publishing: the 90/0 goal

[DURABLE] The KCS "90/0" goal is that 90% of what the team learns is in the knowledge base at or before case closure. Mature teams publish most new articles as Validated and External straight away; a transitional "conveyor belt" option makes an article External five days after its third internal reuse unless someone objects; and knowledge is said to lose value about 30 days after an issue first appears ([KCS v6, Technique 5.2](https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030/040/010/030)). The page does not say "90% within 90 minutes", a common misquote.

### The 13-element content standard

[DURABLE] The KCS content standard has 13 elements: article structure with field definitions; good and bad examples; metadata definitions; confidence; audience; governance; templates and when to use each; a style guide; rules for supporting material and links; vocabulary (preferred terms, product names, versions); multi-language guidance (write for translation, international English); multimedia criteria; and a one-page quick reference guide. The knowledge workers who use the content daily own the standard, designed by a cross-functional team, and about 70 to 80% of a standard is common across an organisation with 20 to 30% tailored to a domain ([KCS v6, Technique 5.3](https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030/040/010/040)). [INFERENCE] The multi-language element is the natural place to set the Swedish and English rules for a bilingual help centre.

### What was not found on knowledge management

[GAP] The KCS Content Standard Checklist criteria, the Article Quality Index, sampling rules for article review, the self-service success measures and the "UFFA" (use it, flag it, fix it, add it) wording were not opened or verified.
