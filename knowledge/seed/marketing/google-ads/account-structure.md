---
id: marketing.google-ads.account-structure
department: marketing
domain: google-ads
title: 'Google Ads account structure for late 2026: match types, consolidation and local services'
summary: Consolidate around goals and guardrails, group keywords by theme, use exact for efficiency, phrase as the workhorse and broad only with rich signals; Dynamic Search Ads became AI Max, Display moves into Demand Gen, and Local Services Ads move into Performance Max.
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- google-ads
objectives:
- sales
- leads
sources:
- https://ppc.land/google-marketing-live-2026-every-announcement-that-actually-matters
- https://support.google.com/google-ads/answer/6167110?hl=en
- https://optmyzr.com/blog/google-ads-match-type-performance
- https://lineardesign.com/blog/google-performance-max-a-practical-guide/
- https://support.google.com/google-ads/answer/17213585
related:
- marketing.google-ads.ai-max-and-ai-overviews
- marketing.google-ads.performance-max-and-feeds
- marketing.google-ads.display-to-demand-gen
- marketing.google-ads.bidding
seed_version: 1
---

**When to use this:** When building or auditing a Google Ads account structure.

## Account structure for late 2026

**[FAST-MOVING, May 2026]** Google's direction at Google Marketing Live on 20 May 2026 was consolidation, with control moving to goals and guardrails while Gemini handles matching, creative and optimisation. **Dynamic Search Ads automatically upgrade to AI Max in September 2026**, so any plan built on Dynamic Search Ads is out of date ([PPC Land](https://ppc.land/google-marketing-live-2026-every-announcement-that-actually-matters)). **Standalone Display campaigns are being retired into Demand Gen** (announced 26 May 2026, full migration expected in 2027; details below). **[DURABLE]** Google's structure guidance is to group keywords by theme, since Smart Bidding learns at query level and learnings transfer across the account, and to choose the bidding goal first because it determines targeting ([Google Ads Help](https://support.google.com/google-ads/answer/6167110?hl=en)). **[INFERENCE]** A sensible default is brand Search on exact and phrase with tight controls; non-brand Search by theme with broad match or AI Max under conversion-based bidding; Performance Max (feed-based for retail, CRM-qualified conversions for lead generation); Demand Gen for mid-funnel video, image and creator assets and, from 2026, for Display Network inventory; and Standard Shopping only with a defined role. Legacy Dynamic Search Ads campaigns should be audited for URL exclusions, brand controls and text-customisation settings.

## Match types: exact for efficiency, phrase as workhorse, broad only with rich signals

**[VENDOR study, Feb 2026 data, 30,000 accounts]** Optmyzr found that for non-brand search, exact match leads on efficiency, broad generates the most volume at lower efficiency, and phrase takes the largest share of spend; in lead generation broad loses more ground than in ecommerce. Broad match is "a bet on the algorithm" that performs best when Smart Bidding has conversion value or strong conversion volume ([Optmyzr, 11 May 2026](https://optmyzr.com/blog/google-ads-match-type-performance)). **[DURABLE]** Use negatives to block irrelevant queries, not queries that merely failed to convert on a small sample ([Linear Design, 18 Sep 2026](https://lineardesign.com/blog/google-performance-max-a-practical-guide/)).

## Local services

**[FAST-MOVING, 2026 to 2027]** Local Services Ads are migrating into Google Ads as Performance Max pay-per-lead campaigns, starting August 2026 for select US categories and reaching **non-US accounts in 2027**; manual cost-per-lead bidding is no longer supported and Google Business Profile accuracy becomes an advertising dependency ([Google Ads Help](https://support.google.com/google-ads/answer/17213585)).
