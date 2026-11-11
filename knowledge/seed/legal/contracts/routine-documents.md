---
id: legal.contracts.routine-documents
department: legal
domain: contracts
title: 'Legal: Routine documents: NDAs, DPAs, reseller and partner agreements, consultancy, terms of use, open source'
summary: 'Routine documents: NDAs and the Trade Secrets Act; DPAs and the mandatory GDPR Article 28(3) processor-contract
  content; reseller, agent and partner agreements under the Commercial Agents Act and the EU vertical block exemption; consultancy
  agreements and the contractor-versus-employee screen; terms of use and acceptable-use policies under the DSA hosting duties;
  B2B unfair terms; open-source licences (AGPL, copyleft). Orientation as of 11 November 2026, not legal advice.'
type: policy
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- sweden
- eu
objectives:
- contracts
- privacy
sources:
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/
- https://techsverige.se/om-oss-2/var-verksamhet/standardavtal/kort-beskrivning-av-alla-vara-standardavtal/
- https://eur-lex.europa.eu/eli/reg/2016/679/oj
- https://www.edpb.europa.eu/system/files/2024-10/edpb_opinion_202422_relianceonprocessors-sub-processors_en.pdf
- https://www.edpb.europa.eu/system/files/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf
- https://rkrattsbaser.gov.se/sfst?bet=1991:351
- https://eur-lex.europa.eu/eli/reg/2022/720/oj
- https://lagen.nu/1960:729
- https://lagen.nu/1976:580
- https://rkrattsbaser.gov.se/sfst?bet=1999:1229
- https://www.lu.se/publikation/4239269
- https://eur-lex.europa.eu/eli/reg/2022/2065/oj
- https://rkrattsbaser.gov.se/sfst?bet=1984:292
- https://www.gnu.org/licenses/agpl-3.0.txt
- https://www.apache.org/licenses/LICENSE-2.0.txt
- https://boundlesshq.com/blog/best-eor-sweden/
seed_version: 1
cross_refs:
  '1':
  - legal.orientation.orientation-and-regime-map
  '2':
  - legal.contracts.saas-and-commercial-contracts
  '6':
  - legal.corporate.corporate-law
  '10':
  - legal.privacy.privacy-gdpr-imy
  '13':
  - legal.marketing-sector.marketing-regulation-and-sector-add-ons
---

**When to use this:** When handling an NDA, a DPA (data processing agreement), a reseller, agent or partner agreement, a consultancy agreement, terms of use or an open-source licence.

**Source section:** 4. Routine documents: NDAs, DPAs, reseller and partner agreements, consultancy, terms of use, open source

### NDAs: what the Trade Secrets Act protects without a contract

**[DURABLE]** Under section 2 of the Swedish Trade Secrets Act, lag (2018:558), a trade secret is information on business or operating conditions that is not generally known or readily accessible, that the holder has taken reasonable measures to keep secret, and whose disclosure is likely to cause competitive harm. Experience and skills gained in normal work, and information about crimes or serious misconduct, are not trade secrets. Status: checked on primary source ([Lag (2018:558)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/)).

**[DURABLE]** Business partners who received a secret in confidence in connection with a business relationship are liable in damages for an intentional or negligent attack on it under section 6 of lag (2018:558), independently of any NDA. Remedies include an injunction under penalty of a fine (12 §), an interim injunction on probable cause (14 §) and delivery-up or destruction (17 §); damages claims reach back five years only, and injunction actions must be brought within five years of knowledge (24 §). Status: checked on primary source ([Lag (2018:558)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018558-om-foretagshemligheter_sfs-2018-558/)).

**[INFERENCE]** NDA drafting implications from the Trade Secrets Act: define and mark confidential information and record access controls, because reasonable secrecy measures are a condition of statutory protection; do not attempt to restrict whistleblowing or reporting of crimes or serious misconduct, since such information is outside the definition; and include a contractual confidentiality term and liquidated damages, because statutory damages require proof of loss and the look-back is five years.

**[FAST-MOVING, Nov 2026]** TechSverige publishes a standard Sekretessavtal (NDA) and GDPR processor terms tailored to cloud, infrastructure and other IT services, each with a processing-specification annex to be completed at signing. Status: existence checked on TechSverige's own page; the content is subscription-only and was not read ([TechSverige standard agreements](https://techsverige.se/om-oss-2/var-verksamhet/standardavtal/kort-beskrivning-av-alla-vara-standardavtal/)).

### DPAs: the mandatory Article 28(3) content

**[DURABLE]** GDPR Article 28(3) requires a binding contract between controller and processor that sets out the subject matter, duration, nature and purpose of the processing, the type of personal data, the categories of data subjects and the controller's obligations and rights. Under Article 28(1) and (2) a controller may use only processors offering sufficient guarantees, and a processor may not engage a sub-processor without prior specific or general written authorisation; under a general authorisation the processor must inform the controller of intended changes so that the controller can object. Status: checked on primary source ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

**[DURABLE]** The table below sets out the eight processor obligations that GDPR Article 28(3)(a) to (h) requires every data processing agreement to contain; agents reviewing a DPA check each row is present and not diluted. Status: all rows checked on primary source.

| Art. 28(3) point | What the contract must require of the processor | Verification | Source |
|---|---|---|---|
| (a) | Process only on documented instructions, including for third-country transfers, unless law requires otherwise, in which case it informs the controller first unless that law prohibits it | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| (b) | Ensure authorised persons are bound by confidentiality | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| (c) | Take all Article 32 security measures | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| (d) | Respect the sub-processor conditions | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| (e) | Assist the controller with data-subject requests through appropriate technical and organisational measures, as far as possible | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| (f) | Assist with the controller's duties under Articles 32 to 36 (security, breach notification, DPIA, prior consultation) | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| (g) | At the controller's choice, delete or return all personal data at the end of the services and delete copies unless law requires storage | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |
| (h) | Make available all information needed to demonstrate compliance, allow and contribute to audits and inspections, and tell the controller immediately if it considers an instruction unlawful | Checked on primary source | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) |

**[DURABLE]** GDPR Article 28(4) requires the same data-protection obligations to be imposed on any sub-processor by contract. Status: checked on primary source ([Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).

**[DURABLE]** The EDPB flags a common drafting defect in processor contracts: wording that allows processing outside instructions whenever required by law or by a binding order of a governmental body, without limiting the exception to EU or Member State law as Article 28(3)(a) does. Status: checked on the EDPB's own opinion ([EDPB Opinion 22/2024](https://www.edpb.europa.eu/system/files/2024-10/edpb_opinion_202422_relianceonprocessors-sub-processors_en.pdf)).

**[DURABLE]** EDPB Guidelines 07/2020 walk through each Article 28(3) element, including documented instructions, confidentiality commitments of personnel, assistance with the Articles 32 to 36 obligations and the modalities of audits and inspections, remote and on-site. Status: checked on the EDPB's own guidelines ([EDPB Guidelines 07/2020](https://www.edpb.europa.eu/system/files/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf)).

**[INFERENCE]** DPA review checklist: the Article 28(3)(a) to (h) items, plus sub-processor authorisation mechanics under Article 28(2) and (4), the transfer mechanism, breach-notification timing, and deletion or return on exit aligned with the main agreement's wind-down clause. From IMY's 2026 Miljödata decision (section 10), add two concrete items to the security annex: change control for new software and real-time intrusion monitoring.

### Reseller, agent and partner agreements: the Commercial Agents Act

**[DURABLE]** Under section 1 of lag (1991:351) om handelsagentur, a commercial agent is someone who, in business, has agreed with a principal to act independently and continuously to promote the sale or purchase of goods by taking offers or concluding contracts in the principal's name. The Act is default law except where it says a rule cannot be set aside (2 §). Status: checked on primary source ([Lag (1991:351)](https://rkrattsbaser.gov.se/sfst?bet=1991:351)).

**[DURABLE]** Mandatory protections in the Commercial Agents Act include minimum notice of one month in the first year, rising by one month per started year to six months, with no shorter notice agreed in advance (24 §); a fixed-term agreement that continues becomes indefinite (25 §); termination with immediate effect only for material breach or other important reason (26 §); and a termination indemnity where the agent brought new customers or substantially increased business and the principal continues to benefit, capped at one year's remuneration averaged over the last five years (28 §) and lost in the cases listed in 29 §. Status: checked on primary source ([Lag (1991:351)](https://rkrattsbaser.gov.se/sfst?bet=1991:351)).

**[INFERENCE] [CONTESTED]** The Commercial Agents Act is written for the sale or purchase of goods. Whether a referral or sales partner for SaaS subscriptions is covered directly or only by analogy is not settled by the text. The cautious drafting approach is to assume the notice and indemnity rules may be applied by analogy and to structure partners as resellers buying and reselling in their own name where the indemnity is unwanted; a human lawyer confirms the structure.

### Reseller agreements: the EU vertical block exemption

**[DURABLE]** The EU vertical block exemption, Regulation (EU) 2022/720, applies only where supplier and buyer each hold no more than 30% of their relevant markets (Article 3). Hardcore restrictions that remove the exemption include restricting the buyer's ability to set its resale price, although maximum or recommended prices remain possible if they do not amount to fixed or minimum prices, and territorial or customer restrictions beyond the listed exceptions, for example restricting an exclusive distributor's active sales into territories reserved for the supplier or allocated exclusively to up to five other distributors (Article 4). Status: checked on primary source ([Regulation (EU) 2022/720](https://eur-lex.europa.eu/eli/reg/2022/720/oj)).

**[DURABLE]** Excluded obligations under Article 5 of Regulation (EU) 2022/720 include non-compete obligations that are indefinite or longer than five years, and post-termination non-competes. The regulation expires on 31 May 2034. Status: checked on primary source ([Regulation (EU) 2022/720](https://eur-lex.europa.eu/eli/reg/2022/720/oj)).

**[INFERENCE]** Reseller agreements should avoid fixed or minimum resale prices and broad territorial bans on passive sales; recommended price lists and exclusive territories with only active-sales restrictions fit within the block exemption below the 30% share threshold. Any resale-price, exclusivity or most-favoured-customer clause goes to a human lawyer.

### Consultancy agreements and the contractor-versus-employee screen

**[DURABLE]** Swedish copyright defaults make a written assignment essential in every consultancy agreement: unless agreed otherwise, a transferee may not alter the work or transfer the rights onward (Upphovsrättslagen 28 §); the author has a right to fair remuneration and to an adjustment if pay proves disproportionately low (29 §); there is an annual reporting duty to authors (29 a §); and the author may terminate an unexploited exclusive grant on six months' notice (29 d §). Status: checked on lagen.nu, not the official publication ([Upphovsrättslagen, lagen.nu](https://lagen.nu/1960:729)).

**[DURABLE]** Under section 38 of the Co-determination Act (MBL), an employer bound by a collective agreement must negotiate with the union before deciding to let a non-employee, such as a consultant, perform work in its business. Status: checked on lagen.nu ([Medbestämmandelagen, lagen.nu](https://lagen.nu/1976:580)).

**[DURABLE]** On the tax side, business income requires activity carried on professionally and independently, and in judging a contractor's independence particular weight goes to what was agreed with the principal, how dependent the contractor is on the principal, and how far the contractor is integrated into the principal's business (Inkomstskattelagen 13 kap. 1 §). Status: checked on primary source ([Inkomstskattelag (1999:1229)](https://rkrattsbaser.gov.se/sfst?bet=1999:1229)).

**[INFERENCE] [CONTESTED]** The three factors in the tax rule (agreement, dependence, integration) are a workable first screen for consultant engagements. Labour-law classification is a separate overall assessment in which F-tax status is not decisive, and it can differ from the tax outcome; that description rests on a secondary record only, and neither the criteria nor the Labour Court case law was retrieved ([Lund University publication record](https://www.lu.se/publikation/4239269)).

**[INFERENCE]** Consultancy template essentials for Sweden: an express written assignment of all intellectual property including the right to modify and to assign onward (to displace Upphovsrättslagen 28 §), a waiver or undertaking on moral rights to the extent permitted, confidentiality, confirmation of F-tax status, and a check of whether a union negotiation under MBL 38 § is triggered.

### Terms of use and acceptable use policies: the DSA hosting duties

**[DURABLE]** Under Article 6 of the Digital Services Act, a provider storing information for a user is not liable for it if it has no actual knowledge of illegal content (and, for damages, no awareness of facts making it apparent), or acts expeditiously to remove or disable access once it knows; the exemption does not apply where the user acts under the provider's authority or control. Status: checked on primary source ([Regulation (EU) 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)).

**[DURABLE]** DSA Article 14 requires providers of intermediary services to state in their terms any restrictions on user-provided information, including content-moderation policies, procedures, measures and tools (algorithmic decision-making and human review) and the internal complaint-handling rules, in clear and user-friendly language and in a publicly available, machine-readable format; significant changes must be notified, and restrictions must be applied diligently, objectively and proportionately. Points of contact for authorities and for users are required under Articles 11 and 12. Status: checked on primary source ([Regulation (EU) 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)).

**[DURABLE]** DSA Article 16 requires hosting providers to offer an electronic notice mechanism for alleged illegal content, and Article 17 requires a clear and specific statement of reasons to affected users when the provider removes or demotes content, suspends payments, or suspends or terminates the service or account because content is illegal or breaches the terms. The additional online-platform section does not apply to micro and small enterprises (Article 19). Status: checked on primary source ([Regulation (EU) 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)).

**[INFERENCE]** A B2B SaaS product that stores customer content is a hosting service under the DSA, so the terms of use and acceptable use policy should describe prohibited content, moderation and suspension procedures, and the company needs a notice channel and a statement-of-reasons template for suspensions. Whether it is also an online platform depends on public dissemination of user content, which most B2B SaaS tools do not do.

**[DURABLE]** Licence or terms-of-use clauses that ban reverse engineering must carve out the non-waivable rights of lawful software users: copies and changes needed for intended use including error correction, one back-up, and observing, studying and testing (Upphovsrättslagen 26 g §), and decompilation for interoperability under strict conditions (26 h §). Contrary contract terms are void. Status: checked on lagen.nu ([Upphovsrättslagen, lagen.nu](https://lagen.nu/1960:729)).

### B2B unfair terms

**[DURABLE]** Under lag (1984:292) om avtalsvillkor mellan näringsidkare, a court may prohibit a trader from continuing to impose an unfair term on another trader (1 §); particular regard is given to the need to protect a party in a weaker position, and a prohibition requires a public interest (2 §); only trade associations or an affected trader may apply (3 §). Status: checked on primary source ([SFS 1984:292](https://rkrattsbaser.gov.se/sfst?bet=1984:292)).

### Open-source licences: the two clauses verified

**[DURABLE]** Section 13 of the GNU Affero General Public License version 3 provides that if you modify the program, the modified version must prominently offer all users who interact with it remotely over a computer network an opportunity to receive the corresponding source from a network server at no charge. The section also permits combining AGPL code with GPLv3 code, each part staying under its own licence. Status: checked on the licence text ([GNU AGPL v3](https://www.gnu.org/licenses/agpl-3.0.txt)).

**[DURABLE]** Section 4 of the Apache License 2.0 requires anyone redistributing the work, modified or not, in source or object form, to give recipients a copy of the licence, mark modified files with prominent change notices, retain copyright, patent, trademark and attribution notices in source form, and reproduce the attribution notices of any NOTICE file. Status: checked on the licence text ([Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt)).

**[INFERENCE]** Permissive licences (MIT, BSD, Apache-2.0) mainly require preserving notices and licence text when distributing, while GPL-family copyleft requires offering corresponding source for the covered work and derivatives when distributing. Pure SaaS use usually does not distribute GPL code, which is why the AGPL adds the network-interaction trigger. Only the AGPL and Apache clauses above were verified; the MIT, BSD, GPL and LGPL texts were not opened.

**[INFERENCE]** Practical open-source rule for a SaaS product: AGPL components that the company modifies and exposes to users over a network trigger a source-offer duty for the modified version; using an unmodified AGPL service behind an API is a narrower question that needs case-by-case review by a human. Licence obligations still bite on anything shipped to customers, such as on-premises agents, SDKs, mobile apps and front-end JavaScript.

### Gaps in the routine-documents research

**[GAP]** Nothing was retrieved on Swedish shareholder agreements and fundraising documents (drag-along, tag-along, vesting, leaver terms, pre-emption, convertible instruments, model documents), or on employer-of-record arrangements (lag (2012:854) om uthyrning av arbetstagare, permanent-establishment risk, social security); only vendor marketing was found on employer of record, including one vendor's unverified statement that Sweden has no licensing regime for it ([Boundless](https://boundlesshq.com/blog/best-eor-sweden/)). Also not read: lag (1914:45) om kommission, distributor case law on reasonable notice, the TechSverige NDA and processor-terms content, SBOM practice and Cyber Resilience Act duties for open-source components. Agents must not fill these from memory.
