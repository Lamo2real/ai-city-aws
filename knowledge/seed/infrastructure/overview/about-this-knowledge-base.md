---
id: infrastructure.overview.about-this-knowledge-base
department: infrastructure
domain: overview
title: 'IT infrastructure: About this knowledge base'
summary: 'The opening summary and the reading guide: the claim labels ([DURABLE], [FAST-MOVING], [VENDOR], [PLATFORM CLAIM], [CONTESTED], [INFERENCE], [GAP]), the legal-source qualifiers and seven caveats.'
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
- infrastructure.gaps.consolidated-gaps
- infrastructure.guardrails.agent-guardrails
cross_refs:
  '20':
  - infrastructure.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before relying on any IT infrastructure document: the overall position, what each label means, the legal-source qualifiers and the caveats that apply to everything.

**Source:** the title, opening summary and "How to read and split this document" of the IT infrastructure research.

# Agents operate infrastructure; humans own irreversible decisions

As of 11 November 2026, the foundational practice for an AI-run IT infrastructure department on AWS is a short list of durable rules backed by a fast-moving layer of dates and thresholds: build a multi-account AWS organisation in EU Regions (Stockholm primary, an EU secondary for recovery), express everything as code that only a pipeline applies, stage every change including configuration, run reliability from SLOs with data-plane-only failover, keep backups where no workload or agent credential can delete them, patch by exploitation and exposure instead of by severity score, and give each agent its own least-privilege identity with a human approval gate on anything destructive. The evidence behind those rules is consistent: the large outages of 2025 and 2026 came from global configuration pushes and unchecked automation, exploited vulnerabilities are now the leading way into breached organisations (31% in Verizon's 2026 report), attackers hand off access within 22 seconds in Mandiant's 2025 casework, and the two best-documented agent incidents (Kiro in December 2025, PocketOS in April 2026) both involved an agent holding broad inherited permissions with no second approver. For a Sweden-based SaaS company the regulatory layer is concrete and already live: Cybersäkerhetslagen has applied since 15 January 2026, a cloud provider's full outage of more than 30 minutes is a reportable significant incident under Implementing Regulation (EU) 2024/2690, the early warning is due within 24 hours to the national cybersecurity centre, GDPR's 72-hour notice to IMY runs in parallel, and the Data Act bans switching charges from 12 January 2027. Several reference points changed during 2026 and older knowledge is now wrong: CISA revoked its two patching directives in favour of BOD 26-04 (10 June 2026), NIST finalised its post-quantum transition report on 27 October 2026 with 2030 and 2035 dates, the FinOps Framework was reissued on 19 March 2026 to cover all technology spend, and the AICPA published draft 2027 SOC 2 criteria on 26 October 2026. Two time-critical items exist today: EKS clusters on version 1.31 are force-upgraded after 26 November 2026, and version 1.34 leaves standard support on 2 December 2026. The research behind this document hit search and fetch limits, so network topology choices, policy-as-code and GitOps tooling, chaos engineering, autoscaling policy, device-management baselines and several legal details are stated as gaps and not filled from memory. The legal content is orientation only and not professional advice.

## How to read and split this document

This document is written to be cut into atomic knowledge-base entries. Every body paragraph is meant to stand alone: it opens with one or more labels, names its subject in full, and keeps each number next to its date and its source link. Section numbers group domains; sub-headings name the single topic of the paragraphs beneath them. Tables carry a source or label in each row so that a row can be split out as its own entry. When splitting, keep the label, the date and the link together with the claim. The opening summary paragraph and the conclusion carry no labels or links; they are navigation, not evidence, and every figure in them is repeated with its date and source in the numbered sections, so index the numbered sections and not the summary.

The labels mean the following. **[DURABLE]** marks a principle, definition or long-standing rule that has held for years and is unlikely to age quickly. **[FAST-MOVING, date]** marks a figure, version, deadline, survey result or legal status that will age, with the date of the source or of the fact. **[VENDOR]** marks a figure or recommendation from a party with a commercial interest in the conclusion (tool vendors, security firms, survey sponsors), including useful casework-based reports. **[PLATFORM CLAIM]** marks a platform's or tool maker's own statement about its own product or service, including AWS documentation of AWS services and providers' own incident reports. **[CONTESTED]** marks a point where sources disagree. **[INFERENCE]** marks a synthesis, checklist, threshold or convention written by the researchers that no single source states; adopt it as a default and tune it against your own data and your own counsel. **[GAP]** marks something the research did not verify or could not find, including points held only as the researchers' unverified background knowledge. **[HOUSE STYLE]** is reserved for Alex or Leila Hormozi's published frameworks, which the owner has chosen as the default style where they exist; the research notes for this department contain no such material, so the label does not appear in the body of this document.

For legal, tax and regulatory points, three qualifiers are written into the paragraph. "Checked on primary source" means the statute, regulation or regulator page was read during the research. "Secondary source only" means a law firm, news outlet or aggregator was read and the primary text was not. "Unverified background" means the point comes from the researchers' prior knowledge with a link to where it should be confirmed. Agents must not gate a live decision on an unverified legal point without confirmation from the Legal department or a named human.

Seven caveats apply to the whole document. First, legal and regulatory content is orientation as of 11 November 2026 and is not legal, tax or other professional advice. Second, every page was read through tools that return a model-written summary of the page and not its raw text, so figures are as those summaries reported them and legal wording must be re-read at the link before it is quoted or relied on. Third, the research ran out of search and fetch budget more than once, so coverage is uneven: the gaps listed at the end of each section and consolidated in section 20 are real holes. Fourth, a later gap-fill research pass corrected and superseded parts of the first pass; this document uses the corrected claim only. Fifth, the most concrete operational numbers (on-call limits, burn-rate thresholds, bake times) come from Google's SRE books and a 2020 Amazon article; they are kept because the principles are stable, but they describe hyperscalers and need scaling down. Sixth, survey figures from Grafana, the FinOps Foundation, CNCF, DORA, Verizon and Mandiant come from self-selected samples or the publisher's own casework and are indicative. Seventh, 2026 outage details come from a single status-page aggregator and were not read in the providers' own reports.
