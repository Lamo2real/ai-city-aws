---
id: marketing.geo.crawler-access-and-llms-txt
department: marketing
domain: geo
title: Allow AI search crawlers, decide training crawlers separately, and skip llms.txt
summary: Search and training crawlers are controlled separately (OAI-SearchBot versus GPTBot, Claude-SearchBot versus ClaudeBot, Google-Extended); allow retrieval bots, treat training as a business choice, and do not expect value from llms.txt.
type: checklist
audience: worker
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- ai-answer-engines
objectives:
- awareness
sources:
- https://developers.openai.com/api/docs/bots
- https://www.searchenginejournal.com/anthropic-claude-bots-robots-txt-ai-decisions/568253/
- https://ahrefs.com/blog/llmstxt-study/
related:
- marketing.geo.how-engines-pick-sources
- marketing.agent-guardrails.prompt-injection
seed_version: 1
---

**When to use this:** When setting robots.txt rules for AI crawlers.

## Crawler access and llms.txt

**[FAST-MOVING, 2026]** Search and training crawlers are controlled independently. For OpenAI, OAI-SearchBot governs inclusion in ChatGPT search and GPTBot governs training ([OpenAI crawler docs](https://developers.openai.com/api/docs/bots)). For Anthropic, Claude-SearchBot governs search indexing and ClaudeBot training; PerplexityBot handles Perplexity indexing; Google-Extended opts out of Gemini training while staying in Search ([Search Engine Journal, 25 Feb 2026](https://www.searchenginejournal.com/anthropic-claude-bots-robots-txt-ai-decisions/568253/)). **[INFERENCE]** Allow the search and retrieval bots and treat training bots as a separate business choice. **[Study, May 2026]** llms.txt has no demonstrated search value: 97% of such files across 137,210 domains received zero requests in a month, and Ahrefs flags a prompt-injection risk ([Ahrefs, 15 Jun 2026](https://ahrefs.com/blog/llmstxt-study/)).
