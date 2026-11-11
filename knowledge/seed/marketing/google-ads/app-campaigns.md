---
id: marketing.google-ads.app-campaigns
department: marketing
domain: google-ads
title: 'Google App campaigns: budget-to-bid ratios and stability through 100 conversions'
summary: Set daily budget at 50, 10 or 15 times the bid depending on subtype and strategy, avoid disruptive changes before 100 conversions, target one in-app action, and on iOS consolidate to eight or fewer install campaigns.
type: playbook
audience: worker
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- google-ads
objectives:
- app-installs
sources:
- https://support.google.com/google-ads/answer/6247380
- https://support.google.com/google-ads/answer/14104492
- https://support.google.com/google-ads/answer/10384955
- https://seroundtable.com/google-ads-conversion-lift-measurement-self-service-42250.html
related:
- marketing.google-ads.bidding
- marketing.meta-ads.playbooks-ecommerce-local-apps
seed_version: 1
---

**When to use this:** When launching or managing Google App campaigns.

## App campaigns: budget-to-bid ratios and stability through 100 conversions

**[DURABLE; Google Ads Help, fetched 11 Nov 2026]** App campaigns have three subtypes: installs, engagement (re-engaging existing users) and pre-registration. Ads run on Search and search partners, Google Play, YouTube, the Display Network and Discover, using text, image, video and HTML5 assets that can draw on the store listing ([Google Ads Help](https://support.google.com/google-ads/answer/6247380)). Set daily budget at **at least 50 times the bid for install campaigns on target cost per install and for pre-registration, 10 times for install campaigns on target CPA, and 15 times for engagement campaigns on target CPA**. Avoid disruptive changes until the first 100 conversions register, avoid cycling bids up and down, and avoid drastic changes to conversion settings, optimisation goal, targeted events or geography. For target CPA, target one in-app action, because multiple actions behave as a blended target. For target ROAS, confirm the event carries a value and keep conversion windows under 30 days while capturing about 90% of conversions; leave the install event without a value unless installs have inherent economic value. Each ad group should reach at least "Good" Ad Strength with at least one headline, description, image and video, and deep links (deferred deep links for install campaigns) are recommended. Pre-registration campaigns only serve in countries where the app is open for pre-registration in Play Console ([Google Ads Help](https://support.google.com/google-ads/answer/14104492)).

**[FAST-MOVING; Google Ads Help]** For iOS, Google advises consolidating to 8 or fewer install campaigns and says this limit will be removed for apps with on-device measurement event data. On-device conversion measurement has an event-data version (no user-identifying data leaves the device) and a first-party version for apps with significant sign-in; events must be imported from a primary GA4 or Firebase property, and Firebase iOS SDK v12.12.1 or later is recommended. SKAdNetwork reporting sits under Reports > Other > SKAN conversions, and the conversion value schema should include every biddable event. The page states Google does not currently support AdAttributionKit for attribution. Integrated Conversion Measurement works with attribution partners (Adjust, Airbridge, AppsFlyer, Branch, Kochava, Singular, Tenjin) ([Google Ads Help](https://support.google.com/google-ads/answer/10384955)). App campaigns targeting iOS are excluded from Conversion Lift ([Search Engine Roundtable, 8 Oct 2026](https://seroundtable.com/google-ads-conversion-lift-measurement-self-service-42250.html)).
