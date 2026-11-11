---
id: shared.routing.routing-rule-and-message-template
department: shared
domain: routing
title: 'Shared: Routing rule and handoff message template'
summary: 'New work goes manager-to-manager, workers talk only inside an accepted task: the routing table and the twelve fields of the handoff message template (editable proposal).'
type: checklist
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- handoffs
sources:
- https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/
- https://arxiv.org/html/2503.13657v3
- https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them
- https://sre.google/sre-book/managing-incidents/
- https://a2a-protocol.org/latest/topics/key-concepts/
- https://www.anthropic.com/engineering/multi-agent-research-system
- https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns
- https://openai.github.io/openai-agents-python/handoffs/
- https://www.atlassian.com/team-playbook/plays/daci
- https://cognition.com/blog/dont-build-multi-agents
- https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/
related:
- shared.responsibilities.responsibility-map
- shared.handoffs.handoff-catalogue
- shared.guardrails.company-wide-guardrails
cross_refs:
  '8':
  - shared.guardrails.company-wide-guardrails
seed_version: 1
---

**When to use this:** Every time work goes to or comes from another department: whether it goes manager-to-manager or worker-to-worker, and the fields every handoff message must carry.

**Source section:** 7. Routing rule and message template: new work goes manager-to-manager, workers talk only inside an accepted task

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
