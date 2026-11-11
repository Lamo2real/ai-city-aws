---
id: media.compliance.copyright-ai-output-and-vendor-terms
department: media
domain: compliance
title: 'Media: Copyright in AI output, vendor terms and indemnities'
summary: 'Copyright in AI output, vendor terms and indemnities: purely prompted output is not protected, infringement risk sits with
  whoever publishes, litigation status to early November 2026, vendor terms compared (commercial use, training, indemnity), what they
  mean in practice, Swedish advice on prompts and text and data mining. Orientation, not legal advice.'
type: policy
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms: []
objectives:
- compliance
sources:
- https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf
- https://www.copyright.gov/ai/
- https://www.prv.se/sv/upphovsratt/for-anvandare/upphovsratt-pa-ai-bilder/
- https://cms.law/de/deu/legal-updates/ki-musikgeneratoren-suno-urteil-staerkt-rechteinhaber
- https://www.taylorwessing.com/de/insights-and-events/insights/2026/01/next-steps-for-getty-v-stability-why-has-permission-to-appeal-been-granted
- https://chatgptiseatingtheworld.com/category/disney-v-midjourney/
- https://www.shumaker.com/?p=17623
- https://www.mckoolsmith.com/newsroom-ailitigation-48
- https://www.traverselegal.com/blog/ai-copyright-litigation-where-the-key-cases-stand/
- https://www.mlex.com/mlex/artificial-intelligence/articles/2541728
- https://openai.com/policies/service-terms/
- https://cloud.google.com/terms/generative-ai-indemnified-services
- https://www.gettyimages.com/ai/generation/about
- https://helpx.adobe.com/firefly/get-set-up/learn-the-basics/adobe-firefly-faq.html
- https://docs.midjourney.com/hc/en-us/articles/32083055291277-Terms-of-Service
- https://suno.com/terms
- https://elevenlabs.io/terms-of-use
- https://runway.com/terms-of-use
- https://lumalabs.ai/legal/tos
- https://www.heygen.com/terms
- https://cms.law/en/swe/legal-updates/ai-in-advertising-key-aspects-for-advertisers-in-sweden
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1960729-om-upphovsratt-till-litterara-och_sfs-1960-729/
- https://helpx.adobe.com/legal/product-descriptions/adobe-firefly.html
- https://www.gov.uk/government/publications/report-on-copyright-and-artificial-intelligence
related:
- media.guardrails.agent-guardrails
seed_version: 1
cross_refs:
  '23':
  - media.guardrails.agent-guardrails
---

**When to use this:** When asking who owns AI output, whether it can infringe, which vendor terms allow commercial use or training, or which indemnities apply. Orientation for a human to confirm.

**Source section:** 18. Copyright in AI output, vendor terms and indemnities

### Purely prompted output is not protected

**[DURABLE] [FAST-MOVING, 29 Jan 2025]** Checked on a primary source: the US Copyright Office's Part 2 report of 29 January 2025 concludes that prompts alone do not give enough control to make the user an author; that using AI as an assistive tool does not remove protection; that human-authored input that stays perceptible in the output is protected; that creative selection, arrangement or modification of AI material can be protected; and that no new legislation is needed ([US Copyright Office, Part 2 report, 29 Jan 2025](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf)). The Office's series also includes Part 1 on digital replicas (31 July 2024), which recommends a federal digital-replica law, and Part 3 on training, released only as a pre-publication version on 9 May 2025 ([US Copyright Office AI page](https://www.copyright.gov/ai/)).

**[DURABLE] [FAST-MOVING, 22 Nov 2024]** Checked on a primary source: Sweden's Intellectual Property Office, PRV, takes the position that an image created wholly by an AI tool from a text instruction has no copyright because the creator must be a human. Copyright may arise where a human made enough free, creative choices in an AI-assisted work, and a court decides. The user is responsible for not infringing others' works even when the image came from an AI tool, and copying a known character into an AI image is not allowed. PRV says claiming copyright in a fully AI-generated image may amount to fraud, says the lawfulness of training on internet material is unresolved, and advises reading the tool's terms because they decide what you may do with the image ([PRV, copyright on AI images, updated 22 Nov 2024](https://www.prv.se/sv/upphovsratt/for-anvandare/upphovsratt-pa-ai-bilder/)). The page was last updated 22 November 2024 and predates 2025 and 2026 case law. This is orientation and not legal advice.

**[INFERENCE]** A company should assume it cannot stop others copying raw AI output and should add documented human authorship. To strengthen ownership of AI-assisted work, keep evidence of human contribution (sketches, own photography used as input, edit history, selection and arrangement decisions) in the rights log. Never claim copyright in a fully AI-generated asset.

### Infringement risk sits with whoever publishes the output

**[FAST-MOVING, 31 Jul 2026]** Secondary source only: in GEMA v Suno (Landgericht München I, case 42 O 763/25, 31 July 2026, not final) the court held that training copies obtained by stream-ripping were not covered by an exception; that the trained models contained the works in reproducible form, which was a separate reproduction; that outputs with recognisable protected musical elements infringed even though they were not identical copies, and were attributed to Suno and not the user on simple open prompts; and that the German text-and-data-mining exception did not cover permanent storage in model parameters. Responsibility for an output could shift to the user where the user steers it with repeated or suggestive prompts. The same chamber had earlier found a making-available infringement in GEMA v OpenAI ([CMS Germany on the Suno judgment](https://cms.law/de/deu/legal-updates/ki-musikgeneratoren-suno-urteil-staerkt-rechteinhaber)).

**[INFERENCE]** What the cases mean for a user: the legality of training is the vendor's fight, but an output that reproduces recognisable protected expression (a character, melody, lyric, photograph or logo) is a risk for whoever publishes it. The Munich ruling suggests that a user who deliberately steers a model toward a specific work or artist carries more of the responsibility. Style alone is generally not protected by copyright, but naming a living artist or a brand in a prompt creates evidence of intent and raises moral-right, passing-off and marketing-law risk, so it is banned (section 23). Run a reverse-image and audio-similarity check on hero assets before paid distribution.

### Litigation status through early November 2026

**[FAST-MOVING, Nov 2025 to Nov 2026]** Secondary sources only. The table gives the status of the main cases as the research found them; none was checked on court records.

| Case | Status as reported | Date and source |
|---|---|---|
| Getty Images v Stability AI (UK High Court, 4 Nov 2025) | Secondary copyright infringement claim dismissed because the model does not store copies; limited, historic trade-mark infringement findings for early model versions, concerning Getty watermarks in outputs; Getty ordered to pay 69.4% of Stability's costs; permission to appeal the secondary-infringement point granted Dec 2025, hearing expected around end-2026 | Jan 2026, [Taylor Wessing, Jan 2026](https://www.taylorwessing.com/de/insights-and-events/insights/2026/01/next-steps-for-getty-v-stability-why-has-permission-to-appeal-been-granted) |
| Disney and Universal v Midjourney (C.D. Cal., 2:25-cv-05275, filed Jun 2025; Warner Bros. suit consolidated Nov 2025) | Private mediation ordered with a 19 Aug 2026 deadline; Jun 2026 discovery ruling mostly refused Midjourney's bid to probe the studios' own AI use; 22 Jul 2026 motion for judgment on contributory infringement; 6 Oct 2026 stipulation that Midjourney hands over video training datasets; no merits ruling, settlement or trial date reported as of early Nov 2026 | [ChatGPT Is Eating the World, Disney v Midjourney category](https://chatgptiseatingtheworld.com/category/disney-v-midjourney/); [Shumaker, 1 Jul 2026](https://www.shumaker.com/?p=17623); [McKool Smith tracker, 8 Dec 2025](https://www.mckoolsmith.com/newsroom-ailitigation-48) |
| NYT v OpenAI and Microsoft (SDNY MDL) | Still in discovery in late Mar 2026, with OpenAI ordered to produce 20 million anonymised ChatGPT logs; a Sept 2026 headline indicates summary-judgment briefing on fair use; no ruling located | [Traverse Legal, 26 Mar 2026](https://www.traverselegal.com/blog/ai-copyright-litigation-where-the-key-cases-stand/); [MLex headline, Sept 2026, page unread](https://www.mlex.com/mlex/artificial-intelligence/articles/2541728) |
| Bartz v Anthropic | Jun 2025 ruling that training on lawfully acquired books was fair use but use of pirated copies was not; USD 1.5 billion settlement with preliminary approval Sept 2025, about USD 3,000 per book | 26 Mar 2026, [Traverse Legal, 26 Mar 2026](https://www.traverselegal.com/blog/ai-copyright-litigation-where-the-key-cases-stand/) |
| Kadrey v Meta | Fair use found on a thin plaintiffs' record | 26 Mar 2026, [Traverse Legal, 26 Mar 2026](https://www.traverselegal.com/blog/ai-copyright-litigation-where-the-key-cases-stand/) |
| Thomson Reuters v Ross (Feb 2025) | Fair use rejected for a non-generative AI tool | 26 Mar 2026, [Traverse Legal, 26 Mar 2026](https://www.traverselegal.com/blog/ai-copyright-litigation-where-the-key-cases-stand/) |
| Music labels v Udio and Suno | By Dec 2025 UMG and Warner entities had dismissed their claims against Udio, leaving Sony as sole plaintiff; in the Suno case the labels had added anti-circumvention claims over stream-ripping | 8 Dec 2025, [McKool Smith tracker, 8 Dec 2025](https://www.mckoolsmith.com/newsroom-ailitigation-48) |
| Andersen v Stability; Concord v Anthropic; Disney and others v MiniMax (Hailuo) | Pending as of Dec 2025 | 8 Dec 2025, [McKool Smith tracker, 8 Dec 2025](https://www.mckoolsmith.com/newsroom-ailitigation-48) |

**[FAST-MOVING, 11 Dec 2025]** Secondary source only: on 11 December 2025 Disney was reported to have taken a USD 1 billion stake in OpenAI and licensed characters for Sora ([ChatGPT Is Eating the World, Disney v Midjourney category](https://chatgptiseatingtheworld.com/category/disney-v-midjourney/)). **[GAP]** No final US appellate ruling on generative-AI training fair use was located as of November 2026.

### Vendor terms compared: commercial use, training and indemnity

**[PLATFORM CLAIM] [FAST-MOVING, May to Nov 2026]** The table summarises the vendor terms that were read on the vendors' own pages (Getty's and Adobe's entries are vendor statements on marketing or FAQ pages). Terms change; re-read before each project.

| Vendor | Commercial use of output | Training on customer content | Indemnity | Other conditions | Date and source |
|---|---|---|---|---|---|
| OpenAI (API, Enterprise, Edu) | Not restated in the notes | Not stated in the notes | Output IP indemnity for API and Enterprise or Edu customers only; ChatGPT Business not included | Indemnity excludes output the customer knew or should have known was infringing, disabled or ignored safety features, modified or combined output, inputs the customer had no right to use, trade-mark claims from use in commerce, Prompt-to-Voice output and beta services | 16 Oct 2026, [OpenAI Service Terms, updated 16 Oct 2026](https://openai.com/policies/service-terms/) |
| Google Cloud | Not restated in the notes | Not stated in the notes | Additional indemnity covers the Gemini Enterprise Agent Platform API only with generally available versions of Gemini, Imagen and Veo, plus Gemini in Workspace and Google Vids; Lyria and Omni are not on the list read | Preview models are outside the list | 20 Jul 2026, [Google Cloud, generative AI indemnified services, modified 20 Jul 2026](https://cloud.google.com/terms/generative-ai-indemnified-services) |
| Getty Images | Commercial, from creative content | Trained on licensed Getty content, per vendor | Stated at USD 50,000 per generated image as standard and uncapped on Enterprise | Vendor's own marketing statement, not contract text | read Nov 2026, [Getty Images, AI generation page, read Nov 2026](https://www.gettyimages.com/ai/generation/about) |
| Adobe Firefly | Allowed for non-beta and, unless marked otherwise, beta features | Own models trained on licensed and public-domain content | Not verified; indemnity terms expected on an unread legal page | Partner models inside Firefly not addressed by the FAQ | 10 Nov 2026, [Adobe Firefly FAQ, updated 10 Nov 2026](https://helpx.adobe.com/firefly/get-set-up/learn-the-basics/adobe-firefly-faq.html) |
| Midjourney | User owns assets to the extent the law allows; a company with more than USD 1,000,000 annual revenue must be on a Pro or Mega plan to own assets | User grants a perpetual, irrevocable, sublicensable licence to inputs and outputs | None; as-is with no non-infringement warranty; user indemnifies Midjourney | Content public and remixable by default; Stealth mode only on Pro or Mega | 27 May 2026, [Midjourney Terms of Service, effective 27 May 2026](https://docs.midjourney.com/hc/en-us/articles/32083055291277-Terms-of-Service) |
| Suno | Free tier personal and non-commercial only; paid tiers commercial only for outputs obtained as a permitted download within the plan's monthly allotment; remixes non-commercial on every tier | Not stated in the notes | None; no warranty that copyright vests or that output is non-infringing; user indemnifies Suno | Rights in a download are perpetual once obtained | 3 Sep 2026, [Suno Terms, effective 3 Sep 2026](https://suno.com/terms) |
| ElevenLabs | Free users non-commercial only; paid users commercial, subject to the Prohibited Use Policy | Not stated in the notes | None; user indemnifies ElevenLabs | Voice model only from your own voice or one you are authorised to share; user must review output; music governed by a separate addendum that was not read | 9 Oct 2026, [ElevenLabs Terms, updated 9 Oct 2026](https://elevenlabs.io/terms-of-use) |
| Runway | Not restricted by plan, subject to compliance | Inputs and outputs may be used to train; perpetual, irrevocable, sublicensable licence | None from Runway; user indemnifies Runway | No photo of another person without permission; no impersonation; silent on watermarks and provenance | 23 Oct 2026, [Runway Terms of Use, updated 23 Oct 2026](https://runway.com/terms-of-use) |
| Luma | Only for outputs produced during an active paid subscription term that permits commercial use; trial outputs for internal evaluation only | Licence includes training on paid and free use; free use carries a broader licence including public display | None; customer indemnifies Luma | Output resembling a person must be publicly identified as AI-generated; no removal of watermarks, content credentials or provenance metadata | 14 May 2026, [Luma Terms of Service, updated 14 May 2026](https://lumalabs.ai/legal/tos) |
| HeyGen | Creator, Pro and Business plans commercial; free plan personal, non-commercial and internal evaluation only | Paid-plan content licensed to HeyGen on irrevocable, sublicensable terms that include training | None; user indemnifies HeyGen | Voice cloning under separate supplemental terms with consent and verification; a person's likeness requires permission | 16 Oct 2026, [HeyGen Terms, updated 16 Oct 2026](https://www.heygen.com/terms) |

### What the vendor terms mean in practice

**[INFERENCE] [FAST-MOVING, Nov 2026]** Four rules follow from the terms read. First, record the plan tier and generation date for every AI asset, because commercial rights depend on the plan at Luma, HeyGen, ElevenLabs, Suno and, above the revenue threshold, Midjourney. A company with revenue above USD 1 million using Midjourney on a lower plan does not own its assets under the terms. Second, Runway, Luma and HeyGen train on customer content under their standard terms, so do not upload confidential product material, customer data or unreleased brand assets without an enterprise agreement that switches training off. Third, Luma's contractual duty to label output that resembles a person is stricter than current law and should be mirrored as a house rule for all tools. Fourth, never use a free or non-commercial tier for company work.

**[INFERENCE]** Indemnities are a backstop and not a clearance. The versions read exclude knowing infringement, modified or combined output and trade marks, which are exactly the common marketing risks, and preview or beta models, often the newest video models, are typically outside the indemnity. Indemnified options are limited to the enterprise offers noted: OpenAI API and Enterprise, Google Cloud generally available models, Getty by its own statement, and Adobe subject to verification.

### Advice from a Swedish law firm on prompts

**[FAST-MOVING, 28 May 2026]** Secondary source only: a Swedish law firm advises advertisers to ban the use of others' registered trade marks or protected works in prompts and to review outputs manually for confusion and copyright issues ([CMS Sweden, 28 May 2026](https://cms.law/en/swe/legal-updates/ai-in-advertising-key-aspects-for-advertisers-in-sweden)).

### Text and data mining under Swedish law

**[DURABLE]** Checked on a primary source: under 15 a § of the Swedish Copyright Act anyone with lawful access to a work may make copies for text and data mining; the copies may not be kept longer than needed or used for other purposes; and the exception does not apply where the author has reserved the right in an appropriate way. Under 15 b § research organisations and cultural-heritage institutions have a research exception that contracts cannot override ([Riksdagen, upphovsrättslagen SFS 1960:729, read 11 Nov 2026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1960729-om-upphovsratt-till-litterara-och_sfs-1960-729/)). **[INFERENCE]** This follows the EU model and concerns model training, not the use of outputs.

### What was not verified on copyright and vendor terms

**[GAP]** Not read: terms of Kling, Black Forest Labs, Synthesia, Shutterstock and Udio; Microsoft's Customer Copyright Commitment; Adobe's indemnity terms ([Adobe Firefly Product Description, unread](https://helpx.adobe.com/legal/product-descriptions/adobe-firefly.html)); HeyGen's Voice Supplemental Terms. The following are unverified background recall: Adobe offers IP indemnification for Firefly outputs on eligible enterprise plans and excludes partner models; Microsoft's commitment requires its guardrails to stay on; the D.C. Circuit affirmed in March 2025 that a work needs a human author, with a Supreme Court denial in early 2026. Also not verified: the UK government's 2026 report on copyright and AI ([gov.uk report on copyright and AI, unread](https://www.gov.uk/government/publications/report-on-copyright-and-artificial-intelligence)), the Court of Appeal outcome in Getty, the date and appeal status of GEMA v OpenAI, and label licensing deals with AI music services and their effect on user rights.
