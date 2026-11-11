---
id: finance.revenue-recognition.saas-and-capitalised-development
department: finance
domain: revenue-recognition
title: 'Finance: Revenue recognition for SaaS and capitalised development'
summary: 'Revenue recognition for SaaS: straight-line over the service period, prepaid subscriptions as a liability, IFRS 15, set-up fees, usage and credits, commissions, bookings versus billings versus revenue, and capitalising own development with its restricted fund.'
type: policy
audience: both
confidence: established
volatility: evergreen
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- compliance
- close
sources:
- https://www.faronline.se/dokument/rattserien/redovisa-ratt/u/rr_uppdragmedettobestamtantalaktiviteter/
- https://kpmg.com/se/en/insights/newsletters/finansiell-rapportering/bokforingsnamndens-nyheter-for-k2-och-k3-regelverken.html
- https://www.faronline.se/dokument/rattserien/redovisa-ratt/i/rr_inkomst/
- https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/
- https://a16z.com/16-startup-metrics/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arsredovisningslag-19951554_sfs-1995-1554/
- https://www.faronline.se/dokument/rattserien/redovisa-ratt/a/rr_aktiveringsmodellen/
related:
- finance.bookkeeping.law-and-standards
- finance.close.close-annual-report-audit-board
- finance.metrics.saas-metrics-formulas-benchmarks
seed_version: 1
cross_refs:
  '6':
  - finance.close.close-annual-report-audit-board
---

**When to use this:** When recognising subscription, set-up, usage or credit revenue, treating commissions, or deciding whether to capitalise own development.

**Source section:** 5. Revenue recognition for SaaS and capitalised development

### Subscriptions are recognised straight-line over the service period

**[DURABLE; secondary source only]** Under K3 point 23.26, revenue from a service assignment with an unspecified number of activities over a fixed period is recognised on a straight-line basis over the period, unless another method better reflects the stage of completion; if one specific activity is much more significant than the others, revenue is recognised when that activity is performed. K2 point 6.11 gives the same result for smaller companies where the assignment is not commission-based or on time and materials, covers an unspecified number of activities within an agreed period, and the fee relates to that period ([FAR Online, Redovisa Rätt: uppdrag med ett obestämt antal aktiviteter](https://www.faronline.se/dokument/rattserien/redovisa-ratt/u/rr_uppdragmedettobestamtantalaktiviteter/)). A SaaS subscription is this kind of contract, so the invoice date drives VAT and receivables while revenue follows the service period.

### Prepaid annual subscriptions are a liability released monthly

**[INFERENCE; rests on secondary source for the paragraph references]** A prepaid annual SaaS subscription is booked as a liability (förutbetald intäkt) and released one-twelfth a month under K3 point 23.26 or K2 point 6.11 ([FAR Online, Redovisa Rätt: uppdrag med ett obestämt antal aktiviteter](https://www.faronline.se/dokument/rattserien/redovisa-ratt/u/rr_uppdragmedettobestamtantalaktiviteter/)). Under K2, small prepayments below SEK 7,000 need not be accrued across financial years from 2026 ([KPMG on BFN's K2 and K3 changes decided 16 June 2025](https://kpmg.com/se/en/insights/newsletters/finansiell-rapportering/bokforingsnamndens-nyheter-for-k2-och-k3-regelverken.html)). This is the rule that overrides any house-style habit of treating prepayment as income.

### General income and recognition conditions under K2

**[DURABLE; secondary source only]** K2 point 6.2 with its commentary says income is what the company receives or will receive for its own account, owner contributions are not income, and a transaction may be split into parts when needed to reflect economic substance and the parts and amounts can be identified separately. K2 point 6.6 sets the recognition conditions: significant risks and rewards have passed, the amount can be measured reliably, and the economic benefits are probable; only the part of income belonging to the financial year is that year's revenue ([FAR Online, Redovisa Rätt: inkomst](https://www.faronline.se/dokument/rattserien/redovisa-ratt/i/rr_inkomst/)).

### IFRS 15's five-step model

**[DURABLE; checked on primary source]** IFRS 15's core model is: identify the contract; identify distinct performance obligations; determine the transaction price including estimates of variable consideration; allocate by relative stand-alone selling prices; and recognise revenue when or as each obligation is satisfied, meaning when the customer obtains control. Services are typically recognised over time using a measure of progress. The standard has applied to periods beginning on or after 1 January 2018, clarifications were issued in April 2016, and the post-implementation review is listed as completed in 2024 ([IFRS Foundation, IFRS 15](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/)). It binds only IFRS reporters, but its logic is a useful general reference for any company.

### Set-up and onboarding fees

**[INFERENCE]** K3 and K2 have no SaaS-specific rule for set-up or onboarding fees. The route is the component-separation principle: if onboarding has no stand-alone substance, treat it as part of the subscription and spread it over the contract period; if it is a separately identifiable service, recognise it when performed. This is the researchers' reading of K2 point 6.2 and the dominant-activity exception in K3 point 23.26 ([FAR Online, Redovisa Rätt: inkomst](https://www.faronline.se/dokument/rattserien/redovisa-ratt/i/rr_inkomst/); [FAR Online, Redovisa Rätt: uppdrag med ett obestämt antal aktiviteter](https://www.faronline.se/dokument/rattserien/redovisa-ratt/u/rr_uppdragmedettobestamtantalaktiviteter/)), not a quoted rule, and the policy should be agreed with the auditor.

### Usage-based fees and prepaid credits

**[INFERENCE]** Usage-based fees are earned as usage occurs and are accrued at month-end if unbilled; this follows from the general accrual rule in K2 point 6.6 and IFRS 15's fifth step, and no usage-specific paragraph was read. Unused prepaid credits are a contract liability until used or expired, and the treatment of expiry and breakage should be confirmed with the auditor. **[GAP]** No sourced accounting guidance specific to prepaid AI credits and breakage was found.

### Sales commissions

**[GAP; unverified]** The researchers could not verify any contract-cost asset rule in K3, so the cautious default under K3 is to expense sales commissions as incurred. IFRS 15's capitalisation of incremental costs of obtaining a contract, with its one-year practical expedient, was not on the page read and remains unverified background.

### Bookings, billings and revenue are three different numbers

**[DURABLE]** Bookings are the value of a signed contract; revenue is recognised as the service is delivered, ratably for subscriptions; letters of intent and verbal agreements count as neither, and treating a booking as revenue is a common error. Billings equal revenue in the period plus the change in deferred revenue and are described as a better forward-looking indicator than revenue, with the caveat that a company can hold revenue steady for a time by drawing down its backlog ([a16z, 16 Startup Metrics](https://a16z.com/16-startup-metrics/)).

### Capitalising own development: allowed by statute, with a restricted fund

**[DURABLE; checked on primary source]** Årsredovisningslagen allows own development work to be recognised as an intangible asset; an aktiebolag that capitalises its own development costs must transfer the same amount from free equity to a restricted development fund (fond för utvecklingsutgifter); formation, share-issue and administration costs may not be capitalised (4 kap. 2 §) ([Årsredovisningslag (1995:1554), riksdagen.se, consolidated through SFS 2026:780](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arsredovisningslag-19951554_sfs-1995-1554/)). **[INFERENCE]** The fund requirement reduces distributable equity by the capitalised amount, so capitalising development affects dividend capacity and interacts with the capital-shortfall test in section 6.

### K3's choice between expensing and capitalising, and the six criteria

**[DURABLE; secondary source only]** K3 point 18.7 lets a company choose between the expensing model and the capitalisation model for internally generated intangible assets. Under K3 point 18.12 development-phase expenditure is capitalised only if the company can show all six of the following: it is technically feasible to complete the asset; it intends to complete and use or sell it; it is able to use or sell it; future economic benefits are probable, demonstrated with the value-in-use method of chapter 27; adequate technical, financial and other resources exist; and the expenditure can be measured reliably ([FAR Online, Redovisa Rätt: aktiveringsmodellen](https://www.faronline.se/dokument/rattserien/redovisa-ratt/a/rr_aktiveringsmodellen/)).

### Gaps in revenue and development accounting

**[GAP]** Not verified: K3 points 23.3 to 23.8 on measurement and separating components and 23.17 to 23.22 on stage of completion; K3 amortisation rules for capitalised development, including the often-quoted five-year presumption; that K2 prohibits capitalising own development; IFRS 15 guidance on contract costs, contract liabilities and licences; and the tax treatment of capitalised development.
