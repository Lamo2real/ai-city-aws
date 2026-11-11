---
id: data.privacy.privacy-engineering-and-data-act
department: data
domain: privacy
title: 'Data and AI: Privacy engineering'
summary: 'Privacy engineering: pseudonymised data is still personal data, the three anonymisation tests, web scraping for generative AI, GDPR consequences for pipeline design, the EU Data Act duties of a SaaS data processing service, data residency and the AWS European Sovereign Cloud. Orientation, not legal advice.'
type: policy
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- aws
- iceberg
objectives:
- compliance
- governance
sources:
- https://edpb.europa.eu/news/news/2025/edpb-adopts-pseudonymisation-guidelines-and-paves-way-improve-cooperation_en
- https://www.edpb.europa.eu/news/edpb-sheds-light-on-anonymisation-and-web-scraping-for-generative-ai-and-adopts-final-version_en
- https://privacymatters.dlapiper.com/2026/08/eu-edpb-publishes-draft-guidelines-on-anonymisation/
- https://www.scl.org/cracking-the-anonymisation-test-early-lessons-following-edps-v-srb/
- https://digital-strategy.ec.europa.eu/en/policies/data-act
- https://www.lw.com/en/insights/2025/08/EU-Data-Act-Significant-New-Switching-Requirements-Due-to-Take-Effect-for-Data-Processing-Services
- https://www.cooley.com/news/insight/2025/2025-09-08-paas-iaas-or-saas-be-aware-new-switching-rules-will-become-applicable-in-eu
- https://digital-strategy.ec.europa.eu/en/factpages/data-act-explained
- https://sota.io/blog/eu-data-act-september-2026-data-by-design-deadline-saas-iot-developer-guide
- https://press.aboutamazon.com/2026/1/aws-launches-aws-european-sovereign-cloud-and-announces-expansion-across-europe
cross_refs:
  '16':
  - data.ai-law.ai-governance-and-law
related:
- data.ai-law.ai-governance-and-law
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before any pipeline, dataset, model or feature touches personal data, before calling data anonymous, and for Data Act switching and export duties. Orientation for a human to confirm, not legal advice.

**Source section:** 6. Privacy engineering: pseudonymous is still personal, and SaaS is a Data Act service

**[FAST-MOVING, 11 November 2026]** The privacy and Data Act points in this section are orientation as of 11 November 2026 and not legal advice. Each paragraph states whether it was checked on a primary source, rests on a secondary source, or is unverified.

### Pseudonymised data remains personal data

**[FAST-MOVING, 17 January 2025]** Legal point, checked on primary source (EDPB news release). The EDPB's Guidelines 01/2025 on pseudonymisation, adopted for consultation on 17 January 2025 with consultation to 28 February 2025, state that data which can be attributed to a person using additional information remains personal data, and that the additional information must be kept separately under technical and organisational measures. The stated benefits are lower risk, easier reliance on legitimate interests under Article 6(1)(f), support for purpose compatibility under Article 6(4), and help in meeting the Article 5 principles, Article 25 data protection by design and Article 32 security ([EDPB news release, 17 Jan 2025](https://edpb.europa.eu/news/news/2025/edpb-adopts-pseudonymisation-guidelines-and-paves-way-improve-cooperation_en)).

**[GAP]** Legal point, unverified. Whether the EDPB pseudonymisation guidelines have been adopted in final form is unconfirmed. The "final version" adopted at the EDPB's July 2026 plenary was the blockchain guidelines (Guidelines 02/2025), not the pseudonymisation guidelines, and the EDPB guidelines index could not be opened; as far as the research can show, the pseudonymisation guidelines remain the January 2025 consultation version ([EDPB news, 8 Jul 2026](https://www.edpb.europa.eu/news/edpb-sheds-light-on-anonymisation-and-web-scraping-for-generative-ai-and-adopts-final-version_en)).

### Anonymisation: three tests, judged per entity

**[FAST-MOVING, July 2026]** Legal point, checked on primary source (EDPB news release, partly by machine extraction). At its July 2026 plenary the EDPB adopted draft guidelines on anonymisation, with public consultation open until 30 October 2026. Data is anonymous if it does not relate to an identified or identifiable person, and that status can differ by entity. The draft sets three tests: no record isolation, no linkage and no inference; if all are met the data can be treated as anonymous, otherwise further analysis is required. A "contextual" approach reflects the full legal standard and a "simplified" approach is more conservative. The draft takes account of the CJEU judgment in case C-413/23 P, EDPS v SRB, of 4 September 2025 ([EDPB news, 8 Jul 2026](https://www.edpb.europa.eu/news/edpb-sheds-light-on-anonymisation-and-web-scraping-for-generative-ai-and-adopts-final-version_en)). The text is a consultation draft and may change.

**[CONTESTED] [FAST-MOVING, July to August 2026]** Legal point, minor date conflict between a primary and a secondary source. DLA Piper gives the adoption date of the draft anonymisation guidelines as 7 July 2026 and the EDPB page is dated 8 July 2026; plenaries span two days, so treat the date as 7 to 8 July 2026 ([DLA Piper, Aug 2026](https://privacymatters.dlapiper.com/2026/08/eu-edpb-publishes-draft-guidelines-on-anonymisation/); [EDPB news, 8 Jul 2026](https://www.edpb.europa.eu/news/edpb-sheds-light-on-anonymisation-and-web-scraping-for-generative-ai-and-adopts-final-version_en)).

**[FAST-MOVING, August 2026]** Legal point, secondary source only (law firm). DLA Piper reports that the draft is numbered Guidelines 02/2026 and that its inference test covers statistical outputs, AI models and synthetic data. The practical steps it draws out are to start with the simplified approach and then go contextual; to assess against the state of the art (dimensionality, resolution, auxiliary data, compute); to anticipate AI lowering the cost of re-identification; to reassess periodically; to document evidence; and to remember that the anonymisation step is itself processing that needs a legal basis. For a processor, data stays personal when judged from the controller's perspective ([DLA Piper, Aug 2026](https://privacymatters.dlapiper.com/2026/08/eu-edpb-publishes-draft-guidelines-on-anonymisation/)).

**[FAST-MOVING, post-September 2025]** Legal point, secondary source only (UK-oriented commentary). Commentary on practice after EDPS v SRB advises assessing re-identification from the viewpoint of the recipient and of unintended third parties; says anonymisation normally needs technical plus organisational and contractual controls with insignificant residual risk; warns that removing direct identifiers and generalising a few indirect ones may not suffice, especially for free text such as chatbot prompts; and notes that segmentation inside one organisation is not automatically sufficient ([Society for Computers and Law](https://www.scl.org/cracking-the-anonymisation-test-early-lessons-following-edps-v-srb/)).

**[INFERENCE]** Aggregates or model outputs given to another party can be anonymous for the recipient under the SRB logic, but a SaaS company that holds the key must still treat the source as personal data. Product analytics on customers' end users is typically processing as a processor, where data stays personal. Agent outputs derived from personal data are not automatically anonymous, because the draft's inference test explicitly covers AI models and synthetic data ([DLA Piper, Aug 2026](https://privacymatters.dlapiper.com/2026/08/eu-edpb-publishes-draft-guidelines-on-anonymisation/)).

### Web scraping for generative AI

**[FAST-MOVING, July 2026]** Legal point, checked on primary source by machine extraction (EDPB news). The EDPB's draft web-scraping guidelines, in consultation until 30 October 2026, say GDPR applies when scraping involves personal data; ask for attention to purpose limitation and transparency (individual notice may be dispensed with where impossible or disproportionate); advise scraping reliable sources, recording timestamps and validating data before training; require data minimisation; allow legitimate interest with clarifications that build on Opinion 28/2024; and keep special-category data prohibited in principle with no general exemption, referring to CJEU case C-136/17 for incidental collection under safeguards ([EDPB news, 8 Jul 2026](https://www.edpb.europa.eu/news/edpb-sheds-light-on-anonymisation-and-web-scraping-for-generative-ai-and-adopts-final-version_en)).

### Pipeline design consequences of GDPR

**[INFERENCE]** Pipeline design consequences drawn by the researchers from the EDPB material: keep the re-identification key or lookup in a separate account or schema with separate access roles, because hashed emails or internal user IDs in the warehouse are pseudonymous and not anonymous; carry a `purpose` and `legal_basis` tag per dataset so that purpose limitation can be enforced by access policy; and minimise at ingestion, dropping or tokenising columns nobody has a purpose for, instead of in gold ([EDPB news release, 17 Jan 2025](https://edpb.europa.eu/news/news/2025/edpb-adopts-pseudonymisation-guidelines-and-paves-way-improve-cooperation_en)).

**[INFERENCE]** Erasure must reach bronze, Iceberg snapshots and time travel, backups, vector indexes and derived ML features. Design a delete-by-subject-key job plus snapshot expiry; Iceberg v3 deletion vectors make row deletes cheaper, but physical removal still needs compaction and snapshot expiry. Treat graph and vector stores as derived, rebuildable serving indexes fed from the lakehouse, which keeps one source of truth and makes erasure tractable (delete at source, then re-index or delete by key).

**[GAP]** Legal point, unverified. GDPR article text (Article 5 principles, Article 17 erasure, Articles 25, 30 and 32, and Chapter V transfers) was not re-read on EUR-Lex; the article references in this section come from the EDPB release only. Verify at https://eur-lex.europa.eu/eli/reg/2016/679/oj. The 2026 status of Standard Contractual Clauses and the EU-US Data Privacy Framework was not researched.

### EU Data Act: SaaS is a data processing service with switching duties

**[FAST-MOVING, November 2026]** Legal point, checked on primary source (European Commission policy page). The Data Act, Regulation (EU) 2023/2854, entered into force on 11 January 2024 and has applied since 12 September 2025. It sets a framework for switching between data processing services, and the Commission has published a draft Recommendation with non-binding model contractual terms and standard contractual clauses for cloud contracts; final adoption was not indicated on the page ([European Commission, Data Act policy page](https://digital-strategy.ec.europa.eu/en/policies/data-act)).

**[FAST-MOVING, August 2025]** Legal point, secondary source only (law firm). Latham & Watkins states that SaaS is in scope of the Data Act as a data processing service alongside IaaS and PaaS, and that providers outside the EU are covered when serving EU customers. Customers may start switching on at most two months' notice; switching must complete within at most 30 days after the notice period, extendable only if technically unfeasible; and contracts must specify portable data and digital assets and provide reasonable assistance ([Latham & Watkins, Aug 2025](https://www.lw.com/en/insights/2025/08/EU-Data-Act-Significant-New-Switching-Requirements-Due-to-Take-Effect-for-Data-Processing-Services)).

**[FAST-MOVING, August 2025]** Legal point, secondary source only (law firm). On Data Act switching charges, Latham & Watkins states that since 11 January 2024 only cost pass-through is allowed and that charges are prohibited entirely from 12 January 2027. Penalties are set nationally: France up to 3% of global turnover and 5% for repeat breaches, and a German draft up to 4% or EUR 5 million ([Latham & Watkins, Aug 2025](https://www.lw.com/en/insights/2025/08/EU-Data-Act-Significant-New-Switching-Requirements-Due-to-Take-Effect-for-Data-Processing-Services)).

**[FAST-MOVING, 8 September 2025]** Legal point, secondary source only (law firm). Cooley describes exportable data under the Data Act as input and output data, including metadata generated by the customer's use, and excluding provider intellectual property and internals that would reveal trade secrets. Providers should map data categories to decide what is exportable and offer open documented APIs and structured, commonly used, machine-readable export formats. Exemptions cover services custom-built for one customer and time-limited non-production test services, which must be disclosed up front. Providers must also apply technical, organisational and contractual measures against unlawful non-EU government access to non-personal data ([Cooley, 8 Sep 2025](https://www.cooley.com/news/insight/2025/2025-09-08-paas-iaas-or-saas-be-aware-new-switching-rules-will-become-applicable-in-eu)).

**[FAST-MOVING, November 2026]** Legal point, checked on primary source by machine extraction, lower confidence because the extraction prompt named the dates. The Commission's "Data Act explained" page gives these milestones: application since 12 September 2025; Article 3(1) design obligations from 12 September 2026; switching charges including egress fully removed from 12 January 2027; and Chapter IV unfair-terms rules reaching older contracts from 12 September 2027. The chapters for cloud and SaaS providers are VI (switching) and VIII (interoperability); Chapter VII covers unlawful third-country government access; and Chapter IX covers enforcement, with Member States designating competent authorities and a "data coordinator" where there is more than one ([European Commission, Data Act explained](https://digital-strategy.ec.europa.eu/en/factpages/data-act-explained)). Re-check the dates against the regulation's Article 50 on EUR-Lex.

**[FAST-MOVING, 2026]** Legal point, secondary source only (low-authority blog). One commentary says Data Act Chapter II (Article 3 access by design, Articles 4 to 6 sharing) targets connected products and related services, so pure SaaS is caught by Chapter II only if it processes connected-product data, but is caught by Chapter VI (Articles 23 to 31) as a cloud service ([sota.io](https://sota.io/blog/eu-data-act-september-2026-data-by-design-deadline-saas-iot-developer-guide)).

**[INFERENCE]** Data Act readiness for a Sweden-based SaaS company means a documented self-service export of all customer input and output data and metadata in machine-readable form; contract terms for the two-month notice and 30-day transition; no exit or egress fee from 12 January 2027; and a data-category map that marks what is excluded as trade secret ([Latham & Watkins, Aug 2025](https://www.lw.com/en/insights/2025/08/EU-Data-Act-Significant-New-Switching-Requirements-Due-to-Take-Effect-for-Data-Processing-Services); [Cooley, 8 Sep 2025](https://www.cooley.com/news/insight/2025/2025-09-08-paas-iaas-or-saas-be-aware-new-switching-rules-will-become-applicable-in-eu)). **[GAP]** The Swedish Data Act enforcement authority and Swedish penalty levels were not researched.

### Data residency and the AWS European Sovereign Cloud

**[VENDOR] [FAST-MOVING, January 2026]** AWS announced in January 2026 that the AWS European Sovereign Cloud is generally available with its first Region in Brandenburg, Germany. AWS describes it as physically and logically separate from other AWS Regions, operated only by EU residents, with no critical non-EU dependencies and with its own IAM, billing and metering so that customer-created metadata (roles, permissions, labels, configurations) stays in the EU. It launched with more than 90 services, and sovereign Local Zones are planned for Belgium, the Netherlands and Portugal ([Amazon press release, Jan 2026](https://press.aboutamazon.com/2026/1/aws-launches-aws-european-sovereign-cloud-and-announces-expansion-across-europe)).

**[INFERENCE]** Running in eu-north-1 (Stockholm) with EU-only replication satisfies location requirements but not "sovereignty" concerns about non-EU provider control; the European Sovereign Cloud addresses the latter at the cost of a separate partition and a smaller service list. As far as the sources reviewed show, no regulator requires it for ordinary commercial SaaS.

### Gaps in the privacy evidence

**[GAP]** Legal points, unverified. The status of the Commission's Digital Omnibus changes to the definition of personal data and to the Data Act is covered only through the secondary sources in section 16. No Swedish-specific privacy source was retrieved (IMY general guidance, the Swedish complementary data protection law). The Data Act article number for international access to non-personal data (believed to be Article 32) was not confirmed.
