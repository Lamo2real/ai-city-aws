---
id: marketing.seo.ecommerce-seo
department: marketing
domain: seo
title: 'Ecommerce SEO: merchant listings, free listings, facets, pagination and out-of-stock pages'
summary: Use Product markup with Offer for merchant listings and complete Merchant Center attributes for free listings; block or control faceted URLs, link paginated pages with crawlable anchors, and keep availability accurate in markup and feed.
type: checklist
audience: worker
confidence: established
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms:
- google-search
- google-ads
objectives:
- sales
sources:
- https://developers.google.com/search/docs/appearance/structured-data/merchant-listing
- https://support.google.com/merchants/answer/9199328
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.google.com/search/docs/crawling-indexing/crawling-managing-faceted-navigation
- https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
- https://www.seroundtable.com/google-timeframe-out-of-stock-product-soft-404-30777.html
related:
- marketing.google-ads.performance-max-and-feeds
- marketing.seo.technical-and-content-basics
seed_version: 1
---

**When to use this:** When setting up or auditing SEO for an online store.

## Ecommerce SEO: merchant listings, free listings, facets, pagination, out-of-stock

**[DURABLE; Google Search Central, fetched 11 Nov 2026]** Google separates product snippets, which accept `Offer` or `AggregateOffer`, from merchant listings, which require `Offer` because the merchant must be the seller; only pages where a shopper can buy qualify. Required Product properties are `name`, `image` and `offers`; recommended properties include `aggregateRating`, `brand.name`, `category`, `color`, `description`, GTIN properties, `audience` and `hasCertification`. Three price types are supported: active, strikethrough (`priceType` `StrikethroughPrice`) and member price (`validForMemberTier`); sale timing uses `validFrom` with `validThrough` or `priceValidUntil`; and unit pricing uses `referenceQuantity`, which Google notes is important in the EU. Shipping uses `OfferShippingDetails`, and standard return policies should be nested under Organization as `MerchantReturnPolicy`, with product-level policies only as overrides. Use a distinct URL per currency, and note that JavaScript-generated Product markup can make Shopping crawls less frequent and less reliable ([Google Search Central](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)). **[DURABLE; Merchant Center Help]** Free listings can appear on the Shopping tab, Search, Images and Lens, YouTube, Maps, Gemini and the Business Profile products module. Required attributes for all products are `id`, `title`, `link`, `image_link`, `price`, `description` and `availability`; conditional attributes include `condition`, `brand`, and `gtin` or `mpn`; apparel also needs `color`, `size`, `age_group`, `gender` and `item_group_id`. Return policy information is required, and shipping settings are mandatory in listed countries including the US, UK, Germany and France; new accounts are opted in by default ([Merchant Center Help](https://support.google.com/merchants/answer/9199328)). Merchant Center feeds and Business Profiles also help products and services appear in AI responses ([Google AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)).

**[DURABLE; Google Search Central, updated Dec 2025]** For faceted navigation, if facet URLs do not need indexing, block crawling with robots.txt or use URL fragments, which Google generally does not crawl; `rel="canonical"` and `rel="nofollow"` are weaker long-term alternatives. If facets should be indexed, use the standard "&" separator, keep filter order consistent, and return HTTP 404 for empty, duplicate or nonsensical filter combinations instead of redirecting ([Google Search Central](https://developers.google.com/search/docs/crawling-indexing/crawling-managing-faceted-navigation)). For pagination, link pages with crawlable anchor links, give each page a unique URL and its own canonical, and avoid fragments for page numbers; Google no longer uses `rel="next"` and `rel="prev"` and does not click "load more" buttons ([Google Search Central](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)). **[Possibly outdated, 2020 to 2021]** On out-of-stock products, the only direct Google statements found are John Mueller's that such pages "generally tend to end up as soft 404 pages" with "no fixed timeframe" ([Search Engine Roundtable, 19 Jan 2021](https://www.seroundtable.com/google-timeframe-out-of-stock-product-soft-404-30777.html)). **[INFERENCE]** Keeping availability accurate in both markup and feed is the safest route for temporarily unavailable products.
