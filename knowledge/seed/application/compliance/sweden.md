---
id: application.compliance.sweden
department: application
domain: compliance
title: 'Application: Sweden specifics: four statutes an engineering department meets'
summary: 'Sweden specifics: the accessibility act (lag 2023:254) and its scope, exemptions and sanctions, the Cybersäkerhetslag
  (2025:1506) NIS2 law (who is covered, duties, incident clock, sanctions, 2026 regulations), the product liability bill proposing
  1 January 2027 and working-time rules for on-call. Orientation, not legal advice.'
type: policy
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- compliance
sources:
- https://lagen.nu/2023:254
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/
- https://data.riksdagen.se/dokument/sfs-2025-1506.html
- https://www.legal500.com/intelligence/sweden/privacy/cybersäkerhetslagen-senaste-nytt-efter-sommaren
- https://data.riksdagen.se/dokument/sfs-2025-1507.html
- https://www.transportstyrelsen.se/sv/om-oss/det-har-ar-transportstyrelsen/krisberedskap-och-sakerhet/cybersakerhet-nis2/aktuellt-inom-nis/nu-trader-cybersakerhetslagen-i-kraft/
- https://www.regeringen.se/rattsliga-dokument/proposition/2026/10/prop.-20262712
- https://data.riksdagen.se/dokument/sfs-1982-673.html
related:
- application.maintenance.maintenance-and-operations
seed_version: 1
cross_refs:
  '7':
  - application.maintenance.maintenance-and-operations
---

**When to use this:** When the work touches Swedish accessibility, NIS2, product liability or on-call working time. Orientation for a human to confirm.

**Source section:** 12. Sweden specifics: four statutes an engineering department meets

### Swedish accessibility act: lag (2023:254)

**[FAST-MOVING, in force 28 June 2025; checked on primary source]** Sweden implements the European Accessibility Act, Directive (EU) 2019/882, through lag (2023:254) om vissa produkters och tjänsters tillgänglighet, in force since 28 June 2025 ([SFS 2023:254 on lagen.nu](https://lagen.nu/2023:254)). The Riksdag text notes a latest amendment, SFS 2026:1026, with a revised definitions section applying from 20 November 2026 ([Riksdagen SFS 2023:254](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/)).

### Swedish accessibility act: which services and products are covered

**[FAST-MOVING; checked on primary source]** Under 4 § of lag (2023:254) the covered services are electronic communications services, services giving access to audiovisual media, parts of passenger transport services, consumer banking services, e-books and e-commerce services, and they are covered when intended for consumers. An e-commerce service (2 §) is one provided at a distance through websites and mobile services, electronically, at a consumer's individual request, with a view to concluding a consumer contract ([SFS 2023:254, 2 § and 4 §](https://lagen.nu/2023:254)). Covered products include consumer computers and operating systems, payment and self-service terminals and e-readers ([Riksdagen SFS 2023:254](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/)).

### Swedish accessibility act: exemptions, transition and sanctions

**[FAST-MOVING; checked on primary source]** Under lag (2023:254), services provided by microenterprises need not meet the requirements (10 §), where a microenterprise has fewer than ten employees and annual turnover or balance sheet total of at most EUR 2 million (2 §). A requirement does not apply if it would fundamentally alter the service or impose a disproportionate burden (7 §), unless the operator received external funding to improve accessibility. Service contracts concluded before 28 June 2025 may run until expiry but no later than 27 June 2030, and pre-recorded media and document formats published before entry into force, and unedited archive content, are excluded. The government designates the supervisory and market-surveillance authorities (28 § and 30 §), and the sanction fee ranges from SEK 10,000 to SEK 10,000,000 (39 §), with none in minor cases ([SFS 2023:254](https://lagen.nu/2023:254); [Riksdagen SFS 2023:254](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/)). **[GAP]** The designation sits in förordning (2023:255), which failed to load; search-result titles point to Post- och telestyrelsen for services, which is unconfirmed.

**[INFERENCE; legal confirmation advised]** A B2B-only SaaS with no consumer contracts falls outside lag (2023:254) on the statute's wording, because covered services must be intended for consumers and e-commerce means concluding a consumer contract. A SaaS company is still affected when it sells to consumers, or when its customers (web shops, banks, e-book or transport providers) must comply and pass WCAG-level requirements down by contract. Target WCAG 2.2 AA through EN 301 549 in any case, because public-sector and enterprise buyers ask for it; run automated accessibility checks such as axe-core in the pipeline and test manually with keyboard and screen reader before release. That automated tools catch only a minority of WCAG failures is a durable principle that was not sourced in this research.

### Swedish NIS2 law: Cybersäkerhetslag (2025:1506), who is covered

**[FAST-MOVING, in force 15 Jan 2026; checked on primary source]** Sweden's Cybersäkerhetslag (2025:1506) entered into force on 15 January 2026. Its general rule (1 kap. 4 §) covers operators at or above medium-sized-enterprise size in a sector listed in NIS2 Annex I or II, and some operators are covered regardless of size (1 kap. 5 §), for example sole providers of an essential service and trust service providers. Under 1 kap. 7 § it covers operators with their main establishment in Sweden that offer cloud computing services, data centre services, content delivery networks, managed services, managed security services, online marketplaces, search engines, social networking platforms, DNS or domain registration services ([SFS 2025:1506](https://data.riksdagen.se/dokument/sfs-2025-1506.html)).

### Swedish NIS2 law: duties and incident clock

**[FAST-MOVING, in force 15 Jan 2026; checked on primary source]** Under Cybersäkerhetslag (2025:1506) a covered operator must notify the designated authority that it is in scope as soon as possible and report changes within 14 days (2 kap. 2 §), and its management must undergo security training (2 kap. 4 §). For a significant incident it must give early notification within 24 hours of becoming aware (2 kap. 5 §), an incident report within 72 hours (24 hours for trust service providers) (2 kap. 6 §), and a final report within one month of the incident report (2 kap. 8 §) ([SFS 2025:1506, 2 kap.](https://data.riksdagen.se/dokument/sfs-2025-1506.html)). **[FAST-MOVING, 2026; secondary source only]** A law-firm commentary reads the implementing regulation as starting the clock when the incident is identified as significant and advises keeping timestamps for awareness, severity assessment and reasoning, and planning for out-of-hours reporting and a portal-down fallback ([Legal 500 Sweden](https://www.legal500.com/intelligence/sweden/privacy/cybersäkerhetslagen-senaste-nytt-efter-sommaren)).

### Swedish NIS2 law: sanctions and supervisor

**[FAST-MOVING, in force 15 Jan 2026; checked on primary source]** The sanction ceiling under Cybersäkerhetslag (2025:1506), 4 kap. 10 §, is the higher of 2% of worldwide annual turnover or the SEK equivalent of EUR 10 million for essential private operators, the higher of 1.4% or EUR 7 million for important private operators, and SEK 10 million for public operators; a management ban is possible for essential operators (4 kap. 6 §) ([SFS 2025:1506, 4 kap.](https://data.riksdagen.se/dokument/sfs-2025-1506.html)). Under Cybersäkerhetsförordning (2025:1507), Post- och telestyrelsen supervises digital infrastructure, ICT service management and digital providers, and Försvarets radioanstalt is the CSIRT and single point of contact to which incidents are reported ([SFS 2025:1507](https://data.riksdagen.se/dokument/sfs-2025-1507.html)).

### Swedish NIS2 law: implementing regulations issued in 2026

**[FAST-MOVING, 2026; secondary source only]** A law-firm commentary lists implementing regulations issued by Myndigheten för civilt försvar: MCFFS 2026:1 on notification and identification of entities from 2 February 2026, MCFFS 2026:8 on incident reporting from 1 July 2026, and MCFFS 2026:11 on documented management training and MCFFS 2026:12 on security audits and scans from 1 October 2026. It adds that the agency's cyber functions moved on 1 July 2026 to the National Cybersecurity Centre within Försvarets radioanstalt, with the issued regulations keeping their numbers, and that sector-specific criteria and information duties in those regulations do not apply to digital infrastructure, digital providers and B2B ICT service management, which face the management-training requirement from that set; the commentary itself should be read cautiously ([Legal 500 Sweden](https://www.legal500.com/intelligence/sweden/privacy/cybersäkerhetslagen-senaste-nytt-efter-sommaren)). The entry-into-force date is corroborated by an agency notice ([Transportstyrelsen](https://www.transportstyrelsen.se/sv/om-oss/det-har-ar-transportstyrelsen/krisberedskap-och-sakerhet/cybersakerhet-nis2/aktuellt-inom-nis/nu-trader-cybersakerhetslagen-i-kraft/)).

**[INFERENCE; legal orientation only]** A SaaS company headquartered in Sweden is likely in scope of the Cybersäkerhetslag as a cloud computing service provider once it reaches medium size. Two links in that chain were not verified: that SaaS counts as a cloud computing service under the act's definition (the Cyber Resilience Act's recital says NIS2 applies to cloud models such as SaaS, which supports it), and the medium-size threshold (unverified recollection: 50 or more staff, or more than EUR 10 million in turnover and balance sheet, per Commission Recommendation 2003/361). If in scope, the company registers with the supervisor, trains management, and must be able to notify within 24 hours and report within 72. **[GAP]** The exact size-test wording, the essential-or-important classification for cloud providers, and the registration procedure and deadline were not verified.

### Swedish product liability: a bill proposing 1 January 2027

**[FAST-MOVING, Oct 2026; checked on the government's page, bill text not read]** The Swedish government submitted Prop. 2026/27:12, "En ny produktansvarslag", on 15 October 2026; the government's page states that the proposal covers standalone software and proposes entry into force on 1 January 2027 ([Regeringen, Prop. 2026/27:12](https://www.regeringen.se/rattsliga-dokument/proposition/2026/10/prop.-20262712)). **[INFERENCE]** On that proposal Sweden would transpose about three weeks after the directive's 9 December 2026 deadline. **[GAP]** Whether the Riksdag has adopted the bill, how it treats products placed on the market between the two dates, and its rules on AI systems, digital services, evidence disclosure and presumptions were not verified.

### Swedish working-time rules for on-call

**[DURABLE; checked on primary source]** The Swedish Working Hours Act limits that shape developer on-call rotations (11 hours of daily rest, 36 hours of weekly rest that standby does not satisfy, and overtime caps) are set out in section 7 of this document from Arbetstidslag (1982:673) ([SFS 1982:673](https://data.riksdagen.se/dokument/sfs-1982-673.html)).
