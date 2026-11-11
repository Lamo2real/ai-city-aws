---
id: product.ai-products.building-ai-products
department: product
domain: ai-products
title: 'Product: Building AI products'
summary: 'Building AI products: start with the simplest architecture that works, choosing AI use cases, the evaluation vocabulary, building
  an eval suite, consistency (pass@k versus pass^k), error analysis before writing evals, evals for quality and A/B tests for value,
  an AI feature specification outline, cost-to-serve and trust, and the AI Act dates that affect the roadmap.'
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- launch
- measurement
sources:
- https://www.anthropic.com/engineering/building-effective-agents
- https://anthropic.com/engineering/demystifying-evals-for-ai-agents
- https://www.growthunhinged.com/p/usage-based-pricing-for-ai
- https://www.nngroup.com/articles/state-of-ux-2026/
- https://www.lennysnewsletter.com/p/building-eval-systems-that-improve
- https://www.lennysnewsletter.com/p/why-ai-evals-are-the-hottest-new-skill
- https://www.svpg.com/experimentation-ai-and-the-product-model/
- https://kylepoyar.substack.com/p/2025-state-of-b2b-monetization
- https://www.mindtheproduct.com/inside-atlassians-state-of-product-2026-key-takeaways/
- https://www.houthoff.com/insights/news/ai-act-transparency-obligations-and-the-ai-omnibus-regulation/
- https://artificialintelligenceact.eu/implementation-timeline/
related:
- product.ai-products.designing-ai-and-agent-experiences
seed_version: 1
cross_refs:
  '19':
  - product.ai-products.designing-ai-and-agent-experiences
---

**When to use this:** When designing, specifying or evaluating an AI feature: choosing the use case and architecture, writing the eval suite and pass thresholds, or checking cost-to-serve and AI Act dates.

**Source section:** 12. Building AI products

### Start with the simplest architecture that works

**[VENDOR; Dec 2024, modified Oct 2026; the page notes tooling has changed]** Anthropic's guidance on building agents is to prefer the simplest solution: a single well-prompted call with retrieval is often enough, and complexity should be added only when it measurably improves outcomes. Workflows, which follow predefined paths, suit well-defined tasks; agents suit open-ended ones. Agents cost more, are slower and compound errors, so they need sandbox testing, guardrails, stopping conditions and human checkpoints, and they should show their plan ([Anthropic, Building effective agents, Dec 2024, modified Oct 2026](https://www.anthropic.com/engineering/building-effective-agents)).

### Choosing AI use cases

**[INFERENCE]** The department favours AI use cases with three properties: the outcome can be checked in the environment, errors are cheap or reviewable, and a countable output exists to price on. The rule is the researchers' synthesis from Anthropic's outcome-grading point ([Anthropic, Demystifying evals for AI agents, 9 Jan 2026](https://anthropic.com/engineering/demystifying-evals-for-ai-agents)) and the pricing guidance on countable outputs ([Growth Unhinged, The AI monetization debate shifts again, Oct 2026](https://www.growthunhinged.com/p/usage-based-pricing-for-ai)). **[FAST-MOVING, Jan 2026; practitioner opinion]** NN/g expects 2026 to be a year of "AI fatigue" with low-value AI features and recommends using AI where it solves a user problem and keeping it in the background ([NN/g, State of UX 2026, 16 Jan 2026](https://www.nngroup.com/articles/state-of-ux-2026/)).

### Evaluation vocabulary

**[VENDOR; 9 Jan 2026]** Anthropic's evaluation vocabulary: a task is one test case; a trial is one attempt at it; a grader scores the result; a transcript is the record of the attempt; the outcome is the real end state, for example whether the booking exists; and a suite is a set of tasks. Graders come in three kinds: code-based (cheap, objective, brittle), model-based (flexible, needs calibration against humans) and human (the gold standard, slow) ([Anthropic, Demystifying evals for AI agents, 9 Jan 2026](https://anthropic.com/engineering/demystifying-evals-for-ai-agents)).

### Building an eval suite

**[VENDOR; 9 Jan 2026]** Anthropic's guidance on building an eval suite: start with 20 to 50 tasks drawn from real failures, manual pre-release checks, bug trackers and support queues. Capability evals should start with low pass rates; regression evals should sit near 100%. Balance cases where a behaviour should occur with cases where it should not. Grade outcomes and not step sequences. Read the transcripts. Replace evals that have saturated ([Anthropic, Demystifying evals for AI agents, 9 Jan 2026](https://anthropic.com/engineering/demystifying-evals-for-ai-agents)).

### Consistency: pass@k versus pass^k

**[VENDOR; 9 Jan 2026]** Anthropic distinguishes two metrics for non-deterministic systems: pass@k, at least one success in k tries, and pass^k, all k tries succeed. A 75% per-trial success rate gives about 42% for three successes in a row, and consistency across repeated runs is what customer-facing use requires ([Anthropic, Demystifying evals for AI agents, 9 Jan 2026](https://anthropic.com/engineering/demystifying-evals-for-ai-agents)). **[INFERENCE]** Customer-facing AI flows should carry a pass^k target in the specification, not a single-run pass rate.

### Error analysis before writing evals

**[FAST-MOVING, Sep 2025; practitioner opinion]** Husain and Shankar's error-analysis method for AI products: appoint one domain expert as quality authority; sample about 100 real interactions; write free-form critiques with a pass or fail judgment (open coding); cluster the critiques into fewer than about 10 failure modes (axial coding); count them; use code checks for objective failures and a language-model judge for subjective ones; use binary labels and not 1 to 5 scales; split labelled data roughly 10 to 20% for prompt examples, 40 to 45% for development and 40 to 45% for test; and judge the judge by its true-positive and true-negative rates ([Lenny's Newsletter, Building eval systems that improve your AI product, 9 Sep 2025](https://www.lennysnewsletter.com/p/building-eval-systems-that-improve)). The same authors say always to begin with error analysis before writing evals, and that dogfooding alone is not enough for most AI products ([Lenny's Newsletter, Why AI evals are the hottest new skill, 25 Sep 2025](https://www.lennysnewsletter.com/p/why-ai-evals-are-the-hottest-new-skill)).

### Evals for quality, A/B tests for value

**[FAST-MOVING, Oct 2026; practitioner opinion]** SVPG's position on AI product discovery is that it includes an eval process, that many quality calls are subjective, and that evals are used for quality while A/B tests establish value ([SVPG, Experimentation, AI and the Product Model, Oct 2026](https://www.svpg.com/experimentation-ai-and-the-product-model/)).

### An AI feature specification outline

**[INFERENCE]** The department's specification for an AI feature has nine parts: the user job and the cost of failure; the simplest viable architecture and why; the eval suite, capability and regression, with a pass^k target for customer-facing flows; grader types per failure mode; human-in-the-loop points for irreversible or high-cost actions; disclosure and marking under Article 50; cost-to-serve per unit of output and how price covers it; monitoring and feedback capture; and rollback. The outline is the researchers' synthesis from the Anthropic guidance ([Anthropic, Building effective agents, Dec 2024, modified Oct 2026](https://www.anthropic.com/engineering/building-effective-agents); [Anthropic, Demystifying evals for AI agents, 9 Jan 2026](https://anthropic.com/engineering/demystifying-evals-for-ai-agents)).

### Cost-to-serve and trust

**[FAST-MOVING, 2025 to 2026; survey and practitioner reports]** Cost and margin was the leading factor in AI pricing decisions in the 2025 survey ([Growth Unhinged, 2025 State of B2B Monetization, survey fielded Apr-May 2025](https://kylepoyar.substack.com/p/2025-state-of-b2b-monetization)), and pass-through-plus-fee models appeared in 2026 ([Growth Unhinged, The AI monetization debate shifts again, Oct 2026](https://www.growthunhinged.com/p/usage-based-pricing-for-ai)). Lack of trust was the second most common barrier to AI adoption in product teams in Atlassian's 2026 report ([Mind the Product summary of Atlassian's State of Product 2026, Sep 2025](https://www.mindtheproduct.com/inside-atlassians-state-of-product-2026-key-takeaways/)). **[GAP]** No cost-to-serve benchmark per AI interaction and no gross-margin norm was found. Product guidance from OpenAI was not fetched, and Google's People + AI Guidebook was read for one chapter only (section 19).

### Sweden and EU: AI Act dates that affect the roadmap

**[FAST-MOVING, Sep 2026; secondary source only]** A law-firm summary states that Article 50 transparency obligations have applied since 2 August 2026 whether or not a system is high-risk; that the AI Omnibus Regulation came into force on 27 July 2026 and moved the high-risk dates to 2 December 2027 for Annex III systems and 2 August 2028 for Annex I product-embedded systems; and that systems placed on the market before 2 August 2026 have until 2 December 2026 to meet the machine-readable marking duty in Article 50(2) ([Houthoff, 1 Sep 2026](https://www.houthoff.com/insights/news/ai-act-transparency-obligations-and-the-ai-omnibus-regulation/)). An unofficial timeline page updated 31 August 2026 lists the same dates ([AI Act implementation timeline, artificialintelligenceact.eu, updated 31 Aug 2026](https://artificialintelligenceact.eu/implementation-timeline/)). **[GAP]** The Omnibus's Official Journal reference and the Act's text were not checked on a primary EU source; confirm the dates with Legal before relying on them. This is orientation and not legal advice.
