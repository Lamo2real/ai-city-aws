---
id: research.compliance.personal-data-in-research
department: research
domain: compliance
title: 'Research: Personal data in research'
summary: 'Personal data in research: minimise, inform, and stay out of offence data. GDPR provisions that bear on research; Swedish data-protection act; Participants, recordings and consent.'
type: policy
audience: both
confidence: established
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- compliance
sources:
- https://gdpr-info.eu/art-89-gdpr/
- https://gdpr-info.eu/art-14-gdpr/
- https://www.addleshawgoddard.com/en/insights/insights-briefings/2026/data-protection/eu-digital-omnibus-european-council-adopts-its-position/
- https://www.noerr.com/en/insights/digital-omnibus-ai-is-nearing-the-finish-line-is-eu-data-law-heading-down-the-wrong-track
- https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018218-med-kompletterande-bestammelser_sfs-2018-218/
- https://allea.org/wp-content/uploads/2023/06/European-Code-of-Conduct-Revised-Edition-2023.pdf
- https://esomar.org/representation/icc-esomar-code-of-conduct
- https://lagen.nu/1962:700
related:
- research.compliance.swedish-ethics-review
- research.surveys.survey-and-interview-research
- research.guardrails.agent-guardrails
seed_version: 1
---

**When to use this:** Before collecting, storing or analysing personal data, recording a conversation or seeking consent: GDPR, the Swedish data-protection act and offence data. Orientation for a human to confirm, not legal advice.

**Source section:** 14. Personal data in research: minimise, inform, and stay out of offence data

## 14. Personal data in research: minimise, inform, and stay out of offence data

### 14.1 GDPR provisions that bear on research

[DURABLE] GDPR Article 89, checked on gdpr-info.eu, an unofficial mirror: processing for scientific or historical research or statistics needs safeguards, in particular data minimisation, with pseudonymisation where the purpose allows and non-identifying processing where possible; Union or Member State law may derogate from Articles 15, 16, 18 and 21 for research and statistics where those rights would make the purpose impossible or seriously impair it; and derogations cover only the research part of mixed-purpose processing ([gdpr-info.eu Art. 89](https://gdpr-info.eu/art-89-gdpr/)).

[DURABLE] GDPR Article 14, checked on gdpr-info.eu, an unofficial mirror: where data are not collected from the person, the controller must give its identity, purposes and legal basis, data categories, recipients, retention, the legitimate interest relied on, rights, and the source including whether it was publicly accessible, within a reasonable period of at most one month or at first communication or first disclosure. Article 14(5)(b) lifts the duty where informing is impossible or a disproportionate effort, in particular for research and statistics under Article 89(1) safeguards, but the controller must then take protective measures including making the information public ([gdpr-info.eu Art. 14](https://gdpr-info.eu/art-14-gdpr/)).

[INFERENCE] Article 89 derogations need Union or national law, and scientific research is not the same as commercial market research. A SaaS company should assume that Articles 15, 16, 18 and 21 apply in full to its research data and should use Article 14(5)(b) only with a published notice and a documented effort assessment.

[FAST-MOVING, 21 Oct 2026] GDPR reform is not law. The Commission proposed the Digital Omnibus in November 2025, a Council position was reported on 21 October 2026, Parliament has no position, and trilogue is not expected before March 2027; the Council deleted the proposed explicit AI-training legitimate-interest basis and the changed personal-data definition. Secondary source only ([Addleshaw Goddard](https://www.addleshawgoddard.com/en/insights/insights-briefings/2026/data-protection/eu-digital-omnibus-european-council-adopts-its-position/)). An earlier briefing describes a 10 June 2026 Council compromise and numbers the pseudonymisation article differently ([Noerr](https://www.noerr.com/en/insights/digital-omnibus-ai-is-nearing-the-finish-line-is-eu-data-law-heading-down-the-wrong-track)), so article numbers in commentary on the reform are unstable.

### 14.2 Swedish data-protection act

[DURABLE] Swedish dataskyddslagen (2018:218), consolidated through SFS 2026:1589 and checked on primary source: GDPR yields to the press and expression constitutions, and most GDPR articles do not apply to processing for journalistic purposes or academic, artistic or literary creation (1 kap. 7 §) ([riksdagen.se SFS 2018:218](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018218-med-kompletterande-bestammelser_sfs-2018-218/)). The researchers' reading is that this exemption is not available to routine corporate research.

[DURABLE] Under dataskyddslagen, checked on primary source, criminal-offence data may be processed by authorities and by others only in narrow cases or under specific rules (3 kap. 8 to 9 §§); personal identity numbers may be processed without consent only when clearly justified (3 kap. 10 §); data processed only for research may be used against the person only for vital-interest reasons (4 kap. 3 §); and the age of consent for children is 13 (2 kap. 4 §) ([riksdagen.se SFS 2018:218](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018218-med-kompletterande-bestammelser_sfs-2018-218/)).

[INFERENCE] Offence data on named individuals is close to off-limits for a private company in Sweden under 3 kap. 8 §, so agents should not compile criminal-record-style profiles, even from public court records or commercial background sites.

[INFERENCE] Rules for researching named individuals: stick to the professional role, minimise, make no special-category inference, do not aggregate into profiles, record purpose and legal basis, set retention, and escalate to a human before storing anything. No guidance from IMY on profiling named individuals at competitors was researched.

### 14.3 Participants, recordings and consent

[DURABLE] Tell research participants how their data will be used, stored and deleted, as the ALLEA Code (2023) requires ([ALLEA Code 2023](https://allea.org/wp-content/uploads/2023/06/European-Code-of-Conduct-Revised-Edition-2023.pdf)). ICC/ESOMAR Article 6 adds that no personal data goes to clients without specific consent, that deductive disclosure must be prevented including through advanced analytics or AI, that retention is limited, that recipients provide equivalent security, and that breaches are notified ([ESOMAR, ICC/ESOMAR Code](https://esomar.org/representation/icc-esomar-code-of-conduct)).

[DURABLE] Swedish brottsbalken 4 kap. 9 a § (olovlig avlyssning), checked on lagen.nu, an unofficial mirror: secretly and unlawfully using a technical aid to listen to or record speech in private, a conversation between others, or a closed meeting that the person does not take part in or has entered without right, carries a fine or up to 2 years; the provision does not cover a conversation in which the recorder is a participant. 4 kap. 8 § covers unlawfully accessing a message carried by a postal or telecom operator, and 4 kap. 9 b § makes installing equipment for these offences punishable as preparation ([lagen.nu 1962:700](https://lagen.nu/1962:700)).

[INFERENCE] Recording in Sweden: a participant may record their own call without committing olovlig avlyssning, but for a company that recording is still personal-data processing under GDPR, so participants should be told and a legal basis recorded, and the ICC/ESOMAR code requires transparency in any case. An agent must never record or transcribe a meeting it was not invited to.

[INFERENCE] For surveys and interviews, give information first, get documented consent, state that there will be recording and AI processing, and allow withdrawal. This mirrors the consent rules in the Swedish ethics-review act and is good practice even where that act does not apply.
