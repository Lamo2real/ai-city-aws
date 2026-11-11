---
id: infrastructure.itsm.it-service-management
department: infrastructure
domain: itsm
title: 'IT infrastructure: IT service management'
summary: ITIL 4 and 5, ownership roles in Swedish rules, the change model for agents in ITIL terms, service-desk metrics and priority targets, and discovered configuration records.
type: principle
audience: both
confidence: inference
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms: []
objectives:
- delivery
sources:
- https://www.peoplecert.org/browse-certifications/it-governance-and-service-management/ITIL-1
- https://www.mcf.se/contentassets/5bf554ffb4404abc99467124edead886/mcffs-2026-11.pdf
cross_refs:
  '13':
  - infrastructure.compliance.eu-and-swedish-regulation
seed_version: 1
---

**When to use this:** When using ITIL vocabulary, setting service-desk targets, mapping agent changes to change models or keeping configuration records.

**Source section:** 14. IT service management

## 14. IT service management

### ITIL: version 4 vocabulary, version 5 on sale

**[FAST-MOVING, Nov 2026] [PLATFORM CLAIM]** PeopleCert markets ITIL Version 5 as practical and AI-native, with modules Foundation, AI Governance, Product, Service, Experience, Strategy, Transformation and a Foundation Bridge for ITIL 4 holders; ITIL 4 certifications are still on sale ([PeopleCert ITIL](https://www.peoplecert.org/browse-certifications/it-governance-and-service-management/ITIL-1)). **[GAP]** The release date of Version 5, its differences from ITIL 4 and any retirement date for ITIL 4 exams were not found.

**[GAP: unverified background]** From the researchers' memory of the paywalled ITIL 4 practice guides: ITIL 4 defines 34 practices, with an operational core of incident management (restore service fast), problem management (find and remove causes, keep known-error records), change enablement (standard changes are pre-authorised and low-risk, normal changes are assessed and authorised, emergency changes have expedited authority), service request management (pre-defined, pre-approved fulfilment), service desk, IT asset management, service configuration management, monitoring and event management, and release and deployment management ([PeopleCert ITIL](https://www.peoplecert.org/browse-certifications/it-governance-and-service-management/ITIL-1)).

**[INFERENCE]** For an agent-run department the ITIL practices matter mainly as record-keeping discipline: every action ties to an incident, request, problem or change record.

### Ownership roles in Swedish rules

**[FAST-MOVING, 1 Oct 2026]** Checked on primary source. MCFFS 2026:11 requires a named system owner for each system and an information owner for each processing activity, plus up-to-date documentation of the digital environment ([MCFFS 2026:11](https://www.mcf.se/contentassets/5bf554ffb4404abc99467124edead886/mcffs-2026-11.pdf)). Section 13 explains that this part is not binding on providers active only in the digital sectors, for whom it is good practice.

### Change model for agents in ITIL terms

**[INFERENCE]** A standard change is a pre-approved, tested, reversible runbook that an agent may run alone, with an automatic change record. A normal change is one where the agent proposes a plan and a diff and a human approves. An emergency change is approved by the human incident commander verbally or in chat, with the record completed afterwards.

### Service desk metrics and priority targets

**[INFERENCE]** Service desk metrics worth tracking, by practitioner convention with no single official list: first response time, time to resolve by priority, first-contact resolution, backlog age, reopen rate, SLA attainment, user satisfaction, the share of tickets resolved by automation, and for incidents the mean times to acknowledge and to restore. Report medians and 90th percentiles, because averages hide the bad cases. **[GAP]** No 2026 benchmark data for service desk metrics was retrieved.

| Priority | Definition | Respond | Restore or resolve | Label |
|---|---|---|---|---|
| P1 | Full outage or security incident | 15 minutes | 4 hours | [INFERENCE] convention; adjust to contract |
| P2 | Major degradation | 1 hour | 8 business hours | [INFERENCE] convention; adjust to contract |
| P3 | Normal fault or request | 4 hours | 3 business days | [INFERENCE] convention; adjust to contract |
| P4 | Low priority | 1 day | 10 business days | [INFERENCE] convention; adjust to contract |

### Configuration records: discover, do not hand-maintain

**[INFERENCE]** Manually maintained configuration databases decay. In a cloud-first company treat discovered sources as the configuration record (AWS Config and resource tags, infrastructure-as-code repositories, the device-management inventory, the identity provider's application list, SaaS admin exports) and keep only ownership, criticality and dependency data by hand. Require owner, environment, data-classification and service tags by policy (an SCP or a tag policy) so untagged resources are flagged automatically.
