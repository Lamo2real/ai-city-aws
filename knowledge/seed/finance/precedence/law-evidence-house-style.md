---
id: finance.precedence.law-evidence-house-style
department: finance
domain: precedence
title: 'Finance: Precedence: law first, evidence second, house style third'
summary: 'The precedence rule (law first, evidence second, house style third) and every known collision: prepaid cash is not revenue, 30-day payback versus SaaS payback, LTV definitions, raising price, payment plans and consumer credit, guarantees and refunds, prepay discounts, distributions.'
type: principle
audience: both
confidence: contested
volatility: evergreen
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- compliance
sources:
- https://www.faronline.se/dokument/rattserien/redovisa-ratt/u/rr_uppdragmedettobestamtantalaktiviteter/
- https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/
- https://a16z.com/16-startup-metrics/
- https://rosetta.to/u/alexhormozi/the-mathematics-of-business-explained
- https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf
- https://info.sapphireventures.com/2025-keybanc-capital-markets-sapphire-ventures-saas-survey
- https://www.monterro.com/media/2finidot/monterro-nordic-software-benchmark-report-2026_web.pdf
- https://www.shortform.com/podcast/episode/the-game-w-alex-hormozi-2026-07-07-episode-summary-the-only-two-numbers-that-decide-if-your-business-survives-ep-985
- https://rosetta.to/u/alexhormozi/how-to-grow-your-business-so-fast-it-makes-your-accountant-nervous
- https://www.saas-capital.com/research/saas-retention-benchmarks-for-private-b2b-companies/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/aktiebolagslag-2005551_sfs-2005-551/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arsredovisningslag-19951554_sfs-1995-1554/
- https://www.peony.ink/blog/saas-valuation-multiples
related:
- finance.house-style.money-models-cash-flow-design
- finance.revenue-recognition.saas-and-capitalised-development
- finance.metrics.saas-metrics-formulas-benchmarks
seed_version: 1
cross_refs:
  '7':
  - finance.invoicing.invoicing-receivables-payment-providers
  '9':
  - finance.tax.corporate-owner-and-rd-tax
---

**When to use this:** Whenever law, evidence and the house style point different ways: the precedence rule and each known collision with its resolution.

**Source section:** 3. Precedence: law first, evidence second, house style third

### The precedence rule stated once

**[INFERENCE]** When sources of guidance conflict, the order is fixed. Law and accounting rules always override the house style and the benchmarks: statutes, K2 or K3, VAT, tax and payroll rules, consumer and credit law, and the auditor's reading of them. Independent evidence and SaaS benchmarks come second and override the house style where they show a house-style target does not fit the business model. The house style comes third and is the default wherever the first two layers are silent. An agent that cannot tell which layer a point belongs to treats it as layer one and escalates.

### Collision: prepaid cash is not revenue

**[DURABLE; secondary source only for K2 and K3, checked on primary source for IFRS 15]** His prepay and 30-day cash measures are cash measures. Under K3 point 23.26 and K2 point 6.11 a service contract covering an unspecified number of activities over an agreed period is recognised straight-line over that period ([FAR Online, Redovisa Rätt: uppdrag med ett obestämt antal aktiviteter](https://www.faronline.se/dokument/rattserien/redovisa-ratt/u/rr_uppdragmedettobestamtantalaktiviteter/)), and IFRS 15 recognises service revenue over time as the performance obligation is satisfied ([IFRS Foundation, IFRS 15](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/)). Cash collected up front on a subscription is therefore a liability released to revenue as service is delivered; on a 24-month deal one twenty-fourth moves from deferred revenue to revenue each month ([a16z, 16 Startup Metrics](https://a16z.com/16-startup-metrics/)). The accounting rule wins: a prepaid annual plan improves the cash view on day one and changes revenue by one-twelfth a month.

### Collision: 30-day payback versus SaaS payback benchmarks

**[CONTESTED] [HOUSE STYLE] [VENDOR; FAST-MOVING, 2025-2026]** His payback target is 30 days ([Rosetta transcript, "The Mathematics of Business, Explained", video dated 9 Jan 2026](https://rosetta.to/u/alexhormozi/the-mathematics-of-business-explained)). SaaS benchmark sources report $2.00 of sales and marketing per $1.00 of new-customer ARR at the median for calendar 2024 ([Benchmarkit 2025 SaaS Performance Metrics Benchmarks, CY-2024 data (PDF)](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf)), KeyBanc and Sapphire respondents expected account-executive payback to shorten to 18 months by 2026 ([Sapphire Ventures, 2025 KeyBanc and Sapphire SaaS Survey page](https://info.sapphireventures.com/2025-keybanc-capital-markets-sapphire-ventures-saas-survey)), and Monterro's Nordic sample averaged a CAC payback of 14.0 months in 2025 with the top quartile at about six months ([Monterro Nordic B2B Software Benchmark 2026, 19 April 2026 (PDF)](https://www.monterro.com/media/2finidot/monterro-nordic-software-benchmark-report-2026_web.pdf)). Evidence wins on the target: judge a sales-led SaaS motion against the peer payback range and use the 30-day rule to design billing terms and onboarding offers that pull cash forward.

### Collision: the 3:1 ratio agrees, the LTV definition is stricter

**[CONTESTED] [HOUSE STYLE]** His 3:1 LTGP:CAC floor for fully scalable businesses matches the conventional SaaS rule of thumb noted in the podcast summary ([Shortform summary of The Game Ep 985, 7 July 2026](https://www.shortform.com/podcast/episode/the-game-w-alex-hormozi-2026-07-07-episode-summary-the-only-two-numbers-that-decide-if-your-business-survives-ep-985)). The a16z definition of lifetime value is stricter: it uses contribution margin, warns that using revenue or gross margin in its place is a common error, and advises measuring realised 12-month and 24-month value when history is short instead of projecting a lifespan ([a16z, 16 Startup Metrics](https://a16z.com/16-startup-metrics/)). Evidence wins on the definition: compute the ratio on contribution or gross profit, on cohort data, with a capped lifetime.

### Collision: "raise price first" versus SaaS pricing evidence

**[CONTESTED] [HOUSE STYLE] [VENDOR; FAST-MOVING, April 2026]** He advises raising price before anything else and by 50 to 100% where supply is constrained ([Rosetta transcript, "How to Grow Your Business So FAST…", video dated 3 June 2025](https://rosetta.to/u/alexhormozi/how-to-grow-your-business-so-fast-it-makes-your-accountant-nervous)), and he himself excepts scalable software, where a lower price can increase growth ([Rosetta transcript, "The Mathematics of Business, Explained", video dated 9 Jan 2026](https://rosetta.to/u/alexhormozi/the-mathematics-of-business-explained)). Monterro's Nordic B2B software sample reports an average price increase of 5.9% in 2025 and 6.8% in 2024 ([Monterro Nordic B2B Software Benchmark 2026, 19 April 2026 (PDF)](https://www.monterro.com/media/2finidot/monterro-nordic-software-benchmark-report-2026_web.pdf)). SaaS Capital's definition counts price increases inside net revenue retention and excludes them from gross revenue retention ([SaaS Capital, retention benchmarks, 18 Sept 2025](https://www.saas-capital.com/research/saas-retention-benchmarks-for-private-b2b-companies/)). **[GAP]** The research found no sourced data on churn after price increases in B2B SaaS. The working rule is to test larger increases on new customers first, hold installed-base increases near the peer range unless a test supports more, and report NRR with and without the price effect.

### Collision: payment plans and consumer-credit rules

**[GAP; unverified, not researched]** The owner's brief names consumer-credit rules for payment plans as an example of law overriding house style. The finance research did not open any source on Swedish or EU consumer-credit law, so this document cannot state the rule, its thresholds or its current status. The operating rule is therefore a hard gate: no instalment plan, deferred payment, "pay later" option or financing offer is made to a consumer until Legal has confirmed in writing which credit, information and creditworthiness rules apply and how the offer must be worded. For business customers, the verified constraint is narrower and sits in Räntelagen (section 7).

### Collision: guarantees, "win your money back" and refunds

**[INFERENCE]** Prepaid, refundable or guarantee-backed offers create refund liabilities and variable consideration, so revenue and cash forecasts need an explicit refund assumption for each such offer. Under EU consumer rules the consumer versions may also carry withdrawal rights; the research did not verify those rules, so a legal check is required before launch. IFRS 15's model includes estimating variable consideration when setting the transaction price ([IFRS Foundation, IFRS 15](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/)).

### Collision: prepay discounts are financing with a price

**[INFERENCE] [HOUSE STYLE]** His guidance is at least 10% off for payment in full ([Rosetta transcript, "The Mathematics of Business, Explained", video dated 9 Jan 2026](https://rosetta.to/u/alexhormozi/the-mathematics-of-business-explained)). By the researchers' own calculation, comparing one upfront payment with twelve equal monthly payments in advance, a 10% discount costs about 2.0% a month (about 26% annualised), 15% about 3.1% a month (about 44%), and 20% about 4.3% a month (about 67%). The discount is expensive financing unless it also reduces churn, collection cost or failed-payment loss. **[GAP]** No sourced SaaS norm for annual-prepay discounts and no sourced annual-versus-monthly retention difference was found, so the comparison must use the company's own cohorts and cost of capital.

### Collision: distributions and reinvestment versus Swedish company law

**[INFERENCE; partly checked on primary source]** His reinvest-or-distribute reasoning is a business judgement. For a Swedish aktiebolag it sits beneath three legal constraints: the board's duty to assess the company's financial situation continuously and the capital-shortfall rules ([Aktiebolagslag (2005:551), riksdagen.se, consolidated through SFS 2026:783](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/aktiebolagslag-2005551_sfs-2005-551/)), the restricted development fund that reduces distributable equity when development costs are capitalised ([Årsredovisningslag (1995:1554), riksdagen.se, consolidated through SFS 2026:780](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arsredovisningslag-19951554_sfs-1995-1554/)), and the owner-level 3:12 rules for closely held companies (section 9). **[GAP]** Aktiebolagslagen chapters 17 and 18 on value transfers and the prudence rule for dividends were not read, so any dividend proposal goes to a human with the auditor or adviser.

### Collision table for quick reference

**[INFERENCE]** The table below restates the collisions so that each row can be stored as its own entry. The "what agents follow" column is the researchers' operating rule.

| House-style move | Overriding rule or evidence | Layer that wins | What agents follow | Source |
|---|---|---|---|---|
| Count prepaid cash toward the 30-day target | Straight-line recognition over the service period; prepaid cash is deferred revenue | Law and accounting | Show cash view and accrual view side by side; never book prepayment as revenue on receipt | [FAR Online, Redovisa Rätt: uppdrag med ett obestämt antal aktiviteter](https://www.faronline.se/dokument/rattserien/redovisa-ratt/u/rr_uppdragmedettobestamtantalaktiviteter/); [a16z, 16 Startup Metrics](https://a16z.com/16-startup-metrics/) |
| Recover CAC in 30 days | Median $2.00 S&M per $1.00 new ARR (CY-2024); Nordic average CAC payback 14.0 months (2025) | Evidence | Peer payback range is the target; 30 days is a design aspiration for self-serve and prepay motions | [Benchmarkit 2025 SaaS Performance Metrics Benchmarks, CY-2024 data (PDF)](https://www.hibob.com/wp-content/uploads/2025-SaaS-Performance-Metrics-Benchmarks.pdf); [Monterro Nordic B2B Software Benchmark 2026, 19 April 2026 (PDF)](https://www.monterro.com/media/2finidot/monterro-nordic-software-benchmark-report-2026_web.pdf) |
| LTGP by annual payment divided by churn | Contribution-margin LTV, realised cohort value when history is short | Evidence | Gross-profit or contribution basis, cohort data, capped lifetime | [a16z, 16 Startup Metrics](https://a16z.com/16-startup-metrics/) |
| Raise price 50 to 100% | His own software exception; Nordic average increase 5.9% in 2025 | Evidence | Test on new customers; report NRR with and without price effect | [Rosetta transcript, "The Mathematics of Business, Explained", video dated 9 Jan 2026](https://rosetta.to/u/alexhormozi/the-mathematics-of-business-explained); [Monterro Nordic B2B Software Benchmark 2026, 19 April 2026 (PDF)](https://www.monterro.com/media/2finidot/monterro-nordic-software-benchmark-report-2026_web.pdf) |
| At least 10% off for prepay | Implied financing cost about 26% annualised (researchers' calculation) | Evidence, by inference | Approve only when retention or collection gains justify the cost | [Rosetta transcript, "The Mathematics of Business, Explained", video dated 9 Jan 2026](https://rosetta.to/u/alexhormozi/the-mathematics-of-business-explained) |
| Payment-plan downsell to a consumer | Consumer-credit law, not verified in this research | Law | Blocked until Legal confirms the rules in writing | Unverified; no source fetched |
| Money-back or "win it back" guarantee | Variable consideration under IFRS 15; consumer withdrawal rights not verified | Law and accounting | Explicit refund assumption; legal check before launch | [IFRS Foundation, IFRS 15](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/) |
| Value the company on an EBITDA multiple | SaaS trades on revenue multiples: public median 3.2x EV/TTM revenue in Q2 2026 | Evidence | State lens, date and source of any multiple | [Peony, SaaS valuation multiples, Aug 2026](https://www.peony.ink/blog/saas-valuation-multiples) |
