---
id: data.evaluation.llm-evaluation
department: data
domain: evaluation
title: 'Data and AI: Evaluation'
summary: 'LLM evaluation: error analysis first, building the evaluation set with binary labels, validating an LLM judge against humans, code checks, regression tests and human review, security evaluation with adaptive attackers, and the minimum evaluation stack.'
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- bedrock
objectives:
- ai-features
sources:
- https://hamel.dev/blog/posts/llm-judge/
- https://www.anthropic.com/engineering/multi-agent-research-system
- https://arxiv.org/abs/2406.12624
- https://www.anthropic.com/engineering/writing-tools-for-agents
- https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns
- https://arxiv.org/abs/2510.09023
- https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before evaluating an LLM feature, prompt, model change or agent, building an eval set, or trusting an LLM judge.

**Source section:** 14. Evaluation: error analysis first, binary labels, judges validated against humans

### Building the evaluation set

**[FAST-MOVING, modified 1 September 2026]** Hamel Husain's practitioner method (published 29 October 2024, modified 1 September 2026): pick one or two principal domain experts; build a dataset across features, scenarios and personas from real and synthetic inputs; and begin with about 30 examples, adding until no new failure modes appear ([Hamel Husain, LLM-as-a-judge guide](https://hamel.dev/blog/posts/llm-judge/)).

**[DURABLE]** Use binary pass or fail labels with detailed written critiques instead of 1 to 5 scales, which are less actionable and often do not track what experts care about ([Hamel Husain, LLM-as-a-judge guide](https://hamel.dev/blog/posts/llm-judge/)).

**[VENDOR] [FAST-MOVING, 13 June 2025]** Anthropic started its agent evals with about 20 real queries because early changes have large effects, and found that a single judge call scoring 0.0 to 1.0 plus pass or fail against a rubric (factual accuracy, citation accuracy, completeness, source quality, tool efficiency) matched humans best ([Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)).

### Validating an LLM judge

**[FAST-MOVING, modified 1 September 2026]** Reuse classical ML hygiene for LLM judges: split labelled data into 10 to 20% train (few-shot examples), 40 to 45% dev and 40 to 45% test; use the test set once after the prompt is frozen; and report true-positive and true-negative rates, because raw agreement misleads when failures are rare ([Hamel Husain, LLM-as-a-judge guide](https://hamel.dev/blog/posts/llm-judge/)).

**[FAST-MOVING, modified 1 September 2026]** Sample sizes for judge validation in the same guide: aim for 30 to 50 examples per label in dev and test and about 100 per failure mode for validation; confidence intervals are often too wide below about 60 examples; and re-validate after material changes such as a model update ([Hamel Husain, LLM-as-a-judge guide](https://hamel.dev/blog/posts/llm-judge/)).

**[FAST-MOVING, 2024 to 2025]** LLM judges sit well below human agreement and lean lenient. A peer-reviewed workshop paper (GEM at ACL 2025, arXiv 2406.12624) studied 13 judge models scoring 9 exam-taker models in a setting where humans agree strongly: only the best and largest judges reach reasonable alignment with humans, they remain well behind inter-human agreement, and their scores can differ from human scores by up to 5 points. For ranking systems, smaller judges and even a simple lexical "contains" metric give a reasonable signal. Weaknesses are sensitivity to prompt length and complexity, and leniency; percent agreement alone misleads, since judges with high percent agreement can still assign very different scores ([Thakur et al., Judging the Judges](https://arxiv.org/abs/2406.12624)).

**[INFERENCE]** Judge practice implied by the evidence: use an LLM judge to rank variants and catch regressions; do not treat its absolute scores as ground truth; calibrate on a human-labelled sample and report a chance-corrected agreement statistic instead of percent agreement (Cohen's kappa is the researchers' reading; the paper's abstract does not name a statistic); keep judge prompts short and fixed; and expect leniency, so audit a sample of "pass" verdicts ([Thakur et al., Judging the Judges](https://arxiv.org/abs/2406.12624)). One paper is thin support for a whole evaluation policy.

**[INFERENCE]** Use a judge model from a different family, or at least a different prompt, from the system under test to limit self-preference. **[GAP]** No 2026 study quantifying self-preference or position bias was read.

### Code checks, regression tests and human review

**[DURABLE]** Prefer code assertions where they work, build specialised judges only for the remaining failure types, and write a regression test for each fixed error ([Hamel Husain, LLM-as-a-judge guide](https://hamel.dev/blog/posts/llm-judge/)).

**[VENDOR] [FAST-MOVING, 13 June 2025]** Automated scores do not replace human review: Anthropic's human testers caught a bias automation missed, with agents preferring SEO-optimised content farms over authoritative sources ([Anthropic, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)).

**[VENDOR] [FAST-MOVING, 11 September 2025]** For tool and agent evals, Anthropic advises realistic multi-step tasks with verifiable outcomes; verifiers tolerant of harmless formatting differences; tracking accuracy, run time, tool-call count, tokens and tool errors; reading transcripts; and keeping a held-out set to detect overfitting ([Anthropic, Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)).

**[VENDOR] [FAST-MOVING, 12 February 2026]** Microsoft advises instrumenting every agent operation and handoff, tracking per-agent tokens and performance, and using rubrics or LLM-as-judge instead of exact-match assertions because outputs are non-deterministic ([Microsoft Azure Architecture Center, 12 Feb 2026](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)).

### Security evaluation needs adaptive attackers

**[FAST-MOVING, 10 October 2025]** Security evaluations that use static attack strings mislead: adaptive attacks broke 12 published defences, most with over 90% success, although the defences had reported near-zero attack success ([Nasr et al., arXiv 2510.09023](https://arxiv.org/abs/2510.09023)). **[FAST-MOVING, December 2025]** OWASP's agentic guidance, read through a secondary summary, calls for assessment before and after deployment with automated scans and continuous red-teaming ([Giskard summary of OWASP Agentic Top 10](https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026)).

### Minimum evaluation stack

**[INFERENCE]** Minimum evaluation stack, the researchers' synthesis: a golden set of 50 to 200 cases with expert labels, stratified by scenario and including adversarial and "should refuse or escalate" cases; deterministic checks (schema validity, citations resolve, forbidden content, latency and cost budgets); validated LLM judges per failure mode; a CI gate that runs the set on every prompt, model, tool or retrieval change and blocks on regression; online signals (sampled human review, user feedback, guardrail trigger rates, escalation rate, cost and latency percentiles); and a trace store covering each model call, tool call, retrieved chunk and handoff.

**[INFERENCE]** Treat a provider's model-version change as a release: re-run the full eval set and re-validate the judges, because judge behaviour shifts too. Refresh the eval set from production failures on a regular cadence and keep a frozen subset for trend lines.

### Gaps in the evaluation evidence

**[GAP]** Eugene Yan's and Chip Huyen's material and tooling specifics (OpenTelemetry GenAI semantic conventions, Langfuse, LangSmith, Braintrust, Bedrock evaluations) were not retrieved. No sourced thresholds exist for online metrics such as an acceptable escalation rate; these are product-specific.
