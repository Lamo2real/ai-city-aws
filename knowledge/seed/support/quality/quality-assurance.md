---
id: support.quality.quality-assurance
department: support
domain: quality
title: 'Customer support: Quality assurance'
summary: QA scorecards of three to seven weighted categories, manual review coverage, calibration, coaching and piloting, a scorecard for AI worker agents, and calibrating AI graders.
type: playbook
audience: both
confidence: vendor
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- resolution
sources:
- https://www.zendesk.com/blog/customer-service/customer-success/customer-service-scorecard/
- https://www.eesel.ai/blog/zendesk-qa-scorecard-criteria
- https://www.kaizo.com/blog/what-is-qa-calibration/
- https://front.com/blog/quality-assurance-scorecard
- https://www.supportbench.com/build-qa-scorecard-support-examples-scoring-templates/
- https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030
related:
- support.metrics.metrics-and-benchmarks
- support.knowledge-management.knowledge-management
seed_version: 1
---

**When to use this:** When reviewing conversation quality, building a scorecard, calibrating reviewers or grading AI agents.

**Source section:** 14. Quality assurance

### Keep the scorecard to three to seven categories and weight accuracy

[VENDOR] Zendesk's guidance (updated 5 March 2026) is to use 3 to 7 rating categories to avoid reviewer fatigue (examples: solution, grammar, tone, empathy, personalisation, following internal process, going the extra mile), weight the categories that matter most to your goals, vary weights by channel (tone and closing on phone, grammar and follow-up in email and chat), and choose a scale from binary to five points ([Zendesk blog](https://www.zendesk.com/blog/customer-service/customer-success/customer-service-scorecard/)).

### Manual review covers about 2% of conversations

[VENDOR] [GAP] The Customer Service Quality Benchmark Report (originally from Klaus, now Zendesk QA; year unknown, not opened directly) is cited as finding that only about 2% of conversations are reviewed manually and as putting the industry internal quality score benchmark at 88% ([Zendesk blog](https://www.zendesk.com/blog/customer-service/customer-success/customer-service-scorecard/); [eesel.ai](https://www.eesel.ai/blog/zendesk-qa-scorecard-criteria)). Manual sampling options include random, longest or low-CSAT conversations; AI-based QA aims for 100% coverage.

### Calibration

[DURABLE] Calibration means several reviewers score the same conversation and compare results so everyone applies the scorecard the same way ([Kaizo](https://www.kaizo.com/blog/what-is-qa-calibration/)). Monthly sessions are recommended for B2B support teams ([Front](https://front.com/blog/quality-assurance-scorecard)), and sessions should also revisit criteria and discuss edge cases, such as a correct solution that missed one aspect of the conversation ([Zendesk blog](https://www.zendesk.com/blog/customer-service/customer-success/customer-service-scorecard/)).

### Coaching and piloting

[VENDOR] Explain why QA exists, co-design the scorecard with the team, give specific feedback with written comments in regular one-to-ones, and rebalance the weights if CSAT does not move ([Zendesk blog](https://www.zendesk.com/blog/customer-service/customer-success/customer-service-scorecard/)). Pilot a new scorecard with roughly 10 to 20% of agents for three to four weeks before rollout ([Supportbench](https://www.supportbench.com/build-qa-scorecard-support-examples-scoring-templates/)). KCS adds its own review mechanisms: a process adherence review and a coaching and licensing model for knowledge contributors ([KCS v6 Practices Guide](https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030)).

### A scorecard for AI worker agents

[INFERENCE] The researchers' design has five categories: factual accuracy and grounding in an approved source, with automatic failure if a policy, price or commitment is invented; completeness, including next-issue avoidance; correct process (verification, tagging, escalation rules); clarity and tone in the customer's language; and handoff quality, meaning a summary good enough that the human need not re-ask. Automatic-fail items are privacy or security breaches, missing AI disclosure, and denying or obstructing a statutory right.

### Calibrating and coaching AI graders

[INFERENCE] Calibration for automated QA means periodically having humans score the same sample as the automated grader and tracking agreement; treat disagreement as a prompt or rubric defect. Coaching translates into prompt and knowledge changes logged with before-and-after QA scores. [GAP] No independent evidence was found linking specific QA designs to CSAT or retention, and no published standard for acceptable error rates of AI agents in support.
