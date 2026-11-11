---
id: product.ux.design-process-and-design-systems
department: product
domain: ux
title: 'Product: Design process and design systems'
summary: 'Design process and design systems: the Double Diamond, the design sprint, design critique, design tokens, Figma''s design-system
  features, AI design tools in 2026 and their limits, the accessibility of AI-generated interface code, and what was not sourced.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- web
- figma
objectives:
- launch
sources:
- https://www.designcouncil.org.uk/our-resources/the-double-diamond/
- https://www.gv.com/sprint/
- https://www.nngroup.com/articles/design-critiques/
- https://www.designtokens.org/tr/drafts/format/
- https://www.figma.com/blog/schema-2025-design-systems-recap/
- https://www.nngroup.com/articles/state-of-ux-2026/
- https://developer.apple.com/design/human-interface-guidelines/generative-ai
- https://www.agiledrop.com/blog/web-accessibility-just-got-worse-a-year-into-eaa-enforcement
related:
- product.research.user-research
- product.accessibility.accessibility
seed_version: 1
cross_refs:
  '15':
  - product.research.user-research
  '17':
  - product.accessibility.accessibility
---

**When to use this:** When running a design sprint or critique, working on the design system and tokens, or using AI design tools or AI-generated interface code.

**Source section:** 14. Design process and design systems

### The Double Diamond

**[DURABLE; codified 2003]** The UK Design Council's Double Diamond has four phases: Discover (understand the problem with the people affected), Define (reframe the challenge), Develop (generate a range of answers, co-design) and Deliver (test at small scale, drop what fails, improve what works). It was later extended as the Framework for Innovation, which allows returning to earlier stages. The Design Council itself hosts a piece by its former design director questioning whether the Double Diamond is still fit for purpose ([Design Council, The Double Diamond](https://www.designcouncil.org.uk/our-resources/the-double-diamond/)).

### The design sprint

**[DURABLE; process dates from 2010 to 2012]** The GV design sprint runs five days: Monday, map the challenge and pick a target; Tuesday, sketch solutions individually and start recruiting customers; Wednesday, critique, decide and storyboard; Thursday, build a realistic "fake it" prototype and finalise the interview guide; Friday, interview customers and summarise. Jake Knapp began running sprints at Google in 2010 and took the process to GV in 2012 ([GV, The Design Sprint](https://www.gv.com/sprint/)). **[INFERENCE]** A sprint's Friday test and the five-user guidance in section 15 are consistent: both are problem-discovery exercises and not measurement.

### Design critique

**[DURABLE; practitioner guidance, 23 Oct 2016]** NN/g defines a design critique as a session that improves a design against its objectives; it is not an approval review. Roles are a presenter, critiquers from several disciplines, a rotating facilitator who sets scope and time-boxes, and optionally a recorder. The rules: agree objectives and scope first; tie comments to goals and not taste; ask questions instead of issuing directives; and do not solve in the room. Presenters share work beforehand, state what feedback they want and avoid over-explaining. Formats include a round robin or a quota of positive and negative comments to start discussion, and the suggested starting cadence is 30 minutes weekly within the team ([NN/g, Design Critiques, 23 Oct 2016](https://www.nngroup.com/articles/design-critiques/)).

### Design tokens

**[FAST-MOVING, 2025-2026; community specification, not a W3C Standard]** The Design Tokens Format Module's latest published version is 2025.10. Token files are JSON with the media type `application/design-tokens+json` and the extensions `.tokens` or `.tokens.json`. The specification defines types (colour, dimension in px or rem, font family, font weight, duration, cubic Bézier, number) and composite types (stroke style, border, transition, shadow, gradient, typography), and every token must declare or inherit a type. Aliasing uses `{group.token}` to reference a whole token and JSON Pointer `$ref` to reach a single property; circular references are errors. The fetched page is a preview draft dated 8 September 2026 that says not to implement that draft, so implement 2025.10 ([Design Tokens Community Group, Format Module, preview draft dated 8 Sep 2026](https://www.designtokens.org/tr/drafts/format/)).

**[INFERENCE]** For an agent-run product team, tokens in the 2025.10 JSON format are the natural single source of truth for a design system, because both design tools and code tooling can read them; keep aliases and not resolved values in the source files so that themes stay switchable.

### Figma's design-system features

**[PLATFORM CLAIM; Schema 2025]** At Schema 2025 Figma announced native variables import and export against the Design Tokens Community Group 1.0 specification; "extended collections" for multi-brand systems that inherit updates from a parent; "slots" so that instances can take custom layers without detaching; Code Connect UI (beta) to map components to code; a Figma MCP server (beta) so that language models can generate design-informed code; and "Make kits" that turn libraries into React components and CSS for Figma Make. Variable modes rose to 10 on Professional plans and 20 on Organization plans ([Figma blog, Schema 2025 recap](https://www.figma.com/blog/schema-2025-design-systems-recap/)). **[GAP]** Figma's Schema 2026 announcements and the current state of Figma Make, Dev Mode and the MCP server (general availability, limits) were not checked.

### AI design tools in 2026 and their limits

**[FAST-MOVING, 16 Jan 2026; practitioner opinion]** NN/g's 2026 position is that design systems plus AI prototyping make decent-looking interfaces cheap, so surface-level interface work is becoming replaceable, while curated taste, research-based contextual understanding, critical thinking and judgment are harder to automate. It says AI in 2025 improved and found real uses but still shows inconsistency, hallucinations, edge-case failures and a need for human oversight, and it recommends making the business impact of design work explicit ([NN/g, State of UX 2026, 16 Jan 2026](https://www.nngroup.com/articles/state-of-ux-2026/)). Apple's guidance adds that generative features are easy to prototype but hard to make robust in all real-world situations, because the same input can give different outputs ([Apple Human Interface Guidelines, Generative AI, created 9 Jun 2025, updated 8 Jun 2026](https://developer.apple.com/design/human-interface-guidelines/generative-ai)).

### Accessibility of AI-generated interface code

**[FAST-MOVING, Jul 2026; secondary mention]** An index called AIMAC, from the GAAD Foundation with ServiceNow, audits the accessibility of code generated by AI models using axe-core ([Agiledrop, 7 Jul 2026](https://www.agiledrop.com/blog/web-accessibility-just-got-worse-a-year-into-eaa-enforcement)). **[INFERENCE]** AI-generated interface code should pass the same accessibility gate as human-written code (section 17); the existence of a dedicated benchmark suggests this is a known weak point. **[GAP]** The AIMAC results themselves were not read, and no independent 2026 evaluation of AI design tools was found.

### What was not sourced on design process

**[GAP]** Design-system adoption or return-on-investment data (zeroheight, Figma, Sparkbox surveys), prototyping-fidelity guidance, design-to-engineering handoff practice and design-system governance models were not retrieved; no numbers on them are recorded here.
