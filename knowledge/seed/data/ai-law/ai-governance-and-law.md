---
id: data.ai-law.ai-governance-and-law
department: data
domain: ai-law
title: 'Data and AI: AI governance and law'
summary: 'AI governance and law as of November 2026: the EU AI Act timeline (Article 50 live since 2 August 2026, high-risk moved to 2027 and 2028), Article 50 transparency, general-purpose AI duties, GDPR and AI models, Article 22, the Digital Omnibus, ISO/IEC 42001 and NIST AI RMF, vendor due diligence, and Sweden. Orientation, not legal advice.'
type: policy
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- aws
- bedrock
objectives:
- compliance
sources:
- https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601744
- https://www.whitecase.com/insight-alert/eu-ai-omnibus-enters-force-amending-ai-act
- https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/
- https://regeringen.se/pressmeddelanden/2025/10/utredning-foreslar-forbud-mot-vissa-ai-system-och-sanktioner-for-bristande-dokumentation-av-hogrisk-ai/
- https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations
- https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai
- https://www.edpb.europa.eu/news/news/2024/edpb-opinion-ai-models-gdpr-principles-support-responsible-ai_en
- https://www.edpb.europa.eu/our-work-tools/our-documents/opinion-board-art-64/opinion-282024-certain-data-protection-aspects_en
- https://eur-lex.europa.eu/eli/reg/2016/679/oj
- https://www.addleshawgoddard.com/en/insights/insights-briefings/2026/data-protection/eu-digital-omnibus-european-council-adopts-its-position/
- https://euperspectives.eu/2026/08/after-1840-amendemnts-the-eu-fight-over-data-will-begin/
- https://www.iso.org/standard/42001
- https://www.nist.gov/itl/ai-risk-management-framework
- https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf
- https://aws.amazon.com/bedrock/faqs/
- https://www.imy.se/globalassets/dokument/rapporter/ansvarsroller-enligt-gdpr-vid-finjustering-av-ai-applikationer.pdf
- https://www.fylgia.se/en/news/who-is-responsible-for-personal-data-when-an-ai-model-is-fine-tuned
- https://www.anthropic.com/legal/commercial-terms
- https://openai.com/enterprise-privacy/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/statens-offentliga-utredningar/anpassningar-till-ai-forordningen_hdb3101/html/
- https://opsiocloud.com/sv/knowledge-base/ai-forordningen-tidslinje/
- https://regeringen.se/contentassets/0377f932c1b74404895c0bbdaa5abb08/uppdrag-att-vara-nationella-behoriga-myndigheter-enligt-ai-forordningen.pdf
- https://www.regeringen.se/contentassets/5be33bc7e11e45bf8e56aa7bce900d43/sveriges-advokatsamfund.pdf
- https://www.pts.se/ai
related:
- data.guardrails.agent-guardrails
- data.gaps.consolidated-gaps
seed_version: 1
---

**When to use this:** Before launching or changing any AI feature, classifying it under the AI Act or GDPR, choosing a model supplier, or answering a question about AI law or dates. Orientation for a human to confirm, not legal advice.

**Source section:** 16. AI governance and law: Article 50 is live, high-risk moved to 2027 and 2028, GDPR unchanged

**[FAST-MOVING, 11 November 2026]** The AI governance and law points in this section are orientation as of 11 November 2026 and not legal advice. Each paragraph states its verification status. The AI Act amendment was read on EUR-Lex through machine extraction, so the wording must be re-opened before it is quoted in a legal document.

### EU AI Act timeline as it stands in November 2026

**[FAST-MOVING, November 2026]** Legal point, checked on primary source (European Commission page). The AI Act entered into force on 1 August 2024; prohibited practices and AI literacy applied from 2 February 2025; governance and general-purpose AI (GPAI) model obligations applied from 2 August 2025; and the Act became generally applicable on 2 August 2026, including the transparency rules ([European Commission, AI Act page](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)).

**[FAST-MOVING, 8 July 2026]** Legal point, checked on primary source by machine extraction (EUR-Lex). The amending act is Regulation (EU) 2026/1744 of the European Parliament and of the Council of 8 July 2026, amending Regulations (EU) 2024/1689, (EU) 2018/1139 and (EU) 2023/1230 as regards the simplification of the implementation of harmonised rules on AI (the "Digital Omnibus on AI"). Its document date is 8 July 2026 and it entered into force on 27 July 2026, the third day after publication in the Official Journal ([EUR-Lex, ELI page](https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng); [EUR-Lex, OJ L 2026/1744 text](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601744)). A law firm gives publication in the Official Journal as 24 July 2026 ([White & Case](https://www.whitecase.com/insight-alert/eu-ai-omnibus-enters-force-amending-ai-act)).

**[FAST-MOVING, 8 July 2026]** Legal point, checked on primary source by machine extraction (EUR-Lex). High-risk application dates under the amended AI Act, set by Article 1 point (40)(b) amending Article 113, are 2 December 2027 for systems classed high-risk under Article 6(2) and Annex III and 2 August 2028 for systems classed high-risk under Article 6(1) and Annex I ([EUR-Lex, OJ L 2026/1744 text](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601744)). The Commission's AI Act page gives the same dates ([European Commission, AI Act page](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)).

**[FAST-MOVING, 8 July 2026]** Legal point, checked on primary source by machine extraction (EUR-Lex). Two new AI Act prohibitions, Article 5(1) points (ba) and (bb), apply from 2 December 2026: (ba) covers AI systems that generate or manipulate realistic intimate or sexually explicit images, video or audio of an identifiable person without that person's explicit consent, and (bb) covers AI systems that generate or manipulate child sexual abuse material as defined in Directive 2011/93/EU ([EUR-Lex, OJ L 2026/1744 text](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601744)). Secondary source only: a law firm describes the ban as targeting systems where such output is reasonably foreseeable and adequate safeguards are missing ([Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/)).

**[FAST-MOVING, 8 July 2026]** Legal point, checked on primary source by machine extraction (EUR-Lex). The replaced Article 4 on AI literacy requires providers and deployers to take measures to support the development of AI literacy of staff and others operating AI systems on their behalf, taking account of their knowledge, experience and context of use, and adds that this does not require guaranteeing a specific level of literacy for any individual. The Commission must publish practical compliance examples and the AI Board must adopt recommendations ([EUR-Lex, OJ L 2026/1744 text](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601744)). The literacy duty has applied since 2 February 2025 ([White & Case](https://www.whitecase.com/insight-alert/eu-ai-omnibus-enters-force-amending-ai-act)).

**[FAST-MOVING, 8 July 2026]** Legal point, checked on primary source by machine extraction (EUR-Lex). Changes for SMEs and small mid-caps in the amended AI Act: definitions added as Article 3(14a) and (14b); a simplified technical-documentation form (Article 11(1)); quality management proportionate to size (Article 17(2)); simplified quality-management compliance for all SMEs (Article 63(1)); priority sandbox access (Article 57); penalties that must consider SME and small mid-cap viability (Article 99(1)); and, for small mid-caps, each fine being the lower of the percentage or the fixed amount (Article 99(6a)) ([EUR-Lex, OJ L 2026/1744 text](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601744)). **[INFERENCE]** For a company of small mid-cap size the "whichever is lower" rule materially lowers the fine ceiling; whether a company qualifies depends on the Article 3(14a) and (14b) definitions, which were not read.

**[FAST-MOVING, 2026]** Legal point, secondary source only (law firms). Other Omnibus changes reported by law firms: the legal basis to process special-category data for bias detection and correction was extended to all AI systems and GPAI models under strict necessity and with safeguards; the national sandbox deadline moved to 2 August 2027; the "safety component" definition was narrowed; and machinery was largely moved out of the full high-risk regime ([Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/); [White & Case](https://www.whitecase.com/insight-alert/eu-ai-omnibus-enters-force-amending-ai-act)).

**[CONTESTED] [FAST-MOVING, May 2026]** Legal point, minor date conflict. The political agreement on the AI Omnibus is dated 6 May 2026 by Gibson Dunn and 7 May 2026 by the Commission page, most likely an overnight deal ([Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/); [European Commission, AI Act page](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)).

**[FAST-MOVING, 2026]** Legal point, checked on primary source for the first clause and secondary for the second. The AI Office has held enforcement powers over GPAI models since 2 August 2026 ([European Commission, AI Act page](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)); a law firm reports that the Omnibus also gave it exclusive competence over AI systems built on a GPAI model by the same provider and over AI in very large online platforms and search engines, with inspection and fining powers ([Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/)).

**[FAST-MOVING, 19 October 2026]** Legal point, checked on primary source (European Commission page). The first harmonised standard supporting the AI Act was published in the Official Journal on 19 October 2026; the page does not say which standard ([European Commission, AI Act page](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)). **[GAP]** Which standard it is remains unknown.

**[FAST-MOVING, October 2025]** Legal point, secondary source (a Swedish government press release restating the Act). AI Act fines run up to EUR 35 million or 7% of global turnover for prohibited practices and up to EUR 15 million or 3% for breaches of high-risk rules; supplying misleading information to authorities is also sanctionable ([Regeringen press release, Oct 2025](https://regeringen.se/pressmeddelanden/2025/10/utredning-foreslar-forbud-mot-vissa-ai-system-och-sanktioner-for-bristande-dokumentation-av-hogrisk-ai/)).

### Article 50 transparency, in application since 2 August 2026

**[FAST-MOVING, July 2026]** Legal point, secondary source only (law firm summary of Commission documents). Final Commission Guidelines on Article 50 were published on 20 July 2026, and the Code of Practice on marking and labelling AI-generated content was confirmed adequate in early July 2026 ([Faegre Drinker, Jul 2026](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations)).

**[FAST-MOVING, July 2026]** Legal point, secondary source only (law firm). The Article 50 duties are: under 50(1), providers make it apparent that a person is interacting with AI; under 50(2), providers mark generative output in machine-readable, detectable form; under 50(3), deployers inform people exposed to emotion recognition or biometric categorisation; and under 50(4), deployers disclose deepfakes and AI-generated text on matters of public interest ([Faegre Drinker, Jul 2026](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations)).

**[FAST-MOVING, July 2026]** Legal point, checked on primary source by machine extraction for the deadline, secondary for the rest. A new Article 111(4) requires systems placed on the market before 2 August 2026 to comply with Article 50(2) marking by 2 December 2026 ([EUR-Lex, OJ L 2026/1744 text](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601744)). A law firm adds that newer systems had to comply from 2 August 2026 and that Code signatories need watermark-detection interoperability by 2 February 2027 ([Faegre Drinker, Jul 2026](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations)).

**[FAST-MOVING, July 2026]** Legal point, secondary source only (law firm). On AI agents, the Commission's Article 50 Guidelines say agents fall under 50(1) and must disclose their AI nature and the principal they act for; each agent in a multi-agent system must comply; and perceptible outputs need 50(2) marking while intermediate reasoning and API calls do not ([Faegre Drinker, Jul 2026](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations)).

**[FAST-MOVING, July 2026]** Legal point, secondary source only (law firm). Further Article 50 detail: AI translation falls under the standard-editing exemption; summaries and substantive rewrites need marking; a B2B carve-out covers closed industrial use with safeguards but not public or consumer systems; the Code uses layered marking (signed metadata plus an imperceptible watermark) with simplified rules for free-form text; signing the Code is not a safe harbour; and fines run up to EUR 15 million or 3% of turnover ([Faegre Drinker, Jul 2026](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations)).

### General-purpose AI model duties and the Code of Practice

**[FAST-MOVING, 10 July 2025]** Legal point, checked on primary source (European Commission page). The GPAI Code of Practice was published on 10 July 2025 with Transparency, Copyright and, for systemic-risk models only, Safety and Security chapters. The Commission and the AI Board confirmed it as an adequate voluntary compliance tool; signatories include Amazon, Anthropic, Google, IBM, Microsoft, Mistral AI and OpenAI, and xAI signed only the safety chapter. A Model Documentation Form accompanies the transparency chapter ([European Commission, GPAI Code](https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai)). Commission guidelines on the scope of GPAI provider obligations were published in July 2025, and guidelines on prohibited practices and on the AI system definition are also published ([European Commission, AI Act page](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)).

### GDPR and AI models: EDPB Opinion 28/2024

**[FAST-MOVING, 18 December 2024]** Legal point, checked on primary source by machine extraction (EDPB press release). EDPB Opinion 28/2024 on data protection aspects of AI models, adopted 18 December 2024 at the request of the Irish authority, holds that a model's anonymity is assessed case by case: to be anonymous it must be very unlikely both that individuals whose data trained it can be identified and that their personal data can be extracted through queries ([EDPB press release, 18 Dec 2024](https://www.edpb.europa.eu/news/news/2024/edpb-opinion-ai-models-gdpr-principles-support-responsible-ai_en); [EDPB Opinion 28/2024 page](https://www.edpb.europa.eu/our-work-tools/our-documents/opinion-board-art-64/opinion-282024-certain-data-protection-aspects_en)).

**[FAST-MOVING, 18 December 2024]** Legal point, checked on primary source by machine extraction (EDPB press release). On legitimate interest for AI models, the EDPB applies a three-step test and gives a conversational agent that assists users and AI that improves cybersecurity as examples of potentially valid interests, provided processing is strictly necessary and the balancing of rights holds. Reasonable-expectation criteria include whether data was public, the relationship with the controller, the nature of the service, the collection context and source, potential further uses of the model, and whether people know their data is online; mitigating measures can tip the balance ([EDPB press release, 18 Dec 2024](https://www.edpb.europa.eu/news/news/2024/edpb-opinion-ai-models-gdpr-principles-support-responsible-ai_en)).

**[FAST-MOVING, 18 December 2024]** Legal point, checked on primary source by machine extraction (EDPB press release). A model developed with unlawfully processed personal data may make its deployment unlawful unless the model has been duly anonymised ([EDPB press release, 18 Dec 2024](https://www.edpb.europa.eu/news/news/2024/edpb-opinion-ai-models-gdpr-principles-support-responsible-ai_en)). **[INFERENCE]** This supports asking model suppliers for evidence of training-data lawfulness or model anonymity in due diligence.

### Automated decisions under GDPR Article 22

**[DURABLE]** Legal point, unverified background, not fetched. GDPR Article 22 restricts decisions based solely on automated processing that have legal or similarly significant effects, and the CJEU's SCHUFA ruling (C-634/21, December 2023) treated a credit score that decisively drives a third party's decision as such a decision ([GDPR on EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)). Confirm on the primary texts before relying on it.

### The GDPR part of the Digital Omnibus is not law

**[FAST-MOVING, 21 October 2026]** Legal point, secondary source only (law firm). The Council agreed its negotiating position on the GDPR Omnibus on 21 October 2026: it deleted the Commission's new personal-data definition, added an Article 25a on pseudonymised data, removed the proposed explicit legitimate-interest basis for AI training (adding a recital that AI development is not in itself a legitimate interest), and reinstated the Article 22 right with safeguards. Council and Parliament talks are not expected before March 2027 ([Addleshaw Goddard](https://www.addleshawgoddard.com/en/insights/insights-briefings/2026/data-protection/eu-digital-omnibus-european-council-adopts-its-position/)).

**[FAST-MOVING, 10 August 2026]** Legal point, secondary source only (news). In Parliament the GDPR Omnibus file drew up to 1,840 amendments, a committee vote is targeted before February 2027, and the EDPB and EDPS urged rejection of the personal-data redefinition ([EU Perspectives, 10 Aug 2026](https://euperspectives.eu/2026/08/after-1840-amendemnts-the-eu-fight-over-data-will-begin/)). A law firm confirms that the broader Digital Omnibus changes to GDPR, ePrivacy, NIS2 and the Data Act were not yet law when the AI part entered into force ([White & Case](https://www.whitecase.com/insight-alert/eu-ai-omnibus-enters-force-amending-ai-act)).

**[INFERENCE]** Do not change GDPR practice in anticipation of the Omnibus: the Council has already rejected the AI-training legitimate-interest shortcut and nothing is expected to be agreed before 2027, so GDPR and EDPB Opinion 28/2024 apply unchanged ([Addleshaw Goddard](https://www.addleshawgoddard.com/en/insights/insights-briefings/2026/data-protection/eu-digital-omnibus-european-council-adopts-its-position/)).

### Standards and frameworks: ISO/IEC 42001 and NIST AI RMF

**[DURABLE]** Checked on primary source by machine extraction (ISO catalogue page). ISO/IEC 42001:2023, edition 1, was published in December 2023 and runs to 51 pages. It specifies requirements for establishing, implementing, maintaining and continually improving an AI management system, for organisations of any size that develop, provide or use AI. Related standards listed are ISO/IEC 22989 (concepts), 23053 (ML framework), 23894 (AI risk management), 27001:2022 and ISO/IEC 42005:2025 (AI system impact assessment) ([ISO/IEC 42001](https://www.iso.org/standard/42001)). **[GAP]** The clause structure and annex content (plan-do-check-act, AI risk assessment, impact assessment, Annex A controls, certifiability) are stated from memory only and are unverified.

**[FAST-MOVING, November 2026]** Checked on primary source (NIST page). NIST AI RMF 1.0, released 26 January 2023 and voluntary, is being revised under the White House AI Action Plan with no date given; the Generative AI Profile NIST AI 600-1 was released on 26 July 2024; and a Critical Infrastructure Profile concept note was released on 7 April 2026 ([NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)).

**[DURABLE]** Unverified background, not fetched. The NIST AI RMF's four functions are Govern, Map, Measure and Manage, and NIST AI 600-1 lists 12 generative-AI risk areas including confabulation, data privacy, information security, harmful bias, intellectual property and value-chain and component integration ([NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)).

**[INFERENCE]** ISO/IEC 42001 is the natural management-system wrapper for a company that already holds ISO 27001, with NIST AI RMF plus AI 600-1 as the risk taxonomy inside it. Neither gives a presumption of conformity with the AI Act; harmonised standards published in the Official Journal do, and the first one arrived only on 19 October 2026 ([European Commission, AI Act page](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)).

### Vendor and model due diligence

**[PLATFORM CLAIM] [FAST-MOVING, November 2026]** AWS states that Amazon Bedrock content is not used to improve base models and is not shared with model providers; that content is encrypted and stored at rest in the region used; that PrivateLink and customer-managed keys are available; and that Bedrock is in scope for GDPR-compliant use, SOC, ISO and CSA STAR Level 2 ([AWS Bedrock FAQs](https://aws.amazon.com/bedrock/faqs/)).

**[FAST-MOVING, 10 June 2026]** Legal point, checked on primary source (IMY report). IMY states that a supplier's GDPR role cannot be read off the service type or the contract label and must be assessed per processing activity; that a clause letting the supplier use customer data to train or improve its own models may make it a controller for that processing; and that one generic processor agreement may not cover all activities ([IMY report, 10 Jun 2026](https://www.imy.se/globalassets/dokument/rapporter/ansvarsroller-enligt-gdpr-vid-finjustering-av-ai-applikationer.pdf); practitioner summary at [Fylgia](https://www.fylgia.se/en/news/who-is-responsible-for-personal-data-when-an-ai-model-is-fine-tuned)).

**[GAP]** Unverified background, not fetched. Anthropic's and OpenAI's commercial and API terms are understood to state that customer API data is not used for model training by default, with consumer plans differing; confirm on current terms ([Anthropic commercial terms](https://www.anthropic.com/legal/commercial-terms); [OpenAI enterprise privacy](https://openai.com/enterprise-privacy/)).

**[INFERENCE]** Vendor due-diligence checklist for an AI supplier: training-use default and opt-out wording; retention period and zero-retention option; human access for abuse monitoring; sub-processors and regions (EU processing, cross-region inference routing); a data processing agreement with the supplier's position on SCCs and the Data Privacy Framework; GPAI Code of Practice signatory status and availability of model documentation; security attestations (SOC 2, ISO 27001, ISO 42001); model deprecation policy and notice period; incident notification terms; IP indemnity; and whether each activity is controller or processor, per IMY.

### Sweden: authorities and what is unverified

**[FAST-MOVING, October 2025]** Legal point, checked on primary source (Swedish government press release). The inquiry SOU 2025:101, "Anpassningar till AI-förordningen", proposed PTS as the main market surveillance authority, sandbox host and Sweden's AI Board representative, with IMY and Finansinspektionen sharing responsibility for high-risk AI, and a Swedish act to enter into force on 2 August 2026 ([Regeringen press release, Oct 2025](https://regeringen.se/pressmeddelanden/2025/10/utredning-foreslar-forbud-mot-vissa-ai-system-och-sanktioner-for-bristande-dokumentation-av-hogrisk-ai/); text at [Riksdagen SOU 2025:101](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/statens-offentliga-utredningar/anpassningar-till-ai-forordningen_hdb3101/html/)).

**[FAST-MOVING, 12 October 2026]** Legal point, secondary source only (commercial blog, low authority, not confirmed on a government source). A blog dated 12 October 2026 reports that PTS acts as contact point and market surveillance authority for some prohibited uses and high-risk systems under a temporary government assignment running to 31 December 2026, that IMY covers among other things AI in law enforcement and credit assessment, and that the permanent structure was not finally decided as of October 2026 ([Opsio, 12 Oct 2026](https://opsiocloud.com/sv/knowledge-base/ai-forordningen-tidslinje/)).

**[GAP]** Legal point, unverified; the top open item for a Swedish company. Whether Sweden has adopted a proposition or act designating AI Act authorities, and what applies from 1 January 2027, was not verified. A government document titled "Uppdrag att vara nationella behöriga myndigheter enligt AI-förordningen" exists on regeringen.se but was seen only in a search listing; its date, the authorities named and its duration were not read ([Regeringen PDF](https://regeringen.se/contentassets/0377f932c1b74404895c0bbdaa5abb08/uppdrag-att-vara-nationella-behoriga-myndigheter-enligt-ai-forordningen.pdf)). Consultation responses to SOU 2025:101 from February 2026 are published, for example the Swedish Bar Association's dated 23 February 2026, also seen only in a listing ([Regeringen, remiss response](https://www.regeringen.se/contentassets/5be33bc7e11e45bf8e56aa7bce900d43/sveriges-advokatsamfund.pdf)). Two searches restricted to regeringen.se, riksdagen.se, pts.se and imy.se returned no proposition or adopted act, which is weak evidence and not proof.

**[INFERENCE]** Likely state of play in Sweden, not to be stated as fact: authorities are acting under a government assignment and not under a permanent Swedish act, the permanent law proposed by SOU 2025:101 has not visibly reached the Riksdag, and the question of what applies from 1 January 2027 most likely turns on whether that assignment is extended or replaced. Check regeringen.se, pts.se and imy.se directly.

**[FAST-MOVING, 2025 to 2026]** Checked on primary source (PTS page last updated 29 September 2025) and a practitioner summary. PTS and DIGG are tasked with supporting implementation of Sweden's AI strategy through yearly follow-up and analysis, and PTS describes a growing remit in data, digitalisation and AI ([PTS](https://www.pts.se/ai)). IMY ran a spring 2026 regulatory-sandbox pilot with the Swedish AI company Eggsplain that produced the fine-tuning roles report ([Fylgia](https://www.fylgia.se/en/news/who-is-responsible-for-personal-data-when-an-ai-model-is-fine-tuned)).

### What a Sweden-based SaaS company must do now

**[INFERENCE]** Likely AI Act role mix for a Sweden-based B2B SaaS company on AWS selling in the EU: deployer of GPAI models through an API; provider of its own AI systems and features placed on the EU market; and possibly a downstream provider under Article 50. It is unlikely to be a GPAI model provider unless it releases its own general-purpose model. Classification needs legal review per product.

**[INFERENCE]** Obligations live in November 2026 for such a company, in priority order: confirm no Article 5 prohibited practice, including safeguards against the new points (ba) and (bb) before 2 December 2026 if any image, video or audio generation is offered; meet Article 50 (chatbot and agent disclosure in product, machine-readable marking of generated content by 2 December 2026 for features launched before 2 August 2026, deepfake labelling); keep records of AI literacy measures for staff; run GDPR as usual (lawful basis, DPIA for high-risk processing, Article 22 safeguards, processor terms); and inventory and classify AI use cases against Annex III now so that 2 December 2027 is not a surprise, since employment, education, credit, essential services and biometrics are the usual triggers for SaaS customers ([EUR-Lex, OJ L 2026/1744 text](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601744)).

**[INFERENCE]** Because the high-risk dates moved to December 2027 and August 2028, the near-term Swedish supervisory exposure for a SaaS company is mostly Article 5, Article 50 and Article 4, plus GDPR through IMY.

### Gaps in the governance and law evidence

**[GAP]** Legal points, unverified. The Article 50 Guidelines and Code themselves, AI Act Articles 14, 26, 27 and 73, and whether Commission guidelines on high-risk classification (Article 6) and serious-incident reporting are final were not read. EDPB work after Opinion 28/2024 (for example a Joint Opinion 1/2026 referenced by a law firm) was not read. DIGG's AI guidance for public administration and IMY's general guidance on GDPR and generative AI were not retrieved.
