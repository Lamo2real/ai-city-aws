---
id: shared.guardrails.company-wide-guardrails
department: shared
domain: guardrails
title: 'Shared: Company-wide guardrails'
summary: 'Gates sit on tools for pay, sign, publish, deploy and grant-access: what published practice says about human approval, the proposed list of actions that always need a human, and the three tiers for every department agent (editable proposals).'
type: policy
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- safety
sources:
- https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
- https://www.anthropic.com/news/our-framework-for-developing-safe-and-trustworthy-agents
- https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system
- https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns
- https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
- https://gdpr-info.eu/art-22-gdpr/
- https://gdpr-info.eu/art-12-gdpr/
- https://artificialintelligenceact.eu/article/14/
- https://handbook.gitlab.com/handbook/sales/field-operations/sales-operations/deal-desk/
- https://dora.dev/capabilities/streamlining-change-approval/
- https://www.atlassian.com/itsm/change-management
- https://handbook.gitlab.com/handbook/marketing/marketing-operations/lead-lifecycle/
- https://handbook.gitlab.com/handbook/customer-success/pre-sales-post-sales-transition/
- https://sre.google/sre-book/managing-incidents/
- https://commoncog.com/the-amazon-weekly-business-review/
- https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them
related:
- shared.routing.routing-rule-and-message-template
- shared.compliance.sweden-and-eu
- shared.processes.end-to-end-processes
seed_version: 1
---

**When to use this:** Before any action that pays, signs, publishes, deploys or grants access, and whenever a handoff names an approval class.

**Source section:** 8. Company-wide guardrails: gates sit on tools for pay, sign, publish, deploy and grant-access

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
