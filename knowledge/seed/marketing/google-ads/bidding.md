---
id: marketing.google-ads.bidding
department: marketing
domain: google-ads
title: 'Google Ads bidding: bid to value, change slowly, judge by conversion count'
summary: Choose Maximize Conversions or Conversion Value by how trustworthy and varied values are, set targets from margin, allow up to about 50 conversions or three cycles to calibrate, and change targets in small steps one at a time.
type: playbook
audience: worker
confidence: contested
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- google-ads
objectives:
- sales
- leads
sources:
- https://lineardesign.com/blog/google-performance-max-a-practical-guide/
- https://www.techwyse.com/news/platform-updates/google-ads-smart-bidding-learning-period-50-conversions
- https://www.storegrowers.com/google-ads-bid-strategy/
- https://support.google.com/google-ads/answer/14693848
- https://www.seroundtable.com/google-ads-smart-bidding-exploration-budget-pacing-41288.html
related:
- marketing.measurement.unit-economics-formulas
- marketing.google-ads.seasonality-and-data-exclusions
- marketing.meta-ads.learning-phase-and-budgets
seed_version: 1
---

**When to use this:** When choosing or changing a Smart Bidding strategy, target or budget.

## Bidding: bid to value, change slowly, judge by conversion count

**[DURABLE]** Use Maximize Conversions only when conversions are similar in value, Maximize Conversion Value when values are trustworthy and different, and set targets from business economics and recent actuals; a 500% ROAS means very different things at 70% versus 15% gross margin ([Linear Design](https://lineardesign.com/blog/google-performance-max-a-practical-guide/)). **[FAST-MOVING, Sept 2026]** Google's updated documentation says calibration takes up to around **50 conversion events or three conversion cycles**, an approximate ceiling and not a requirement ([TechWyse, 23 Sep 2026](https://www.techwyse.com/news/platform-updates/google-ads-smart-bidding-learning-period-50-conversions)). **[CONTESTED thresholds]** Store Growers gives minimums of 15 conversions in 30 days for target CPA and 50+ recommended for target ROAS, target changes in 20 to 30% steps with a week between, and daily budget of at least twice target CPA when limited by budget ([Store Growers, 15 Jul 2026](https://www.storegrowers.com/google-ads-bid-strategy/)); Linear Design argues no universal minimum or fixed learning period exists. For Demand Gen, Google's own rule is stricter: adjust bids and budgets 5 to 10% per week and never more than 15%, do not evaluate before 50 conversions, and budget at least $100 a day for Maximize strategies or 10 times target CPA for target strategies ([Google Ads Help](https://support.google.com/google-ads/answer/14693848)). **[INFERENCE]** A conservative default for an automated agent is 10 to 15% per change, one change at a time, waiting at least one conversion cycle. **[FAST-MOVING, May 2026]** New features include journey-aware bidding (beta, target CPA Search, suited to complex lead-generation cycles) and demand-led budget pacing, which raises day-to-day spend variance, so pacing alerts should watch monthly run-rate ([Search Engine Roundtable](https://www.seroundtable.com/google-ads-smart-bidding-exploration-budget-pacing-41288.html)).
