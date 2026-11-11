---
id: sales.pipeline.design-and-stage-criteria
department: sales
domain: pipeline
title: 'Sales: Pipeline design and stage criteria'
summary: Pipeline design and the exit criteria for each stage from lead to closed, so deals move on evidence.
type: playbook
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- qualification
- closing
sources:
- https://winningbydesign.com/wp-content/uploads/2026/01/The-Bowtie-Standard.pdf
- https://benchmarks.ebsta.com/hubfs/V3%202025%20Benchmark%20Report/gtm_benchmarks_digital_report.pdf?hsLang=en
related:
- sales.qualification.frameworks
- sales.metrics.formulas-and-benchmarks
- sales.management.forecasting-and-crm
seed_version: 1
cross_refs:
  '6':
  - sales.house-style.scripts-team-and-stage-metrics
  '25':
  - sales.inbound.lead-handling
---

**When to use this:** When defining pipeline stages, what must be true before a deal moves to the next stage, or proposal entry.

**Source section:** 17. Pipeline design and stage criteria

### Use the Bowtie Standard as the neutral stage model

**[FAST-MOVING, Jan 2026]** The most current vendor-neutral stage framework read in primary form is Winning by Design's Bowtie Standard. Its stages in order are: Awareness (lead generation); Education (lead development, often demo or discovery); Prioritization (buyer and seller agree the impact to achieve, producing a qualified opportunity); Selection (stakeholder education, proof of concept, return-on-investment proposal); Mutual Commit (the close and the start of a multi-year relationship); Onboarding, called Activation in product-led motions (reaching first measurable impact); Retention and Adoption; and Expansion ([Winning by Design, The Bowtie Standard, Jan 2026](https://winningbydesign.com/wp-content/uploads/2026/01/The-Bowtie-Standard.pdf)). The paper gives no benchmark values and points to a public benchmark of more than 600 companies.

### Lead-status equivalents across product-led, AI-led and human-led motions

**[FAST-MOVING, Jan 2026]** The Bowtie Standard defines volume metrics that line up three motions on one model. A prospect matches situation, pain and impact potential in all three. Expressed interest with shared contact details is a handraise (product-led), a marketing-qualified lead (AI-led) or a lead (human-led). Considering action is a product-qualified lead, a sales-qualified lead or an opportunity. Verified as a priority is a product-qualified account, a sales-accepted lead or a qualified opportunity. Mutual commitment is a sign-up or a win. The later metrics are revenue: committed revenue (wins multiplied by annual contract value), starting recurring revenue (committed revenue minus onboarding churn), recurring revenue and lifetime value ([Winning by Design, The Bowtie Standard, Jan 2026](https://winningbydesign.com/wp-content/uploads/2026/01/The-Bowtie-Standard.pdf)).

### Pick one ordering for SQL and SAL and write it down

**[CONTESTED]** In the Bowtie Standard a sales-qualified lead (considering action) comes before a sales-accepted lead (verified as a priority) ([Winning by Design, The Bowtie Standard, Jan 2026](https://winningbydesign.com/wp-content/uploads/2026/01/The-Bowtie-Standard.pdf)). Many CRMs use the older order of marketing-qualified, then sales-accepted, then sales-qualified. The two conventions conflict, so the knowledge base must pick one and define each status with its entry test. **[GAP]** The original demand-waterfall definitions and CRM vendors' lead-status definitions were not fetched.

### Conversion and time metrics per stage

**[FAST-MOVING, Jan 2026]** The Bowtie conversion metrics are: awareness conversion (for example sign-ups over visitors); education conversion (the share of leads who enter a sales process); prioritization conversion (the share qualified on impact priority); win rate (commitments over qualified opportunities); revenue committed (list price minus discounts); onboarding conversion (one minus onboarding churn); gross revenue retention; and expansion (new recurring revenue from upsell as a share of post-churn cohort revenue). The time metrics measure waiting between actions: time to start a conversation; time until the buyer is ready to buy; time to qualify; sales cycle; time to set the customer up internally; time from purchase to first impact; contract length; and customer lifetime ([Winning by Design, The Bowtie Standard, Jan 2026](https://winningbydesign.com/wp-content/uploads/2026/01/The-Bowtie-Standard.pdf)).

### Default B2B opportunity stages with exit criteria

**[INFERENCE]** A default seller-side stage set, written from practitioner convention and not fetched from a source: stage 0, meeting booked or held, exits when a meeting is held with a contact who fits the ideal customer profile; stage 1, discovery or qualified, exits when pain, impact and a named champion are confirmed and the next meeting is dated; stage 2, solution or demo, exits when a decision-maker is engaged and decision criteria and process are known; stage 3, evaluation or proof (trial, proof of concept, security review), exits when success criteria are met and a mutual action plan is agreed; stage 4, proposal or negotiation, exits when commercial terms are agreed and the paper process and signer are known; stage 5 is closed won or closed lost, always with a reason code. Every exit criterion is a verifiable buyer action, never a seller activity.

### Default high-velocity pipeline for small deals and consumers

**[INFERENCE]** For high-velocity, small-business or consumer sales, the conventional pipeline is new lead, contact attempted, connected, qualified (need plus ability to buy), offer or quote sent or trial started, then won or lost: three to five stages, a cycle measured in days, and automated nurture for "not now". This is convention; no source was read for B2C or high-velocity stage designs. It lines up with the house-style funnel of leads, contacted, booked, showed, offered, closed and cash collected (section 6).

### Lead statuses, scoring and routing defaults

**[INFERENCE]** Conventional defaults, not fetched: statuses run lead or inquiry, marketing-qualified (fit plus engagement threshold), sales-accepted (accepted within the service level), sales-qualified (need confirmed after contact), then opportunity (with amount and close date), with reject and recycle statuses carrying reasons so that marketing gets feedback. Lead score is a fit score (industry, size, role, technology) plus an intent or behaviour score (pricing-page views, demo request, product usage, third-party intent) that decays over time; hand-raisers bypass scoring and route immediately. Routing options are round-robin, territory or segment, named-account owner match and capacity or performance weighting; match a lead to an existing account owner before any round-robin. **[GAP]** No evidence on routing models was retrieved.

### Marketing-to-sales service-level template

**[INFERENCE]** A conventional agreement, not fetched: marketing commits a volume and quality of qualified leads; sales commits a first-touch time, a minimum number of attempts (for example six to eight touches over about two weeks across channels) and a disposition on every lead within a fixed window; both sides review rejected leads weekly. Response-time targets are in section 25.

### Evidence for the qualification gates

**[VENDOR; FAST-MOVING, 2024 data]** Ebsta and Pavilion's 2025 report (655,000 opportunities, $48 billion, 387 companies) supports gating early stages on three fields: a decision-maker involved in the first two stages is associated with a 50 to 55% higher win rate; top performers are 24% more likely to disqualify non-fit deals early; and 76% of average-performer deals lack a critical event. Eight stakeholders are engaged per new-business opportunity against five per expansion ([Ebsta/Pavilion 2025 GTM Benchmarks](https://benchmarks.ebsta.com/hubfs/V3%202025%20Benchmark%20Report/gtm_benchmarks_digital_report.pdf?hsLang=en)).

### Slipped deals decay fast

**[VENDOR; FAST-MOVING, 2024 data]** Win rate by slippage past the planned close date in the same dataset: 18% at one week, 13% at one month, 8% at three months, 5% at six months and 3% beyond six months, read from a chart and approximate ([Ebsta/Pavilion 2025 GTM Benchmarks](https://benchmarks.ebsta.com/hubfs/V3%202025%20Benchmark%20Report/gtm_benchmarks_digital_report.pdf?hsLang=en)). **[INFERENCE]** A pushed close date is a risk flag in its own right; a deal pushed more than twice should be re-qualified or closed.

### CRM contact coverage is poor by default

**[VENDOR; FAST-MOVING, 2024 data]** In Ebsta's data 44% of contacts sellers interact with are not in the CRM, 26% of those missing contacts are decision-makers, and 17% of CRM contacts have an outdated title or phone number ([Ebsta/Pavilion 2025 GTM Benchmarks](https://benchmarks.ebsta.com/hubfs/V3%202025%20Benchmark%20Report/gtm_benchmarks_digital_report.pdf?hsLang=en)). **[INFERENCE]** Agents should write every contact they interact with to the record automatically.

### What the pipeline research did not find

**[GAP]** No primary source read gives stage-by-stage conversion benchmarks from lead through win; Ebsta reports only that marketing-qualified to sales-qualified conversion rose 32% year over year, not the level, and figures circulating on aggregator pages could not be traced to a primary dataset. Lead-to-opportunity and demo-to-close rates were not found in a primary 2025 to 2026 source.
