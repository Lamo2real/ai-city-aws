---
id: marketing.seo.technical-and-content-basics
department: marketing
domain: seo
title: SEO technical and content basics, and the Core Web Vitals thresholds
summary: Pages must be indexable and snippet-eligible to appear in AI features, with no special AI markup; write from real experience, one page per distinct intent; good Core Web Vitals are LCP at most 2.5 s, INP at most 200 ms and CLS at most 0.1.
type: checklist
audience: worker
confidence: established
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms:
- google-search
objectives:
- awareness
- consideration
sources:
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://web.dev/articles/vitals
- https://web.dev/articles/inp
- https://developers.google.com/search/docs/appearance/core-web-vitals
related:
- marketing.seo.core-updates-and-spam-policies
- marketing.geo.how-engines-pick-sources
- marketing.conversion.speed-and-checkout-burden
seed_version: 1
---

**When to use this:** When auditing a site for SEO or planning new content pages.

## Technical and content basics, restated by Google in May 2026

**[DURABLE]** To be eligible for Google's AI features a page must be indexed and eligible to show with a snippet; no extra technical requirement exists. Keep content crawlable, reduce duplicate content, follow JavaScript SEO practice on script-heavy sites, make pages display well on all devices with low latency, and verify the site in Search Console. Structured data is not required for AI features, and no special AI schema exists, but it remains worthwhile for rich results. On content, write from your own knowledge and experience and avoid "commodity" content a generative model could easily produce; organise with clear headings; no ideal page length exists; and no page per long-tail variant is needed ([Google Search Central, AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)). **[INFERENCE]** A working checklist: crawl and index health, snippet eligibility, page experience, one page per distinct intent with query-matching headings, valid structured data, internal links between related pages, and earned links and mentions.

## Core Web Vitals thresholds are unchanged in 2026

**[DURABLE; Google pages last updated 2024 to 2025, fetched 11 Nov 2026]** The "good" thresholds are **Largest Contentful Paint at or under 2.5 seconds, Interaction to Next Paint at or under 200 milliseconds and Cumulative Layout Shift at or under 0.1**, each assessed at the 75th percentile of page loads and segmented by mobile and desktop; a page passes only if all three are met ([web.dev](https://web.dev/articles/vitals)). For Interaction to Next Paint, above 200 ms up to 500 ms needs improvement and above 500 ms is poor ([web.dev](https://web.dev/articles/inp)). Search Central says "We highly recommend site owners achieve good Core Web Vitals for success with Search" and frames them as part of the page experience that core ranking systems seek to reward, without giving a weight ([Google Search Central](https://developers.google.com/search/docs/appearance/core-web-vitals)). Interaction to Next Paint replaced First Input Delay, and stable metrics can change definition no more than about once a year. None of the three Google pages was updated in 2026 and all agree, so the thresholds stood unchanged as of November 2026.
