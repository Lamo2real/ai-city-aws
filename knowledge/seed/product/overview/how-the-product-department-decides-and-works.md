---
id: product.overview.how-the-product-department-decides-and-works
department: product
domain: overview
title: 'Product: Overview: how the Product department decides and works'
summary: 'Overview of how the Product department decides and works: the three-layer rule (compliance, evidence, house style), the SVPG
  operating model and its four risks (value, usability, feasibility, viability), three kinds of product work, mapping the manager and
  worker agents onto the model, the lifecycle at a glance, the 2025 to 2026 state of practice, AI moving the bottleneck to discovery,
  and measuring against your own trailing data.'
type: principle
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- discover
- measurement
sources:
- https://svpg.com/the-product-operating-model-an-introduction
- https://svpg.com/product-vs-feature-teams
- https://www.svpg.com/experimentation-ai-and-the-product-model/
- https://www.productledalliance.com/product-management-statistics/
- https://www.mindtheproduct.com/inside-atlassians-state-of-product-2026-key-takeaways/
- https://www.svpg.com/ai-and-the-future-of-the-product-role/
- https://www.svpg.com/the-ai-productivity-paradox/
related:
- product.accessibility.accessibility
- product.compliance.compliance-by-design
- product.ai-products.designing-ai-and-agent-experiences
- product.strategy.product-strategy
- product.discovery.discovery
- product.prioritisation.prioritisation-and-roadmaps
- product.delivery.specification-and-delivery
- product.metrics.metrics-and-experimentation
seed_version: 1
cross_refs:
  '2':
  - product.house-style.house-style-hormozi-product-models
  '3':
  - product.house-style.adapting-the-house-style-to-software
  '4':
  - product.precedence.precedence-compliance-evidence-house-style
  '5':
  - product.strategy.product-strategy
  '6':
  - product.discovery.discovery
  '7':
  - product.prioritisation.prioritisation-and-roadmaps
  '8':
  - product.delivery.specification-and-delivery
  '9':
  - product.metrics.metrics-and-experimentation
  '10':
  - product.go-to-market.go-to-market-pricing-and-packaging
  '11':
  - product.operating-model.operating-models-and-the-product-role
  '12':
  - product.ai-products.building-ai-products
  '13':
  - product.ux.ux-fundamentals
  '14':
  - product.ux.design-process-and-design-systems
  '15':
  - product.research.user-research
  '16':
  - product.ux.measuring-ux
  '17':
  - product.accessibility.accessibility
  '18':
  - product.compliance.compliance-by-design
  '19':
  - product.ai-products.designing-ai-and-agent-experiences
---

**When to use this:** When starting any product work: to place it in the lifecycle, check the four risks, see which section holds the detail and decide how the manager hands problems to workers.

**Source section:** 1. Overview: how the Product department decides and works

### The three-layer rule that governs every agent decision

**[INFERENCE]** The Product department runs on three layers in strict order. Layer one is compliance: accessibility law, consumer withdrawal rules, consent and deceptive-design rules, AI disclosure and data protection (sections 17, 18 and 19). Layer two is independent evidence and established practice on strategy, discovery, prioritisation, delivery, metrics, pricing, research and design (sections 5 to 16). Layer three is the house style, Alex Hormozi's published models, which is the default framing wherever he has published one (sections 2 and 3). A worker agent starts from the house-style test, checks whether an evidence rule changes it for software or for this product's scale, and checks whether a compliance gate blocks it for this market and customer type. Section 4 lists the known collisions and says which rule wins in each.

### The product operating model in three dimensions

**[DURABLE; practitioner opinion]** The SVPG product operating model has three dimensions. How you build: small, frequent releases, at least every two weeks and ideally continuous. How you solve problems: teams receive problems and outcomes, not feature lists, and each solution must be valuable, usable, feasible and viable. How you decide which problems to solve: leaders set a customer-centric vision and an insight-driven strategy ([SVPG, The Product Operating Model, Feb 2023, modified Jul 2024](https://svpg.com/the-product-operating-model-an-introduction)). SVPG is a consultancy that sells coaching on this model, so treat the model as an influential practitioner position and not as tested evidence.

### The four risks every solution must clear

**[DURABLE; practitioner opinion]** SVPG names four risks for any proposed solution: value (will customers buy it or choose to use it), usability (can they work out how to use it), feasibility (can it be built with the time, skills and technology available) and business viability (does it work for sales, marketing, finance, legal and compliance). In SVPG's model the product manager owns value and viability, the designer owns usability and the tech lead owns feasibility ([SVPG, The Product Operating Model, Feb 2023, modified Jul 2024](https://svpg.com/the-product-operating-model-an-introduction); [SVPG, Product vs Feature Teams, Aug 2019, modified Oct 2023](https://svpg.com/product-vs-feature-teams)). **[INFERENCE]** For an agent department, every specification should record evidence against each of the four risks, and Teresa Torres's fifth category, ethical risk (section 6), should be added as a standing line.

### Three kinds of product work need different methods

**[FAST-MOVING, Oct 2026; practitioner opinion]** SVPG separates product work into three types that need different strategy and experimentation: zero-to-one work that seeks product-market fit, innovation on existing products that creates new value, and optimisation that captures value ([SVPG, Experimentation, AI and the Product Model, Oct 2026](https://www.svpg.com/experimentation-ai-and-the-product-model/)). **[INFERENCE]** The manager agent should tag each piece of work with one of the three types before choosing methods: qualitative discovery and prototypes dominate zero-to-one work, mixed methods suit innovation, and controlled experiments belong mainly to optimisation where traffic allows (section 9).

### Mapping the manager agent and worker agents onto the product model

**[INFERENCE]** A Product department with one manager agent and several worker agents matches the empowered-team model if the manager assigns problems and outcome metrics to workers and holds them to evidence, and it matches a feature factory if the manager hands down feature lists and dates. SVPG's diagnostic questions work as a self-audit: is the team handed features and dates or problems and outcomes, and have its OKRs decayed into feature lists ([SVPG, Product vs Feature Teams, Aug 2019, modified Oct 2023](https://svpg.com/product-vs-feature-teams)). A worker agent can maintain an opportunity solution tree and draft assumption lists, but opportunities must trace to real customer stories, because synthetic interviews break the premise of the method (section 15).

### The lifecycle at a glance

**[INFERENCE]** The table maps each stage of product work to the default practice in this knowledge base, the house-style test that frames it, and the section holding the detail. The mapping is the researchers' synthesis; the sources for each practice are in the sections named.

| Stage | Default practice from the evidence layer | House-style framing | Detail |
|---|---|---|---|
| Set strategy | Vision, a few chosen problems, an explicit not-doing list, positioning from real alternatives | Market indicators; focus and saying no | Sections 2, 5 |
| Discover what to build | One outcome, opportunity solution tree, story-based interviews, assumption tests | Obstacle list before, during and after the outcome | Sections 2, 6, 15 |
| Prioritise | Opportunity assessment for bets, RICE or ICE for small items, cost of delay for sequencing, now-next-later roadmap | Value equation as a feature test; trim low-value, high-cost items | Sections 2, 7 |
| Specify | One-pager against the four risks, user stories with INVEST, acceptance criteria, eval suites for AI features | Delivery cube to choose the delivery vehicle | Sections 2, 8, 12 |
| Design | Heuristics, forms guidance, design system tokens, critique, accessibility gate | Cut delay and effort for the customer | Sections 13, 14, 17 |
| Launch | Launch tiers by market and business impact, feature flags, pricing and packaging review, compliance checklist | Offer ladder: attraction, upsell, downsell, continuity | Sections 3, 10, 18 |
| Measure | North-star metric with inputs, activation milestone, cohort retention, HEART, SUS, evals | Activation and retention levers; cancellation feedback | Sections 2, 9, 16 |

### The state of practice in 2025 to 2026

**[FAST-MOVING, 2025-2026; survey]** Survey data shows most product teams fall short of the model they describe. In the PLA/ProductPlan survey of about 250 respondents (fielded Q4 2025, published May 2026), only 34% regularly collect insights and use them in prioritisation, and 27% blame missing discovery or customer insight for strategy-roadmap misalignment ([Product-Led Alliance statistics page citing the PLA/ProductPlan State of Product Management 2026, published May 2026](https://www.productledalliance.com/product-management-statistics/)). In Atlassian's State of Product 2026 (more than 1,000 product professionals in the US and Europe, reported September 2025), 49% say they lack time for strategic planning, 80% of teams do not involve engineers in ideation, problem definition or roadmap creation, only 31% of organisations prioritise rapid experimentation, and 84% worry their products will not succeed in market although 85% feel empowered to influence strategy ([Mind the Product summary of Atlassian's State of Product 2026, Sep 2025](https://www.mindtheproduct.com/inside-atlassians-state-of-product-2026-key-takeaways/)). These figures were read through secondary pages; Atlassian's primary report and the full ProductPlan PDF were not fetched.

### AI moved the bottleneck from delivery to discovery

**[FAST-MOVING, Jul-Nov 2026; practitioner opinion]** SVPG's 2026 position is that with AI, delivery is no longer the bottleneck, so the demand for discovery, product judgment and evaluation design rises ([SVPG, AI and the Future of the Product Role, 6 Nov 2026](https://www.svpg.com/ai-and-the-future-of-the-product-role/)). It argues that teams ship faster with AI without better outcomes when they only speed up output inside a project model, citing Atlassian's State of Teams 2026, in which 89% of executives say AI sped up work while 6% can show organisation-wide return ([SVPG, The AI Productivity Paradox, 23 Jul 2026](https://www.svpg.com/the-ai-productivity-paradox/)). SVPG's recommendation is to use AI for "build to learn" (throwaway prototypes that test ideas) before "build to earn" (production-quality delivery) ([SVPG, The AI Productivity Paradox, 23 Jul 2026](https://www.svpg.com/the-ai-productivity-paradox/)). **[INFERENCE]** For an AI Product department this is the central operating risk: agents can produce business cases, roadmaps, specifications and code quickly, and that speed is wasted if the underlying idea is unproven.

### Measure against your own trailing data first

**[INFERENCE]** Because the public benchmarks in this document are old, self-reported and skewed to venture-backed US companies (retention from 2020, activation from 2022, free-to-paid from 2023, feature adoption from 2019), the department should treat them as rough orientation and use the company's own trailing cohorts as the primary baseline. Each benchmark paragraph in sections 5, 9 and 10 carries its date so that agents can state its age when quoting it.
