---
id: finance.planning.budgeting-and-forecasting
department: finance
domain: planning
title: 'Finance: Planning, budgeting and forecasting'
summary: 'Planning, budgeting and forecasting: annual budget plus rolling forecast, AFP''s eight steps, forecasts versus targets, driver-based models, a working design for a small SaaS company, AI cost lines, macro inputs for 2027 and a KPI tree.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- planning
sources:
- https://www.financialprofessionals.org/training-resources/resources/articles/Details/8-steps-for-creating-a-rolling-forecast
- https://fpa-trends.com/article/best-practices-rolling-forecasts
- https://www.financialprofessionals.org/training-resources/resources/guides/fp-a-guides/Detail/rolling-forecast
- https://www.financialprofessionals.org/ideas-inspiration/topics/articles/Details/best-practices-in-driver-based-modeling
- https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf
- https://info.sapphireventures.com/2025-keybanc-capital-markets-sapphire-ventures-saas-survey
- https://www.iconiq.com/growth/insights/state-of-ai-2026
- https://www.saastr.com/the-builders-economy-10-metrics-from-iconiqs-newest-2026-state-of-ai-report
- https://www.regeringen.se/globalassets/regeringen/dokument/finansdepartementet/ppt-till-presstraffar/presentationsbilder-fran-presstraff-med-finansministern-den-27-oktober-2026.pdf
related:
- finance.metrics.saas-metrics-formulas-benchmarks
- finance.cash.cash-runway-treasury-currency
seed_version: 1
cross_refs:
  '13':
  - finance.metrics.saas-metrics-formulas-benchmarks
---

**When to use this:** When building a budget, rolling forecast, driver model, scenario, variance analysis, KPI tree or board pack.

**Source section:** 12. Planning, budgeting and forecasting

### Keep the annual budget and add a rolling forecast

**[DURABLE; practitioner opinion, 2018-2019]** Practitioner guidance says rolling forecasts supplement annual budgets and do not replace them: the budget still translates strategy into numbers and remains the performance yardstick ([AFP, Carl Seidman, 20 Sept 2019](https://www.financialprofessionals.org/training-resources/resources/articles/Details/8-steps-for-creating-a-rolling-forecast)). The horizon is four to six quarters (12 to 18 months), matched to the business cycle, with a re-forecast monthly or quarterly; one author found that adding new periods at quarter-end worked better than monthly because preparers resisted monthly extensions ([FP&A Trends, Elena Kiristova, 18 April 2018](https://fpa-trends.com/article/best-practices-rolling-forecasts)). These sources are practitioner opinion from 2015 to 2019 and give no adoption or accuracy statistics.

### AFP's eight steps for building a rolling forecast

**[DURABLE; practitioner opinion, 20 Sept 2019]** The eight steps are: define the purpose and users; set the horizon and period length, accepting that longer horizons give insight at the cost of accuracy and that there is no rule of thumb; set the level of detail by the cost of a wrong decision; choose accountable, unbiased contributors; identify the few value drivers instead of every ledger account; vet data sources; build scenarios and sensitivities; and track actuals against forecast, explaining what happened, why, and what to do ([AFP, Carl Seidman, 20 Sept 2019](https://www.financialprofessionals.org/training-resources/resources/articles/Details/8-steps-for-creating-a-rolling-forecast)). The fuller AFP guide sits behind a registration wall and was not read ([AFP guide page](https://www.financialprofessionals.org/training-resources/resources/guides/fp-a-guides/Detail/rolling-forecast)).

### Keep forecasts and targets separate

**[DURABLE; practitioner opinion, 18 April 2018]** Forecasts and targets should be independent, because merging them invites sandbagging. Capital and strategic projects are planned separately. Accuracy is reviewed through post-mortems aimed at learning and not blame. The completed rolling forecast is the baseline for scenario analysis. Spreadsheets are described as a personal productivity tool that weakens once versions, scenarios and variance analysis multiply ([FP&A Trends, Elena Kiristova, 18 April 2018](https://fpa-trends.com/article/best-practices-rolling-forecasts)).

### Driver-based modelling practices

**[DURABLE; practitioner opinion, 17 Dec 2015]** Practices drawn from AFP interviews: focus on line items that are significant, volatile and hard to forecast; keep models simple; agree drivers with operations and validate relationships across functions; back-test continuously; hold clean, defined data in one place; run the model as a closed loop inside the planning process and not as a side model; and do not simply trend history ([AFP, Nilly Essaides, 17 Dec 2015](https://www.financialprofessionals.org/ideas-inspiration/topics/articles/Details/best-practices-in-driver-based-modeling)).

### Working design for a small SaaS company

**[INFERENCE]** Combining the three practitioner sources gives a working design: an annual budget fixed as the yardstick; a driver-based rolling forecast of 12 to 18 months refreshed monthly, with a new quarter added each quarter-end; drivers limited to the handful that move ARR and cash (new ARR, churn, expansion, price, headcount, collections timing); a monthly actual-versus-forecast review with written causes and actions; and a logged accuracy record per driver.

### Plans run above trailing actuals, so keep a separate base case

**[VENDOR; FAST-MOVING, 2025]** In the Benchmarkit sample the median planned growth for 2025 was 35% against a 2024 actual median of 26% (planned N=71, actual N=149) ([Benchmarkit 2025 SaaS Performance Metrics Benchmarks, CY-2024 data (PDF)](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf)), and KeyBanc and Sapphire respondents projected ARR growth rising from 15% in 2024 to 20% in 2025 ([Sapphire Ventures, 2025 KeyBanc and Sapphire SaaS Survey page](https://info.sapphireventures.com/2025-keybanc-capital-markets-sapphire-ventures-saas-survey)). **[INFERENCE]** Company plans in these samples sit above trailing actuals, so a forecasting agent should treat management plans as optimistic by default and keep a separate base case anchored on trailing run-rate.

### AI cost lines are hard to forecast

**[VENDOR; FAST-MOVING, Q2 2026]** In ICONIQ's survey of roughly 300 executives building AI products, 92% said the true cost of internal AI is hard to predict, and token spend was the top source of budget overruns; one workflow budgeted at $0.10 per run exceeded $1.50 once agents retried ([ICONIQ, 2026 State of AI, July 2026](https://www.iconiq.com/growth/insights/state-of-ai-2026); [SaaStr summary of ICONIQ 2026](https://www.saastr.com/the-builders-economy-10-metrics-from-iconiqs-newest-2026-state-of-ai-report)). Forecast any AI or inference cost line from usage drivers with an explicit retry and failure assumption, and review it monthly.

### Macro inputs for 2027 planning

**[FAST-MOVING, 27 Oct 2026; checked on primary source]** The Finance Ministry's forecast of 27 October 2026 puts Swedish GDP growth at 3.0% in 2026 and 2.3% in 2027, with the output gap closing to 0.0 in 2027; named risks include Middle East conflict, international policy shifts, AI's economic effects, financial-market unrest and rising interest rates ([regeringen.se, Finance Minister's slides, 27 Oct 2026](https://www.regeringen.se/globalassets/regeringen/dokument/finansdepartementet/ppt-till-presstraffar/presentationsbilder-fran-presstraff-med-finansministern-den-27-oktober-2026.pdf)).

### KPI tree skeleton

**[INFERENCE]** A KPI tree can use the sourced formulas in section 13 as its leaf level: enterprise value drivers at the top; growth (new ARR, expansion ARR, churn, contraction) and efficiency (CAC ratio, payback, gross margin, opex ratios, burn multiple) in the middle; and operational drivers (leads, conversion, ACV, price, usage, support cost, inference cost per unit) at the bottom. Benchmarkit publishes a standard operating-metric set with formulas that fits the leaf level ([Benchmarkit 2025 SaaS Performance Metrics Benchmarks, CY-2024 data (PDF)](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf)).

### Budgeting methods, variance analysis, scenarios and board packs

**[GAP; unverified working knowledge]** No source was opened for the following, which is ordinary practice as the researchers recall it. Budgeting methods: annual budget, rolling forecast, zero-based budgeting applied to selected cost lines, and driver-based planning. Variance analysis: actual against budget, latest forecast and prior year; revenue variance split into volume, price and mix; a materiality threshold above which a written explanation and owner are required; forecast accuracy tracked with a consistent error measure and a bias measure. Scenario planning: base, downside and upside cases driven by a few explicit assumptions, each tied to a pre-agreed action trigger. Monthly pack: one-page summary, KPI dashboard, income statement, balance sheet and cash flow against budget and prior year, ARR bridge, cohort view, cash and runway with a 13-week forecast, pipeline, headcount, risks and decisions needed. No sourced data exists in the research on forecast-accuracy norms, rolling-forecast adoption, FP&A cycle times, board-pack templates or zero-based budgeting outcomes.
