---
id: product.prioritisation.prioritisation-and-roadmaps
department: product
domain: prioritisation
title: 'Product: Prioritisation and roadmaps'
summary: 'Prioritisation and roadmaps: scoring models as decision aids, not decision makers; choosing a method; opportunity assessment,
  RICE, ICE, Kano, opportunity scoring, cost of delay and WSJF; the now-next-later roadmap and roadmap alignment; saying no; stakeholder
  management.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- prioritise
sources:
- https://www.productplan.com/ebooks/the-state-of-product-management-report-2026
- https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/
- https://www.mindtheproduct.com/inside-atlassians-state-of-product-2026-key-takeaways/
- https://www.producttalk.org/opportunity-solution-trees/
- https://www.productplan.com/glossary/ice-scoring-model/
- https://en.wikipedia.org/wiki/Kano_model
- https://en.wikipedia.org/wiki/Outcome-Driven_Innovation
- https://framework.scaledagile.com/wsjf
- https://strategyn.com/outcome-driven-innovation-process/
- https://www.prodpad.com/blog/invented-now-next-later-roadmap/
- https://www.productledalliance.com/product-management-statistics/
- https://rosetta.to/u/alexhormozi/you-have-to-learn-to-say-no
- https://www.svpg.com/articles/
- https://www.svpg.com/ai-and-the-future-of-the-product-role/
related: []
seed_version: 1
---

**When to use this:** When ranking a backlog, choosing between bets, building or changing a roadmap, saying no to a request or managing stakeholders.

**Source section:** 7. Prioritisation and roadmaps

### Scoring models are decision aids, not decision makers

**[FAST-MOVING, 2026; survey]** ProductPlan's State of Product Management 2026 (250 product leaders) reports that over 60% of prioritisation frameworks are overridden by leadership escalations and that becoming outcome-focused is among the top challenges ([ProductPlan, State of Product Management Report 2026, landing page](https://www.productplan.com/ebooks/the-state-of-product-management-report-2026)). Intercom's own RICE article says the score is not a hard rule ([Intercom, RICE: simple prioritization for product managers, Jan 2018](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/)). In Atlassian's State of Product 2026, 49% say internal politics held them back ([Mind the Product summary of Atlassian's State of Product 2026, Sep 2025](https://www.mindtheproduct.com/inside-atlassians-state-of-product-2026-key-takeaways/)). **[INFERENCE]** Because overrides are the norm, the manager agent records every override and its reason next to the score, so that the trade-off stays visible.

### Choosing a prioritisation method

**[INFERENCE]** The table gives the department's default choice of prioritisation method by situation. The choice rule is the researchers' synthesis; each method's mechanics and source follow in the paragraphs below.

| Situation | Method | Why | Source for the method |
|---|---|---|---|
| Bigger bets and new opportunities | Opportunity assessment plus assumption tests | Compares customer needs before solutions | [Product Talk, Opportunity Solution Trees, Dec 2023, modified 29 Sep 2026](https://www.producttalk.org/opportunity-solution-trees/) |
| Many small items inside one outcome, reach differs widely | RICE | Reach and effort are explicit | [Intercom, RICE: simple prioritization for product managers, Jan 2018](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/) |
| Weekly experiment backlog, a few options | ICE | Fast, but subjective | [ProductPlan glossary, ICE Scoring Model](https://www.productplan.com/glossary/ice-scoring-model/) |
| What to include in a release for a known segment | Kano | Separates basics, performance and delighters | [Wikipedia, Kano model](https://en.wikipedia.org/wiki/Kano_model) |
| Survey access to enough customers | Opportunity scoring | Importance against satisfaction | [Wikipedia, Outcome-Driven Innovation](https://en.wikipedia.org/wiki/Outcome-Driven_Innovation) |
| Sequencing justified work with different time criticality | Cost of delay (WSJF) | Time criticality and risk reduction are explicit | [Scaled Agile, WSJF, page modified Apr 2026](https://framework.scaledagile.com/wsjf) |

### Opportunity assessment

**[DURABLE; practitioner opinion]** Torres's alternative to scoring ideas is to assess opportunities on four factors (opportunity sizing, market factors, company factors and customer factors) and then to compare solutions for the one chosen opportunity ([Product Talk, Opportunity Solution Trees, Dec 2023, modified 29 Sep 2026](https://www.producttalk.org/opportunity-solution-trees/)).

### RICE

**[VENDOR; canonical statement, Jan 2018]** Intercom's RICE score is Reach multiplied by Impact multiplied by Confidence, divided by Effort. Reach is people or events per period taken from real metrics. Impact uses a fixed scale: 3 massive, 2 high, 1 medium, 0.5 low, 0.25 minimal. Confidence is 100% high, 80% medium or 50% low. Effort is person-months across product, design and engineering. Intercom's caveats are that dependencies and table-stakes features can justify working out of score order if the trade-off is visible ([Intercom, RICE: simple prioritization for product managers, Jan 2018](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/)).

### ICE

**[VENDOR; glossary]** ICE scores Impact, Confidence and Ease from 1 to 10 each and multiplies them; for example 7 × 6 × 5 = 210. Sean Ellis created it for fast ranking of growth experiments. Its weaknesses: it is highly subjective; a low Ease score can sink high-impact work and bias teams toward small wins; scorers need a shared definition of each scale point; and it suits comparing a few options, not ranking a whole roadmap. RICE differs by adding Reach and dividing by Effort instead of multiplying by Ease ([ProductPlan glossary, ICE Scoring Model](https://www.productplan.com/glossary/ice-scoring-model/)).

### Kano

**[DURABLE; reference summary, Wikipedia]** The Kano model sorts features into must-be (absence hurts, presence is neutral), one-dimensional (more is better), attractive (presence delights, absence is not missed), indifferent, and reverse. The method asks two questions per feature: a functional one (how would you feel if the product had it) and a dysfunctional one (how would you feel if it did not), each with five answers: I like it, I expect it, I am neutral, I can tolerate it, I dislike it ([Wikipedia, Kano model](https://en.wikipedia.org/wiki/Kano_model)).

**[DURABLE; reference summary, Wikipedia]** Kano answer pairs map to categories as follows: expect plus dislike is must-be; like plus dislike is one-dimensional; like plus neutral is attractive; neutral plus neutral is indifferent; dislike plus expect is reverse. Contradictory pairs such as like plus like are flagged questionable and dropped. Categories decay: as competitors improve, a delighter becomes a performance feature and then a basic expectation ([Wikipedia, Kano model](https://en.wikipedia.org/wiki/Kano_model)). **[INFERENCE]** Kano needs survey volume; for a small B2B customer base, the question pair can be used in interviews as a qualitative probe and not as statistics. **[GAP]** Kano sample-size guidance and the satisfaction and dissatisfaction coefficient formulae were not retrieved.

### Opportunity scoring

**[DURABLE; reference summary, Wikipedia]** Ulwick's opportunity score in Outcome-Driven Innovation is importance plus the larger of zero and importance minus satisfaction. Customers rate each desired outcome from 1 to 10 for importance and for current satisfaction, and the inputs are the share of high ratings, so importance counts double ([Wikipedia, Outcome-Driven Innovation](https://en.wikipedia.org/wiki/Outcome-Driven_Innovation)). **[VENDOR]** Strategyn, the firm that sells the method, says (page modified 7 July 2026) that a market typically yields 50 to 150 outcome statements, that surveys run from 180 to 3,000 respondents, and that outcomes should be solution-free, measurable and stable over time ([Strategyn, Outcome-Driven Innovation process, page modified 7 Jul 2026](https://strategyn.com/outcome-driven-innovation-process/)).

**[VENDOR; weak basis]** Strategyn's headline 86% success rate for Outcome-Driven Innovation rests on 21 launches at its own clients, of which 18 were rated successful by the sponsoring companies, and its 17% industry comparison is a blend of 12 outside sources with no underlying data on the page ([Strategyn, Outcome-Driven Innovation process, page modified 7 Jul 2026](https://strategyn.com/outcome-driven-innovation-process/)). Agents must not quote the 86% figure as evidence. **[GAP]** Numeric thresholds for an "underserved" outcome and Ulwick's desired-outcome statement template were not on any fetched page; do not quote one from this document.

### Cost of delay and WSJF

**[DURABLE; framework owner, page modified Apr 2026]** Weighted shortest job first (WSJF) is relative cost of delay divided by relative job duration. Cost of delay is the sum of user or business value, time criticality, and risk reduction or opportunity enablement. Sunk cost is ignored by construction ([Scaled Agile, WSJF, page modified Apr 2026](https://framework.scaledagile.com/wsjf)). **[INFERENCE]** WSJF fits work whose time criticality differs sharply, such as regulatory deadlines. **[GAP]** Scaled Agile's estimation-scale guidance for WSJF is behind a login and was not read.

### The now-next-later roadmap

**[VENDOR; canonical statement, Oct 2022]** In ProdPad's now-next-later roadmap, Now holds defined, specified work in progress; Next is less detailed and may depend on the results of Now; Later holds broad problems without solutions. Items are framed as problems with candidate experiments attached, each linked to a business objective; any real deadline goes on the item itself; and OKRs carry the commitment so that the roadmap can stay flexible ([ProdPad, Now-Next-Later roadmap, Oct 2022](https://www.prodpad.com/blog/invented-now-next-later-roadmap/)).

### Roadmap alignment in practice

**[FAST-MOVING, Q4 2025 fieldwork; survey]** In the PLA/ProductPlan survey, 61% rate roadmap-to-strategy alignment at 4 out of 5 or higher (mean 3.6), and organisations in mid-transition to product-led score lower (3.1 to 3.2 out of 5) than fully product-led ones (4 out of 5) ([Product-Led Alliance statistics page citing the PLA/ProductPlan State of Product Management 2026, published May 2026](https://www.productledalliance.com/product-management-statistics/)).

### Saying no

**[HOUSE STYLE; primary transcript]** Hormozi treats saying no as discipline: skill brings more opportunities than can be pursued, splitting attention across two things stops either becoming large, and new ideas are tested by whether they serve the core ([Hormozi, You Have To Learn To Say "No", third-party transcript, 11 Mar 2026](https://rosetta.to/u/alexhormozi/you-have-to-learn-to-say-no)). **[INFERENCE]** The department's script for declining a request has four moves: restate the request as a problem; show which current outcome it would displace; give the evidence threshold that would change the answer; and log it under Later if it is a real problem. The script is the researchers' synthesis.

### Stakeholder management

**[GAP]** SVPG has current pieces on stakeholder relationships under the product model (December 2025) and on predictability versus outcomes (October 2026); only the titles and dates were confirmed and the full text was not read ([SVPG articles index](https://www.svpg.com/articles/)). No sourced stakeholder-management method is recorded here beyond SVPG's point that prototypes are tested with stakeholders for viability ([SVPG, AI and the Future of the Product Role, 6 Nov 2026](https://www.svpg.com/ai-and-the-future-of-the-product-role/)).
