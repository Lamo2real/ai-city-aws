---
id: marketing.meta-ads.existing-customers-and-budget-type
department: marketing
domain: meta-ads
title: Replace the removed existing-customer cap with two ad sets, and default to campaign budget
summary: Meta removed the existing-customer budget cap; replicate it with a campaign budget and either an exclusion ad set or a second existing-customer ad set with a spending limit, and use ad set budgets only when ad sets need different bids or schedules.
type: playbook
audience: worker
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- meta
objectives:
- sales
sources:
- https://www.facebook.com/business/help/1142614290190459
- https://www.facebook.com/business/help/830005979993164
- https://www.facebook.com/business/ads/meta-advantage/advantage-plus-shopping-ads
- https://www.facebook.com/business/help/1602924913861363
related:
- marketing.meta-ads.delivery-and-account-structure
- marketing.meta-ads.learning-phase-and-budgets
seed_version: 1
---

**When to use this:** When setting up Advantage+ sales campaigns or choosing between campaign and ad set budgets.

## The existing-customer budget cap is gone; replicate it with two ad sets

**[FAST-MOVING, Meta Help Center read 10 Nov 2026]** Meta states that the existing customer budget cap "is no longer available. You can still do the same thing manually." The replacement recipe is to use a campaign budget and then either run one ad set that excludes existing customers, or run two ad sets where the existing-customer ad set carries a spending limit ([Meta Business Help Center](https://www.facebook.com/business/help/1142614290190459); [Meta Business Help Center](https://www.facebook.com/business/help/830005979993164)). Meta's own Advantage+ shopping marketing page still lists the cap as an optional setup step and is stale relative to the help centre ([Meta marketing page](https://www.facebook.com/business/ads/meta-advantage/advantage-plus-shopping-ads)). **[INFERENCE]** Any playbook instruction to "cap existing-customer spend inside Advantage+ sales" must be rewritten as the two-ad-set structure with a spending limit.

## Choose campaign budget unless ad sets need different bids or schedules

**[FAST-MOVING, Meta Help Center read 10 Nov 2026]** For the Sales, App promotion and Leads objectives, budget strategy is chosen at campaign level. Campaign budget automatically distributes spend across ad sets to get the best overall results and allows ad set spending limits when control is needed; a campaign with one ad set behaves the same as an ad set budget. Ad set budgets are for cases where ad sets need different bid strategies or budget schedules ([Meta Business Help Center](https://www.facebook.com/business/help/1602924913861363)).
