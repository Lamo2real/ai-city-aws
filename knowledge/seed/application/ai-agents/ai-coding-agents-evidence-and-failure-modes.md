---
id: application.ai-agents.ai-coding-agents-evidence-and-failure-modes
department: application
domain: ai-agents
title: 'Application: AI coding agents: what is measured and how they fail'
summary: 'AI coding agents, what is measured and how they fail: the honest productivity summary and the failure modes (insecure
  code at an unchanged rate, hallucinated packages and slopsquatting, prompt injection that cannot be fully prevented, licence
  contamination).'
type: principle
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- security
- quality
sources:
- https://www.veracode.com/?p=28620
- https://arxiv.org/abs/2406.10279
- https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection
- https://xygeni.io/?p=79254
- https://docs.github.com/en/copilot/responsible-use/copilot-coding-agent
related:
- application.ci-cd.ci-cd-and-release
- application.maintenance.maintenance-and-operations
- application.metrics.engineering-metrics-and-ai-evidence
- application.supply-chain.software-supply-chain
seed_version: 1
cross_refs:
  '5':
  - application.ci-cd.ci-cd-and-release
  '6':
  - application.metrics.engineering-metrics-and-ai-evidence
  '7':
  - application.maintenance.maintenance-and-operations
  '10':
  - application.supply-chain.software-supply-chain
---

**When to use this:** When judging AI-written code or deciding how much to trust an agent's output.

**Source section:** 14. AI coding agents: what is measured and how they fail

### The honest summary of productivity evidence

**[INFERENCE]** Self-reports about AI coding tools are strongly positive, controlled measurements are inconclusive, and delivery outcomes depend on the engineering discipline that existed before the tools arrived. The supporting figures (DORA 2025, METR, Stack Overflow, JetBrains, Octoverse, CircleCI, GitClear) are in sections 5 and 6 of this document with their dates and links.

### Failure mode: insecure code at an unchanged rate

**[VENDOR]** Veracode's Spring 2026 update (published 24 March 2026) tested 80 tasks (4 languages by 4 CWEs by 5) with no security prompting and its own static analyser as judge. The overall security pass rate was 55%: Python 62%, C# 58%, JavaScript 57% and Java 29%. SQL injection passed at 82% and weak cryptography at 86%, but cross-site scripting passed at only 15% and log injection at 13%. Syntax correctness rose from about 50% to 95% over two years while the security pass rate stayed flat, and GPT-5-series models with extended reasoning reached 70 to 72% in the October 2025 update ([Veracode, 24 Mar 2026](https://www.veracode.com/?p=28620)).

**[INFERENCE]** Because security pass rates are flat while syntax correctness is near-perfect, "it compiles and the tests pass" is a weaker signal than it used to be. Mandatory static analysis and security-focused review must sit between agent output and merge, with rules for CWE-80 (cross-site scripting) and CWE-117 (log injection) given blocking status and extra attention paid to output encoding, log sanitisation and Java code.

### Failure mode: hallucinated packages and slopsquatting

**[FAST-MOVING, 2024 study]** An academic study of 16 code-generating models and 576,000 samples found at least 5.2% of package references from commercial models and 21.7% from open-source models were hallucinated, with 205,474 unique non-existent package names observed; the paper dates from 2024 and models have changed, so treat the rates as figures from that era ([arXiv 2406.10279](https://arxiv.org/abs/2406.10279)). **[INFERENCE]** The control is that an agent may add a dependency only when it exists in the registry with meaningful age and download history, passes composition and licence checks, arrives through a lockfile change visible in the pull request, and is approved by a human, combined with the cool-down in section 7. **[GAP]** No 2026 replication on current frontier models was found.

### Failure mode: prompt injection cannot be fully prevented

**[DURABLE]** The UK National Cyber Security Centre (8 December 2025) explains that prompt injection differs from SQL injection because language models have no boundary between data and instructions, so it may never be fully mitigated, and the model should be treated as an inherently confusable deputy. Its guidance is to use deterministic non-LLM safeguards, to give a model processing a party's content no more privilege than that party, to mark external data clearly, not to rely on deny-lists, and to log inputs, outputs, tool and API calls while watching failed tool calls ([NCSC blog, 8 Dec 2025](https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection)).

**[VENDOR]** Real-world abuse described in a vendor write-up includes malware that invoked developers' local AI command-line tools with bypass flags (s1ngularity/Nx), invisible-Unicode payloads in editor extensions (GlassWorm), and a state-linked actor that used Claude Code to orchestrate intrusions against about 30 organisations by splitting work into innocuous-looking tasks (GTG-1002, disrupted in September 2025) ([Xygeni](https://xygeni.io/?p=79254)). **[PLATFORM CLAIM]** GitHub's agent filters hidden characters in issues and comments for this reason ([GitHub Docs](https://docs.github.com/en/copilot/responsible-use/copilot-coding-agent)).

**[INFERENCE]** A coding agent should treat as untrusted input: issue and pull-request text from outsiders, code comments and READMEs in third-party repositories, dependency source, web pages, tool and MCP responses, pipeline logs and error messages. Under the NCSC rule, a session reading such content holds no privilege beyond what the content's author should have, which means no production credentials and no push rights to protected branches.

### Failure mode: licence contamination

**[PLATFORM CLAIM]** GitHub acknowledges that its coding agent may produce output matching public code and requires human review before merge ([GitHub Docs](https://docs.github.com/en/copilot/responsible-use/copilot-coding-agent)); the licence policy is in section 10.
