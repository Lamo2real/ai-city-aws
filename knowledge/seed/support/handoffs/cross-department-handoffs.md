---
id: support.handoffs.cross-department-handoffs
department: support
domain: handoffs
title: 'Customer support: Handoffs between Customer support and the other departments'
summary: What Customer support hands over to and receives from IT infrastructure, Marketing, Application, Data and AI, Finance, Sales, Legal, Media, Operations, Product and Research, and between the manager and worker agents.
type: playbook
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives: []
sources: []
related:
- support.agent-guardrails.ai-agent-guardrails
- support.voice-of-customer.voice-of-the-customer
seed_version: 1
cross_refs:
  '3':
  - support.house-style.onboarding-and-activation
  '11':
  - support.tickets.intake-severity-sla-escalation
  '17':
  - support.voice-of-customer.voice-of-the-customer
---

**When to use this:** When passing work to, or requesting work from, another department.

**Source section:** 28. Handoffs between Customer Support and the other departments

### How to read the handoff table

[INFERENCE] The table is the researchers' synthesis; the notes source individual practices (the at-risk task format in section 17, the incident communication order in section 11, the bug-report minimum in section 11, BAMFAM in section 3) but not a departmental map. Every handoff follows the house-style rule that the sender states the next step, its owner and its time, and attaches a written summary.

| Department | Support hands over | Support receives |
|---|---|---|
| IT infrastructure | Suspected security incidents within the hour; outage reports with affected accounts; access requests for agent tooling | Incident status and approved wording; status-page updates; identity and access controls for AI agents |
| Marketing | Satisfied customers willing to give reviews, testimonials or referrals; top contact drivers that reveal misleading promises | Advance notice of campaigns, launches and promotions for volume forecasting; approved referral and review offers |
| Application | Bug reports meeting the minimum standard, with affected-account counts and waiting time | Fix status per bug, release notes, known-issue workarounds |
| Data and AI | Tagged tickets, cancellation reasons, QA results, AI error examples | Health scores, churn-risk flags with reasons, activation metrics, evaluation of AI agent accuracy |
| Finance | Refund and credit records, service-credit claims with claim dates, failed-payment contacts, price-raise objections | Make-good menu limits, dunning status, approved legacy rates, invoice and bookkeeping answers |
| Sales | Expansion signals, upgrade requests, at-risk tasks for named accounts | New-customer handover with goals, promises made and the next contact booked |
| Customer Support (manager agent to worker agents) | Worker agents escalate risk flags, policy gaps and menu overruns to the manager agent | Manager agent issues routing rules, scorecards, approved content and the 20-cancellation review |
| Legal | Consumer claims to be rejected, ARN filings, data subject requests, threats, bot-error commitments, price-raise drafts | Approved compliance articles, rejection wording with ARN details, rulings on edge cases |
| Media | Customer stories and spotlight candidates with consent | Tutorial videos, onboarding content, price-raise announcement assets |
| Operations | Staffing and reviewer-capacity forecasts, process faults found by make-good overruns | Scheduling, vendor management, business-continuity plans |
| Product | Monthly top contact drivers ranked by volume, handle time and revenue; the 20-cancellation review; feature requests | Roadmap status that agents may share, change notices in time for the 30-day consumer termination window |
| Research | Questions that need evidence (benchmarks, legal changes), verbatim themes | Updated benchmarks, verified legal changes, corrections to this knowledge base |
