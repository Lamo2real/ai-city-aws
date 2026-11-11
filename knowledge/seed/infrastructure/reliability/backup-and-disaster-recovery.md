---
id: infrastructure.reliability.backup-and-disaster-recovery
department: infrastructure
domain: reliability
title: 'IT infrastructure: Reliability, backup and disaster recovery'
summary: Error-budget policy, the four AWS disaster-recovery strategies, data-plane failover, recovery tiers for a small SaaS company, immutable backups with AWS Backup Vault Lock, backups as a target, and the 2025 and 2026 outages and their lessons.
type: playbook
audience: both
confidence: platform-claim
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- aws
objectives:
- reliability
sources:
- https://sre.google/workbook/error-budget-policy/
- https://sre.google/sre-book/being-on-call/
- https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html
- https://docs.aws.amazon.com/r53recovery/latest/dg/arc-zonal-shift.html
- https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/abstract-and-introduction.html
- https://docs.aws.amazon.com/aws-backup/latest/devguide/vault-lock.html
- https://docs.aws.amazon.com/aws-backup/latest/devguide/logicallyairgappedvault.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html
- https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2026
- https://aws.amazon.com/message/101925
- https://aws.amazon.com/premiumsupport/technology/pes/
- https://www.thousandeyes.com/blog/microsoft-azure-front-door-outage-analysis-october-29-2025
- https://blog.cloudflare.com/18-november-2025-outage/
- https://blog.cloudflare.com/5-december-2025-outage/
- https://status.cloud.google.com/incidents/ow5i3PPK96RduMcb1SsW
- https://blog.incidenthub.cloud/h1-2026-cloud-saas-reliability-report
- https://blog.railway.com/p/incident-report-may-19-2026-gcp-account-outage
- https://blog.incidenthub.cloud/aws-cloudfront-outage-jul-16-2026
- https://www.businesswire.com/news/home/20260513289344/en/Uptime-Announces-Annual-Outage-Analysis-Report-2026
related:
- infrastructure.incidents.incident-management
- infrastructure.aws.cloud-architecture
seed_version: 1
---

**When to use this:** Before setting SLOs, error budgets, recovery tiers, backups or a failover design, and when learning from the 2025 and 2026 outages.

**Source section:** 6. Reliability, backup and disaster recovery

## 6. Reliability, backup and disaster recovery

### Error budgets: a written policy with freeze and postmortem triggers

**[DURABLE]** Google's example error-budget policy evaluates the service level objective over a rolling four-week window. If the budget is exhausted, changes and releases are frozen except the highest-priority fixes and security fixes until the service is back within its objective. A single incident that consumes more than 20% of the four-week budget requires a postmortem with at least one top-priority action; a class of outage that consumes more than 20% in a quarter requires a top-priority item in the next quarter's plan; disputes escalate to the CTO ([Google SRE Workbook: error budget policy](https://sre.google/workbook/error-budget-policy/)).

**[DURABLE]** The same policy distinguishes causes. Reliability work is mandatory after a code bug, a procedural error or an avoidable hard dependency; feature work may continue if the cause was outside the team's control, such as a company-wide network problem or out-of-scope traffic ([Google SRE Workbook: error budget policy](https://sre.google/workbook/error-budget-policy/)).

**[DURABLE]** A 99.99% quarterly availability target leaves about 13 minutes of downtime, which sets the human response time the target demands ([Google SRE Book: Being On-Call](https://sre.google/sre-book/being-on-call/)). **[INFERENCE]** A 99.9% monthly target leaves about 43 minutes, which is compatible with a 15 to 30 minute human response; this is arithmetic by the researchers and not a sourced figure.

### The four AWS disaster-recovery strategies

**[DURABLE] [PLATFORM CLAIM]** AWS describes four disaster-recovery strategies in rising cost and falling recovery time: backup and restore (lowest cost, slowest, recovery point set by backup frequency); pilot light (data replicated continuously, core data stores on, application servers off); warm standby (a scaled-down but functional copy that can take reduced traffic at once); and multi-site active/active (near-zero recovery time for most disasters, most complex). AWS gives relative positions and no numeric recovery-time or recovery-point bands ([AWS disaster recovery whitepaper](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)).

**[DURABLE] [PLATFORM CLAIM]** AWS's guidance on when to go multi-Region: multi-AZ covers the loss of a data centre, and a highly available multi-AZ workload may need only backup and restore unless the disaster definition includes a whole Region or a regulator requires more. Active/active does not protect against data corruption because replication copies corruption too, so backups and a non-zero recovery point remain necessary ([AWS disaster recovery whitepaper](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)).

### Fail over on data planes, with capacity already in place

**[DURABLE] [PLATFORM CLAIM]** AWS says to fail over using data-plane operations only, such as Route 53 health-check failover and ARC routing controls, because control planes have lower availability targets. Changing weighted DNS records, Global Accelerator traffic dials, Auto Scaling actions and AWS Backup restores are control-plane operations and are less dependable in a disaster; run periodic restores so usable data stores already exist. Failover may be started by a human, but the steps should be fully automated; AWS prefers manually initiated automated failover over health-check-triggered automatic failover because false alarms are costly ([AWS disaster recovery whitepaper](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)).

**[DURABLE] [PLATFORM CLAIM]** Static stability means provisioning enough capacity for full load in the surviving location so recovery does not depend on scaling. ARC zonal shift moves traffic away from one Availability Zone for supported, opted-in resources; a shift lasts from 1 minute to 3 days and can be extended, and the customer must pre-scale so the remaining zones absorb the load ([AWS disaster recovery whitepaper](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html); [ARC zonal shift documentation](https://docs.aws.amazon.com/r53recovery/latest/dg/arc-zonal-shift.html)). AWS's fault-isolation whitepaper (the page shows a publication date of 29 October 2026) frames Availability Zones, Regions, partitions, control planes and data planes as the isolation boundaries and recommends designs that recover without control planes ([AWS Fault Isolation Boundaries](https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/abstract-and-introduction.html)).

**[INFERENCE]** With three Availability Zones, static stability means steady-state load should not exceed roughly two-thirds of provisioned capacity, so losing one zone needs no scale-up. This is an arithmetical consequence of AWS's pre-scale guidance, not an AWS figure.

**[DURABLE] [PLATFORM CLAIM]** Test disaster recovery regularly, including backup restores on a schedule (a restore is itself a control-plane operation); AWS Resilience Hub can assess whether recovery targets are likely to be met. AWS Backup cross-Region and cross-account copy is the standard tooling, and Neptune snapshots are listed among backup-and-restore mechanisms ([AWS disaster recovery whitepaper](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)).

### Recovery tiers for a small SaaS company

**[INFERENCE]** AWS publishes no numeric bands, so the tiers in the table below are the researchers' illustrative defaults mapped to AWS's strategy names; set the real numbers with the business and against customer contracts.

| Tier | Scope | AWS strategy | Recovery time objective | Recovery point objective | Label |
|---|---|---|---|---|---|
| Tier 1 | Customer-facing production | Multi-AZ plus warm standby or pilot light in a second EU Region | Up to 1 hour | Up to 5 minutes | [INFERENCE] |
| Tier 2 | Internal business systems | Pilot light or backup and restore | Up to 4 hours | Up to 1 hour | [INFERENCE] |
| Tier 3 | Everything else | Backup and restore | Up to 24 hours | Up to 24 hours | [INFERENCE] |

### Immutable backups: AWS Backup Vault Lock

**[PLATFORM CLAIM]** AWS Backup Vault Lock has two modes. In governance mode, users with sufficient IAM permissions can remove the lock. In compliance mode, once the cooling-off period ends, nobody, including the root user and AWS, can remove the lock or delete recovery points before retention ends. The compliance-mode cooling-off period is at least 3 days (72 hours) and up to 36,500 days, and the lock can still be removed during it; minimum retention can be set from 1 day and maximum retention up to 36,500 days. AWS states that compliance mode has been assessed against SEC 17a-4, CFTC and FINRA rules ([AWS Backup Vault Lock](https://docs.aws.amazon.com/aws-backup/latest/devguide/vault-lock.html)).

**[PLATFORM CLAIM]** AWS states limits to Vault Lock: it governs actions taken through AWS Backup only. Disabling an EC2 AMI (`ec2:DisableImage`) can block restores of EC2 recovery points even in a locked vault, and EBS snapshot sharing or tier changes made directly through EC2 APIs are not governed by the lock ([AWS Backup Vault Lock](https://docs.aws.amazon.com/aws-backup/latest/devguide/vault-lock.html)).

**[PLATFORM CLAIM]** A logically air-gapped vault stores backups in an AWS Backup service-owned account, always has compliance-mode Vault Lock, and is encrypted with an AWS-owned key by default or a customer-managed KMS key that cannot be changed later. It can be shared through AWS RAM with individual account IDs (not whole organisations or OUs); shared accounts can view and restore but not copy. With Multi-party approval, backups can be recovered even if the owning account is inaccessible or closed, and primary backups can be written straight to the vault. It is offered in most AWS Backup Regions (not China or GovCloud); Stockholm is not named individually ([AWS Backup logically air-gapped vault](https://docs.aws.amazon.com/aws-backup/latest/devguide/logicallyairgappedvault.html)).

**[GAP: unverified background]** S3 Object Lock in compliance mode is understood to provide write-once storage that nobody, including root, can delete before retention ends; this was not re-read during the research and should be confirmed at the link ([S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)).

**[INFERENCE]** The backup design these documents support: a locked vault in a separate backup account (compliance mode, confirmed during the 72-hour cooling-off window only after a successful restore test), a cross-Region copy, and a logically air-gapped vault shared through RAM to a recovery account. Add SCP denies on `ec2:DisableImage` and on EBS snapshot attribute changes for all but a break-glass role, because Vault Lock does not cover those paths. Run a restore test at least quarterly; the quarterly interval is the researchers' convention.

### Why backups are a primary target

**[FAST-MOVING, 23 Mar 2026] [VENDOR]** Mandiant's M-Trends 2026 reports that ransomware crews deliberately destroy recovery ability by hitting backup infrastructure, identity services and hypervisor management planes, including deleting backup objects in cloud storage; it recommends decoupling backups from the corporate directory and using immutable storage ([Google Cloud blog, M-Trends 2026](https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2026)).

### The 2025 outages: global propagation, then recovery overload

**[FAST-MOVING, Oct 2025] [PLATFORM CLAIM]** AWS us-east-1, 19 to 20 October 2025: a race condition between redundant DNS "Enactors" in DynamoDB's automated DNS management applied a stale plan and then deleted it, emptying the regional DynamoDB endpoint record, and manual intervention was needed. The DynamoDB DNS impact ran roughly from 11:48 PM to 2:40 AM PDT; EC2's host-lease manager then went into congestive collapse, network-state propagation backlogged, and NLB health checks flapped and removed healthy capacity. EC2 launches were normal again at 1:50 PM PDT, about 14 hours end to end, and Redshift recovery ran into 21 October ([AWS post-event summary](https://aws.amazon.com/message/101925)).

**[FAST-MOVING, Oct 2025] [PLATFORM CLAIM]** Services affected in the AWS October 2025 event included DynamoDB, EC2 launches and APIs, NLB, Lambda, ECS, EKS, Fargate, Connect, STS, IAM sign-in and Identity Center, Redshift (IAM-credential queries in all Regions) and the Support Center. AWS disabled the DNS automation worldwide pending a fix and committed to a velocity limit on NLB capacity removal during zone failover, a recovery test suite for the host-lease manager and queue-based throttling ([AWS post-event summary](https://aws.amazon.com/message/101925)). AWS's public list of post-event summaries showed no entry later than October 2025 when checked on 11 November 2026 ([AWS post-event summaries](https://aws.amazon.com/premiumsupport/technology/pes/)).

**[FAST-MOVING, 29 Oct 2025] [VENDOR]** Azure Front Door, 29 October 2025, as described by a third-party analysis of Microsoft's preliminary report: an inadvertent configuration change pushed to the global control plane made edge nodes fail from about 15:45 UTC to 00:05 UTC (roughly 8 hours 20 minutes); Microsoft had to move its own portal off Front Door to regain management access; and failed-over traffic overloaded healthy nodes ([ThousandEyes analysis](https://www.thousandeyes.com/blog/microsoft-azure-front-door-outage-analysis-october-29-2025)). **[GAP]** Microsoft's own post-incident review was not read.

**[FAST-MOVING, 18 Nov 2025] [PLATFORM CLAIM]** Cloudflare, 18 November 2025: a database permissions change made a Bot Management feature file double in size, exceeding a hard limit of 200 features and crashing the core proxy. Main impact ran from about 11:20 to 14:30 UTC with full restoration at 17:06 UTC. The file was regenerated every five minutes, so the network flapped in a way that resembled an attack, and Cloudflare's separately hosted status page failed at the same time by coincidence. Remediations: validate internally generated configuration like user input, add more global kill switches, and stop error reporting from exhausting resources ([Cloudflare 18 Nov 2025 post-mortem](https://blog.cloudflare.com/18-november-2025-outage/)).

**[FAST-MOVING, 5 Dec 2025] [PLATFORM CLAIM]** Cloudflare, 5 December 2025: a WAF-related change sent through the global configuration system, which reaches the whole fleet in seconds with no gradual rollout, triggered a latent error on the older proxy for about 25 minutes, affecting roughly 28% of HTTP traffic. Remediations: staged configuration rollouts with health validation, fail-open handling, break-glass access and a change freeze ([Cloudflare 5 Dec 2025 post-mortem](https://blog.cloudflare.com/5-december-2025-outage/)).

**[FAST-MOVING, 12 Jun 2025] [PLATFORM CLAIM]** Google Cloud, 12 June 2025: a Service Control feature shipped on 29 May without a feature flag or error handling; a policy record with blank fields replicated globally in seconds and crash-looped the binary in every region. Root cause was found within 10 minutes and the kill switch rolled out within 40, but restart overload without randomised backoff kept us-central1 degraded for up to about 2 hours 40 minutes; the status page lists 10:51 to 18:18 PDT overall. Google's own status dashboard was affected and the first public update took about an hour. Remediations: fail open, feature flags off by default, incremental rollout of globally replicated data, a backoff audit, and monitoring that survives the outage ([Google Cloud incident report](https://status.cloud.google.com/incidents/ow5i3PPK96RduMcb1SsW)).

### The 2026 outages: control planes, unchecked automation, single points of failure

**[FAST-MOVING, H1 2026] [VENDOR]** All 2026 outage details in this document come from IncidentHub, a status-page aggregator vendor, reporting causes as the providers' status pages stated them; no provider report was read directly and nothing after July 2026 was collected. Its first-half 2026 aggregate is 30,246 outages across 1,082 providers, with May 2026 the worst month (6,070), cloud providers the most outage-prone category (4,723 across 86 providers) and 15.9% of providers recording none. An "outage" there is any status-page entry of degraded or worse, so the counts include minor events ([IncidentHub H1 2026 report](https://blog.incidenthub.cloud/h1-2026-cloud-saas-reliability-report)).

| Date (2026) | Provider and duration | Published cause as relayed | Source (secondary) |
|---|---|---|---|
| 2 Feb | Microsoft Azure, about 6.5 hours | A remediation policy wrongly disabled anonymous access on storage serving VM extension packages, breaking Virtual Machines, AKS and Azure DevOps | [IncidentHub H1 2026](https://blog.incidenthub.cloud/h1-2026-cloud-saas-reliability-report) |
| 10 to 11 Feb | AWS CloudFront | Change-propagation problems that also affected global services such as Route 53 | [IncidentHub H1 2026](https://blog.incidenthub.cloud/h1-2026-cloud-saas-reliability-report) |
| Early Mar | AWS me-central-1 and me-south-1 | Physical damage from drone strikes in a regional armed conflict; restoration expected to take months; me-south-1 reported unavailable | [IncidentHub H1 2026](https://blog.incidenthub.cloud/h1-2026-cloud-saas-reliability-report) |
| 24 Apr | Microsoft Azure East US, over 12 hours | Lock contention in a PubSub control plane in one zone triggered an incomplete failover that spread across zones | [IncidentHub H1 2026](https://blog.incidenthub.cloud/h1-2026-cloud-saas-reliability-report) |
| 28 Apr to 1 May | GitHub, 2 days 13 hours | A repair job for one repository ran without safety flags and deleted about 1.8 billion pull-request documents from Elasticsearch | [IncidentHub H1 2026](https://blog.incidenthub.cloud/h1-2026-cloud-saas-reliability-report) |
| 19 to 20 May | Railway, about 8 hours | Google Cloud automatically suspended Railway's production account, taking down its API, control plane and all workloads | [IncidentHub H1 2026](https://blog.incidenthub.cloud/h1-2026-cloud-saas-reliability-report); [Railway incident report](https://blog.railway.com/p/incident-report-may-19-2026-gcp-account-outage) |
| 21 to 22 May | Box, about 3 hours | An identity-provider admin region was switched to passive by mistake, blocking SSO logins | [IncidentHub H1 2026](https://blog.incidenthub.cloud/h1-2026-cloud-saas-reliability-report) |
| May | Instructure Canvas, multi-day for some institutions | Security incident attributed to a ransomware group | [IncidentHub H1 2026](https://blog.incidenthub.cloud/h1-2026-cloud-saas-reliability-report) |
| 16 Jul, 07:45 to 11:18 UTC | AWS CloudFront, 3 h 33 min | Customers using VPC Origins were hit; AWS attributed it to an internal constraint on the fleet managing connections to private VPC origins, after which configuration failed to load; workaround was to switch origin type | [IncidentHub, 17 Jul 2026](https://blog.incidenthub.cloud/aws-cloudfront-outage-jul-16-2026) |

### Industry evidence on outages

**[FAST-MOVING, 13 May 2026]** Uptime Institute's Annual Outage Analysis 2026 (released 13 May 2026) reports that outage rates per site fell for a fifth year but improvement is slowing. In Uptime's 2025 survey 57% said their latest major outage cost over $100,000 and one in five over $1 million. Power remains the top cause of impactful data-centre outages; third-party providers (cloud, internet, telecom, colocation) account for about two-thirds of publicly reported outages tracked over nine years; failure to follow procedures is the leading driver of human-error outages; and resiliency assessments still focus more on internal than external risk ([Uptime Institute press release, 13 May 2026](https://www.businesswire.com/news/home/20260513289344/en/Uptime-Announces-Annual-Outage-Analysis-Report-2026)).

### Design lessons from the 2025 and 2026 outages

**[INFERENCE]** The cloud-neutral outage pattern to design against has four parts: global, fast propagation of configuration or data with no canary; missing input validation, with systems failing closed on bad configuration; a recovery stampede without backoff or throttling; and status or management tooling that depends on the failed system. The matching checklist: stage every change including configuration; validate generated configuration; fail open where it is safe; use exponential backoff with jitter; shed load and throttle on restart; and host the status page and incident communications off the primary platform.

**[INFERENCE]** For a Stockholm-primary company, the October 2025 AWS event shows that multi-AZ in one Region does not protect against a regional control-plane or core-dependency failure, and that functions homed in us-east-1 (IAM sign-in and Identity Center, the global STS endpoint, Organizations, billing, some DNS record creation) can be touched even when the workload's Region is healthy. Use regional STS endpoints, keep break-glass access that does not need Identity Center, and avoid infrastructure changes as a recovery step.

**[INFERENCE]** Single-vendor edge dependency (CDN, WAF, DNS) is a leading availability risk for SaaS: two Cloudflare incidents and one Azure Front Door incident fell within six weeks of 2025, and CloudFront had two reported incidents in 2026. CloudFront, Route 53 and IAM control planes are global, so a second Region does not protect against their failure. Keep a rehearsed fallback in tested infrastructure code (an alternate origin type, a direct-to-load-balancer DNS record or a secondary CDN) and keep DNS time-to-live values compatible with it.

**[INFERENCE]** Three further lessons from the 2026 cases. Bulk repair or remediation jobs need a dry run, a scope limit and a second approver (the Azure and GitHub cases are automation acting broadly without a safety check). An account suspension can take everything down at once (the Railway case), so keep billing, contact and compliance details for the AWS Organization current, keep more than one verified root contact, and keep backups in a separate account. Identity-provider failure locks users out even when the application is healthy (the Box case), so document a break-glass login path.

### Gaps in this section

**[GAP]** Not sourced: AWS Fault Injection Service and chaos-engineering practice, ARC zonal autoshift, practice runs and Region switch, AWS Backup restore testing, Resilience Hub detail, autoscaling policy guidance (target tracking, predictive scaling, Karpenter), capacity-planning methods and load-testing benchmarks, the Reliability pillar's availability arithmetic, SLI selection guidance (the SRE Book chapters on SLIs and SLOs were not fetched), a recovery-tier table from any standards body, and Uptime's per-cause percentages (paywalled).
