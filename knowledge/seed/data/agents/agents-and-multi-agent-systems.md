---
id: data.agents.agents-and-multi-agent-systems
department: data
domain: agents
title: 'Data and AI: Agents and multi-agent systems'
summary: 'Agents and multi-agent systems: evidence on when multi-agent helps (parallel work) and hurts (sequential work), orchestration patterns, manager and worker practice, memory and long-running tasks, MCP and A2A, and the capability trend.'
type: principle
audience: both
confidence: vendor
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- aws
- bedrock
objectives:
- ai-features
sources:
- https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/
- https://arxiv.org/abs/2512.08296
- https://www.anthropic.com/engineering/multi-agent-research-system
- https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- https://cognition.ai/blog/dont-build-multi-agents
- https://arxiv.org/abs/2503.13657
- https://www.anthropic.com/engineering/building-effective-agents
- https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
- https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns
- https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system
- https://aws.amazon.com/bedrock/faqs/
- https://modelcontextprotocol.io/specification/latest
- https://www.anthropic.com/engineering/writing-tools-for-agents
- https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf
- https://a2a-protocol.org/latest/
- https://www.danilchenko.dev/posts/stanford-ai-index-2026/
- https://hai.stanford.edu/ai-index/2026-ai-index-report
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before designing an agent or a multi-agent system, splitting work across workers, or adding MCP or A2A.

**Source section:** 12. Agents and multi-agent systems: one orchestrator, workers only for parallel work

### Evidence on when multi-agent helps and when it hurts

**[FAST-MOVING, 28 January 2026]** The strongest evidence on multi-agent design is a Google Research study of 180 configurations across 5 architectures (single agent and independent, centralised, decentralised and hybrid multi-agent), 4 benchmarks and 3 model families ([Google Research blog, 28 Jan 2026](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/); [arXiv 2512.08296](https://arxiv.org/abs/2512.08296)).

**[FAST-MOVING, 28 January 2026]** In the Google Research study, centralised coordination raised performance by 80.9% on a parallelisable finance task, while every multi-agent variant lowered performance by 39 to 70% on a sequential planning task ([Google Research blog, 28 Jan 2026](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/)). **[INFERENCE]** The numbers come from four benchmarks, so the direction (parallel helps, sequential hurts) is more reliable than the exact percentages.

**[FAST-MOVING, 28 January 2026]** Independent agents amplified errors 17.2 times in the Google Research study, and a central orchestrator contained that to 4.4 times. Coordination overhead grows disproportionately with tool count (the example given is 16 or more tools), and a predictive model picked the best architecture for 87% of unseen configurations (R² of 0.513) ([Google Research blog, 28 Jan 2026](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/)).

**[VENDOR] [FAST-MOVING, 13 June 2025]** Anthropic's orchestrator-worker research system beat a single agent by 90.2% on Anthropic's internal research eval, and token use alone explained 80% of the variance on BrowseComp (95% with tool calls and model choice added) ([Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)). The eval is internal and vendor-reported.

**[VENDOR] [FAST-MOVING, 13 June 2025]** Anthropic's fit guidance: multi-agent suits breadth-first research, heavy parallelism, information exceeding one window and many complex tools; it suits poorly tasks needing shared context or tight inter-agent dependencies, which includes most coding ([Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)).

**[CONTESTED] [FAST-MOVING, 26 November 2025]** Whether one general coding agent or a multi-agent set-up with specialised test and QA agents performs better for long-running coding is unresolved; Anthropic said so on 26 November 2025 ([Anthropic, Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)). Unverified background, not fetched: Cognition argued in June 2025 against parallel sub-agents for coding because sub-agents lacking shared context make conflicting implicit decisions ([Cognition, Don't build multi-agents](https://cognition.ai/blog/dont-build-multi-agents)).

**[DURABLE]** Unverified background, not fetched. The MAST study of multi-agent failures (2025) catalogued 14 failure modes in three groups: specification and system design, inter-agent misalignment, and task verification and termination ([Cemri et al., arXiv 2503.13657](https://arxiv.org/abs/2503.13657)).

### Orchestration patterns in vendor guidance

**[VENDOR] [DURABLE]** Anthropic (December 2024) separates workflows, which follow predefined code paths, from agents, where the model directs its own process. It lists prompt chaining, routing, parallelisation (sectioning and voting), orchestrator-workers and evaluator-optimizer, and advises calling model APIs directly before adopting frameworks ([Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)).

**[VENDOR] [FAST-MOVING, 2025]** OpenAI describes a single-agent loop, a manager pattern (a central agent calls specialists as tools and keeps control) and decentralised handoffs (peers pass control and state). It advises splitting into several agents only when prompts carry complex conditional logic or tools overlap and better naming does not fix selection ([OpenAI, A practical guide to building agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)).

**[VENDOR] [FAST-MOVING, 12 February 2026]** Microsoft lists sequential, concurrent, group chat (it suggests three or fewer agents), handoff and magentic (task-ledger planning, the hardest to predict in cost) patterns, and says to use a deterministic router when the right agent is known up front ([Microsoft Azure Architecture Center, 12 Feb 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).

**[VENDOR] [FAST-MOVING, 28 May 2026]** Google Cloud lists single agent, sequential, parallel, loop, review-and-critique, iterative refinement, coordinator, hierarchical decomposition, swarm, ReAct, human-in-the-loop and custom logic patterns; recommends starting with a single agent; and notes that predefined-logic patterns cost less than model-driven orchestration ([Google Cloud, 28 May 2026](https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** Amazon Bedrock AgentCore provides Identity (agent access on behalf of users), Memory, Policy (authorising every tool call at a gateway using natural-language or Cedar rules) and Observability (tracing); "Bedrock Managed Agents" is in preview as of November 2026 ([AWS Bedrock FAQs](https://aws.amazon.com/bedrock/faqs/)).

### Manager and worker practice

**[VENDOR] [FAST-MOVING, 13 June 2025]** Each task a manager agent delegates needs an objective, an output format, tool and source guidance and clear boundaries; Anthropic reports that vague briefs caused duplicated work and gaps ([Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)).

**[VENDOR] [FAST-MOVING, 13 June 2025]** Anthropic placed effort-scaling rules in its orchestrator prompt: simple fact-finding gets 1 agent with 3 to 10 tool calls; direct comparisons get 2 to 4 sub-agents with 10 to 15 calls each; and complex research gets 10 or more sub-agents. Early versions spawned 50 sub-agents for simple queries ([Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)).

**[VENDOR] [FAST-MOVING, 13 June 2025]** Running 3 to 5 sub-agents in parallel, each using parallel tool calls, cut Anthropic's research time by up to 90% on complex queries; synchronous sub-agent execution remains a bottleneck ([Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)).

**[INFERENCE]** For a manager agent directing worker agents, which is this department's own shape, the evidence supports centralised orchestration and not peer swarms; workers only for parallelisable, separable subtasks; sequential dependent work kept in one agent; a written brief template (objective, output format, tools and sources, boundaries, effort budget); workers returning condensed, sourced summaries; the manager verifying outputs before synthesis; and explicit caps on worker count, tool calls and tokens ([Google Research blog, 28 Jan 2026](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/); [Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)).

**[INFERENCE]** Budget rule of thumb from Anthropic's June 2025 figures: expect roughly 4 times chat cost for a single agent and roughly 15 times for multi-agent, and require a task-value justification for the latter ([Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)).

### Memory and long-running tasks

**[VENDOR] [FAST-MOVING, 26 November 2025]** Anthropic's long-running harness uses a first "initializer" session that creates an init script, a progress log, a JSON feature list (more than 200 features, all marked failing) and a first git commit. Each later session reads the git log and progress files, runs a smoke test, does one feature, tests end to end as a user, commits and updates notes ([Anthropic, Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)).

**[VENDOR] [FAST-MOVING, 26 November 2025]** Observed failure modes of long-running agents, per Anthropic: trying to do everything at once, declaring the job done early, marking features as passing without real tests, and leaving undocumented half-finished state. JSON status files were chosen because models overwrite them less carelessly than Markdown ([Anthropic, Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)).

**[VENDOR] [FAST-MOVING, 2025 to 2026]** Production lessons for agent systems: checkpoint and resume from failure instead of restarting, trace everything, and use rainbow deployments so that running agents are not broken by releases (Anthropic, 13 June 2025) ([Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)); persist shared state externally for long or multi-session workflows, set iteration limits, validate outputs before passing them downstream, and use timeouts, retries and circuit breakers (Microsoft, 12 February 2026) ([Microsoft Azure Architecture Center, 12 Feb 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).

**[INFERENCE]** Agent memory design: separate working context, durable task state (files, tickets, git) and long-term memory; treat long-term memory writes as untrusted input that can be poisoned (OWASP ASI06); version and attribute them; and let humans review and delete them.

### MCP and A2A

**[FAST-MOVING, 28 July 2026]** The current Model Context Protocol specification is dated 28 July 2026. It uses JSON-RPC 2.0 with hosts, clients and servers and stateless, self-contained requests with per-request capability negotiation; servers offer resources, prompts and tools; clients may offer elicitation; and optional extensions include Tasks (asynchronous long-running operations), Skills over MCP and MCP Apps ([MCP specification](https://modelcontextprotocol.io/specification/latest)).

**[FAST-MOVING, 28 July 2026]** The MCP specification itself says tools are arbitrary code execution, that tool descriptions and annotations from untrusted servers must be treated as untrusted, that hosts must get explicit user consent before invoking tools or exposing user data, and that the protocol cannot enforce these principles ([MCP specification](https://modelcontextprotocol.io/specification/latest)). **[VENDOR]** Anthropic advises using tool annotations on MCP servers to flag destructive or open-world actions ([Anthropic, Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)).

**[FAST-MOVING, April 2026]** "MCP by default" is in Caution on the Thoughtworks Technology Radar Volume 34 of April 2026, meaning MCP should not be the default where simpler integration works ([Thoughtworks Radar Vol 34, Apr 2026](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf)).

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** A2A (Agent2Agent) is an open standard for agent-to-agent communication, originally developed by Google and donated to the Linux Foundation, with a Technical Steering Committee of representatives from AWS, Cisco, Google, IBM Research, Microsoft, Salesforce, SAP and ServiceNow. The project describes MCP as agent-to-tool and A2A as agent-to-agent (discovery, task delegation, result sharing) and the two as complementary; SDKs exist for Python, JavaScript, Java, C#/.NET, Go and Rust ([A2A Protocol](https://a2a-protocol.org/latest/)).

**[INFERENCE]** A2A is needed only when agents owned by different teams or vendors must interoperate; inside one department, direct orchestration plus MCP for tools is simpler. No evidence on A2A production adoption was found.

### Capability trend

**[FAST-MOVING, 20 June 2026]** A blog summary of the Stanford AI Index 2026, dated 20 June 2026 and not checked against the report, says agent success on OSWorld rose from about 12% to about 66% and on SWE-bench Verified from about 60% to near 100% within a year ([Danilchenko summary](https://www.danilchenko.dev/posts/stanford-ai-index-2026/); primary report at [Stanford HAI AI Index 2026](https://hai.stanford.edu/ai-index/2026-ai-index-report)).

### Gaps in the agent evidence

**[GAP]** MCP governance, its current authorisation model and registry status were not confirmed. The A2A specification version, agent card and task concepts and transports were not read. AWS prescriptive guidance on agentic patterns, Microsoft Agent Framework and Google ADK were not fetched. No independent production reliability statistics (task success in real deployments, cost per task) were found; published numbers are benchmarks or vendor-reported.
