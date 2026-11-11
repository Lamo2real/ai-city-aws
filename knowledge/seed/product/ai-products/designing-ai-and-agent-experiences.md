---
id: product.ai-products.designing-ai-and-agent-experiences
department: product
domain: ai-products
title: 'Product: Designing AI and agent experiences'
summary: 'Designing AI and agent experiences: Microsoft''s 18 guidelines for human-AI interaction; Apple''s generative AI guidance (disclosure,
  expectations, control, approval, uncertainty, recovery, latency, fallback, privacy, feedback, testing); Google PAIR on calibrated
  trust, explanation and confidence; NN/g on agents in 2026 and its agent usability study; a pattern set and a checklist for an agent
  that acts on a user''s behalf; what was not sourced.'
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- ios
objectives:
- launch
sources:
- https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/
- https://www.microsoft.com/en-us/haxtoolkit/library/
- https://developer.apple.com/design/human-interface-guidelines/generative-ai
- https://pair.withgoogle.com/chapter/explainability-trust/
- https://pair.withgoogle.com/guidebook/
- https://www.nngroup.com/articles/state-of-ux-2026/
- https://www.nngroup.com/articles/designing-ai-agents/
- https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations
- https://arxiv.org/pdf/2509.14528
related: []
seed_version: 1
---

**When to use this:** When designing the experience of an AI feature or an agent that acts for a user: disclosure, confidence, approval, recovery and feedback patterns.

**Source section:** 19. Designing AI and agent experiences

### Microsoft's 18 guidelines for human-AI interaction

**[DURABLE; published set with pre-2024 origin]** Microsoft's HAX guidelines are organised by four moments: initially, during interaction, when the system is wrong, and over time ([Microsoft HAX Toolkit, Guidelines](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/)). The 18 guidelines are: make clear what the system can do; make clear how well it can do it; time services based on context; show contextually relevant information; match relevant social norms; mitigate social biases; support efficient invocation; support efficient dismissal; support efficient correction; scope services when in doubt; make clear why the system did what it did; remember recent interactions; learn from user behaviour; update and adapt cautiously; encourage granular feedback; convey the consequences of user actions; provide global controls; and notify users about changes ([Microsoft HAX Toolkit, Design Library](https://www.microsoft.com/en-us/haxtoolkit/library/)).

### Apple's generative AI guidance: disclosure, expectations and control

**[FAST-MOVING, updated 8 Jun 2026; platform guidance]** Apple's Human Interface Guidelines for generative AI say: tell people when and where AI is used, never let someone believe they are dealing with a human or human-authored content when it is AI, and align with regional regulation. State what the feature can and cannot do, offer curated example prompts for open-ended inputs, and explain known limitations up front. Let people dismiss generated content and revert or retry; place Edit, Undo, Retry or Adjust next to the output; and confirm visibly when a correction took effect, a point added in June 2026 ([Apple Human Interface Guidelines, Generative AI, created 9 Jun 2025, updated 8 Jun 2026](https://developer.apple.com/design/human-interface-guidelines/generative-ai)).

### Apple's generative AI guidance: approval, uncertainty and recovery

**[FAST-MOVING, updated 8 Jun 2026; platform guidance]** Apple advises against automating destructive or hard-to-undo actions such as deleting data or purchasing, and generally asks for confirmation before a significant action on someone's behalf. On uncertainty: state clearly that generated content may contain errors, avoid asking the model for facts unless it has verified, current information, and do not use generated content where a hallucination could harm. On recovery: when output is blocked or poor, coach the person toward a better request and offer examples, and on failure explain in plain language with a next step ([Apple Human Interface Guidelines, Generative AI, created 9 Jun 2025, updated 8 Jun 2026](https://developer.apple.com/design/human-interface-guidelines/generative-ai)).

### Apple's generative AI guidance: latency, fallback, privacy, feedback and testing

**[FAST-MOVING, updated 8 Jun 2026; platform guidance]** Apple's further points: design a loading state or generate in the background, with specific progress messages; consider offering several meaningfully different results; keep the product useful when AI is unavailable or declined; ask permission before using personal or usage data, use the minimum, offer opt-out, and say whether data is sent to a server or used for training; make feedback voluntary and non-interrupting, with a quick thumbs up or down plus an optional detailed route; ask rather than infer personal characteristics; and test with diverse people and with vague, out-of-scope, sensitive and adversarial requests ([Apple Human Interface Guidelines, Generative AI, created 9 Jun 2025, updated 8 Jun 2026](https://developer.apple.com/design/human-interface-guidelines/generative-ai)).

### Google PAIR: calibrated trust and explanation

**[VENDOR; undated chapter, no version shown]** The explainability and trust chapter of Google's People + AI Guidebook aims for calibrated trust, where users neither trust fully nor dismiss. It advises explaining what data is used, whether it is personal or aggregated, and whether it can be reset, and scaling the explanation to the stakes. In high-stakes cases give the reason with the output; skip explanation when behaviour matches expectations; and say when missing data means the user should rely on their own judgment ([Google PAIR, People + AI Guidebook, Explainability + Trust chapter, undated](https://pair.withgoogle.com/chapter/explainability-trust/)). The guidebook describes itself as a toolkit for teams building human-centred AI products ([Google PAIR Guidebook home page](https://pair.withgoogle.com/guidebook/)).

### Google PAIR: showing confidence

**[VENDOR; undated chapter]** Google PAIR's options for displaying model confidence are categories such as high, medium and low with an action per bucket; several best alternatives; a numeric percentage, which is risky for novices; or visual ranges for experts. The first decision is whether showing confidence helps decisions at all, and the display should be tested with varied users ([Google PAIR, People + AI Guidebook, Explainability + Trust chapter, undated](https://pair.withgoogle.com/chapter/explainability-trust/)). **[GAP]** Only this one chapter of the guidebook was readable; its chapters on mental models, feedback and control, and errors are not recorded.

### NN/g on agents in 2026

**[FAST-MOVING, 16 Jan 2026; practitioner opinion]** NN/g's 2026 overview says more interactions are mediated by assistants, agents and AI summaries, so people delegate tasks instead of navigating interfaces; that agents are often released before they are ready, which erodes confidence; that users are tiring of low-value AI features; and that trust requires transparency, control, consistency and support on failure ([NN/g, State of UX 2026, 16 Jan 2026](https://www.nngroup.com/articles/state-of-ux-2026/)). NN/g describes an agent as a system that pursues a goal through steps, checks progress and chooses next steps itself ([NN/g, Designing AI Agents, 8 May 2026](https://www.nngroup.com/articles/designing-ai-agents/)).

### NN/g's agent usability study

**[FAST-MOVING, 8 May 2026; small qualitative study]** NN/g observed six participants in China using one consumer agent to place orders. Five of six defaulted to familiar apps over the agent. The problems observed: a prefilled prompt sent the wrong request; a one-at-a-time carousel hid how many options existed; granting access exposed a full home address at once; a listed price of ¥1.6 became ¥10.2 at checkout; and missing details such as baggage allowance sent a user elsewhere ([NN/g, Designing AI Agents, 8 May 2026](https://www.nngroup.com/articles/designing-ai-agents/)). The study is small and covers a consumer ordering agent, so it shows kinds of problems and not rates, and transfer to B2B SaaS agents is by analogy.

**[FAST-MOVING, 8 May 2026; practitioner guidance]** NN/g's recommendations for agent design: offer both free-text and menu entry; ask a clarifying question instead of auto-sending a guess; reuse familiar interface patterns and show result counts; state what data is accessed, require acknowledgement and reveal only what the step needs; show full costs and decision-critical details before commitment; and let users adjust, review and authorise payment ([NN/g, Designing AI Agents, 8 May 2026](https://www.nngroup.com/articles/designing-ai-agents/)).

### A pattern set for agent experiences

**[INFERENCE]** The department's pattern set for agent experiences, meant to satisfy the Microsoft, Apple and Article 50 points together, has ten parts: a statement of capability and limits at entry; a plan preview before multi-step work; an approval gate before any irreversible, external or costly action, showing exactly what will happen; a visible activity log with specific status text; undo or rollback for every reversible action; sources or evidence next to factual claims, with an explicit "may be wrong" where no source exists; a correction path that confirms the change took effect; stop and global off controls; a non-AI fallback route; and change notices when behaviour updates. The set is the researchers' synthesis ([Microsoft HAX Toolkit, Design Library](https://www.microsoft.com/en-us/haxtoolkit/library/); [Apple Human Interface Guidelines, Generative AI, created 9 Jun 2025, updated 8 Jun 2026](https://developer.apple.com/design/human-interface-guidelines/generative-ai); [Faegre Drinker, 30 Jul 2026](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations)). Showing sources is the researchers' extension: it is not stated as a guideline on the fetched Apple or Microsoft pages, where the closest points are explaining why the system did what it did and avoiding unverified factual output.

### A checklist for an agent that acts on a user's behalf

**[INFERENCE]** Combining the NN/g and Google PAIR points gives a checklist for an agent that acts for a user: clarify before acting; show what data is used; show full consequences before commitment; give confidence only where it changes the decision; and keep an approve-or-edit step for payments and irreversible actions ([NN/g, Designing AI Agents, 8 May 2026](https://www.nngroup.com/articles/designing-ai-agents/); [Google PAIR, People + AI Guidebook, Explainability + Trust chapter, undated](https://pair.withgoogle.com/chapter/explainability-trust/)). Approval frequency is a trade-off: Apple says to confirm significant actions "generally" ([Apple Human Interface Guidelines, Generative AI, created 9 Jun 2025, updated 8 Jun 2026](https://developer.apple.com/design/human-interface-guidelines/generative-ai)), and the Article 50 summary lists disclosure at authorisation steps ([Faegre Drinker, 30 Jul 2026](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations)), so tiering actions by reversibility and cost is the workable design.

### What was not sourced on AI and agent experiences

**[GAP]** No empirical evidence was found on how users respond to confidence indicators, citations or approval prompts, for example over-trust or prompt fatigue. Material Design guidance on AI, and agent-design guidance from OpenAI or other vendors, were not reviewed. A relevant academic paper on agent usability exists but was not read ([arXiv, Why Johnny Can't Use Agents, title only, not read](https://arxiv.org/pdf/2509.14528)).
