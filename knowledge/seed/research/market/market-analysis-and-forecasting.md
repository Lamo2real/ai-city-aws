---
id: research.market.market-analysis-and-forecasting
department: research
domain: market
title: 'Research: Market analysis and forecasting'
summary: 'Market analysis and forecasting: start from the reference class. Market sizing; Industry structure: Porter''s five forces and their limits; External drivers and scenarios; Forecasting evidence and practice.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- decision-quality
- evidence
sources:
- https://online.hbs.edu/blog/post/market-sizing
- https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/vardefulladatamangder.5294.html
- https://www.isc.hbs.edu/strategy/business-strategy/Pages/the-five-forces.aspx
- https://hbr.org/2008/01/the-five-competitive-forces-that-shape-strategy
- https://www.gov.uk/government/publications/futures-toolkit-for-policy-makers-and-analysts
- https://www.gov.uk/government/publications/futures-toolkit-for-policy-makers-and-analysts/the-futures-toolkit-html
- https://goodjudgment.com/philip-tetlocks-10-commandments-of-superforecasting/
- https://aiimpacts.org/evidence-on-good-forecasting-practices-from-the-good-judgment-project/
- https://goodjudgment.com/about/the-science-of-superforecasting/
- https://www.pewresearch.org/short-reads/2016/09/08/understanding-the-margin-of-error-in-election-polls/
related:
- research.data-sources.public-data-sources
- research.analysis.analysis
- research.reporting.reporting
seed_version: 1
---

**When to use this:** For market sizing, industry structure, scenarios and forecasts: start from the reference class and state a probability.

**Source section:** 4. Market analysis and forecasting: start from the reference class

## 4. Market analysis and forecasting: start from the reference class

### 4.1 Market sizing

[GAP] [INFERENCE] TAM, SAM and SOM definitions are unsourced in this knowledge base; two attempts to open a source failed. The widely used definitions, given here as unverified background, are: TAM is total demand if every possible buyer bought; SAM is the part reachable with the current product, geography and channel; SOM is the share realistically winnable in the planning horizon given competition and capacity. Verify at https://online.hbs.edu/blog/post/market-sizing before quoting a definition externally.

[INFERENCE] Top-down sizing starts from a published market total and applies filters for geography, segment and product fit. Bottom-up sizing multiplies the number of target accounts by an adoption rate and an annual contract value; for SaaS, market value in SEK is roughly the sum over segments of companies in the segment, times seats or units per company, times price per seat per year. Unsourced common practice.

[INFERENCE] Compute both top-down and bottom-up estimates and reconcile them. A gap larger than roughly two to three times means an assumption is wrong and should be found before reporting; that threshold is the researchers' rule of thumb and not a standard. Report sizing as a range with the three most sensitive assumptions exposed, in line with the Aqua Book's assumptions log and sensitivity requirement.

[FAST-MOVING, 3 Feb 2025] For a Sweden-based SaaS company, the inputs for bottom-up sizing are free: organisation counts, SNI codes, legal form, active status and filed annual reports through the Bolagsverket and SCB high-value-dataset API ([Bolagsverket, Värdefulla datamängder](https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/vardefulladatamangder.5294.html)).

[GAP] Segmentation methods (firmographic, needs-based, jobs-to-be-done) and trend-analysis techniques were not researched. No source was sought on Swedish or Nordic SaaS market size or benchmarks.

### 4.2 Industry structure: Porter's five forces and their limits

[DURABLE] Use Porter's five forces to check industry structure: threat of new entrants, bargaining power of suppliers, bargaining power of buyers, threat of substitutes, and rivalry among existing competitors. The purpose is to explain how economic value is divided among industry actors and to assess industry attractiveness and how trends will change competition ([Harvard Business School, The Five Forces](https://www.isc.hbs.edu/strategy/business-strategy/Pages/the-five-forces.aspx)).

[DURABLE] Respect the limits Porter's own institute states: industry structure changes over time; structure is only one of two profitability drivers, the other being the firm's relative position; and the threat of entry depends on likely entrants' capabilities as well as on barriers ([HBS, The Five Forces](https://www.isc.hbs.edu/strategy/business-strategy/Pages/the-five-forces.aspx)).

[DURABLE] Avoid three errors Porter named in 2008: defining competition too narrowly as today's direct rivals; assuming a fast-growing industry is a profitable one; and treating government policy or complements as forces in themselves when they act through the five forces ([HBR, January 2008](https://hbr.org/2008/01/the-five-competitive-forces-that-shape-strategy)). The full article is paywalled and was only partly captured.

[INFERENCE] For SaaS, five forces is weak on network effects, platforms and complements, fast-moving market boundaries and ecosystem partners; use it as a structure check and not as a forecast. The SaaS application is the researchers' own, partly supported by Porter's caveats on change and complements.

### 4.3 External drivers and scenarios

[DURABLE] [FAST-MOVING, 29 Aug 2024] Use the UK Government Office for Science Futures Toolkit as the sourced method for driver mapping and scenarios. It was first published 8 July 2014, an updated edition (edition 2, 117 pages) was uploaded 11 July 2024, and the page was last updated 29 August 2024 ([GOV.UK Futures Toolkit](https://www.gov.uk/government/publications/futures-toolkit-for-policy-makers-and-analysts)).

[DURABLE] The Futures Toolkit groups twelve tools by question. For what is changing: Delphi, Seven Questions (structured stakeholder interviews), Horizon Scanning, Three Horizons and Driver Mapping. For what it means: SWOT, Scenarios, Visioning and Futures Wheels. For what to do: Policy Stress-testing, Roadmapping and Backcasting ([Futures Toolkit HTML](https://www.gov.uk/government/publications/futures-toolkit-for-policy-makers-and-analysts/the-futures-toolkit-html)).

[DURABLE] Map drivers with PESTLE headings and an importance-versus-certainty matrix. The toolkit's driver-mapping method is to brainstorm drivers under PESTLE headings (STEEP and STEEPV are named variants), write each as a short phrase with a direction of change, place each on the matrix and pick the three to five most important. Important and certain means act now; important and uncertain means research further or use for scenarios; unimportant and uncertain means track; unimportant and certain means park. The exercise takes about two hours ([Futures Toolkit HTML](https://www.gov.uk/government/publications/futures-toolkit-for-policy-makers-and-analysts/the-futures-toolkit-html)).

[DURABLE] Choose scenario axes from critical uncertainties. Start from at least 10 critical uncertainties, state each as a continuum between two opposite outcomes, cluster them into two independent groups (for example technological versus social), and take the two dominant ones as the axes of a two-by-two ([Futures Toolkit HTML](https://www.gov.uk/government/publications/futures-toolkit-for-policy-makers-and-analysts/the-futures-toolkit-html)).

[DURABLE] Build four scenarios from the two-by-two: build the axes, describe each world, name each scenario, discuss in plenary and write up. The toolkit specifies a workshop of at least 4 to 5 hours (6 hours if virtual), a minimum of 8 to 12 participants, and a horizon of at least five years and usually 10 to 20, and it states that scenarios are not plans or predictions ([Futures Toolkit HTML](https://www.gov.uk/government/publications/futures-toolkit-for-policy-makers-and-analysts/the-futures-toolkit-html)). The page also showed a conflicting 45 to 60 minute duration in a header, which the researchers could not resolve.

[DURABLE] Call the step of testing options against scenarios "policy stress-testing", which is the toolkit's term ([Futures Toolkit HTML](https://www.gov.uk/government/publications/futures-toolkit-for-policy-makers-and-analysts/the-futures-toolkit-html)). The steps for policy stress-testing and backcasting were in a part of the page that was not read.

[INFERENCE] For a SaaS company the toolkit's 10 to 20 year horizon is too long for product planning; a three to five year horizon with the same mechanics is a reasonable adaptation. Convert every PESTLE item into driver, mechanism, effect on demand or cost, evidence and confidence, because a list of headings is a prompt and not an analysis. Scenarios should not be given a single probability. These are the researchers' judgments.

### 4.4 Forecasting evidence and practice

[DURABLE] Follow Tetlock's ten points as published by Good Judgment: triage questions; break problems into parts and expose assumptions; use comparison classes by asking how often similar things happened in similar situations, even for events that seem unique; update as information arrives; weigh the strongest counter-case and pre-commit to what would change your mind; use numeric probabilities and practise fine distinctions; balance under- and over-confidence; run post-mortems on successes and failures; manage teams for constructive disagreement; and practise with clear feedback ([Good Judgment, 10 commandments](https://goodjudgment.com/philip-tetlocks-10-commandments-of-superforecasting/)).

[DURABLE] The evidence base is the Good Judgment Project, which won IARPA's 2011 to 2015 forecasting tournament of six teams, hundreds of geopolitical questions with horizons of months to a year, and thousands of volunteer forecasters. All figures in this sub-section come through one secondary review, published 7 February 2019 and modified 17 July 2020; Tetlock's and Mellers' primary papers were not opened ([AI Impacts](https://aiimpacts.org/evidence-on-good-forecasting-practices-from-the-good-judgment-project/)).

[DURABLE] Write the reference class first. In the Good Judgment Project, forecasts whose rationale was tagged as using comparison classes (the outside view) had an average Brier score of 0.17, against 0.26 for the next-best tag, where lower is better (review dated 2019 to 2020, [AI Impacts](https://aiimpacts.org/evidence-on-good-forecasting-practices-from-the-good-judgment-project/)). The review did not state which Brier scale was used.

[DURABLE] Aggregation and teams beat individuals. The Good Judgment Project beat the control group, a plain average of ordinary forecasts, by more than 60%, and beat a prediction market of intelligence analysts by about 25 to 30% (review dated 2019 to 2020, [AI Impacts](https://aiimpacts.org/evidence-on-good-forecasting-practices-from-the-good-judgment-project/)).

[DURABLE] Forecasting skill is persistent and trainable. Superforecasters were the top 2% of forecasters, about 70% kept that status the following year, and year-to-year performance correlated at 0.65; a one-hour training module improved accuracy for at least a year; and superforecasters' average gap between stated probability and observed frequency was 0.01 (review dated 2019 to 2020, [AI Impacts](https://aiimpacts.org/evidence-on-good-forecasting-practices-from-the-good-judgment-project/)).

[DURABLE] Correlates of accuracy in the Mellers et al. 2015 model (multiple correlation 0.64) were domain knowledge, intelligence, active open-mindedness, team membership, more deliberation time and more updates per question (review dated 2019 to 2020, [AI Impacts](https://aiimpacts.org/evidence-on-good-forecasting-practices-from-the-good-judgment-project/)). For agents the transferable levers are deliberation, team review and frequent updating.

[CONTESTED] The project's aggregation weighted better forecasters more heavily and then "extremized" the pooled forecast toward 0 or 1; the review calls the value of extremizing disputed and notes that aggregation helped ordinary forecasters most (review dated 2019 to 2020, [AI Impacts](https://aiimpacts.org/evidence-on-good-forecasting-practices-from-the-good-judgment-project/)). Do not extremize pooled agent forecasts by default.

[DURABLE] Keep forecast horizons short. Superforecasters looking 300 days out beat regular forecasters looking 100 days out, expert accuracy on geopolitics fell toward chance at five years, and forecasts are described as reasonable to about two years (review dated 2019 to 2020, [AI Impacts](https://aiimpacts.org/evidence-on-good-forecasting-practices-from-the-good-judgment-project/)). Beyond about two years, switch from point forecasts to scenarios.

[VENDOR] Good Judgment Inc., describing its own research, attributes superforecasters' accuracy gain over regular forecasters roughly half to noise reduction, a quarter to better information and a quarter to bias reduction, says teams outperform individuals and prediction markets, and states that "the best LLM lags Superforecasters by 19%" without defining the metric or giving a date ([Good Judgment, The science of superforecasting](https://goodjudgment.com/about/the-science-of-superforecasting/)). Treat this as vendor-reported.

[DURABLE] Do not read small movements as signal. Pew's 2016 explainer shows that a 3-point move in a lead between two polls carries a margin of about plus or minus 8 points, and that consistent movement across several independent readings is more informative than one pair ([Pew Research Center, 2016](https://www.pewresearch.org/short-reads/2016/09/08/understanding-the-margin-of-error-in-election-polls/)).

[INFERENCE] Brier score, standard definition from general knowledge and not from a fetched page: the mean of squared differences between forecast probability and outcome, with the outcome coded 1 or 0. In this single-outcome form it runs from 0 (perfect) to 1 and always answering 50% scores 0.25; Brier's original form, used in the Good Judgment Project papers, sums over both outcomes and runs 0 to 2, so 50% scores 0.5. State which form is used whenever a score is quoted.

[INFERENCE] Forecast hygiene for agents: state each forecast as a dated, resolvable question with a numeric probability; write the reference class and its base rate first, then the adjusted figure, and record both in the forecast log; score later. For market forecasts, look up the reference class (for example growth and survival of comparable Swedish SaaS firms from filed annual reports) before using the company's own plan.
