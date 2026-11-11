---
id: marketing.agent-guardrails.prompt-injection
department: marketing
domain: agent-guardrails
title: Prompt injection has no complete fix, so controls must sit outside the model
summary: No fool-proof defence against prompt injection exists; keep irreversible actions behind human approval of the raw operation, apply the Rule of Two, and treat web pages, emails, reviews, briefs and competitor copy as untrusted.
type: principle
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives: []
sources:
- https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- https://cycode.com/blog/owasp-top-10-llm-applications/
- https://www.perplexity.ai/hub/blog/llm-security
related:
- marketing.agent-guardrails.guardrail-design
- marketing.agent-guardrails.ad-platform-mcp-servers
seed_version: 1
---

**When to use this:** Whenever an agent reads outside content and could then act, publish or send.

## Prompt injection has no complete fix, so controls must sit outside the model

**[DURABLE]** OWASP's prompt-injection guidance says that because of how generative models work "it is unclear if there are fool-proof methods of prevention"; mitigations include input and output filtering and requiring human approval for high-risk actions. Indirect injection arrives through content the model reads, such as web pages, emails and documents ([OWASP](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)). **[FAST-MOVING, Aug 2026; secondary]** OWASP's 2026 Top 10 for LLM applications keeps prompt injection first, widens it to cross-modal payloads and poisoned memory or retrieval stores, and for excessive agency says irreversible actions should sit behind human approval that shows the raw operation, not the model's summary ([Cycode](https://cycode.com/blog/owasp-top-10-llm-applications/)). **[Practitioner, 2026]** Meta's "Rule of Two" is that an agent should hold at most two of three capabilities at once (access to private data, exposure to untrusted content, and ability to communicate externally) and that a task needing all three requires human approval per action; permission checks belong outside the model because agents "might not follow policies even if you add it to the system prompt" ([Perplexity](https://www.perplexity.ai/hub/blog/llm-security)). **[INFERENCE]** For a marketing agent, untrusted content includes web pages, emails, reviews, comments, creator briefs, scraped competitor copy and llms.txt files (section 9).
