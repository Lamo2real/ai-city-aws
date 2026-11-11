---
id: operations.projects.project-and-programme-management
department: operations
domain: projects
title: 'Operations: Project and programme management'
summary: 'Project and programme management: the PMBOK Guide eighth edition, PRINCE2 seventh edition, estimation with the outside
  view (reference-class forecasting) and project templates.'
type: playbook
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- efficiency
sources:
- https://www.pmi.org/pmbok-guide
- https://en.wikipedia.org/wiki/PRINCE2
- https://marclevinson.net/HowBigThingsGetDone020723.pdf
- https://dickiebush.substack.com/p/12-takeaways-from-alex-hormozis-scaling
related: []
seed_version: 1
---

**When to use this:** When planning, estimating or running a project or programme: PMBOK 8, PRINCE2 7, reference-class (outside view) estimation and the project templates.

**Source section:** 6. Project and programme management

### PMBOK Guide, eighth edition

**[FAST-MOVING, Nov 2025]** The PMBOK Guide, Eighth Edition is PMI's current reference, published in November 2025, with an errata sheet for the second printing last updated in April 2026. It has six principles (holistic view, focus on value, embedded quality, accountable leadership, integrated sustainability, empowered teams) and seven performance domains (governance, scope, schedule, finance, stakeholders, resources, risk). It keeps the principles-and-domains foundation of the seventh edition, simplifies it, reintroduces process guidance in a non-prescriptive form and expands coverage of AI, project management offices and procurement. PMI says it drew on more than 48,000 data points ([PMI, PMBOK Guide](https://www.pmi.org/pmbok-guide)).

### PRINCE2, seventh edition

**[DURABLE]** PRINCE2's seventh edition (2023) has seven principles: ensure continued business justification; learn from experience; define roles, responsibilities and relationships; manage by stages; manage by exception; focus on products; tailor to suit the project. It has seven practices (business case, organizing, quality, plans, risk, issues, progress) and seven processes (starting up, initiating, directing, controlling a stage, managing product delivery, managing stage boundaries, closing). The source is Wikipedia summarising the PeopleCert manual; the primary page was not opened ([Wikipedia, PRINCE2](https://en.wikipedia.org/wiki/PRINCE2)).

**[DURABLE]** PeopleCert has owned PRINCE2 since acquiring AXELOS in 2021. The seventh edition added a sustainability performance target, renamed themes to practices and "Change" to "Issues", added a digital and data management approach and a project log, and put more emphasis on people and change management ([Wikipedia, PRINCE2](https://en.wikipedia.org/wiki/PRINCE2)).

### Estimation: use the outside view

**[DURABLE]** Bent Flyvbjerg's database holds more than 16,000 public and private projects; only 1 in 200 (0.5%) came in on budget, on time and with the promised benefits. Major building projects averaged a 62% cost overrun, and 18% of IT projects had cost overruns above 50%. The source is a February 2023 Wall Street Journal review of Flyvbjerg and Gardner's book; the underlying papers were not read ([WSJ review reproduced at marclevinson.net, Feb 2023](https://marclevinson.net/HowBigThingsGetDone020723.pdf)).

**[DURABLE]** Reference-class forecasting, as described in that review: pick a category of similar completed projects, look at how they actually performed, and use those actual figures to test whether the proposal is realistic. The companion rule is to think slow and act fast: investigate thoroughly before committing, then deliver quickly, because low-probability shocks during delivery are the biggest source of risk and a short delivery window reduces exposure. The modularity example is the Madrid Metro, which built 76 stations and 81 miles of line from 1995 to 2003 with one repeated station design ([WSJ review, Feb 2023](https://marclevinson.net/HowBigThingsGetDone020723.pdf)).

**[INFERENCE]** Reference-class estimate procedure for an operations agent: classify the project (for example a CRM migration, a vendor onboarding or a security audit); pull actual duration and cost for at least five to ten comparable past projects, internal first and external second; use the median as the base estimate and the 80th percentile as the commitment date or budget; adjust only for documented, specific differences; and log estimate against actual at close to grow the reference class.

**[INFERENCE]** Because IT cost overruns are fat-tailed (18% exceed 50%, per the Flyvbjerg figures above), a single-point contingency such as 10% is not a defensible default. State a range and a threshold at which the project stops for re-approval.

**[HOUSE STYLE]** The house style adds a hurdle for new initiatives: workshop notes report that any change is expected to cost roughly 20% of performance (the note-taker says arguably 40%), so a new project should clear at least that expected gain. Unaudited rule of thumb ([Dickie Bush, 12 takeaways](https://dickiebush.substack.com/p/12-takeaways-from-alex-hormozis-scaling)).

### Project templates

**[INFERENCE]** Project brief outline: problem and business justification; outcome measures; in scope and out of scope; deliverables; stages with go or no-go gates; tolerances for time and cost that trigger escalation; roles including a single sponsor or decider; dependencies; top risks; and the reference-class estimate. The deliverables, stages and tolerances fields follow PRINCE2's focus on products, manage by stages and manage by exception.

**[INFERENCE]** Risk register columns: ID; risk statement written as cause, event and effect; category; likelihood from 1 to 5; impact from 1 to 5; score; owner; treatment (avoid, reduce, transfer or accept); action and due date; trigger or early-warning indicator; status; last reviewed.

**[INFERENCE]** Weekly status report outline: overall red, amber or green status with a one-sentence reason; progress against milestones with planned and actual dates; the top three risks and issues with owners; decisions needed, from whom and by when; dependencies due in the next two weeks; and forecast to complete against baseline.

**[INFERENCE]** Dependency management: keep a dependency log (provider, consumer, what, needed-by date, status), review it in the weekly meeting, and treat any cross-team dependency without a named provider owner as a risk.

**[INFERENCE]** Post-project review outline: goals against results; estimate against actual, which feeds the reference class; what went well; what failed and the root cause; changes to procedures and checklists with owners. Hold it within two weeks of close, following PRINCE2's learn-from-experience principle.

**[GAP]** Not verified: the PMBOK 7 principle list and PMBOK 8's process and AI content beyond the PMI landing page; the primary PRINCE2 page; agile at programme level (SAFe, LeSS, Disciplined Agile, MSP); Flyvbjerg's detailed figures and his IT fat-tail paper; Kahneman and Tversky's original planning-fallacy research.
