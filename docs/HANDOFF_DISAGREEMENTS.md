# Where each department's handoff rules disagree with the shared handoff documents (2026-11-11, decision 239)

The owner's brief for the shared cross-department documents (`knowledge/seed/shared/`, decision 238): "Each department's
own handoff section stays as it is; where the two disagree, show me the disagreement and do not choose silently." This
is that list. Nothing here has been changed in either document. Until the owner decides a row, agents follow their own
department's section and say in the handoff or report that it disagrees with the shared document
(`agents/shared/handoffs.*.md`).

How it was made: each department's handoff document (`knowledge/seed/<key>/handoffs/…`), its guardrails document (for
approval rules) and its prompt (`agents/departments/<key>.md`) were compared with the shared responsibility map (1.3,
1.4), handoff catalogue (2.2–2.13), decision rights (3), processes (4), routing and template (7) and guardrails (8).
Agreements and plain omissions are not listed. "Possible" marks a row where the two texts can also be read as
compatible. Line numbers are those of 2026-11-11 and may move. The shared rows are themselves an editable proposal,
mostly `[INFERENCE]`.

Paths: `S/` is `knowledge/seed/shared/`, `<key>/` is `knowledge/seed/<key>/`. Shared files: `S/map` =
`responsibilities/responsibility-map.md`, `S/cat` = `handoffs/handoff-catalogue.md`, `S/proc` =
`processes/end-to-end-processes.md`, `S/dec` = `decision-rights/decision-rights.md`, `S/route` =
`routing/routing-rule-and-message-template.md`, `S/guard` = `guardrails/company-wide-guardrails.md`.

## 0. City-wide: the owner's approval rules against section 8
| # | Topic | The city says | Shared says |
|---|---|---|---|
| 0.1 | Human approval | "nothing is held for approval" (`agents/manager.md:25`); decision 237 removed connector approval levels, the ad cap and prompt holds | Always a human: payment release, contracts, novel claims and press, high-risk production changes, personnel, legal positions, new data access, agent-system changes (`S/guard:66-73`) |
| 0.2 | Worker merges | merge "when the manager says the work is accepted" (`agents/worker.md:18`) | Standard pre-approved changes may be delegated; high-risk changes need a human (`S/guard:69`) |
| 0.3 | After filing a handoff | "file it with `file_handoff` … and carry on; never ask … or wait" (`agents/manager.md:20`) | Never "assume a sent request was accepted"; unaccepted requests stay the sender's (`S/guard:98`, `S/cat:58`) |
| 0.4 | Receiving a handoff | "assign it to a worker" (`agents/manager.md:20`) | The receiver accepts, rejects with a reason code or asks for input (`S/cat:58,144`) |
| 0.5 | Handoff fields | `file_handoff` has to_department, title, details, priority, ref, reply_to (`agents/manager.md:20`) | Twelve fields; incomplete requests rejected (`S/route:62-77`) |
| 0.6 (possible) | Customer contact | "Customer Support tells the customer; you never contact another team's customers" (`agents/manager.md:20`) | "Sales owns commercial expansion and the renewal quote" (`S/map:95`) |

0.3 to 0.5 are now bridged in the prompts (the twelve fields go in `details`; accept, reject or input-required by
`ticket_note` / `ticket_fixed`); `manager.md` itself is unchanged.

## Application
| # | Topic | Application says | Shared says |
|---|---|---|---|
| 1 | Release notes | hands Support "release notes, known-issue lists" (`application/handoffs/handoffs-to-other-departments.md:63`) | "Product owns release notes" (`S/map:98`) |
| 2 | Data-protection review | sends "data protection review of new AI processing" to Data and AI (`…handoffs…:60`) | privacy review (DPIA screening) goes to Legal (`S/cat:158`) |
| 3 | Infrastructure changes | every production deploy, rollback, flag flip, infrastructure apply needs a human (`application/guardrails/agent-guardrails.md:73`) | only high-risk changes go to a human (`S/cat:153`, `S/guard:69`) |
| 4 | Outbound messages | anything leaving the company is sent by a human (`…handoffs…:70`, `…guardrails…:81`) | routine templated replies may be delegated (`S/guard:68`) |
| 5 (possible) | Spending | a human only "above a set budget" (`…guardrails…:82`) | any payment release, any new recurring commitment (`S/guard:66`) |
| 6 (possible) | Product → Application artefact | "prioritised problems, user-outcome goals, acceptance criteria" (`…handoffs…:58`) | "specification or PR/FAQ plus backlog items", Definition of Ready (`S/cat:152`) |
| 7 (possible) | Regulator reports | Application drafts "advisories and regulator reports" (`…handoffs…:61`) | Legal owns regulatory positions (`S/map:84`) |
| 8 (possible) | Website | takes "site and landing-page requirements" from Marketing (`…handoffs…:64`) | hosting is Application or IT infrastructure, "the owner must pick one" (`S/map:100`) |
| 9 | Its own two files | guardrails send DPIA outcomes to Legal (`…guardrails…:83`), the handoffs send reviews to Data and AI (row 2) | Legal (`S/cat:158`) |

## Data and AI
| # | Topic | Data and AI says | Shared says |
|---|---|---|---|
| 1 | Production merges | every merge to production pipelines, marts, semantic layer, contracts needs a human (`data/guardrails/agent-guardrails.md:85`) | standard pre-approved changes may be delegated (`S/guard:69`) |
| 2 (possible) | Personal-data access | any access to personal-data columns (`…guardrails…:87`) | access already granted within the original purpose may be delegated (`S/guard:72`) |
| 3 (possible) | Outbound sends | any outbound send needs a human (`…guardrails…:91`) | templated replies may be delegated (`S/guard:68`) |
| 4 (possible) | Network changes | "access grants and network changes need human approval" (`data/handoffs/between-departments.md:34`) | only high-risk changes (`S/guard:69`) |
| 5 (possible) | Lead scoring | Data hands Sales "lead and account scoring" (`…between-departments.md:39`) | Marketing hands Sales the MQL record "with source, score" (`S/cat:148`) |
| 6 (possible) | Forecasts | Data hands Finance forecasts (`…:38`) | Finance owns forecasting (`S/map:83`) |
| 7 (possible) | Marking AI content | Data gives Media "guidance on marking AI-generated content" (`…:42`) | Legal owns the AI Act position (`S/map:102`) |
| 8 (possible) | Data-request acceptance | "states the decision it supports" (`…:47`) | "metric owner named; definition does not duplicate a catalogue entry" (`S/cat:157`) |
| 9 (possible) | SLO dashboards | Data hands Operations "SLO dashboards" (`…:43`) | IT infrastructure owns monitoring (`S/map:74`) |

## Finance
| # | Topic | Finance says | Shared says |
|---|---|---|---|
| 1 | Metric definitions | Finance hands Data and AI "metric definitions" (`finance/handoffs/other-departments.md:52`) | Data and AI owns definitions; Finance audits financial metrics (`S/map:96`) |
| 2 | Refunds and credits | every refund or credit note needs a human (`finance/guardrails/agent-guardrails.md:56`) | under the local limit may be delegated (`S/guard:66`) |
| 3 | Discounts | every price, discount and term needs a human (`…guardrails…:59`) | standard quotes within policy may be delegated (`S/guard:67`) |
| 4 (possible) | Funnel metrics | Finance hands over paid CAC, payback, LTGP:CAC (`…other-departments.md:47-48`) | Data and AI does funnel and revenue metrics (`S/proc:70`) |
| 5 (possible) | Renewal calendar | Finance hands IT infrastructure the software renewal calendar (`…:53`) | Operations owns the tool register and vendor list (`S/map:101`) |
| 6 (possible) | Retry limits | Finance sets Data and AI's retry limits (`…:52`) | changing another agent's limits always needs a human (`S/guard:73`) |
| 7 (possible) | Deal-desk approver | "discount and terms approvals" with no human named (`…:47`) | the deal-desk step is a human gate H (`S/proc:65`) |

## IT infrastructure
| # | Topic | IT infrastructure says | Shared says |
|---|---|---|---|
| 1 (possible) | Spend | a human only above a threshold and for commitments (`infrastructure/guardrails/agent-guardrails.md:46`) | any payment release (`S/guard:66`) |
| 2 (possible) | Security containment | pre-approved automated containment (isolate, revoke sessions, disable a key) (`…guardrails…:45`) | access-control and emergency changes always need a human (`S/guard:69`) |
| 3 (possible) | External communications | all need a named human (`…guardrails…:46`) | templated updates may be delegated (`S/guard:68`) |
| 4 (possible) | Approving SaaS tools | IT infrastructure returns "approved-tools decisions" (`infrastructure/handoffs/cross-department.md:44`) | Operations owns the tool register and vendor selection (`S/map:101`, `S/proc:144`) |

## Legal
| # | Topic | Legal says | Shared says |
|---|---|---|---|
| 1 | Signing | a human for anything signed "beyond a standard template" and contracts above a set value (`legal/guardrails/agent-guardrails.md:80`) | signing or accepting any contract always needs a human (`S/guard:67`) |
| 2 | Collections | Legal drafts reminders and demands for Finance (`legal/handoffs/handoffs-with-other-departments.md:68`) | Finance does collections (`S/proc:68`, `S/map:83`) |
| 3 (possible) | DSR clock | Legal hands Support the request tracker with the one-month clock (`…:70`) | Support starts the clock; Operations and Legal keep the register (`S/proc:172,176`) |
| 4 (possible) | Claims triggers | discount, comparative, environmental, AI-performance claims (`…:65`) | comparative or quantitative claims (`S/cat:158`); security and compliance claims (`S/guard:68`) |
| 5 (possible) | Incident customer notices | Legal drafts customer notices (`…:64`) | Support provides the communications lead and status page (`S/proc:113`) |

## Marketing
| # | Topic | Marketing says | Shared says |
|---|---|---|---|
| 1 | Converting the lead | "hand it to Sales with file_handoff … and convert it in the CRM" (`agents/departments/marketing.md:31`) | Sales accepts and qualifies; Qualified = a sales-accepted opportunity (`S/proc:64`, `S/cat:62`) |
| 2 (possible) | Lead handoff contents | "why it qualified and what they asked" (`marketing.md:31`) | MQL record with source, score, consent, activity history (`S/cat:148`) |
| 3 (possible) | Lead score | account-level engagement instead of an individual lead score (`marketing/lifecycle/b2b-email-and-outreach.md:33`) | the MQL artefact carries a score (`S/cat:148`) |
| 4 | Publishing | "nothing waits for the owner's yes" (`marketing.md:25`, decision 237) | novel, comparative, quantitative, security or compliance claims and first use of a new brand asset always need a human (`S/guard:68`) |

## Media
| # | Topic | Media says | Shared says |
|---|---|---|---|
| 1 | Approved tool list | Media hands IT infrastructure "the approved tool list" and gates adding tools (`media/handoffs/handoffs-to-other-departments.md:41`, `media/guardrails/agent-guardrails.md:73`) | IT infrastructure owns bought SaaS and access; Operations the tool register (`S/map:101`) |
| 2 (possible) | Disclosure decision | Media hands Marketing "the disclosure and advertising-marker decision" (`…handoffs…:36`) | Legal owns claims review and regulatory positions (`S/map:84`) |
| 3 (possible) | Who briefs Media | direct requests from Sales, Support and Product (`…handoffs…:37-39`) | creative briefs come from Marketing (`S/cat:155,178`) |
| 4 | Refusing a request | refused and escalated to the owner (`…handoffs…:51`) | rejected with a reason code; a human only after one manager-to-manager round (`S/guard:75,86`) |
| 5 (possible) | Publishing | a named human for publishing or scheduling any asset (`…guardrails…:73`) | only novel claims, press, first use of a new brand asset (`S/guard:68`) |
| 6 | Two approvers | "needs a second human approver" for paid media and some assets (`…guardrails…:74`) | exactly one approver or decider (`S/dec:52`) |

## Operations
| # | Topic | Operations says | Shared says |
|---|---|---|---|
| 1 | Vendor selection | needs a human (`operations/guardrails/agent-guardrails.md:55`) | procure-to-pay step 2, Operations, no gate (`S/proc:144`) |
| 2 | Buying and signing | "purchases and contracts with vendors go ahead when the goal needs them; report" (`agents/departments/operations.md:23`) | signing or accepting any contract, DPA, NDA or vendor terms always needs a human (`S/guard:67`) |
| 3 | Spending | a human above the written approval limit (`…guardrails…:55`) | any payment release, any new recurring commitment (`S/guard:66`) |
| 4 | External communication | always a human (`…guardrails…:55`) | templated replies may be delegated (`S/guard:68`) |
| 5 | Metric definitions | Operations hands Data and AI the KPI glossary (`operations/handoffs/handoffs-to-other-departments.md:38`) | Data and AI owns definitions (`S/map:96`) |
| 6 | AI Act Annex III | Operations classifies agent tasks (`…handoffs…:38`) | Legal owns the AI Act position (`S/map:102`) |
| 7 (possible) | Access removal | a human for removing access (`…guardrails…:55`) | IT infrastructure removes access, no gate (`S/proc:134`) |
| 8 (possible) | Routing | "shared tickets (Jira) rather than side messages" (`operations.md:24`) | manager-to-manager through the receiver's intake (`S/route:52`) |
| 9 (possible) | Handoff record | provider owner, consumer owner, artefact, needed-by date (`…handoffs…:31`) | artefact, statuses, rejection with a reason code, time targets (`S/cat:56`) |
| 10 (possible) | Onboarding new hires | Operations onboards new sales hires (`…handoffs…:40`) | the hiring department onboards (`S/proc:132`); the shared map gives it to Operations (`S/map:85`): the shared files also disagree |
| 11 (possible) | Contracts and DPAs | Operations drafts them for Legal (`…handoffs…:42`) | Legal does contract and DPA (`S/proc:146`) |
| 12 (possible) | Spend reconciliation, service levels | Operations reconciles spend (`…:39`) and gives Support service-level templates (`…:41`) | Finance matches invoices, Data and AI reports spend (`S/proc:149-150`); each department publishes its own targets (`S/dec:62`) |

## Product
| # | Topic | Product says | Shared says |
|---|---|---|---|
| 1 | Release to customers | every release, flag removal or rollout widening needs a human (`product/guardrails/agent-guardrails.md:72`) | standard pre-approved changes may be delegated; deploy gated for high risk (`S/guard:69`, `S/proc:83`) |
| 2 (possible) | Launch tier timing | decided at kickoff (`product/handoffs/handoffs-with-other-departments.md:59`) | step 6, after build and readiness (`S/proc:84`) |
| 3 (possible) | Briefs to Media | Product briefs Media directly (`…:64`) | Media's briefs come from Marketing (`S/cat:178`) |
| 4 (possible) | Metric definitions, eval thresholds | Product hands Data and AI definitions and pass thresholds (`…:58`) | Data and AI owns definitions and evaluation (`S/map:96,102`) |
| 5 (possible) | Handoff format | five things per handoff (`…:71`) | twelve fields, incomplete rejected (`S/route:62`) |
| 6 (possible) | Legal edits Product's document | "Legal's ruling replaces the corresponding paragraph" (`…:75`) | never write to another department's artefact (`S/guard:96`) |
| 7 (possible) | Contacting customers | always a human (`…guardrails…:75`) | templated replies may be delegated (`S/guard:68`) |

## Research
| # | Topic | Research says | Shared says |
|---|---|---|---|
| 1 (possible) | Battlecards | Research hands Sales battlecards (`research/handoffs/handoffs-with-other-departments.md:47`) | Sales enablement from Product and Marketing (`S/cat:175,181`) |
| 2 (possible) | Forecasts | Research hands Finance forecasts (`…:46`) | Finance owns forecasting (`S/map:83`) |
| 3 (possible) | Verifying agent output | Research hands Data and AI verification results (`…:45`) | Data and AI owns evaluation (`S/map:102`) |
| 4 | Study sign-off | a human signs off business-critical studies (`research/guardrails/agent-guardrails.md:97`) | work inside the department's own scope may be done alone (`S/guard:85`, `S/cat:156`) |
| 5 (possible) | Others' publishing | "material another department wants to publish needs the human-approval gate" (`…handoffs…:55`) | only novel claims and press always gated (`S/guard:68`) |
| 6 (possible) | External deliverables | a human for anything going outside and any external contact (`…guardrails…:98-99`) | templated replies may be delegated (`S/guard:68`) |

## Sales
| # | Topic | Sales says | Shared says |
|---|---|---|---|
| 1 | Handover stage | leads arrive qualified: "a converted Opportunity … sales-qualified" (`agents/departments/sales.md:28`) | the artefact is a lead at MQL; Sales accepts and qualifies (`S/cat:148`, `S/proc:64`) |
| 2 | Acceptance | "the deal is already yours on AI City's board" (`sales.md:28`) | acceptance is an explicit transition by the receiver (`S/cat:58`) |
| 3 (possible) | Rejecting a lead | sent back to Marketing "to nurture", no code (`sales.md:28`) | a rejected lead carries a reason code (`S/cat:64`) |
| 4 | First response | "within one business hour" (`sales/inbound/lead-handling.md:61`), "the same day" (`sales.md:28`) | set locally, inference: same business day (`S/cat:148`) |
| 5 | Invoicing | Sales issues the Stripe invoice or payment link (`sales.md:26`) | Finance invoices (`S/proc:68`) |
| 6 (possible) | Quotes to Finance | all quotes and invoices go to Finance (`sales.md:28`) | the deal desk handles only non-standard pricing and terms (`S/proc:65`, `S/guard:67`) |
| 7 (possible) | Onboarding touches | Sales re-closes at onboarding and first check-in (`sales/post-sale/retention-expansion-advocacy.md:49`) | Customer Support owns onboarding (`S/map:94`) |

## Customer support
| # | Topic | Support says | Shared says |
|---|---|---|---|
| 1 | Cancelling subscriptions | may process a cancellation alone (`support/agent-guardrails/ai-agent-guardrails.md:64`) | cancelling or downgrading paid subscriptions always needs a human (`S/guard:66`) |
| 2 (possible) | Statutory refunds | no limit for statutory refunds (`…:64,74`) | refunds above a set limit need a human (`S/guard:66`) |
| 3 (possible) | Severity and priority | Support sets them (`…:64`) | severity confirmed by the engineering DRI, priority by the product or engineering manager (`S/cat:150`, `S/map:60`) |
| 4 | Status page | Support receives status-page updates from IT infrastructure (`support/handoffs/cross-department-handoffs.md:39`) | Support provides the communications lead and status page (`S/proc:113`) |
| 5 (possible) | Severity 1 wording | needs approval even when templated (`…guardrails…:65`) | templated incident updates may be done alone (`S/guard:88`) |
| 6 (possible) | Dunning | Support should own or see the dunning flow (`support/customer-success/customer-success-practice.md:71`) | Finance owns billing and collections (`S/map:83`) |
| 7 (possible) | Legacy rates | Finance approves legacy rates (`…handoffs…:43`) | a human executive approves pricing; Finance contributes (`S/map:93`) |
| 8 (possible) | Upsell contact | Support runs save or upsell contact (`…guardrails…:65`) | Sales owns commercial expansion (`S/map:95`) |
| 9 (possible) | Feedback cadence | monthly top contact drivers (`…handoffs…:49`) | weekly triage (`S/cat:151`) |
| 10 (possible) | New-customer packet | goals, promises, next contact (`…handoffs…:44`) | objectives, stakeholders, commitments, contract terms, technical environment, open tickets; kickoff within 5 business days (`S/cat:149`) |

## Between departments (outside this comparison)
Some departments also disagree with each other where the shared documents settle nothing, for example Application and
Data and AI both handing over product event contracts (`application/…handoffs…:60`, `data/…between-departments.md:36`).
These are not listed.
