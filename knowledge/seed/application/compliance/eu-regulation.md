---
id: application.compliance.eu-regulation
department: application
domain: compliance
title: 'Application: EU regulation binding a software maker: four instruments and three near-term dates'
summary: 'EU regulation binding a software maker: the Cyber Resilience Act (dates, Annex I, Article 13 duties, the Article
  14 reporting clock, penalties, the SaaS boundary and the July 2026 guidance), the Product Liability Directive, the Data
  Act switching duties (charges end 12 January 2027), GDPR DPIAs, WCAG 2.2 and EN 301 549, and what was not researched. Orientation
  as of 11 November 2026, not legal advice.'
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
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402853
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202302854
- https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act
- https://cms.law/en/cze/legal-updates/ready-respond-report-the-cyber-resilience-act-s-reporting-regime-is-here
- https://www.cyberresilienceact.eu/news/commission-cra-application-guidance-published-27-july-2026.html
- https://www.osborneclarke.com/insights/european-commission-publishes-new-guidelines-cyber-resilience-act
- https://ec.europa.eu/newsroom/dae/redirection/document/131456
- https://hlc.com/en/publications/eu-cyber-resilience-act-getting-ready-for-cra-compliance-in-2026
- https://www.goodwinlaw.com/en/insights/publications/2026/09/alerts-lifesciences-technology-preparing-for-eu-cyber-resilience-act
- https://digital-strategy.ec.europa.eu/en/policies/data-act
- https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/konsekvensbedomning/
- https://www.w3.org/WAI/standards-guidelines/wcag/
related:
- application.compliance.sweden
seed_version: 1
cross_refs:
  '12':
  - application.compliance.sweden
---

**When to use this:** When a product, feature or incident may fall under EU law. Orientation for a human to confirm with Legal, never a final legal answer.

**Source section:** 11. EU regulation binding a software maker: four instruments and three near-term dates

### Orientation and the dates that matter in late 2026

**[FAST-MOVING, Nov 2026; legal orientation, not professional advice]** Three dates dominate late 2026 for a software maker selling in the EU. Cyber Resilience Act reporting duties have applied since 11 September 2026, with the full regulation applying from 11 December 2027 ([Regulation (EU) 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847)). The new Product Liability Directive applies to products placed on the market or put into service after 9 December 2026 ([Directive (EU) 2024/2853](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402853)). Data Act switching charges are prohibited from 12 January 2027 ([Regulation (EU) 2023/2854](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202302854)). All three dates were checked on the primary EUR-Lex texts. Everything in this section and the next is orientation for engineering agents; scope decisions belong to the Legal department or outside counsel.

### Cyber Resilience Act: application dates and legacy products

**[FAST-MOVING, Nov 2026; checked on primary source]** Regulation (EU) 2024/2847, the Cyber Resilience Act, entered into force on 10 December 2024; its notified-body chapter applies from 11 June 2026, Article 14 reporting from 11 September 2026 and everything else from 11 December 2027 (Article 71) ([EUR-Lex 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847); [Commission CRA page](https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act)). Under Article 69, products placed on the market before 11 December 2027 fall under the full requirements only if substantially modified after that date, but Article 14 reporting applies to all in-scope products placed before 11 December 2027 ([EUR-Lex 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847)). **[CONTESTED; secondary source]** One law-firm note phrases the legacy reporting scope as products on the market before 11 September 2026; the regulation text is the authority ([CMS](https://cms.law/en/cze/legal-updates/ready-respond-report-the-cyber-resilience-act-s-reporting-regime-is-here)).

### Cyber Resilience Act: secure-by-default properties (Annex I Part I)

**[FAST-MOVING, applies from 11 Dec 2027; checked on primary source]** For in-scope products the Cyber Resilience Act turns several secure-default properties into legal requirements under Annex I Part I: no known exploitable vulnerabilities at release, secure-by-default configuration, access control, encryption of data at rest and in transit, integrity protection, data minimisation, a minimal attack surface, security logging and secure data removal ([Regulation (EU) 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847)).

### Cyber Resilience Act: vulnerability handling (Annex I Part II)

**[FAST-MOVING, applies from 11 Dec 2027; checked on primary source]** Annex I Part II of the Cyber Resilience Act requires manufacturers of in-scope products to keep an SBOM, remediate vulnerabilities without delay, ship security updates separately from feature updates where feasible, test and review product security effectively and regularly, publish advisories for fixed vulnerabilities, run a coordinated vulnerability disclosure policy with a contact address, and distribute updates securely and free of charge ([Regulation (EU) 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847)).

### Cyber Resilience Act: manufacturer duties and retention (Article 13)

**[FAST-MOVING, applies from 11 Dec 2027; checked on primary source]** Article 13 of the Cyber Resilience Act requires a documented cybersecurity risk assessment kept current through the support period, due diligence on third-party components, a support period matching expected use and at least 5 years unless the product's expected life is shorter, each security update kept available for at least 10 years or the rest of the support period, and technical documentation and the EU declaration of conformity kept for 10 years or the support period, whichever is longer ([EUR-Lex 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847)).

### Cyber Resilience Act: the reporting clock (Article 14), in force now

**[FAST-MOVING, applies since 11 Sep 2026; checked on primary source]** Article 14 of the Cyber Resilience Act requires an early warning within 24 hours of becoming aware of an actively exploited vulnerability or a severe incident, a fuller notification within 72 hours, and a final report 14 days after a fix or mitigation is available for an exploited vulnerability or one month after the 72-hour notification for an incident ([EUR-Lex 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847)). **[FAST-MOVING, 2026; secondary source only]** Reports go through ENISA's Single Reporting Platform to the coordinating CSIRT and ENISA, and a law firm noted the platform was not yet accessible when it wrote ([CMS](https://cms.law/en/cze/legal-updates/ready-respond-report-the-cyber-resilience-act-s-reporting-regime-is-here)). **[GAP]** The platform's operational status in November 2026 and Sweden's designated authorities for the Cyber Resilience Act were not verified.

### Cyber Resilience Act: penalties (Article 64)

**[FAST-MOVING; checked on primary source]** Article 64 of the Cyber Resilience Act sets fines of up to EUR 15 million or 2.5% of worldwide turnover for breaches of Annex I, Article 13 or Article 14, EUR 10 million or 2% for other listed duties, and EUR 5 million or 1% for misleading information; micro and small enterprises cannot be fined for missing the 24-hour early-warning deadline ([EUR-Lex 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847)).

### Cyber Resilience Act: the SaaS boundary in the regulation text

**[FAST-MOVING; checked on primary source]** Under Article 3(2) of the Cyber Resilience Act, remote data processing is in scope only when the manufacturer designed it or it sits under the manufacturer's responsibility and the product could not perform one of its functions without it. Recital 12 says websites that do not support a product's functionality and cloud services outside the manufacturer's responsibility are out of scope, and that NIS2 is the instrument for cloud models such as SaaS, PaaS and IaaS. Article 3(30) defines a substantial modification as a post-market change that affects compliance with Annex I Part I or changes the assessed intended purpose ([EUR-Lex 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402847)).

### Cyber Resilience Act: the Commission's July 2026 guidance

**[FAST-MOVING, Jul 2026; secondary source only]** The Commission adopted application guidance for the Cyber Resilience Act on 27 July 2026 as Communication C(2026) 5252, with an annex built around 67 examples; it is not legally binding ([cyberresilienceact.eu, 27 Jul 2026](https://www.cyberresilienceact.eu/news/commission-cra-application-guidance-published-27-july-2026.html); [Osborne Clarke, 23 Sep 2026](https://www.osborneclarke.com/insights/european-commission-publishes-new-guidelines-cyber-resilience-act)). The Commission's own page confirms that practical guidance and an implementation FAQ exist ([Commission CRA page](https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act)). For cloud and remote processing the guidance applies a three-part test: the processing happens remotely, the product could not perform one of its functions without it, and the software was designed under the manufacturer's responsibility ([Osborne Clarke, 23 Sep 2026](https://www.osborneclarke.com/insights/european-commission-publishes-new-guidelines-cyber-resilience-act)).

**[FAST-MOVING, Sep 2026; secondary source only]** A law-firm reading of the July 2026 guidance adds that a modification is substantial when it changes cybersecurity risk in a way the original risk assessment did not foresee or changes the intended use, after which the product counts as placed on the market again; that the support period is at least five years where expected use reaches that long and shorter or longer otherwise; and that open-source software outside commercial activity is excluded ([Osborne Clarke, 23 Sep 2026](https://www.osborneclarke.com/insights/european-commission-publishes-new-guidelines-cyber-resilience-act)).

### Cyber Resilience Act: does it reach a SaaS company?

**[INFERENCE; legal orientation only]** The scoping test for a SaaS company is to list every artefact a customer installs or runs: desktop or mobile app, browser extension, command-line tool, SDK or library, on-premises agent or connector, container image, or device firmware. Each one supplied commercially in the EU is likely a product with digital elements, and the back end it depends on is remote data processing inside that product's scope. Software offered purely as a hosted service, with nothing placed on the market as a product, is probably outside the Cyber Resilience Act and governed by NIS2 instead, but the researchers could not confirm that from the Commission's own text; treat it as probable and not settled. **[GAP]** The Commission annex with the SaaS, website and remote-processing examples was returned as an unreadable binary and must be opened before a scope decision ([Commission annex](https://ec.europa.eu/newsroom/dae/redirection/document/131456)).

**[INFERENCE]** Because Article 14 reporting already applies to in-scope products including those already on the market, a company with any in-scope product needs four things today: an on-call path that can file within 24 hours, registration for the reporting platform, a decision record for exploited vulnerabilities, and a coordinated vulnerability disclosure policy with a public contact such as a security.txt file.

### Cyber Resilience Act: supporting instruments and preparation lists

**[FAST-MOVING, 2026; secondary source only]** Implementing Regulation (EU) 2025/2392 of 28 November 2025 describes the important and critical product categories, the first harmonised standards were expected in the third quarter of 2026, and vertical drafts exist for browsers, password managers, antivirus, VPNs, network management, SIEM and boot managers ([Hogan Lovells](https://hlc.com/en/publications/eu-cyber-resilience-act-getting-ready-for-cra-compliance-in-2026)). A law firm's action list (11 September 2026) is to inventory products and decide the company's role, build the 24-hour and 72-hour reporting procedure, run risk assessments, set support periods, prepare technical documentation and an SBOM, choose a conformity route and review supplier contracts ([Goodwin, 11 Sep 2026](https://www.goodwinlaw.com/en/insights/publications/2026/09/alerts-lifesciences-technology-preparing-for-eu-cyber-resilience-act)).

### Product Liability Directive: software, including SaaS, is a product

**[FAST-MOVING, applies after 9 Dec 2026; checked on primary source]** Directive (EU) 2024/2853 treats software as a product (Article 4(1)); recital 13 says this holds however software is supplied, including through the cloud or a SaaS model, and that developers, including AI system providers, are manufacturers, while bare information and mere source code are not products. The directive applies to products placed on the market or put into service after 9 December 2026, and Member States must transpose it by that date (Articles 2(1) and 22) ([EUR-Lex 2024/2853](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402853)).

### Product Liability Directive: defect factors, updates and compensable damage

**[FAST-MOVING, applies after 9 Dec 2026; checked on primary source]** Under Directive (EU) 2024/2853, the factors for defectiveness include safety-relevant cybersecurity requirements and the effect of a product's ability to keep learning (Article 7(2)). A manufacturer stays liable for defects caused by software updates, or by the lack of updates needed to maintain safety, while the product is within its control (Article 11(2)). Compensable damage is death or personal injury including medically recognised psychological harm, damage to non-professional property, and destruction or corruption of data not used for professional purposes (Article 6) ([EUR-Lex 2024/2853](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402853)).

### Product Liability Directive: disclosure, presumptions and time limits

**[FAST-MOVING, applies after 9 Dec 2026; checked on primary source]** Under Directive (EU) 2024/2853 courts can order disclosure of evidence (Article 9) and presume defect or causation in listed cases, including non-disclosure, breach of mandatory safety requirements and technical complexity (Article 10). Liability toward the injured person cannot be excluded by contract (Article 15). The limitation period is 3 years, the expiry period 10 years, and 25 years for latent injury (Articles 16 and 17) ([EUR-Lex 2024/2853](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402853)).

**[INFERENCE; legal orientation only]** Product-liability exposure for B2B SaaS is narrower than it first looks, because compensable damage is limited to natural persons' injury, non-professional property and non-professional data. The real exposure sits in consumer-facing features, health or safety-relevant software, and components embedded in customers' consumer products. Since liability to the injured person cannot be contracted away, the department should keep evidence (design records, test results, update history, agent audit logs) able to answer a disclosure order, and should treat a missing security update as something that can itself make the product defective.

### Data Act: SaaS is a data processing service, and switching is a contract and engineering duty

**[FAST-MOVING, applies since 12 Sep 2025; checked on primary source]** Regulation (EU) 2023/2854, the Data Act, expressly names SaaS as a delivery model of a data processing service alongside IaaS and PaaS (Article 2(8) and recital 81) and has applied generally since 12 September 2025 (Article 50) ([EUR-Lex 2023/2854](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202302854); [Commission Data Act page](https://digital-strategy.ec.europa.eu/en/policies/data-act)).

### Data Act: mandatory switching terms (Article 25)

**[FAST-MOVING, applies since 12 Sep 2025; checked on primary source]** Article 25(2) of the Data Act requires contracts to give the customer a right to switch provider or port to on-premises infrastructure, with a notice period of at most 2 months and the transition completed within 30 calendar days (the provider may invoke up to 7 months if that is technically unfeasible, and the customer may extend once). Contracts must also cover assistance, continuity and security during switching, support for the customer's exit strategy, an exhaustive list of portable data categories and digital assets, a data retrieval window of at least 30 days after the transition, guaranteed full erasure afterwards, and a statement of any switching charges ([EUR-Lex 2023/2854](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202302854)).

### Data Act: switching charges end on 12 January 2027

**[FAST-MOVING, deadline 12 Jan 2027; checked on primary source]** Article 29 of the Data Act allows reduced, cost-based switching charges from 11 January 2024 to 12 January 2027 and prohibits switching charges from 12 January 2027 ([EUR-Lex 2023/2854](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202302854)).

### Data Act: technical and information duties for SaaS

**[FAST-MOVING, applies since 12 Sep 2025; checked on primary source]** Under Article 30(2) to (5) of the Data Act, PaaS and SaaS providers must offer open interfaces free of charge to customers and destination providers with enough documentation to build against them, achieve compatibility with common specifications or harmonised standards within 12 months of their publication, and otherwise export all exportable data on request in a structured, commonly used, machine-readable format; IaaS providers instead owe facilitation of functional equivalence (Article 30(1)). Providers must publish switching and porting procedures, methods, formats and known limits and keep an online register of data structures, formats and standards for exportable data (Article 26), and must publish the jurisdiction of their infrastructure and their measures against conflicting third-country government access to non-personal data (Article 28) ([EUR-Lex 2023/2854](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202302854)).

### Data Act: exemptions, penalties and model clauses

**[FAST-MOVING; checked on primary source]** Article 31 of the Data Act exempts mostly custom-built services not offered at broad commercial scale from some duties and exempts non-production test and evaluation versions from the switching chapter; penalties are set nationally (Article 40) ([EUR-Lex 2023/2854](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202302854)). The Commission has published a draft recommendation on non-binding standard contractual clauses for cloud contracts ([Commission Data Act page](https://digital-strategy.ec.europa.eu/en/policies/data-act)). **[GAP]** The Swedish supervisory authority and penalty rules for the Data Act were not researched.

**[INFERENCE]** The Data Act engineering backlog for a SaaS vendor is a documented export API covering all customer-generated data and digital assets in an open format, a public register of data structures and formats, contract clauses matching Article 25 (with Legal), removal of exit and egress fees by 12 January 2027, and a published statement of infrastructure jurisdiction, which for AWS means the region or regions and the access posture of a US parent.

### GDPR: when a data protection impact assessment is needed

**[DURABLE; checked on the Swedish authority's page]** The Swedish data protection authority IMY explains that a data protection impact assessment (konsekvensbedömning) is required under Article 35 only for processing likely to cause high risk to individuals. Its minimum content is a systematic description of the processing and its purposes, an assessment of necessity and proportionality, an assessment of risks to individuals' rights, and the planned mitigations. The controller consults the data protection officer, seeks data subjects' views where appropriate, and requests prior consultation with IMY if high risk remains after mitigation; business risk is outside the scope of the assessment ([IMY konsekvensbedömning](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/konsekvensbedomning/)).

**[INFERENCE; legal orientation only]** An engineering department should open a data protection impact assessment ticket when a feature adds large-scale processing of sensitive data, systematic monitoring, profiling with significant effects, or new AI processing of personal data. Sending customer personal data or production data to an AI coding agent or model provider needs a processor agreement and a transfer assessment. **[GAP]** The EDPB and IMY criteria lists, the Article 25 privacy-by-design text, EDPB Guidelines 4/2019, GDPR breach-notification timing and the transfer status of US sub-processors were not read.

### Accessibility: WCAG 2.2 and EN 301 549

**[FAST-MOVING, Dec 2024]** WCAG 2.2 was published on 5 October 2023, updated on 12 December 2024, and is also ISO/IEC 40500:2025. W3C tells teams to use the latest version; conformance to 2.2 implies conformance to 2.1 and 2.0; and WCAG 3 remains an early draft. W3C states that most organisations pair WCAG with EN 301 549 for the European Accessibility Act and that the 2026 version of EN 301 549 uses WCAG 2.2 ([W3C WAI WCAG overview](https://www.w3.org/WAI/standards-guidelines/wcag/)). The Swedish implementation is in section 12.

### Instruments that were not researched

**[GAP]** The EU AI Act was outside the assigned research scope and is not covered; if the product embeds AI features, its obligations need a separate note. The Digital Omnibus proposal of November 2025, which touches GDPR, the Data Act, cookie rules and incident-reporting consolidation, could not be opened, and its adoption status in November 2026 is unknown; anything it changes in this section must be re-checked.
