---
id: shared.overview.about-this-knowledge-base
department: shared
domain: overview
title: 'Shared: About this knowledge base'
summary: 'The opening summary and the reading guide: the claim labels ([DURABLE], [FAST-MOVING], [VENDOR], [PLATFORM CLAIM], [CONTESTED], [INFERENCE], [GAP]), the Sourced / Partly sourced / H markers, the legal-source statuses and the caveats.'
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
- shared.gaps.consolidated-gaps
- shared.responsibilities.responsibility-map
- shared.routing.routing-rule-and-message-template
cross_refs:
  '8':
  - shared.guardrails.company-wide-guardrails
seed_version: 1
---

**When to use this:** Before relying on any shared document: the overall position, what each label and marker means, the legal-source statuses and the caveats that apply to everything.

**Source:** the title, opening summary and "How to read and split this document" of the cross-department handoffs research.

# Twelve agent departments run on explicit handoffs

As of 11 November 2026 the research supports one design for a Sweden-based SaaS company whose twelve departments are each run by a manager AI agent directing worker agents: give every responsibility and every grey zone exactly one accountable owner, make every cross-department handoff a named artefact that the receiving department explicitly accepts or rejects with a reason code, route new cross-department work through the manager agents, and attach human approval to a short list of tools (pay, sign, publish, deploy high-risk changes, grant access) instead of to every output. No published source lays out a twelve-department split, a canonical owner for pricing, onboarding or AI governance, or a definitive list of actions that always need a human; the responsibility map, handoff catalogue, message template and approval list in this document are therefore a proposal for the owner to edit, labelled [INFERENCE] wherever the notes do not source them. What is sourced is the pattern underneath: GitLab's lead statuses and deal-desk service levels, Google's production readiness review and incident roles, Bain's RAPID and Atlassian's DACI with one decider each, Amazon's weekly business review with one owner per metric, and the GDPR one-month clock for data-subject requests. The agent-coordination evidence points the same way: Google Research measured error amplification of 17.2x for independent agents against 4.4x under centralised coordination, the Berkeley MAST study attributes most multi-agent failures to system design, misalignment and weak verification, and Anthropic, OpenAI, Microsoft and Google Cloud all advise the simplest workable design with explicit briefs, artefact references and iteration caps. Two cautions matter for this company in particular: a twelve-department structure is itself a role-based split, which Anthropic's January 2026 guidance warns loses context at each handoff, and DORA's evidence says blanket approval boards slow delivery without lowering failure rates, so gates must be risk-tiered. Nearly everything specific to Sweden (IMY guidance, bookkeeping and VAT rules, employment law, who may sign for the company) was not researched and is listed as a gap, not filled from memory.

## How to read and split this document

This document is written to be cut into atomic knowledge-base entries. Every body paragraph is meant to stand alone: it opens with one or more labels, names its subject in full, and keeps each number next to its date and source link. Section numbers group domains; sub-headings name the single topic of the paragraphs beneath them. Tables carry a basis or source cell in every row so that a row can be split out as its own entry. When splitting, keep the label, the date and the link with the claim.

The labels mean the following. **[DURABLE]** marks a principle, definition or long-standing rule that has held for years. **[FAST-MOVING, date]** marks a figure, service level, specification status or handbook detail that will age, with the date of the source or the date it was read. **[VENDOR]** marks a figure or recommendation from a party with a commercial interest in the conclusion; in this document that includes the AI model and cloud vendors (Anthropic, OpenAI, Microsoft, Google Cloud, AWS, LangChain, Cognition) and the tool and training vendors (Atlassian, HubSpot, Pragmatic Institute, Giskard). **[PLATFORM CLAIM]** marks a company's or project's own statement about itself that nobody independently verified, such as GitLab's handbook describing GitLab's practice or a standards body describing its own adoption. **[CONTESTED]** marks a point where sources disagree. **[INFERENCE]** marks synthesis by the researchers that no single fetched source states; adopt it as an editable default. **[GAP]** marks something the research did not verify or could not find. The [HOUSE STYLE] label is not used in this document.

Three markers are used inside the proposal tables. "Sourced" means the row rests on a cited page that the researchers read. "Partly sourced" means the trigger or one element is cited and the rest is the researchers' template. "[INFERENCE]" means no primary source was retrieved for the row. The letter **H** in a process table marks a step where the proposal places a human approval gate; every H is the researchers' inference, justified in section 8.

For legal, tax and regulatory points the document states one of three statuses. "Article text read" means the article was read during the research on gdpr-info.eu, an unofficial reproduction of the GDPR, and was not checked against EUR-Lex. "Secondary source only" means a third-party explainer or press report was read and the official text was not. "Unverified, not researched" means the notes contain no source at all and the point is named only so that someone checks it. Agents must not gate a live decision on a secondary or unverified legal point without confirmation.

Six caveats apply to the whole document. First, legal and regulatory content is orientation as of 11 November 2026 and not professional legal, tax or employment advice. Second, several pages were read through a summarising fetch tool, so all wording is paraphrase and figures are as that tool returned them. Third, the worked examples of human practice come overwhelmingly from a handful of large US technology companies (GitLab, Google, Amazon, Atlassian); none is a twelve-department SaaS company and none is run by AI agents. Fourth, no empirical study was found of AI-agent "companies" with departmental structure running a real business; the multi-agent evidence comes from benchmark tasks and vendor engineering reports. Fifth, GitLab handbook pages are living documents read in November 2026 and their numbers will change. Sixth, the research found no gap-fill or correction notes for this topic and no earlier research to build on, so this document rests on a single set of notes.
