---
id: product.metrics.metrics-and-experimentation
department: product
domain: metrics
title: 'Product: Metrics and experimentation'
summary: 'Metrics and experimentation: the north-star metric and a metric tree, HEART, activation as the earliest milestone that predicts
  retention (benchmarks dated 2022), cohort retention, feature adoption, metrics for usage-priced products, A/B tests needing large
  samples and when not to run them, qualitative for why and quantitative for how much, and consent shrinking the measurable sample in
  Sweden and the EU.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- measurement
- retain
sources:
- https://amplitude.com/blog/product-north-star-metric
- https://amplitude.com/books/north-star
- https://www.lennysnewsletter.com/p/what-is-a-good-activation-rate
- https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/36299.pdf
- https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/
- https://www.shortform.com/podcast/episode/the-game-w-alex-hormozi-2026-04-23-episode-summary-before-you-run-ads-fix-this-one-thing-first-ep-964
- https://productled.com/blog/product-led-growth-benchmarks
- https://amplitude.com/benchmarks/engagement
- https://mixpanel.com/blog/how-to-find-product-market-fit-with-data/
- https://www.lennysnewsletter.com/p/what-is-good-retention-issue-29
- https://www.pendo.io/resources/the-2019-feature-adoption-report/
- https://www.productledalliance.com/product-management-statistics/
- https://www.growthunhinged.com/p/usage-based-pricing-for-ai
- https://arxiv.org/pdf/2212.11366v1
- https://www.svpg.com/experimentation-ai-and-the-product-model/
- https://anthropic.com/engineering/demystifying-evals-for-ai-agents
- https://cm.twobirds.com/en/trending-topics/global-cookie-review/sweden
related:
- product.strategy.product-strategy
- product.compliance.compliance-by-design
seed_version: 1
cross_refs:
  '5':
  - product.strategy.product-strategy
  '18':
  - product.compliance.compliance-by-design
---

**When to use this:** When choosing a north-star or activation metric, reading retention or adoption, designing or judging an A/B test, or deciding whether you have enough traffic to experiment.

**Source section:** 9. Metrics and experimentation

### The north-star metric

**[VENDOR; Aug 2024]** Amplitude's criteria for a north-star metric are that it reflects the moment customers get value, represents the product strategy, and leads future results. Revenue and average revenue per user are lagging measures and unsuitable. A product picks one of three "games": attention (time spent), transaction (number of transactions) or productivity (work done efficiently); most B2B SaaS plays the productivity game ([Amplitude, Product North Star Metric, 20 Aug 2024](https://amplitude.com/blog/product-north-star-metric)). Amplitude states the framework's purpose as connecting customer language, product language and business language so that everyone can tie work to a sustainable growth strategy ([Amplitude, North Star Playbook](https://amplitude.com/books/north-star)).

**[VENDOR; Aug 2024]** Amplitude recommends one north-star metric per product with three to five input metrics that the team can directly move, and offers a heuristic for inputs: breadth, depth, frequency and efficiency. Its example for self-serve SaaS is trial accounts with more than three users active in week one ([Amplitude, Product North Star Metric, 20 Aug 2024](https://amplitude.com/blog/product-north-star-metric)). **[INFERENCE]** For a B2B SaaS product a productivity-game north star of the form "accounts completing the core job at least N times a week" fits these criteria, with inputs following breadth (accounts), depth (jobs per account), frequency and efficiency (time to complete). **[GAP]** The checklist chapter of Amplitude's playbook returned only a table of contents; the criteria above come from its 2024 blog version.

### A metric tree for the department

**[INFERENCE]** The department's metric tree has six layers: one north-star metric that expresses value delivered to customers and leads revenue; three to five inputs that teams can move; an activation definition with a time bound; cohort retention, both logo and revenue, by signup month; feature adoption per feature measured as reach, depth and repeat use; and guardrails for latency, support contacts and cost-to-serve. The tree is the researchers' synthesis from the Amplitude criteria ([Amplitude, Product North Star Metric, 20 Aug 2024](https://amplitude.com/blog/product-north-star-metric)) and the activation guidance below ([Lenny's Newsletter, What is a good activation rate, 25 Oct 2022](https://www.lennysnewsletter.com/p/what-is-a-good-activation-rate)).

### HEART: five categories of user-centred metrics

**[DURABLE; academic, primary paper, CHI 2010]** The HEART framework from Rodden, Hutchinson and Fu at Google defines five categories. Happiness covers attitudes such as satisfaction and ease of use, tracked by survey. Engagement is the frequency, intensity or depth of use, best expressed as per-user averages. Adoption is new users starting to use a product or feature in a period. Retention is users from one period still active in a later one. Task success covers completion rate, time on task and error rate ([Rodden, Hutchinson and Fu, Google, CHI 2010 paper (PDF)](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/36299.pdf); [Google Research publication page for the HEART paper, 2010](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/)).

**[DURABLE; academic, primary paper, CHI 2010]** The HEART paper's Goals-Signals-Metrics process is: agree goals first without worrying about measurability; identify the behaviour or attitude signals of success and failure, noting that failure signals such as abandonment are often easier to find; then turn signals into normalised metrics such as ratios or per-user averages. The paper contrasts HEART with PULSE (page views, uptime, latency, seven-day actives, earnings), which it treats as business and technical health measures that can rise for bad reasons ([Rodden, Hutchinson and Fu, Google, CHI 2010 paper (PDF)](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/36299.pdf)).

### Activation: choose the earliest milestone that predicts retention

**[DURABLE; practitioner opinion with survey data, Oct 2022]** Guidance from Lenny Rachitsky and Yuriy Timen on choosing an activation milestone: it should be predictive, meaning users who hit it retain at least twice as well; actionable at the level of the individual user; neither too early, such as signup, nor too late, such as a repeat purchase; and simple. Start from a hypothesis and then confirm that moving the milestone moves later metrics. Activation rate is users reaching the milestone divided by users completing signup ([Lenny's Newsletter, What is a good activation rate, 25 Oct 2022](https://www.lennysnewsletter.com/p/what-is-a-good-activation-rate)). **[INFERENCE; adapts HOUSE STYLE]** Hormozi's "activation point" is the same construct, and his method of comparing retained and churned customers ([Shortform summary of The Game Ep 964, 23 Apr 2026](https://www.shortform.com/podcast/episode/the-game-w-alex-hormozi-2026-04-23-episode-summary-before-you-run-ads-fix-this-one-thing-first-ep-964)) matches the "predictive" test.

### Activation benchmarks, dated 2022

**[FAST-MOVING, 25 Oct 2022, possibly outdated; self-reported survey]** The last large public activation survey in this research covered more than 500 products in October 2022. Overall the mean activation rate was 34% and the median 25%; for SaaS only, the mean was 36% and the median 30%. The authors define good as the 60th percentile and great as the 80th. About 6% of respondents used a time-bound definition, with a median window of 10 days and 7 days the most common; about 10% used a two-part milestone ([Lenny's Newsletter, What is a good activation rate, 25 Oct 2022](https://www.lennysnewsletter.com/p/what-is-a-good-activation-rate)). Present these figures as the last large public survey and not as a 2026 norm. **[VENDOR; Feb 2025]** A ProductLed survey reports that only about a third of surveyed product-led companies track activation at all ([ProductLed with Gainsight, Product-Led Growth Benchmarks, 6 Feb 2025](https://productled.com/blog/product-led-growth-benchmarks)). **[GAP]** No 2025 to 2026 activation benchmark was found in a usable source; Amplitude's benchmark pages exist but failed to load ([Amplitude benchmarks page, title only, not read](https://amplitude.com/benchmarks/engagement)).

### Cohort retention

**[INFERENCE]** The department tracks retention by signup-month cohort to the point where the curve flattens, for both logos and revenue, and treats the height of the plateau as the number to raise. The practice follows Mixpanel's retention-curve guidance ([Mixpanel, How to find PMF with data, Jul 2024, edited Jan 2025](https://mixpanel.com/blog/how-to-find-product-market-fit-with-data/)); the category benchmarks from 2020 are in section 5 ([Lenny's Newsletter, What is good retention, Jun 2020, modified Jan 2024](https://www.lennysnewsletter.com/p/what-is-good-retention-issue-29)).

### Feature adoption

**[VENDOR; 2019, pre-2024]** Pendo's 2019 Feature Adoption Report measured 615 Pendo customer subscriptions over three months and found that about 80% of features were rarely or never used and that about 12% of features produced 80% of daily usage. A "feature" in this data is a Pendo tag, so the result depends on what customers chose to tag, which inflates the unused share ([Pendo, The 2019 Feature Adoption Report](https://www.pendo.io/resources/the-2019-feature-adoption-report/)). Use the figure as a prompt to audit usage and not as a benchmark. **[FAST-MOVING, Q4 2025; survey]** In the PLA/ProductPlan survey, 28.7% use workflow or feature adoption as a success metric ([Product-Led Alliance statistics page citing the PLA/ProductPlan State of Product Management 2026, published May 2026](https://www.productledalliance.com/product-management-statistics/)). **[GAP]** Pendo's newer benchmark pages and any 2024 to 2026 feature-adoption figures were not retrieved.

### Metrics for usage-priced products

**[FAST-MOVING, Oct 2026; practitioner opinion]** For usage-priced products, Growth Unhinged recommends adding two metrics: time-to-ramp, the time for the average customer to reach 80% of its usage allowance, and share of wallet ([Growth Unhinged, The AI monetization debate shifts again, Oct 2026](https://www.growthunhinged.com/p/usage-based-pricing-for-ai)).

### A/B testing needs large samples

**[DURABLE; academic, 2022]** The sample-size rule of thumb for an A/B test is n ≈ 16σ²/δ² per variant at 80% power and a 0.05 significance level. The paper's worked example, with 5% conversion and a $25 average order, shows that detecting a 5% change in revenue needs about 147,456 users per variant. If fewer than 20% of users are exposed to a change, a whole-population test can be badly under-powered ([Larsen, Stallrich, Sengupta, Deng, Kohavi and Stevens, Statistical Challenges in Online Controlled Experiments, 2022](https://arxiv.org/pdf/2212.11366v1)).

**[DURABLE; academic, 2022]** The same review lists common A/B testing errors: peeking at results and stopping early inflates false positives, with always-valid p-values (mSPRT) as one remedy; p-values are commonly misread; and long tests can lose over 75% of users to cookie churn ([Larsen, Stallrich, Sengupta, Deng, Kohavi and Stevens, Statistical Challenges in Online Controlled Experiments, 2022](https://arxiv.org/pdf/2212.11366v1)). **[GAP]** Per-company experiment success rates and Twyman's law were not in the retrieved portion of the paper.

### When not to A/B test

**[INFERENCE]** The department does not run an A/B test in four cases: when weekly eligible users are far below the n ≈ 16σ²/δ² requirement for the smallest effect worth having; when the change is a strategic or legal necessity; when the exposed fraction is small and cannot be triggered cleanly; and when the question is why something happens. Most early-stage EU B2B SaaS products fall into the first case for everything except top-of-funnel pages. The rule is the researchers' synthesis from the sample-size mathematics ([Larsen, Stallrich, Sengupta, Deng, Kohavi and Stevens, Statistical Challenges in Online Controlled Experiments, 2022](https://arxiv.org/pdf/2212.11366v1)). Low-traffic B2B products lean on qualitative tests, evals and cohort analysis instead.

### Qualitative for why, quantitative for how much

**[FAST-MOVING, Oct 2026; practitioner opinion]** SVPG's guidance on experimentation is to use qualitative methods for why and quantitative methods for causality and size. For AI products, quantitative tests cost more and their conclusions may not persist, so evals are used for quality early and A/B tests are reserved for establishing value. SVPG recommends that product teams own their experiments with support from an enablement group it calls experimentation ops ([SVPG, Experimentation, AI and the Product Model, Oct 2026](https://www.svpg.com/experimentation-ai-and-the-product-model/)). **[VENDOR; Jan 2026]** Anthropic makes a compatible point: A/B testing measures real outcomes but is slow, needs traffic and says little about why, so teams should combine automated evals, production monitoring, A/B tests, user feedback, transcript review and human studies as overlapping layers ([Anthropic, Demystifying evals for AI agents, 9 Jan 2026](https://anthropic.com/engineering/demystifying-evals-for-ai-agents)).

### Sweden and EU: consent shrinks the measurable sample

**[FAST-MOVING, law-firm guide undated, refers to 2023 events; secondary source only]** In Sweden the cookie rule sits in the Electronic Communications Act (2022:482), chapter 9, section 28: consent is required for any cookie or similar technology that is not necessary for a service the user expressly requested, and analytics cookies get no exemption ([Bird & Bird, Global Cookie Review, Sweden, undated, refers to 2023 events](https://cm.twobirds.com/en/trending-topics/global-cookie-review/sweden)). **[INFERENCE]** Product analytics that stores or reads data on the user's device therefore needs prior opt-in consent, and the measured sample for EU traffic will be materially smaller than the real one; experiments must be sized on consented traffic. The consent rules are detailed in section 18. This is orientation and not legal advice.
