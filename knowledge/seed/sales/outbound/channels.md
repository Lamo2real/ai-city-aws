---
id: sales.outbound.channels
department: sales
domain: outbound
title: 'Sales: Outbound channels (cold email, cold calling, LinkedIn, multichannel)'
summary: 'Outbound channels: cold email (deliverability, copy, reply rates), cold calling (connect rates, openers), LinkedIn and multichannel sequences. Compliance rules on consent and calling always apply first.'
type: playbook
audience: both
confidence: vendor
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- email
- phone
- linkedin
objectives:
- prospecting
sources:
- https://support.google.com/a/answer/81126?hl=en
- https://techcommunity.microsoft.com/blog/outlook/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730
- https://easydmarc.com/blog/google-yahoo-microsoft-icloud/
- https://www.smartlead.ai/benchmarks
- https://hunter.io/the-state-of-cold-email
- https://instantly.ai/cold-email-benchmark-report-2026
- https://belkins.io/blog/cold-email-response-rates.md
- https://www.gong.io/resources/labs/does-cold-email-even-work-any-more-heres-what-the-data-says/
- https://cognism.com/reports/state-of-outbound-2026
- https://lavender.ai/blog/the-cold-email-benchmark-report
- https://www.gong.io/blog/do-execs-really-reply-to-cold-email-here-s-what-the-data-says
- https://belkins.io/blog/cold-calling-benchmarks.md
- https://www.cognism.com/reports/cold-calling-report-2026
- https://www.orum.com/blog/how-to-improve-sales-connect-rates-in-2026
- https://www.cognism.com/blog/cold-calling-statistics
- https://www.gong.io/resources/labs/the-best-and-worst-cold-call-openers-backed-by-data-from-300m-calls/
- https://www.kixie.com/sales-blog/your-2025-guide-to-caller-id-reputation-management/
- https://www.gong.io/resources/labs/is-cold-calling-dead/
- https://www.orum.com/reports-and-guides/the-state-of-cold-calling
- https://belkins.io/b2b-outreach
- https://www.bridgegroupinc.com/research/2025-sdr-models-metrics-report-the-bridge-group
- https://expandi.io/?p=20007
- https://belkins.io/blog/linkedin-outreach-study.md
- https://overloop.com/blog/linkedin-limits
- https://www.linkedin.com/legal/user-agreement
- https://www.apollo.io/insights/whats-the-ideal-cadence-for-a-multi-channel-outbound-sequence
related:
- sales.prospecting.foundations
- sales.compliance.outreach-by-country-and-channel
- sales.compliance.sweden
- sales.compliance.ai-agent-guardrails
seed_version: 1
cross_refs:
  '27':
  - sales.compliance.outreach-by-country-and-channel
---

**When to use this:** When writing or judging cold email, cold calls, LinkedIn outreach or multichannel sequences, including reply-rate and connect-rate expectations.

**Source section:** 24. Outbound channels: cold email, cold calling, LinkedIn and multichannel sequences

### Cold email: mailbox-provider rules are the hard floor

**[FAST-MOVING, checked Nov 2026]** Gmail requires SPF or DKIM for all senders and SPF, DKIM and DMARC for bulk senders, a spam rate in Postmaster Tools below 0.10% and never reaching 0.30%, and one-click unsubscribe headers plus a visible link on marketing and subscribed messages; non-compliant mail can be marked as spam or rejected. Gmail's volume guidance is to send at a consistent rate, start low with engaged recipients, increase slowly and cut volume if bounces or deferrals start ([Google email sender guidelines](https://support.google.com/a/answer/81126?hl=en)). Microsoft's consumer mail services require domains sending more than 5,000 emails a day to pass SPF and DKIM and publish DMARC from 5 May 2025, and reject non-compliant mail ([Microsoft Tech Community](https://techcommunity.microsoft.com/blog/outlook/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730)). A vendor summary modified 3 November 2026 says Google, Yahoo and Microsoft all set the bulk threshold at 5,000 or more messages a day per domain, that Yahoo expects unsubscribes honoured within two business days and that Apple requires authentication for bulk senders ([EasyDMARC, modified 3 Nov 2026](https://easydmarc.com/blog/google-yahoo-microsoft-icloud/)). **[GAP]** The enforcement start dates for Gmail and Yahoo and Yahoo's own sender page were not verified in the research. A vendor item dated 9 November 2026 headlined a brief Microsoft rejection of mail from domains without DMARC; only the headline was seen ([EasyDMARC, modified 3 Nov 2026](https://easydmarc.com/blog/google-yahoo-microsoft-icloud/)).

### Cold email: infrastructure and sending volume

**[VENDOR; FAST-MOVING, 2025-2026]** Smartlead's data (more than 850 million emails, H1 2026) shows a typical sender at 13.9 emails per mailbox per day, the heaviest 10% at 42, a stated safe limit of 50, and authenticated senders needing 108 contacts per reply against 120 for unauthenticated ([Smartlead benchmarks, H1 2026](https://www.smartlead.ai/benchmarks)). The same dataset shows a typical account running 20 mailboxes and a typical campaign list of 499 people, and contacts per reply of 90 for Gmail senders, 120 for Outlook and 179 for custom servers ([Smartlead benchmarks, H1 2026](https://www.smartlead.ai/benchmarks)). Hunter's 2025 data shows 20 to 49 emails per account per day at 5.7% reply against 4.5% overall, a custom domain at 5.2% against 2.5% for free mail, and disabling open tracking at 7.4% against 4.4% with tracking ([Hunter, State of Email Outreach 2026](https://hunter.io/the-state-of-cold-email)). Instantly advises warming new mailboxes at 5 to 10 emails a day and increasing over four to six weeks ([Instantly benchmark report 2026](https://instantly.ai/cold-email-benchmark-report-2026)). It also says consistent senders see 15 to 20% more replies ([Instantly benchmark report 2026](https://instantly.ai/cold-email-benchmark-report-2026)), and Hunter reports Google Workspace senders at 5.9% reply against just over 4% for Microsoft 365 ([Hunter, State of Email Outreach 2026](https://hunter.io/the-state-of-cold-email)). Smartlead excludes open rate from its benchmarks because automatic image loading inflates opens, and Belkins disabled open tracking for all 2025 campaigns ([Smartlead benchmarks, H1 2026](https://www.smartlead.ai/benchmarks); [Belkins cold email response rates, 2025 data](https://belkins.io/blog/cold-email-response-rates.md)).

### Cold email: operating thresholds for agents

**[INFERENCE]** Derived thresholds: authenticate every sending domain even far below 5,000 a day; warm for four to six weeks; cap at roughly 20 to 30 cold emails per mailbox per day with 50 as a ceiling; pause a mailbox when bounce exceeds 2% or complaint rate approaches 0.1%; keep open tracking off; include an easy opt-out in every message. Sending from separate domains and not the primary corporate domain is universal practitioner advice. **[GAP]** No primary source was retrieved for the separate-domain practice or for a safe number of mailboxes per domain.

### Cold email: reply and meeting benchmarks, with denominators

**[VENDOR; FAST-MOVING, 2025-2026]** Per contact, Smartlead: median sender 0.74% (135 contacts per reply), top quarter 1.43%, top tenth 2.63%, top twentieth 3.85% ([Smartlead benchmarks, H1 2026](https://www.smartlead.ai/benchmarks)). Per email sent, Belkins' managed campaigns: 0.45% average in 2025 on 7,530,489 emails, 0.50% in H1 and 0.40% in H2, with more than 1,200 appointments ([Belkins cold email response rates, 2025 data](https://belkins.io/blog/cold-email-response-rates.md)). All replies over all emails sent, Instantly: 3.43% average, top quarter 5.5% and above, top tenth 10.7% and above ([Instantly benchmark report 2026](https://instantly.ai/cold-email-benchmark-report-2026)). Per sequence, Hunter: 4.5% average but 3% for sales use cases, with 1.6% unsubscribe ([Hunter, State of Email Outreach 2026](https://hunter.io/the-state-of-cold-email)). Gong Labs with Jason Bay on more than 28 million cold emails: the average rep needs 344 cold emails to book one meeting, and top performers book 8.1 times more meetings ([Gong Labs cold email study, 24 Jul 2025](https://www.gong.io/resources/labs/does-cold-email-even-work-any-more-heres-what-the-data-says/)). Single-company and coached-population figures are higher: Cognism's own team at 8.98% reply and 1.12% opt-out ([Cognism State of Outbound 2026](https://cognism.com/reports/state-of-outbound-2026)) and Lavender's users around 5% for well-scored emails ([Lavender, 4 Feb 2026](https://lavender.ai/blog/the-cold-email-benchmark-report)). Further detail from the same datasets: Smartlead's bottom tenth need 625 contacts per reply ([Smartlead benchmarks, H1 2026](https://www.smartlead.ai/benchmarks)); Belkins' reply rate peaked in February at 0.54% and bottomed in December at 0.35% ([Belkins cold email response rates, 2025 data](https://belkins.io/blog/cold-email-response-rates.md)); Hunter's non-sales use cases reply at 6.2% (marketing), 7.5% (recruiting) and 13% (digital PR), and a third of its surveyed decision-makers replied to no cold email in the past year while 32% replied to five or more ([Hunter, State of Email Outreach 2026](https://hunter.io/the-state-of-cold-email)); in Lavender's sample of 231,818 emails, well-scored emails to technical buyers got 5.2% and only 6.1% of emails to finance earned its top score ([Lavender, 4 Feb 2026](https://lavender.ai/blog/the-cold-email-benchmark-report)).

### Cold email: planning yield

**[INFERENCE]** For forecasting use the per-contact figures: roughly one reply per 100 to 200 contacts and one meeting per several hundred emails for average execution, with top-decile execution three to eight times better. Belkins' totals imply about one appointment per 6,000 emails sent, which is the researchers' arithmetic on its published totals. The platform averages from Instantly and Hunter are higher mainly because of definitions and user mix.

### Cold email: length, subject and content

**[VENDOR; FAST-MOVING, 2025-2026]** Gong and Bay: emails of 100 words or fewer get more replies, best at three to four sentences; pitching the product cuts reply rates by as much as 57%; buzzwords and numbers cut open rates by up to 17.9%; subject lines should avoid selling language, jargon, numbers and questions ([Gong Labs cold email study, 24 Jul 2025](https://www.gong.io/resources/labs/does-cold-email-even-work-any-more-heres-what-the-data-says/)). For executives: subject lines of one to four words naming their problem, bodies of 50 to 100 words, and a call to action that offers something of value such as a peer benchmark instead of asking for a meeting ([Gong, 29 Jan 2026](https://www.gong.io/blog/do-execs-really-reply-to-cold-email-here-s-what-the-data-says)). Smartlead: first emails under 50 words got 1.47% reply ([Smartlead benchmarks, H1 2026](https://www.smartlead.ai/benchmarks)). **[CONTESTED]** Hunter disagrees on details: a subject sweet spot of five to six words, both 61 to 80 and 181 to 200 word bodies performing comparatively well, and no measurable effect from images, attachments, emojis or day of week ([Hunter, State of Email Outreach 2026](https://hunter.io/the-state-of-cold-email)).

### Cold email: personalisation and why emails fail

**[VENDOR; FAST-MOVING, 2025 data]** Hunter found two custom attributes in the body gave 5.6% reply against 3.6% with none and manually edited emails 5.2% against 4.4% fully automated. Its decision-maker survey (respondent count not stated) says cold emails fail because they are too pushy (65%), irrelevant (61%) or generic (48%), and that preferred asks are low-pressure offers of more information ([Hunter, State of Email Outreach 2026](https://hunter.io/the-state-of-cold-email)).

### Cold email: follow-ups and timing

**[VENDOR; FAST-MOVING, 2025-2026]** Hunter: three messages gave 6.8% total reply against 3.3% for one, the first message drives most replies, and its recommendation moved from four messages to three ([Hunter, State of Email Outreach 2026](https://hunter.io/the-state-of-cold-email)). Instantly: step one produces 58% of replies, with three to four days between touches and reply-style follow-ups outperforming formal ones by about 30% ([Instantly benchmark report 2026](https://instantly.ai/cold-email-benchmark-report-2026)). Smartlead: email one gets 1.18% reply and email seven 0.33%; 64% of replies arrive within one hour and 88.5% within 24 hours ([Smartlead benchmarks, H1 2026](https://www.smartlead.ai/benchmarks)). Timing findings vary: peak around 7am recipient time at Smartlead, 8am to noon at Belkins, Tuesday to Wednesday at Instantly ([Smartlead benchmarks, H1 2026](https://www.smartlead.ai/benchmarks); [Belkins cold email response rates, 2025 data](https://belkins.io/blog/cold-email-response-rates.md); [Instantly benchmark report 2026](https://instantly.ai/cold-email-benchmark-report-2026)). **[INFERENCE]** Default sequence: three to four emails over 10 to 14 days, three to four days apart, a first email of 50 to 80 words, later emails written as replies in the same thread and each adding something new. Agents must be ready to answer replies within the hour.

### A first-touch message template and lint rules

**[INFERENCE]** A first-touch template consistent with the evidence: a subject of one to four words naming the prospect's problem; one line showing why this person and why now, based on a verified trigger; one line on the problem as peers experience it; one specific proof point, only if true and permitted; one soft question offering something useful; under 80 words, with no feature list, no mention of AI as a selling point and no meeting link. Lint rules for agent output: more than 100 words; a product-first opening; unverifiable personalisation; multiple asks; superlatives and buzzwords; statistics in the subject line; fake familiarity on a first touch; identical copy at scale. **[GAP]** No controlled evidence compares problem-led with product-led messaging beyond Gong's correlational data.

### Cold calling: connect and meeting benchmarks

**[VENDOR; FAST-MOVING, 2025-2026]** Belkins' 2025 data on more than 175,000 dials: a per-dial connect rate of 9.9%, per-prospect connect rate of 24.5%, connect-to-conversation of 58%, conversation-to-meeting of 4.6%, roughly 370 dials per meeting and three attempts per prospect ([Belkins cold calling benchmarks, 26 Jun 2026](https://belkins.io/blog/cold-calling-benchmarks.md)). Cognism's 2026 report on more than 200,000 calls: a success rate (calls resulting in a meeting) of 2.7%, up from 2.3% and down from 4.82% in 2024; its own team at 11.3%; average call 82 seconds ([Cognism Cold Calling Report 2026](https://www.cognism.com/reports/cold-calling-report-2026)). Cognism's own SDR calls had a 13.3% answer rate in 2025 ([Cognism State of Outbound 2026](https://cognism.com/reports/state-of-outbound-2026)). Cognism also reports 1.55 calls on average to reach a prospect (2.9 the year before) ([Cognism Cold Calling Report 2026](https://www.cognism.com/reports/cold-calling-report-2026)), an average SDR call of two minutes and about 70% of SDR calls coming from sequences ([Cognism State of Outbound 2026](https://cognism.com/reports/state-of-outbound-2026)). One vendor states connect rates typically range from 3% to 10% ([Orum blog, 2 Jul 2026](https://www.orum.com/blog/how-to-improve-sales-connect-rates-in-2026)). **[INFERENCE]** The two headline numbers use different denominators; report both with the denominator. **[GAP]** Cognism's regional figures are inconsistent across its own pages and should be treated as unreliable.

### Cold calling: attempts and timing

**[VENDOR; FAST-MOVING, 2025]** 93% of conversations happen by the third call attempt and more than 98% by the fifth ([Cognism cold calling statistics, 2025 report](https://www.cognism.com/blog/cold-calling-statistics)). **[CONTESTED]** Best-time findings conflict: Cognism finds 10 to 11am and 2 to 3pm with Thursday strongest and Friday weakest ([Cognism Cold Calling Report 2026](https://www.cognism.com/reports/cold-calling-report-2026)); Belkins finds Wednesday then Monday, 3 to 4pm and 6pm local, with meeting rates highest in February (8.9%) and May (8.5%) and lowest in July to September at about 3% ([Belkins cold calling benchmarks, 26 Jun 2026](https://belkins.io/blog/cold-calling-benchmarks.md)). **[INFERENCE]** Stop after about five attempts, test timing by segment, and expect Friday and the summer months to be weak.

### Cold calling: openers and call structure

**[VENDOR; FAST-MOVING, Jul 2024]** In Gong's analysis of more than 300 million cold calls, asking whether it is a bad time scored 2.15%, about baseline; asking how the day is going 7.6%; a permission-based opener (lead with context, own that it is a cold call, ask for time) 11.18%; and asking whether the prospect has heard the company's name 11.24%. If they have heard of you, ask what they heard; if not, explain how you work with their peers ([Gong Labs openers study, 24 Jul 2024](https://www.gong.io/resources/labs/the-best-and-worst-cold-call-openers-backed-by-data-from-300m-calls/)). The page does not define success and was edited in 2026, so quote it cautiously. Meeting-booking calls averaged 3.7 minutes in Belkins' data ([Belkins cold calling benchmarks, 26 Jun 2026](https://belkins.io/blog/cold-calling-benchmarks.md)). **[INFERENCE]** Script skeleton: name and context; acknowledge that it is a cold call and ask for 30 seconds; a one-sentence problem statement tied to peers; a question; then the ask for a meeting.

### Cold calling: who answers and what they say

**[VENDOR; FAST-MOVING, 2025-2026]** By title in Belkins' data: managers and leads had an 11.1% live-contact rate and vice presidents 7.3%; C-level calls produced follow-up requests more than bookings; directors booked the most meetings. Non-booking conversations ended in hard rejection 31%, warm follow-up 19%, wrong person or number 13.5%, gatekeeper 13.4% and a request for email 9% ([Belkins cold calling benchmarks, 26 Jun 2026](https://belkins.io/blog/cold-calling-benchmarks.md)). The top objections per Cognism are not interested, other priorities, too busy so send an email, tried similar before and already have a solution; its suggested response to "not interested" is to ask whether that is because of existing tools or timing and budget ([Cognism Cold Calling Report 2026](https://www.cognism.com/reports/cold-calling-report-2026)). **[INFERENCE]** Prepare responses to these five in advance, phrased as a clarifying question and not a rebuttal.

### Cold calling: number reputation

**[VENDOR; FAST-MOVING, Aug 2026]** One vendor guide lists spam-label triggers for outbound numbers: high volume from one number with low engagement, low answer rates, short call durations, complaints and blocks, recycled numbers and mismatched caller identity; rotation alone does not fix it; warm new numbers gradually, track volume, answer rate and duration per number, and keep suppression lists current ([Kixie, 20 Aug 2026](https://www.kixie.com/sales-blog/your-2025-guide-to-caller-id-reputation-management/)). **[GAP]** No sourced data on voicemail was retrieved in the prospecting research, carriers publish no calls-per-number threshold, and no independent comparison of dialler types was found.

### Cold calling: older and unverified vendor claims

**[VENDOR; 2018, outdated]** Gong's 2018 analysis of 90,380 connected cold calls found successful calls were almost twice as long, with reps talking more in longer monologues (37 against 25 seconds), recommended stating the reason for the call early, and put baseline success as low as 1.48% ([Gong Labs, 2018](https://www.gong.io/resources/labs/is-cold-calling-dead/)). **[VENDOR]** One dialler vendor says early morning and 4 to 6pm are better for reaching decision-makers and that its dialler connects reps faster than parallel diallers, with no independent test; its large gated report was not readable ([Orum blog, 2 Jul 2026](https://www.orum.com/blog/how-to-improve-sales-connect-rates-in-2026); [Orum report page](https://www.orum.com/reports-and-guides/the-state-of-cold-calling)). Older survey figures relayed by a vendor say 57% of C-level and vice-president buyers prefer phone contact and 82% of buyers accept meetings at least occasionally from sellers who reach out; the date is not shown ([Cognism cold calling statistics, 2025 report](https://www.cognism.com/blog/cold-calling-statistics)). A combined 2026 outreach report from one agency publishes no combined-channel numbers on its landing page ([Belkins State of B2B Outreach 2026](https://belkins.io/b2b-outreach)).

### Phone-centric teams have more conversations

**[FAST-MOVING, 2025]** Phone-centric SDR teams have 4.6 quality conversations a day against 3.4 for email-centric teams ([Bridge Group 2025 SDR report](https://www.bridgegroupinc.com/research/2025-sdr-models-metrics-report-the-bridge-group)). **[INFERENCE]** That is about 35% more, supporting a phone-first mix where calling is lawful.

### LinkedIn: acceptance and reply benchmarks

**[VENDOR; FAST-MOVING, May 2025-Apr 2026]** Expandi's data on 13,302 accounts and 13.2 million connection requests: acceptance of 28.5%, reply to the connection note of 3.0% and reply to messages of 10.4%; connection-note reply fell from 3.5% in May 2025 to 2.2% in April 2026 while request volume rose about 13% ([Expandi, May 2025-Apr 2026 data](https://expandi.io/?p=20007)). Belkins and Expandi on 15.1 million contacts in 2025: an average connection rate of 26% and overall reply rate of 7.2%; requests with a note got 25.3% acceptance against 27.6% without, but 8.2% reply against 5.3%; in Belkins' own client funnel 18.7% accepted, 17.6% of connected prospects replied and 1.3% of connected prospects booked a meeting ([Belkins LinkedIn outreach study, 2025 data](https://belkins.io/blog/linkedin-outreach-study.md)). AI-assisted messages got 7.3% reply against 7.0% without AI, effectively no difference ([Belkins LinkedIn outreach study, 2025 data](https://belkins.io/blog/linkedin-outreach-study.md)). By campaign type, messaging existing connections got 12.2% reply, connection-then-message 7.9% and open InMail 7.5% on only 13,600 contacts; by recipient role, HR and talent 10.9%, C-level 7.0% and founders 6.4% ([Belkins LinkedIn outreach study, 2025 data](https://belkins.io/blog/linkedin-outreach-study.md)). By sender industry in Expandi's data, staffing and recruiting saw 36.5% acceptance and computer software 27.5%; 82% of volume comes from senders at companies with 200 or fewer employees ([Expandi, May 2025-Apr 2026 data](https://expandi.io/?p=20007)).

### LinkedIn: limits and restriction triggers

**[PLATFORM CLAIM; FAST-MOVING, Jul 2026]** A vendor guide mixing official and community figures gives official limits of 50 InMail credits a month on Sales Navigator Core rolling over to 150, 30,000 first-degree connections and a 300-character connection note, and community-reported limits of about 100 invitations per rolling seven days and 10 to 30 first messages a day. Restriction triggers are exceeding limits, rapid repeated actions, identical copy at scale, device or location churn and scraping tools ([Overloop, 8 Jul 2026](https://overloop.com/blog/linkedin-limits)). LinkedIn's user agreement prohibits scraping and automated messaging (unverified, not fetched, [LinkedIn User Agreement](https://www.linkedin.com/legal/user-agreement)). **[GAP]** The roughly 100-a-week limit is community-reported and not confirmed by LinkedIn.

### LinkedIn: how agents should use it

**[INFERENCE]** With about 100 invitations a week, 26 to 29% acceptance and a 1.3% connected-to-meeting rate, one profile yields on the order of one meeting every three weeks from cold connection campaigns alone. LinkedIn is best used as a recognition and warming layer in a multichannel sequence and for messaging existing connections. A blank request followed by a relevant message after acceptance is a defensible default. All benchmark datasets come from automation tools whose use LinkedIn's terms prohibit, so the safer pattern is for agents to draft and queue while a human or a compliant integration sends. **[VENDOR]** 50.5% of decision-makers in Hunter's survey named LinkedIn as their preferred outreach channel against 25% for email ([Hunter, State of Email Outreach 2026](https://hunter.io/the-state-of-cold-email)).

### Multichannel sequences

**[VENDOR; FAST-MOVING, 2025-2026]** Cognism's 2025 data on 196,470 prospects: an average of 3.36 touches per prospect, best results at three to five touches, a recommended opening of a call, then an email, then a LinkedIn touch within the first five days, and a task mix of 57% calls, 27% LinkedIn and 15% email ([Cognism State of Outbound 2026](https://cognism.com/reports/state-of-outbound-2026)). Apollo's 12-touch mid-market template over 28 days, with no sample: day 1 call plus intro email; day 3 email with a self-serve asset; day 5 call plus voicemail; day 8 social touch; day 10 email with case study; day 14 call; day 18 email with a low-friction ask; day 22 social; day 28 call plus a final email ([Apollo, 6 May 2026](https://www.apollo.io/insights/whats-the-ideal-cadence-for-a-multi-channel-outbound-sequence)). **[INFERENCE]** A default consistent with the per-channel evidence: three to four emails, three to five call attempts and two to three LinkedIn touches, giving 8 to 12 touches in three to four weeks, front-loaded in the first five days, then stop and recycle on a new trigger after 60 to 90 days. Measure completed touches per prospect and not designed sequence length. Channel choice follows the consent rules in section 27. **[GAP]** No controlled or large-sample study quantifies the lift from combining channels, and no evidence on SMS, messaging apps or direct mail in B2B sequences was retrieved.
