---
id: media.generative-tools.tool-landscape-november-2026
department: media
domain: generative-tools
title: 'Media: The generative media tool landscape (dated November 2026)'
summary: 'The generative media tool landscape (dated November 2026): store what is needed to regenerate, select tools by rights position
  first, typical limits of video generators, Google''s Veo 3.1 preview shutdown and Gemini Omni Flash, Sora treated as discontinued,
  other video models, image models, voice, music and avatars, and what was not verified.'
type: benchmark
audience: both
confidence: platform-claim
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- quality
- compliance
sources:
- https://ai.google.dev/gemini-api/docs/video
- https://pixflow.net/blog/best-ai-video-generator/
- https://masv.io/blog/best-ai-video-generator
- https://ai.google.dev/gemini-api/docs/omni
- https://openai.com/policies/service-terms/
- https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation
- https://chatgptiseatingtheworld.com/category/disney-v-midjourney/
- https://developers.openai.com/api/docs/guides/image-generation
- https://helpx.adobe.com/firefly/get-set-up/learn-the-basics/adobe-firefly-faq.html
- https://www.gettyimages.com/ai/generation/about
related:
- media.compliance.copyright-ai-output-and-vendor-terms
- media.compliance.likeness-and-voice
seed_version: 1
cross_refs:
  '18':
  - media.compliance.copyright-ai-output-and-vendor-terms
  '20':
  - media.compliance.likeness-and-voice
---

**When to use this:** When choosing or checking a generative video, image, voice, music or avatar tool. Dated November 2026: verify anything past its date at the vendor.

**Source section:** 14. The generative media tool landscape (dated November 2026)

### The tool list is unstable, so store what is needed to regenerate

**[FAST-MOVING, Nov 2026]** Two flagship video services changed status within about a month of each other in autumn 2026: Google shut down the Veo 3.1 preview API on 22 October 2026 ([Google AI for Developers, video docs, updated 22 Oct 2026](https://ai.google.dev/gemini-api/docs/video)), and trade guides report that the Sora API ended on 24 September 2026 ([Pixflow, last modified 5 Nov 2026](https://pixflow.net/blog/best-ai-video-generator/); [MASV, updated 17 Mar 2026](https://masv.io/blog/best-ai-video-generator)). **[INFERENCE]** Any pipeline pinned to a model name needs a monthly check, and agents should store prompts, seeds, reference images and source files so that a shot can be regenerated on another model.

### Select tools by rights position first

**[INFERENCE]** The selection rule for the manager agent is to pick a tool by rights position first, consistency and control second, and raw quality third. Commercial-use terms differ far more between vendors than image quality does. For paid media and anything with a long shelf life, default to tools with licensed training data and an indemnity, and use tools without one only for concept work or where a human has cleared the output. Which tools qualify is set out in section 18.

### Typical limits of video generators in 2026

**[INFERENCE] [FAST-MOVING, Nov 2026]** Across the sources read, typical limits in November 2026 are single clips of roughly 5 to 15 seconds, extensions to about 40 seconds, native resolution of 720p to 1080p with 4K often delivered as an upscale, and two aspect ratios. Plan long pieces as many short shots.

### Google: Veo 3.1 preview shut down, Gemini Omni Flash as replacement

**[PLATFORM CLAIM] [FAST-MOVING, 22 Oct 2026]** Google's Gemini API documentation, updated 22 October 2026, states that the Veo 3.1 preview models, including the fast and lite variants, were shut down on that date and points to Gemini Omni Flash (`gemini-omni-1.1-flash`) as the replacement. Generally available models remain available through the Gemini Enterprise Agent Platform, formerly Vertex AI ([Google AI for Developers, video docs, updated 22 Oct 2026](https://ai.google.dev/gemini-api/docs/video)).

**[PLATFORM CLAIM] [FAST-MOVING, read Nov 2026]** Gemini Omni Flash, as documented in November 2026, takes text, image, audio and video as input and produces clips of 3 to 10 seconds; extension adds 10 seconds per step up to 40 seconds in total; the aspect ratio is 16:9 or 9:16 only; native output is 360p or 720p, with 1080p and 4K delivered as upscales; audio is generated automatically. It supports single image-to-video, first and last frame interpolation, multi-image subject references, up to 3 video references of at most 3 seconds each, and conversational multi-turn editing ([Google, Gemini Omni docs, read Nov 2026](https://ai.google.dev/gemini-api/docs/omni)).

**[PLATFORM CLAIM] [FAST-MOVING, read Nov 2026]** Gemini Omni Flash limits documented in November 2026: no negative-prompt field and no system instructions; no voice editing or audio-reference upload; English is fully supported and other languages are described as possibly working; editing of uploaded video is unavailable in the EEA, Switzerland and the UK; images containing minors cannot be uploaded or edited in the EEA, Switzerland and the UK; images of certain recognisable people are blocked; and all outputs carry invisible SynthID watermarking ([Google, Gemini Omni docs, read Nov 2026](https://ai.google.dev/gemini-api/docs/omni)). The EEA restriction on editing uploaded video directly affects a Sweden-based team.

### Sora: treat as discontinued, dates unconfirmed

**[CONTESTED] [FAST-MOVING, 2026]** Two trade guides report that OpenAI announced in March 2026 that the Sora web and app product would end on 26 April 2026 and the Sora API on 24 September 2026 ([Pixflow, last modified 5 Nov 2026](https://pixflow.net/blog/best-ai-video-generator/); [MASV, updated 17 Mar 2026](https://masv.io/blog/best-ai-video-generator)). OpenAI's Service Terms updated 16 October 2026 still contain wording about a Sora feed and Sora cameo ([OpenAI Service Terms, updated 16 Oct 2026](https://openai.com/policies/service-terms/)). OpenAI's help centre has an article whose title refers to the Sora discontinuation, which was seen only as a title and not read ([OpenAI Help article on the Sora discontinuation, title seen, page unread](https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation)). **[INFERENCE]** The conflict is most likely resolved in favour of discontinued. Do not plan work on Sora, and verify the dates on OpenAI's page before stating them.

### Other video models: a trade-guide snapshot

**[FAST-MOVING, 5 Nov 2026]** The table reproduces a trade guide's snapshot, last modified 5 November 2026. It is a secondary source and none of these vendors' own product pages was read.

| Model family | Snapshot as reported | Date and source |
|---|---|---|
| Runway Gen-4, Gen-4 Turbo, Gen-4.5 | Clips of 5 to 10 s; rated strongest on character, location and object consistency and editor-style control; limited native audio; lip-sync through its Act tools; credit plans listed as Free, $15, $35 and $95 a month | 5 Nov 2026, [Pixflow, last modified 5 Nov 2026](https://pixflow.net/blog/best-ai-video-generator/) |
| Kling 3.0, 3.0 Omni, 3.0 Turbo | Up to 15 s; 4K; native audio; lip-sync in 5 languages; multi-shot storyboards of up to 6 shots; occasional identity drift in longer sequences; plans about $25.99 and $64.99 a month | 5 Nov 2026, [Pixflow, last modified 5 Nov 2026](https://pixflow.net/blog/best-ai-video-generator/) |
| Seedance 2.0 (ByteDance, launched Feb 2026) | 4 to 15 s; up to 1080p; native audio and lip-sync; accepts text, image, audio and video inputs; described as strong on product and logo consistency and as keeping character identity across multi-shot sequences | 5 Nov 2026, [Pixflow, last modified 5 Nov 2026](https://pixflow.net/blog/best-ai-video-generator/) |
| Pika 2.x | 1 to 10 s; 720p ceiling per this guide; social-effects toolkit; lip-sync via Pikaformance | 5 Nov 2026, [Pixflow, last modified 5 Nov 2026](https://pixflow.net/blog/best-ai-video-generator/) |
| Luma Ray3 | Clips of about 5 s; cinematic image-to-video; available inside Adobe Firefly | 5 Nov 2026, [Pixflow, last modified 5 Nov 2026](https://pixflow.net/blog/best-ai-video-generator/) |
| Adobe Firefly Video | Clips typically up to 8 s; exports up to 4K; trained on licensed and public-domain content | 5 Nov 2026, [Pixflow, last modified 5 Nov 2026](https://pixflow.net/blog/best-ai-video-generator/) |

**[CONTESTED] [FAST-MOVING, 17 Mar 2026]** A second guide, updated 17 March 2026 and based on one informal test, lists entry prices per month of $10 for Kling, $12 for Runway, $19.99 for Veo through a Google plan, $9.99 for Luma, $9.99 for Firefly, $35 for Pika Pro and $14.99 for Hailuo, and notes that Luma Ray3 HDR offers 4K HDR with 16-bit ACES EXR output. Its specs conflict with the other guide in places, for example Pika at 1080p against 720p and Runway at 720p against 1080p ([MASV, updated 17 Mar 2026](https://masv.io/blog/best-ai-video-generator)). Check each vendor's own page before relying on any of these figures.

**[FAST-MOVING, Feb 2026]** A legal-industry blog reports that in February 2026 a Seedance video depicting two famous actors drew a studio reaction and a cease-and-desist letter from Disney ([ChatGPT Is Eating the World, Disney v Midjourney category](https://chatgptiseatingtheworld.com/category/disney-v-midjourney/)). The incident illustrates why section 20 forbids generating real people.

### Image models

**[PLATFORM CLAIM] [FAST-MOVING, read Nov 2026]** OpenAI's image documentation in November 2026 lists `gpt-image-2.5-sunburst` for editing precision, `gpt-image-2.5-flare` for fast everyday generation, and GPT-Image-2.6 variants. Version 2.6 adds a complexity control (low, medium, high) for dense text and layouts, markup-guided edits, SVG output and animated GIF output. Multi-turn editing runs through the Responses API, and organisation verification may be required ([OpenAI image generation guide, read Nov 2026](https://developers.openai.com/api/docs/guides/image-generation)).

**[PLATFORM CLAIM] [FAST-MOVING, 10 Nov 2026]** Adobe's Firefly FAQ, updated 10 November 2026, says Firefly's own models are trained on licensed content such as Adobe Stock plus public-domain content, that outputs of non-beta features and, unless marked otherwise, beta features may be used commercially, and that Content Credentials are applied automatically to certain exports. The FAQ does not say whether partner models offered inside Firefly carry the same assurances ([Adobe Firefly FAQ, updated 10 Nov 2026](https://helpx.adobe.com/firefly/get-set-up/learn-the-basics/adobe-firefly-faq.html)).

**[VENDOR] [FAST-MOVING, read Nov 2026]** Getty Images describes its generative tool as trained only on licensed Getty creative content and not on scraped data, designed to avoid recognisable characters, logos and other intellectual property, and working from creative and not editorial content. Downloading a modified image requires a licence for the source image ([Getty Images, AI generation page, read Nov 2026](https://www.gettyimages.com/ai/generation/about)). These are the vendor's own statements.

### Voice, music and avatars

**[PLATFORM CLAIM] [FAST-MOVING, Oct 2026]** OpenAI's Service Terms updated 16 October 2026 say its Prompt-to-Voice feature may not reproduce a person's voice without express consent, that generated speech must be clearly disclosed as AI-generated, and that ChatGPT Voice output is non-commercial only and may not be repackaged as an audio file ([OpenAI Service Terms, updated 16 Oct 2026](https://openai.com/policies/service-terms/)). ElevenLabs, Suno and HeyGen terms are in section 18.

### What was not verified about the landscape

**[GAP]** No vendor page was read for Kling, Black Forest Labs (FLUX), Ideogram, Synthesia, Udio, Shutterstock or Microsoft, so this document has no primary data on their versions, pricing, API or commercial terms as of November 2026. Pricing for Gemini Omni Flash and for OpenAI image models was not verified. The following are unverified background recall: FLUX open-weight "dev" models carry a non-commercial licence with separate commercial licensing; Synthesia restricts stock avatars in paid advertising and requires recorded consent for custom avatars.
