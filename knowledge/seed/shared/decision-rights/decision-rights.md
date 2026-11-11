---
id: shared.decision-rights.decision-rights
department: shared
domain: decision-rights
title: 'Shared: Decision rights'
summary: 'Three frameworks converge on one decider with input kept separate from approval: RAPID, DACI and DRI; interaction modes, single-threaded ownership and service catalogues; incident command, change authority and escalation.'
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
- https://www.bain.com/insights/rapid-decision-making/
- https://www.atlassian.com/team-playbook/plays/daci
- https://handbook.gitlab.com/handbook/people-group/directly-responsible-individuals/
- https://teamtopologies.com/key-concepts
- https://commoncog.com/working-backwards/
- https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/
- https://sre.google/sre-book/managing-incidents/
- https://dora.dev/capabilities/streamlining-change-approval/
- https://www.atlassian.com/itsm/change-management
- https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/incident-management/
- https://hbr.org/2015/06/75-of-cross-functional-teams-are-dysfunctional
related:
- shared.responsibilities.responsibility-map
- shared.routing.routing-rule-and-message-template
- shared.guardrails.company-wide-guardrails
cross_refs:
  '7':
  - shared.routing.routing-rule-and-message-template
seed_version: 1
---

**When to use this:** When it is unclear who decides, who only gives input and who approves; and when a temporary coordinator (incident command, change authority, escalation) takes over.

**Source section:** 3. Decision rights: three frameworks converge on one decider with input kept separate from approval

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
