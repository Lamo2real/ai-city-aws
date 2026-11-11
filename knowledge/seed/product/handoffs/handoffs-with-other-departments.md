---
id: product.handoffs.handoffs-with-other-departments
department: product
domain: handoffs
title: 'Product: Handoffs with other departments'
summary: 'Handoffs with other departments: what Product hands to and receives from IT infrastructure, Application, Data and AI, Marketing,
  Sales, Customer Support, Finance, Legal, Media, Operations, Research and its own workers; the five-part format of a handoff; when
  to escalate to Legal.'
type: playbook
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives: []
sources:
- https://svpg.com/the-product-operating-model-an-introduction
- https://www.mindtheproduct.com/inside-atlassians-state-of-product-2026-key-takeaways/
- https://www.productplan.com/ebooks/the-state-of-product-management-report-2026
- https://www.pragmaticinstitute.com/blog/post/prioritize-product-launch-resources-with-launch-tiers
- https://sozai.app/transcript/get-customers-to-stay-forever/
- https://web.dev/articles/vitals
- https://martinfowler.com/articles/feature-toggles.html
- https://www.producttalk.org/opportunity-solution-trees/
- https://arxiv.org/pdf/2212.11366v1
- https://anthropic.com/engineering/demystifying-evals-for-ai-agents
- https://www.aprildunford.com/post/a-quickstart-guide-to-positioning
- https://www.growthunhinged.com/p/saas-pricing-out-of-date
- https://kylepoyar.substack.com/p/2025-state-of-b2b-monetization
- https://cms.law/sv/swe/legal-updates/ny-aangerknapp-kraevs-paa-e-handelsplattformar-fraan-den-19-juni-2026
- https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations
- https://webaim.org/projects/million/
- https://www.shortform.com/podcast/episode/the-game-w-alex-hormozi-2026-04-23-episode-summary-before-you-run-ads-fix-this-one-thing-first-ep-964
- https://www.nngroup.com/articles/which-ux-research-methods/
- https://www.nngroup.com/articles/thematic-analysis/
- https://svpg.com/product-vs-feature-teams
related: []
seed_version: 1
---

**When to use this:** When passing work to or requesting work from another department, or escalating a legal point to Legal.

**Source section:** 22. Handoffs with other departments

### How handoffs are described here

**[INFERENCE]** This section describes what the Product department hands to and receives from each of the other departments. It is the researchers' synthesis; no fetched source describes this company's departments. Sourced points that motivate a handoff are cited: SVPG's viability risk spans sales, marketing, finance, legal and compliance ([SVPG, The Product Operating Model, Feb 2023, modified Jul 2024](https://svpg.com/the-product-operating-model-an-introduction)); engineers are excluded from early work in 80% of teams ([Mind the Product summary of Atlassian's State of Product 2026, Sep 2025](https://www.mindtheproduct.com/inside-atlassians-state-of-product-2026-key-takeaways/)); product strategy often fails to land with Sales and Customer Success ([ProductPlan, State of Product Management Report 2026, landing page](https://www.productplan.com/ebooks/the-state-of-product-management-report-2026)); launch tier determines marketing resources ([Pragmatic Institute, Use product launch tiers, page modified 2 Nov 2026](https://www.pragmaticinstitute.com/blog/post/prioritize-product-launch-resources-with-launch-tiers)); and Hormozi wants support problems to reach product quickly ([Hormozi, How to Get Your Customers to Stay Forever, third-party transcript, transcribed Aug 2026](https://sozai.app/transcript/get-customers-to-stay-forever/)).

### Handoff table

**[INFERENCE]** The table lists the handoffs by department. Every row is the researchers' synthesis unless a source is cited in it.

| Department | Product hands over | Product receives | Notes and sources |
|---|---|---|---|
| IT infrastructure | Non-functional requirements, performance targets, flag and rollout needs, monitoring needs | Capacity limits, incident reports, reliability data, security constraints | Core Web Vitals targets ([web.dev, Web Vitals, updated 31 Oct 2024](https://web.dev/articles/vitals)); ops toggles as kill switches ([Pete Hodgson on martinfowler.com, Feature Toggles (aka Feature Flags), revised 9 Oct 2017](https://martinfowler.com/articles/feature-toggles.html)) |
| Application | Problems, outcome metrics, one-page specifications, stories with acceptance criteria, prototypes | Feasibility assessments, estimates, delivery status, instrumentation | Bring engineering into problem definition ([Mind the Product summary of Atlassian's State of Product 2026, Sep 2025](https://www.mindtheproduct.com/inside-atlassians-state-of-product-2026-key-takeaways/); [Product Talk, Opportunity Solution Trees, Dec 2023, modified 29 Sep 2026](https://www.producttalk.org/opportunity-solution-trees/)) |
| Data and AI | Metric definitions, activation hypothesis, experiment designs, eval task sets and pass thresholds | Cohort and retention analyses, experiment results, eval results, cost-to-serve data, lawful-basis documentation for data use | Sample-size rules ([Larsen, Stallrich, Sengupta, Deng, Kohavi and Stevens, Statistical Challenges in Online Controlled Experiments, 2022](https://arxiv.org/pdf/2212.11366v1)); eval method ([Anthropic, Demystifying evals for AI agents, 9 Jan 2026](https://anthropic.com/engineering/demystifying-evals-for-ai-agents)) |
| Marketing | Positioning inputs, launch tier decided at kickoff, release notes, machine-readable pricing content | Market and competitor signals, campaign results, pricing-page conversion data | Tier by market and business impact ([Pragmatic Institute, Use product launch tiers, page modified 2 Nov 2026](https://www.pragmaticinstitute.com/blog/post/prioritize-product-launch-resources-with-launch-tiers)); positioning ([April Dunford, A Quickstart Guide to Positioning, 15 Mar 2021](https://www.aprildunford.com/post/a-quickstart-guide-to-positioning)) |
| Sales | Roadmap in now-next-later form, packaging and tier logic, product-qualified lead definition | Lost-deal reasons with segment tags, price objections, alternatives that show up in deals | Share of deals lost on price ([Growth Unhinged, Pricing used to last 18 months, Jul 2026](https://www.growthunhinged.com/p/saas-pricing-out-of-date)); real alternatives ([April Dunford, A Quickstart Guide to Positioning, 15 Mar 2021](https://www.aprildunford.com/post/a-quickstart-guide-to-positioning)) |
| Customer Support | Release notes, known issues, help content, empty-state and error copy | Tagged cancellation reasons, top contact drivers, failure cases for eval suites | Review per roughly 20 cancellations ([Hormozi, How to Get Your Customers to Stay Forever, third-party transcript, transcribed Aug 2026](https://sozai.app/transcript/get-customers-to-stay-forever/)); eval tasks from support queues ([Anthropic, Demystifying evals for AI agents, 9 Jan 2026](https://anthropic.com/engineering/demystifying-evals-for-ai-agents)) |
| Finance | Pricing proposals, cost-to-serve estimates, expected retention effects | Margin targets, payback targets, revenue retention by cohort, VAT and invoicing rules | Cost and margin lead AI pricing ([Growth Unhinged, 2025 State of B2B Monetization, survey fielded Apr-May 2025](https://kylepoyar.substack.com/p/2025-state-of-b2b-monetization)) |
| Legal | Draft flows for consent, withdrawal, cancellation, AI disclosure and accessibility information; questions on any point marked secondary or unverified | Rulings, mandated wording, scope decisions (consumer versus business, platform status) | Legal points here are orientation only ([CMS, Ny "ångerknapp" krävs på e-handelsplattformar, 15 Jun 2026](https://cms.law/sv/swe/legal-updates/ny-aangerknapp-kraevs-paa-e-handelsplattformar-fraan-den-19-juni-2026); [Faegre Drinker, 30 Jul 2026](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations)) |
| Media | Briefs for product visuals, demo and help video needs, labelling requirements for AI-generated media | Assets with alt text, captions and provenance metadata intact | Marking and labelling duties ([Faegre Drinker, 30 Jul 2026](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations)); alt text failures ([WebAIM Million 2026, scan Feb 2026, report updated 30 Mar 2026](https://webaim.org/projects/million/)) |
| Operations | Process changes implied by a release, service-level commitments by tier | Delivery capacity, onboarding load, process pain points | Delivery capacity before growth ([Shortform summary of The Game Ep 964, 23 Apr 2026](https://www.shortform.com/podcast/episode/the-game-w-alex-hormozi-2026-04-23-episode-summary-before-you-run-ads-fix-this-one-thing-first-ep-964)) |
| Research | Research questions, target segments, hypotheses and proto-personas labelled as such | Interview snapshots, thematic syntheses, usability findings, survey results with sample sizes | Method choice ([NN/g, When to Use Which User-Experience Research Methods, 17 Jul 2022, reviewed 15 Jul 2026](https://www.nngroup.com/articles/which-ux-research-methods/)); synthesis ([NN/g, How to Analyze Qualitative Data: Thematic Analysis, 17 Aug 2022, reviewed 2 Sep 2026](https://www.nngroup.com/articles/thematic-analysis/)) |
| Product (internal) | Manager agent hands workers a problem, an outcome metric and an evidence bar | Workers hand back recommendations with an evidence line and labelled gaps | Problems and outcomes, not feature lists ([SVPG, Product vs Feature Teams, Aug 2019, modified Oct 2023](https://svpg.com/product-vs-feature-teams)) |

### The format of a handoff

**[INFERENCE]** Each handoff from Product carries five things: the problem and the outcome it serves; the evidence and its level; what is explicitly out of scope; the decision or input needed and by when; and the open risks across value, usability, feasibility, viability and ethics. Each handoff into Product is logged against the opportunity or metric it informs. The format is the researchers' synthesis.

### Escalation to Legal

**[INFERENCE]** Product escalates to Legal whenever a flow touches consumers, consent, withdrawal, cancellation, pricing claims, AI disclosure, minors or accessibility exemptions, and whenever this document marks a legal point as secondary source only, unverified or a gap. Legal's ruling replaces the corresponding paragraph in the knowledge base.
