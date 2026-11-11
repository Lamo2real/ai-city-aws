---
id: infrastructure.compliance.security-frameworks-and-certifications
department: infrastructure
domain: compliance
title: 'IT infrastructure: Security frameworks and certifications'
summary: 'Which security framework serves which audience: ISO/IEC 27001:2022, SOC 2, NIST CSF 2.0, CIS Controls v8.1, ENISA guidance as the NIS2 cross-walk, and a practical certification route.'
type: policy
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- compliance
- security
sources:
- https://www.iso.org/standard/27001
- https://www.mcf.se/contentassets/5bf554ffb4404abc99467124edead886/mcffs-2026-11.pdf
- https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2
- https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.29.pdf
- https://www.nist.gov/cyberframework
- https://www.cisecurity.org/controls/v8-1
- https://www.cisecurity.org/controls/implementation-groups
- https://www.enisa.europa.eu/publications/nis2-technical-implementation-guidance
related:
- infrastructure.compliance.eu-and-swedish-regulation
seed_version: 1
---

**When to use this:** When a customer, auditor or regulator asks for a framework or certificate: ISO 27001, SOC 2, NIST CSF, CIS Controls, ENISA and a certification route.

**Source section:** 12. Security frameworks and certifications

## 12. Security frameworks and certifications

### Which framework serves which audience

**[INFERENCE]** ISO/IEC 27001 is the certification EU customers and Swedish regulators recognise, SOC 2 Type 2 is what US buyers ask for, and CIS Controls Implementation Group 1 plus NIST CSF 2.0 are the free scaffolding to get there. A small SaaS company usually implements CIS IG1 and the AWS baselines first, builds the ISO management system on top, and reuses the evidence for SOC 2. This framing is the researchers' synthesis; the Swedish recognition is sourced in the next paragraph.

### ISO/IEC 27001:2022

**[FAST-MOVING, 2026]** ISO lists ISO/IEC 27001:2022 as Edition 3, published October 2022, status published, with one amendment (Amd 1:2024) and no later amendment or revision shown ([ISO](https://www.iso.org/standard/27001)). Checked on primary source: MCF's general advice in MCFFS 2026:11 recommends SS-ISO/IEC 27001:2022 and SS-EN ISO/IEC 27002:2022 as support for meeting the Swedish security-measure rules ([MCFFS 2026:11](https://www.mcf.se/contentassets/5bf554ffb4404abc99467124edead886/mcffs-2026-11.pdf)).

**[GAP: unverified background]** Not confirmed on a primary page: that ISO/IEC 27001:2022 requires a management system under clauses 4 to 10 plus a Statement of Applicability against 93 Annex A controls in four themes (37 organisational, 8 people, 14 physical, 34 technological); that the transition from the 2013 edition ended on 31 October 2025; and that certification is a Stage 1 and Stage 2 audit by an accredited body on a three-year cycle with annual surveillance audits ([ISO](https://www.iso.org/standard/27001)).

### SOC 2

**[FAST-MOVING, 26 Oct 2026]** The AICPA describes SOC as a suite of services CPAs may provide and names the five SOC 2 categories: Security, Availability, Processing Integrity, Confidentiality and Privacy. On 26 October 2026 it listed exposure drafts of proposed 2027 SOC 2 Trust Services Criteria and Description Criteria; these are drafts and the current criteria stay in force until a final version is issued ([AICPA and CIMA](https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2)). **[INFERENCE]** SOC 2 reports with periods starting in 2027 may be examined under new criteria, so ask the auditor at the next planning meeting which criteria version applies and when. **[GAP]** The content, comment deadline and effective date of the drafts were not read.

**[GAP: unverified background]** Not found on an AICPA page: that Type 1 covers design at a point in time and Type 2 covers operating effectiveness over a period (commonly 3 to 12 months), that Security is the mandatory category, and that the criteria date from 2017 with points of focus revised in 2022.

### NIST CSF 2.0

**[DURABLE]** NIST Cybersecurity Framework 2.0 was published on 26 February 2024 with six Functions: Govern (set and monitor risk strategy and policy), Identify (understand current risks), Protect (use safeguards), Detect (find and analyse attacks), Respond (act on incidents) and Recover (restore operations). The Core has 22 Categories and 106 Subcategories (Govern 31, Protect 22, Identify 21, Respond 13, Detect 11, Recover 8) and four Tiers (Partial, Risk Informed, Repeatable, Adaptive). Profiles describe current and target posture, and Community Profiles are shared baselines ([NIST CSWP 29](https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.29.pdf)).

**[FAST-MOVING, Nov 2026]** No CSF 2.1 or revision is announced on the NIST page; recent items are the final Informative References Quick-Start Guide (SP 1347) and draft SP 800-221r1 on ICT risk management, open for comment until 7 December 2026 ([NIST CSF](https://www.nist.gov/cyberframework)).

### CIS Controls v8.1

**[DURABLE]** CIS Controls v8.1 is an iterative update to v8 that adds the Govern security function and realigns mappings to NIST CSF 2.0, with revised asset classes and glossary ([CIS Controls v8.1](https://www.cisecurity.org/controls/v8-1)). CIS states there are 153 Safeguards in v8 and v8.1; Implementation Group 1 is "essential cyber hygiene" and the starting point for every enterprise, IG2 builds on IG1 and IG3 includes all Safeguards; no version newer than v8.1 is mentioned ([CIS Implementation Groups](https://www.cisecurity.org/controls/implementation-groups)). **[GAP: unverified background]** The per-group counts (IG1 56, IG2 adding 74, IG3 adding 23), the count of 18 controls and the June 2024 date appear only in a graphic or in the researchers' memory.

### ENISA guidance as the NIS2 cross-walk

**[FAST-MOVING, Sep 2025]** ENISA's NIS2 Technical Implementation Guidance (version 1.0, 26 June 2025; mapping table version 1.2, September 2025) gives practical advice, example evidence and mappings for the requirements of Implementing Regulation (EU) 2024/2690, which applies to digital infrastructure, ICT service management and digital providers ([ENISA](https://www.enisa.europa.eu/publications/nis2-technical-implementation-guidance)). **[INFERENCE]** For a Swedish cloud, SaaS or managed-service entity under NIS2, the ENISA mapping table is the cross-walk: one control set producing three outputs (an ISO certificate, a SOC 2 report and NIS2 evidence).

### A practical certification route

**[INFERENCE]** A route for a small SaaS company, which practitioner convention puts at about 6 to 12 months (no 2026 cost or duration data was verified): scope and asset inventory; risk assessment with acceptance criteria; implement CIS IG1 and the AWS Foundational Security Best Practices and fix critical findings; write the minimum policy set (access, change, incident, backup and continuity, supplier, acceptable use, secure development, cryptography); run for three months collecting evidence automatically (tickets, CloudTrail, Config, device-management reports, access reviews); internal audit and management review; ISO Stage 1 and Stage 2; then reuse the same controls for a SOC 2 Type 2 window.

**[INFERENCE]** In an agent-run department every control should produce machine-readable evidence (a ticket ID, a log event, a configuration snapshot). Auditors sample evidence over time, so a gap in the record is a finding even if the control worked.
