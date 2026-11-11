---
id: operations.ai-operations.operating-a-company-with-ai-agents
department: operations
domain: ai-operations
title: 'Operations: Operating a company with AI agents in 2026'
summary: 'Operating a company with AI agents in 2026: near-universal adoption but little profit impact (about 6% in McKinsey''s
  2026 survey), forecasts are not measurements, design patterns for agent work, and workflow redesign with human review and
  agent supervision (reversibility tiers).'
type: benchmark
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- efficiency
- scale
sources:
- https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
- https://www.bcg.com/publications/2025/are-you-generating-value-from-ai-the-widening-gap
- https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo/
- https://techstrong.ai/features/ai-agent-fallout-more-than-40-of-projects-will-be-canceled-in-two-years-gartner-predicts/
- https://www.anthropic.com/engineering/building-effective-agents
- https://zylo.com/reports/2026-saas-management-index/
related: []
seed_version: 1
---

**When to use this:** When planning or judging AI-agent work: adoption against profit impact, forecasts versus measurements, design patterns, workflow redesign, human review and agent supervision.

**Source section:** 12. Operating a company with AI agents in 2026

### Adoption is near-universal; profit impact is not

**[FAST-MOVING, Aug 2026]** McKinsey's "The state of AI in 2026" (published 25 August 2026; fielded 4 May to 8 June 2026; 1,719 respondents in 97 countries) finds that nearly nine in ten respondents' organisations use AI regularly in at least one function and 44% say AI is scaling across the enterprise, up from 38% the year before. About two in ten are scaling AI agents: 40% of large organisations (up from 27%) against 22% of smaller organisations (flat). Agents are most often scaled in IT, knowledge management and software engineering ([McKinsey, The state of AI in 2026](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai)).

**[FAST-MOVING, Aug 2026]** In the same survey 37% attribute at least some EBIT impact to AI, essentially unchanged from the year before. Cost reductions appear most often in supply chain, service operations and manufacturing, and revenue gains most often in marketing and sales. At the individual level 80% say AI improved their productivity and 50% say it helps them decide better ([McKinsey, The state of AI in 2026](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai)).

**[FAST-MOVING, Aug 2026]** McKinsey's high performers are about 6% of respondents (at least 5% of EBIT from AI plus "significant" value, unchanged from 2025). Nearly three-quarters of them fundamentally redesigned workflows, against 55% the previous year and about one-quarter among other respondents. They are over three times as likely to scale agents in most functions and twice as likely to have defined processes for measuring AI impact and committed senior leadership ([McKinsey, The state of AI in 2026](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai)).

**[VENDOR] [FAST-MOVING, Sep 2025]** BCG's survey of 30 September 2025 classes 5% of firms as "future-built", 35% as scaling AI and generating value, and 60% as reporting hardly any material value. Agents accounted for about 17% of total AI value in 2025, projected at 29% by 2028, and about a third of future-built companies use agents against 12% of scalers. The sample size is not stated on the page ([BCG, The widening AI value gap, 30 Sep 2025](https://www.bcg.com/publications/2025/are-you-generating-value-from-ai-the-widening-gap)).

**[CONTESTED] [FAST-MOVING, 2025]** The MIT NANDA "GenAI Divide" report of 2025, read through a press summary, found that about 5% of AI pilots achieved rapid revenue acceleration and the rest showed little or no measurable profit-and-loss impact. It rests on about 150 interviews, a survey of 350 employees and 300 public deployments, a small and mixed sample, and its methodology has been criticised elsewhere; that criticism was not verified ([Fortune, 18 Aug 2025](https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo/)).

### Forecasts are not measurements

**[VENDOR] [FAST-MOVING, Jun 2025]** Gartner predicted on 25 June 2025, as reported by trade press, that more than 40% of agentic AI projects will be cancelled by the end of 2027 because of escalating costs, unclear business value or inadequate risk controls. A January 2025 poll of 3,412 webinar attendees found 19% had made significant investments in agentic AI, 42% conservative ones, 8% none and 31% waiting or unsure. Gartner's predictions for 2028 were that a third of enterprise software applications will include agentic AI, against under 1% in 2024, and that at least 15% of day-to-day work decisions will be made autonomously. Gartner's own release did not load; these figures come through Techstrong.ai ([Techstrong.ai, 26 Jun 2025](https://techstrong.ai/features/ai-agent-fallout-more-than-40-of-projects-will-be-canceled-in-two-years-gartner-predicts/)).

### Design patterns for agent work

**[VENDOR]** Anthropic's guidance of 19 December 2024 describes five patterns: prompt chaining with programmatic checks between steps; routing; parallelisation by sectioning or voting; orchestrator-workers, in which a central model decomposes, delegates and synthesises; and evaluator-optimiser, in which one model generates and another critiques, which works best with clear criteria ([Anthropic, Building effective agents, 19 Dec 2024](https://www.anthropic.com/engineering/building-effective-agents)).

**[VENDOR]** The same guidance says agents should check ground truth from the environment at each step through tool results, can pause for human feedback at checkpoints or when blocked, and should have stopping conditions such as a maximum number of iterations; they should be tested extensively in sandboxes with guardrails ([Anthropic, Building effective agents, 19 Dec 2024](https://www.anthropic.com/engineering/building-effective-agents)).

### Workflow redesign, human review and agent supervision

**[INFERENCE]** The 2026 survey data separates three things that vendor claims merge: individual productivity (80% report gains), enterprise scaling (44%) and profit impact (37% any, about 6% significant) ([McKinsey, The state of AI in 2026](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai)). The separation is the reason this department reports process outcomes and not usage.

**[INFERENCE]** Workflow redesign procedure: map the current process with a SIPOC and a swimlane; remove steps that exist only because of human hand-offs; decide per step between deterministic automation, an agent or a human; define the acceptance check for each agent output; pilot against the baseline; and standardise the result as a procedure.

**[INFERENCE]** Human-in-the-loop design is tiered by reversibility and blast radius. Tier 0, read-only work and internal drafts, needs no approval and gets sampled review. Tier 1, reversible internal changes, gets post-hoc review with logging. Tier 2, external communication, spending, data deletion and contract or access changes, needs human approval before action. Tier 3, legal, people and security-critical decisions, is decided by a human with the agent only preparing. Section 24 turns these tiers into the department's guardrails.

**[INFERENCE]** Agent supervision and performance management under the manager-agent pattern: a task brief per worker with a definition of done; an evaluator check before hand-back; iteration and budget caps; an audit log of actions and tool calls; a weekly scorecard per agent workflow (volume, first-pass yield, rework rate, escalation rate, cost per task, incidents); and a human quality review of a 5 to 10% sample of outputs, with the sampling rate raised or lowered with the error rate. No source was found on formal performance management of agents; this paragraph is inference.

**[INFERENCE]** Cost control for agent work: with about 20% of firms reporting token costs as a constraint ([McKinsey, 2026](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai)) and 78% of IT leaders reporting surprise AI charges ([Zylo, 2026](https://zylo.com/reports/2026-saas-management-index/)), set a budget and an alert per workflow.

**[GAP]** Not retrieved: any 2026 Gartner agent survey, the MIT NANDA report itself, BCG and Bain 2026 reports on agents, controlled studies of agent performance in operations functions, and data on human-in-the-loop or validation practices.
