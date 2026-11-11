---
id: marketing.meta-ads.learning-phase-and-budgets
department: marketing
domain: meta-ads
title: Size Meta budgets to about 50 results per ad set per week, and know which edits reset learning
summary: Ad sets exit learning after about 50 results in the week after the last significant edit; Meta lists which edits always reset learning and publishes no percentage rule, so budget about 50 times expected cost per event and change one thing at a time.
type: playbook
audience: worker
confidence: established
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms:
- meta
objectives:
- sales
- leads
sources:
- https://www.facebook.com/business/help/112167992830700
- https://www.facebook.com/business/help/316478108955072
- https://segwise.ai/blog/meta-advantage-plus-app-campaigns-guide
- https://searchengineland.com/meta-ai-driven-advertising-system-andromeda-gem-468020
- https://growthmarketer.com/blog/meta-campaign-structure-2026/
related:
- marketing.meta-ads.delivery-and-account-structure
- marketing.meta-ads.existing-customers-and-budget-type
- marketing.google-ads.bidding
seed_version: 1
---

**When to use this:** When setting Meta budgets, editing live ad sets, or diagnosing "learning limited".

## Size budgets to about 50 results per ad set per week

**[DURABLE; Meta Help Center read 10 Nov 2026]** The learning phase is the period when the delivery system still needs to learn how an ad set will deliver; it starts when a new ad or ad set is created or a significant edit is made. Ad sets exit as soon as they can deliver stably, which "usually occurs after about 50 results in the week after the ad set's last significant edit". The unit is results (the ad set's optimisation outcome), counted per ad set, in a rolling week from the last significant edit. Shops ads are an exception, needing a minimum of 17 website purchases and 5 purchases through Meta. Ads Manager has a "Last significant edit" column to compare with the Results column. "Learning limited" is the delivery status when an ad set is not getting enough results to exit. Meta's four stated practices are to wait to edit until out of learning, avoid unnecessary edits, avoid high ad volumes by combining similar ad sets, and use realistic budgets without frequent budget changes; Meta also says not to try to avoid the learning phase entirely, because testing is necessary ([Meta Business Help Center](https://www.facebook.com/business/help/112167992830700)).

**[DURABLE; Meta Help Center read 10 Nov 2026]** Edits that are always significant: any change to targeting, any change to ad creative, any change to optimisation event, adding a new ad to the ad set, pausing the ad set for 7 days or longer (learning restarts on unpause), and changing bid strategy. Edits that are significant only depending on magnitude: ad set spending limit, bid control, cost-per-result goal or ROAS goal amount, and budget amount. Meta's only worked example is that $100 to $101 is unlikely to reset learning while $100 to $1,000 may. **Meta publishes no percentage threshold; the widely quoted "20% rule" is not in the official page.** With Advantage+ campaign budget, changing the campaign bid strategy or campaign budget can send multiple ad sets back into learning, but budget redistribution between ad sets does not reset learning, an ad-set-level edit does not reset sibling ad sets, and adding a new ad set does not reset the others ([Meta Business Help Center](https://www.facebook.com/business/help/316478108955072)).

**[VENDOR rule of thumb]** Weekly budget of about 50 times expected cost per event, so $60 purchases need about $3,000 a week; "learning limited" usually reflects a small audience, low budget, tight cost controls, audience overlap, an infrequent event or too many ads ([Segwise, 3 Nov 2026](https://segwise.ai/blog/meta-advantage-plus-app-campaigns-guide)). Set a no-touch window before launch, such as one week or 50 to 75 conversions, and judge on 3 to 7 day rolling windows ([Search Engine Land](https://searchengineland.com/meta-ai-driven-advertising-system-andromeda-gem-468020)). **[CONTESTED]** One practitioner rejects both a universal seven-day rule and a universal "scale 20 to 30% at a time" rule, recommending a window committed to in advance and steps sized to the account ([growthmarketer.com](https://growthmarketer.com/blog/meta-campaign-structure-2026/)); Meta's own page supports neither percentage. **[INFERENCE]** If the true goal event cannot reach about 50 a week, consolidate ad sets, raise budget, or optimise to a higher-funnel proxy. For an automated agent, a conservative default is small budget steps, one change at a time, with the step size recorded as an account-level heuristic and not a Meta rule.
