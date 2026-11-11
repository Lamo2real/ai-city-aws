---
id: support.compliance.gdpr-in-support
department: support
domain: compliance
title: 'Customer support: GDPR in support'
summary: 'GDPR in support (orientation, not legal advice): data subject requests within one month through any channel, identity checks only on reasonable doubt, free of charge, access, erasure, portability and objection, automated decisions, the request workflow, breaches, children, recording and retention, and data in tickets.'
type: policy
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- compliance
- security
sources:
- https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_sv
- https://www.edpb.europa.eu/system/files/2023-04/edpb_guidelines_202201_data_subject_rights_access_v2_en.pdf
- https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en
- https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/de-registrerades-rattigheter/
- https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/personuppgiftsincidenter/
- https://gdpr-info.eu/art-34-gdpr/
- https://lagen.nu/2018:218
- https://www.bankgirot.se/globalassets/dokument/gdpr/hos-kundservice-vid-inspelning.pdf
related:
- support.security.security-in-support
- support.compliance.b2b-support-obligations
seed_version: 1
---

**When to use this:** When a customer asks for their data, deletion, portability or objects, or when handling personal data in tickets.

**Source section:** 23. GDPR in support

### Answer every data subject request within one month

[DURABLE] EDPB's SME guide (EU supervisory-body guidance): reply within one month of receipt; for complex requests extend by two more months, telling the person within the first month and why; if refusing, say why within one month and mention the right to complain to the authority and go to court; respond in writing, preferably electronically and by the channel used or requested; and keep records of requests, answers and reasoning ([EDPB SME guide](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_sv)).

### A request through any channel counts

[DURABLE] EDPB Guidelines 01/2022: a request arriving through any channel the company provides, even if not the preferred one, generally counts as valid and must be handled, and staff should have a mechanism to forward such requests ([EDPB Guidelines 01/2022 v2](https://www.edpb.europa.eu/system/files/2023-04/edpb_guidelines_202201_data_subject_rights_access_v2_en.pdf)). A request made to an AI chat agent is therefore received by the company at that moment.

### Identity checks only on reasonable doubt

[DURABLE] Ask for more information only where there is reasonable doubt about identity, for example a request from an email address other than the customer's usual one or from outside an authenticated account ([EDPB SME guide](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en)). [INFERENCE] Do not ask for ID documents by default; an authenticated session normally removes the doubt.

### Free of charge, with narrow exceptions

[DURABLE] Requests are free. A reasonable fee or refusal is allowed only for manifestly unfounded or excessive requests such as repetitive ones; the company must be able to show this and should warn about a fee beforehand; extra copies may carry a reasonable fee ([EDPB SME guide](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_sv)).

### Access, erasure, portability and objection

[DURABLE] Access: confirm processing and give a copy plus purposes, categories, recipients, retention, source, rights and any automated decision-making, protecting other people's data and trade secrets; IMY adds that an understandable compilation is often enough. Erasure: when data is no longer needed, consent is withdrawn, processing was unlawful, a legal duty requires it or after a successful objection, refusing only on listed grounds such as legal obligations or legal claims. Portability: only for data the person provided, processed by automated means on consent or contract, in a structured, common, machine-readable format, and a PDF alone is not enough. Objection: for direct marketing, stop at once with no reasons needed ([EDPB SME guide](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_sv); [IMY](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/de-registrerades-rattigheter/)).

### Solely automated decisions are restricted

[DURABLE] Solely automated decisions with legal or similarly significant effect are restricted, and the EDPB gives automatic contract termination as an example ([EDPB SME guide](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_sv)). [INFERENCE] An AI agent that closes accounts or refuses service on its own could fall under this restriction when the effect is significant; keep a human in such decisions.

### The support workflow for a request

[DURABLE] Derived from the EDPB guidance: log the date of receipt, since the month runs from receipt; identify the right invoked, no special wording being needed from the person; verify identity only if in doubt, using data already held; route to the privacy owner; answer within one month in writing or send an extension notice with reasons inside that month; and record what was done and why ([EDPB SME guide](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_sv)). [INFERENCE] For a B2B SaaS most end-user requests concern data held as processor; support forwards them to the customer as controller and does not answer on the merits unless the data processing agreement says otherwise.

### Personal data breaches

[DURABLE] IMY: a breach includes data sent to the wrong recipient, lost devices, unauthorised changes and loss of availability; the controller notifies IMY within 72 hours unless risk is unlikely, informs affected people without undue delay if risk is likely high, and documents every breach ([IMY](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/personuppgiftsincidenter/); checked on primary source). The Article 34 message to individuals must be in clear and plain language and cover the contact point, likely consequences and measures taken ([gdpr-info.eu Art. 34](https://gdpr-info.eu/art-34-gdpr/)). [INFERENCE] A mis-sent support email or a ticket exposed to the wrong customer is a breach under IMY's examples, so agents need a one-step internal reporting route.

### Children

[DURABLE] Dataskyddslagen (2018:218) 2 kap. 4 §: consent to information society services offered directly to a child in Sweden is valid from age 13, and below that a guardian must give or approve it ([lagen.nu 2018:218](https://lagen.nu/2018:218); checked on primary source). Minors can always request erasure of data collected by online services they consented to, and language should be adapted when addressing children ([EDPB SME guide](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_sv)).

### Call and chat recording, and ticket retention

[GAP] No IMY guidance on recording support calls or chats or on ticket retention was found. As unverified background, recording needs a lawful basis, information before recording starts, and a defined retention period, and consent is hard to rely on if recording is a condition of service. One Swedish company's notice shows what a cautious firm chose: Bankgirot records support calls only after prior notice, for quality and training, on legitimate interest, and deletes them automatically after 30 days ([Bankgirot notice, undated](https://www.bankgirot.se/globalassets/dokument/gdpr/hos-kundservice-vid-inspelning.pdf)); that is an example of practice, not a legal limit. GDPR sets no fixed retention period; the Swedish bookkeeping retention period was not verified.

### Data handling in tickets

[INFERENCE] Minimise at intake, auto-redact sensitive patterns, set retention periods for tickets and attachments, restrict AI training and use of ticket data to what the privacy notice and processor agreements allow, and route any message that looks like a GDPR request to a tracked queue with a one-month clock. For erasure requests from customers with open invoices, retain what bookkeeping law requires and erase the rest.

### What was not found on GDPR

[GAP] Not verified: IMY's detailed wording on identity checks, deadlines and fees; IMY guidance on children beyond the age threshold; adoption status of EU "digital omnibus" proposals affecting GDPR; international-transfer requirements for non-EU support or AI vendors; and marketing-consent rules for win-back messages.
