---
id: product.delivery.specification-and-delivery
department: product
domain: delivery
title: 'Product: Specification and delivery'
summary: 'Specification and delivery: delivery principles, not speeding up unproven work, a one-page specification outline, user stories,
  INVEST, acceptance criteria (and eval tasks as acceptance criteria for AI features), involving engineering early, the four feature-flag
  types and their lifetimes, beta programmes and release planning, and trustworthy rollout tooling.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- launch
sources:
- https://svpg.com/the-product-operating-model-an-introduction
- https://svpg.com/product-vs-feature-teams
- https://www.svpg.com/the-ai-productivity-paradox/
- https://www.gov.uk/service-manual/agile-delivery/writing-user-stories
- https://agilealliance.org/glossary/invest/
- https://martinfowler.com/bliki/GivenWhenThen.html
- https://anthropic.com/engineering/demystifying-evals-for-ai-agents
- https://www.lennysnewsletter.com/p/why-ai-evals-are-the-hottest-new-skill
- https://www.mindtheproduct.com/inside-atlassians-state-of-product-2026-key-takeaways/
- https://www.producttalk.org/opportunity-solution-trees/
- https://martinfowler.com/articles/feature-toggles.html
- https://arxiv.org/pdf/2212.11366v1
related:
- product.ai-products.building-ai-products
- product.handoffs.handoffs-with-other-departments
seed_version: 1
cross_refs:
  '12':
  - product.ai-products.building-ai-products
  '22':
  - product.handoffs.handoffs-with-other-departments
---

**When to use this:** When writing a specification, user stories or acceptance criteria, planning a beta, a release or a feature-flag rollout, or handing work to Application.

**Source section:** 8. Specification and delivery

### Delivery principles

**[DURABLE; practitioner opinion]** SVPG's delivery principles are small, frequent, uncoupled releases; instrumentation; monitoring; and deployment infrastructure that includes A/B testing capability. Releases should happen at least fortnightly and ideally continuously ([SVPG, The Product Operating Model, Feb 2023, modified Jul 2024](https://svpg.com/the-product-operating-model-an-introduction)). In an empowered team the product manager is not a backlog administrator or project manager, and unclear boundaries between product manager, designer and delivery manager are a symptom of a feature team ([SVPG, Product vs Feature Teams, Aug 2019, modified Oct 2023](https://svpg.com/product-vs-feature-teams)).

### Do not speed up unproven work

**[FAST-MOVING, Jul 2026; practitioner opinion]** SVPG warns that using AI to produce business cases, roadmaps, product requirements documents and code faster only speeds up the wrong work if the idea is unproven ([SVPG, The AI Productivity Paradox, 23 Jul 2026](https://www.svpg.com/the-ai-productivity-paradox/)). **[INFERENCE]** A worker agent writes a full specification only after the riskiest assumptions have test results attached.

### A one-page specification outline

**[INFERENCE]** The department's one-page specification has nine parts: the problem and its evidence; the target user and segment; the outcome metric and target; non-goals; a solution sketch or prototype link; the riskiest assumptions and their test results across value, usability, feasibility, viability and ethics; the release plan (flag, cohort, beta criteria); the measurement plan; and open questions. For AI features it adds the location of the eval set, pass thresholds, a cost-to-serve budget and human-review points. The outline is the researchers' synthesis, consistent with SVPG's four risks ([SVPG, The Product Operating Model, Feb 2023, modified Jul 2024](https://svpg.com/the-product-operating-model-an-introduction)), and is not a published template. **[GAP]** Published templates for product requirements documents and one-pagers (Lenny's collection, Atlassian, Intercom) were not fetched.

### User stories

**[DURABLE; official guidance, last updated 23 May 2016, still the live page]** The GOV.UK Service Manual format for a user story is: as a (who), I need or want (what), so that (why). Any format is acceptable if it names the actor, the narrative and the goal. The goal matters most; if it is hard to write, question whether the feature is needed. Stories needing more than a few weeks are epics and should be split to fit an iteration ([GOV.UK Service Manual, Writing user stories, last updated 23 May 2016](https://www.gov.uk/service-manual/agile-delivery/writing-user-stories)).

### INVEST

**[DURABLE; practitioner body]** INVEST is a checklist for a user story: Independent, Negotiable, Valuable, Estimable, Small enough to fit one iteration, and Testable. It originated with Bill Wake in 2003 and was popularised by Mike Cohn in 2004. A story that fails a criterion should be reworded or split ([Agile Alliance, INVEST](https://agilealliance.org/glossary/invest/)).

### Acceptance criteria

**[DURABLE; official guidance and canonical practitioner statement]** In the GOV.UK Service Manual, acceptance criteria are a checklist of outcomes showing that the need is met, often phrased "it's done when" ([GOV.UK Service Manual, Writing user stories, last updated 23 May 2016](https://www.gov.uk/service-manual/agile-delivery/writing-user-stories)). The Given-When-Then form, from Dan North and Chris Matts as part of behaviour-driven development, states the precondition (Given), the behaviour (When) and the expected change (Then), with "And" to chain conditions. Martin Fowler's example (21 August 2013): given holdings of 100 and 150 shares, when 20 are sold, then 80 remain and a sell order exists ([Martin Fowler, GivenWhenThen, 21 Aug 2013](https://martinfowler.com/bliki/GivenWhenThen.html)). **[INFERENCE]** The department's rule: use "done when" checklists for simple stories and Given-When-Then for behaviour with preconditions or edge cases, and pass every story through INVEST before it enters a sprint.

### Acceptance criteria for AI features are eval tasks

**[VENDOR; Jan 2026]** Anthropic's guidance on evaluations says that writing eval tasks forces a team to define success and exposes vague requirements: two engineers reading the same specification may read edge cases differently, and eval tasks settle the difference. A good task is one where two domain experts independently reach the same pass or fail verdict ([Anthropic, Demystifying evals for AI agents, 9 Jan 2026](https://anthropic.com/engineering/demystifying-evals-for-ai-agents)). A September 2025 practitioner piece describes evals as the new product requirements documents, with eval prompts acting as living requirements for AI behaviour ([Lenny's Newsletter, Why AI evals are the hottest new skill, 25 Sep 2025](https://www.lennysnewsletter.com/p/why-ai-evals-are-the-hottest-new-skill)). **[INFERENCE]** Acceptance criteria for AI features should be written as eval tasks with pass rates over multiple trials, because a single pass or fail is not meaningful for non-deterministic output (section 12).

### Involve engineering early

**[FAST-MOVING, reported Sep 2025; survey]** In Atlassian's State of Product 2026, 80% of teams do not involve engineers in ideation, problem definition or roadmap creation ([Mind the Product summary of Atlassian's State of Product 2026, Sep 2025](https://www.mindtheproduct.com/inside-atlassians-state-of-product-2026-key-takeaways/)). Torres's method assumes the opposite: a trio of product manager, designer and engineer does discovery together ([Product Talk, Opportunity Solution Trees, Dec 2023, modified 29 Sep 2026](https://www.producttalk.org/opportunity-solution-trees/)). **[INFERENCE]** The Product department brings the Application department's engineering agents into problem definition and not only into delivery (section 22).

### Feature flags: four types with different lifetimes

**[DURABLE; canonical practitioner statement, revised 9 Oct 2017]** Pete Hodgson's taxonomy of feature toggles has four types. Release toggles hide unfinished work and should live a week or two. Experiment toggles run A/B tests and live hours to weeks. Ops toggles are kill switches changed during incidents. Permission toggles gate features by user group, such as premium or beta, and can last years ([Pete Hodgson on martinfowler.com, Feature Toggles (aka Feature Flags), revised 9 Oct 2017](https://martinfowler.com/articles/feature-toggles.html)).

**[DURABLE; canonical practitioner statement]** Hodgson's management rules for feature flags: treat flags as inventory with a carrying cost; add a removal task when creating a release flag, and set expiry dates or cap the total number; test the expected production configuration and the fallback, not every combination; and by convention Off means the existing behaviour ([Pete Hodgson on martinfowler.com, Feature Toggles (aka Feature Flags), revised 9 Oct 2017](https://martinfowler.com/articles/feature-toggles.html)). **[GAP]** Feature-flag guidance newer than 2017, such as vendor data on flag debt, was not retrieved.

### Beta programmes and release planning

**[INFERENCE]** A beta programme can be run on permission toggles for a named customer group, the one flag type Hodgson expects to be long-lived ([Pete Hodgson on martinfowler.com, Feature Toggles (aka Feature Flags), revised 9 Oct 2017](https://martinfowler.com/articles/feature-toggles.html)); release toggles should not be reused for this purpose. **[GAP]** Beta programme design, sizing, duration and exit criteria, release planning, and progressive-rollout percentages were not researched, and no data on them was found.

### Trustworthy rollout tooling

**[DURABLE; academic, 2022]** The 2022 review of online controlled experiments says trustworthy rollout and experiment tooling needs A/A tests and sample-ratio-mismatch checks, and that experiment horizons are commonly about two weeks ([Larsen, Stallrich, Sengupta, Deng, Kohavi and Stevens, Statistical Challenges in Online Controlled Experiments, 2022](https://arxiv.org/pdf/2212.11366v1)).
