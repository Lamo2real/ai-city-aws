---
id: marketing.google-ads.assets-quality-score-and-ad-rank
department: marketing
domain: google-ads
title: Asset coverage, Quality Score and Ad Rank
summary: Expected asset impact is one of six Ad Rank factors, so cover every relevant asset type; Quality Score is a keyword-level diagnostic, not a KPI, whose weak component points to the lever to pull.
type: playbook
audience: worker
confidence: established
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms:
- google-ads
objectives:
- sales
- leads
sources:
- https://support.google.com/google-ads/answer/7332837
- https://support.google.com/google-ads/answer/6167118
- https://support.google.com/google-ads/answer/1722122
related:
- marketing.google-ads.responsive-search-ads-and-ad-strength
- marketing.conversion.what-converts
seed_version: 1
---

**When to use this:** When diagnosing high CPCs or low impression share, or adding ad assets.

## Ad assets: coverage matters because expected asset impact is in Ad Rank

**[DURABLE; Google Ads Help]** Asset types are location, call, sitelink, callout, structured snippet, text disclaimer (guaranteed to appear in the RSA description line), price, promotion, app, lead form and image. Google suggests at least four asset types and using every asset relevant to the business. Showing assets requires a minimum Ad Rank; higher positions get first claim on asset space; a lower ad cannot receive an asset combination with a higher expected CTR than the ad above it; and approved assets only show when predicted to help. Assets are free to add; clicks are charged as usual (seller ratings are not charged) and no more than two clicks per impression are billed ([Google Ads Help](https://support.google.com/google-ads/answer/7332837)). **[INFERENCE]** Because Ad Strength is excluded from the auction but the expected impact of assets is one of the six Ad Rank factors, the practical priority is asset coverage (sitelinks, images, callouts, business name and logo), not chasing an "Excellent" label.

## Quality Score is a keyword-level diagnostic; ad quality in the auction is what counts

**[DURABLE; Google Ads Help]** Quality Score is scored 1 to 10 at keyword level from three components (expected CTR, ad relevance and landing page experience), each rated Above average, Average or Below average against advertisers whose ads showed for the exact same search over the last 90 days. Google states that it "is not a key performance indicator", should not be optimised or aggregated, and does not factor into the ad auction. The score is based on impressions for exact searches of the keyword, so changing match type does not change it; a dash means too few exact-match searches to compute a score; and the score may not reflect device, location, time of day or assets. To diagnose, add the Quality Score, Landing Page Exp., Exp. CTR and Ad Relevance columns (and their historical versions) in the Keywords table and segment by day ([Google Ads Help](https://support.google.com/google-ads/answer/6167118)). **[DURABLE]** Ad Rank is calculated twice per auction (for eligibility, then for ranking) from six factors: bid; ad and landing page quality; Ad Rank thresholds; auction competitiveness; search context (terms, location, device, time, other results, user signals); and the expected impact of assets and formats. Ad quality helps set the thresholds an ad must clear and is a component of position, and "Higher quality ads can often lead to lower CPCs"; the bid is a ceiling and the actual CPC is often lower ([Google Ads Help](https://support.google.com/google-ads/answer/1722122)). **[INFERENCE]** Use Quality Score for triage: a Below-average component points to the lever (ad copy and keyword fit for ad relevance, creative and assets for expected CTR, page relevance and usability for landing page experience). With broad match, AI Max and Performance Max taking more traffic, more auctions happen on queries with no visible keyword-level score.
