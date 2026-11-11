---
id: finance.cash.cash-runway-treasury-currency
department: finance
domain: cash
title: 'Finance: Cash, working capital, runway, treasury and currency'
summary: 'Cash, working capital, runway, treasury and currency: cash versus revenue, annual prepayment as a working-capital lever with its cost, bridging grants, the 13-week cash forecast, runway and default alive, collections, treasury policy and EUR and USD exposure.'
type: playbook
audience: both
confidence: established
volatility: evergreen
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- cash
- planning
sources:
- https://a16z.com/16-startup-metrics/
- https://rosetta.to/u/alexhormozi/the-mathematics-of-business-explained
- https://www.vinnova.se/en/apply-for-funding/
- https://www.skatteverket.se/foretag/arbetsgivare/arbetsgivaravgifterochskatteavdrag/vaxastod.4.361dc8c15312eff6fd37447.html
- https://www.skatteverket.se/foretagochorganisationer/inkomstdeklaration/juridiskapersoner.4.46ae6b26141980f1e2d1261.html
related:
- finance.planning.budgeting-and-forecasting
- finance.metrics.saas-metrics-formulas-benchmarks
- finance.house-style.money-models-cash-flow-design
seed_version: 1
cross_refs:
  '7':
  - finance.invoicing.invoicing-receivables-payment-providers
  '11':
  - finance.calendar.recurring-dates
---

**When to use this:** For cash, runway, the 13-week cash forecast, working capital, prepayment as financing, grants, treasury policy and currency exposure.

**Source section:** 14. Cash, working capital, runway, treasury and currency

### Cash and revenue are tracked as separate truths

**[DURABLE]** Cash collected up front on a subscription is a liability released to revenue as service is delivered ([a16z, 16 Startup Metrics](https://a16z.com/16-startup-metrics/)), and runway is judged on net burn, which is gross burn less cash received ([a16z, 16 Startup Metrics](https://a16z.com/16-startup-metrics/)). A finance department therefore keeps two ledgers of truth in every report: what was earned and what was collected.

### Annual prepayment as a working-capital lever, with its financing cost

**[INFERENCE] [HOUSE STYLE]** Annual-upfront billing is the main working-capital lever in SaaS and the direct equivalent of Hormozi's prepay offer, for which he suggests at least 10% off ([Rosetta transcript, "The Mathematics of Business, Explained", video dated 9 Jan 2026](https://rosetta.to/u/alexhormozi/the-mathematics-of-business-explained)). By the researchers' own calculation, comparing one upfront payment with twelve equal monthly payments in advance, a 10% discount costs about 2.0% a month (about 26% annualised), 15% about 3.1% a month (about 44%) and 20% about 4.3% a month (about 67%). Approve a prepay discount when the annual cohort's better retention, lower collection cost or fewer failed payments justify that cost against the company's actual cost of capital. **[GAP]** No sourced SaaS norm for annual-prepay discounts and no sourced annual-versus-monthly retention data was found.

### Grants need bridging cash

**[DURABLE; PLATFORM CLAIM]** Vinnova states that funded costs must appear in the organisation's accounts during the project period and that it normally does not fund all costs ([Vinnova, Apply for funding](https://www.vinnova.se/en/apply-for-funding/)). Grant projects therefore need bridging cash, and a grant never enters the base-case cash forecast until it is awarded.

### Växa-stöd, extra tax payments and VAT as cash-timing items

**[INFERENCE]** Three Swedish items belong in every cash forecast: the växa-stöd refund, which arrives after full contributions have been paid ([Skatteverket, regler för växa-stöd](https://www.skatteverket.se/foretag/arbetsgivare/arbetsgivaravgifterochskatteavdrag/vaxastod.4.361dc8c15312eff6fd37447.html)); the extra tax payment dates of 12 February and 3 May 2027 for December 2026 year-ends ([Skatteverket, deklarera åt ett aktiebolag](https://www.skatteverket.se/foretagochorganisationer/inkomstdeklaration/juridiskapersoner.4.46ae6b26141980f1e2d1261.html)); and the VAT and employer-return payment dates in section 11.

### The 13-week cash forecast

**[GAP; unverified working knowledge]** No sourced template or method for the 13-week cash-flow forecast was obtained. Ordinary practice as the researchers recall it is a direct-method forecast with weekly columns: opening bank balance; receipts by source (subscription collections by ageing bucket, card and processor settlements, grants, VAT refunds); disbursements (payroll with Swedish employer contributions and preliminary tax, VAT, suppliers, cloud and inference, rent, debt service); and a closing balance against a minimum-cash threshold, rolled forward every week with a forecast-versus-actual line and a reconciliation to bank.

### Runway and the "default alive" view

**[GAP; unverified working knowledge]** Runway in months is commonly computed as cash divided by average net burn, shown on trailing three-month burn and on the forecast, alongside a view of whether forecast revenue growth reaches breakeven before cash runs out. The burn definitions are sourced ([a16z, 16 Startup Metrics](https://a16z.com/16-startup-metrics/)); the presentation convention is not.

### Working-capital levers and collections

**[GAP; unverified working knowledge]** Unsourced ordinary practice lists the SaaS working-capital levers as annual upfront billing, shorter payment terms, automated dunning for card failures, invoice accuracy, tracking of days sales outstanding by segment, and supplier terms. No sourced norms for days sales outstanding or dunning recovery were found; the verified Swedish late-payment rules are in section 7.

### Treasury policy for a small company

**[GAP; unverified working knowledge]** No treasury-policy source was opened. The unsourced outline is: objectives ranked safety, liquidity, then yield; permitted instruments and maximum tenor; counterparty limits and bank diversification; minimum operating cash; dual approval for transfers; and no speculative positions. The Swedish deposit-guarantee amount and whether it protects a company's balance were not verified and must be checked at Riksgälden.

### Currency exposure for a Swedish company billing in EUR, USD and SEK

**[GAP; unverified working knowledge]** No currency-hedging guidance or 2026 SEK volatility data was sourced. The unsourced outline is: map exposure by currency across revenue, costs, cash and receivables; use natural hedging first by paying same-currency costs from same-currency receipts and holding currency accounts; consider forwards only for committed, material exposures under a written policy; and report ARR at constant currency alongside reported currency so that currency moves are not mistaken for growth or churn. The one verified currency rule is the SEK VAT amount on foreign-currency invoices in section 7.
