---
id: infrastructure.compliance.eu-and-swedish-regulation
department: infrastructure
domain: compliance
title: 'IT infrastructure: EU and Swedish regulation'
summary: Cybersäkerhetslagen (NIS2 in Sweden) scope and duties, Swedish authorities, which rulebook applies, the 30-minute rule in Regulation 2024/2690, GDPR breach notice to IMY, the Digital Omnibus, DORA, the Cyber Resilience Act, the Data Act, transfers to the US and the four incident clocks.
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
- https://data.riksdagen.se/dokument/sfs-2025-1506.text
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32003H0361
- https://eur-lex.europa.eu/eli/dir/2022/2555/oj
- https://data.riksdagen.se/dokument/sfs-2025-1507.text
- https://www.mcf.se/contentassets/21a0348add6b4aec969e535166447bdc/konsekvensutredning-mcffs-2026-8.pdf
- https://www.ncsc.se/
- https://www.transportstyrelsen.se/sv/om-oss/det-har-ar-transportstyrelsen/krisberedskap-och-sakerhet/cybersakerhet-nis2/
- https://www.lansstyrelsen.se/nationellt-innehall/samhalle/sakerhet-och-beredskap/tillsyn-av-cybersakerhet/verksamheters-skyldigheter-inom-cybersakerhet.html
- https://www.mcf.se/
- https://www.mcf.se/contentassets/bf5f875837754fecaf5627012e1762ce/mcffs-2026-8.pdf
- https://www.mcf.se/contentassets/5bf554ffb4404abc99467124edead886/mcffs-2026-11.pdf
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402690
- https://digital-strategy.ec.europa.eu/en/policies/nis2-directive
- https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/personuppgiftsincidenter/
- https://eur-lex.europa.eu/eli/reg/2016/679/oj
- https://ieu-monitoring.com/editorial/eu-council-agrees-digital-omnibus-position-to-simplify-gdpr-e-privacy-and-cybersecurity-rules/1252877/
- https://www.lewissilkin.com/insights/2026/11/09/digital-rulebook-simplification-of-eu-data-protection-and-cyber-rules-102o7e4
- https://www.eiopa.europa.eu/digital-operational-resilience-act-dora_en
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022R2554
- https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act
- https://digital-strategy.ec.europa.eu/en/policies/cra-reporting
- https://eur-lex.europa.eu/eli/reg/2024/2847/oj
- https://digital-strategy.ec.europa.eu/en/policies/data-act
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202302854
- https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20251201-european-court-of-justice-to-review-challenge-to-eu-us-data-privacy-framework
- https://ieu-monitoring.com/editorial/microsoft-backs-eu-commission-in-eu-court-case-on-transatlantic-data-flows-and-privacy/1244467/
related:
- infrastructure.compliance.security-frameworks-and-certifications
- infrastructure.guardrails.agent-guardrails
- infrastructure.handoffs.cross-department
seed_version: 1
---

**When to use this:** Before any incident classification, notification, contract term, data transfer or cloud-switching question: orientation for a human to confirm, never final legal advice.

**Source section:** 13. EU and Swedish regulation

## 13. EU and Swedish regulation

**[INFERENCE]** Everything in this section is orientation as of 11 November 2026 and not legal advice. Each paragraph states whether the point was checked on a primary source, rests on a secondary source, or is unverified background. Classification questions (whether the company is in scope, whether a product is a "cloud computing service", whether an incident is "significant", whether a breach poses a risk to individuals) belong to the Legal department and a named accountable human.

### Cybersäkerhetslagen (NIS2 in Sweden): scope

**[FAST-MOVING, 15 Jan 2026]** Checked on primary source. Cybersäkerhetslagen (SFS 2025:1506) entered into force on 15 January 2026 and repealed the 2018 NIS law. It covers operators of the types in NIS2 Annex I or II that are established in Sweden and at least medium-sized under Recommendation 2003/361/EC; smaller operators are covered in special cases, such as sole providers of an essential service. Providers of cloud services, data-centre services, CDNs, outsourced operations and security services (managed services), online marketplaces, search engines and social networks are covered where their main establishment or representative is in Sweden. Entities covered by DORA are exempt from the law's risk-management and incident-reporting sections ([SFS 2025:1506](https://data.riksdagen.se/dokument/sfs-2025-1506.text)).

**[DURABLE]** Checked on primary source. Under Recommendation 2003/361/EC, a medium-sized enterprise has fewer than 250 staff and turnover up to EUR 50 million or a balance sheet up to EUR 43 million; a small enterprise has fewer than 50 staff and turnover or balance sheet up to EUR 10 million; a micro enterprise has fewer than 10 staff and up to EUR 2 million. The financial test is met if either turnover or balance sheet is within the ceiling. Partner enterprises (25% or more of capital or votes) and linked enterprises (majority control) are counted in, and status changes only after the ceilings are crossed in two consecutive accounting periods ([Recommendation 2003/361/EC](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32003H0361)).

**[INFERENCE]** "At least medium-sized" therefore means 50 or more staff, or both turnover and balance sheet above EUR 10 million, counting group companies. A 40-person SaaS company with EUR 12 million turnover but a EUR 6 million balance sheet is still small, and crossing the line counts only after two consecutive financial years. This is the researchers' reading of the Recommendation and not legal advice. Below the threshold a company is probably out of scope by law but will still receive NIS2-style clauses from in-scope customers through their supply-chain duties.

**[GAP: unverified background]** The researchers recall that under NIS2 Article 3 large entities in Annex I sectors (which include cloud, data-centre and managed-service providers) are "essential" and medium-sized ones "important"; this was not re-read ([Directive (EU) 2022/2555](https://eur-lex.europa.eu/eli/dir/2022/2555/oj)).

### Cybersäkerhetslagen: duties

**[FAST-MOVING, 2026]** Checked on primary source. Cybersäkerhetslagen requires all-hazards risk-management measures covering at least: risk analysis and security strategy; incident handling; continuity and crisis management; supply-chain security; security in acquisition, development and maintenance; methods to assess effectiveness; cyber hygiene and training; cryptography and encryption; personnel security, access control and asset management; and, where needed, MFA, secured communications and emergency communications. Management must be trained in security measures. Registration is by notifying the designated authority as soon as possible, with changes notified within 14 days; the law sets no fixed calendar deadline for first registration ([SFS 2025:1506](https://data.riksdagen.se/dokument/sfs-2025-1506.text)).

**[FAST-MOVING, 2026]** Checked on primary source. Incident reporting under Cybersäkerhetslagen: an early warning within 24 hours of becoming aware of a significant incident; an incident notification within 72 hours (24 hours for trust services); an interim report on request; and a final report within one month of the notification, or a status report then and a final report one month after the incident is handled. A significant incident is one that has caused or can cause serious operational disruption or financial damage to the operator, or has affected or can affect others through considerable damage. Customers must be informed of significant incidents likely to affect the service and of protective measures against significant cyber threats ([SFS 2025:1506](https://data.riksdagen.se/dokument/sfs-2025-1506.text)).

**[FAST-MOVING, 2026]** Checked on primary source. Sanctions under Cybersäkerhetslagen start at SEK 5,000. Essential entities face up to the higher of 2% of global annual turnover or EUR 10 million; important entities up to the higher of 1.4% or EUR 7 million; public bodies up to SEK 10 million. Managers of essential entities can be banned from management roles for 1 to 3 years after an ignored order combined with intent or gross negligence. Supervision of important entities is reactive (it needs reason to suspect shortcomings), while essential entities face regular security audits ([SFS 2025:1506](https://data.riksdagen.se/dokument/sfs-2025-1506.text)).

### Swedish authorities: who supervises and who receives reports

**[FAST-MOVING, 2026]** Checked on primary source. Under Cybersäkerhetsförordningen (SFS 2025:1507), PTS supervises digital infrastructure, digital providers, business-to-business ICT service management, post and space; Finansinspektionen supervises banking and financial market infrastructure; Energimyndigheten energy; Transportstyrelsen transport; IVO and Läkemedelsverket health; Livsmedelsverket water and food; and six county administrative boards several other sectors. In the current text FRA is the joint contact point (receives registrations), the CSIRT (receives incident reports) and the cyber crisis management authority ([SFS 2025:1507](https://data.riksdagen.se/dokument/sfs-2025-1507.text)).

**[FAST-MOVING, 1 Jul 2026]** Checked on primary source. MCF was the CSIRT and received incident reports until 30 June 2026; on 1 July 2026 the CSIRT role, incident-report reception and the mandate for the regulations moved to the national cybersecurity centre (NCSC) at FRA ([MCF impact assessment for MCFFS 2026:8](https://www.mcf.se/contentassets/21a0348add6b4aec969e535166447bdc/konsekvensutredning-mcffs-2026-8.pdf)). NCSC is part of FRA, CERT-SE is part of NCSC and is the national CSIRT, and "Cyberportalen" is the service for reporting significant incidents; contact details given are 010-382 80 00 and ncsc@ncsc.se ([ncsc.se](https://www.ncsc.se/)). Registration is made through NCSC's registration service, which forwards it to the sector supervisor, under rules in MCFFS 2026:1 (page updated 15 September 2026) ([Transportstyrelsen](https://www.transportstyrelsen.se/sv/om-oss/det-har-ar-transportstyrelsen/krisberedskap-och-sakerhet/cybersakerhet-nis2/)).

**[CONTESTED]** The county administrative boards' page still tells operators to report incidents to MCF ([Länsstyrelsen](https://www.lansstyrelsen.se/nationellt-innehall/samhalle/sakerhet-och-beredskap/tillsyn-av-cybersakerhet/verksamheters-skyldigheter-inom-cybersakerhet.html)). The ordinance and NCSC's own site say reports go to NCSC at FRA ([SFS 2025:1507](https://data.riksdagen.se/dokument/sfs-2025-1507.text); [ncsc.se](https://www.ncsc.se/)); the researchers judge the county page to be outdated text from before 1 July 2026. Follow the ordinance and confirm the channel before filing.

**[FAST-MOVING, Apr 2026]** By mid-April 2026, 2,490 entities had registered in Sweden (2,080 of them companies), about 430 of them below the medium-size threshold ([MCF impact assessment for MCFFS 2026:8](https://www.mcf.se/contentassets/21a0348add6b4aec969e535166447bdc/konsekvensutredning-mcffs-2026-8.pdf)). **[GAP: unverified background]** MSB became Myndigheten för civilt försvar (MCF) on 1 January 2026, so older guidance may be cited under either name; this was not re-verified ([mcf.se](https://www.mcf.se/)).

### Which rulebook applies to a SaaS, cloud or managed-service provider

**[FAST-MOVING, 2026]** Checked on primary source. MCFFS 2026:8 (decided 13 May 2026, in force 1 July 2026) sets report contents and general thresholds for significant incidents: sector activity limited for more than 12 hours or staff on alternative methods for more than 48 hours; cost above 5% of prior-year turnover; exposure or destruction of protected information of another legal entity or of at least 500 individuals; or two same-cause incidents within six months that together meet the cost threshold. Its chapters 3 to 5 (thresholds and customer information) do not apply to digital infrastructure, digital providers or business-to-business ICT service management; for those sectors the criteria come from Commission Implementing Regulation (EU) 2024/2690 ([MCFFS 2026:8](https://www.mcf.se/contentassets/bf5f875837754fecaf5627012e1762ce/mcffs-2026-8.pdf); [MCF impact assessment](https://www.mcf.se/contentassets/21a0348add6b4aec969e535166447bdc/konsekvensutredning-mcffs-2026-8.pdf)).

**[FAST-MOVING, 1 Oct 2026]** Checked on primary source. MCFFS 2026:11 (decided 15 June 2026, in force 1 October 2026) likewise subjects operators active only in digital infrastructure, digital providers, ICT service management, post or space to its management-training part only; their technical measures come from Regulation 2024/2690. For everyone else it requires that management approves and oversees measures and is briefed at least yearly; a named coordinator, information owners and system owners; a yearly review of critical systems; and supplier requirements, with contracts from before 1 October 2026 amended where possible. FRA can grant exemptions ([MCFFS 2026:11](https://www.mcf.se/contentassets/5bf554ffb4404abc99467124edead886/mcffs-2026-11.pdf)).

**[INFERENCE]** A Sweden-based business-to-business SaaS company on AWS that is at least medium-sized should assume it is a cloud computing service provider under NIS2 Annex I, register through NCSC, treat PTS as its supervisor, and use Regulation 2024/2690 and the ENISA guidance as its control and threshold source instead of MCFFS 2026:8 and 2026:11 (except management training). Whether a given SaaS product is legally a "cloud computing service" is a classification question for counsel; this is the researchers' reading and not legal advice.

### Implementing Regulation (EU) 2024/2690: the 30-minute rule

**[FAST-MOVING, 2026]** Checked on primary source (through a model summary; re-read before quoting). Implementing Regulation (EU) 2024/2690 was published in the Official Journal on 18 October 2024 and entered into force on the twentieth day after (7 November 2024 by calculation). It covers DNS providers, TLD registries, cloud computing providers, data-centre providers, CDNs, managed service providers, managed security service providers, online marketplaces, search engines, social networks and trust service providers ([Regulation (EU) 2024/2690](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402690)).

**[FAST-MOVING, 2026]** Checked on primary source. Under Article 3 of Regulation 2024/2690 an incident is significant if any one general criterion applies: direct financial loss above EUR 500,000 or 5% of the previous year's turnover, whichever is lower; trade secrets exfiltrated or at risk; a death caused or possible; considerable damage to a person's health; successful, suspected-malicious unauthorised access that could cause severe operational disruption; recurring incidents under Article 4 (at least two within six months with the same apparent root cause, together meeting the financial criterion); or a sector-specific criterion. Planned maintenance does not count. Users are counted as contracted customers plus the natural and legal persons associated with business customers ([Regulation (EU) 2024/2690](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402690)).

| Provider type (Reg. 2024/2690) | Sector-specific significant-incident criteria | Source (primary, via summary) |
|---|---|---|
| Cloud computing (Art. 7) | Service completely unavailable for more than 30 minutes; limited availability for more than one hour for more than 5% of users in the Union or more than 1 million users, whichever is smaller; integrity, confidentiality or authenticity of data compromised by a suspected malicious action (no size threshold); data compromise affecting more than 5% of users or more than 1 million users, whichever is smaller | [Regulation (EU) 2024/2690](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402690) |
| Data centre (Art. 8) | Any complete unavailability of a data-centre service (no minimum duration); limited availability for more than one hour; data compromise from suspected malicious action; compromised physical access | [Regulation (EU) 2024/2690](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402690) |
| Managed service and managed security service (Art. 10) | Same structure as cloud: 30 minutes of complete unavailability; more than one hour of limited availability for over 5% of service users or 1 million; malicious data compromise; data compromise over the same user threshold | [Regulation (EU) 2024/2690](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402690) |

**[INFERENCE]** The 30-minute rule is far tighter than most SaaS service-level agreements: a single 31-minute full outage of a cloud service is a significant incident that starts the 24-hour early-warning clock. For partial outages the company must count affected users quickly (over 5% for over an hour), which needs per-tenant impact data in monitoring, and the count must include customers' end users and not only paying accounts. Any suspected malicious data compromise is reportable with no size threshold, so a single compromised tenant counts.

**[FAST-MOVING, 2026]** Checked on primary source. Concrete points in the Annex of Regulation 2024/2690 (sections 4 to 13 were read): backups stored off the system's network and far enough away to survive a site disaster (4.2.2(c)); regular integrity checks and recovery tests with documented results (4.2.3, 4.2.6); suppliers obliged to report incidents without undue delay and to give audit rights or reports (5.1.4); changes documented and tested before implementation (6.4.2); production separated from development and test, including backups (6.8.2(h)); a plan to migrate to current network protocols and modern email standards (6.7.2); MFA on privileged and administrative accounts (11.3.2(a)) and elsewhere where appropriate (11.7.1); access rights reviewed at planned intervals (11.2.3); unneeded identities deactivated without delay (11.5.4); account lockout and session timeout (11.6.2); key-management activity logged and keys given activation and deactivation dates (9.2); removable media technically restricted by default (12.3.2(a)); awareness training repeated and tested for effectiveness (8.1); and personnel role assignments reviewed at least annually (10.1.3). Apart from that annual review the Annex sets no fixed frequencies ([Regulation (EU) 2024/2690 Annex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402690)). **[GAP]** Annex sections 1 to 3 (policy, risk management, incident handling, including the logging list) were not read.

### Proposed NIS2 changes

**[FAST-MOVING, 20 Jan 2026]** Checked on a Commission page. On 20 January 2026 the Commission proposed targeted NIS2 amendments to simplify compliance, estimated to ease it for 28,700 companies; the page describes it only as a proposal ([European Commission NIS2 page](https://digital-strategy.ec.europa.eu/en/policies/nis2-directive)). **[GAP]** Its legislative status in November 2026 was not found; assume no change to the deadlines above.

### GDPR breach notification and IMY

**[DURABLE]** Checked on the regulator's page. A controller must notify IMY within 72 hours of becoming aware of a personal data breach unless it is unlikely to pose a risk to individuals; every breach must be documented; affected people must be told without undue delay if the risk is high; and a processor must tell its controller without undue delay ([IMY](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/personuppgiftsincidenter/)). **[GAP: unverified background]** GDPR Article 32 (security appropriate to risk, including encryption, pseudonymisation, resilience, restore ability and regular testing), Articles 33 and 34 (breach rules) and Article 83 fines of up to EUR 10 million or 2% for security and breach failures were not re-read ([GDPR on EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

### Digital Omnibus: a proposal that would change breach timing

**[FAST-MOVING, 9 Nov 2026]** Secondary source only. The Council of the EU agreed its negotiating position on the Digital Omnibus on 21 October 2026. The file amends the GDPR, modernises cookie rules, consolidates data-law instruments and adds a single reporting point for cyber and data incidents; the Council replaced the Commission's EU-level single entry point with a national entry point in each Member State plus an EU-level information point ([Insight EU Monitoring, reproducing the Council press release](https://ieu-monitoring.com/editorial/eu-council-agrees-digital-omnibus-position-to-simplify-gdpr-e-privacy-and-cybersecurity-rules/1252877/)). A law-firm summary says the Council backs extending the GDPR breach deadline to 96 hours with notification required only where the breach is likely to result in a high risk, that the European Parliament has not yet adopted its position so trilogue talks have not started, and that EU leaders aim to finish the simplification packages by the end of 2027 ([Lewis Silkin, 9 Nov 2026](https://www.lewissilkin.com/insights/2026/11/09/digital-rulebook-simplification-of-eu-data-protection-and-cyber-rules-102o7e4)).

**[INFERENCE]** Until the Omnibus is adopted and applies, the GDPR deadline remains 72 hours and reports go to IMY and NCSC separately; do not change runbooks yet.

### DORA: contract terms a SaaS vendor will receive from financial customers

**[DURABLE]** DORA has applied since 17 January 2025 to 20 types of financial entities and to ICT third-party providers, with an EU oversight regime for critical third-party providers (checked on an EU authority page: [EIOPA](https://www.eiopa.europa.eu/digital-operational-resilience-act-dora_en)).

**[DURABLE]** Checked on primary source. DORA Article 30(2) requires every ICT contract with a financial entity to include: a full service description and whether subcontracting of critical functions is allowed; the locations where services are provided and data processed, with advance notice of changes; data-protection provisions covering availability, authenticity, integrity and confidentiality; access to, recovery and return of data in an accessible format on insolvency, discontinuation or termination; service levels; incident assistance at no extra cost or a pre-agreed cost; cooperation with the customer's regulators; termination rights and minimum notice periods; and terms for taking part in the customer's security awareness and resilience training ([Regulation (EU) 2022/2554 Art. 30](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022R2554)).

**[DURABLE]** Checked on primary source. Where the service supports a critical or important function, DORA Article 30(3) adds: precise quantitative and qualitative service-level targets; notice periods and reporting duties, including notice of developments that could materially affect delivery; tested business-continuity plans and security measures; participation in the customer's threat-led penetration testing; unrestricted access, inspection and audit rights for the customer, its appointed third party and the regulator; and exit strategies with a mandatory transition period. Under Article 28(7) the customer must be able to terminate on significant breach of law or contract, on circumstances found in monitoring that could alter performance, on evidenced weaknesses in the provider's ICT risk management, or where the regulator can no longer supervise effectively; under Article 28(8) exit plans must be documented, tested and reviewed ([Regulation (EU) 2022/2554](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022R2554)).

**[GAP: unverified background]** Not verified: that financial entities report major incidents on a cycle of 4 hours after classification (at most 24 hours after awareness), 72 hours and one month, and therefore push shorter notice periods onto vendors; and the list of designated critical ICT providers. The Article 19 text read only refers to deadlines set under Article 20.

**[INFERENCE]** A DORA contract checklist for the company as a vendor: publish data locations and sub-processors with a change-notice process; offer a data-export and return clause; offer incident-assistance terms; hold audit evidence ready (an ISO 27001 certificate, a SOC 2 Type 2 report) as the alternative assurance the article permits when on-site audits would affect other customers; and document an exit and transition plan. These overlap almost fully with the Data Act switching duties below.

### Cyber Resilience Act: products, not pure SaaS

**[FAST-MOVING, 11 Sep 2026]** Checked on Commission pages. The Cyber Resilience Act entered into force on 10 December 2024; its reporting duties apply from 11 September 2026 and its main obligations from 11 December 2027; the Commission published implementation guidance on 27 July 2026. Manufacturers must report actively exploited vulnerabilities and severe incidents through ENISA's Single Reporting Platform: an early warning in 24 hours, a notification in 72 hours, and a final report 14 days after a fix is available for vulnerabilities or one month for incidents ([European Commission CRA page](https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act); [European Commission CRA reporting](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting)).

**[GAP: unverified background]** The researchers' understanding, not re-read: pure SaaS is generally outside the CRA and covered by NIS2 instead, but downloadable software, agents, SDKs, mobile and desktop apps, hardware and the "remote data processing" a product depends on are in scope ([Regulation (EU) 2024/2847](https://eur-lex.europa.eu/eli/reg/2024/2847/oj)). Confirm scope with Legal for anything the company ships to customers' devices.

### EU Data Act: cloud-switching duties

**[FAST-MOVING, 12 Jan 2027]** Checked on primary source. The Data Act has applied since 12 September 2025 ([European Commission Data Act page](https://digital-strategy.ec.europa.eu/en/policies/data-act)). Article 25 requires switching rights in a written contract: a maximum notice period of two months; the switch completed within a mandatory maximum transitional period of 30 calendar days; if that is technically unfeasible the provider must say so within 14 working days and the alternative may not exceed seven months; data retrieval for at least 30 days afterwards; then full erasure. Under Article 29 no switching charges, including egress for switching, may be imposed from 12 January 2027, and until then only reduced cost-based charges ([Regulation (EU) 2023/2854](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202302854)).

**[DURABLE]** Checked on primary source. Under Data Act Articles 26, 28 and 30 providers must publish switching procedures and data formats, publish the jurisdiction of their infrastructure and their measures against foreign government access, give open interfaces free of charge (non-IaaS) or support functional equivalence (IaaS), and export data in a structured machine-readable format; Article 32 restricts handing non-personal data to third-country authorities ([Regulation (EU) 2023/2854](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202302854)).

**[INFERENCE]** Data Act duties apply to the SaaS company as a provider of a data processing service toward its own customers, as well as giving it rights against AWS. Contracts, an export function and an exit procedure need to exist before 12 January 2027.

### Transfers to the United States

**[FAST-MOVING, Jun 2026]** Secondary source only. The EU General Court dismissed the Latombe challenge to the EU-US Data Privacy Framework on 3 September 2025; Latombe appealed to the Court of Justice on 31 October 2025 and the framework stays valid meanwhile; the law firm's advice is to keep mapping US data flows and keep standard contractual clauses ready as a fallback ([WilmerHale, 1 Dec 2025](https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20251201-european-court-of-justice-to-review-challenge-to-eu-us-data-privacy-framework)). The appeal is Case C-703/25 P; Microsoft formally intervened in support of the Commission (reported 28 June 2026); no hearing date, Advocate General opinion or judgment is reported, and the Court's register was not checked ([Insight EU Monitoring, 28 Jun 2026](https://ieu-monitoring.com/editorial/microsoft-backs-eu-commission-in-eu-court-case-on-transatlantic-data-flows-and-privacy/1244467/)). Treat the framework as valid but under appeal and re-check.

### One incident can start four clocks

**[INFERENCE]** A single incident can start four sets of deadlines, summarised below. The runbook should start every clock at "awareness" and record the timestamp. An agent must never file or withhold a regulatory notification on its own: it prepares the draft, the timeline and the evidence and pages the accountable human immediately, because the 24-hour early warning is short and the legal judgement belongs to a named person.

| Regime | Recipient | Deadlines | Verification status |
|---|---|---|---|
| Cybersäkerhetslagen (NIS2) | NCSC / CERT-SE via Cyberportalen | 24 hours early warning; 72 hours notification; final report within one month | Checked on primary source ([SFS 2025:1506](https://data.riksdagen.se/dokument/sfs-2025-1506.text)) |
| GDPR | IMY | 72 hours unless risk to individuals is unlikely | Checked on regulator page ([IMY](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/personuppgiftsincidenter/)) |
| Cyber Resilience Act (only if a shipped product is involved; from 11 Sep 2026) | ENISA Single Reporting Platform | 24 hours; 72 hours; 14 days after a fix (vulnerabilities) or one month (incidents) | Checked on Commission page ([CRA reporting](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting)) |
| Customer contracts, including DORA-bound customers | Each customer | Per contract; DORA-bound customers often demand 24 hours or less | Inference; DORA incident deadlines unverified |

### Gaps in this section

**[GAP]** Not verified: MCFFS 2026:1 registration details, any first-registration deadline and registration fee amounts; PTS's own guidance for digital-sector entities; whether Säkerhetsskyddslagen (2018:585) applies to any security-sensitive activity; the exact wording of Article 7(b) and (d) of Regulation 2024/2690 ("users in the Union" versus "service users"); the Council's Digital Omnibus mandate text; and the EU AI Act's obligations for deployers of agents, which were outside the research scope.
