---
id: media.compliance.licensing-non-ai-assets
department: media
domain: compliance
title: 'Media: Licensing of non-AI assets'
summary: 'Licensing of non-AI assets: the honest status of the section, the Swedish statutory backdrop, stock images and footage, fonts,
  music, templates, user-generated and creator content, and releases. Orientation, not legal advice.'
type: policy
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- compliance
sources:
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1960729-om-upphovsratt-till-litterara-och_sfs-1960-729/
- https://www.stim.se/sv/musik-i-radio-tv-film-och-reklam
- https://support.google.com/youtube/answer/14328491
- https://suno.com/terms
- https://www.stim.se/kund/musik-online
- https://www.stim.se/ai/om-stims-nya-licens-for-ai-tjanster
- https://www.konsumentverket.se/marknadsratt-foretag/dold-marknadsforing-i-sociala-medier-regler-for-foretag/
- https://www.imy.se/verksamhet/dataskydd/vi-guidar-dig/publicera-bilder-filmer-och-ljud-pa-internet/
seed_version: 1
---

**When to use this:** When using stock images or footage, fonts, music, templates, user-generated or creator content, or getting releases. Orientation for a human to confirm.

**Source section:** 19. Licensing of non-AI assets

### The honest status of this section

**[GAP]** Very little on licensing of non-AI assets could be verified. No stock, font, production-music or release-template source was read: not the Getty, iStock, Shutterstock or Adobe Stock licence pages, not any font licence (desktop, web, app, video, Google Fonts), not the platform music libraries (Meta Sound Collection, TikTok Commercial Music Library, YouTube Audio Library), and no source on whether stock licences permit use as AI reference or training input. The verified points are the Swedish statutory backdrop and a few vendor terms. The practice paragraphs below are labelled as inference and must be confirmed against each licence.

### The Swedish statutory backdrop

**[DURABLE]** Checked on a primary source: under the Swedish Copyright Act photographic pictures are protected for 50 years from creation without an originality threshold (49 a §), works generally for 70 years after the author's death (43 §), and the creator must be named as good practice requires (3 §) ([Riksdagen, upphovsrättslagen SFS 1960:729, read 11 Nov 2026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1960729-om-upphovsratt-till-litterara-och_sfs-1960-729/)). **[INFERENCE]** Keep credit lines even for licensed stock unless the licence waives them.

### Stock images and footage

**[INFERENCE]** For each stock asset record the licence type (royalty-free standard or extended, or rights-managed), permitted media, territory, term, print-run or impression caps, seat count, and whether the file is editorial use only. Editorial-only files, which typically show newsworthy people, events, unreleased property or trade marks, must not be used in ads or branded content. Check whether the licence allows use as AI input or reference; the researchers believe many do not, which is unverified.

### Fonts

**[INFERENCE]** A desktop font licence rarely covers web embedding, apps, video broadcast or logo use. Record the licence per use and never ship font files to third parties. This is standard practice as the researchers understand it and was not sourced.

### Music

**[DURABLE]** Checked on a primary source: the Swedish collecting society Stim describes music in film and TV as licensed through a one-off synchronisation payment, and promotes a service called Cora Music for using well-known music in social media videos with rights cleared ([Stim, music in radio, TV, film and advertising, read 11 Nov 2026](https://www.stim.se/sv/musik-i-radio-tv-film-och-reklam)). **[PLATFORM CLAIM] [FAST-MOVING, read Nov 2026]** YouTube treats AI-generated music that is the main focus of a video as content requiring disclosure ([YouTube Help, disclosing altered or synthetic content, read Nov 2026](https://support.google.com/youtube/answer/14328491)), and Suno ties commercial use of AI music to paid-tier downloads ([Suno Terms, effective 3 Sep 2026](https://suno.com/terms)).

**[INFERENCE]** Two rights are needed for commercial video: the composition (synchronisation, from the publisher or author) and the recording (master, from the label or producer). Consumer music libraries inside social apps are generally not licensed for business accounts or ads; use the platform's commercial library or a production-music or subscription licence, and keep the licence certificate per track. Collective licences for public performance do not normally include the right to synchronise a track to an advert. None of this was verified on a licence text.

**[GAP]** The scope of Stim and SAMI licences for a company's social media and advertising use is unverified; Stim's online-music page returned an error ([Stim, music online, unread](https://www.stim.se/kund/musik-online)) and SAMI was not reached. A Stim page on an AI licence for music services exists and was not read ([Stim AI licence page, unread](https://www.stim.se/ai/om-stims-nya-licens-for-ai-tjanster)).

### Templates

**[INFERENCE]** Check that template elements (photos, fonts, music) are licensed for commercial use and for the specific channel.

### User-generated and creator content

**[INFERENCE]** A tag, mention or public post is not a licence. Get written permission stating media, paid-use rights, duration, territory, edit rights and whether the content may be used to train or prompt AI. For creator deals, contract usage rights and whitelisting separately from the fee, and require the creator to warrant that music and third-party material are cleared. **[DURABLE]** Checked on a primary source: Konsumentverket states that the company bears the main responsibility for influencers' posts about its products and that this liability cannot be contracted away ([Konsumentverket, hidden marketing in social media, reviewed 4 Sep 2026](https://www.konsumentverket.se/marknadsratt-foretag/dold-marknadsforing-i-sociala-medier-regler-for-foretag/)).

### Releases

**[INFERENCE]** Obtain a signed model release for every identifiable person and a property release for private property, artworks and distinctive interiors, with explicit clauses on AI manipulation, synthetic derivatives and voice. **[DURABLE]** Checked on a primary source: IMY states that voice recordings and images identifying a person are personal data ([IMY, publishing images, film and audio, last updated 14 Apr 2021](https://www.imy.se/verksamhet/dataskydd/vi-guidar-dig/publicera-bilder-filmer-och-ljud-pa-internet/)), so a model or voice release should be paired with a GDPR legal basis and information to the person.
