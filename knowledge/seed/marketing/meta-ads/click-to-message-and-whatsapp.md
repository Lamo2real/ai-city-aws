---
id: marketing.meta-ads.click-to-message-and-whatsapp
department: marketing
domain: meta-ads
title: Click-to-message and WhatsApp ads, and WhatsApp's 2026 pricing
summary: Where click-to-Messenger, Instagram Direct and WhatsApp ads deliver, EU limits on messaging features, and the 2026 WhatsApp pricing that charges AI agent replies per token and service messages per message again.
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- meta
- whatsapp
- instagram
- facebook
objectives:
- leads
- sales
sources:
- https://www.facebook.com/business/help/1816962591668838
- https://www.facebook.com/business/help/1192884166182156
- https://www.facebook.com/business/help/198088077975174
- https://www.facebook.com/business/learn/lessons/optimize-leads
- https://www.facebook.com/business/ads/marketing-messages
- https://www.facebook.com/business/ai/business-assistant
- https://www.facebook.com/business/news/advertising-week-2025
- https://www.facebook.com/business/help/776240728878345
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages/
- https://www.wati.io/en/blog/whatsapp-marketing-messages-us-2026/
related:
- marketing.lifecycle.whatsapp-and-rcs
- marketing.meta-ads.playbook-lead-generation
seed_version: 1
---

**When to use this:** When planning conversational ads or an AI chat agent on WhatsApp or Messenger.

## Playbooks by objective

**Click-to-message and WhatsApp.** **[FAST-MOVING; official pages read as excerpts]** Ads that click to Messenger can show on Facebook, Instagram and WhatsApp; ads that click to Instagram Direct show only on Instagram; ads that click to WhatsApp show on Facebook, Instagram and WhatsApp ([Meta Business Help Center](https://www.facebook.com/business/help/1816962591668838)). With multiple message destinations, each clicker is routed to the app where they are most likely to engage, which Meta says drives more results at lower cost per result; prerequisites are linking Instagram and WhatsApp accounts to the Page and being staffed to reply ([Meta Business Help Center](https://www.facebook.com/business/help/1192884166182156)). Ads that click to Instagram messages cannot target under-18s, and **some messaging metrics, campaigns and organic messaging features are unavailable for ads delivered to and from Europe and Japan** ([Meta Business Help Center](https://www.facebook.com/business/help/198088077975174)). Click-to-message supports Reels and Stories formats and lead optimisation for messaging is paired with the Conversions API ([Meta Blueprint](https://www.facebook.com/business/learn/lessons/optimize-leads)). Marketing messages on WhatsApp can be added as a placement inside Ads Manager campaigns and reach subscribers only ([Meta marketing messages](https://www.facebook.com/business/ads/marketing-messages)). "Meta Business Agent" sets up automated 24/7 chat replies on WhatsApp or Messenger, "Business AI" was introduced as a turnkey agent for small and medium businesses, and Meta documents AI call screening for call ads ([Meta AI business assistant FAQ](https://www.facebook.com/business/ai/business-assistant); [Meta, Advertising Week 2025](https://www.facebook.com/business/news/advertising-week-2025); [Meta Business Help Center](https://www.facebook.com/business/help/776240728878345)).

**[FAST-MOVING; Meta developer docs updated 1 Jul 2026]** WhatsApp pricing changed in 2026. On 1 July 2026 Meta Business Agent became its own non-template message category; from **1 August 2026 AI agent replies are charged per token at $2.00 per 1 million tokens** (a single global rate), with a typical message using 20,000 to 25,000 tokens (about 4 to 5 US cents), a simple inquiry costing about 16 to 20 cents and a complex interaction about 40 to 50 cents; from **1 October 2026 per-message charges resumed for all service messages** (free since 1 November 2024) and for utility messages inside the 24-hour window (free since 1 July 2025). Messages sent within 72 hours of a click-to-WhatsApp ad or Facebook call-to-action button remain free for delivery, but Business Agent token charges still apply in that window, and Business Agent needs a credit line attached or messages are not delivered ([Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages/)). **[INFERENCE]** Click-to-WhatsApp plus an AI agent is no longer "free conversations for 72 hours"; budget roughly 16 to 50 US cents per AI-handled conversation on top of media cost, and compare that with human or rule-based replies, which remain free for delivery inside the window. **[FAST-MOVING, Aug 2026; VENDOR citing Meta docs]** Meta's pause on marketing template messages to US (+1) numbers began 1 April 2025 and remained active with no announced end date as of August 2026; utility and authentication templates, replies within the 24-hour service window and conversations opened from click-to-WhatsApp ads are still allowed, and a separate global per-user cap limits how many marketing templates one user receives ([Wati, 31 Aug 2026](https://www.wati.io/en/blog/whatsapp-marketing-messages-us-2026/)).
