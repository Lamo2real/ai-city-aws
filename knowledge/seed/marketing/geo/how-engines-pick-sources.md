---
id: marketing.geo.how-engines-pick-sources
department: marketing
domain: geo
title: 'GEO: Google says it is still SEO, and AI engines pick sources through retrieval and fan-out'
summary: Google's AI features use the normal index and ranking systems with no special markup; ChatGPT and Google AI Mode issue several sub-queries and cite top-retrieved pages, so cover the fan-out sub-questions inside strong pages.
type: principle
audience: both
confidence: vendor
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- ai-answer-engines
- google-search
objectives:
- awareness
- consideration
sources:
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://www.semrush.com/blog/google-publishes-generative-ai-search-guide/
- https://www.tryprofound.com/blog/chatgpt-query-fanout-explained
- https://searchengineland.com/chatgpt-citations-ranking-precision-length-study-474538
- https://seranking.com/blog/ai-mode-research/
related:
- marketing.geo.cited-sources-and-mentions
- marketing.geo.levers-and-what-to-avoid
- marketing.seo.technical-and-content-basics
seed_version: 1
---

**When to use this:** When planning content for visibility in AI answers (ChatGPT, Perplexity, Gemini, AI Overviews).

## Google's official position is that GEO "is still SEO"

**[DURABLE policy; published 15 May 2026]** Google's guide states that AI Overviews and AI Mode use retrieval-augmented generation and query fan-out over the normal Search index and the same ranking and spam systems. For Google Search specifically: llms.txt and special markup are not used; content chunking and rewriting for AI are unnecessary; inauthentic mentions do not help; and no third-party tool has access to Google's internal AI metrics ([Google AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide); [Semrush, 19 May 2026](https://www.semrush.com/blog/google-publishes-generative-ai-search-guide/)). **[INFERENCE]** This guidance is scoped to Google and does not settle what works in ChatGPT, Perplexity or Claude.

## How engines pick sources

**[VENDOR studies; FAST-MOVING]** ChatGPT issued 4 or more searches on 63% of prompts in a 420-prompt study (October 2025), with only 8.3% URL overlap with Google's top 10; the first sub-query supplied the primary citation in 67.2% of multi-query prompts ([Profound](https://www.tryprofound.com/blog/chatgpt-query-fanout-explained)). In AirOps's 2026 study of 50,553 ChatGPT responses, pages in the top retrieval position were cited 58.4% of the time versus 14.2% at position 10; heading-to-query match (41.0% versus about 30%), JSON-LD (38.5% versus 32.0%), 4 to 10 subheadings, 500 to 2,000 words, age of 30 to 89 days and narrow focus also correlated with citation ([Search Engine Land](https://searchengineland.com/chatgpt-citations-ranking-precision-length-study-474538)). Google AI Mode averaged 12.6 cited URLs per answer with 14% overlap with the organic top 10, and only 9.2% of URLs appeared in all of three same-day runs (June 2025 data) ([SE Ranking, 29 Aug 2025](https://seranking.com/blog/ai-mode-research/)). **[INFERENCE]** Cover the sub-questions that fan-out generates (comparisons, pricing, "best for", how-to) inside strong pages, without building a page per sub-query.
