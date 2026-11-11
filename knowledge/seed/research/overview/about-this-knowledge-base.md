---
id: research.overview.about-this-knowledge-base
department: research
domain: overview
title: 'Research: About this knowledge base'
summary: 'The opening summary and the reading guide: the claim labels ([DURABLE], [FAST-MOVING], [VENDOR], [PLATFORM CLAIM], [CONTESTED], [INFERENCE], [GAP]), the legal verification qualifiers and seven caveats.'
type: glossary
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives: []
sources:
- https://arxiv.org/html/2605.06635
related:
- research.gaps.consolidated-gaps
- research.guardrails.agent-guardrails
seed_version: 1
---

**When to use this:** Before relying on any Research document: the overall position, what each claim label means, the legal verification qualifiers and the seven caveats that apply to everything.

**Source:** the title, opening summary and "How to read and split this document" of the Research department research.

# Research agents earn trust by verifying claims

As of November 2026 the foundational knowledge for an AI research department is that a working link is not verification, a signed-off question comes before any method, and lawful access comes before any collection. The strongest independent evidence on AI-assisted research shows that frontier models now return working links more than 94% of the time yet the cited page actually supports the attached claim only about 39 to 77% of the time, and that support falls as an agent run gets longer (May 2026, [arXiv 2605.06635](https://arxiv.org/html/2605.06635)); the department therefore needs claim-by-claim checking against the opened source, a liveness check, a separate verifier with fresh context, and a mandatory "not verified" list in every deliverable. The method layer is stable and well documented: scope with a written specification that the commissioner signs (UK Aqua Book, 2025 edition), check whether existing evidence already answers the question (AAPOR), read sources laterally and trace claims to their origin, start forecasts from a reference class, report likelihood on a published scale and confidence in a separate sentence, and give every analysis a sunset date. The fast-moving layer is sample integrity and law: industry estimates put fraud at 15 to 30% of market-research responses (NORC review, April 2026) while a vendor-funded preprint reports under 1% on vetted panels, so survey work needs layered, pre-specified and disclosed defences; EU and Swedish copyright law allows text and data mining only with lawful access and no rights reservation; the Advocate General's opinion of 3 November 2026 in CJEU case C-250/25 points toward liability for answers that recognisably reuse press wording; and EU data-protection bodies treat robots.txt, login walls and CAPTCHAs as objections that defeat a legitimate-interest basis for scraping. For a Sweden-based SaaS company the free official registers come first (Bolagsverket and SCB company data free since 3 February 2025, Vinnova project data under CC0, Eurostat reusable commercially with attribution), and three Swedish statutes set hard edges: the trade-secrets act makes obtaining a secret unlawfully a crime with up to two years' prison, the ethics-review act applies to companies and carries prison for intentional breach, and the data-protection act puts criminal-offence data largely out of reach for private actors. Much practice material could not be sourced because the researchers' fetch budgets ran out, including TAM/SAM/SOM definitions, conjoint and MaxDiff sample rules, battlecards, research-operations frameworks and provider data-retention terms; this document marks those holes instead of filling them from memory. The practical conclusion is that the manager agent's main job is delegation discipline and assurance, the workers' main job is reading what they cite, and anything involving a technical barrier, a named individual, a confidential-looking document, a competitor contact or external publication stops for a human.

## How to read and split this document

[DURABLE] This document is written to be cut into atomic knowledge-base entries for a vector index and a graph database. Every body paragraph is meant to stand alone: it opens with one or more labels, names its subject in full, and keeps each number next to its date and its source link. Section numbers group domains, and sub-headings name the single topic of the paragraphs beneath them. Tables carry a label and a source link in every row so that a row can be split out as its own entry. When splitting, keep the label, the date and the link together with the claim.

[DURABLE] The labels mean the following. **[DURABLE]** marks a principle, definition, formula, standard or long-standing legal rule that has held for years. **[FAST-MOVING, date]** marks a figure, platform rule, study result, API limit or legal status that will age, with the date of the source. **[VENDOR]** marks a figure or recommendation from a party with a commercial interest in the conclusion. **[PLATFORM CLAIM]** marks a platform's or tool maker's own statement about itself that nobody has independently verified. **[CONTESTED]** marks a point where sources disagree. **[INFERENCE]** marks a synthesis, rule of thumb or operating rule written by the researchers that no single fetched source states; adopt it as a default and tune it. **[GAP]** marks something the research did not verify or could not find. **[HOUSE STYLE]** is reserved for Alex or Leila Hormozi's published frameworks, which the owner has chosen as the default style where they exist; the research notes for this department contain no Hormozi material on research method, so no paragraph below carries that label, and that absence is itself recorded in the gaps section.

[DURABLE] Legal, tax and regulatory points carry one of three verification qualifiers. "Checked on primary source" means the statute, regulation, court press release or regulator page was read during the research; where the text was read on an unofficial mirror (lagen.nu, gdpr-info.eu) or through a summarising extraction tool, the paragraph says so. "Secondary source only" means a law-firm briefing, tracker, slide deck, trade press or encyclopaedia page was read and the primary text was not. "Unverified background" means the point was not opened at all and comes with a pointer to what should be checked. Agents must not gate a live decision on a secondary or unverified legal point without confirmation from Legal.

[DURABLE] Seven caveats apply to the whole document. First, all legal content is orientation as of 11 November 2026 and is not professional legal, tax or regulatory advice. Second, the research was done under tool budgets that ran out part-way through three separate passes, so many planned pages were never opened; these are listed as gaps and are not filled from memory. Third, pages were read through extraction tools that summarise, so wording here is paraphrase and several long pages (EUR-Lex, lagen.nu, the UK Futures Toolkit) were read only in part. Fourth, where the later gap-fill research corrected or superseded the earlier notes, only the corrected claim is given. Fifth, much AI-research evidence comes from preprints and vendor engineering posts, and the newest benchmark found dates from May 2026, so the model versions tested may already be superseded. Sixth, Nordic coverage outside Sweden is almost absent: the only non-Swedish Nordic item is one Danish court ruling reported by a secondary source. Seventh, thresholds labelled [INFERENCE] (sample cut-offs, review percentages, cadence, tiers) are the researchers' proposals and not published standards.
