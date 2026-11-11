---
id: finance.invoicing.invoicing-receivables-payment-providers
department: finance
domain: invoicing
title: 'Finance: Invoicing, receivables, late payment and payment-provider reconciliation'
summary: 'Invoicing and receivables: mandatory invoice content, reverse-charge wording, simplified and foreign-currency invoices, credit notes, payment terms, late-payment interest and fees, Stripe payout reconciliation and month-end timing, and collections practice.'
type: policy
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- billing
- compliance
sources:
- https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momslagensregleromfakturering.4.58d555751259e4d66168000403.html
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/rantelag-1975635_sfs-1975-635/
- https://www.riksbank.se/en-gb/statistics/interest-rates-and-exchange-rates/reference-rate/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1981739-om-ersattning-for-inkassokostnader_sfs-1981-739/
- https://docs.stripe.com/reports/payout-reconciliation
related:
- finance.vat.moms-sweden-eu-and-beyond
- finance.cash.cash-runway-treasury-currency
- finance.guardrails.agent-guardrails
seed_version: 1
---

**When to use this:** When issuing invoices or credit notes, setting payment terms, charging late interest or reminder fees, chasing receivables or reconciling Stripe payouts.

**Source section:** 7. Invoicing, receivables, late payment and payment-provider reconciliation

### Mandatory content of a full invoice

**[DURABLE; checked on primary source]** A full invoice must contain the issue date; a unique sequential number; the seller's VAT number; the buyer's VAT number when the buyer is liable for the VAT; both parties' names and addresses; the quantity and nature of goods or the extent and nature of services; the date of supply or of advance payment if different from the invoice date; the taxable amount per rate or exemption, the unit price excluding VAT and any discounts; the VAT rate; and the VAT amount ([Skatteverket, momslagens regler om fakturering](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momslagensregleromfakturering.4.58d555751259e4d66168000403.html)). A billing agent validates every invoice against this list before sending.

### Reverse-charge wording and the EU B2B invoice deadline

**[DURABLE; checked on primary source]** Where the buyer accounts for the VAT, the invoice must state "Omvänd betalningsskyldighet" or "Reverse charge". An invoice for an EU business-to-business sale must be issued by the 15th of the month after the goods were delivered or the service supplied; services are reported in VAT-return box 39 and goods in box 35 ([Skatteverket, momslagens regler om fakturering](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momslagensregleromfakturering.4.58d555751259e4d66168000403.html)).

### Simplified invoices

**[FAST-MOVING, 2026 amounts; checked on primary source]** A simplified invoice is allowed when the total is SEK 4,000 or less including VAT, for credit notes, where trade practice or technology makes a full invoice hard, or when the seller is exempt because turnover is SEK 120,000 or less; it may not be used for an EU buyer who must self-account. Minimum content is the date, seller identification, nature of the supply, and the VAT amount or the data to compute it ([Skatteverket, momslagens regler om fakturering](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momslagensregleromfakturering.4.58d555751259e4d66168000403.html)).

### Foreign-currency invoices need the VAT amount in SEK

**[DURABLE; checked on primary source]** If Swedish VAT is due and the books are kept in SEK, the VAT amount must also be shown in SEK, using the ECB rate or the Nasdaq OMX Stockholm mid rate, normally the latest known rate on the day of supply or advance payment ([Skatteverket, momslagens regler om fakturering](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momslagensregleromfakturering.4.58d555751259e4d66168000403.html)). **[INFERENCE]** Monthly subscription billing in EUR or USD to Swedish customers therefore needs a SEK VAT amount on each invoice.

### Credit notes and invoice retention

**[DURABLE; checked on primary source]** Credit notes must refer unambiguously to the original invoice, normally by number, and carry the required invoice details. Issued and received invoices must both be kept, on paper or electronically, provided the content stays readable and unchanged ([Skatteverket, momslagens regler om fakturering](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momslagensregleromfakturering.4.58d555751259e4d66168000403.html)).

### Default payment term between businesses: 30 days

**[DURABLE; checked on primary source]** Under Räntelagen 2 a § a business-to-business or business-to-public-body claim for goods or services is due 30 days after the creditor demands payment; a longer term is valid between businesses only if the creditor has explicitly accepted it ([Räntelag (1975:635), riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/rantelag-1975635_sfs-1975-635/)). The consolidated texts read date from SFS 2013:55 and 2013:56, in force 16 March 2013, which implement the 2011 EU Late Payment Directive ([Räntelag (1975:635), riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/rantelag-1975635_sfs-1975-635/)).

### When late interest starts to run

**[DURABLE; checked on primary source]** Interest runs from the due date when a due date was fixed in advance (Räntelagen 3 §); otherwise from 30 days after an invoice or demand was sent, and between businesses the invoice need not state that interest will be charged (4 §). In business dealings, contract terms that remove the right to late interest or set a lower rate are ineffective against the creditor (4 a §, 6 §) ([Räntelag (1975:635), riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/rantelag-1975635_sfs-1975-635/)).

### Statutory late-payment interest is 10.00% in the second half of 2026

**[FAST-MOVING, 1 July to 31 December 2026; checked on primary source]** The statutory late-interest rate is the Riksbank reference rate plus eight percentage points (Räntelagen 6 §), and the Riksbank sets the reference rate each half-year, rounded up to the nearest half point (9 §) ([Räntelag (1975:635), riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/rantelag-1975635_sfs-1975-635/)). The reference rate is 2.00% from 1 July 2026 for the period to 31 December 2026; its history is 2.00% from 1 January 2026, 2.00% from 1 July 2025, 3.00% from 1 January 2025, 4.00% from 1 July 2024 and 1 January 2024, 3.50% from 1 July 2023 and 2.50% from 1 January 2023 ([Riksbank, reference rate](https://www.riksbank.se/en-gb/statistics/interest-rates-and-exchange-rates/reference-rate/)). **[INFERENCE]** Statutory late-payment interest is therefore 10.00% a year for 1 July 2025 through 31 December 2026 and was 11.00% in the first half of 2025; the rate for 1 January 2027 is set around year-end and must be re-read.

### Reminder fee, collection fee and the SEK 450 compensation

**[DURABLE; checked on primary source]** Under Lag (1981:739) a fee for a written reminder may be charged only if it was agreed no later than when the debt arose; the caps are SEK 60 for a reminder, SEK 180 for a debt-collection demand and SEK 170 for an instalment plan. Between businesses, and business to public authority, a creditor entitled to late interest may also claim a flat late-payment compensation of SEK 450, and reminder and collection fees are payable only to the extent they exceed that amount (4 a §, 5 §) ([Lag (1981:739) om ersättning för inkassokostnader, riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1981739-om-ersattning-for-inkassokostnader_sfs-1981-739/)).

### Invoice and terms template for late payment

**[INFERENCE]** A practical template states the due date, a reference to late interest under Räntelagen or an agreed rate, and a reminder-fee clause in the contract or terms so the SEK 60 fee is chargeable; on overdue business invoices the SEK 450 compensation can be claimed without prior agreement. This is the researchers' reading of the two statutes ([Räntelag (1975:635), riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/rantelag-1975635_sfs-1975-635/); [Lag (1981:739) om ersättning för inkassokostnader, riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1981739-om-ersattning-for-inkassokostnader_sfs-1981-739/)).

### Stripe: reconcile payout by payout

**[PLATFORM CLAIM; DURABLE]** Stripe's payout reconciliation report matches each bank payout to the batch of charges, refunds, disputes and fees it settles and works only with automatic payouts; with manual or instant payouts the Balance report is used and the Stripe balance treated like a bank account. The itemised CSV gives one row per balance transaction with gross, fee and net, the payout ID, the reporting category, and optionally invoice ID and number, customer and subscription IDs and custom metadata for matching to the ledger ([Stripe docs, payout reconciliation report](https://docs.stripe.com/reports/payout-reconciliation)).

### Stripe timing differences at month-end

**[PLATFORM CLAIM; DURABLE]** The payout reconciliation report groups payouts by estimated arrival date and not by the date the bank posts the deposit; an ending-balance reconciliation section lists transactions not yet paid out at period end; and report data can lag the payout ([Stripe docs, payout reconciliation report](https://docs.stripe.com/reports/payout-reconciliation)).

### Bookkeeping pattern for a payment provider

**[INFERENCE]** Post gross sales to revenue or receivable per invoice, provider fees to a bank-charges account, and carry a clearing balance-sheet account that must equal the provider's ending balance at each month-end; payouts in transit over month-end are a reconciling item because the provider dates them by expected arrival. **[GAP]** The VAT treatment of provider fees (reverse charge on a purchased foreign service, or exempt financial service, depending on fee type) was not verified.

### Collections practice

**[GAP; unverified working knowledge]** No sourced data on days sales outstanding, dunning recovery rates or Swedish SaaS payment terms was found. Ordinary practice recalled by the researchers is reminders before the due date, staged dunning, a named owner per overdue account, automated retry for failed card payments, and stop-service rules agreed with Sales.

### Gaps on payments and receivables

**[GAP]** Not researched or verified: Inkassolagen (1974:182); the status of the EU's 2023 proposal for a Late Payment Regulation with a strict 30-day cap; and Bankgiro, Swish, SEPA and Autogiro. The unverified recollection is that Bankgiro with OCR references allows automatic payment matching, that Swedish payment infrastructure is migrating to ISO 20022 formats, that SEPA transfers and direct debits are euro-only, and that SEPA Instant became mandatory for euro-area providers during 2025.
