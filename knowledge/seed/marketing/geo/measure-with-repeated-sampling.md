---
id: marketing.geo.measure-with-repeated-sampling
department: marketing
domain: geo
title: Measure AI visibility with repeated sampling and state the method
summary: Use Search Console's AI report, GA4's AI Assistant channel and an AI referral segment; because answers vary run to run, sample each prompt repeatedly and report share of voice with prompt count, run count and date.
type: playbook
audience: worker
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- ai-answer-engines
- ga4
objectives:
- awareness
sources:
- https://www.semrush.com/blog/google-adds-ai-performance-reports/
- https://support.google.com/analytics/answer/9164320
- https://ahrefs.com/blog/ai-chatbot-traffic/
related:
- marketing.geo.cited-sources-and-mentions
- marketing.measurement.ga4-2026-changes-and-audit
seed_version: 1
---

**When to use this:** When reporting AI-answer visibility or AI referral traffic.

## Measure with repeated sampling and state the method

**[FAST-MOVING]** Search Console's generative AI report shows impressions only, without queries or clicks, and began rolling out with UK site owners (reported 3 June 2026) ([Semrush](https://www.semrush.com/blog/google-adds-ai-performance-reports/)). Since 13 May 2026 GA4 has an "AI Assistant" default channel that groups visits from tools such as ChatGPT, Gemini and Claude ([Analytics Help](https://support.google.com/analytics/answer/9164320)). AI chatbots sent 0.28% of total web traffic across 74,752 sites in March 2026; conversion anecdotes (Ahrefs: 0.5% of visitors but 12.1% of signups) are single-company data. Where the GA4 channel is not enough, build a referral segment for chatgpt.com, perplexity, gemini.google.com, copilot.microsoft.com and claude.ai, noting some app visits arrive as direct ([Ahrefs, 15 May 2026](https://ahrefs.com/blog/ai-chatbot-traffic/)). **[INFERENCE]** Because answers are unstable, sample each prompt repeatedly and report any share-of-voice figure with prompt count, run count and date. In Sweden, where six in ten people use AI services (section 20), this is a real channel to measure.
