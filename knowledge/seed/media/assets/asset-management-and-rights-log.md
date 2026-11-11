---
id: media.assets.asset-management-and-rights-log
department: media
domain: assets
title: 'Media: Asset management and the rights log'
summary: 'Asset management and the rights log: the honest status of the section, two Swedish record-keeping duties, vendor terms that
  forbid stripping provenance metadata, a proposed file-naming pattern, proposed rights-log fields, the winners register and expiry
  monitoring.'
type: playbook
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- compliance
sources:
- http://www.iptc.org/std/photometadata/documentation/userguide/
- https://www.imy.se/verksamhet/dataskydd/vi-guidar-dig/publicera-bilder-filmer-och-ljud-pa-internet/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/
- https://lumalabs.ai/legal/tos
- https://rosetta.to/u/alexhormozi/1-2m-followers-in-6-months-my-content-marketing-strategy-revealed
- https://clipflow-ig-analysis.pages.dev/hormozi/
related:
- media.compliance.disclosure-and-labelling
seed_version: 1
cross_refs:
  '17':
  - media.compliance.disclosure-and-labelling
---

**When to use this:** When naming, storing or archiving an asset, filling the rights log, updating the winners register or monitoring licence and consent expiry.

**Source section:** 11. Asset management and the rights log

### The honest status of this section

**[GAP]** No source on asset management was read. File-naming conventions, folder schemes, DAM selection, archive formats, retention periods and IPTC or XMP rights metadata are unsourced. The IPTC Photo Metadata user guide returned only a redirect ([IPTC Photo Metadata user guide, unread](http://www.iptc.org/std/photometadata/documentation/userguide/)). The following is unverified background recall: the IPTC standard has Creator, Credit Line, Copyright Notice, Web Statement of Rights, Licensor, model and property release status, an accessibility Alt Text field, and a Digital Source Type field with values such as "trainedAlgorithmicMedia" for fully AI-generated media. Suggested sources are the IPTC standard and the Library of Congress recommended formats.

### Two record-keeping duties in Swedish sources

**[DURABLE]** Checked on primary sources: a company relying on legitimate interest to publish images of identifiable people must document the balancing of interests, according to the Swedish data protection authority IMY ([IMY, publishing images, film and audio, last updated 14 Apr 2021](https://www.imy.se/verksamhet/dataskydd/vi-guidar-dig/publicera-bilder-filmer-och-ljud-pa-internet/)); and an operator that invokes an exemption under the Swedish accessibility act must document the assessment with reasons, keep it and notify the supervisory authority ([Riksdagen, Lag (2023:254), read 11 Nov 2026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/)). **[INFERENCE]** The rights log should therefore hold, or link to, both kinds of document.

### Vendor terms can forbid stripping provenance metadata

**[PLATFORM CLAIM] [FAST-MOVING, 14 May 2026]** Luma's terms forbid removing or altering watermarks, content credentials or provenance metadata that Luma adds ([Luma Terms of Service, updated 14 May 2026](https://lumalabs.ai/legal/tos)). **[INFERENCE]** Export presets must not strip metadata from AI output where the vendor's terms prohibit removal, and section 17 explains why keeping provenance metadata also supports disclosure compliance.

### A proposed file-naming pattern

**[INFERENCE]** A workable naming pattern is `YYYYMMDD_project_asset-type_platform_aspect_language_vNN.ext`. This is the researchers' proposal and not a sourced standard.

### Proposed rights-log fields

**[INFERENCE]** The rights log holds one entry per asset and per component. The fields below merge the two research passes' proposals; none is a sourced standard.

| Field group | Contents (inference) |
|---|---|
| Identity | Asset ID, project, date, responsible agent, named human approver, final file hash, storage location of source files and provenance manifest |
| Type and origin | Filmed, stock, user-generated, AI-generated, AI-modified or mixed; source recording ID |
| Creator and credit | Creator and credit line, reflecting the naming right in 3 § of the Swedish Copyright Act |
| AI components | Tool, model and version, plan tier, generation date, full prompt, seed, reference and input files and their rights, terms-of-service version and date, whether a vendor indemnity applies |
| Licensed components | Licensor, licence type and ID, permitted media, territory and term, expiry date, restrictions such as editorial only or no AI use |
| People | Consent or release ID, scope, expiry, withdrawal contact; legal basis (consent or legitimate interest) and where the documentation sits; objection or withdrawal status; property releases |
| Music | Composition and master licences, track ID, platform allowances |
| Human contribution | Notes and evidence of human creative choices, for the copyright position |
| Disclosure decision | Article 50 category (none, deepfake, artistic limb, standard editing), label text or icon used, platform toggles set, advertising marker |
| Quality and provenance | QC checklist result, similarity checks, whether provenance metadata was kept |
| Performance | Link to performance data |

### The winners register

**[HOUSE STYLE; primary transcript] [FAST-MOVING, Aug 2022]** Hormozi recommends a master spreadsheet of top-performing content plus the questions heard on sales calls, as raw material for future content and ads ([Hormozi, "1.2M Followers in 6 Months", auto-transcript, 2 Aug 2022](https://rosetta.to/u/alexhormozi/1-2m-followers-in-6-months-my-content-marketing-strategy-revealed)). A vendor account says his team saves winning hooks as reusable templates ([Clipflow, undated, covers to Apr 2026](https://clipflow-ig-analysis.pages.dev/hormozi/)). **[INFERENCE]** Store a winners register (hook text, format, platform, metric, date) alongside the asset store so that repurposing and ad teams can query it.

### Expiry monitoring

**[INFERENCE]** The manager agent monitors expiry dates: unpublish or re-license assets when a licence or consent ends, and act quickly on consent withdrawals. **[GAP]** Retention periods for provenance and consent records under Swedish law were not researched, and GDPR handling of stored footage of identifiable people beyond IMY's publishing guidance was not researched.
