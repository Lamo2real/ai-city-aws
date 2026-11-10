---
name: postmortem-writeup
description: "Write a blameless postmortem after an incident: timeline, impact, root causes, what went well, and owned follow-ups."
---
# Postmortem

- Blameless: describe systems and decisions, not people's failings.
- Summary in three sentences: what broke, for whom, for how long.
- Impact with numbers: users affected, failed requests, revenue, data.
- Timeline in UTC from first signal to all clear: detection, response, mitigation, resolution.
- Root causes: ask why until you reach something you can change; usually more than one.
- What went well, what went badly, where we got lucky.
- Follow-ups: each with an owner, a date and the risk it removes. Prefer fixes that prevent a whole class of incident.
