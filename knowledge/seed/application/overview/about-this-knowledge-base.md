---
id: application.overview.about-this-knowledge-base
department: application
domain: overview
title: 'Application: About this knowledge base'
summary: 'What the Application knowledge base is: the opening summary (ship small, gate hard, prove everything), what each
  claim label means ([DURABLE], [FAST-MOVING, date], [VENDOR], [PLATFORM CLAIM], [CONTESTED], [INFERENCE], [GAP]), the legal-source
  qualifiers and the seven caveats that apply to every document.'
type: glossary
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives: []
sources:
- https://dora.dev/research/
related:
- application.gaps.consolidated-gaps
seed_version: 1
cross_refs:
  '18':
  - application.gaps.consolidated-gaps
---

**When to use this:** Before relying on any Application document: to read a label, a "checked on primary source" qualifier or a caveat correctly.

**Source section:** Opening summary and "How to read and split this document"

# Ship small, gate hard, prove everything

As of 11 November 2026, the foundational knowledge for an AI-run Application department is a short list of durable engineering habits wrapped in controls that the platform enforces and the law now demands evidence for. The durable habits are small changes merged to trunk at least daily, automated tests that answer in under ten minutes, peer review answered within one business day, a modular monolith with pooled tenancy and database-enforced tenant isolation, schema and API changes made through expand, migrate and contract, and progressive rollout with alarm-driven automatic rollback. The evidence on AI coding agents is lopsided: use is near-universal (90% in DORA's 2025 survey and in JetBrains' 2026 survey), organisational throughput is up, but delivery instability is still up too, a vendor benchmark finds only 55% of AI-generated samples free of a known vulnerability class with no improvement in two years, CircleCI's telemetry shows main-branch success down to 70.8%, and no trustworthy measurement of individual speed-up exists. The consistent answer from the UK NCSC, the Five Eyes agencies, OWASP, GitHub, Anthropic and OpenAI is that anything which must always or never happen belongs in a deterministic control (sandbox, default-deny egress, missing credentials, branch protection, human merge) and never in an instruction file. For a Sweden-based SaaS company the binding dates cluster tightly: Cyber Resilience Act reporting has applied since 11 September 2026 to any installable product, the new Product Liability Directive treats software including SaaS as a product from 9 December 2026 (the Swedish bill proposes 1 January 2027), Data Act switching charges fall to zero on 12 January 2027, and the Swedish Cybersäkerhetslag has been in force since 15 January 2026 with Post- och telestyrelsen supervising cloud and managed service providers. Customers and auditors increasingly ask for machine-verifiable proof of all this (SBOMs, scan logs, named human approvers, agent session logs), and the SOC 2 criteria are being revised to separate in-house software change management and add AI points of focus. The research behind this document ran out of search and fetch budget several times, so penetration-test frequency, ISO/IEC 27001 control wording, SOC 2 criterion text, estimation and method comparisons, preview environments, the EU AI Act and several Swedish authority designations remain unverified and are listed as gaps instead of being filled from memory.

## How to read and split this document

This document is written to be cut into atomic knowledge-base entries for a vector index and a graph database. Every body paragraph is meant to stand alone: it opens with one or more labels, names its subject in full, and keeps each number next to its date and its source link. Numbered sections group domains; sub-headings name the single topic of the paragraphs beneath them. Tables repeat their source link in every row so that a row can be split out as its own entry. When splitting, keep the label, the date and the link with the claim.

The labels mean the following. **[DURABLE]** marks a principle, definition or long-standing rule that has held for years and is unlikely to age quickly; numbers inside older durable sources are historical. **[FAST-MOVING, date]** marks a figure, version number, survey result, tool behaviour or legal status that will age, with the date of the source. **[VENDOR]** marks a figure or recommendation from a party with a commercial interest in the conclusion (tool vendors, cloud providers, security vendors, audit and law firms describing their own market), including large telemetry datasets from such companies; treat it as correlational and self-selected. **[PLATFORM CLAIM]** marks a platform's or tool maker's own description of how its product behaves, which nobody has independently verified. **[CONTESTED]** marks a point where sources disagree. **[INFERENCE]** marks a synthesis or default written by the researchers that no single fetched source states; adopt it as a starting position and tune it against your own data. **[GAP]** marks something the research did not verify or could not find. **[HOUSE STYLE]** is reserved for Alex or Leila Hormozi's published frameworks, which the owner has chosen as the default style where they exist; the research notes for this department contain no Hormozi material on software engineering, so the label is not used in the body and no house-style rule should be assumed for engineering work.

For legal, tax and regulatory points a qualifier is added inside or beside the label. "Checked on primary source" means the statute, regulation or official page was read during the research (through an extraction tool, so re-check the exact article or section wording before quoting it). "Secondary source only" means a law firm, audit firm, agency summary or independent site was read and the primary text was not. "Unverified, not fetched" means the point comes from the researchers' background recollection, with a pointer to where it should be confirmed. Agents must not gate a live decision on an unverified legal point without confirmation from the Legal department or outside counsel.

Seven caveats apply to the whole document. First, legal and regulatory content is orientation as of 11 November 2026 and is not professional legal, tax or compliance advice. Second, the shared web-search and page-fetch budgets ran out during all three research passes, so a number of well-known primary sources were never opened; they appear in section 18, not in the body. Third, the default context assumed by the researchers is a Sweden-based SaaS company running on AWS and selling in the EU; general practice is written to fit any company and Swedish or EU specifics are called out. Fourth, the survey and telemetry numbers are largely self-reported or vendor-platform data (DORA is published by Google, Octoverse by GitHub, the State of Software Delivery by CircleCI, the Developer Ecosystem survey by JetBrains) and none is Sweden-specific. Fifth, DORA's most recent annual report is the 2025 edition; no 2026 report was listed on 11 November 2026 ([DORA research](https://dora.dev/research/)). Sixth, all sources are paraphrased, and no source wording should be attributed as a quotation. Seventh, NIST publications bind US federal systems only and are used here as reference standards, not as law in Sweden.
