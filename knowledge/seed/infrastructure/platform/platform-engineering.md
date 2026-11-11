---
id: infrastructure.platform.platform-engineering
department: infrastructure
domain: platform
title: 'IT infrastructure: Platform engineering'
summary: Platform engineering adoption and payoff, running the platform as a product, culture as the main obstacle, and what a thin platform looks like for a small SaaS company.
type: principle
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- delivery
sources:
- https://dora.dev/capabilities/platform-engineering/
- https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report
- https://www.cncf.io/announcements/2026/01/20/kubernetes-established-as-the-de-facto-operating-system-for-ai-as-production-use-hits-82-in-2025-cncf-annual-cloud-native-survey/
seed_version: 1
---

**When to use this:** When planning the internal platform, golden paths or a developer portal for a small SaaS company.

**Source section:** 4. Platform engineering

## 4. Platform engineering

### Adoption is near-universal; quality decides the payoff

**[FAST-MOVING, 2025]** DORA's 2025 research reports that 90% of organisations use an internal developer platform and 76% have dedicated platform teams. With a high-quality platform, AI adoption has a strong positive effect on organisational performance; with a low-quality platform the effect is negligible, and individual AI productivity gains are often lost to downstream bottlenecks in testing, security review and deployment. The platform capability most correlated with a positive user experience is giving developers clear feedback on the outcome of their tasks ([DORA platform engineering capability, updated 12 Jan 2026](https://dora.dev/capabilities/platform-engineering/)).

**[FAST-MOVING, 2024 to 2025]** DORA's 2024 research associated developer independence (finishing tasks without an enabling team) with a 5% productivity improvement at team and individual level, and DORA cautions that platforms raise productivity and organisational performance but, without careful management, can reduce throughput and change stability ([DORA platform engineering capability](https://dora.dev/capabilities/platform-engineering/)). The 2025 DORA report rests on nearly 5,000 respondents and more than 100 hours of qualitative data; 90% use AI at work, 30% report little or no trust in AI-generated code, and AI adoption now correlates positively with delivery throughput and product performance but still negatively with delivery stability ([Google Cloud blog on the 2025 DORA report](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report)).

### Run the platform as a product

**[DURABLE]** DORA's success factors for a platform are to run it as a product with a product manager and roadmap; map the critical user journeys (creating a new service, debugging production); offer self-service golden paths that "shift down" complexity into the platform; start with a minimum viable platform for the most common workflow; make it extensible through APIs and a contribution model; and treat it as the governance layer for AI-generated code ([DORA platform engineering capability](https://dora.dev/capabilities/platform-engineering/)).

**[DURABLE]** DORA's named platform anti-patterns are building without user research, ivory-tower standards that drive shadow IT, "ticket-ops" queues in place of self-service, big-bang launches and a one-size-fits-all "golden cage". DORA's suggested platform scorecard is the five software delivery metrics, developer satisfaction (CSAT or NPS), adoption and retention (the HEART model) and task success for key workflows ([DORA platform engineering capability](https://dora.dev/capabilities/platform-engineering/)).

**[FAST-MOVING, 2025]** DORA's six starting points for leaders in the AI era are to clarify AI policies, connect AI to internal context, prioritise foundational practices, fortify safety nets, invest in the internal platform and focus on end users ([Google Cloud blog on the 2025 DORA report](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report)).

### Culture, not tooling, is the top reported obstacle

**[FAST-MOVING, 20 Jan 2026]** In the CNCF 2025 survey, Backstage (a developer portal) is the fifth CNCF project by velocity, and the top cloud-native challenge is cultural change within development teams (47%), ahead of training (36%), security (36%) and complexity (34%) ([CNCF announcement, 20 Jan 2026](https://www.cncf.io/announcements/2026/01/20/kubernetes-established-as-the-de-facto-operating-system-for-ai-as-production-use-hits-82-in-2025-cncf-annual-cloud-native-survey/)).

### What a thin platform looks like for a small SaaS company

**[INFERENCE]** For a small SaaS company the platform can be thin: a service template repository, one paved CI/CD pipeline, infrastructure modules with guardrails, default dashboards and alerts, and a runbook template. DORA's minimum-viable-platform advice supports starting with one golden path. Because AI raises change volume and DORA still finds a negative stability association, the guardrails (automated tests, progressive delivery, automatic rollback) need to be in place before AI-generated change volume is scaled up.

### Gaps in this section

**[GAP]** No Gartner platform-engineering figure was sourced, so none may be cited from this document. DORA's seven AI capabilities and seven team archetypes were not readable, DORA 2024's other platform figures were not confirmed, the CNCF survey's sample size and field dates were not on the page, and no independent evidence was found on the cost or return of building versus buying a developer portal.
