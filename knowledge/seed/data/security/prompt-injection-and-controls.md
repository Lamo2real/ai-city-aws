---
id: data.security.prompt-injection-and-controls
department: data
domain: security
title: 'Data and AI: Security'
summary: 'AI security: the OWASP LLM and agentic lists, why prompt-injection filters cannot be the control, layered guardrails and platform controls, and a control checklist mapped to OWASP identifiers.'
type: checklist
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- aws
- bedrock
objectives:
- ai-features
- governance
sources:
- https://genai.owasp.org/llm-top-10/
- https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/
- https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026
- https://arxiv.org/abs/2510.09023
- https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/
- https://arxiv.org/abs/2503.18813
- https://arxiv.org/abs/2506.08837
- https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
- https://aws.amazon.com/bedrock/faqs/
- https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns
- https://www.anthropic.com/engineering/building-effective-agents
- https://www.danilchenko.dev/posts/stanford-ai-index-2026/
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf
- https://modelcontextprotocol.io/specification/latest
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before giving an agent or LLM feature tools, data access or an outbound channel, or when defending against prompt injection.

**Source section:** 15. Security: prompt injection has no model-level fix, so limit what an agent can do

### The OWASP lists to map controls against

**[FAST-MOVING, 2025 edition, current November 2026]** The OWASP Top 10 for LLM Applications 2025, shown as current on the OWASP page in November 2026, is: LLM01 Prompt Injection; LLM02 Sensitive Information Disclosure; LLM03 Supply Chain; LLM04 Data and Model Poisoning; LLM05 Improper Output Handling; LLM06 Excessive Agency; LLM07 System Prompt Leakage; LLM08 Vector and Embedding Weaknesses; LLM09 Misinformation; LLM10 Unbounded Consumption ([OWASP GenAI LLM Top 10](https://genai.owasp.org/llm-top-10/)). **[GAP]** No 2026 update of this list was found; the OWASP page neither confirms nor rules one out.

**[FAST-MOVING, 9 December 2025]** The OWASP Top 10 for Agentic Applications 2026, released 9 December 2025, is: ASI01 Agent Goal Hijack; ASI02 Tool Misuse and Exploitation; ASI03 Identity and Privilege Abuse; ASI04 Agentic Supply Chain Vulnerabilities; ASI05 Unexpected Code Execution; ASI06 Memory and Context Poisoning; ASI07 Insecure Inter-Agent Communication; ASI08 Cascading Failures; ASI09 Human-Agent Trust Exploitation; ASI10 Rogue Agents. The release date is from the [OWASP resource page](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) and the list from a secondary summary ([Giskard summary of OWASP Agentic Top 10](https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026)). **[GAP]** The full OWASP agentic document, including its mitigations, was not readable.

### Why filters cannot be the control

**[FAST-MOVING, 10 October 2025]** Prompt injection has no reliable model-level fix as of late 2026. The multi-lab paper "The Attacker Moves Second" bypassed 12 recent jailbreak and prompt-injection defences with adaptive attacks (gradient, reinforcement learning, random search, human-guided), most at above 90% attack success ([Nasr et al., arXiv 2510.09023](https://arxiv.org/abs/2510.09023)).

**[DURABLE]** The "lethal trifecta", described by Simon Willison on 16 June 2025, is an agent with private-data access, exposure to untrusted content and an external communication channel; such an agent can be made to exfiltrate data. A filter catching 95% of attacks is a failing grade in security terms, and the dependable mitigation is to avoid combining all three ([Simon Willison, 16 Jun 2025](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)).

**[DURABLE]** Unverified background, not fetched. Design-level defences exist that constrain data and control flow instead of detecting attacks, for example Google DeepMind's CaMeL and the "design patterns for securing LLM agents" paper (plan-then-execute, dual-LLM, action-selector) ([CaMeL, arXiv 2503.18813](https://arxiv.org/abs/2503.18813); [Design patterns, arXiv 2506.08837](https://arxiv.org/abs/2506.08837)).

**[INFERENCE]** Guardrail classifiers reduce accidental and low-effort abuse and help with personal data and content policy, but given the adaptive-attack evidence they must not be the only barrier in front of a high-impact action ([Nasr et al., arXiv 2510.09023](https://arxiv.org/abs/2510.09023)).

### Layered guardrails and platform controls

**[VENDOR] [FAST-MOVING, 2025]** OpenAI's layered guardrails for agents are a relevance classifier, a safety classifier (jailbreak and injection), a PII filter, moderation, tool safeguards by risk rating, rules (blocklists, length limits, regular expressions) and output validation, with human intervention on repeated failures and on sensitive, irreversible or high-stakes actions such as payments or large refunds ([OpenAI, A practical guide to building agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Amazon Bedrock Guardrails offers a prompt-attack filter (jailbreak and injection, with prompt-leak detection on the standard tier), contextual grounding checks, Automated Reasoning checks against an expert-written policy, and PII blocking or masking with custom regular expressions; violations can be logged to CloudWatch or S3. AgentCore Policy authorises each tool call at a gateway with Cedar or natural-language rules, and AgentCore Identity scopes agent access on behalf of users ([AWS Bedrock FAQs](https://aws.amazon.com/bedrock/faqs/)).

**[VENDOR] [FAST-MOVING, 12 February 2026]** Microsoft advises authenticating inter-agent communication, applying least privilege, and placing content-safety checks at input, tool call, tool response and final output ([Microsoft Azure Architecture Center, 12 Feb 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)). **[VENDOR] [DURABLE]** Anthropic advises testing autonomous agents extensively in sandboxed environments with guardrails, because errors compound ([Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)).

**[FAST-MOVING, 20 June 2026]** Documented AI incidents rose to 362 in 2025 from 233 in 2024, according to a blog summary of the Stanford AI Index 2026 that was not checked against the report ([Danilchenko summary](https://www.danilchenko.dev/posts/stanford-ai-index-2026/)).

### Control checklist mapped to OWASP identifiers

**[INFERENCE]** The table below is the researchers' synthesis of controls mapped to OWASP identifiers; it is not OWASP's own mitigation text. The identifiers are from the [OWASP GenAI LLM Top 10](https://genai.owasp.org/llm-top-10/) and the [OWASP agentic list](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/).

| Control | OWASP identifiers | Basis |
|---|---|---|
| Classify every tool as read, write, external-send or code-exec, and every input source as trusted or untrusted; web pages, emails, uploaded files, retrieved documents, other agents' output and tool results are untrusted | LLM01, ASI01 | Inference; see [OWASP GenAI LLM Top 10](https://genai.owasp.org/llm-top-10/) |
| Never let one agent session hold sensitive data, untrusted content and an outbound channel together; if unavoidable, require human approval on the outbound or irreversible step | LLM06, ASI02 | Inference from [Simon Willison, 16 Jun 2025](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) |
| Give each agent its own identity with short-lived, narrowly scoped credentials; the agent acts with the end user's permissions, never a shared super-user | ASI03 | Inference; see [Microsoft Azure Architecture Center, 12 Feb 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) |
| Run code only in an isolated sandbox with no ambient credentials and an egress allow-list | ASI05, LLM05 | Inference; see [Thoughtworks Radar Vol 35, Nov 2026](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf) |
| Pin and review third-party MCP servers, tools, prompts and models; re-review on update | LLM03, ASI04 | Inference from [MCP specification](https://modelcontextprotocol.io/specification/latest) |
| Validate model output before it reaches interpreters, SQL, shells, browsers or other agents | LLM05, ASI07 | Inference; see [OWASP GenAI LLM Top 10](https://genai.owasp.org/llm-top-10/) |
| Set rate, token and spend limits per user, tenant and agent run, and cap loops | LLM10, ASI08 | Inference; see [OWASP GenAI LLM Top 10](https://genai.owasp.org/llm-top-10/) |
| Keep secrets out of system prompts and assume the system prompt can leak | LLM07 | Inference; see [OWASP GenAI LLM Top 10](https://genai.owasp.org/llm-top-10/) |
| Filter retrieval by tenant and control writes to memory and RAG stores | LLM08, ASI06 | Inference; see [OWASP GenAI LLM Top 10](https://genai.owasp.org/llm-top-10/) |
| Log every tool call with inputs, outputs, identity and approval for audit | All | Inference |

### Gaps in the security evidence

**[GAP]** No vendor-reported prompt-injection robustness figures for current models were retrieved; Meta's "Rule of Two" and vendor system-card injection metrics were not fetched.
