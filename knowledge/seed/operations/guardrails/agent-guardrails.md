---
id: operations.guardrails.agent-guardrails
department: operations
domain: guardrails
title: 'Operations: Guardrails for the department''s AI agents'
summary: 'Guardrails for the department''s AI agents: agents prepare, humans decide; the guardrail table of what agents may
  do alone, what needs human approval (external messages, spend above limits, contracts, vendors, access, job ads, offers,
  pay, monitoring, new employee data) and what they must never do (decide about people, investigate, monitor); safeguards
  for people data and agent work.'
type: checklist
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- compliance
- people
sources:
- https://www.imy.se/verksamhet/dataskydd/dataskydd-pa-olika-omraden/arbetsliv/rekryteringssystem-och-kompetensdatabaser/
- https://artificialintelligenceact.eu/article/26/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/diskrimineringslag-2008567_sfs-2008-567/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-198280-om-anstallningsskydd_sfs-1982-80/
- https://www.imy.se/verksamhet/dataskydd/dataskydd-pa-olika-omraden/arbetsliv/tillaten-behandling--vilka-krav-galler/brottsuppgifter/
- https://www.imy.se/verksamhet/dataskydd/dataskydd-pa-olika-omraden/arbetsliv/kontroll-och-overvakning-av-anstallda/
- https://www.anthropic.com/engineering/building-effective-agents
- https://rosetta.to/u/alexhormozi/if-i-wanted-to-create-a-business-that-runs-itself-here-s-what-i-d-do
related:
- operations.ai-operations.operating-a-company-with-ai-agents
- operations.precedence.law-evidence-house-style
seed_version: 1
cross_refs:
  '3':
  - operations.precedence.law-evidence-house-style
  '12':
  - operations.ai-operations.operating-a-company-with-ai-agents
---

**When to use this:** Before any action that could need approval or is forbidden: anything external, spending, contracts, vendors, access, data deletion, SOP changes, new projects, and every step about a candidate's or employee's hiring, pay, warning, termination, data or monitoring.

**Source section:** 24. Guardrails for the department's AI agents

### The principle: agents prepare, humans decide

**[INFERENCE]** The law already draws the main line for people work: no solely automated decisions with significant effect on candidates or staff (GDPR Article 22, per IMY), and from 2 December 2027 assigned, competent human oversight plus advance notice to workers for any employment AI (AI Act Article 26). The employer's duties to investigate harassment and to show objective reasons for dismissal rest on the employer ([IMY, recruitment systems](https://www.imy.se/verksamhet/dataskydd/dataskydd-pa-olika-omraden/arbetsliv/rekryteringssystem-och-kompetensdatabaser/); [AI Act Art. 26](https://artificialintelligenceact.eu/article/26/); [Diskrimineringslagen 2 kap. 3 §](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/diskrimineringslag-2008567_sfs-2008-567/); [LAS 7 §](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-198280-om-anstallningsskydd_sfs-1982-80/)). The practical rule is that agents prepare and humans decide. The guardrails below are the researchers' synthesis; no source prescribes them for an agent department.

### Guardrail table

**[INFERENCE]** The table sorts agent actions into three classes using the reversibility tiers from section 12. All rows are inference unless a source is linked.

| Class | Business operations | People operations |
|---|---|---|
| Agents may do alone (logged, sampled review) | Read-only analysis; internal drafts; process maps, SIPOCs and SOP drafts; scorecard and status-report compilation; deadline and renewal tracking; reference-class estimates; risk-register and dependency-log upkeep; reversible internal changes with post-hoc review | Drafting role scorecards, job advertisements and structured-interview guides; scheduling; onboarding and offboarding checklists and tickets; tracking statutory deadlines (written terms by day seven, probation end, sick-leave days 8, 15, 21 and 30, permit expiries, holiday rollover); preparing pay-survey data; policy drafts |
| Needs human approval before action | External communication; any spending above the written approval limit; contract signature, renewal or termination; vendor selection; granting, changing or removing access; data deletion; changes to an approved SOP; launching a new project (a "new" in more, better, new) | Publishing a job advertisement; any message to a candidate or employee that carries a decision or adverse content; summaries of interview notes against fixed criteria before they feed a decision; offers and contract documents; changes to pay, benefits or working hours; any processing of new categories of employee data; introducing any monitoring |
| Agents must never do | Act on an unverified legal point from this document; exceed iteration or budget caps; hide or rewrite the audit log; treat a vendor's self-reported figure as verified | Decide or communicate a hire, rejection, probation outcome, pay or promotion decision, warning, dismissal or redundancy selection; run harassment or whistleblowing investigations; hold rehabilitation, sick-leave, health or misconduct conversations; negotiate with unions; score, rank or filter people without a human decision; send a rejection no human has reviewed; record criminal-record extracts or process offence data ([IMY, offence data](https://www.imy.se/verksamhet/dataskydd/dataskydd-pa-olika-omraden/arbetsliv/tillaten-behandling--vilka-krav-galler/brottsuppgifter/)); read private files or email; monitor individuals routinely ([IMY, monitoring](https://www.imy.se/verksamhet/dataskydd/dataskydd-pa-olika-omraden/arbetsliv/kontroll-och-overvakning-av-anstallda/)) |

### Safeguards around agent work on people data

**[INFERENCE]** Agent safeguards for people work: no access to health, union-membership or offence data unless strictly needed; log every agent output that feeds a people decision and who approved it; tell candidates and staff that AI is used; test outputs for skew across the seven protected grounds; write factual entries in fixed fields and avoid free-text judgments about people, in line with IMY's guidance on competence databases ([IMY, recruitment systems](https://www.imy.se/verksamhet/dataskydd/dataskydd-pa-olika-omraden/arbetsliv/rekryteringssystem-och-kompetensdatabaser/)).

**[INFERENCE]** Agent safeguards for all work, following the design guidance in section 12: a task brief with a definition of done; a check against ground truth at each step; a stopping condition and a budget per workflow; a pause for human input when blocked; and an evaluator check before hand-back ([Anthropic, Building effective agents, 19 Dec 2024](https://www.anthropic.com/engineering/building-effective-agents)).

**[HOUSE STYLE] [INFERENCE]** The house-style rule that staff get written spending and approval limits so they can act unsupervised applies to agents as well: each worker agent has a written limit, and anything above it goes to the manager agent and then to the named human approver. The specific amounts are the owner's to set; the Hormozi examples of about $500 to $100,000 are unaudited illustrations ([Rosetta transcript, 4 Nov 2025](https://rosetta.to/u/alexhormozi/if-i-wanted-to-create-a-business-that-runs-itself-here-s-what-i-d-do)).

**[INFERENCE]** Escalation rule: when the house style, the evidence and the law point in different directions, the agent follows the precedence in section 3, records the collision in the decision record and escalates anything about a person's employment, pay, data or health to the named human decider.
