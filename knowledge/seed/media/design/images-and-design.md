---
id: media.design.images-and-design
department: media
domain: design
title: 'Media: Images and design'
summary: 'Images and design: the honest status of the section, house-style direction for design, web image formats, alt text, contrast,
  Swedish moral rights limits on editing or placing licensed images, and retouching and misleading product images.'
type: playbook
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- web
objectives:
- quality
- accessibility
sources:
- https://rosetta.to/u/alexhormozi/how-i-gained-7-8-million-followers-in-40-months-6-key-lessons
- https://rosetta.to/u/alexhormozi/14-years-of-marketing-advice-in-35-minutes
- https://web.dev/learn/images/avif
- https://support.google.com/youtube/answer/72431?hl=en
- https://www.w3.org/WAI/tutorials/images/decision-tree/
- https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1960729-om-upphovsratt-till-litterara-och_sfs-1960-729/
seed_version: 1
---

**When to use this:** When making images, thumbnails, graphics or product shots: formats, alt text, contrast, editing licensed images and retouching.

**Source section:** 9. Images and design

### The honest status of this section

**[GAP]** No design source and no photography source was read in either research pass. Brand guideline contents, typography and colour basics, layout and hierarchy, social and ad template systems, design tokens, motion graphics practice, data visualisation, presentation design, product and portrait photography, retouching limits, WebP specifics, quality settings and image compression budgets are all unsourced. Suggested sources for a follow-up are Material Design and the Apple Human Interface Guidelines for type and colour, Figma and Adobe documentation for design systems, NN/g on visual hierarchy, and Datawrapper Academy and the Financial Times Visual Vocabulary for charts.

### House-style direction for design

**[HOUSE STYLE; primary transcript] [FAST-MOVING, 2024-2025]** The only sourced design direction is Hormozi's: visuals should aid learning, for example charts that show scale or change over time; over-production that is not tied to the objective hurts learning (April 2024, [Hormozi, "How I Gained 7.8 Million Followers In 40 Months", auto-transcript, 27 Apr 2024](https://rosetta.to/u/alexhormozi/how-i-gained-7-8-million-followers-in-40-months-6-key-lessons)); and plain-looking pages and ads convert better than elaborate ones in his experience (May 2025, [Hormozi, "14 Years of Marketing Advice in 35 Minutes", auto-transcript, May 2025](https://rosetta.to/u/alexhormozi/14-years-of-marketing-advice-in-35-minutes)). **[INFERENCE]** For this owner's house style, design templates should be plain, high-contrast and text-led, with motion graphics limited to elements that explain, such as numbers, steps and comparisons.

### Web image formats

**[DURABLE]** AVIF is based on the AV1 codec, supports transparency and animation, and testing cited by web.dev from Netflix, Cloudinary and the Chrome codecs team shows significant file-size reductions against JPEG or WebP. Browser support arrived in Chrome and Opera in 2020, Firefox in 2021 and Safari in 2022. A browser that cannot decode a format shows a broken image, so fallbacks must be served through responsive-image markup ([web.dev, Learn Images: AVIF](https://web.dev/learn/images/avif)). **[INFERENCE]** The web delivery default is AVIF first, WebP second, and JPEG or PNG as fallback inside a picture element, with the layered or RAW master kept in the archive. **[PLATFORM CLAIM] [FAST-MOVING, read 11 Nov 2026]** YouTube thumbnails accept JPG or PNG only ([YouTube Help, custom thumbnails, read 11 Nov 2026](https://support.google.com/youtube/answer/72431?hl=en)).

### Alt text

**[DURABLE]** The W3C alt decision tree sets what alt text an image needs. An image containing text that is not available elsewhere gets that text as its alt. An image inside a link or button gets a description of the destination or action. A meaningful simple image gets a brief description of its meaning. A graph or complex image has its information given elsewhere on the page. A decorative or redundant image gets an empty alt ([W3C WAI, alt decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/)). **[INFERENCE]** For charts and screenshots on marketing pages, the alt text states the point of the image and the page carries the data in text.

### Contrast

**[GAP]** The WCAG contrast page could not be opened. The commonly cited ratios of 4.5:1 for normal text and 3:1 for large text at Level AA (SC 1.4.3) and 3:1 for non-text interface elements and graphics (SC 1.4.11) are unverified background recall; verify at [W3C Understanding SC 1.4.3, unread](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) before encoding them in templates.

### Swedish moral rights limit how licensed images may be edited or placed

**[DURABLE]** Checked on a primary source: under 3 § of the Swedish Copyright Act the author must be named as good practice requires, and a work may not be changed, or made available in a form or context, that offends the author's reputation or individuality; the right can be waived only to a limited extent ([Riksdagen, upphovsrättslagen SFS 1960:729, read 11 Nov 2026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1960729-om-upphovsratt-till-litterara-och_sfs-1960-729/)). Under 49 a § whoever made a photographic picture has exclusive rights to copy it and make it available for 50 years after the year it was made, whether or not it is an original work ([Riksdagen, upphovsrättslagen SFS 1960:729, read 11 Nov 2026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1960729-om-upphovsratt-till-litterara-och_sfs-1960-729/)). This is orientation and not legal advice.

**[INFERENCE]** Three design rules follow for a Sweden-based company. Templates should carry a photographer or illustrator credit field by default, because naming is a statutory right and not a courtesy. Heavy retouching, AI restyling or use of a stock photo in a sensitive context can breach moral rights even when the economic licence permits edits, so check the licence and, for commissioned work, get a written and specific waiver. Every photo found online, including plain snapshots and screenshots of photos, should be treated as protected for at least 50 years from creation.

### Retouching and misleading product images

**[GAP]** Konsumentverket guidance on retouching and misleading product images was not searched. The following is unverified background recall: Swedish and EU marketing law requires marketing not to mislead, which constrains product retouching, and Norway, not Sweden, has a retouched-advertising labelling law. Verify with Konsumentverket before writing policy.
