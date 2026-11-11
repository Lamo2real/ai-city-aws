---
id: media.guardrails.agent-guardrails
department: media
domain: guardrails
title: 'Media: Guardrails for the department''s AI agents'
summary: 'Guardrails for the department''s AI agents: what they rest on, the three tiers (what agents may do alone, what needs a named
  human''s approval, what needs a second approver such as paid media and assets with people, what agents must never do), the process
  around the tiers and what the guardrails do not cover.'
type: checklist
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- compliance
sources:
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1978800-om-namn-och-bild-i-reklam_sfs-1978-800/
- https://openai.com/policies/service-terms/
- https://elevenlabs.io/terms-of-use
- https://cms.law/en/swe/legal-updates/ai-in-advertising-key-aspects-for-advertisers-in-sweden
- https://digital-strategy.ec.europa.eu/en/policies/eu-icons-labelling-ai-generated-content
- https://www.shumaker.com/?p=17623
- https://www.paulweiss.com/insights/client-memos/eu-finalises-transparency-rules-for-ai-generated-content
- https://www.konsumentverket.se/marknadsratt-foretag/dold-marknadsforing-i-sociala-medier-regler-for-foretag/
related:
- media.specs.platform-specs-and-safe-zones
- media.audio.loudness-and-audio-standards
- media.compliance.disclosure-and-labelling
- media.compliance.copyright-ai-output-and-vendor-terms
- media.compliance.licensing-non-ai-assets
- media.compliance.likeness-and-voice
- media.compliance.trade-marks-products-and-locations
- media.compliance.swedish-media-law
seed_version: 1
cross_refs:
  '7':
  - media.specs.platform-specs-and-safe-zones
  '8':
  - media.audio.loudness-and-audio-standards
  '17':
  - media.compliance.disclosure-and-labelling
  '18':
  - media.compliance.copyright-ai-output-and-vendor-terms
  '19':
  - media.compliance.licensing-non-ai-assets
  '20':
  - media.compliance.likeness-and-voice
  '21':
  - media.compliance.trade-marks-products-and-locations
  '22':
  - media.compliance.swedish-media-law
---

**When to use this:** Before any action that could need approval or is forbidden: publishing or scheduling, real people or cloned voices, AI elements and disclosure, licensed material, paid media, new tools, claims.

**Source section:** 23. Guardrails for the department's AI agents

### What the guardrails rest on

**[INFERENCE]** No published standard for AI rights logs or agent guardrails was found. The rules in this section are the researchers' synthesis from the sources in sections 17 to 22. The sourced anchors are few and consistent: consent is a legal requirement for names and pictures in Swedish marketing (checked on a primary source; [Riksdagen, Lag (1978:800) om namn och bild i reklam](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1978800-om-namn-och-bild-i-reklam_sfs-1978-800/)); vendors require express consent and all necessary rights for likeness and voice ([OpenAI Service Terms, updated 16 Oct 2026](https://openai.com/policies/service-terms/); [ElevenLabs Terms, updated 9 Oct 2026](https://elevenlabs.io/terms-of-use)); the advertiser stays responsible for the accuracy of AI output (secondary source only; [CMS Sweden, 28 May 2026](https://cms.law/en/swe/legal-updates/ai-in-advertising-key-aspects-for-advertisers-in-sweden)); indemnities fall away where safety features were bypassed, output was known to be likely infringing, or output was modified or combined ([OpenAI Service Terms, updated 16 Oct 2026](https://openai.com/policies/service-terms/)); and labels must be present at first exposure and survive resharing ([European Commission, EU icons page, updated 13 Oct 2026](https://digital-strategy.ec.europa.eu/en/policies/eu-icons-labelling-ai-generated-content)).

**[FAST-MOVING, 2026]** Secondary sources only: a Swedish law firm recommends that advertisers have governance and review before publishing, an internal ban on others' trade marks and protected works in prompts, manual output review, staff AI literacy under AI Act Article 4 (applicable since 2 February 2025) and GDPR checks ([CMS Sweden, 28 May 2026](https://cms.law/en/swe/legal-updates/ai-in-advertising-key-aspects-for-advertisers-in-sweden)). A US law firm's litigation commentary recommends a written AI policy with approved use cases, review of vendor IP terms, indemnity and risk allocation in contracts, and records of legal review and vendor diligence ([Shumaker, 1 Jul 2026](https://www.shumaker.com/?p=17623)). The Code of Practice, as summarised, expects deployers to have proportionate internal processes, awareness measures and feedback mechanisms ([Paul Weiss](https://www.paulweiss.com/insights/client-memos/eu-finalises-transparency-rules-for-ai-generated-content)).

### The three tiers of authority

**[INFERENCE]** The table sets out what agents may do alone, what needs human approval and what they must never do. It is the researchers' proposal built on the notes' hard stops; the notes' core rule is that no agent publishes and a named human approves every asset.

| Tier | Actions (inference) |
|---|---|
| Agents may do alone | Research, outlines, scripts and hook variants; shot lists and storyboards; transcription; rough cuts, clip selection from retention data and platform versions as internal drafts; captions and transcripts as drafts for human review; loudness normalisation and encoding to the specs in sections 7 and 8; alt text drafts; concept images and animatics for internal use with approved tools on paid tiers; QC checklist runs; rights-log entries; expiry monitoring and alerts; reading analytics and updating the winners register; monthly checks of tool status and terms; classifying each brief by risk |
| Needs approval by a named human | Publishing or scheduling any asset on any channel; handing any asset to Marketing for paid use; any asset showing or voicing a real, identifiable person; any testimonial, result, statistic, price or comparative claim; any AI-generated or AI-modified element in a published asset and the disclosure decision for it; any use of licensed stock, fonts or music in a new medium, territory or paid placement; adding a tool to the approved list or changing plan tier; uploading company material to a tool whose terms allow training on inputs; reposting or re-editing older content; relying on an accessibility or disclosure exemption; replying to a rights complaint |
| Needs a second human approver | Paid media; assets with people; health or finance claims; content aimed at or likely to reach children; competitor depictions, with legal sign-off |
| Agents must never do | Use a real, identifiable person's face, body, voice or name, or a clear lookalike or soundalike, without a consent record that covers the specific use, channel, period and AI manipulation; generate or AI-alter a child's likeness; prompt with a living or recently deceased artist's name, a brand, character, film, song or other protected work as a style or content target; leave third-party logos, products, packaging, artworks or watermarks in output; invent product features, results, testimonials, reviews, awards, statistics or documents; remove watermarks, Content Credentials or SynthID, or bypass vendor safety filters; publish without a human approver; use a tool outside the approved list or a free or non-commercial tier for company work; claim copyright in fully AI-generated output; imitate Hormozi or use his name, image or voice; label real content as AI-generated |

### The process around the tiers

**[INFERENCE]** The manager agent classifies each brief by risk (people, claims, paid use, minors, regulated sector) and picks tools by rights position first. It runs a monthly review of the approved tool list, model deprecations, terms changes and the dated facts in this document. It monitors expiry so that assets are unpublished or re-licensed when a licence or consent ends, and it acts on consent withdrawals quickly. It maintains an incident route with takedown, correction and notification steps for complaints about likeness, copyright or misleading content. Under Konsumentverket's guidance a marketing-law breach cannot be undone by editing the post afterwards (checked on a primary source; [Konsumentverket, hidden marketing in social media, reviewed 4 Sep 2026](https://www.konsumentverket.se/marknadsratt-foretag/dold-marknadsforing-i-sociala-medier-regler-for-foretag/)), which is why the gate sits before publication.

### What the guardrails do not cover

**[GAP]** Sector rules for alcohol, gambling, health, finance and political advertising (including EU Regulation 2024/900) were not researched. Retention periods for provenance and consent records under Swedish law were not researched.
