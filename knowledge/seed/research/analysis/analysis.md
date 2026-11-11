---
id: research.analysis.analysis
department: research
domain: analysis
title: 'Research: Analysis'
summary: 'Analysis: effect sizes, honest causal claims and logged assumptions. Statistical inference; Qualitative analysis and mixed methods; Assumptions, sensitivity and model health.'
type: playbook
audience: both
confidence: established
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms: []
objectives:
- evidence
sources:
- https://www.amstat.org/asa/files/pdfs/p-valuestatement.pdf
- https://elifesciences.org/articles/48175
- https://www.pewresearch.org/short-reads/2016/09/08/understanding-the-margin-of-error-in-election-polls/
- https://aapor.org/standards-and-ethics/best-practices/
- https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3444174/
- https://www.thematicanalysis.net/doing-reflexive-ta/
- https://best-practice-and-impact.github.io/aqua_book_revision/delivery_and_communication.html
related:
- research.reporting.reporting
- research.market.market-analysis-and-forecasting
seed_version: 1
---

**When to use this:** When analysing data: effect sizes and statistical inference, honest causal claims, qualitative and mixed methods, logged assumptions and sensitivity.

**Source section:** 7. Analysis: effect sizes, honest causal claims and logged assumptions

## 7. Analysis: effect sizes, honest causal claims and logged assumptions

### 7.1 Statistical inference

[DURABLE] Follow the American Statistical Association's 2016 statement on p-values: a p-value indicates how incompatible the data are with a specified model; it does not measure the probability that the hypothesis is true or that the data arose by chance alone; conclusions and business or policy decisions should not rest only on whether p crosses a threshold; proper inference needs full reporting and transparency; a p-value does not measure effect size or importance; and by itself it is not a good measure of evidence ([ASA, 7 March 2016](https://www.amstat.org/asa/files/pdfs/p-valuestatement.pdf)).

[DURABLE] Screen every analysis, the department's own and those in papers it reads, against the ten common statistical mistakes in eLife (9 October 2019): no adequate control group; claiming two effects differ without comparing them directly; inflated units of analysis; spurious correlations; underpowered groups; circular analysis; analytic flexibility or p-hacking; uncorrected multiple comparisons; over-reading non-significant results; and correlation read as causation ([eLife, Makin and Orban de Xivry, 2019](https://elifesciences.org/articles/48175)).

[DURABLE] The table lists the ten common statistical mistakes with the remedy the eLife authors give for each.

| Label | Mistake | Remedy | Date | Link |
|---|---|---|---|---|
| [DURABLE] | No adequate control group | Treat conclusions as tentative | 9 Oct 2019 | [eLife](https://elifesciences.org/articles/48175) |
| [DURABLE] | Claiming two effects differ without comparing them | Test the difference directly | 9 Oct 2019 | [eLife](https://elifesciences.org/articles/48175) |
| [DURABLE] | Inflated units of analysis | Mixed-effects models | 9 Oct 2019 | [eLife](https://elifesciences.org/articles/48175) |
| [DURABLE] | Spurious correlations | Robust correlation methods; check outliers | 9 Oct 2019 | [eLife](https://elifesciences.org/articles/48175) |
| [DURABLE] | Underpowered groups | A priori power analysis or replication | 9 Oct 2019 | [eLife](https://elifesciences.org/articles/48175) |
| [DURABLE] | Circular analysis | Define criteria in advance, independent of the data | 9 Oct 2019 | [eLife](https://elifesciences.org/articles/48175) |
| [DURABLE] | Analytic flexibility (p-hacking) | Standardised or pre-registered analysis | 9 Oct 2019 | [eLife](https://elifesciences.org/articles/48175) |
| [DURABLE] | Uncorrected multiple comparisons | Disclose all measures and correct | 9 Oct 2019 | [eLife](https://elifesciences.org/articles/48175) |
| [DURABLE] | Over-reading non-significant results | Equivalence tests or Bayesian approaches | 9 Oct 2019 | [eLife](https://elifesciences.org/articles/48175) |
| [DURABLE] | Correlation read as causation | Test third variables and competing models, or randomise | 9 Oct 2019 | [eLife](https://elifesciences.org/articles/48175) |

[DURABLE] Give differences their own error margin and expect chance outliers. The margin on a difference between two shares is about double that of each share, subgroup margins are far wider (about plus or minus 8 at n near 160), and with 95% intervals about 1 in 20 estimates miss by more than the margin through sampling alone; Pew's example is roughly 30 of 590 polls ([Pew, 2016](https://www.pewresearch.org/short-reads/2016/09/08/understanding-the-margin-of-error-in-election-polls/)).

[DURABLE] Follow AAPOR's coding and tabulation hygiene: record partial responses, separate unanswered items from substantive "none" or "don't know" answers, and show counts or percentages in cross-tabs with columns totalling 100% ([AAPOR Best Practices](https://aapor.org/standards-and-ethics/best-practices/)).

[INFERENCE] Descriptive and inferential minimum, textbook practice not sourced in the research: report n, centre (mean, plus median when skewed), spread and distribution shape; for B2B revenue-type data use medians and show top-customer concentration; and always give an interval estimate and an effect size alongside any p-value, which is the practical consequence of ASA principles 3, 5 and 6.

[GAP] [INFERENCE] Effect-size conventions commonly attributed to Cohen (d of about 0.2 small, 0.5 medium, 0.8 large; r of about 0.1, 0.3, 0.5) were not verified; the intended source is https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3444174/. They are context-free rules of thumb; in business, translate an effect into money or customers. Simpson's paradox, base-rate neglect, survivorship bias and regression to the mean were not sourced either.

[INFERENCE] Causal-claim ladder for agents: rung one, an association is observed; rung two, it survives controls for obvious confounders and is temporally ordered; rung three, a natural experiment or quasi-experimental design; rung four, a randomised experiment. State which rung the evidence reaches and never write "drives", "causes" or "leads to" below rung three without a hedge. Consistent with the eLife list's tenth mistake.

### 7.2 Qualitative analysis and mixed methods

[DURABLE] Use Braun and Clarke's reflexive thematic analysis as the reference process for qualitative data: familiarise with the dataset; code; generate initial themes; develop and review themes; refine, define and name themes; write up. The phases are guidance and not rigid steps, the process is recursive, a theme is a pattern of shared meaning organised around a central concept, and the authors describe analysis as skilled, situated and subjective ([Braun and Clarke, Doing reflexive TA](https://www.thematicanalysis.net/doing-reflexive-ta/)).

[INFERENCE] Qualitative coding workflow for agent teams: two workers code a shared subset independently, reconcile a codebook and then code the rest; keep verbatim quotes linked to participant IDs; count how many participants, not mentions, support each theme; and report disconfirming cases. This codebook-and-agreement style differs from Braun and Clarke's reflexive approach, which treats researcher subjectivity as a resource; that contrast comes from the researchers' background knowledge and not from the fetched page.

[GAP] No source was retrieved on the reliability of AI-assisted qualitative coding as of 2026, which is a real hole for an AI research department. Until it is filled, LLM-coded themes need human spot-checks against the transcripts and a note in the methods section.

[INFERENCE] [GAP] Mixed-methods designs, unsourced: exploratory sequential (interviews, then a survey to size themes), explanatory sequential (survey, then interviews to explain a number) and convergent (both in parallel, then compared). Integrate at the conclusion level by saying where qualitative and quantitative evidence agree, where they diverge and what explains the divergence.

### 7.3 Assumptions, sensitivity and model health

[DURABLE] Keep an assumptions log with source, owner and reliability for every analysis, together with any sensitivity analysis; document what the analysis can and cannot be used for; explain the effect of uncertainty on outputs; and set a review schedule or a sunset date after which the analysis should not be used ([Aqua Book revision, Delivery, communication and sign-off](https://best-practice-and-impact.github.io/aqua_book_revision/delivery_and_communication.html)).

[DURABLE] For black-box and AI models used in analysis, monitor for data drift and report model health, and have the approver confirm that risks and ethics were addressed ([Aqua Book revision, Delivery, communication and sign-off](https://best-practice-and-impact.github.io/aqua_book_revision/delivery_and_communication.html)).

[INFERENCE] Sensitivity-analysis minimum: vary each key assumption one at a time across its plausible range and show which ones flip the recommendation; add best, base and worst cases for correlated assumptions; and report the break-even value of the decisive variable. Only the requirement that sensitivity analysis accompany the assumptions log is sourced, to the Aqua Book; the specifics are common practice.
