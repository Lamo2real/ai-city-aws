---
id: infrastructure.security.security-architecture
department: infrastructure
domain: security
title: 'IT infrastructure: Security architecture'
summary: Threat evidence 2026, zero trust, NIST SP 800-63B-4 workforce authentication, AWS identity and baseline controls, network, encryption and time rules, logging and retention, and patching by exploitation and exposure.
type: playbook
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- aws
objectives:
- security
sources:
- https://www.verizon.com/about/news/breach-industry-wide-dbir-finds
- https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2026
- https://csrc.nist.gov/pubs/sp/800/207/final
- https://doi.org/10.6028/NIST.SP.800-207
- https://www.cisa.gov/sites/default/files/2023-04/zero_trust_maturity_model_v2_508.pdf
- https://pages.nist.gov/800-63-4/sp800-63b.html
- https://docs.aws.amazon.com/securityhub/latest/userguide/fsbp-standard.html
- https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html
- https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html
- https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final
- https://www.cisecurity.org/cis-benchmarks
- https://www.mcf.se/contentassets/5bf554ffb4404abc99467124edead886/mcffs-2026-11.pdf
- https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk
- https://www.cisa.gov/news-events/directives/bod-22-01-reducing-significant-risk-known-exploited-vulnerabilities
- https://www.ncsc.gov.uk/collection/vulnerability-management/guidance/policy-update-by-default
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402690
related:
- infrastructure.corporate-it.corporate-it
- infrastructure.security.post-quantum-cryptography
cross_refs:
  '13':
  - infrastructure.compliance.eu-and-swedish-regulation
seed_version: 1
---

**When to use this:** Before any identity, network, encryption, logging or patching decision, and when judging threats.

**Source section:** 11. Security architecture

## 11. Security architecture

### Threat evidence 2026: exploitation and third parties lead

**[FAST-MOVING, 19 May 2026] [VENDOR]** Verizon's 2026 Data Breach Investigations Report (published 19 May 2026) found vulnerability exploitation was the entry point in 31% of breaches, the first time in 19 editions it exceeded stolen credentials. Third parties were involved in 48% of breaches, up 60% on the prior year. Regular employee use of AI tools rose from 15% to 45% in a year, and mobile-channel social engineering succeeded about 40% more often than email phishing ([Verizon news release, 19 May 2026](https://www.verizon.com/about/news/breach-industry-wide-dbir-finds)). **[GAP]** Only the press release was read; the report's ransomware share, credential-abuse share and patch-time figures were not retrieved.

**[FAST-MOVING, 23 Mar 2026] [VENDOR]** Mandiant's M-Trends 2026 (published 23 March 2026, based on 2025 investigations) found exploits were the top initial vector at 32% for the sixth year running, followed by voice phishing at 11%, prior compromise at 10% and email phishing at 6%. Global median dwell time was 14 days (up from 11), and 52% of intrusions were detected internally (up from 43%) ([Google Cloud blog, M-Trends 2026](https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2026)).

**[FAST-MOVING, 23 Mar 2026] [VENDOR]** M-Trends 2026 reports that the median time from initial access to hand-off to a second threat group fell from over 8 hours in 2022 to 22 seconds in 2025, and that the estimated mean time-to-exploit is about minus 7 days, meaning exploitation before a patch exists. Attackers harvest long-lived OAuth tokens, session cookies, hard-coded keys and personal access tokens from SaaS vendors and pivot to customers, and one group socially engineers IT help desks to get past MFA ([Google Cloud blog, M-Trends 2026](https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2026)).

**[FAST-MOVING, 23 Mar 2026] [VENDOR]** M-Trends 2026 recommends treating hypervisor and management platforms as Tier 0, decoupling backups from the corporate directory and using immutable storage, routing all SaaS through one identity provider, auditing SaaS integrations, keeping logs in central storage well beyond 90 days, and acting quickly on low-severity malware alerts ([Google Cloud blog, M-Trends 2026](https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2026)).

**[INFERENCE]** Because hand-off time is now measured in seconds, containment actions that are pre-approved and automated (isolate an instance, revoke sessions, disable an access key) are worth more than faster human triage. Help-desk identity verification for password and MFA resets needs its own written procedure, because help-desk social engineering is a named 2025 to 2026 attack path.

### Zero trust as the organising model

**[DURABLE]** NIST SP 800-207, Zero Trust Architecture, was published in August 2020 and remains the reference definition ([NIST CSRC](https://csrc.nist.gov/pubs/sp/800/207/final)). **[GAP: unverified background]** The researchers' summary of its tenets was not re-read in the document: every data source and service is a resource; all communication is secured regardless of network location; access is granted per session; access is decided by dynamic policy using identity, device state and behaviour; the organisation monitors the integrity and posture of all assets; authentication and authorisation are enforced before access; and telemetry is collected to improve posture, with a policy engine, policy administrator and policy enforcement point as the logical parts ([NIST SP 800-207](https://doi.org/10.6028/NIST.SP.800-207)).

**[DURABLE]** CISA's Zero Trust Maturity Model version 2.0 (April 2023) is current. It has five pillars (Identity, Devices, Networks, Applications and Workloads, Data), three cross-cutting capabilities (Visibility and Analytics, Automation and Orchestration, Governance) and four stages. Traditional means manual lifecycles, static policy and siloed pillars; Initial means automation starting with some cross-pillar integration; Advanced means automated controls where applicable, centralised visibility and identity control, and least privilege adjusted by risk; Optimal means fully automated just-in-time lifecycles, dynamic least privilege and continuous monitoring ([CISA ZTMM v2.0](https://www.cisa.gov/sites/default/files/2023-04/zero_trust_maturity_model_v2_508.pdf)).

### Authentication: NIST SP 800-63B-4 rules to apply to the workforce

**[FAST-MOVING, 26 Aug 2025]** NIST SP 800-63B Revision 4 (page timestamp 26 August 2025) sets three assurance levels. AAL1 allows single-factor login with an overall session timeout of 30 days or less. AAL2 needs one multi-factor authenticator or two separate factors with at least one replay-resistant, the verifier must offer at least one phishing-resistant option, reauthentication should be at most every 24 hours and the inactivity timeout at most 1 hour. AAL3 requires phishing resistance with a non-exportable private key in hardware-protected storage, reauthentication at most every 12 hours and an inactivity timeout of at most 15 minutes ([NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)).

**[FAST-MOVING, 26 Aug 2025]** Under NIST SP 800-63B-4, syncable authenticators (NIST's term for synced passkeys) have exportable keys and so are not allowed at AAL3; access to the sync fabric must meet AAL2. Passwords, look-up secrets, out-of-band codes and one-time passwords (anything typed in by hand) are not phishing-resistant; phishing resistance needs cryptographic authentication with channel binding or verifier name binding. SMS and voice out-of-band is the only "restricted" authenticator: the organisation must accept the risk, offer an unrestricted alternative, tell users and keep a migration plan. Email must not be used for out-of-band authentication; out-of-band secrets are single-use, at least six digits and valid for at most 10 minutes; and push "compare and approve" is no longer acceptable ([NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)).

**[FAST-MOVING, 26 Aug 2025]** NIST SP 800-63B-4 password rules: at least 15 characters when the password is the only factor and at least 8 when it is only part of MFA; allow at least 64 characters; no composition rules; no periodic change (change only on evidence of compromise); no hints or security questions; check against a blocklist of compromised and common values; allow password managers and paste; and salt and hash with a password-hashing scheme. Rate limiting allows at most 100 consecutive failed attempts before the authenticator is disabled ([NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)).

**[INFERENCE]** For the company's own workforce the NIST rules translate to passkeys or hardware keys for everyone; device-bound hardware keys (not synced passkeys) for administrators and break-glass accounts; no SMS; no password expiry; and a 15-character minimum wherever a password is the only factor.

### AWS identity and baseline controls

**[PLATFORM CLAIM]** AWS's Foundational Security Best Practices standard, evaluated continuously by Security Hub, includes controls for hardware MFA on the root user (IAM.6), no root access key (IAM.4), IMDSv2 (EC2.8), S3 block public access (S3.1 and S3.8), a multi-Region CloudTrail trail (CloudTrail.1), log file validation (CloudTrail.4), GuardDuty enabled (GuardDuty.1) and EBS default encryption (EC2.7); the researchers counted about 370 controls in the fetched list, an approximate figure ([AWS Security Hub user guide](https://docs.aws.amazon.com/securityhub/latest/userguide/fsbp-standard.html)).

**[GAP: unverified background]** The researchers' recollection of AWS IAM best practice, not re-fetched: humans federate through an identity provider to get temporary credentials; workloads use IAM roles; MFA is required; the root user has no access keys; least privilege is enforced with permission guardrails; and unused access is reviewed with IAM Access Analyzer ([AWS IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)). Likewise unverified: the Well-Architected Security Pillar's advice to protect data in transit and at rest, automate key management with KMS, store secrets in a secrets manager with rotation and keep people away from data ([AWS Well-Architected Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html)); NIST SP 800-57 Part 1 as the reference for key lifecycles ([NIST SP 800-57 Pt 1 Rev 5](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final)); and CIS Benchmarks as per-platform Level 1 and Level 2 configuration baselines, with the CIS AWS Foundations Benchmark available as a Security Hub standard ([CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks)).

**[INFERENCE]** A minimum AWS security baseline for the department: AWS Organizations with separate production, non-production, security and log-archive accounts; IAM Identity Center federated to the company identity provider with passkeys or hardware keys; no IAM users with long-lived keys (roles, OIDC federation for CI, IAM Roles Anywhere for workloads outside AWS); SCPs that deny root use, region sprawl and the disabling of CloudTrail, GuardDuty or Config; an organisation CloudTrail to a locked log-archive bucket with validation; GuardDuty, Security Hub, Config and Inspector on in all accounts and Regions; S3 Block Public Access at account level; IMDSv2 only; default encryption for EBS, RDS and S3 with KMS; Secrets Manager with rotation; and AWS Backup with Vault Lock and a cross-account, cross-Region copy. This is the researchers' checklist, aligned to the AWS controls above.

### Network, encryption and time: the Swedish binding rules as a benchmark

**[FAST-MOVING, 1 Oct 2026]** Checked on primary source. MCF's regulation MCFFS 2026:11 (in force 1 October 2026) requires, for the entities it fully covers, MFA for administrator access, for remote access by staff and suppliers and for access to information needing extra protection; account lockout after a set number of failed logins; network segmentation that allows only approved data flows; separation of development, test and training from production; encryption of logs and credentials in transit inside the environment; DNSSEC unless clearly unnecessary; time traceable to Swedish UTC; and logging of security events including unauthorised access attempts, with log analysis at intervals set by risk ([MCFFS 2026:11](https://www.mcf.se/contentassets/5bf554ffb4404abc99467124edead886/mcffs-2026-11.pdf)). Section 13 explains that SaaS, cloud and managed-service providers are subject only to its management-training part, so for them these measures are a useful benchmark and not the binding source.

### Logging and retention

**[INFERENCE]** Twelve months of hot, searchable retention for security logs is a defensible default, given Mandiant's advice to keep logs well beyond 90 days and its 14-day median dwell time ([Google Cloud blog, M-Trends 2026](https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2026)). The 12-month figure is the researchers' choice, not a sourced requirement.

### Patching: prioritise by exploitation, exposure and automatability

**[FAST-MOVING, 10 Jun 2026]** CISA Binding Operational Directive 26-04, issued 10 June 2026, revokes and replaces BOD 19-02 and BOD 22-01; older knowledge that cites those two directives is out of date. It binds US federal civilian agencies only and does not apply to contractors unless a contract says so, but it is the current reference benchmark. Its deadline is set by four yes-or-no inputs: listed in the Known Exploited Vulnerabilities (KEV) catalogue, publicly exposed, automatable by an attacker (the CERT/CC SSVC definition as published in CISA's Vulnrichment data), and technical impact (total or partial control) ([CISA BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk); [CISA BOD 22-01, revoked](https://www.cisa.gov/news-events/directives/bod-22-01-reducing-significant-risk-known-exploited-vulnerabilities)).

| In KEV | Publicly exposed | Automatable | Impact | Deadline (BOD 26-04, 10 Jun 2026) | Source |
|---|---|---|---|---|---|
| Yes | Yes | Yes | Total | 3 days plus forensic triage | [BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk) |
| Yes | Yes | Yes | Partial | 7 days | [BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk) |
| Yes | Yes | No | Total | 7 days | [BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk) |
| Yes | Yes | No | Partial | 14 days | [BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk) |
| Yes | No | Yes | Total | 14 days | [BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk) |
| Yes | No | Any other combination | | 30 days | [BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk) |
| No | Yes | Yes | Total | 30 days | [BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk) |
| No | Yes | Yes | Partial | 60 days | [BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk) |
| No | Yes | No | Total | 60 days | [BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk) |
| No | Yes | No | Partial | 90 days | [BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk) |
| No | No | Yes | Total | 90 days | [BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk) |
| No | No | Any other combination | | Fix on system upgrade | [BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk) |

**[FAST-MOVING, 10 Jun 2026]** BOD 26-04 also requires continuous tagging of externally reachable assets with organisation, environment (production or development), exposure (public or internal) and asset type, and automatic reporting of KEV status. Its phases are an immediate policy review, a process update within 60 days and the table's timelines met within 180 days of issuance ([CISA BOD 26-04](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk)). **[INFERENCE]** 180 days after 10 June 2026 is about 7 December 2026, so US public-sector customers may start putting these deadlines into contracts.

**[FAST-MOVING, 1 May 2026]** The UK NCSC's vulnerability-management guidance (published 12 February 2024, reviewed 1 May 2026) says to update internet-facing services and software within 5 days, operating systems and applications within 7 days, and internal or air-gapped services within 14 days; to update by default and ideally automatically; to use staged or canary rollout; and to prefer replacing images through infrastructure as code. When a flaw in an internet-facing service is being exploited, check for signs of compromise before patching, because patching does not remove an attacker who is already inside ([UK NCSC](https://www.ncsc.gov.uk/collection/vulnerability-management/guidance/policy-update-by-default)).

**[FAST-MOVING, 2026]** Checked on primary source. EU Implementing Regulation 2024/2690 sets no day counts for patching: patches within a reasonable time, critical vulnerabilities without undue delay, scans at planned intervals, and deferrals documented with reasons (Annex 6.6 and 6.10) ([Regulation (EU) 2024/2690](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402690)). Sweden's MCFFS 2026:11 requires prompt installation of security updates and replacement of unsupported software without undue delay; its non-binding general advice is to begin installing a security update within 72 hours of the fix being available; and it requires connecting to the national CSIRT's automatic vulnerability notification service (ANTS) unless clearly unnecessary ([MCFFS 2026:11](https://www.mcf.se/contentassets/5bf554ffb4404abc99467124edead886/mcffs-2026-11.pdf)).

**[INFERENCE]** A defensible company patch SLA built on those published tables is below. Where no patch exists, apply a compensating control (a WAF rule, disabling the feature, isolation) within the same window; that last sentence is the researchers' addition.

| Class of finding | Company deadline | Basis | Label |
|---|---|---|---|
| KEV-listed and internet-exposed | 3 days (72 hours) | BOD 26-04 fastest row; matches the Swedish 72-hour "begin" advice | [INFERENCE] |
| Other internet-facing services and software | 5 days | UK NCSC | [INFERENCE] |
| Servers, workstations, operating systems and applications | 7 days | UK NCSC | [INFERENCE] |
| Internal-only services | 14 days | UK NCSC | [INFERENCE] |
| Lower-risk findings | 30, 60 or 90 days as an outer limit | BOD 26-04 lower rows | [INFERENCE] |

**[INFERENCE]** BOD 26-04 moves the benchmark from a severity score to "exploited, exposed and automatable". A vulnerability process that sorts only by CVSS is behind the reference practice. It needs an exposure tag on every asset (AWS resource tags plus a public or internal flag can supply this) and the KEV and SSVC "automatable" fields from CISA's feeds.

### Gaps in this section

**[GAP]** Not retrieved: the ENISA Threat Landscape 2026 (no ENISA threat figures are included), BOD 26-04's implementation guidance, SP 800-63B-4 Appendix B on syncable authenticators and the revision's exact publication date. No authoritative single source prescribes patch SLAs for private companies; the SLA table is inference.
