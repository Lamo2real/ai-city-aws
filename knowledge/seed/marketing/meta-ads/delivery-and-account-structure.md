---
id: marketing.meta-ads.delivery-and-account-structure
department: marketing
domain: meta-ads
title: 'Meta delivery starts from creative and signal: consolidate and go broad, then verify per account'
summary: Meta's AI delivery (Andromeda, GEM, Lattice) rewards fewer campaigns, broad targeting and pooled budgets; use a bounded-learning, consolidated-scale, true-exceptions structure and check that broad still works for the account.
type: playbook
audience: both
confidence: contested
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- meta
- facebook
- instagram
objectives:
- sales
- leads
sources:
- https://searchengineland.com/meta-ai-driven-advertising-system-andromeda-gem-468020
- https://ai.meta.com/blog/ai-ads-performance-efficiency-meta-lattice/
- https://www.triplewhale.com/blog/meta-ads-ai-system
- https://arxiv.org/html/2512.09200v2
- https://growthmarketer.com/blog/meta-campaign-structure-2026/
- https://www.jonloomer.com/meta-ads-lead-generation/
- https://www.facebook.com/business/help/1362234537597370
- https://www.facebook.com/business/help/992035952809423
related:
- marketing.meta-ads.learning-phase-and-budgets
- marketing.meta-ads.existing-customers-and-budget-type
- marketing.meta-ads.creative-diversification
requires:
- marketing.meta-ads.capi-emq-and-conversion-lift
seed_version: 1
---

**When to use this:** When structuring a new Meta account or consolidating an existing one.

## The delivery system starts from creative and signal, not audiences

**[FAST-MOVING in detail; DURABLE in outline]** Meta's delivery stack is a chain of AI models. Andromeda is the retrieval stage that decides which ads are eligible, evaluating creative, copy, format and historical engagement before predicting which users will engage; GEM is the foundation ranking model learning across organic interactions and ad sequences ([Search Engine Land](https://searchengineland.com/meta-ai-driven-advertising-system-andromeda-gem-468020)). Lattice is the unified prediction architecture that replaced many smaller models predicting ad performance across datasets and optimisation goals. Meta's AI blog says it "built and deployed Meta Lattice", secondary sources date that post to **May 2023**, and a research paper followed in December 2025; Lattice is therefore a 2023 architecture that later work builds on, not a 2025 or 2026 launch ([Meta AI blog](https://ai.meta.com/blog/ai-ads-performance-efficiency-meta-lattice/); [Triple Whale, 13 Apr 2026](https://www.triplewhale.com/blog/meta-ads-ai-system); [arXiv 2512.09200](https://arxiv.org/html/2512.09200v2)). **[PLATFORM CLAIM]** Meta attributes 5% more Instagram conversions and 3% more Facebook conversions to GEM ([Triple Whale](https://www.triplewhale.com/blog/meta-ads-ai-system)).

## Default to fewer campaigns and broad targeting, then verify per account

**[DURABLE in outline, CONTESTED in degree]** The agreed response is to consolidate campaigns and ad sets, since fewer campaigns, broader targeting and pooled budgets help the system learn faster while interest stacks and lookalikes have lost strength ([Search Engine Land](https://searchengineland.com/meta-ai-driven-advertising-system-andromeda-gem-468020)). A practical three-layer structure is bounded learning (ad set budgets, one hypothesis, capped from maximum allowable CAC), consolidated scale (Advantage+ campaign budget across proven ad sets with the same objective, bid strategy and economics), and true exceptions kept separate only for real differences in margin, market, catalog, or acquisition versus retention ([growthmarketer.com, updated 3 Nov 2026](https://growthmarketer.com/blog/meta-campaign-structure-2026/)). The counter-view is that broad targeting has hurt some accounts and manual targeting still wins for others; Triple Whale suggests tracking first-time impression ratio and aiming for 10 to 20% of monthly impressions to reach new people ([Triple Whale, 13 Apr 2026](https://www.triplewhale.com/blog/meta-ads-ai-system)). Value rules can adjust bids by age, location or conversion location in place of hard restrictions ([Jon Loomer](https://www.jonloomer.com/meta-ads-lead-generation/)).

**[FAST-MOVING, Meta Help Center read 10 Nov 2026]** Meta's own wording is that a sales campaign gets "the most advanced AI optimizations" when it uses Advantage+ audience, placement and budget together. **[PLATFORM CLAIM]** Meta says advertisers using Advantage+ sales campaigns saw a 9% improvement in cost per conversion on average. Meta now steers advertisers to "audience segments" for reporting breakdowns of new, engaged and existing audiences, and surfaces Advantage+ recommendations through Opportunity Score, which it says does not guarantee performance ([Meta Business Help Center](https://www.facebook.com/business/help/1362234537597370)). For Advantage+ leads campaigns, Advantage+ is "on" when budget, audience and placements are all automated; manually choosing placements or using ad set budgets turns it off; it works with instant forms, website forms, calls and click-to-message leads. **[PLATFORM CLAIM]** Meta's early tests showed 14% lower cost per lead and 10% lower cost per qualified lead against leads campaigns with Advantage+ off, and the page notes the feature may not be available to every account yet ([Meta Business Help Center](https://www.facebook.com/business/help/992035952809423)).
