---
id: application.gaps.consolidated-gaps
department: application
domain: gaps
title: 'Application: Consolidated gaps: what this knowledge base does not know'
summary: 'What the Application knowledge base does not know: the consolidated gaps in delivery, architecture, metrics and
  AI evidence, security and supply chain, EU and Swedish regulation, customer trust and agent tooling, followed by the document''s
  conclusion.'
type: glossary
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives: []
sources: []
related:
- application.supply-chain.software-supply-chain
seed_version: 1
cross_refs:
  '10':
  - application.supply-chain.software-supply-chain
---

**When to use this:** Whenever the knowledge base seems silent: check here whether the point is a known gap, and say so instead of guessing.

**Source section:** 18. Consolidated gaps: what this knowledge base does not know (with the closing Conclusion)

### Delivery, planning and team evidence

**[GAP]** The research did not retrieve quantitative evidence on RFC or design-document effectiveness; the ADR template details; controlled evidence on pair, mob or ensemble programming (a 2009 meta-analysis was located but not opened); Microsoft or ACM code-review studies; the size and latency medians of Google's 2018 review study; the Scrum Guide, the Kanban Guide or any authoritative definition-of-done standard; any empirical comparison of Scrum, Kanban and Shape Up; any estimation-accuracy research; technical-debt benchmarks; onboarding benchmarks; Team Topologies; or the CNCF platform maturity model.

### Architecture and delivery mechanics

**[GAP]** The research did not retrieve a neutral or measured comparison of REST, GraphQL and gRPC or any GraphQL drawbacks; IETF work on an idempotency header; choreography against orchestration trade-offs, schema registries or delivery semantics; row-level-security caveats under connection pooling; AWS tiering, cost-attribution, region, sovereign-cloud or data-residency guidance; any primary source on preview or ephemeral environments; AWS-native progressive-delivery documentation; guidance on environment count or infrastructure as code; bake times for small systems; the date of the AWS Builders' Library article; OpenFeature or flag-platform practice; coverage or mutation-score thresholds; evidence on the defect effect of static typing; OpenTelemetry semantic-convention stability; or the "needs improvement" and "poor" Core Web Vitals bands and any 2026 threshold change.

### Metrics and AI evidence

**[GAP]** No DORA 2026 annual report was listed as of 11 November 2026, and the rework-rate distribution labels were garbled in extraction. Not retrieved: the DORA report on AI return on investment; the Core 4 and DX frameworks; the full JetBrains 2026 report and its second post on how much code agents write; Octoverse review-time or Sweden-specific figures; CircleCI's mid-2026 pulse update and workflow-duration benchmarks; Stack Overflow 2026 technology rankings; GitClear's 2026 figures; field experiments on Copilot-style tools (a Management Science paper and an Empirical Software Engineering 2026 article were located but not opened); vendor productivity claims; and any 2026 replication of package-hallucination rates.

### Security and supply chain

**[GAP]** Not verified: ASVS 5.0 level definitions and counts; whether a newer API Security Top 10 is in preparation; the official OWASP agentic list PDF (risk names came through a vendor summary); OpenID Connect specifics; AWS secrets-management practice; Binding Operational Directive 22-01 deadlines; PCI DSS patch and penetration-test requirements; dynamic-testing guidance; SLSA Source track levels; Sigstore, npm provenance, PyPI attestations, OpenSSF Scorecard and CISA SBOM minimum elements; current npm token limits; primary advisories for every 2026 incident named in section 10 (all come from vendor chronologies); the tj-actions and chalk/debug incidents of 2025 (unverified recollection only); and Sonatype's and Verizon's figures at source.

### Regulation in the EU and Sweden

**[GAP]** Not verified: the Commission's Cyber Resilience Act guidance annex and whether pure SaaS is outside the act; the ENISA reporting platform's status; Sweden's Cyber Resilience Act authorities; the Digital Omnibus; the EU AI Act (out of scope); the Swedish product liability bill's text and adoption; the Cybersäkerhetslag size test, the status of SaaS as a cloud computing service, essential-or-important classification, the registration procedure and the 2026 implementing regulations at source; the Swedish accessibility supervisory authority; the Swedish Data Act authority and penalties; GDPR Article 25, EDPB guidelines, IMY's list of processing requiring an impact assessment, breach-notification timing and transfer status for US sub-processors; collective-agreement on-call terms and the Working Hours Act exemptions; and the copyright status of AI-generated code.

### Customer trust

**[GAP]** No primary source was read for the SOC 2 Trust Services Criteria (current or draft), Type 1 against Type 2 definitions, ISO/IEC 27001:2022 Annex A, ISO 27701, CSA CAIQ or STAR, penetration-test standards or frequency, AWS Artifact and the shared-responsibility model, or how auditors treat AI-authored code.

### Agent tooling

**[GAP]** Not read: the Five Eyes agentic AI guidance PDF itself; any ENISA document on coding agents; Google's guidance (SAIF, secure agents paper, Gemini CLI or Jules security documentation); OpenAI's AGENTS.md and Codex best-practices pages; the second half of Anthropic's best-practices page and its classifier and admin set-up pages; the newer MCP specification revisions and MCP incident write-ups; NIST control overlays for agents; GitHub branch-protection and ruleset documentation; and AWS-specific enforcement patterns. No Hormozi house-style material exists for this domain.

## Conclusion

The research changes the framing of the question. Knowing best practice turns out to be the easy half: the durable engineering canon (small batches, fast tests, expand and contract, tenant isolation in the database, alarm-gated rollout) has barely moved in a decade, and 2026 data mostly reconfirms it. What has moved is where the constraint sits. With agents starting more than 40% of pull requests on GitHub and main-branch success falling in CircleCI's telemetry, the scarce resources are verification capacity and trustworthy gates, so the department's real product is evidence: a mutation-tested suite, a signed artifact with an SBOM, a diff a named human actually read, a timestamped incident record. Those same artefacts are what the Cyber Resilience Act, the Product Liability Directive, the Cybersäkerhetslag and the revised SOC 2 criteria ask for, which means one evidence pipeline can serve delivery, security, customers and regulators at once.

Two cautions travel with that conclusion. The first is that most numbers a manager agent will be tempted to steer by come from vendors measuring their own platforms, and the only controlled productivity trials are inconclusive by their authors' own account, so the department should baseline its own five delivery metrics before trusting anyone's benchmark. The second is that the legal picture for a pure SaaS company is still unsettled in exactly the place that matters most (whether the Cyber Resilience Act reaches it at all, and what the Swedish product liability act will finally say), and several trust-framework details in this document rest on recollection. Until the gaps in section 18 are closed at primary source, agents should treat every scope question as a handoff to a human and every "unverified" label as a stop sign.
