---
id: support.voice-of-customer.voice-of-the-customer
department: support
domain: voice-of-customer
title: 'Customer support: Voice of the customer'
summary: Why absence of complaints is not health, five support-signal families per account, triggers and the at-risk handoff, escalation versus churn prediction, closing the loop to product, a tagging scheme and churn signals for the manager agent.
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- retention
sources:
- https://www.qualtrics.com/news/ai-powered-customer-service-fails-at-four-times-the-rate-of-other-tasks/
- https://resources.rework.com/libraries/ai-for-customer-service/support-signals-that-predict-churn
- https://www.usepylon.com/blog/workflows-support-tickets-success-signals-retention-2025
- https://churnzero.com/blog/customer-health-scores-in-the-age-of-ai/
- https://arxiv.org/abs/2010.06145
- https://hbr.org/2010/07/stop-trying-to-delight-your-customers
- https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030
related:
- support.customer-success.customer-success-practice
- support.handoffs.cross-department-handoffs
seed_version: 1
cross_refs:
  '5':
  - support.house-style.cancellation-saves-and-exit-interviews
---

**When to use this:** When looking for at-risk accounts or feeding customer signals to Product.

**Source section:** 17. Voice of the customer

### Absence of complaints is not evidence of health

[FAST-MOVING, October 2025] Only 29% of consumers now contact the company after a bad experience and 30% say nothing, while 47% of bad experiences lead to reduced spending ([Qualtrics, 7 October 2025](https://www.qualtrics.com/news/ai-powered-customer-service-fails-at-four-times-the-rate-of-other-tasks/)). Many tickets can simply mean a heavily engaged customer, and zero tickets can mean disengagement ([Rework, updated 11 October 2026](https://resources.rework.com/libraries/ai-for-customer-service/support-signals-that-predict-churn); [Pylon](https://www.usepylon.com/blog/workflows-support-tickets-success-signals-retention-2025)). This agrees with the house-style point that low consumption is the leading indicator.

### Five support-signal families to track per account

[DURABLE] Rework's practitioner list: repeat contacts on the same issue, sentiment worsening over time, bugs that stay unresolved, escalations (severity raised, manager requested, executive copied), and high effort. Compare each account with its own history (three times the account's own median is a better feature than a raw count) and have any model return the top two or three reasons in plain words, because a bare score gets ignored ([Rework, updated 11 October 2026](https://resources.rework.com/libraries/ai-for-customer-service/support-signals-that-predict-churn)).

### Triggers and the at-risk handoff

[VENDOR] One suggested trigger is a threefold ticket spike within seven days prompting a check-in within 24 hours ([Pylon](https://www.usepylon.com/blog/workflows-support-tickets-success-signals-retention-2025)). [DURABLE] Hand an at-risk flag to the account owner as a task containing the account, a short summary, the reasons, open tickets and bugs, and a suggested first action, with an owner and a response time, and record the outcome for model learning. Support signals should feed a wider health score with usage and commercial data and not replace it ([Rework](https://resources.rework.com/libraries/ai-for-customer-service/support-signals-that-predict-churn); [ChurnZero](https://churnzero.com/blog/customer-health-scores-in-the-age-of-ai/)).

### Escalation prediction is possible; churn prediction from tickets is unproven

[DURABLE] IBM researchers trained an escalation-prediction model on more than 2.5 million tickets and about 10,000 escalations and reported 87.36% recall with an 88.23% cut in analyst workload; it predicts escalations, not churn ([arXiv 2010.06145](https://arxiv.org/abs/2010.06145), via [Rework](https://resources.rework.com/libraries/ai-for-customer-service/support-signals-that-predict-churn)). [GAP] No peer-reviewed study was found that quantifies how well support-ticket features predict SaaS churn; circulating vendor claims were excluded.

### Closing the loop to product

[DURABLE] CEB recommended systematically learning from frustrated and struggling customers ([HBR, July 2010](https://hbr.org/2010/07/stop-trying-to-delight-your-customers)), and KCS's Evolve Loop names knowledge domain analysis and closed-loop feedback as the mechanism for turning article reuse data into product and documentation improvements ([KCS v6 Practices Guide](https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide/030)). [INFERENCE] A monthly "top contact drivers" report should rank issues by volume times handle time times affected revenue, link each to example tickets and a named product owner, and trigger a closed-loop message to customers when the fix ships.

### A tagging scheme

[INFERENCE] The researchers' design: one mandatory contact-reason tag from a controlled two-level taxonomy (product area, then issue type), plus optional flags (bug ID, feature request ID, churn risk, incident ID). Keep the top level under about 15 values, review "other" monthly, and let AI propose tags while a sample is audited. Add the house-style cancellation-reason tags from section 5 (price, overwhelm, not using, missing feature, not as expected).

### Churn signals for the manager agent

[INFERENCE] For a B2B SaaS: cancellation or downgrade questions, export or data-portability requests, a change of admin or champion, billing disputes, repeated contact on one unresolved bug, sentiment decline, and a previously active account going silent.
