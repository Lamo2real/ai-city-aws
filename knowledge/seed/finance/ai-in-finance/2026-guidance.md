---
id: finance.ai-in-finance.2026-guidance
department: finance
domain: ai-in-finance
title: 'Finance: AI in the finance function: what the 2026 guidance says'
summary: 'AI in the finance function: COSO''s 2026 generative-AI paper (risks, capability types, controls by component, agents, reliance test, roadmap) and the UK FRC''s generative and agentic AI guidance, and what they mean for a Swedish company.'
type: principle
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- controls
sources:
- https://www.coso.org/_files/ugd/719ba0_08f358f2c8f946fa9d26bd51d37b7117.pdf
- https://icas.com/news-insights-events/news/audit-assurance/frc-issues-new-guidance-to-support-audit-firms-using-emerging-ai-technologies/
- https://media.frc.org.uk/documents/Generative_and_Agentic_AI_Guidance_crosPeBU.pdf
- https://www.learnsignal.com/blog/frc-ai-audit-guidance-what-it-requires/
- https://www.monterro.com/media/2finidot/monterro-nordic-software-benchmark-report-2026_web.pdf
related:
- finance.controls.controls-and-fraud-risk
- finance.guardrails.agent-guardrails
seed_version: 1
---

**When to use this:** When deciding how AI is used in the finance function: COSO's 2026 generative-AI guidance and the UK FRC's guidance on generative and agentic AI.

**Source section:** 18. AI in the finance function: what the 2026 guidance says

### COSO's 2026 generative-AI paper: scope and stance

**[FAST-MOVING, 2026]** COSO's "Achieving Effective Internal Control Over Generative AI" (copyright 2026; authors Scott Emett, Marc Eulerich, Jason Guthrie of EY, Jason Pikoos of Meta and David A. Wood; commissioned by COSO) adapts the 2013 Integrated Framework instead of creating a new one, focuses on risks unique to or amplified by generative AI, and excludes rule-based automation and robotic process automation ([COSO, Achieving Effective Internal Control Over Generative AI, 2026 (PDF)](https://www.coso.org/_files/ugd/719ba0_08f358f2c8f946fa9d26bd51d37b7117.pdf)). Its exact publication month is not stated in the PDF.

### Risks COSO names

**[FAST-MOVING, 2026]** The paper names hallucinations; prompt injection; opaque reasoning; model drift and vendor updates; fast-changing configurations such as prompts, thresholds and retrieval connectors; data exfiltration and privacy; bias; third-party opacity; data provenance gaps; "shadow AI"; and fraud through deepfakes and synthetic records ([COSO, Achieving Effective Internal Control Over Generative AI, 2026 (PDF)](https://www.coso.org/_files/ugd/719ba0_08f358f2c8f946fa9d26bd51d37b7117.pdf)).

### COSO's eight capability types

**[FAST-MOVING, 2026]** The eight capability types are data extraction and ingestion; data transformation and integration; automated transaction processing and reconciliation; workflow orchestration and autonomous task execution; judgment, forecasting and insight generation; AI-powered monitoring and continuous review; knowledge retrieval and summarisation; and human–AI collaboration. An appendix profiles each with risks, controls by component, metrics and artefacts ([COSO, Achieving Effective Internal Control Over Generative AI, 2026 (PDF)](https://www.coso.org/_files/ugd/719ba0_08f358f2c8f946fa9d26bd51d37b7117.pdf)). A finance department can use the eight types as the taxonomy for its agent inventory.

### COSO's foundational characteristics

**[DURABLE]** The paper's foundational points are that output is probabilistic and should be treated as a claim to validate; systems change, so risk assessment and monitoring must be ongoing; AI scales errors as well as quality; low barriers to entry mean building and using it needs governance; and AI can help control AI, for example through multi-model cross-checks ([COSO, Achieving Effective Internal Control Over Generative AI, 2026 (PDF)](https://www.coso.org/_files/ugd/719ba0_08f358f2c8f946fa9d26bd51d37b7117.pdf)).

### COSO's controls by component

**[FAST-MOVING, 2026]** Control environment: named owners and a RACI for prompts, retrieval data and transformation rules, an acceptable-use policy, training, and board visibility through a cross-functional committee. Risk assessment: objectives and success criteria per use case, including whether generative AI is the right tool, AI-specific fraud schemes, and reassessment triggered by vendor or model change. Control activities: human-in-the-loop review scaled to risk, separation of AI assistance from authoritative decisions, and models, configurations, embeddings and retrieval indexes treated as configuration items with an "AI bill of materials". Information and communication: capture prompts, inputs, outputs, sources, model versions and confidence scores. Monitoring: KPIs and KRIs, adversarial testing, a deficiency and remediation log, and multi-metric tolerances instead of pass or fail ([COSO, Achieving Effective Internal Control Over Generative AI, 2026 (PDF)](https://www.coso.org/_files/ugd/719ba0_08f358f2c8f946fa9d26bd51d37b7117.pdf)).

### COSO's specific controls

**[FAST-MOVING, 2026]** Specific controls in the paper include confidence thresholds that route low-confidence items to a person; separating configuration rights from approval rights; version history, approval workflow and rollback for model and prompt changes; provenance tagging, schema validation, pre- and post-reconciliations and citation requirements; and vendor-change notification with validation before deployment ([COSO, Achieving Effective Internal Control Over Generative AI, 2026 (PDF)](https://www.coso.org/_files/ugd/719ba0_08f358f2c8f946fa9d26bd51d37b7117.pdf)).

### COSO on agents

**[FAST-MOVING, 2026]** The paper's definitions include models that plan and execute multi-step tasks through tools. Under fraud risk it flags excessive agency, authorisation risk and insecure interfaces, and its controls include documented expected routing logic, simulation before go-live, multi-party approval of configuration changes and audit of routing outcomes ([COSO, Achieving Effective Internal Control Over Generative AI, 2026 (PDF)](https://www.coso.org/_files/ugd/719ba0_08f358f2c8f946fa9d26bd51d37b7117.pdf)).

### COSO's reliance test

**[DURABLE]** When management uses AI output as evidence for internal control over financial reporting, that use needs the same evidence standard as any other such control; uses that are not relied on can carry lighter evidence ([COSO, Achieving Effective Internal Control Over Generative AI, 2026 (PDF)](https://www.coso.org/_files/ugd/719ba0_08f358f2c8f946fa9d26bd51d37b7117.pdf)). For agents this means the review burden follows what the output is used for, not how impressive it looks.

### COSO's six-step roadmap

**[FAST-MOVING, 2026]** The roadmap is: establish a governance structure; inventory use cases, including scans for shadow AI; assess risk by component; design and map controls; implement and communicate; and monitor and adapt, then repeat. The paper offers no separate small-entity guidance and says governance should fit size, complexity and AI usage ([COSO, Achieving Effective Internal Control Over Generative AI, 2026 (PDF)](https://www.coso.org/_files/ugd/719ba0_08f358f2c8f946fa9d26bd51d37b7117.pdf)).

### The UK FRC's guidance on generative and agentic AI

**[FAST-MOVING, March 2026]** The UK Financial Reporting Council published "Generative and Agentic AI Guidance" in March 2026. It is addressed to audit firms' central technical teams, is the FRC's second AI publication, is framed as good practice and not a response to failings, and leaves responsibility with the human auditor ([ICAS, 30 March 2026](https://icas.com/news-insights-events/news/audit-assurance/frc-issues-new-guidance-to-support-audit-firms-using-emerging-ai-technologies/); [FRC, Generative and Agentic AI Guidance, March 2026 (PDF)](https://media.frc.org.uk/documents/Generative_and_Agentic_AI_Guidance_crosPeBU.pdf)). It defines agentic AI as systems that orchestrate and carry out multiple tasks toward a goal with some autonomy over how, without step-by-step instruction, and a human in the loop as a person who directs, authorises or reviews actions or outputs at runtime ([FRC, Generative and Agentic AI Guidance, March 2026 (PDF)](https://media.frc.org.uk/documents/Generative_and_Agentic_AI_Guidance_crosPeBU.pdf)).

### FRC risk taxonomy and mitigations

**[FAST-MOVING, March 2026]** The FRC's risk taxonomy covers deficient output (model errors such as hallucination, omission and faulty reasoning; orchestrator errors; failures in data, rules or tool components; combination risk where errors amplify across steps; human input errors in task specification and configuration; poor source information), misuse of output, and non-compliant methodology. Mitigations fall into four groups: system design (workflow design, output schemas, scope and authority boundaries, prompt libraries, model ensembles); certification testing (default, edge and diverse cases, recertification triggers, limited deployment); staff education and governance; and human review at final output and at intermediate control points. Confidence is proportional to reliance: how much assurance a tool needs depends on how its output is used, and the file should record that AI was used and how output informed conclusions ([FRC, Generative and Agentic AI Guidance, March 2026 (PDF)](https://media.frc.org.uk/documents/Generative_and_Agentic_AI_Guidance_crosPeBU.pdf)).

### What the FRC guidance means for a Swedish company

**[INFERENCE]** The FRC text binds only UK audit firms. The auditor of a Swedish aktiebolag may be expected to follow similar thinking when relying on AI-prepared evidence, so the department should be able to show, for any figure an agent prepared, what the agent did, from which sources, with which model version, and who reviewed it. **[GAP]** No guidance on AI in finance functions from FAR, Revisorsinspektionen, IAASB or PCAOB was found; one unverified headline says the FRC is the only audit regulator with published AI guidance ([LearnSignal](https://www.learnsignal.com/blog/frc-ai-audit-guidance-what-it-requires/)); and the EU AI Act's application to finance workflows was not researched.

### Measured results of AI in finance are not sourced

**[GAP]** No sourced adoption rates or measured results for AI in accounts payable, close, reconciliation or forecasting were obtained, and no incident data on AI-agent errors in finance processes. Commonly cited automation targets (invoice capture and coding, bank and intercompany reconciliation, accrual and flux-analysis drafting, collections prioritisation, forecast baselines, expense audit) are unverified working knowledge, and vendor-reported time savings should be labelled as claims until measured locally. The nearest sourced data point is Nordic: 97% of Monterro's sample report positive internal effects from AI but only 27% report measurable cost reductions ([Monterro Nordic B2B Software Benchmark 2026, 19 April 2026 (PDF)](https://www.monterro.com/media/2finidot/monterro-nordic-software-benchmark-report-2026_web.pdf)).
