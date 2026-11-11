---
id: legal.compliance-programme.corporate-compliance-programme
department: legal
domain: compliance-programme
title: 'Legal: The corporate compliance programme'
summary: 'The corporate compliance programme for a small company: what it needs, the minimum policy set, management accountability,
  recurring calendar entries, regulatory change tracking, incident and breach clocks and an integrated incident playbook.
  Orientation as of 11 November 2026, not legal advice.'
type: policy
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- sweden
objectives:
- compliance
- governance
sources:
- https://rkrattsbaser.gov.se/sfst?bet=2005:551
- https://www.lansstyrelsen.se/vastmanland/samhalle/sakerhet-och-beredskap/tillsyn-av-cybersakerhet/verksamheters-skyldigheter-inom-cybersakerhet.html
- https://data.riksdagen.se/dokumentstatus/HE01CU4.json
- https://eur-lex.europa.eu/eli/reg/2016/679/oj
- https://eur-lex.europa.eu/eli/reg/2024/2847/oj
- https://eur-lex.europa.eu/eli/reg/2024/1689/oj
- https://rkrattsbaser.gov.se/sfst?bet=2021:890
- https://www.cuatrecasas.com/en/latam/intellectual-property/art/digital-omnibus-eu-council-establishes-position
- https://www.edpb.europa.eu/news/swedish-sa-administrative-fine-against-sportadmin_fi
- https://www.imy.se/nyheter/sanktionsavgift-mot-miljodata-for-bristande-sakerhet/
seed_version: 1
cross_refs:
  '8':
  - legal.employment.employment-law
---

**When to use this:** When building or running the company's compliance programme: policies, accountability, calendar, change tracking and incident clocks.

**Source section:** 15. The corporate compliance programme

### What a small company's programme needs

**[INFERENCE]** A small company needs a short, owned and evidenced set of policies tied to the regimes in this document, a dated compliance calendar, a single regulatory-change register, and one integrated incident playbook that runs the GDPR, cybersecurity and contractual clocks together. No Swedish authority checklist for small-company compliance programmes was retrieved, so the policy list and calendar below are the researchers' synthesis of common practice and not sourced requirements.

### Minimum policy set

**[INFERENCE]** Minimum policy set for a small SaaS and AI company: a code of conduct; a privacy policy set (external notices, internal data-protection policy, retention schedule, data-subject request and breach procedures); an information-security policy with an incident-response plan; an acceptable-use and AI-use policy (approved tools, banned inputs, human review, AI literacy training record); an AI governance procedure (inventory, role classification, prohibited-practice screen, Article 50 controls); an anti-bribery and gifts policy aligned with the IMM code; a sanctions and export-control procedure; competition-law dos and don'ts; a whistleblowing procedure, mandatory at 50 or more workers; a vendor and sub-processor due-diligence procedure; a contract-signature and delegation-of-authority policy; a marketing-claims review rule; and a document-retention and legal-hold rule.

### Management accountability

**[DURABLE]** The Swedish board is responsible for the company's organisation and for ensuring that bookkeeping, asset management and finances are controlled in a satisfactory way, and must act with care when delegating (Aktiebolagslagen 8 kap. 4 §). Swedish authority guidance on the Cybersäkerhetslagen lists training of management and staff as a duty. Status: both checked on primary sources; the NIS2 rule that management bodies must approve and oversee cybersecurity measures (Article 20) is unverified background ([Aktiebolagslag (2005:551)](https://rkrattsbaser.gov.se/sfst?bet=2005:551); [Länsstyrelsen Västmanland](https://www.lansstyrelsen.se/vastmanland/samhalle/sakerhet-och-beredskap/tillsyn-av-cybersakerhet/verksamheters-skyldigheter-inom-cybersakerhet.html)).

### Recurring calendar entries

**[INFERENCE]** Recurring compliance calendar entries: an annual review of the record of processing and of DPIAs; annual policy attestation and training (privacy, security, AI literacy, anti-bribery, competition); the semi-annual DSA active-recipient publication if the company is a platform, and an annual DSA transparency report if it is not small; a quarterly check of the sub-processor list and transfer register; the annual report filing and beneficial-owner check with Bolagsverket; the annual general meeting within six months of year-end; an annual penetration test and incident-playbook exercise; an insurance renewal review covering cyber, professional indemnity and, from 2027, software product liability; a yearly re-test of employee-option eligibility; a 1 January headcount check against the 50-worker whistleblowing threshold; and a whistleblowing channel test.

### Regulatory change tracking

**[INFERENCE]** Keep one regulatory-change register with columns for regime, instrument, status, next milestone and date, owner, impact and action. Run a weekly sweep of the EUR-Lex Official Journal, the Commission's AI Office and digital-strategy news, the EDPB, IMY, PTS, MCF, Finansinspektionen, Konkurrensverket, ISP, regeringen.se (draft bills and bills) and riksdagen.se, plus two or three law-firm trackers. Tag every entry "in force", "adopted, not yet applicable" or "proposed", so that agents never apply a proposal as law. The Riksdag open-data service proved usable in this research for checking both statute registers and the status of a bill in committee ([Riksdagen document status example](https://data.riksdagen.se/dokumentstatus/HE01CU4.json)).

### Incident and breach clocks

**[FAST-MOVING, Nov 2026]** The table below lists the incident-reporting clocks for the integrated playbook, with the verification status of each.

| Regime | Clock | Recipient | Verification | Source |
|---|---|---|---|---|
| GDPR Article 33 | Without undue delay and where feasible within 72 hours of awareness, unless risk is unlikely; processor to controller without undue delay; every breach documented | IMY | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| GDPR Article 34 | Without undue delay where high risk is likely | Affected individuals | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| Cybersäkerhetslagen | Initial notice within 24 hours, incident report within 72 hours, final report within one month after that | MCF | Checked on Swedish authority page | [Länsstyrelsen Västmanland](https://www.lansstyrelsen.se/vastmanland/samhalle/sakerhet-och-beredskap/tillsyn-av-cybersakerhet/verksamheters-skyldigheter-inom-cybersakerhet.html) |
| Cyber Resilience Act | 24 hours, 72 hours and 14 days for actively exploited vulnerabilities, from 11 Sep 2026 | Not verified | Unverified background, not fetched | [CRA](https://eur-lex.europa.eu/eli/reg/2024/2847/oj) |
| AI Act Article 73 | Serious incidents with high-risk systems within 15 days, shorter for deaths or widespread incidents, once high-risk rules apply | Market-surveillance authority | Unverified background, not fetched | [AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) |
| Whistleblowing Act | Acknowledgment within seven days; feedback within three months of acknowledgment | Reporter | Checked on primary source | [Lag (2021:890)](https://rkrattsbaser.gov.se/sfst?bet=2021:890) |
| Proposed GDPR change (not law) | 96-hour deadline with a high-risk threshold; national single entry points with a 30-month lead time | — | Secondary source only; proposal | [Cuatrecasas](https://www.cuatrecasas.com/en/latam/intellectual-property/art/digital-omnibus-eu-council-establishes-position) |

### Integrated incident playbook

**[INFERENCE]** Integrated incident playbook skeleton: detect and log, with a timestamp for "awareness"; contain; classify (personal data, significant under the cybersecurity act, a customer-contract trigger, an AI serious incident, a product vulnerability); start all applicable clocks; notify customers as processor first where required; make regulator notifications (IMY within 72 hours; MCF at 24 hours, 72 hours and one month); notify individuals if high risk; preserve evidence and apply a legal hold; and run a post-incident review and register update. A human incident lead and a human lawyer approve every external notification.

**[INFERENCE]** The two Swedish security fines in 2026 give the playbook its preventive checklist: known-but-unfixed weaknesses, no gap-detection routine and no real-time intrusion detection drove the Sportadmin fine, and insufficient checks when installing new software and no automatic real-time monitoring drove the Miljödata fine ([EDPB news](https://www.edpb.europa.eu/news/swedish-sa-administrative-fine-against-sportadmin_fi); [IMY, 22 Sep 2026](https://www.imy.se/nyheter/sanktionsavgift-mot-miljodata-for-bristande-sakerhet/)).

### Gaps in the compliance-programme research

**[GAP]** Not researched: sustainability reporting and due-diligence rules after the 2025–2026 EU simplification package, which a company near the thresholds should check separately; Arbetsmiljöverket guidance beyond the pages cited in section 8; and any Swedish authority checklist for small-company compliance programmes.
