---
id: data.llm.llm-application-engineering
department: data
domain: llm
title: 'Data and AI: LLM application engineering'
summary: 'LLM application engineering: model selection and routing (strongest model first, then cut cost), context engineering, structured outputs, tool design for agents, prompt caching and service tiers, and fine-tuning versus RAG versus long context.'
type: playbook
audience: both
confidence: vendor
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- aws
- bedrock
- dbt
objectives:
- ai-features
sources:
- https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
- https://www.anthropic.com/engineering/building-effective-agents
- https://aws.amazon.com/bedrock/pricing/
- https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026?version=2.0
- https://www.anthropic.com/research/effective-context-engineering-for-ai-agents
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://www.anthropic.com/engineering/writing-tools-for-agents
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- https://www.anthropic.com/engineering/multi-agent-research-system
- https://www.anthropic.com/news/contextual-retrieval
- https://www.imy.se/globalassets/dokument/rapporter/ansvarsroller-enligt-gdpr-vid-finjustering-av-ai-applikationer.pdf
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before choosing a model, designing prompts, context, tools or structured outputs, or deciding between fine-tuning, RAG and long context.

**Source section:** 10. LLM application engineering: strongest model first, then cut cost with routing, caching and tight context

### Model selection and routing

**[VENDOR] [FAST-MOVING, 2025]** Prototype every step with the most capable model to set a quality baseline, then test smaller, cheaper models on simpler steps such as retrieval or intent classification, with evals throughout; this is OpenAI's advice in its 2025 agent guide ([OpenAI, A practical guide to building agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)).

**[VENDOR] [DURABLE]** Routing sends easy queries to a small cheap model and hard ones to a stronger model, and it works when categories are distinct and classification is reliable (Anthropic, December 2024) ([Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Amazon Bedrock Intelligent Prompt Routing costs $1 per 1,000 requests and routes between models of one family; AWS claims up to 30% cost reduction, per its pricing page read in November 2026 ([AWS Bedrock pricing](https://aws.amazon.com/bedrock/pricing/)). The saving is a vendor claim.

**[VENDOR] [FAST-MOVING, 7 April 2026]** A larger model or more reasoning is not automatically better. In dbt Labs' own benchmark of 7 April 2026, higher LLM reasoning effort raised latency to over 20 seconds from about 8 seconds per query with no accuracy gain on semantic-layer queries, and a mid-tier model outperformed the larger one on that task ([dbt Developer Blog, 7 Apr 2026](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026?version=2.0)).

### Context engineering: context is a finite budget

**[VENDOR] [FAST-MOVING, 29 September 2025]** Anthropic defines context engineering as curating the best set of tokens available at inference, and reports that recall accuracy falls as the window fills ("context rot"), so context is a finite budget ([Anthropic, Effective context engineering, 29 Sep 2025](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents)).

**[VENDOR] [FAST-MOVING, 29 September 2025]** Anthropic's system-prompt guidance of 29 September 2025: write prompts that sit between brittle hard-coded if-else rules and vague guidance; use XML tags or Markdown headers for sections; begin with a minimal prompt on the best model and add instructions only to fix observed failures; and prefer a few diverse canonical examples over long edge-case lists ([Anthropic, Effective context engineering, 29 Sep 2025](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents)).

**[VENDOR] [FAST-MOVING, 29 September 2025]** Anthropic's long-horizon techniques, as of 29 September 2025: compaction (summarise and restart the window, tuning for recall first and then precision, with clearing old tool results as the lightest form); structured note-taking to files outside the window; and sub-agents with clean windows that return summaries of about 1,000 to 2,000 tokens ([Anthropic, Effective context engineering, 29 Sep 2025](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents)).

**[VENDOR] [FAST-MOVING, 29 September 2025]** "Just-in-time" context means keeping lightweight identifiers (paths, queries, links) and loading data through tools at run time; Anthropic reports that a hybrid of some upfront loading plus on-demand exploration works well ([Anthropic, Effective context engineering, 29 Sep 2025](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents)).

### Structured outputs

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** OpenAI distinguishes Structured Outputs, where adherence to a strict JSON Schema is enforced, from JSON mode, which guarantees valid JSON only, and recommends Structured Outputs wherever possible; refusals must be checked through the refusal field and the finish reason. OpenAI recommends function calling to connect the model to tools and data, response-format schemas to shape the reply to the user, and Pydantic or Zod helpers to define schemas ([OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)).

### Tool design for agents

**[VENDOR] [FAST-MOVING, 11 September 2025, modified 13 October 2026]** Anthropic's tool-writing guidance: do not wrap every API endpoint; build a few tools for high-impact workflows; consolidate multi-step chains into one tool; avoid list-all tools in favour of search; namespace tools; return human-readable fields; offer concise and detailed response formats; paginate or truncate with guidance (Claude Code caps tool responses at 25,000 tokens by default); and make errors actionable ([Anthropic, Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)).

**[VENDOR] [DURABLE]** Design the agent-computer interface with the care given to a human user interface and make mistakes hard; Anthropic reports (December 2024) that requiring absolute file paths removed a class of errors in its SWE-bench work ([Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)).

### Prompt caching and service tiers

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Anthropic prompt caching terms as read in November 2026: 5-minute cache writes cost 1.25 times base input and 1-hour writes cost 2 times; cache reads cost 0.1 times (0.05 and 0.025 times on some of the newest models); up to 4 breakpoints are allowed; the prefix order is tools, then system, then messages; the minimum cacheable length is 512 to 4,096 tokens depending on the model; and any change to tool definitions invalidates everything after it ([Claude docs, prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)). Repeated long prefixes are therefore roughly 90% cheaper on the cached part.

**[INFERENCE]** Cache-friendly prompt layout: put static tool definitions and system instructions first and volatile content (timestamps, the user message) last, and never put per-request data ahead of the cached prefix ([Claude docs, prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Amazon Bedrock service tiers as read in November 2026: Priority is a 75% premium over Standard; Flex and Batch are 50% below Standard; and batch inference for select models is 50% below on-demand ([AWS Bedrock pricing](https://aws.amazon.com/bedrock/pricing/)).

**[VENDOR] [FAST-MOVING, 13 June 2025]** Agents use roughly 4 times the tokens of chat, and multi-agent systems roughly 15 times, in Anthropic's own measurement of 13 June 2025 ([Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)).

**[INFERENCE]** LLM cost levers in rough order of effect: fewer and shorter calls, a smaller model for easy steps, caching, batch or flex tier for non-interactive work, output-length limits, then context trimming.

### Fine-tuning versus RAG versus long context

**[VENDOR] [FAST-MOVING, 19 September 2024]** Anthropic's rule of thumb from 19 September 2024 is that a knowledge base under about 200,000 tokens (about 500 pages) should go wholly into the prompt with caching instead of into a RAG system ([Anthropic, Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)). Token limits have grown since, so the threshold is likely conservative today.

**[FAST-MOVING, 10 June 2026]** Legal point, checked on primary source (IMY report). The Swedish data protection authority IMY reported on 10 June 2026 that fine-tuning on personal data changes GDPR roles: a provider fine-tuning for its own product development is likely a controller, while fine-tuning on a customer's instructions makes the customer the controller and the provider the processor ([IMY report, 10 Jun 2026](https://www.imy.se/globalassets/dokument/rapporter/ansvarsroller-enligt-gdpr-vid-finjustering-av-ai-applikationer.pdf)).

**[INFERENCE]** Decision order for adapting an LLM: first prompt plus examples; then long context with caching if the corpus is small and stable; then RAG when the corpus is large, changes often, needs citations or needs per-user access control; and fine-tuning only for stable style, format or classification behaviour, latency or cost at scale, after evals show that prompting and RAG plateau. Fine-tuning does not solve freshness or access control, and it adds a GDPR role analysis and re-tuning on each base-model retirement.

### Gaps in the LLM engineering evidence

**[GAP]** Google's Gemini prompt-design guidance (https://ai.google.dev/gemini-api/docs/prompting-strategies) was not fetched. OpenAI's current prompt-caching terms were not confirmed. No current list prices for Claude, GPT or Gemini models were captured; look them up at decision time. No independent 2026 evidence comparing fine-tuning with RAG was fetched.
