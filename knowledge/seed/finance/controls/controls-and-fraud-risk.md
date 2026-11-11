---
id: finance.controls.controls-and-fraud-risk
department: finance
domain: controls
title: 'Finance: Financial controls and fraud risk'
summary: 'Financial controls and fraud risk: payment and occupational fraud, COSO''s framework, designed controls in a small G&A team, segregation of duties, approval matrix, purchase-to-pay and order-to-cash, payment-fraud defences and software spend.'
type: principle
audience: both
confidence: vendor
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- controls
sources:
- https://www.financialprofessionals.org/training-resources/resources/survey-research-economic-data/details/payments-fraud
- https://www.acfe.com/fraud-resources/report-to-the-nations
- https://www.coso.org/guidance-on-ic
- https://www.coso.org/_files/ugd/719ba0_08f358f2c8f946fa9d26bd51d37b7117.pdf
- https://www.iconiq.com/growth/insights/state-of-ai-2026
related:
- finance.ai-in-finance.2026-guidance
- finance.guardrails.agent-guardrails
seed_version: 1
---

**When to use this:** When designing approvals, segregation of duties, purchase-to-pay or order-to-cash controls, payment-fraud defences or software spend management.

**Source section:** 17. Financial controls and fraud risk

### Payment fraud is common

**[VENDOR; FAST-MOVING, 2025 data, published 2026]** In AFP's 2026 Payments Fraud and Control Survey (22nd edition, 465 corporate practitioners, US-centric), 76% of organisations experienced attempted or actual payments fraud in 2025, slightly down on 2024; checks were the most targeted method at 58% of organisations, ahead of ACH and wires; business email compromise is described as still among the most common forms; and AI and deepfake fraud was examined for the first time, with the figures behind a paywall ([AFP, 2026 Payments Fraud and Control Survey page](https://www.financialprofessionals.org/training-resources/resources/survey-research-economic-data/details/payments-fraud)).

### Occupational fraud: controls shorten detection, and two red flags are cheap to act on

**[FAST-MOVING, 2026]** The ACFE's 2026 report covers 2,402 cases from 143 countries and finds that anti-fraud controls are associated with lower losses and faster detection. Tips arrive mainly through web forms (46%), email (34%) and phone (23%), and median losses are higher where red flags are present, for example an unusually close relationship with a vendor or customer ($300,000) or refusal to take holidays ($250,000) ([ACFE, Occupational Fraud 2026: A Report to the Nations](https://www.acfe.com/fraud-resources/report-to-the-nations)). **[INFERENCE]** Two cheap small-company controls follow: enforce holiday cover or rotation for anyone who handles payments, and separate ownership of the vendor relationship from the vendor master and from payment approval.

### COSO's framework and its guidance list

**[DURABLE]** COSO's 2013 Internal Control–Integrated Framework has five components, monitoring being one, and superseded the 2006 guidance for smaller public companies on 15 December 2014. COSO's guidance list includes 2024 guidance on robotic process automation and the 2026 guidance on generative AI ([COSO, Guidance on Internal Control](https://www.coso.org/guidance-on-ic)). The 2026 paper refers to five components and 17 principles ([COSO, Achieving Effective Internal Control Over Generative AI, 2026 (PDF)](https://www.coso.org/_files/ugd/719ba0_08f358f2c8f946fa9d26bd51d37b7117.pdf)). **[GAP; unverified working knowledge]** The component names (control environment, risk assessment, control activities, information and communication, monitoring) and the idea that a small company applies them through a short risk-and-control matrix are standard descriptions that the research did not quote from a COSO page beyond the 2026 paper's component headings.

### Fewer people in G&A raises the weight of designed controls

**[VENDOR; FAST-MOVING, Q2 2026]** G&A headcount is planned to contract at AI-building software companies in ICONIQ's 2026 survey ([ICONIQ, 2026 State of AI, July 2026](https://www.iconiq.com/growth/insights/state-of-ai-2026)). **[INFERENCE]** With fewer people, separation of duties has to be designed into systems and agent permissions instead of relying on headcount.

### Classic controls: segregation, approval matrix, purchase-to-pay, order-to-cash

**[GAP; unverified working knowledge]** No primary source for classic control design was obtained, so the following is unsourced ordinary practice. Segregation to preserve even in a team of two or three: whoever creates or edits a vendor or bank detail does not approve the payment; whoever prepares a payment does not release it; whoever reconciles the bank cannot pay; payroll changes are approved by someone other than the processor. Compensating controls where headcount prevents separation: owner review of bank statements, dual authorisation in the bank, system audit logs, and a monthly review of vendor-master changes. Approval matrix: thresholds by amount and type (operating cost, capital spend, contracts with a term or auto-renewal, hiring, discounts, credit notes, refunds), named approvers, and nobody approves their own spend. Purchase-to-pay: vendor onboarding with company registration and VAT check, sanctions screen and bank-detail verification by call-back to an independently sourced number; purchase approval before commitment; three-way match where relevant; duplicate-invoice check; scheduled payment runs with dual release. Order-to-cash: signed order form, pricing and discount approval, invoice accuracy, credit-note approval, cash application, revenue-recognition review and dunning.

### Payment-fraud defences

**[GAP; unverified working knowledge]** Unsourced ordinary practice: any request to change bank details or make an urgent or secret payment is verified out-of-band through a known number and never through the channel it arrived on; no payment is made on the strength of a video or voice call alone, because of deepfake risk; bank-level allow-lists, limits and dual authorisation are used; and staff are trained with simulated business email compromise. A widely reported 2024 deepfake video-conference case is the usual illustration, but no source for it was opened, so its facts are not stated here.

### Software spend management

**[GAP; unverified working knowledge]** Unsourced ordinary practice for software spend is a single system of record for subscriptions, a named owner per tool, a renewal calendar with notice dates, card controls and a quarterly licence-utilisation review. No sourced expense-policy or procurement benchmarks were found.

### Gaps on controls

**[GAP]** Not captured: AFP's detailed figures on business email compromise share, deepfake incidence, recovery rates and control effectiveness (paywalled); the ACFE 2026 median loss, share of revenue lost and small-organisation findings; Swedish fraud statistics and Swedish payment controls around Bankgirot and BankID.
