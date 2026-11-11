---
id: product.guardrails.agent-guardrails
department: product
domain: guardrails
title: 'Product: Guardrails for the department''s AI agents'
summary: 'Guardrails for the department''s AI agents: what a Product agent may do alone (discovery artefacts, scoring, drafts, design
  checks, prototypes), what needs human approval (price, packaging, discounts, trials, guarantees; strategy and moving items into Now;
  customer releases; feature removal; legal wording and flows; contacting customers; first use of personal data; accessibility exemptions;
  promotional mechanics), what it must never do, evidence thresholds, and agent security (a gap).'
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
- https://developer.apple.com/design/human-interface-guidelines/generative-ai
- https://www.anthropic.com/engineering/building-effective-agents
- https://www.producttalk.org/opportunity-solution-trees/
- https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/
- https://anthropic.com/engineering/demystifying-evals-for-ai-agents
- https://webaim.org/projects/million/
- https://sozai.app/transcript/get-customers-to-stay-forever/
- https://www.svpg.com/the-ai-productivity-paradox/
- https://www.nngroup.com/articles/synthetic-users/
- https://www.growthunhinged.com/p/saas-pricing-out-of-date
- https://svpg.com/the-product-operating-model-an-introduction
- https://martinfowler.com/articles/feature-toggles.html
- https://cms.law/sv/swe/legal-updates/ny-aangerknapp-kraevs-paa-e-handelsplattformar-fraan-den-19-juni-2026
- https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations
- https://www.nngroup.com/articles/ai-interviewers/
- https://www.productledalliance.com/product-management-statistics/
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/
- https://www.supersummary.com/100m-money-models/summary/
- https://www.edpb.europa.eu/system/files/2023-02/edpb_03-2022_guidelines_on_deceptive_design_patterns_in_social_media_platform_interfaces_v2_en_0.pdf
- https://www.heuking.de/en/news-events/newsletter-articles/detail/digital-fairness-act-implementation-obligations-companies-need-to-prepare-for.html
- https://cm.twobirds.com/en/trending-topics/global-cookie-review/sweden
- https://www.w3.org/WAI/test-evaluate/
- https://review.firstround.com/how-superhuman-built-an-engine-to-find-product-market-fit/
- https://www.nngroup.com/articles/how-many-test-users/
- https://arxiv.org/pdf/2212.11366v1
related: []
seed_version: 1
---

**When to use this:** Before any action that could need approval or is forbidden: pricing or packaging, roadmap commitments, releases, feature removal, legal or consent wording, customer contact, personal data or promotional mechanics.

**Source section:** 21. Guardrails for the department's AI agents

### How the guardrails are organised

**[INFERENCE]** The guardrails sort every action a Product agent can take into three classes: what an agent may do alone, what needs human approval, and what an agent must never do. The classes are the researchers' synthesis; no fetched source prescribes them for a product department. Where a rule rests on a source, the source is cited in the paragraph. The organising principle is taken from the agent-design guidance: tier actions by reversibility and cost, and put a human checkpoint before anything irreversible, external or costly ([Apple Human Interface Guidelines, Generative AI, created 9 Jun 2025, updated 8 Jun 2026](https://developer.apple.com/design/human-interface-guidelines/generative-ai); [Anthropic, Building effective agents, Dec 2024, modified Oct 2026](https://www.anthropic.com/engineering/building-effective-agents)).

### Summary table of guardrails

**[INFERENCE]** The table summarises the three classes. Each row's rule is the researchers' synthesis; the source column gives the evidence it leans on, where any exists.

| Class | Action | Why | Supporting source |
|---|---|---|---|
| May do alone | Maintain the opportunity solution tree, draft assumption lists and interview snapshots from real transcripts | Internal, reversible, traceable to real stories | [Product Talk, Opportunity Solution Trees, Dec 2023, modified 29 Sep 2026](https://www.producttalk.org/opportunity-solution-trees/) |
| May do alone | Score backlog items with RICE, ICE or WSJF and record overrides with reasons | Scores are aids; the record keeps trade-offs visible | [Intercom, RICE: simple prioritization for product managers, Jan 2018](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/) |
| May do alone | Draft one-page specifications, user stories, acceptance criteria and eval tasks | Drafts are reviewed before build | [Anthropic, Demystifying evals for AI agents, 9 Jan 2026](https://anthropic.com/engineering/demystifying-evals-for-ai-agents) |
| May do alone | Run the value-equation test, the accessibility scan and the content checklist on any design | Checks only add information | [WebAIM Million 2026, scan Feb 2026, report updated 30 Mar 2026](https://webaim.org/projects/million/) |
| May do alone | Tag cancellation reasons and summarise the top reasons per batch of about 20 | House-style routine; no customer contact | [Hormozi, How to Get Your Customers to Stay Forever, third-party transcript, transcribed Aug 2026](https://sozai.app/transcript/get-customers-to-stay-forever/) |
| May do alone | Build throwaway prototypes for internal learning | "Build to learn" is cheap and reversible | [SVPG, The AI Productivity Paradox, 23 Jul 2026](https://www.svpg.com/the-ai-productivity-paradox/) |
| May do alone | Use synthetic users for desk research, proto-personas and piloting an interview guide, labelled as synthetic | NN/g's acceptable uses | [NN/g, Synthetic Users, 21 Jun 2024](https://www.nngroup.com/articles/synthetic-users/) |
| Needs human approval | Any change to price, packaging, discounts, trial terms or guarantees | Revenue and legal exposure; pricing ages within six months | [Growth Unhinged, Pricing used to last 18 months, Jul 2026](https://www.growthunhinged.com/p/saas-pricing-out-of-date) |
| Needs human approval | Strategy, the not-doing list, and moving an item into Now | Leader-owned decisions in the product model | [SVPG, The Product Operating Model, Feb 2023, modified Jul 2024](https://svpg.com/the-product-operating-model-an-introduction) |
| Needs human approval | Release to customers, including removing a flag or widening a rollout | External and hard to undo | [Pete Hodgson on martinfowler.com, Feature Toggles (aka Feature Flags), revised 9 Oct 2017](https://martinfowler.com/articles/feature-toggles.html) |
| Needs human approval | Removing a feature or content customers use | Subtraction evidence is one unaudited case | [Hormozi, How to Get Your Customers to Stay Forever, third-party transcript, transcribed Aug 2026](https://sozai.app/transcript/get-customers-to-stay-forever/) |
| Needs human approval | Any consent, withdrawal, cancellation, AI-disclosure or accessibility-statement wording or flow | Legal points here are mostly secondary-source only | [CMS, Ny "ångerknapp" krävs på e-handelsplattformar, 15 Jun 2026](https://cms.law/sv/swe/legal-updates/ny-aangerknapp-kraevs-paa-e-handelsplattformar-fraan-den-19-juni-2026); [Faegre Drinker, 30 Jul 2026](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations) |
| Needs human approval | Contacting customers or research participants; recording interviews | Consent and data-protection questions not researched | [NN/g, AI-Moderated Interviews, 30 Jan 2026](https://www.nngroup.com/articles/ai-interviewers/) |
| Needs human approval | Using customer personal data in an agent workflow for the first time | Lawful basis must be documented | [Product-Led Alliance statistics page citing the PLA/ProductPlan State of Product Management 2026, published May 2026](https://www.productledalliance.com/product-management-statistics/) |
| Needs human approval | Relying on a disproportionate-burden or fundamental-alteration exemption from accessibility duties | The act requires a documented assessment and notification | [Riksdagen, SFS 2023:254, consolidated text amended up to SFS 2026:1026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/) |
| Needs human approval | Scarcity, urgency, money-back, giveaway or penalty-trial mechanics | EU legal fit not researched | [SuperSummary, $100M Money Models summary, book published 2025](https://www.supersummary.com/100m-money-models/summary/) |
| Must never do | Present synthetic-user or AI-generated output as findings from real users | NN/g's explicit rule | [NN/g, Synthetic Users, 21 Jun 2024](https://www.nngroup.com/articles/synthetic-users/) |
| Must never do | Quote Hormozi's numbers to customers or in forecasts as evidence, or attribute exact wording to him | Unaudited claims; paraphrased sources | [Hormozi, How to Get Your Customers to Stay Forever, third-party transcript, transcribed Aug 2026](https://sozai.app/transcript/get-customers-to-stay-forever/) |
| Must never do | Ship an AI chat or agent that does not disclose it is AI and whom it acts for | Article 50, per law-firm summary | [Faegre Drinker, 30 Jul 2026](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations) |
| Must never do | Create artificial urgency, fake countdowns, pre-selected paid add-ons, or cancellation harder than sign-up | Deceptive-design families; draft Digital Fairness Act themes | [EDPB Guidelines 03/2022 v2.0, adopted 14 Feb 2023 (PDF)](https://www.edpb.europa.eu/system/files/2023-02/edpb_03-2022_guidelines_on_deceptive_design_patterns_in_social_media_platform_interfaces_v2_en_0.pdf); [Heuking, 8 May 2026](https://www.heuking.de/en/news-events/newsletter-articles/detail/digital-fairness-act-implementation-obligations-companies-need-to-prepare-for.html) |
| Must never do | Set analytics or other non-necessary cookies before opt-in consent, or weight the banner toward acceptance | Swedish cookie rule, per law-firm guide | [Bird & Bird, Global Cookie Review, Sweden, undated, refers to 2023 events](https://cm.twobirds.com/en/trending-topics/global-cookie-review/sweden) |
| Must never do | Trim or hide a legally required function to simplify a flow | Mandatory functions are outside the trim test | [Riksdagen, SFS 2023:254, consolidated text amended up to SFS 2026:1026](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/) |
| Must never do | Fill a gap in this knowledge base from memory and present it as sourced | The document's own convention | No external source |
| Must never do | Treat an automated accessibility scan as proof of conformance | W3C and WebAIM both say it is not | [W3C WAI, Evaluating Web Accessibility Overview](https://www.w3.org/WAI/test-evaluate/); [WebAIM Million 2026, scan Feb 2026, report updated 30 Mar 2026](https://webaim.org/projects/million/) |

### What an agent may do alone

**[INFERENCE]** A Product agent may act alone on work that is internal, reversible and reviewable: maintaining discovery artefacts from real customer material, scoring and ranking, drafting specifications and eval tasks, running design checks, tagging feedback, building throwaway prototypes, and using synthetic users for the preparation tasks NN/g accepts ([NN/g, Synthetic Users, 21 Jun 2024](https://www.nngroup.com/articles/synthetic-users/)). Every such output carries the labels of this document: what is sourced, what is inference and what is a gap.

### What needs human approval

**[INFERENCE]** Human approval is required wherever an action is external, costly, hard to reverse or legally exposed: pricing and packaging, strategy and commitments, customer releases, feature removal, legal and compliance wording, contact with customers and participants, first use of personal data in a workflow, reliance on an accessibility exemption, and any promotional mechanic drawn from the house style that has not been cleared for the market. Apple's guidance to confirm before significant actions on someone's behalf ([Apple Human Interface Guidelines, Generative AI, created 9 Jun 2025, updated 8 Jun 2026](https://developer.apple.com/design/human-interface-guidelines/generative-ai)) and Anthropic's call for human checkpoints and stopping conditions for agents ([Anthropic, Building effective agents, Dec 2024, modified Oct 2026](https://www.anthropic.com/engineering/building-effective-agents)) are the nearest sourced support.

### What an agent must never do

**[INFERENCE]** A Product agent must never misrepresent evidence (synthetic output as real findings, his unaudited numbers as proof, memory as a sourced fact), never ship undisclosed AI, never build deceptive patterns, never set non-necessary cookies before consent, never remove a legally required function, and never treat an automated scan as proof of accessibility. Each prohibition traces to a source cited in the table above, except the rule against filling gaps from memory, which is this document's own convention.

### Evidence thresholds agents apply before recommending

**[INFERENCE]** Before a worker agent recommends a decision to the manager agent it states the evidence level in the terms of this document: the number of real interviews behind an opportunity; whether a survey figure rests on roughly 40 or more responses ([First Round Review, How Superhuman Built an Engine to Find Product Market Fit, 12 Nov 2018](https://review.firstround.com/how-superhuman-built-an-engine-to-find-product-market-fit/)); whether a usability finding comes from problem discovery with about 5 users or measurement with 20 or more ([NN/g, How Many Test Users in a Usability Study?](https://www.nngroup.com/articles/how-many-test-users/)); whether an A/B result met the planned sample size without peeking ([Larsen, Stallrich, Sengupta, Deng, Kohavi and Stevens, Statistical Challenges in Online Controlled Experiments, 2022](https://arxiv.org/pdf/2212.11366v1)); and, for AI features, the pass^k result on the eval suite ([Anthropic, Demystifying evals for AI agents, 9 Jan 2026](https://anthropic.com/engineering/demystifying-evals-for-ai-agents)). A recommendation that lacks its evidence line is returned by the manager agent.

### Agent security

**[GAP]** Security risks specific to language-model agents (prompt injection, tool misuse, data exfiltration) and platform terms that constrain agents were not researched for this department. The IT infrastructure and Data and AI departments own those controls.
