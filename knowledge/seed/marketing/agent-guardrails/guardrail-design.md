---
id: marketing.agent-guardrails.guardrail-design
department: marketing
domain: agent-guardrails
title: A guardrail design for a manager agent directing worker agents
summary: Seven controls - action tiers with named human approval, hard limits outside the model, untrusted-input handling, content gates before publish, channel compliance gates, evaluation and accountability - plus one pre-flight gate per asset.
type: checklist
audience: both
confidence: inference
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms: []
objectives: []
sources:
- https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/
related:
- marketing.agent-guardrails.prompt-injection
- marketing.agent-guardrails.ad-platform-mcp-servers
- marketing.campaign-planning.planning-order-and-plan-contents
requires:
- marketing.agent-guardrails.prompt-injection
seed_version: 1
---

**When to use this:** When a manager agent sets rules for worker agents, or before any spend, publish, send or targeting change.

## A guardrail design for a manager agent directing worker agents

**[INFERENCE; the researchers' synthesis from the sources above, not documented practice]** Seven controls follow from the evidence.

Action tiers. Worker agents read, analyse and draft freely. Anything that spends money, publishes externally, messages customers, changes audiences or data uses, signs a creator, touches a regulated category or deletes requires approval from a named human, who is shown the raw operation and the diff, not a summary. Autonomy is promoted per task type as trust is earned, starting with smaller tasks.

Hard limits outside the model. Budget caps per day and per change, allow-listed accounts and least-privilege credentials are enforced in the tool layer, never by a system-prompt instruction alone. This matters most on Meta and TikTok, where the platform supplies no documented approval step, and on Google Ads if a third-party write-capable server is used, since the OAuth scope is read-write. Default change sizes should follow the platform evidence: about 10 to 15% per change with one change at a time on Google (section 6), no significant edits during Meta's learning phase (section 4), and up to 15% bid changes every 2 days on TikTok (section 10).

Untrusted-input handling. Treat everything fetched from outside as data, apply the Rule of Two, and allow no auto-sending or auto-publishing in a session that has read untrusted content.

Content gates before publish. Check brand voice against a maintained guide; check every statistic and every comparative, health, financial or environmental claim against a claims register with a source on file; trigger legal review for regulated categories, pricing claims (the Swedish 30-day rule), endorsements, competitor mentions and real-person likeness; check disclosure wording for the market (Sweden "Reklam från X", UK "#Ad", US "#ad" or "sponsored"); check AI labelling; and review every Meta ad's generative toggles.

Channel compliance gates. For email, confirm authentication and one-click unsubscribe headers and a complaint rate under threshold; for SMS, a consent record, quiet hours and opt-out handling; for EU sends, a consent or soft-opt-in basis per country; for tracking, consent mode signals and a consent-gated pixel.

Evaluation. Use sample-based human grading of outputs for accuracy, voice and compliance (the three failure modes marketers report most); track override and rejection rates; red-team with injected instructions; and log prompts, tool calls, approvals and published versions.

Accountability. Assign one named owner per agent workflow and maintain an incident and rollback procedure. No synthetic testimonials, reviews or inflated engagement under any circumstances, and no coordination of brand-safety exclusion lists with competitors.

The AI Act gives human editorial sign-off legal value, since reviewed public-interest text needs no AI label ([Usercentrics](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/)). A single pre-flight gate per asset should check consent basis, disclosure wording for the market, claims substantiation, special ad category, platform AI toggles, minors and special-category targeting, and political or issue classification.
