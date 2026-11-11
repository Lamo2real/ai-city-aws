---
id: research.ai-research.reliable-ai-assisted-research
department: research
domain: ai-research
title: 'Research: Reliable AI-assisted research'
summary: 'Reliable AI-assisted research: links resolve, claims often do not. Citation-fidelity evidence; Failure modes; Verification practice; Multi-agent workflows; Retrieval: scholarly APIs and their limits; Retrieval: robots.txt, AI preferences and lawful access.'
type: playbook
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- scholarly-apis
- web
objectives:
- evidence
sources:
- https://arxiv.org/html/2605.06635
- https://arxiv.org/abs/2604.03173
- https://arxiv.org/abs/2508.15804
- https://www.cjr.org/tow_center/we-compared-eight-ai-search-engines-theyre-all-bad-at-citing-news.php
- https://www.ebu.ch/news/2025/10/ai-s-systemic-distortion-of-news-is-consistent-across-languages-and-territories-international-study-by-public-service-broadcaste
- https://openai.com/index/introducing-deep-research/
- https://www.anthropic.com/engineering/multi-agent-research-system
- https://www.anthropic.com/research/prompt-injection-defenses
- https://allea.org/wp-content/uploads/2023/06/European-Code-of-Conduct-Revised-Edition-2023.pdf
- https://info.arxiv.org/help/api/tou.html
- https://help.openalex.org/api/authentication/
- https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/
- https://www.crossref.org/documentation/retrieve-metadata/rest-api/tips-for-using-the-crossref-rest-api/
- https://www.semanticscholar.org/product/api
- https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`
- https://www.ncbi.nlm.nih.gov/books/NBK25497/
- https://www.rfc-editor.org/rfc/rfc9309.html
- https://datatracker.ietf.org/wg/aipref/about/
related:
- research.guardrails.agent-guardrails
- research.compliance.web-scraping-and-data-access
- research.desk-research.desk-research
cross_refs:
  '12':
  - research.compliance.copyright-and-text-and-data-mining
  '13':
  - research.compliance.web-scraping-and-data-access
seed_version: 1
---

**When to use this:** Whenever an agent researches: citation fidelity, failure modes, claim-by-claim verification, multi-agent workflows, scholarly APIs and lawful retrieval.

**Source section:** 11. Reliable AI-assisted research: links resolve, claims often do not

## 11. Reliable AI-assisted research: links resolve, claims often do not

### 11.1 Citation-fidelity evidence

[FAST-MOVING, 7 May 2026] The central measured fact: a working, on-topic link is not evidence that the source supports the claim. A preprint by PwC authors (arXiv 2605.06635, 7 May 2026) tested 14 LLMs on 130 queries from DeepResearch Bench and BrowseComp and found, for frontier models, link validity above 94% and topical relevance above 80% but factual support of only about 39 to 77%. The best was Claude Opus 4.5 at 76.8%, and GPT-5.4 had 100% working links with 47.7% factual support ([arXiv 2605.06635](https://arxiv.org/html/2605.06635)). Scoring used an LLM judge calibrated against humans; the paper is a preprint.

[FAST-MOVING, 7 May 2026] Accuracy falls with depth. In the same May 2026 preprint, factual support fell from 79% at 2 tool calls to 17% at 150 for GPT-5.4 and from 80% to 58% for Claude Opus 4.6, and providers that generated more citations tended to score lower ([arXiv 2605.06635](https://arxiv.org/html/2605.06635)).

[FAST-MOVING, 3 Apr 2026] Fabricated and dead URLs remain common without tooling. A preprint by Rao, Wong and Callison-Burch (arXiv 2604.03173, 3 April 2026) covering 10 models and agents on DRBench (53,090 URLs) and 3 on ExpertQA (168,021 URLs) found 3 to 13% of cited URLs were hallucinated, with no Wayback record, and 5 to 18% did not resolve; deep research agents cite more per query and hallucinate URLs at higher rates than search-augmented LLMs ([arXiv 2604.03173](https://arxiv.org/abs/2604.03173)).

[FAST-MOVING, 3 Apr 2026] A mechanical liveness check works. Giving the agent a URL-liveness tool cut non-resolving citations by a factor of 6 to 79, to under 1%, depending on the model's tool-use skill (April 2026 preprint, [arXiv 2604.03173](https://arxiv.org/abs/2604.03173)).

[FAST-MOVING, 14 Aug 2025] ReportBench (14 August 2025, preprint) found commercial deep research agents more reliable than plain LLMs with search, while factual consistency still had "substantial room for improvement"; only the abstract was read and no figures were retrieved ([arXiv 2508.15804](https://arxiv.org/abs/2508.15804)).

[FAST-MOVING, 6 Mar 2025] Consumer AI search tools misattribute news. The Tow Center study (published 6 March 2025, tests in February 2025) ran 1,600 queries across 8 AI search tools asking them to identify the source article of a news excerpt: over 60% of answers were wrong overall, Perplexity was wrong 37% of the time and Grok 3 94%, more than half of Gemini and Grok 3 responses cited fabricated or broken URLs, ChatGPT signalled uncertainty in 15 of 200 answers, paid tiers answered more but were more often confidently wrong, and several tools returned content from publishers that blocked their crawlers. The study used one run per excerpt ([CJR Tow Center](https://www.cjr.org/tow_center/we-compared-eight-ai-search-engines-theyre-all-bad-at-citing-news.php)).

[FAST-MOVING, 22 Oct 2025] An EBU and BBC study (22 October 2025) of 22 public broadcasters in 18 countries and 14 languages had journalists judge over 3,000 answers from ChatGPT, Copilot, Gemini and Perplexity: 45% had at least one significant issue, 31% had serious sourcing problems, 20% had major accuracy issues including hallucinated and outdated details, and Gemini had significant issues in 76% of answers ([EBU](https://www.ebu.ch/news/2025/10/ai-s-systemic-distortion-of-news-is-consistent-across-languages-and-territories-international-study-by-public-service-broadcaste)).

[INFERENCE] The two news studies test consumer assistants on news tasks and not enterprise research agents, so their percentages show direction and are not the error rate of any internal agent. No November 2026 benchmark was found; the newest evidence is from May 2026 and the tested model versions may already be superseded.

[PLATFORM CLAIM] [FAST-MOVING, 10 Feb 2026] OpenAI describes its deep research product (published 2 February 2025, page updated to 10 February 2026) as running multi-step web research over text, images and PDFs in typically 5 to 30 minutes, and itself states that it can hallucinate facts, may struggle to tell authoritative information from rumour, and is weak at conveying uncertainty ([OpenAI](https://openai.com/index/introducing-deep-research/)).

### 11.2 Failure modes

[INFERENCE] Eight failure modes for the knowledge base, each tied to evidence in this section: fabricated or dead URLs (3 to 13% hallucinated in the April 2026 preprint); a real, on-topic source that does not support the claim, the largest measured problem; misattribution to syndicated copies in place of the original; outdated information; confident wording without uncertainty; low-quality or SEO sources; injected instructions in fetched pages; and quality loss on long runs with many citations.

[PLATFORM CLAIM] [FAST-MOVING, 13 Jun 2025] Source-quality failure is real and hard to catch automatically. Anthropic reports that its early research agents preferred SEO content farms to authoritative sources, and that human testers and not automated evaluations caught this ([Anthropic Engineering, 13 Jun 2025](https://www.anthropic.com/engineering/multi-agent-research-system)). The Tow Center study adds that chatbots often cite syndicated or copied versions of an article instead of the original publisher ([CJR Tow Center, 6 Mar 2025](https://www.cjr.org/tow_center/we-compared-eight-ai-search-engines-theyre-all-bad-at-citing-news.php)).

[PLATFORM CLAIM] [FAST-MOVING, 24 Nov 2025] Every page a browsing agent reads is a possible attack vector. Anthropic reported on 24 November 2025 that measured prompt-injection attack success with safeguards was about 1.4 to 2.4% per model against an adaptive attacker on its internal benchmark, and that no browser agent is immune ([Anthropic](https://www.anthropic.com/research/prompt-injection-defenses)).

[FAST-MOVING, 7 May 2026] Web citations are unstable over time: 404s, paywalls and bot blocks are a routine cause of citations that can no longer be verified ([arXiv 2605.06635](https://arxiv.org/html/2605.06635)).

[GAP] No independent measurement was found of AI-generated content contaminating search results, or of over-reliance on a single source; both are plausible and unquantified.

### 11.3 Verification practice

[FAST-MOVING, 7 May 2026] Run three separate checks on every citation: the link works, the content is relevant, and the fact is actually supported. Evaluators found the first two stay above 92% even when the third collapses ([arXiv 2605.06635](https://arxiv.org/html/2605.06635)).

[PLATFORM CLAIM] [FAST-MOVING, 13 Jun 2025] Anthropic's judge rubric for research output scores factual accuracy, citation accuracy, completeness, source quality and tool efficiency; a single LLM call producing a 0.0 to 1.0 score plus pass or fail tracked human judgment best; about 20 representative queries sufficed for early evaluation; and human review still caught what automation missed ([Anthropic Engineering, 13 Jun 2025](https://www.anthropic.com/engineering/multi-agent-research-system)). This is a vendor practice report.

[DURABLE] Selective or inaccurate citation is an integrity breach. The ALLEA European Code of Conduct (2023) classes citing selectively or inaccurately and padding a bibliography as unacceptable practices, and defines fabrication as making up data or results and recording them as real ([ALLEA Code 2023](https://allea.org/wp-content/uploads/2023/06/European-Code-of-Conduct-Revised-Edition-2023.pdf)). Agents must therefore report contrary evidence they find and not only supporting sources.

[INFERENCE] Claim ledger: keep one row per substantive claim with the claim text, source URL, access date, publication date, the location of the supporting passage, support status (supported, partly, not found), source type (primary, secondary, vendor, opinion) and confidence. This is the researchers' proposed operating rule.

[INFERENCE] Reading rule: never cite a page that was not opened in the current run; search snippets are leads only. Because support falls with depth and citation count, a long run needs more verification per claim and not less, and citations should be capped to sources actually read.

[INFERENCE] Number, quote and date rules: copy each figure with its unit, period, population and denominator; cross-check any decision-relevant number against a second independent source or the primary dataset and flag when two sources share an origin; use verbatim quotes only when checked character by character against the source, and otherwise paraphrase and say so; date-stamp every claim with "as of" and the source's own date; and treat anything older than 12 months in a fast-moving field as needing a recheck. The 12-month figure is a suggested default.

[INFERENCE] Liveness and archiving: every URL passes a liveness check before delivery, and key sources get an archive copy or internal snapshot reference at time of use because pages change; snapshots stay internal for copyright reasons.

[INFERENCE] Adversarial review: a second agent with fresh context re-opens a sample of sources and tries to refute the claims. The suggested sample is 100% of numbers, legal statements and quotes and at least 20% of other claims. No published standard sets these thresholds, and no controlled study was found measuring how much second-agent review improves accuracy.

[INFERENCE] Human-review triggers, suggested: legal conclusions; personal data about named individuals; claims about listed companies; health or safety claims; anything going to external publication; and any report where the reviewer finds more than 1 in 10 sampled claims unsupported.

[INFERENCE] Every deliverable carries a mandatory "not verified" section and a reproducible log: queries run, URLs fetched, timestamps, tool errors, model and version, and what was skipped and why.

### 11.4 Multi-agent workflows

[PLATFORM CLAIM] [FAST-MOVING, 13 Jun 2025] The best-documented orchestrator-worker design is Anthropic's: a lead agent plans and spawns parallel subagents, and a separate citation agent attaches citations. Anthropic reports that an Opus 4 lead with Sonnet 4 subagents beat single-agent Opus 4 by 90.2% on an internal research evaluation ([Anthropic Engineering, 13 Jun 2025](https://www.anthropic.com/engineering/multi-agent-research-system)). The figure is internal and unreplicated.

[PLATFORM CLAIM] [FAST-MOVING, 13 Jun 2025] Multi-agent research is expensive. Anthropic reports that token use explained about 80% of performance variance on BrowseComp, and 95% together with tool-call count and model choice, and that agents use about 4 times the tokens of chat and multi-agent systems about 15 times ([Anthropic Engineering, 13 Jun 2025](https://www.anthropic.com/engineering/multi-agent-research-system)). Use multi-agent runs for broad, parallelisable questions whose value justifies the cost.

[PLATFORM CLAIM] [FAST-MOVING, 13 Jun 2025] Delegation quality drives output quality. Anthropic found each subagent needs an objective, an output format, tool and source guidance and clear boundaries, and that vague briefs caused duplicated and misdirected work ([Anthropic Engineering, 13 Jun 2025](https://www.anthropic.com/engineering/multi-agent-research-system)).

[PLATFORM CLAIM] [FAST-MOVING, 13 Jun 2025] Scale effort to the question. Anthropic's rule is 1 agent with 3 to 10 tool calls for simple fact-finding, 2 to 4 subagents with 10 to 15 calls each for comparisons, and more than 10 subagents for complex research; early versions wrongly spawned 50 subagents for simple queries ([Anthropic Engineering, 13 Jun 2025](https://www.anthropic.com/engineering/multi-agent-research-system)).

[PLATFORM CLAIM] [FAST-MOVING, 13 Jun 2025] Parallelism and checkpoints: a lead launching 3 to 5 subagents in parallel, with subagents calling 3 or more tools in parallel, cut research time by up to 90%; the lead saves its plan to memory because context beyond 200,000 tokens is truncated; and because errors compound, runs should resume from checkpoints ([Anthropic Engineering, 13 Jun 2025](https://www.anthropic.com/engineering/multi-agent-research-system)).

[CONTESTED] More effort is not monotonically better. Anthropic's vendor data link more tokens and tool calls to better performance ([Anthropic Engineering, 13 Jun 2025](https://www.anthropic.com/engineering/multi-agent-research-system)), while the independent May 2026 preprint found that more tool calls and more citations correlated with lower factual support ([arXiv 2605.06635](https://arxiv.org/html/2605.06635)). The measures differ (task success against citation support), so both can hold.

[INFERENCE] The two findings combine into one rule: spend tokens on breadth through separate workers with small contexts, and keep a separate verification pass, instead of one very long run.

[INFERENCE] Worker brief template for the manager agent: objective, key questions, scope exclusions, preferred sources, output schema (finding, URL, date, verification label), stop conditions and tool-call budget. The synthesising agent must not add facts that are absent from worker notes, and unsourced worker claims go to the gaps list.

[GAP] OpenAI and Google multi-agent guidance and academic comparisons of multi-agent against single-agent research were not retrieved.

### 11.5 Retrieval: scholarly APIs and their limits

[DURABLE] arXiv API terms: at most one request every three seconds on one connection at a time; metadata is CC0 and may be stored and shared; full texts may be stored for personal or research use but not re-served unless the licence allows; link to the abstract page ([arXiv API Terms of Use](https://info.arxiv.org/help/api/tou.html)).

[FAST-MOVING, 3 Nov 2026] OpenAlex changed its access model, per its help page dated 3 November 2026. Basic queries work without a key; a free API key is needed for cursor paging beyond the first page and raises the daily budget tenfold; a free account's daily budget is USD 1. Rates are 10 requests per second without a key, 30 with a free key or prepaid usage and 50 on an annual plan; semantic search is limited to 1 per second, and searches with more than five boolean operators to 1, 5 or 25 per second by tier ([OpenAlex Help, Authentication](https://help.openalex.org/api/authentication/)). The price per request and paid tiers were not read.

[FAST-MOVING, 16 Oct 2025] Crossref's REST API (page updated 16 October 2025) has three pools: public with no identification, rate limit 5 and concurrency 1; polite, with an email in the `mailto` parameter or agent header, rate 10 and concurrency 3; and Metadata Plus, paid with an API key, rate 150 and no concurrency limit. The interval is given in the `x-rate-limit-interval` response header, exceeding the limit returns HTTP 429 and blocked users get 403 ([Crossref, Access and authentication](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/)). Crossref's tips page (updated 24 October 2025) says to back off on 429, cache responses and avoid repeating identical requests ([Crossref tips](https://www.crossref.org/documentation/retrieve-metadata/rest-api/tips-for-using-the-crossref-rest-api/)).

[FAST-MOVING, as read 11 Nov 2026] Semantic Scholar: most endpoints are open without a key but share one pool of 1,000 requests per second across all unauthenticated users, with possible extra throttling; a key is requested by form and starts at 1 request per second on all endpoints; bulk datasets (S2AG, S2ORC) come through the Datasets service; use is under an API licence agreement ([Semantic Scholar API](https://www.semanticscholar.org/product/api)).

[DURABLE] NCBI E-utilities for PubMed (page last updated 17 November 2022): base `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`; 3 requests per second without an API key and 10 with one; send `tool` and `email` parameters and register them; run large jobs at weekends or between 21:00 and 05:00 US Eastern on weekdays; violators' IP addresses can be blocked ([NCBI, E-utilities usage guidelines](https://www.ncbi.nlm.nih.gov/books/NBK25497/)).

[DURABLE] PubMed abstracts may be copyrighted; reproduction, redistribution or commercial use beyond fair use needs the rights holder's permission, and software using E-utilities must show NCBI's disclaimer and copyright notice ([NCBI, 17 Nov 2022](https://www.ncbi.nlm.nih.gov/books/NBK25497/)).

[DURABLE] The table collects the scholarly-API limits with the date of each source.

| Label | Service | Keyless limit | With key or identification | Date of source | Link |
|---|---|---|---|---|---|
| [DURABLE] | arXiv API | 1 request per 3 seconds, one connection | Same | As read 11 Nov 2026 | [arXiv](https://info.arxiv.org/help/api/tou.html) |
| [FAST-MOVING] | OpenAlex | 10 requests per second | 30 per second with free key; USD 1 daily budget on a free account; 50 per second on annual plan | 3 Nov 2026 | [OpenAlex](https://help.openalex.org/api/authentication/) |
| [FAST-MOVING] | Crossref | Rate 5, concurrency 1 | Polite pool rate 10, concurrency 3; paid Plus rate 150 | 16 Oct 2025 | [Crossref](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/) |
| [FAST-MOVING] | Semantic Scholar | Shared pool of 1,000 requests per second across all users | 1 request per second per key | As read 11 Nov 2026 | [Semantic Scholar](https://www.semanticscholar.org/product/api) |
| [DURABLE] | NCBI E-utilities (PubMed) | 3 requests per second | 10 per second with key | 17 Nov 2022 | [NCBI](https://www.ncbi.nlm.nih.gov/books/NBK25497/) |

[INFERENCE] Default agent settings: OpenAlex with a free key at no more than 10 requests per second; Crossref polite pool with a monitored mailbox and at most 3 concurrent requests; PubMed with a registered key at no more than 10 per second; Semantic Scholar with a key at 1 per second; back off on HTTP 429 and cache results. A company agent using PubMed abstracts commercially should store identifiers and own-words notes and not abstract text unless the licence allows.

### 11.6 Retrieval: robots.txt, AI preferences and lawful access

[DURABLE] robots.txt is a signal, not access control. RFC 9309 (September 2022, Standards Track) says its rules are not access authorisation and not a security measure; compliant crawlers must follow parseable rules, treat an unreachable file (5xx) as full disallow, and should not cache it beyond 24 hours ([RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html)). In the EU the signal still carries legal weight as a rights reservation and a data-protection objection; see sections 12 and 13.

[FAST-MOVING, 31 Aug 2026 milestone] The IETF AI Preferences working group is standardising a vocabulary and attachment methods (robots.txt, HTTP headers) for AI-use preferences, with milestones to submit both drafts to the IESG set for 31 August 2026; enforcement is out of scope and the final status was not confirmed ([IETF aipref](https://datatracker.ietf.org/wg/aipref/about/)).

[INFERENCE] Lawful-access checklist: use open-access versions, licensed subscriptions, library access or author copies; never bypass paywalls, logins, CAPTCHAs or rate limits; and record the access route for each source. Large pages are truncated by fetch tools (seen on EUR-Lex, lagen.nu and the Futures Toolkit in this research), so request specific offsets and record which part was read.
