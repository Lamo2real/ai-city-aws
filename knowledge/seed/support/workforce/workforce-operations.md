---
id: support.workforce.workforce-operations
department: support
domain: workforce
title: 'Customer support: Workforce operations'
summary: Forecasting live channels with Erlang C, typical planning values and limits, forecast quality, capacity for asynchronous queues and human reviewers, how AI changes the staffing mix, B2B versus B2C, and tooling.
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- resolution
sources:
- https://www.lorikeetcx.ai/articles/call-center-staffing-erlang-c-2026
- https://www.callcentretools.com/tools/erlang-calculator/
- https://www.assembled.com/university/how-do-i-use-erlang-c-to-plan-staffing
- https://www.intercom.com/blog/customer-service-transformation-report-2026/
- https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0
- https://resources.rework.com/libraries/ai-for-customer-service/support-signals-that-predict-churn
related:
- support.metrics.metrics-and-benchmarks
seed_version: 1
cross_refs:
  '16':
  - support.ai-support.ai-led-support-and-limits
---

**When to use this:** When forecasting volume, staffing live channels or planning reviewer capacity.

**Source section:** 18. Workforce operations

### Forecast live channels per interval and staff with Erlang C

[DURABLE] Erlang C takes forecast contacts per 15- or 30-minute interval, average handle time, a target service level and answer time, and a maximum occupancy cap of about 85%. A worked example: 100 calls per half hour at a 5-minute handle time needs 21 seated agents for 80% answered in 20 seconds, and about 30 rostered at 30% shrinkage; convert with rostered equals seated divided by one minus shrinkage, not by multiplying ([Lorikeet, 8 October 2026](https://www.lorikeetcx.ai/articles/call-center-staffing-erlang-c-2026)).

### Typical planning values

[FAST-MOVING, October 2026] Practitioner planning values: shrinkage of roughly 30 to 35%, maximum occupancy of about 85% (sustained occupancy above 85 to 90% shows up as longer handle time and burnout), and a voice service level of 80% answered in 20 seconds ([Lorikeet citing Call Centre Helper, 8 October 2026](https://www.lorikeetcx.ai/articles/call-center-staffing-erlang-c-2026); [Call Centre Tools](https://www.callcentretools.com/tools/erlang-calculator/)).

### Limits of Erlang C

[DURABLE] Erlang C ignores abandonment and so overstates need, which Erlang A corrects; small teams have structurally lower occupancy, so staffing does not scale linearly; it is generally not appropriate for email-type channels with response times in hours and accumulating backlog; teams under about 20 people usually multi-skill across channels and fill idle time with project work; and for chat, use measured historical concurrency and not the platform's configured maximum ([Lorikeet](https://www.lorikeetcx.ai/articles/call-center-staffing-erlang-c-2026); [Assembled, December 2021](https://www.assembled.com/university/how-do-i-use-erlang-c-to-plan-staffing)).

### Forecast quality is the binding constraint

[DURABLE] A 25% forecast error can leave a small team several people over or under, and known events such as launches and billing runs need manual overrides ([Assembled](https://www.assembled.com/university/how-do-i-use-erlang-c-to-plan-staffing); [Lorikeet](https://www.lorikeetcx.ai/articles/call-center-staffing-erlang-c-2026)). Marketing, Product and Finance must therefore tell support about launches, price changes and billing runs in advance.

### Capacity for asynchronous queues and human reviewers

[INFERENCE] For asynchronous queues capacity is simple arithmetic: forecast tickets times average handle time, divided by productive hours per agent after shrinkage, with backlog age checked daily. In an AI-led model staffing also means human reviewer capacity: plan reviewer hours from expected escalation rate times volume, plus QA sampling.

### AI changes the staffing mix, it does not remove it

[VENDOR] [FAST-MOVING, 2026] Intercom's 2026 survey of more than 2,400 professionals reports teams reorganising staff into AI-focused roles, only 10% with mature AI deployment, and 58% naming improved customer experience as the top 2026 priority, up from 28% a year earlier ([Intercom blog](https://www.intercom.com/blog/customer-service-transformation-report-2026/)). Gartner's forecast of rising assisted volume (section 16) points the same way.

### B2B SaaS versus B2C

[INFERENCE] B2B has fewer, higher-value, multi-user accounts, contractual SLAs, named contacts and admin roles, longer and more technical tickets, and renewal-driven risk, so prioritisation should factor in account tier and renewal date. B2C has higher volume, simpler repeats, more identity-fraud exposure and consumer-law obligations. Gartner's finding that 74% of B2B GenAI users have had it complete a task, against 58% overall, suggests B2B customers are further along with agentic use ([Gartner, 4 August 2026](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0)).

### Tooling

[INFERENCE] A tooling stack for an AI-led SaaS support team: a help desk with an API; a knowledge base with versioning and article states; an AI agent layer grounded on that knowledge base; a status page; a bug tracker linked to tickets; QA and automated review; analytics; an identity and verification service; a CRM or customer-success tool for account context; and a translation review workflow. Support-desk integrations feeding customer-success health scores are the standard link between support and account management in B2B ([Rework citing Gainsight Marketplace](https://resources.rework.com/libraries/ai-for-customer-service/support-signals-that-predict-churn)). [GAP] No independent platform comparison was attempted, and no sourced tickets-per-agent ratios or enablement-time benchmarks were found.
