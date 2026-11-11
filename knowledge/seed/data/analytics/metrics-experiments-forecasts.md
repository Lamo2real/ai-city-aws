---
id: data.analytics.metrics-experiments-forecasts
department: data
domain: analytics
title: 'Data and AI: Analytics and experimentation'
summary: 'Analytics and experimentation: one definition per metric in a semantic layer, experiment sample size, variance reduction, peeking and sequential testing, multiple testing, sample ratio mismatch (flag at p below 0.0005), the experiment checklist and small B2B samples, and forecasts that must beat a naive baseline.'
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- dbt
objectives:
- analytics
sources:
- https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026?version=2.0
- https://www.getcollate.io/blog/your-text-to-sql-problem-is-not-the-llm
- https://docs.getdbt.com/best-practices/how-we-structure/4-marts
- https://www.getdbt.com/blog/new-dbt-labs-report-finds-ai-driven-acceleration-is-outpacing-trust-and-governance
- https://arxiv.org/pdf/2212.11366.pdf
- https://engineering.atspotify.com/2023/03/choosing-sequential-testing-framework-comparisons-and-discussions
- https://www.microsoft.com/en-us/research/articles/diagnosing-sample-ratio-mismatch-in-a-b-testing/
- https://otexts.com/fpp3/accuracy.html
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before defining a metric, designing or reading out an A/B test, or building a forecast.

**Source section:** 7. Analytics and experimentation: one definition per metric, powered tests, honest forecasts

### Metrics are defined once, in a semantic layer

**[VENDOR] [FAST-MOVING, 7 April 2026]** Use a semantic layer for numbers where accuracy matters, such as board data, audits, OKRs, KPIs and weekly reports. In dbt Labs' own benchmark of 7 April 2026 the semantic layer returns an error when it cannot answer, whereas free text-to-SQL can return plausible wrong numbers ([dbt Developer Blog, 7 Apr 2026](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026?version=2.0)).

**[VENDOR] [FAST-MOVING, 30 April 2026]** Typical semantic failures in metric questions, per a metadata vendor's blog of 30 April 2026, are ambiguous business terms such as "active account" and hidden filters and time-window rules, for example a monthly cohort computed on elapsed days instead of calendar months ([Collate blog, 30 Apr 2026](https://www.getcollate.io/blog/your-text-to-sql-problem-is-not-the-llm)).

**[PLATFORM CLAIM] [DURABLE]** Do not encode time rollups as tables such as `orders_per_day`; define them as metrics on entity-named marts ([dbt docs, Marts](https://docs.getdbt.com/best-practices/how-we-structure/4-marts)).

**[VENDOR] [FAST-MOVING, 14 April 2026]** Speed and fear of wrong numbers are rising together: "shipping data products faster" rose from 50% to 71% as a priority while 71% fear incorrect outputs reaching stakeholders in dbt Labs' vendor survey (n=363, press release 14 April 2026) ([dbt Labs press release, 14 Apr 2026](https://www.getdbt.com/blog/new-dbt-labs-report-finds-ai-driven-acceleration-is-outpacing-trust-and-governance)).

**[INFERENCE]** A KPI definition template, written by the researchers with no fetched source: name, business question, formula, grain, filters, time basis and time zone, owner, source model, known caveats and target. A metric tree decomposes the north-star metric into input metrics whose product or sum reproduces it, each with an owner.

**[INFERENCE]** Dashboard defaults, written by the researchers with no fetched source: one audience and one decision per dashboard; headline KPIs compared with target and prior period; and every tile linked to its metric definition.

### Experiment sample size and why most ideas fail

**[DURABLE]** The rule of thumb for sample size at 5% significance and 80% power is n per variant = 16σ²/δ², where σ is the metric's standard deviation and δ the minimum detectable effect. The worked example in a peer-reviewed review is σ of $6 and δ of $0.0625, which needs about 147,456 users per arm; large user bases do not remove the need for power analysis ([Larsen et al., arXiv 2212.11366](https://arxiv.org/pdf/2212.11366.pdf)).

**[DURABLE]** Expect most tested ideas to fail: more than half of tested ideas fail to produce meaningful improvement, and failure rates can reach 90% or more in some domains, according to the same review ([Larsen et al., arXiv 2212.11366](https://arxiv.org/pdf/2212.11366.pdf)).

### Variance reduction before running longer

**[DURABLE]** CUPED adjusts an experiment metric with a pre-experiment covariate, with θ = Cov(Y,X)/Var(X), and cuts variance by a factor of (1 − ρ²); the same metric measured before the experiment is often the best covariate. Other variance-reduction options are capping or truncating skewed metrics, binarising, triggered analysis (then correcting for dilution) and stratification. If a test is underpowered, prefer these to simply running longer ([Larsen et al., arXiv 2212.11366](https://arxiv.org/pdf/2212.11366.pdf)).

### Peeking and sequential testing

**[DURABLE]** Repeatedly checking an experiment and stopping at first significance inflates false positives. The remedies are always-valid p-values from the mixture sequential probability ratio test (reject when the mixture likelihood ratio is at least 1/α) or group sequential designs (Pocock, O'Brien-Fleming, Lan-DeMets). Sequential methods cut average sample size but can leave segment analyses underpowered ([Larsen et al., arXiv 2212.11366](https://arxiv.org/pdf/2212.11366.pdf)).

**[FAST-MOVING, March 2023]** Spotify's 2023 simulations (effect of 0.2 standard deviations, 500 users per arm) found power with 14 analyses of 0.90 to 0.93 for group sequential tests, 0.72 for GAVI, 0.72 for mSPRT and 0.75 for Bonferroni; with 56 analyses Bonferroni falls to 0.62, and to 0.40 under streaming ([Spotify Engineering, 2023](https://engineering.atspotify.com/2023/03/choosing-sequential-testing-framework-comparisons-and-discussions)). The article predates 2024; the methodology is durable but platform specifics may have changed.

**[DURABLE]** Spotify's rule for choosing a sequential test: if the sample size can be estimated, use a group sequential test, for batch or streaming data; if it cannot, use always-valid inference when data streams, or Bonferroni with a pre-fixed number of looks for batch-only data. Group sequential tests are impractical beyond a few hundred analyses. Even with a sample size underestimated 50 times, GAVI kept power of about 0.57 to 0.63. Spotify's own platform uses group sequential tests ([Spotify Engineering, 2023](https://engineering.atspotify.com/2023/03/choosing-sequential-testing-framework-comparisons-and-discussions)).

### Multiple testing, novelty and interference

**[DURABLE]** Testing many segments or metrics inflates Type I error; Benjamini-Hochberg or knockoff false-discovery-rate control are options. Treatment effects vary over time through the novelty effect (an early lift fades) and the primacy effect (an early dip recovers) ([Larsen et al., arXiv 2212.11366](https://arxiv.org/pdf/2212.11366.pdf)).

**[DURABLE]** Interference between units breaks standard experiment estimates. Use cluster randomisation for networks, switchback designs with burn-in for marketplaces, and budget-split designs for auctions ([Larsen et al., arXiv 2212.11366](https://arxiv.org/pdf/2212.11366.pdf)).

### Sample ratio mismatch: flag at p below 0.0005

**[FAST-MOVING, February 2025]** A sample ratio mismatch (SRM) is a statistically significant difference between observed and configured user ratios across variants. Microsoft's Experimentation Platform detects it with a chi-squared test and flags it when p < 0.0005 (page modified February 2025, read by machine extraction) ([Microsoft ExP, SRM](https://www.microsoft.com/en-us/research/articles/diagnosing-sample-ratio-mismatch-in-a-b-testing/)). Use 0.0005 when citing Microsoft; a looser figure in an earlier draft was a guess and is withdrawn.

**[FAST-MOVING, February 2025]** Sample ratio mismatch is common: about 6% of A/B tests at Microsoft and about 10% of "zoomed-in" tests at LinkedIn show one, per Microsoft's page (modified February 2025) ([Microsoft ExP, SRM](https://www.microsoft.com/en-us/research/articles/diagnosing-sample-ratio-mismatch-in-a-b-testing/)).

**[DURABLE]** Causes of sample ratio mismatch by stage, per Microsoft: assignment (bad bucketing, faulty user IDs, carry-over effects); execution (redirects in one variant, or a variant that changes engagement and therefore logging); log processing (bad joins); analysis (biased segment conditions); and any stage (uneven ramp-up, self-assignment). The rule is not to trust the results of a test with an SRM until the root cause is found, and to diagnose by segment and by triggering condition to rule causes out ([Microsoft ExP, SRM](https://www.microsoft.com/en-us/research/articles/diagnosing-sample-ratio-mismatch-in-a-b-testing/)).

**[INFERENCE]** SRM check recipe for the experiment read-out template: run a chi-squared goodness-of-fit test on assigned-user counts against the configured split; if p < 0.0005, mark the experiment invalid, do not report metric movements, and open a diagnosis ticket that walks the five stages; run the same check per major segment (browser, platform, new versus returning), because Microsoft's method is to localise the cause by segment ([Microsoft ExP, SRM](https://www.microsoft.com/en-us/research/articles/diagnosing-sample-ratio-mismatch-in-a-b-testing/)).

### Experiment checklist and the B2B small-sample problem

**[INFERENCE]** Experiment checklist built by the researchers on the cited evidence: pre-register the hypothesis, primary metric, guardrail metrics, minimum detectable effect and sample size; randomise on a stable unit; run whole weeks to cover weekly seasonality; check SRM and A/A behaviour before reading results; apply CUPED; use a group sequential test with planned looks; correct for multiple metrics; and keep a long-term holdout for novelty ([Larsen et al., arXiv 2212.11366](https://arxiv.org/pdf/2212.11366.pdf)).

**[INFERENCE]** For B2B SaaS, account-level randomisation avoids within-account interference but sharply cuts sample size, and the 16σ²/δ² rule often shows that only large effects are detectable with few accounts. State this up front and prefer fewer, bolder tests or quasi-experimental methods over underpowered tests ([Larsen et al., arXiv 2212.11366](https://arxiv.org/pdf/2212.11366.pdf)).

### Forecasting: hold out data and beat the naive baseline

**[DURABLE]** For forecasts, hold out a test set of typically about 20% of the sample and at least as long as the longest forecast horizon needed, and judge accuracy on test data or time-series cross-validation, because residuals on training data are optimistic ([Hyndman and Athanasopoulos, FPP3, accuracy](https://otexts.com/fpp3/accuracy.html)).

**[DURABLE]** Scale-dependent forecast errors (MAE, RMSE) cannot compare series in different units; minimising MAE targets the median and minimising RMSE targets the mean. MAPE is undefined at zero, extreme near zero, needs a meaningful zero and penalises negative errors more than positive ones, and the textbook's authors recommend against sMAPE ([Hyndman and Athanasopoulos, FPP3, accuracy](https://otexts.com/fpp3/accuracy.html)).

**[DURABLE]** MASE divides forecast errors by the in-sample error of a naive or seasonal-naive forecast: below 1 beats naive and above 1 is worse, and it works across series of different scale ([Hyndman and Athanasopoulos, FPP3, accuracy](https://otexts.com/fpp3/accuracy.html)).

**[INFERENCE]** Forecast review rule, the researchers' application of the textbook and not a quoted rule: report every forecast against a seasonal-naive baseline using MASE; do not ship a model with MASE at or above 1; and do not use MAPE for SaaS series that contain zeros, such as new-product revenue or small-segment churn ([Hyndman and Athanasopoulos, FPP3, accuracy](https://otexts.com/fpp3/accuracy.html)).

### Gaps in the analytics evidence

**[GAP]** No source was read on dashboard design principles, self-service BI governance, metric trees and KPI definition, product-analytics tracking plans and event taxonomies, or general statistical pitfalls (Simpson's paradox, survivorship bias, regression to the mean). Kohavi, Deng and Vermeer's "A/B Testing Intuition Busters" (https://exp-platform.com/abtestingintuitionbusters/) was located but not read, so Twyman's law, false-positive risk, post-hoc power and the delta method for ratio metrics are unconfirmed. The FPP3 chapters on time-series cross-validation and simple benchmark methods were not read. No benchmark on BI adoption or self-service success was found.
