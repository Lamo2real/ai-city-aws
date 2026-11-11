---
id: product.ux.ux-fundamentals
department: product
domain: ux
title: 'Product: UX fundamentals'
summary: 'UX fundamentals: Nielsen''s ten usability heuristics, forms with one thing per page and a question protocol, a forms checklist
  for agents, checkout abandonment benchmarks, performance as part of UX, designing for trust, empty states, loading and waiting states,
  and what was not sourced.'
type: playbook
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- web
objectives:
- launch
sources:
- https://www.nngroup.com/articles/ten-usability-heuristics/
- https://design-system.service.gov.uk/patterns/question-pages/
- https://baymard.com/lists/cart-abandonment-rate
- https://web.dev/articles/vitals
- https://www.nngroup.com/articles/state-of-ux-2026/
- https://www.nngroup.com/articles/empty-state-interface-design/
- https://developer.apple.com/design/human-interface-guidelines/generative-ai
related:
- product.accessibility.accessibility
seed_version: 1
cross_refs:
  '17':
  - product.accessibility.accessibility
---

**When to use this:** When designing or reviewing a screen, form, checkout, empty state or loading state, or running a heuristic review.

**Source section:** 13. UX fundamentals

### Nielsen's ten usability heuristics

**[DURABLE; published 24 Apr 1994, last reviewed 30 Jan 2024]** Nielsen's ten usability heuristics are: visibility of system status; match between the system and the real world; user control and freedom; consistency and standards; error prevention; recognition rather than recall; flexibility and efficiency of use; aesthetic and minimalist design; helping users recognise, diagnose and recover from errors; and help and documentation. The explanations were expanded in 2020 and the heuristics themselves are unchanged ([NN/g, 10 Usability Heuristics, 24 Apr 1994, last reviewed 30 Jan 2024](https://www.nngroup.com/articles/ten-usability-heuristics/)).

**[DURABLE]** Practical readings of the heuristics from the same NN/g source: give timely feedback on what the system is doing; use the user's words and not internal jargon; offer clearly marked exits and undo; prefer preventing errors, through constraints and confirmations before commit, over reporting them; write error messages in plain language that state the problem and suggest a fix; and make help task-focused, searchable and in context ([NN/g, 10 Usability Heuristics, 24 Apr 1994, last reviewed 30 Jan 2024](https://www.nngroup.com/articles/ten-usability-heuristics/)).

### Forms: one thing per page and a question protocol

**[DURABLE; official guidance backed by service research]** The GOV.UK Design System's guidance on question pages is to start with one question per page and group questions only when user research supports it. It prescribes a question protocol: know why each question is asked, ask only what is needed, ask each item once per journey and pre-populate it if it is needed again, and tell users why you ask. Allow "I do not know" where that is a valid answer ([GOV.UK Design System, Question pages](https://design-system.service.gov.uk/patterns/question-pages/)).

**[DURABLE; official guidance]** GOV.UK Design System rules for form details: mark optional fields with "(optional)" and do not mark mandatory fields with asterisks; put a back link at the top of each question page and never break the browser back button; for one-time actions such as payment, show a sensible message instead of repeating the action; use the label or legend as the page heading so that screen-reader users hear it once; label the button "Continue" and not "Next"; keep hints to one short sentence without links; and avoid range sliders or, if one is used, offer a non-drag way to answer ([GOV.UK Design System, Question pages](https://design-system.service.gov.uk/patterns/question-pages/)).

**[DURABLE; single case]** The GOV.UK Design System advises testing a form without a progress indicator first: the Carer's Allowance team removed a 12-step indicator with no effect on completion rates or times ([GOV.UK Design System, Question pages](https://design-system.service.gov.uk/patterns/question-pages/)).

### A forms checklist for agents

**[INFERENCE]** The department's forms checklist has seven items: run the question protocol on every field; one question per page by default; "(optional)" labels and no asterisks; never re-ask data, which is also WCAG 2.2 criterion 3.3.7 (section 17); show the total cost before the last step; offer guest checkout where a purchase does not need an account; and aim for 12 to 14 form elements in a checkout. The checklist is the researchers' synthesis from GOV.UK ([GOV.UK Design System, Question pages](https://design-system.service.gov.uk/patterns/question-pages/)) and Baymard ([Baymard, Cart abandonment rate statistics, updated 28 Oct 2026](https://baymard.com/lists/cart-abandonment-rate)).

### Checkout abandonment benchmarks

**[FAST-MOVING, page updated 28 Oct 2026] [VENDOR]** Baymard, a research firm that also sells its research, puts average documented cart abandonment at 70.22%, the unweighted mean of 50 studies from 2006 to 2025 with a range of 55% to 84%. The average US checkout shows 23.48 form elements by default (14.88 form fields), against Baymard's ideal of 12 to 14 elements (7 to 8 fields). Baymard's own estimate is that a large ecommerce site could gain a 35.26% increase in conversion from better checkout design ([Baymard, Cart abandonment rate statistics, updated 28 Oct 2026](https://baymard.com/lists/cart-abandonment-rate)). The uplift estimate is the vendor's own claim.

**[FAST-MOVING, survey date not stated on the page] [VENDOR]** Baymard's survey of US shoppers gives the reasons for abandoning a checkout, excluding those just browsing. The table lists them; every row is from the same page.

| Reason for abandoning checkout (US shoppers) | Share | Source |
|---|---|---|
| Extra costs too high | 40% | [Baymard, Cart abandonment rate statistics, updated 28 Oct 2026](https://baymard.com/lists/cart-abandonment-rate) |
| Delivery too slow | 20% | [Baymard, Cart abandonment rate statistics, updated 28 Oct 2026](https://baymard.com/lists/cart-abandonment-rate) |
| Did not trust the site with card details | 19% | [Baymard, Cart abandonment rate statistics, updated 28 Oct 2026](https://baymard.com/lists/cart-abandonment-rate) |
| Forced account creation | 18% | [Baymard, Cart abandonment rate statistics, updated 28 Oct 2026](https://baymard.com/lists/cart-abandonment-rate) |
| Checkout too long or complicated | 17% | [Baymard, Cart abandonment rate statistics, updated 28 Oct 2026](https://baymard.com/lists/cart-abandonment-rate) |
| Errors or crashes | 17% | [Baymard, Cart abandonment rate statistics, updated 28 Oct 2026](https://baymard.com/lists/cart-abandonment-rate) |
| Returns policy | 13% | [Baymard, Cart abandonment rate statistics, updated 28 Oct 2026](https://baymard.com/lists/cart-abandonment-rate) |
| Could not see total cost up front | 12% | [Baymard, Cart abandonment rate statistics, updated 28 Oct 2026](https://baymard.com/lists/cart-abandonment-rate) |
| Card declined | 10% | [Baymard, Cart abandonment rate statistics, updated 28 Oct 2026](https://baymard.com/lists/cart-abandonment-rate) |
| Too few payment methods | 9% | [Baymard, Cart abandonment rate statistics, updated 28 Oct 2026](https://baymard.com/lists/cart-abandonment-rate) |

**[INFERENCE]** Baymard's figures are consumer-ecommerce numbers; for a B2B SaaS product they are directional only for sign-up and billing flows. The abandonment reasons map onto the heuristics: unexpected costs and unseen totals are a failure of visibility of system status, and forced accounts are a failure of user control. This link is the researchers' reading and not Baymard's.

### Performance as part of UX

**[DURABLE; official guidance, page updated 31 Oct 2024]** Google's Core Web Vitals "good" thresholds are: Largest Contentful Paint at most 2.5 seconds, Interaction to Next Paint at most 200 milliseconds, and Cumulative Layout Shift at most 0.1. Judge at the 75th percentile of page loads, separately for mobile and desktop; a page passes only if all three pass ([web.dev, Web Vitals, updated 31 Oct 2024](https://web.dev/articles/vitals)). **[GAP]** The "poor" thresholds were not on the fetched page.

### Design for trust

**[FAST-MOVING, 2026]** Trust shows up in both the checkout data and the AI guidance. In Baymard's survey 19% of US shoppers who abandoned a checkout cited distrust of the site with card information and 12% could not see the total cost up front ([Baymard, Cart abandonment rate statistics, updated 28 Oct 2026](https://baymard.com/lists/cart-abandonment-rate)). NN/g names trust as a major design problem for AI experiences in 2026 and says it rests on transparency, user control, consistency and support when the system fails ([NN/g, State of UX 2026, 16 Jan 2026](https://www.nngroup.com/articles/state-of-ux-2026/)).

### Empty states

**[DURABLE; practitioner guidance, 19 Sep 2021]** NN/g's guidance on empty states in complex applications: never leave an empty state blank, because users cannot tell loading from failure from no data. After a process ends with no results, say so specifically, and do not show "no records" while content is still loading. Use the space to teach in context: say what the area is for and how it gets filled, give a button or link straight to the filling action plus a learn-more link, and consider demo data as a second path ([NN/g, Designing Empty States in Complex Applications, 19 Sep 2021](https://www.nngroup.com/articles/empty-state-interface-design/)).

### Loading and waiting states

**[FAST-MOVING, updated 8 Jun 2026; platform guidance]** Apple's Human Interface Guidelines advise status messages that describe what is actually happening instead of a vague "Processing…", and on failure a plain-language description of what happened with a clear next step ([Apple Human Interface Guidelines, Generative AI, created 9 Jun 2025, updated 8 Jun 2026](https://developer.apple.com/design/human-interface-guidelines/generative-ai)).

### What was not sourced on UX fundamentals

**[GAP]** Information architecture, interaction design patterns, onboarding-flow evidence, and mobile and responsive practice were not sourced in this research. No 2025 to 2026 quantitative evidence on onboarding or empty-state patterns was found. Agents must not present specific numbers for these topics from this document.
