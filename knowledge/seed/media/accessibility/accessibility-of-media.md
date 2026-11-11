---
id: media.accessibility.accessibility-of-media
department: media
domain: accessibility
title: 'Media: Accessibility of media'
summary: 'Accessibility of media: WCAG requirements by media type, subtitle quality benchmarks, the proposed house standard for every
  published video, the European Accessibility Act, the Swedish accessibility act, where vendor summaries are unreliable, and whether
  the act reaches a SaaS company''s video.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- web
- youtube
objectives:
- accessibility
- compliance
sources:
- https://www.w3.org/WAI/media/av/planning/
- https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-Timed-Text-Style-Guide
- https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32019L0882
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/
- https://wistia.com/learn/marketing/european-accessibility-act
- https://www.kapwing.com/blog/european-accessibility-act-eaa-compliance-checklist/
- https://pigment.se/en/insight/accessibility-directive
seed_version: 1
---

**When to use this:** When publishing any video, audio or image: captions, transcripts, audio description, subtitle quality, and whether the European Accessibility Act or the Swedish accessibility act applies. Legal parts are orientation, not legal advice.

**Source section:** 10. Accessibility of media

### WCAG requirements by media type

**[DURABLE]** The W3C's planning guidance maps WCAG success criteria to media types ([W3C WAI, Planning Audio and Video Media](https://www.w3.org/WAI/media/av/planning/)). The table restates it.

| Media type | Requirement | WCAG level and criterion | Source |
|---|---|---|---|
| Prerecorded audio-only, such as a podcast | Transcript | Level A, SC 1.2.1 | [W3C WAI, Planning Audio and Video Media](https://www.w3.org/WAI/media/av/planning/) |
| Prerecorded video-only | Transcript or audio track | Level A, SC 1.2.1 | [W3C WAI, Planning Audio and Video Media](https://www.w3.org/WAI/media/av/planning/) |
| Prerecorded video with audio | Captions | Level A, SC 1.2.2 | [W3C WAI, Planning Audio and Video Media](https://www.w3.org/WAI/media/av/planning/) |
| Prerecorded video with audio | Audio description or transcript | Level A, SC 1.2.3 | [W3C WAI, Planning Audio and Video Media](https://www.w3.org/WAI/media/av/planning/) |
| Prerecorded video with audio | Audio description | Level AA, SC 1.2.5 | [W3C WAI, Planning Audio and Video Media](https://www.w3.org/WAI/media/av/planning/) |
| Prerecorded video with audio | Transcript, sign language, extended description | Level AAA, SC 1.2.8, 1.2.6, 1.2.7 | [W3C WAI, Planning Audio and Video Media](https://www.w3.org/WAI/media/av/planning/) |
| Live video with audio | Captions | Level AA, SC 1.2.4 | [W3C WAI, Planning Audio and Video Media](https://www.w3.org/WAI/media/av/planning/) |
| Any audio that autoplays for more than 3 seconds | Pause or stop control, or volume control | Level A, SC 1.4.2 | [W3C WAI, Planning Audio and Video Media](https://www.w3.org/WAI/media/av/planning/) |
| Moving content | Pause, stop or hide | Level A, SC 2.2.2 | [W3C WAI, Planning Audio and Video Media](https://www.w3.org/WAI/media/av/planning/) |

**[DURABLE]** The W3C guidance also requires that the media player itself supports accessibility ([W3C WAI, Planning Audio and Video Media](https://www.w3.org/WAI/media/av/planning/)).

### Subtitle quality benchmarks

**[DURABLE]** The Netflix English Timed Text Style Guide is an industry standard and not law. It sets 42 characters per line and a maximum of 2 lines; a reading speed of up to 20 characters per second for adult programmes and 17 for children's; line breaks after punctuation and before conjunctions or prepositions; and no splitting of an article from its noun, a first name from a last name, or a verb from its subject pronoun. For subtitles for the deaf and hard of hearing, speaker IDs and sound effects go in square brackets in lowercase, speakers are identified only when not visually obvious, and plot-relevant sounds are described ([Netflix English Timed Text Style Guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-Timed-Text-Style-Guide)).

**[GAP]** No sourced caption accuracy target, such as 99%, was found. The BBC Subtitle Guidelines and the W3C captions and audio-description pages could not be read.

### Proposed house standard for every published video

**[INFERENCE]** Every published video gets human-reviewed closed captions as .srt and .vtt with speaker IDs and meaningful sounds, a transcript on the hosting page, and a script written so that the narration says what the visuals show, which reduces the need for a separate audio-description track. Burned-in social captions help sound-off viewers but do not replace a closed-caption file, because users cannot resize, restyle or translate them.

### The European Accessibility Act: what the directive covers

**[DURABLE] [FAST-MOVING, read 11 Nov 2026]** Checked on a primary source: Directive (EU) 2019/882 applies to listed services provided to consumers after 28 June 2025, including services providing access to audiovisual media services and e-commerce services (Article 2(2)). Services providing access to audiovisual media services are services transmitted by electronic communications networks that are used to identify, select, receive information on and view audiovisual media services (Article 3(6)). E-commerce services are provided at a distance through websites and mobile services, at a consumer's individual request, to conclude a consumer contract (Article 3(30)) ([EUR-Lex, Directive (EU) 2019/882, read 11 Nov 2026](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32019L0882)). This is orientation and not legal advice.

**[DURABLE] [FAST-MOVING, read 11 Nov 2026]** Checked on a primary source: the directive excludes pre-recorded time-based media published before 28 June 2025, third-party content that the operator neither funds, develops nor controls, and archives not updated after 28 June 2025 (Article 2(4)). Microenterprises providing services are exempt (Article 4(5)). Article 14 covers fundamental alteration and disproportionate burden, and Article 32 gives a transitional period to 28 June 2030. Under Annex I, websites, online applications and mobile apps of covered services must be perceivable, operable, understandable and robust, and access services for audiovisual media must provide accessible electronic programme guides and fully transmit subtitles for the deaf and hard of hearing, audio description, spoken subtitles and sign language, synchronised and user-controllable ([EUR-Lex, Directive (EU) 2019/882, read 11 Nov 2026](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32019L0882)).

### The Swedish accessibility act

**[DURABLE] [FAST-MOVING, read 11 Nov 2026]** Checked on a primary source: Sweden's Lag (2023:254) on the accessibility of certain products and services has been in force since 28 June 2025. Covered consumer services (4 §) include electronic communications, services giving access to audiovisual media services, parts of passenger transport, consumer banking, e-books and e-commerce services. Third-party content on websites and apps that the operator neither funds, develops nor controls is exempt (5 §). No requirement applies where it would fundamentally alter the service or impose a disproportionate burden (7 §), but an operator that invokes an exemption must document the assessment with reasons, keep it and notify the supervisory authority (8 §). Microenterprises, meaning fewer than ten employees and a turnover or balance sheet total not above EUR 2 million, need not meet the requirements for services (10 §) ([Riksdagen, Lag (2023:254), read 11 Nov 2026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/)). This is orientation and not legal advice.

**[DURABLE] [FAST-MOVING, read 11 Nov 2026]** Checked on a primary source: under the Swedish act's transitional rules, the act does not apply to pre-recorded time-based media or archived content published before entry into force (archives only if not updated since), and contracts made before then may run until expiry, at the latest 27 June 2030. Enforcement is through corrective orders, conditional fines and sanction fees of SEK 10,000 to SEK 10,000,000 (37 to 40 §§). Supervisory authorities are designated by the government (30 §) and the act itself does not name them. The definitions in 2 § are amended by Lag (2026:1026) with effect from 20 November 2026; the content of that amendment was not analysed ([Riksdagen, Lag (2023:254), read 11 Nov 2026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/)).

### What vendor summaries add, and where they are unreliable

**[VENDOR] [FAST-MOVING, Jun 2025]** Two video-hosting vendors list the same expectations for video under the act: accurate synchronised captions including relevant non-speech sound, transcripts, audio description where visuals carry meaning, and an accessible player with keyboard, screen-reader and caption controls ([Wistia, 4 Jun 2025](https://wistia.com/learn/marketing/european-accessibility-act); [Kapwing, 13 Jun 2025](https://www.kapwing.com/blog/european-accessibility-act-eaa-compliance-checklist/)). Wistia says penalties are set by each member state and that the act follows EN 301 549, which it describes as using WCAG 2.2; neither vendor states a conformance level ([Wistia, 4 Jun 2025](https://wistia.com/learn/marketing/european-accessibility-act)). **[CONTESTED] [GAP]** The researchers' unverified recall is that the current harmonised version of EN 301 549 references WCAG 2.1 AA and not 2.2. The standard was not read, so the conformance level is unverified.

### Does the act reach a SaaS company's video?

**[INFERENCE]** This is the researchers' reading and not legal advice. The directive and the Swedish act regulate listed consumer services. A B2B SaaS company's marketing videos are not themselves a listed service. The act bites where the company sells to consumers online, which is an e-commerce service: then the website and app, including video the company controls and published there after 28 June 2025, should meet the perceivable, operable, understandable and robust requirements. Captions on all new video are the low-cost safe default either way.

**[INFERENCE] [GAP]** Video that the company posts to a third-party platform is not clearly addressed by either text read. The third-party-content exemption protects a site operator from content it does not control; it does not obviously cover a company's own uploads. Which authorities supervise the Swedish act is set by ordinance that was not read; the Swedish Post and Telecom Authority (PTS) is commonly named, which is unverified. An unread Swedish lead is [pigment.se on the accessibility directive, unread](https://pigment.se/en/insight/accessibility-directive).
