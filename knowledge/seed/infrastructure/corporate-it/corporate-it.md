---
id: infrastructure.corporate-it.corporate-it
department: infrastructure
domain: corporate-it
title: 'IT infrastructure: Corporate IT'
summary: Where corporate IT risk concentrates in 2026, the workforce authentication and device baselines, joiner-mover-leaver, non-human identities, SaaS management, SPF, DKIM and DMARC, and business continuity.
type: playbook
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- security
sources:
- https://www.verizon.com/about/news/breach-industry-wide-dbir-finds
- https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2026
- https://pages.nist.gov/800-63-4/sp800-63b.html
- https://www.ncsc.gov.uk/collection/vulnerability-management/guidance/policy-update-by-default
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402690
- https://data.riksdagen.se/dokument/sfs-2025-1506.text
- https://www.mcf.se/contentassets/5bf554ffb4404abc99467124edead886/mcffs-2026-11.pdf
- https://learn.microsoft.com/en-us/entra/agent-id/best-practices-agent-id
- https://support.google.com/a/answer/81126
- https://www.iso.org/standard/75106.html
seed_version: 1
---

**When to use this:** For workforce accounts, devices, joiner-mover-leaver, service accounts, SaaS and shadow IT, email authentication and business continuity.

**Source section:** 15. Corporate IT

## 15. Corporate IT

### Where corporate IT risk concentrates in 2026

**[FAST-MOVING, 2026] [VENDOR]** Regular employee use of AI tools tripled to 45% in a year in Verizon's 2026 report ([Verizon news release, 19 May 2026](https://www.verizon.com/about/news/breach-industry-wide-dbir-finds)), and Mandiant recommends routing all SaaS applications through a central identity provider and auditing SaaS integrations and tokens regularly ([Google Cloud blog, M-Trends 2026](https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2026)). **[INFERENCE]** Unsanctioned AI is therefore the leading shadow-IT category, and the core corporate-IT controls are one identity provider for everything, managed and encrypted devices as a condition of access, an HR-driven joiner-mover-leaver process and enforced email authentication.

### Workforce authentication baseline

**[FAST-MOVING, 26 Aug 2025]** The workforce authentication baseline from NIST SP 800-63B-4: offer phishing-resistant login; no SMS as a default factor; no email for out-of-band codes; no forced periodic password changes; a 15-character minimum when a password is the only factor; reauthentication at least every 24 hours with a 1-hour inactivity timeout at AAL2, and every 12 hours with a 15-minute inactivity timeout at AAL3 ([NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)).

### Device baseline

**[INFERENCE]** A device baseline, by practitioner convention aligned to CIS IG1: every laptop and phone holding company data is enrolled in device management before first login; full-disk encryption with escrowed keys; automatic operating-system updates with a deadline; screen lock; an endpoint detection agent reporting to a central console; no local administrator rights by default (just-in-time elevation); remote lock and wipe; and a device-compliance signal required by the identity provider for access to production and sensitive SaaS.

**[INFERENCE]** The update deadline can rest on a published figure: the UK NCSC says operating systems and applications within 7 days and internet-facing software within 5 days, applied automatically where possible ([UK NCSC, reviewed 1 May 2026](https://www.ncsc.gov.uk/collection/vulnerability-management/guidance/policy-update-by-default)). A device-compliance rule can be written as non-compliant when a security update has been available for more than 7 days and blocked from sensitive applications after 14; the 14-day block is the researchers' choice.

### Joiner, mover, leaver

**[FAST-MOVING, 2026]** Checked on primary source. For entities in scope, the Annex of Regulation (EU) 2024/2690 requires deactivating unneeded identities without delay (11.5.4), reviewing access rights at planned intervals (11.2.3), logging changes to identities and access rights (11.2.2(f), 11.5.2(d)), locking accounts after failed logins and timing out idle sessions (11.6.2), reviewing personnel role assignments at least annually (10.1.3) and MFA on privileged accounts (11.3.2(a)). Removable media must be technically blocked unless there is an organisational reason to allow it (12.3.2(a)), and awareness training must be repeated and its effectiveness tested (8.1) ([Regulation (EU) 2024/2690 Annex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402690)).

**[INFERENCE]** A joiner-mover-leaver process with the HR system as trigger. Joiner: accounts created from role templates through SCIM, with a hardware key or passkey enrolled on day one. Mover: the old role's access is removed, not only new access added. Leaver: the identity-provider account is disabled and sessions and tokens revoked at the agreed time (within one hour for involuntary exits, a convention), followed by SaaS without single sign-on, API keys, personal access tokens, shared-secret rotation, device return and wipe, and transfer of mailbox and file ownership. Review privileged and production access quarterly and produce a monthly orphan-account report; those intervals are conventions.

**[FAST-MOVING, 2026]** Checked on primary source. Swedish rules list personnel security, access control and asset management, and basic cyber hygiene and training, as mandatory measure areas ([SFS 2025:1506](https://data.riksdagen.se/dokument/sfs-2025-1506.text)). MCFFS 2026:11's general advice adds a staff training plan and identity checks, interviews and reference checks at recruitment, and its binding text requires access control to premises with identity verification ([MCFFS 2026:11](https://www.mcf.se/contentassets/5bf554ffb4404abc99467124edead886/mcffs-2026-11.pdf)).

### Service accounts and non-human identities

**[FAST-MOVING, 13 Aug 2026] [PLATFORM CLAIM]** Microsoft's guidance for agent identities is a usable model for all service accounts: one identity per instance, a named sponsor and owner, attestation every 6 to 12 months, a quarterly orphan review, certificates or federated credentials in place of secrets, and rotation at least annually ([Microsoft Entra Agent ID best practices, 13 Aug 2026](https://learn.microsoft.com/en-us/entra/agent-id/best-practices-agent-id)).

### SaaS management and shadow IT

**[INFERENCE]** Keep an application register (owner, data class, single sign-on yes or no, contract, data processing agreement, sub-processors, renewal date); discover shadow IT from identity-provider logs, OAuth grant lists, expense data and DNS or browser telemetry; restrict third-party OAuth grants to an allowlist; and publish an approved-AI-tools list with data rules instead of a blanket ban.

### Email authentication

**[FAST-MOVING, 2026]** Checked on primary source. Regulation (EU) 2024/2690 asks in-scope entities to plan the move to modern email communication standards (Annex 6.7.2), which is the legal hook for SPF, DKIM and DMARC ([Regulation (EU) 2024/2690 Annex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402690)).

**[GAP: unverified background]** Not re-verified, and thresholds may have changed: Google's sender rules since February 2024 (with Yahoo, and Microsoft from May 2025, applying similar ones) are understood to require SPF or DKIM and TLS for all senders, and for senders of 5,000 or more messages a day to Gmail both SPF and DKIM, a DMARC policy with alignment, one-click unsubscribe and spam rates below 0.3% with a target under 0.1% ([Google Workspace Admin Help](https://support.google.com/a/answer/81126)).

**[INFERENCE]** An email-authentication checklist: SPF with hard fail and under the 10-lookup limit; DKIM with 2048-bit keys, rotated; DMARC staged from p=none with reporting, to p=quarantine, to p=reject, including parked domains; MTA-STS and TLS reporting; and separate subdomains for marketing and transactional senders.

### Business continuity

**[FAST-MOVING, 1 Oct 2026]** Checked on primary source. MCFFS 2026:11's binding text requires business continuity to define acceptable downtime, recovery priority order and alternative working methods, and to test them. Its general advice is to keep at least one backup on separate hardware, test recovery of critical systems and exercise crisis management at least yearly, and test crisis communication channels every three months ([MCFFS 2026:11](https://www.mcf.se/contentassets/5bf554ffb4404abc99467124edead886/mcffs-2026-11.pdf)). **[GAP: unverified background]** ISO 22301:2019 is understood to be the business continuity management standard (business impact analysis, recovery objectives, strategies and plans, exercises, management review); not re-read ([ISO 22301](https://www.iso.org/standard/75106.html)).

### Gaps in this section

**[GAP]** No primary source was read for device-management or endpoint-detection baselines (UK Cyber Essentials, CIS Benchmarks, Apple or Microsoft platform guidance) or for SaaS-management practice, and no statistics on offboarding failures or SaaS sprawl were collected.
