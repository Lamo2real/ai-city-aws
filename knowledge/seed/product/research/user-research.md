---
id: product.research.user-research
department: product
domain: research
title: 'Product: User research'
summary: 'User research: choosing a method, sample sizes by goal, the five-user rule and its limits, a decision rule for sample size,
  recruiting and the state of research practice, synthetic users, AI-moderated interviews, thematic analysis and affinity diagramming,
  research repositories, research with people with disabilities, and what was not sourced.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- discover
sources:
- https://www.nngroup.com/articles/which-ux-research-methods/
- https://www.nngroup.com/articles/how-many-test-users/
- https://measuringu.com/five-users/
- https://www.nngroup.com/articles/nps-ux/
- https://www.userinterviews.com/state-of-user-research-report
- https://www.nngroup.com/articles/synthetic-users/
- https://www.nngroup.com/articles/ai-interviewers/
- https://www.nngroup.com/articles/thematic-analysis/
- https://www.nngroup.com/articles/research-repositories/
- https://www.w3.org/WAI/test-evaluate/
- https://www.nngroup.com/articles/ai-in-ux-survey-26/
related: []
seed_version: 1
---

**When to use this:** When choosing a research method or sample size, recruiting, using synthetic users or AI-moderated interviews, or synthesising findings.

**Source section:** 15. User research

### Choosing a research method

**[DURABLE; published 17 Jul 2022, reviewed 15 Jul 2026]** NN/g's framework for choosing a research method uses three dimensions: attitudinal (what people say) versus behavioural (what people do); qualitative (why, and how to fix) versus quantitative (how many, how much); and context of use (natural, scripted, limited, or no product use). Usability studies should lean behavioural rather than attitudinal ([NN/g, When to Use Which User-Experience Research Methods, 17 Jul 2022, reviewed 15 Jul 2026](https://www.nngroup.com/articles/which-ux-research-methods/)).

**[DURABLE]** NN/g's methods by product phase. The table lists them; every row is from the same article.

| Phase | Typical methods | Source |
|---|---|---|
| Strategise | Field studies, diary studies, interviews, surveys, participatory design, concept testing | [NN/g, When to Use Which User-Experience Research Methods, 17 Jul 2022, reviewed 15 Jul 2026](https://www.nngroup.com/articles/which-ux-research-methods/) |
| Design | Card sorting, tree testing, usability testing, remote moderated and unmoderated testing | [NN/g, When to Use Which User-Experience Research Methods, 17 Jul 2022, reviewed 15 Jul 2026](https://www.nngroup.com/articles/which-ux-research-methods/) |
| Launch and assess | Usability benchmarking, unmoderated testing, A/B testing, clickstream and analytics, surveys | [NN/g, When to Use Which User-Experience Research Methods, 17 Jul 2022, reviewed 15 Jul 2026](https://www.nngroup.com/articles/which-ux-research-methods/) |

### Sample sizes by goal

**[DURABLE; pre-2024 but still current guidance]** NN/g's sample-size guidance is 5 users for qualitative usability testing, at least 20 for quantitative studies, at least 15 per user group for card sorting, and 39 for eye-tracking heatmaps ([NN/g, How Many Test Users in a Usability Study?](https://www.nngroup.com/articles/how-many-test-users/)).

### The five-user rule and its limits

**[DURABLE; binomial mathematics]** The five-user figure comes from binomial probability: five users give about an 85% chance of seeing a problem that affects 31% of users, and 31% is an average problem frequency from several studies and not a constant. Five users find only about half of the problems that affect 15% of users; detecting a problem that affects 10% of users needs about 18 users, and a 1% problem needs about 189 ([MeasuringU, Why you only need to test with five users (explained)](https://measuringu.com/five-users/)).

**[DURABLE]** MeasuringU's limits on the five-user rule: problem frequency is often below 10% for released products, so five users is weakest on mature products. The rule applies only to discovering problems, not to comparing designs or estimating task times or completion rates. The advised pattern is to test about 5 users, fix, and repeat with new users, for 15 to 20 in total, and a new user group or task set needs a new sample ([MeasuringU, Why you only need to test with five users (explained)](https://measuringu.com/five-users/)). Small-sample scores are unreliable for attitude metrics: a Net Promoter Score from a five-user test should not be reported ([NN/g, Net Promoter Score, 21 Jun 2024](https://www.nngroup.com/articles/nps-ux/)).

### A decision rule for sample size

**[INFERENCE]** The department's rule: if the question is what is wrong and why, run 5 users per distinct user group and iterate; if it is how much, or whether A is better than B, plan 20 or more and report confidence intervals; if the product is mature and remaining problems are rare, five-user rounds will mostly return nothing new, so add analytics, support-ticket mining or larger unmoderated tests. The rule is the researchers' synthesis from NN/g ([NN/g, How Many Test Users in a Usability Study?](https://www.nngroup.com/articles/how-many-test-users/)) and MeasuringU ([MeasuringU, Why you only need to test with five users (explained)](https://measuringu.com/five-users/)).

### Recruiting and the state of research practice

**[VENDOR; surveyed 25 Jul to 9 Aug 2025]** User Interviews, a vendor, surveyed 485 researchers. Finding enough qualified participants, recruiting time and participant quality remain the biggest recruiting problems; 54% cite time to recruit, and more than 70% use a tool for qualitative recruiting. On AI, 80% of researchers use it, up 24 points in a year; 91% worry about accuracy and hallucinations; 63% fear AI devalues human insight; and 41% see AI's effect on UX research as negative against 32% positive ([User Interviews, State of User Research 2025, surveyed 25 Jul to 9 Aug 2025](https://www.userinterviews.com/state-of-user-research-report)). The sample shrank 36% year on year, which limits trend claims, and no 2026 edition was found.

### Synthetic users

**[FAST-MOVING, 21 Jun 2024; small comparative study]** NN/g compared synthetic users with three earlier real-user studies and found that synthetic users gave shallower and more favourable answers than real participants and did not reflect real behaviour well. The failure modes were sycophancy (a synthetic learner claimed to finish all seven courses where a real learner finished three), idealised one-dimensional behaviour, long unprioritised lists, no real behavioural data, overly positive concept tests, patchy coverage of niche groups, and a skew toward what people post online ([NN/g, Synthetic Users, 21 Jun 2024](https://www.nngroup.com/articles/synthetic-users/)).

**[FAST-MOVING, 21 Jun 2024; practitioner guidance]** NN/g's acceptable uses of synthetic users are desk research on an unfamiliar user group; hypotheses, proto-personas and proto-journey maps to test later with people; and piloting an interview guide. Not acceptable are final decisions, replacing real users, or presenting synthetic output as user findings. NN/g warns the risk is highest in organisations with low UX maturity, where stakeholders may treat synthetic output as a substitute for research ([NN/g, Synthetic Users, 21 Jun 2024](https://www.nngroup.com/articles/synthetic-users/)). **[INFERENCE]** The study predates current models; its direction is likely still valid because sycophancy and missing behavioural data are structural, but the size of the gap today is unverified. **[GAP]** No peer-reviewed 2025 to 2026 study comparing synthetic and human participants was read.

### AI-moderated interviews

**[FAST-MOVING, 30 Jan 2026; small qualitative study]** NN/g tested two AI interviewer products with 10 research professionals using the same guide. Strengths: concise summaries that made people feel heard, follow-up on short answers when told to probe, consistent questions, and a full interview in another language on request. Weaknesses: the AI stuck to the script and missed unexpected leads; it could not judge when a topic was covered, with sessions running 13 to 56 minutes; there were interruptions or long pauses; questions were repetitive and praise felt insincere; and behaviour varied between sessions. Only 3 of 10 found the conversation natural and 5 of 10 felt comfortable, and some withheld information ([NN/g, AI-Moderated Interviews, 30 Jan 2026](https://www.nngroup.com/articles/ai-interviewers/)). The study is small and shows kinds of problems, not rates.

**[FAST-MOVING, 30 Jan 2026; practitioner guidance]** NN/g's recommendation is that AI-moderated interviews suit structured work, such as post-launch feedback, screening, multilingual interviews and teams without researchers, and are unsuitable for exploratory discovery, deep-domain topics and task observation; they supplement human moderation and do not replace it ([NN/g, AI-Moderated Interviews, 30 Jan 2026](https://www.nngroup.com/articles/ai-interviewers/)). **[INFERENCE]** The department's policy: AI moderators for structured follow-ups at volume and humans for discovery interviews, with a clear consent and introduction step, since its absence made participants hold back.

### Synthesis: thematic analysis and affinity diagramming

**[DURABLE; method guidance, 17 Aug 2022, reviewed 2 Sep 2026]** NN/g's thematic analysis has six steps: gather the data, transcribing instead of relying on memory; read everything; code segments; group codes into candidate themes, looking for contradictions as well as similarities; take a day's break; and test each theme for support across participants and agreement between analysts. Affinity diagramming is the quick collaborative version: fast, cheap and visual, but less thorough and hard with large or varied data. The pitfalls are skimming, restating instead of interpreting, ignoring data that conflicts with beliefs, and having no defined goal ([NN/g, How to Analyze Qualitative Data: Thematic Analysis, 17 Aug 2022, reviewed 2 Sep 2026](https://www.nngroup.com/articles/thematic-analysis/)).

### Research repositories

**[DURABLE; practitioner guidance, 5 Jul 2024]** NN/g defines a research repository as a central store of research outputs and artefacts: reports, individual insights, plans and screeners, recordings and transcripts, and raw notes. There are two models, which can be combined: document libraries, which are easy to contribute to and hard to search, and insight databases, which are easy to search and costly to maintain, with insights that lose context and need retiring ([NN/g, Research Repositories, 5 Jul 2024](https://www.nngroup.com/articles/research-repositories/)). **[FAST-MOVING, Jul 2024; survey]** In NN/g's survey of 411 respondents, 43% used general collaboration tools as their repository, 32% dedicated research tools and 14% database tools ([NN/g, Research Repositories, 5 Jul 2024](https://www.nngroup.com/articles/research-repositories/)).

**[DURABLE; practitioner guidance, 5 Jul 2024]** NN/g's success factors for a research repository are easy access, controlled permissions for participant data, a few broad tags to start, strong search, a small first import, and onboarding with reminders. Common failures are over-granular tagging, unfamiliar tools and no change-management plan. Ownership usually sits with research operations ([NN/g, Research Repositories, 5 Jul 2024](https://www.nngroup.com/articles/research-repositories/)). **[INFERENCE]** Synthetic-user and AI-moderated outputs should be stored and labelled separately from human findings in the repository, following NN/g's rule against presenting synthetic output as user findings ([NN/g, Synthetic Users, 21 Jun 2024](https://www.nngroup.com/articles/synthetic-users/)).

### Research with people with disabilities

**[DURABLE; W3C guidance]** W3C's guidance is to include people with disabilities in evaluation throughout development and not only at the end ([W3C WAI, Evaluating Web Accessibility Overview](https://www.w3.org/WAI/test-evaluate/)).

### What was not sourced on user research

**[GAP]** Interview rapport, probing and number-of-interviews guidance, diary studies, tree testing, session replay, recruiting incentive benchmarks, and GDPR handling of research participants' data were not researched. NN/g's 2026 survey on AI in UX work exists but was not read ([NN/g, AI in UX survey 2026, title only, not read](https://www.nngroup.com/articles/ai-in-ux-survey-26/)).
