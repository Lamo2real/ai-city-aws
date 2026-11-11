---
id: support.security.security-in-support
department: support
domain: security
title: 'Customer support: Security in support'
summary: Support as an attack path, account recovery as the weakest link, permitted recovery methods, two-factor accounts, email, SMS and security questions, verification as a workflow, GDPR limits on identity data, a verification ladder, security rules for AI agents, and personnummer and BankID.
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- security
sources:
- https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-320a
- https://www.bleepingcomputer.com/news/security/your-service-desk-is-the-new-attack-vector-heres-how-to-defend-it/amp/
- https://pages.nist.gov/800-63-4/sp800-63b.html
- https://www.edpb.europa.eu/system/files/2023-04/edpb_guidelines_202201_data_subject_rights_access_v2_en.pdf
- https://www.termsfeed.com/blog/data-subject-request-identify-verification/
- https://www.cmswire.com/customer-experience/does-your-chatbot-meet-eu-ai-act-disclosure-rules/
- https://lagen.nu/2018:218
- https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/personuppgifter/personnummer/
related:
- support.compliance.gdpr-in-support
- support.agent-guardrails.ai-agent-guardrails
seed_version: 1
cross_refs:
  '4':
  - support.house-style.usage-tracking-and-belonging
---

**When to use this:** Before any account recovery, identity check, credential or login change, or when a contact looks like social engineering.

**Source section:** 19. Security in support

### Support is a primary attack path

[DURABLE] A joint CISA and FBI advisory on the Scattered Spider group (AA23-320A, published 16 November 2023, updated 21 November 2023) describes attackers phoning help desks while posing as employees to get passwords or MFA tokens reset, posing as IT staff to obtain one-time codes or get remote-access tools installed, sending repeated MFA prompts until one is approved, and using SIM swaps ([CISA AA23-320A](https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-320a)). [VENDOR] A vendor-sponsored article describes a single successful help-desk call as causing nine-figure impact and weeks of disruption at MGM Resorts and Clorox; those costs and dates were not verified at primary sources ([BleepingComputer, sponsored by FastPassCorp](https://www.bleepingcomputer.com/news/security/your-service-desk-is-the-new-attack-vector-heres-how-to-defend-it/amp/)).

### Account recovery is the weakest link

[DURABLE] NIST SP 800-63B-4 (page dated 26 August 2025; binding only on US federal systems, widely used as a reference) calls account recovery often the weakest link, notes that cost pressure pushes providers to weaker methods, and treats human-assisted recovery as a social-engineering risk; its threat tables include a support representative colluding with an attacker ([NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)).

### Permitted recovery methods and their limits

[DURABLE] Under NIST SP 800-63B-4 section 4.2, permitted methods are saved recovery codes issued at enrolment (at least 64 random bits, stored hashed, single use); recovery codes sent to a pre-registered recovery address (at least six digits, at least two addresses supported, new addresses confirmed first); recovery contacts chosen by the user; and repeated identity proofing. A provider may add its own method, such as interaction with an agent, only if it is documented and based on a risk analysis. A sent recovery code is valid for at most 10 minutes by text or voice, 24 hours by email and 21 days by post (30 outside the contiguous United States) ([NIST SP 800-63B-4, 26 August 2025](https://pages.nist.gov/800-63-4/sp800-63b.html)).

### Two-factor accounts, factor separation and notifications

[DURABLE] For accounts protected by two factors, recovery needs two recovery codes from different methods, or one code plus a still-bound single factor, or repeated identity proofing; one factor must never be enough to obtain a different factor. Every recovery and every authenticator binding triggers a notice to the account's stored notification addresses, with instructions and a contact route in case the holder did not start it, and a subscriber must be able to have an authenticator invalidated immediately on reporting loss, theft or compromise ([NIST SP 800-63B-4, 26 August 2025](https://pages.nist.gov/800-63-4/sp800-63b.html)).

### Email, SMS and security questions

[DURABLE] NIST says email must not be used as an out-of-band authenticator; SMS and voice are restricted, changing the registered phone number counts as binding a new authenticator, and providers should weigh SIM-swap and number-porting signals before sending a code; security questions must not be prompted when users choose passwords ([NIST SP 800-63B-4, 26 August 2025](https://pages.nist.gov/800-63-4/sp800-63b.html)). CISA's mitigations are phishing-resistant MFA (FIDO/WebAuthn or PKI-based), allowlisting and audit of remote-access tools, lockout after repeated failed logins, no password hints, and testing controls against voice-phishing; the advisory gives no help-desk verification script ([CISA AA23-320A](https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-320a)).

### Verification is a workflow, not a conversation

[VENDOR] A vendor-sponsored article (so corroborate before relying on it) recommends that verification be owned by security as a workflow and not left to an agent's conversation, since scripts and ad-hoc questions fail against a calm, prepared attacker; tiering verification by risk (a push to a registered authenticator for routine requests, two distinct factors for privileged users or sensitive changes, a points-based combination of weaker proofs for users who lost MFA); avoiding guessable personal trivia and any answer that has appeared in a breach; writing every attempt, factor and outcome to the ticket; monitoring for spikes in failed verifications against one user or role; and reviewing failure and false-reject rates quarterly ([BleepingComputer, sponsored by FastPassCorp](https://www.bleepingcomputer.com/news/security/your-service-desk-is-the-new-attack-vector-heres-how-to-defend-it/amp/)).

### GDPR sets a ceiling on how much identity data to ask for

[DURABLE] EDPB Guidelines 01/2022 (regulator guidance): the controller must be able to confirm the requester's identity to avoid unauthorised disclosure, but the GDPR prescribes no specific authentication method; the controller may not as a rule request more personal data than necessary and may use it only for handling the request; existing authentication such as a logged-in account may be used; and additional information may be requested only where there are reasonable doubts about identity under Article 12(6) ([EDPB Guidelines 01/2022 v2](https://www.edpb.europa.eu/system/files/2023-04/edpb_guidelines_202201_data_subject_rights_access_v2_en.pdf)). If an identity document is ever requested, ask for the minimum and encourage redaction ([TermsFeed](https://www.termsfeed.com/blog/data-subject-request-identify-verification/)).

### A verification ladder for a SaaS support desk

[INFERENCE] The researchers' design, consistent with the sources. Level 0, general how-to: no verification. Level 1, account-specific information: the contact must come from the registered email or an authenticated in-app session. Level 2, changes to email, password or MFA reset, ownership transfer, billing details, data export or deletion: require in-app confirmation by an authenticated admin or a one-time code to the already-registered contact, notify all account admins, apply a cooling-off delay where feasible, and never complete on the strength of a chat or email claim alone. Any agent-assisted exception follows a written, risk-assessed procedure with a second approver.

### Security rules for AI worker agents

[INFERENCE] Never reveal to an unverified party whether an email address has an account; never read back full personal data; never accept seniority or urgency as a reason to skip steps; treat urgency combined with a request to change contact details as a red flag and escalate to a human; never ask for passwords, full card numbers or Swedish personal identity numbers in tickets, and redact them if received. An AI agent should not be able to perform account recovery or contact-detail changes at all. AI agents have their own identities, least-privilege access and audit logs ([CMSWire](https://www.cmswire.com/customer-experience/does-your-chatbot-meet-eu-ai-act-disclosure-rules/)).

### Sweden-specific: personal identity numbers and BankID

[DURABLE] Legal status: checked on primary sources. Dataskyddslagen (2018:218) 3 kap. 10 § allows processing of a personnummer or samordningsnummer without consent only when clearly justified by the purpose, the importance of secure identification or another notable reason ([lagen.nu 2018:218](https://lagen.nu/2018:218)). IMY (page updated 15 June 2026) says processing should be restrictive, exposure minimised, and a personnummer should not as a starting point be used as a login name ([IMY](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/personuppgifter/personnummer/)). [INFERENCE] Do not ask for a personnummer as a routine support identifier; if a specific flow needs it, mask it in tickets and keep it out of subject lines and transcripts. [GAP] BankID as a high-assurance option is the researchers' general knowledge, not sourced; it identifies a person, not their authority over a company account, so role checks are still needed.

### What was not found on security

[GAP] No ENISA guidance specific to support-desk verification was opened, no neutral body prescribes an agent verification procedure, no data was found on the frequency of account-takeover attempts through SaaS support, and requirements for international transfers when using non-EU support or AI vendors were not verified.
