---
id: media.generative-craft.generative-craft-and-qc
department: media
domain: generative-craft
title: 'Media: Generative media craft and quality control'
summary: 'Generative media craft and quality control: prompting video models per official guidance, a video prompt template, a storyboard-first
  workflow, consistency across shots, product accuracy, voice, text-to-speech and dubbing, mixing AI and filmed footage, humans directing
  the idea, and the QC checklist before human approval.'
type: playbook
audience: both
confidence: inference
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- quality
sources:
- https://ai.google.dev/gemini-api/docs/omni
- https://developers.openai.com/api/docs/guides/image-generation
- https://pixflow.net/blog/best-ai-video-generator/
- https://cms.law/en/swe/legal-updates/ai-in-advertising-key-aspects-for-advertisers-in-sweden
- https://elevenlabs.io/terms-of-use
- https://www.ipsos.com/en-us/ai-ads-are-good-enough-and-thats-problem
- https://help.runwayml.com/hc/en-us/articles/39789879462419-Gen-4-Video-Prompting-Guide
related:
- media.compliance.disclosure-and-labelling
- media.compliance.likeness-and-voice
seed_version: 1
cross_refs:
  '17':
  - media.compliance.disclosure-and-labelling
  '20':
  - media.compliance.likeness-and-voice
---

**When to use this:** When prompting a video or image model, storyboarding, keeping shots consistent, using text-to-speech or dubbing, mixing AI and filmed footage, or running QC before human approval.

**Source section:** 15. Generative media craft and quality control

### Prompting video models: what official guidance says

**[PLATFORM CLAIM] [FAST-MOVING, read Nov 2026]** Google's Gemini Omni Flash documentation is the only official prompt guidance the research could read. It says prompts work best when they describe the scene, camera movement, lighting and mood; that wanted audio and music should be described explicitly; that a single continuous shot or no scene cuts should be requested when one take is wanted; that timing can be controlled with natural language or timecodes such as `[0-3s]`; that exact on-screen text should be put in quotes; and that negatives must be stated in the prompt text, such as "No dialogue", because there is no negative-prompt field ([Google, Gemini Omni docs, read Nov 2026](https://ai.google.dev/gemini-api/docs/omni)).

**[PLATFORM CLAIM] [FAST-MOVING, read Nov 2026]** For image-to-video, the same documentation says higher-resolution source images and specific motion descriptions work better; that two images are used for first and last frame interpolation; that media is bound to roles with tags (`<FIRST_FRAME>`, `<LAST_FRAME>`, `<IMAGE_REF_N>`, `<VIDEO_REF_N>`); that edits work best with simple prompts plus an instruction to keep everything else the same; and that extension continues from the last 10 seconds and cannot prepend ([Google, Gemini Omni docs, read Nov 2026](https://ai.google.dev/gemini-api/docs/omni)). The end of the guide was truncated when read.

**[PLATFORM CLAIM] [FAST-MOVING, read Nov 2026]** OpenAI's image documentation says the higher complexity setting helps with dense text, complex layouts and object relationships but can add latency and unwanted changes, so results should be compared per task ([OpenAI image generation guide, read Nov 2026](https://developers.openai.com/api/docs/guides/image-generation)).

### A prompt template for video

**[INFERENCE]** A video prompt template built on Google's guidance: subject and action; setting; camera (shot size, movement, lens feel); lighting; mood and style; audio (ambience, music, dialogue in quotes); timing cues; exclusions; and "single continuous shot" if needed. Write one shot per prompt. Consistency comes from reference images and first and last frames, not from longer prompts.

### A storyboard-first workflow

**[INFERENCE]** The proposed workflow has six steps. Write a script and shot list with a duration per shot, planning shots of 3 to 10 seconds. Generate or shoot key stills per shot. Lock a character and product reference sheet (front, three-quarter and profile views; product pack shots from the brand's own photography). Run image-to-video from the approved still, using first and last frames for controlled moves. Extend only when needed. Edit, grade, add sound and titles in an editor, adding the real logo and text as graphics instead of generating them. This is the researchers' synthesis and is consistent with the house-style preference for pre-work over post-production.

### Consistency across shots

**[FAST-MOVING, 5 Nov 2026]** A trade guide reports that Kling supports multi-shot storyboards of up to 6 shots, that Seedance 2.0 keeps character identity across multi-shot sequences, that Runway is rated strongest for character and location consistency, and that identity drift still occurs on longer sequences ([Pixflow, last modified 5 Nov 2026](https://pixflow.net/blog/best-ai-video-generator/)).

### Product accuracy

**[INFERENCE]** Never let a model invent the product. Use real product photography as the reference or composite the real product in post, and compare every frame against the approved pack shot for shape, label text, colour, ports, quantities and claims. **[FAST-MOVING, 2025-2026]** The reason is legal as well as aesthetic: according to a Swedish law firm's May 2026 briefing, the advertiser is responsible for false AI-generated content, as shown by a Reklamombudsmannen matter decided 13 August 2025 and a Patent and Market Court judgment of 1 April 2026 on a chatbot's false statement (secondary source only; [CMS Sweden, 28 May 2026](https://cms.law/en/swe/legal-updates/ai-in-advertising-key-aspects-for-advertisers-in-sweden)).

### Voice, text-to-speech and dubbing

**[INFERENCE]** For synthetic voice, write for the ear, mark pauses and emphasis, spell out numbers and brand pronunciations, generate in short blocks and keep a pronunciation list. Clone only voices with recorded written consent (section 20). For dubbing, have a native speaker review the translation and the lip-sync, and check names, units and legal disclaimers; treat a dubbed real person as a manipulated likeness that needs that person's consent and, in the EU, a deepfake-labelling assessment (section 17). **[PLATFORM CLAIM] [FAST-MOVING, 9 Oct 2026]** ElevenLabs' terms require the user to review output before use ([ElevenLabs Terms, updated 9 Oct 2026](https://elevenlabs.io/terms-of-use)).

### Mixing AI and filmed footage

**[INFERENCE]** Match frame rate, grain, lens and colour; keep AI shots short; and record in the rights log which shots are synthetic, because the labelling duty attaches to the published whole when a realistic synthetic element could be taken as authentic.

### AI tends to skip storytelling, so humans direct the idea

**[FAST-MOVING, 18 May 2026]** In the Ipsos and Syracuse Newhouse test, where one AI model wrote the brief and shot list and another generated the video, the AI chose storytelling structures in only 30% of ads against 49% in Ipsos' wider ad database, and some AI ads needed several iterations ([Ipsos, 18 May 2026](https://www.ipsos.com/en-us/ai-ads-are-good-enough-and-thats-problem)). **[INFERENCE]** Keep human creative direction on the idea and the story, and use the house-style content unit to force a structure onto generated pieces.

### The QC checklist before human approval

**[INFERENCE]** The table is the researchers' proposed checklist; it is not a sourced standard.

| Check | What the agent verifies (inference) |
|---|---|
| Anatomy | Hands, fingers, teeth, eyes, limb count, gait |
| Physics and continuity | Object permanence, reflections, shadows, liquid, cloth, background people |
| Text | Every word on screen read letter by letter, including signage, labels and interface text |
| Identity | The character keeps the same face, hair and clothes across shots; no resemblance to a real person or known character |
| Brand | Logo geometry, colours, typography, product shape and features match approved references |
| Facts | The product depicted does what the real product does; prices, claims, results and before-and-after are true and substantiated |
| Third-party marks | No other brands, artworks, recognisable building interiors, vehicle badges or number plates |
| Audio | Mispronunciations, clipped words, lip-sync; music licence recorded |
| Provenance | Content Credentials and SynthID preserved; disclosure label decided and applied; rights-log entry complete |
| Accessibility | Captions accurate; label readable |

### What was not verified on craft

**[GAP]** Official prompt guides from Runway, Kling, Luma, Midjourney, Black Forest Labs, Adobe, ElevenLabs, HeyGen and Synthesia were not read; a lead is [Runway Gen-4 video prompting guide, unread](https://help.runwayml.com/hc/en-us/articles/39789879462419-Gen-4-Video-Prompting-Guide), noting that Runway's domain has moved to runway.com so the help URL may have moved. No verified official guidance was found on upscaling tools, AI dubbing products or voice-clone quality requirements.
