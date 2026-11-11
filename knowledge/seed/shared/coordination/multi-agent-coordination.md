---
id: shared.coordination.multi-agent-coordination
department: shared
domain: coordination
title: 'Shared: Multi-agent coordination'
summary: 'Centralised orchestration contains errors that independent agents amplify 17.2x: patterns and when to use multiple agents, handoff message design, MCP and A2A, failure modes, permissions and audit, cost, evaluation.'
type: principle
audience: both
confidence: vendor
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- handoffs
- safety
sources:
- https://www.anthropic.com/engineering/building-effective-agents
- https://www.anthropic.com/engineering/multi-agent-research-system
- https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them
- https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
- https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns
- https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system
- https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-patterns/multi-agent-collaboration.html
- https://docs.langchain.com/oss/python/langchain/multi-agent
- https://cognition.com/blog/dont-build-multi-agents
- https://openai.github.io/openai-agents-python/handoffs/
- https://a2a-protocol.org/latest/topics/key-concepts/
- https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year
- https://blog.modelcontextprotocol.io/posts/2026-07-28/
- https://aaif.io/blog/aaifs-first-quarter-success-story-new-members-technical-wins-and-open-governance
- https://diginomica.com/what-agentic-ai-foundations-rule-changes-mean-building-mcp-a2a
- https://arxiv.org/html/2503.13657v3
- https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/
- https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026
- https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
- https://www.anthropic.com/news/our-framework-for-developing-safe-and-trustworthy-agents
related:
- shared.routing.routing-rule-and-message-template
- shared.guardrails.company-wide-guardrails
seed_version: 1
---

**When to use this:** When designing how agents work together: orchestration patterns, handoff messages and shared artefacts, MCP and A2A, measured failure modes, permissions and audit, cost and evaluation.

**Source section:** 6. Multi-agent coordination: centralised orchestration contains errors that independent agents amplify 17.2x

## 6. Multi-agent coordination: centralised orchestration contains errors that independent agents amplify 17.2x

### 6.1 Patterns and when to use multiple agents at all

[VENDOR] [DURABLE] Anthropic distinguishes workflows, which follow predefined code paths, from agents, which direct their own process. Its patterns are prompt chaining, routing, parallelisation, orchestrator-workers and evaluator-optimiser. Its advice is to find the simplest solution and add complexity only when needed, and because agents carry compounding-error risk, to use stopping conditions, human checkpoints and sandboxed testing ([Anthropic, Building effective agents, 19 December 2024](https://www.anthropic.com/engineering/building-effective-agents)).

[VENDOR] [PLATFORM CLAIM] [FAST-MOVING, 13 June 2025] Anthropic's research system uses a lead agent that plans, spawns parallel subagents and synthesises. Anthropic reported a **90.2% improvement** over a single agent on an internal research evaluation, with agents using about **4x** the tokens of chat and multi-agent systems about **15x**. It describes multi-agent as a poor fit where agents need shared context or have many inter-dependencies, including most coding tasks ([Anthropic, multi-agent research system, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system)). The figures are self-reported on an internal evaluation.

[VENDOR] [FAST-MOVING, 23 January 2026] Anthropic's later guidance says multi-agent is justified by context protection, parallelisation or specialisation, and typically costs **3 to 10x** more tokens than a single agent for equivalent tasks. It advises splitting by context boundaries and not by type of work, because role-based splits (planner, implementer, tester, reviewer) lost context at each handoff and spent more tokens coordinating than working, and it suggests considering a split at roughly 15 to 20 or more tools, after trying tool search ([Claude, Building multi-agent systems, 23 January 2026](https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them)).

[VENDOR] [FAST-MOVING, undated; third-party coverage places it in April 2025] OpenAI contrasts the manager pattern, in which a central agent calls specialists as tools and keeps control, with decentralised handoffs between peers. It advises maximising a single agent first and splitting when prompts have many conditional branches or tools overlap ([OpenAI, practical guide to building agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)).

[VENDOR] [FAST-MOVING, 12 February 2026] Microsoft's Azure Architecture Center lists five orchestration patterns: sequential, concurrent, group chat, handoff and magentic (a manager maintaining a task ledger). It advises the lowest complexity that works, justifies multi-agent for cross-domain work, separate security boundaries or parallel specialisation, recommends keeping group chats to three or fewer agents, and recommends a deterministic dispatcher when the right agent is identifiable from the input ([Microsoft, AI agent orchestration patterns, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).

[VENDOR] [FAST-MOVING, 28 May 2026] Google Cloud describes a coordinator pattern that routes sub-tasks to specialists at higher cost and latency; hierarchical task decomposition, which uses layered delegation and is hard to build and maintain; review-and-critique, which adds a critic working against defined criteria; a swarm with no coordinator, which has the highest complexity and may not converge; and human-in-the-loop, which pauses at checkpoints such as large financial transactions ([Google Cloud, choose a design pattern for agentic AI, last reviewed 28 May 2026](https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system)). A company of manager agents directing worker agents is a form of hierarchical decomposition, the pattern Google Cloud flags as hard to maintain.

[VENDOR] [FAST-MOVING, undated page read November 2026] AWS Prescriptive Guidance describes multi-agent collaboration as decentralised or peer coordination through shared memory (a "blackboard") or messaging and event routing, with an optional supervising agent. AWS positions it for open-ended reasoning and says enterprise process automation fits centrally controlled workflow agents better ([AWS, multi-agent collaboration](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-patterns/multi-agent-collaboration.html)).

[VENDOR] [FAST-MOVING, read November 2026] LangChain's documentation lists the patterns subagents (a main agent calls subagents as tools), handoffs, skills, router and custom workflow, and rates subagents highest for distributed development and parallelisation. In its example a multi-domain request cost about **9K tokens** with subagents or a router in parallel against **14K or more** with sequential handoffs, and it calls context engineering, deciding what each agent sees, the core of multi-agent design ([LangChain, multi-agent](https://docs.langchain.com/oss/python/langchain/multi-agent)).

[CONTESTED] [VENDOR] [FAST-MOVING, 12 June 2025] Cognition's Walden Yan dissents from the multi-agent consensus. His argument is that agents should share full traces and not single messages, that actions embed implicit decisions, and that parallel subagents built mismatched parts in his example; he recommends a single-threaded agent with context compression and called multi-agent collaboration fragile in 2025 ([Cognition, Don't build multi-agents, 12 June 2025](https://cognition.com/blog/dont-build-multi-agents)). Anthropic's own guidance concedes part of this, since it excludes most coding tasks and tightly inter-dependent work from multi-agent designs ([Anthropic, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system)).

[INFERENCE] The twelve-department design is itself a role-based split, the kind Anthropic's January 2026 guidance warns about ([Claude, 23 January 2026](https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them)). The proposed mitigation is to keep whole tasks inside one department where context is shared, hand off only at genuine context boundaries, and pass artefacts in place of summaries.

### 6.2 Handoff message design and shared artefacts versus message passing

[VENDOR] [DURABLE] Anthropic found that each delegation needs four things: an objective, an output format, guidance on tools and sources, and clear task boundaries. Vague briefs caused one subagent to research the wrong period while two others duplicated work. Effort-scaling rules were written into prompts, from one agent with 3 to 10 tool calls for simple fact-finding up to more than 10 subagents for complex research ([Anthropic, multi-agent research system, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system)).

[VENDOR] [DURABLE] Anthropic advises having subagents write outputs to external storage and return lightweight references, which avoids the loss it likens to a game of telephone, and summarising completed phases to external memory before handing off to fresh agents near context limits ([Anthropic, multi-agent research system, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system)).

[VENDOR] [FAST-MOVING, 12 February 2026] Microsoft advises deciding per handoff whether the next agent needs the full raw context, a compacted summary or only new instructions; persisting shared state externally and scoping it to the minimum necessary; validating outputs before passing them downstream because malformed or low-confidence output cascades; and avoiding mutable state shared between concurrent agents ([Microsoft, AI agent orchestration patterns, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).

[VENDOR] [FAST-MOVING, read November 2026] In the OpenAI Agents SDK, handoffs are exposed as tools. A handoff can carry structured input such as a reason or priority validated against a schema, the receiver sees the full history by default unless an input filter trims it, and authorisation checks can run in the handoff callback and block the transfer ([OpenAI Agents SDK, handoffs](https://openai.github.io/openai-agents-python/handoffs/)).

[INFERENCE] A shared artefact store with messages that carry references is better supported than pure message passing, on the strength of the Anthropic and Microsoft guidance above. Because concurrent writes to shared mutable state are a named anti-pattern ([Microsoft, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)), each artefact should have one owning department and versioning; other departments read it and request changes, they do not edit it.

### 6.3 Protocols: MCP for tools and data, A2A between agents, governance left to the company

[PLATFORM CLAIM] [FAST-MOVING, read November 2026] The A2A protocol's core objects are the Agent Card (identity, capabilities, skills, endpoint and authentication requirements), the Task (a stateful unit with an ID and lifecycle), the Message, the Part, the Artifact (a deliverable) and a context ID that groups related tasks. Remote agents are opaque, meaning their internal memory and tools stay hidden, and long tasks are supported through streaming and webhook push ([A2A key concepts](https://a2a-protocol.org/latest/topics/key-concepts/)).

[PLATFORM CLAIM] [FAST-MOVING, 9 April 2026] A Linux Foundation press release describes A2A version 1.0 as the first stable specification, adding multi-protocol support, enterprise multi-tenancy, signed Agent Cards for cryptographic identity and version negotiation. It reports **more than 150 supporting organisations**, up from more than 50 a year earlier, integrations in Azure AI Foundry, Copilot Studio and Amazon Bedrock AgentCore, and SDKs in five languages, and positions A2A as complementary to MCP: A2A between agents, MCP for tools and data ([Linux Foundation, 9 April 2026](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)).

[PLATFORM CLAIM] [FAST-MOVING, 28 July 2026] The MCP specification dated 2026-07-28 makes the core stateless: the initialise handshake and session header are retired and each request carries the version, client identity and capabilities. Server-initiated elicitation and sampling are replaced by multi-round-trip requests that return "input required". Method and name headers are mandatory so that gateways can route and meter. Authorisation is hardened (issuer validation, issuer-bound credentials, Dynamic Client Registration deprecated in favour of Client ID Metadata Documents). Tasks move to an extension, Roots, Sampling and Logging are deprecated with at least twelve months' support, and Enterprise Managed Authorization is listed as an extension ([MCP blog, 28 July 2026](https://blog.modelcontextprotocol.io/posts/2026-07-28/)).

[PLATFORM CLAIM] [FAST-MOVING, 24 February 2026] The Agentic AI Foundation was formed under the Linux Foundation with a launch date given as 9 December 2025. Its February 2026 blog says it hosts MCP, goose and AGENTS.md, has **146 members**, and runs working groups that include identity and trust, security and privacy, observability and traceability, and governance, risk and regulatory alignment ([AAIF blog, 24 February 2026](https://aaif.io/blog/aaifs-first-quarter-success-story-new-members-technical-wins-and-open-governance)).

[CONTESTED] [FAST-MOVING, 14 October 2026] The governance home of A2A is reported inconsistently. A secondary report says A2A maintainers were newly accepted into the Agentic AI Foundation, which it describes as hosting both MCP and A2A, and that the foundation moved to sandbox, growth and impact project stages and opened working groups to non-members ([diginomica, 14 October 2026](https://diginomica.com/what-agentic-ai-foundations-rule-changes-mean-building-mcp-a2a)). The April 2026 Linux Foundation release describes A2A simply as a Linux Foundation project ([Linux Foundation, 9 April 2026](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)). The later claim was not confirmed on a primary page.

[INFERENCE] Each department's manager agent should publish something like an A2A Agent Card or service catalogue entry (skills, required inputs, authentication, service level), and a common task-status vocabulary should be used across departments. The researchers suggest submitted, working, input-required, completed, rejected and failed; the exact A2A state list was not on the page read and must be confirmed against the specification before adoption.

### 6.4 Failure modes measured in research

[FAST-MOVING, 26 October 2025] The MAST study from UC Berkeley (Cemri et al., arXiv 2503.13657, version 3) annotated **1,642 traces across 7 frameworks** and identified **14 failure modes in 3 categories**. It reported failure rates of **41% to 86.7%** across the systems studied, with annotator agreement at kappa 0.88 ([arXiv 2503.13657v3, 26 October 2025](https://arxiv.org/html/2503.13657v3)). The systems were frameworks such as MetaGPT and ChatDev on benchmark tasks, not companies in production.

[FAST-MOVING, 26 October 2025] The MAST failure-mode shares are in the table below. The category totals are sums of the mode figures as the fetch tool returned them, so treat them as approximate ([arXiv 2503.13657v3, 26 October 2025](https://arxiv.org/html/2503.13657v3)).

| MAST category | Approximate share | Modes and shares | Source |
|---|---|---|---|
| System design issues | About 44% | Step repetition 15.7%; unaware of termination conditions 12.4%; disobeying task specification 11.8%; loss of conversation history 2.8%; disobeying role specification 1.5% | [arXiv 2503.13657v3, 26 Oct 2025](https://arxiv.org/html/2503.13657v3) |
| Inter-agent misalignment | About 32% | Reasoning-action mismatch 13.2%; task derailment 7.4%; failing to ask for clarification 6.8%; conversation reset 2.2%; ignoring another agent's input 1.9%; information withholding 0.85% | [arXiv 2503.13657v3, 26 Oct 2025](https://arxiv.org/html/2503.13657v3) |
| Task verification | About 24% | Incorrect verification 9.1%; no or incomplete verification 8.2%; premature termination 6.2% | [arXiv 2503.13657v3, 26 Oct 2025](https://arxiv.org/html/2503.13657v3) |

[FAST-MOVING, 26 October 2025] The MAST interventions had modest effect. Clearer role specifications, or giving one agent the final say, raised task success by about **9.4%** in one system, and adding a high-level objective verification step raised it by about **15.6%**. Gains were inconsistent and completion stayed low, so the authors call for structural changes and multi-level verification ([arXiv 2503.13657v3, 26 October 2025](https://arxiv.org/html/2503.13657v3)). Prompt fixes alone will not make department handoffs reliable.

[FAST-MOVING, 28 January 2026] Google Research tested 180 configurations across five architectures and three model families (paper arXiv 2512.08296). Independent agents amplified errors **17.2x** against **4.4x** under centralised coordination. Centralised coordination improved a parallelisable finance task by **80.9%** over a single agent, whereas every multi-agent variant degraded a sequential planning task by **39 to 70%**. Coordination overhead grew with tool count, and a predictive model picked the best architecture for 87% of unseen configurations ([Google Research blog, 28 January 2026](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/)). The practical reading: use several agents for work that parallelises, keep sequential work in one agent, and always coordinate centrally.

[VENDOR] [FAST-MOVING, 23 January 2026] Anthropic names a verification-agent failure mode in which the verifier runs one or two checks and declares success early. The mitigation is concrete criteria, full test runs and negative tests ([Claude, Building multi-agent systems, 23 January 2026](https://claude.com/resources/articles/building-multi-agent-systems-when-and-how-to-use-them)).

[VENDOR] [FAST-MOVING, December 2025] The OWASP Top 10 for Agentic Applications, first published in December 2025 and read here only through Giskard's summary, lists goal hijack; tool misuse; identity and privilege abuse; agentic supply chain; unexpected code execution; memory and context poisoning; insecure inter-agent communication; cascading failures; human-agent trust exploitation; and rogue agents ([Giskard summary](https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026)). The OWASP document itself was not read, so its per-risk mitigations are not sourced here.

### 6.5 Permissions, logging and audit

[DURABLE] OWASP's LLM06:2025 entry on excessive agency attributes the risk to excessive functionality, permissions and autonomy. Its mitigations include minimal and granular tools, least-privilege downstream permissions, acting in the user's context, human approval for high-impact actions, enforcing authorisation in downstream systems and not in the model, and logging and rate limiting to limit damage ([OWASP GenAI, LLM06:2025](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)).

[VENDOR] [FAST-MOVING, 12 February 2026] Microsoft advises authenticating and securing agent-to-agent traffic; least privilege for agents and orchestrators; security trimming by every agent so that users never receive data they cannot access; audit trails; instrumentation of all operations and handoffs; guardrails at input, tool calls, tool responses and output; and timeouts, retries, circuit breakers and checkpoints ([Microsoft, AI agent orchestration patterns, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).

[VENDOR] [FAST-MOVING, 4 August 2025] Anthropic's framework says humans should keep control before high-stakes decisions, that agents should be read-only by default with user-granted persistent permissions for trusted routine tasks, and that administrators can restrict which connectors are available ([Anthropic, safe and trustworthy agents framework, 4 August 2025](https://www.anthropic.com/news/our-framework-for-developing-safe-and-trustworthy-agents)).

[INFERENCE] Least privilege should be applied by department: tool grants per department (for example only Finance agents hold payment tools and only IT infrastructure holds production deploy), a distinct identity per agent, authorisation enforced by downstream systems, cross-department data access by request and not by standing permission, and every tool call and handoff logged with the task ID. This is inferred from the OWASP and Microsoft guidance above.

[INFERENCE] Because MCP's built-in Logging feature is deprecated in the 2026-07-28 specification, audit logging should be done at the gateway or platform level; the mandatory method and name headers in that specification make this feasible ([MCP blog, 28 July 2026](https://blog.modelcontextprotocol.io/posts/2026-07-28/)). This reading of the specification is the researchers' inference.

### 6.6 Cost

[VENDOR] [FAST-MOVING, 12 February 2026] Microsoft advises matching model size to the task, monitoring tokens per agent and per run, and compacting context, and notes that magentic orchestration is the least predictable in cost ([Microsoft, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)). Anthropic reports that token usage alone explained **80% of performance variance** on one benchmark and says low-value tasks cannot justify multi-agent cost ([Anthropic, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system)). The vendor multipliers in 6.1 (about 15x chat tokens in June 2025; 3 to 10x a single agent in January 2026) set the order of magnitude.

[INFERENCE] The proposed cost controls are per-department token budgets, effort-scaling rules in manager prompts, smaller models for routing and formatting, caps on fan-out and loop iterations, and a weekly cost-per-task review.

### 6.7 Evaluation and verification

[VENDOR] [DURABLE] Anthropic recommends starting evaluation with about **20 representative cases**, LLM-judge rubrics (factual accuracy, citation accuracy, completeness, source quality, tool efficiency), human review for edge cases and judging the end state and not the path. For production it calls for tracing, checkpoints with resume and gradual "rainbow" deployments ([Anthropic, multi-agent research system, 13 June 2025](https://www.anthropic.com/engineering/multi-agent-research-system)). Microsoft recommends rubric or LLM-judge integration tests in place of exact-match assertions ([Microsoft, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).

[FAST-MOVING, 26 October 2025] MAST's LLM annotator reached **94% accuracy** against human experts (kappa 0.77), which suggests that labelling traces for failure modes can be automated ([arXiv 2503.13657v3, 26 October 2025](https://arxiv.org/html/2503.13657v3)). A company could run such a labeller over cross-department task logs; that application is the researchers' inference.

[VENDOR] [FAST-MOVING, 12 February 2026] On human-in-the-loop design, Microsoft advises deciding whether a gate is optional or mandatory and whether it approves or gives feedback, persisting state at mandatory gates, scoping gates to sensitive tool invocations and not to every output, and giving maker-checker loops acceptance criteria and an iteration cap with human escalation ([Microsoft, updated 12 February 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)). OpenAI advises rating each tool low, medium or high risk by read-only versus write access, reversibility, permissions needed and financial impact, and escalating to a human when failure thresholds are exceeded or for sensitive, irreversible or high-stakes actions ([OpenAI, practical guide](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)).

[INFERENCE] Verification of a handoff deliverable should be independent of the producing department and based on stated criteria, following MAST and Anthropic, with an iteration cap followed by human escalation, following Microsoft.
