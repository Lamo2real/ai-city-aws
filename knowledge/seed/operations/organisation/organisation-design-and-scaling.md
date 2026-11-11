---
id: operations.organisation.organisation-design-and-scaling
department: operations
domain: organisation
title: 'Operations: Organisation design and scaling'
summary: 'Organisation design and scaling: span of control depends on how standardised the work is, asynchronous work and
  documentation, Swedish duty to negotiate before reorganising, and AI and organisational strain.'
type: principle
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- scale
- people
sources:
- https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/how-to-identify-the-right-spans-of-control-for-your-organization
- https://handbook.gitlab.com/handbook/company/culture/all-remote/asynchronous/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1976580-om-medbestammande-i-arbetslivet_sfs-1976-580/
- https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
related: []
seed_version: 1
---

**When to use this:** When designing teams, spans of control, async and documentation habits, or a reorganisation (negotiate under MBL first).

**Source section:** 10. Organisation design and scaling

### Span of control depends on how standardised the work is

**[DURABLE]** McKinsey's 2017 framework gives five managerial archetypes with typical spans: player/coach 3 to 5 direct reports; coach 6 to 7; supervisor 8 to 10; facilitator 11 to 15; coordinator 15 or more. The criteria for choosing the archetype are the share of the manager's time spent on own work, how standardised the process is, how similar the direct reports' work is, and how much experience the work needs and how long it takes to become self-sufficient (several years for player/coach teams, a couple of weeks for coordinator teams). The source is a consultancy article dated 21 December 2017 ([McKinsey, How to identify the right spans of control](https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/how-to-identify-the-right-spans-of-control-for-your-organization)).

**[INFERENCE]** When to add a management layer: when a manager's span exceeds the archetype range for the kind of work for more than a quarter, or when the manager is the constraint and decisions queue behind one person. For a founder-led SaaS team doing varied, non-standard work, the player/coach range of 3 to 5 is the relevant ceiling before a lead is needed.

**[INFERENCE]** A manager agent supervising worker agents maps to the same logic: highly standardised, checklist-driven worker tasks permit a wide span, while novel, judgement-heavy tasks need a narrow span and more human review. This is an analogy, not a sourced finding.

**[INFERENCE]** Functional structure suits small companies because expertise and ownership are clear; add cross-functional squads only around a specific outcome with one accountable owner. No evidence comparing functional and cross-functional structures was retrieved.

### Asynchronous work and documentation

**[PLATFORM CLAIM]** GitLab's handbook states its asynchronous principle as doing as much as possible with what one has, documenting everything, handing off ownership and moving on. Documentation makes asynchronous work possible because readers need a written source they can consult without waiting. Its pre-send checks for a message are the right format, a recipient who has the context, a clear and considerate text that includes resources or next steps, and documentation for later retrieval ([GitLab Handbook, Asynchronous work](https://handbook.gitlab.com/handbook/company/culture/all-remote/asynchronous/)).

**[PLATFORM CLAIM]** GitLab lists the situations that justify a synchronous meeting: urgent incidents, troubleshooting, asynchronous discussion that has stalled or where people talk past each other, creative brainstorming and early design, highly technical topics, relationship building and periodic alignment. Outcomes of synchronous discussions are still documented in the related issue. The page sets no numeric thresholds; one contributor's heuristic is to move to a call after several back-and-forths ([GitLab Handbook, Asynchronous work](https://handbook.gitlab.com/handbook/company/culture/all-remote/asynchronous/)).

**[INFERENCE]** Knowledge-management rules adapted from GitLab: one source of truth per topic; answer questions with a link and write the answer down if no link exists; every process document has an owner and a review date; decisions live in decision records, not chat.

### Swedish specifics: negotiate before reorganising

**[DURABLE]** Legal status: checked on primary source; orientation only. Under MBL 11 § an employer bound by a collective agreement must negotiate with the union on its own initiative before deciding on significant changes to operations or to members' working or employment conditions, and under 19 § such an employer keeps the union continuously informed about production, financial development and personnel-policy guidelines. An employer without any collective agreement must still keep unions that have members on staff informed on the same subjects under 19 a § ([MBL, riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1976580-om-medbestammande-i-arbetslivet_sfs-1976-580/)).

**[INFERENCE]** Before a reorganisation, outsourcing or significant automation that changes roles, check whether MBL 11 § and 38 § negotiation applies, which it does where the employer is bound by a collective agreement, and schedule it before the decision is taken and not after.

### AI and organisational strain

**[FAST-MOVING, 2026]** In McKinsey's 2026 survey, 47% of mid-level managers and individual contributors report AI-related strains against 31% of executives and senior managers; 14% say AI contributed to an overall workforce decline in the past year, and 39% expect headcount reductions over the next year ([McKinsey, The state of AI in 2026](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai)).

**[GAP]** Not retrieved: GitLab's handbook-first page, research on when to add layers beyond the 2017 article, and remote and hybrid productivity evidence for 2025 to 2026.
