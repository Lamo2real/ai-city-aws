---
id: infrastructure.compute.kubernetes-containers-serverless
department: infrastructure
domain: compute
title: 'IT infrastructure: Kubernetes, containers and serverless'
summary: Kubernetes upgrades, the EKS version lifecycle and the dates that matter now, EKS data-plane options and node patching, Lambda limits, and managed compute sharing fate with the Region.
type: playbook
audience: both
confidence: platform-claim
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2026-11-26'
platforms:
- aws
- kubernetes
objectives:
- reliability
- delivery
sources:
- https://www.cncf.io/announcements/2026/01/20/kubernetes-established-as-the-de-facto-operating-system-for-ai-as-production-use-hits-82-in-2025-cncf-annual-cloud-native-survey/
- https://kubernetes.io/releases/
- https://docs.aws.amazon.com/decision-guides/latest/containers-on-aws-how-to-choose/choosing-aws-container-service.html
- https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html
- https://docs.aws.amazon.com/eks/latest/best-practices/reliability.html
- https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html
- https://aws.amazon.com/message/101925
seed_version: 1
---

**When to use this:** Before choosing or operating Kubernetes, EKS, containers or Lambda, and for the EKS upgrade dates.

**Source section:** 5. Kubernetes, containers and serverless

## 5. Kubernetes, containers and serverless

### Kubernetes is the default container platform and needs continuous upgrades

**[FAST-MOVING, 20 Jan 2026]** In the CNCF 2025 survey, 82% of container users run Kubernetes in production (66% in 2023), 98% of surveyed organisations use cloud-native techniques, and 66% of organisations hosting generative-AI models use Kubernetes for some or all inference while 44% do not yet run AI or ML workloads on it ([CNCF announcement, 20 Jan 2026](https://www.cncf.io/announcements/2026/01/20/kubernetes-established-as-the-de-facto-operating-system-for-ai-as-production-use-hits-82-in-2025-cncf-annual-cloud-native-survey/)).

**[FAST-MOVING, Nov 2026]** Upstream Kubernetes maintains the three most recent minor versions, each with about one year of patch support. As listed in November 2026: 1.37 reaches end of life on 28 October 2027, 1.36 on 28 June 2027 and 1.35 on 28 February 2027; 1.34 reached end of life on 27 October 2026 ([Kubernetes releases](https://kubernetes.io/releases/)). AWS's container guide notes that Kubernetes needs DevOps or SRE investment partly because of the roughly three-releases-a-year cadence and positions ECS as the AWS-native alternative without that burden ([Choosing an AWS container service, updated 16 May 2025](https://docs.aws.amazon.com/decision-guides/latest/containers-on-aws-how-to-choose/choosing-aws-container-service.html)).

### EKS version lifecycle and the dates that matter now

**[FAST-MOVING, Nov 2026] [PLATFORM CLAIM]** Amazon EKS gives each Kubernetes version 14 months of standard support and then 12 months of extended support (26 months in total). Extended support is on by default and billed per cluster-hour; opting out means an automatic upgrade at the end of standard support. At the end of extended support EKS upgrades the control plane automatically, without notification or exact timing, and the upgrade cannot be rolled back; only the control plane is upgraded (Auto Mode nodes may follow; managed and self-managed nodes stay behind) ([EKS Kubernetes version lifecycle](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html)).

| EKS version | Status as listed Nov 2026 | Key date | Source |
|---|---|---|---|
| 1.31 | Extended support | Extended support ends 26 Nov 2026 | [EKS version lifecycle](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html) |
| 1.32 | Extended support | Extended support ends 23 Mar 2027 | [EKS version lifecycle](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html) |
| 1.33 | Extended support | Extended support ends 29 Jul 2027 | [EKS version lifecycle](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html) |
| 1.34 | Standard support | Standard support ends 2 Dec 2026 | [EKS version lifecycle](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html) |
| 1.35 | Standard support | Standard support ends 27 Mar 2027 | [EKS version lifecycle](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html) |
| 1.36 | Standard support | Standard support ends 2 Aug 2027 | [EKS version lifecycle](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html) |
| 1.37 | Standard support | Standard support ends 1 Dec 2027 | [EKS version lifecycle](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html) |

**[INFERENCE] [FAST-MOVING, 11 Nov 2026]** Urgent as of 11 November 2026: any EKS cluster still on 1.31 is force-upgraded after 26 November 2026, and clusters on 1.34 start paying extended-support fees from 2 December 2026 unless upgraded. A worker agent should inventory cluster versions now with `aws eks describe-cluster-versions` ([EKS version lifecycle](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html)). As a cadence, plan one EKS minor upgrade roughly every four months, or two double hops a year, upgrading non-production first and then control plane, add-ons and nodes in that order. Extended-support fees are an avoidable cost if upgrades stay inside the 14-month window. **[GAP]** The current extended-support and Auto Mode prices were not checked.

### EKS data-plane options and who patches nodes

**[PLATFORM CLAIM]** EKS data-plane options from most to least managed are EKS Auto Mode (provisioning, scaling and automatic AMI updates with disruption controls), Fargate (one pod per node), managed node groups (the customer initiates updates) and self-managed nodes (the customer patches). The EKS control plane runs across three Availability Zones. Spread node groups across zones through subnets; with Auto Mode use NodePool disruption controls; with managed node groups roll patched AMIs yourself; and manage self-managed nodes as code ([EKS Best Practices: Reliability](https://docs.aws.amazon.com/eks/latest/best-practices/reliability.html)).

**[INFERENCE] [GAP]** A general-practice Kubernetes baseline, which the EKS page read did not list and which is therefore unsourced: resource requests on every container, readiness and liveness probes, PodDisruptionBudgets, topology spread across three zones, at least two replicas for anything serving traffic, namespace quotas, network policies, image scanning and pinned digests, and no cluster-admin rights for workloads.

### Lambda limits that shape design

**[FAST-MOVING, 2026] [PLATFORM CLAIM]** AWS Lambda's standard limits as documented: timeout 900 seconds (15 minutes); memory 128 MB to 10,240 MB (about one vCPU at 1,769 MB); `/tmp` storage 512 MB to 10,240 MB; default concurrency 1,000 per Region (raisable, and new accounts start lower); scaling rate 1,000 new execution environments per 10 seconds per function. Payloads are 6 MB for synchronous request and response and 1 MB asynchronous; streamed responses reach 200 MB, throttled to 2 MBps after the first 6 MB. Packaging limits are 50 MB zipped and 250 MB unzipped including layers, container images up to 10 GB, 5 layers, 4 KB of environment variables in total, and 1,024 file descriptors and 1,024 processes or threads. Control-plane API limits are low and not raisable, for example 15 requests per second combined for most management APIs ([Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)).

**[FAST-MOVING, 2026] [PLATFORM CLAIM]** The Lambda quotas page now lists newer modes: Managed Instances (asynchronous and event-source timeout up to 90 minutes, 4,096 file descriptors), Durable Functions (up to 30,000 operations, 100 MB of persisted data per execution and 1 MB per-operation payload), MicroVMs (8-hour maximum per MicroVM) and Web Functions (64 concurrent requests per environment by default and a 30-second default request timeout) ([Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)). **[GAP]** Pricing and Regional availability of these modes, including in eu-north-1, were not checked.

**[INFERENCE]** Lambda pitfalls that follow from the quotas: the regional concurrency pool is shared, so one runaway function can throttle all others (set reserved concurrency for critical functions); a downstream database can be overwhelmed by the scaling rate (use queues, RDS Proxy or concurrency caps); the 6 MB payload limit means large files go through S3; the 15-minute limit pushes long work to Step Functions, Durable Functions, Fargate or the longer-running modes; and low control-plane rate limits make mass deployments or one-function-per-tenant designs slow.

### Managed compute shares fate with the Region

**[FAST-MOVING, Oct 2025] [PLATFORM CLAIM]** In the AWS us-east-1 event of 19 to 20 October 2025, ECS, EKS and Fargate task and pod launches were impaired until about 2:20 PM PDT on 20 October because EC2 launches were failing, and Lambda saw invocation errors, delayed SQS and Kinesis event-source processing and under-scaling ([AWS post-event summary](https://aws.amazon.com/message/101925)). Serverless and managed containers are not immune to regional events.

### Gaps in this section

**[GAP]** Not sourced: EKS best-practice sub-pages (probes, PodDisruptionBudgets, Karpenter, upgrades, networking, security), Lambda cold-start figures, SnapStart coverage, Lambda pricing changes, API Gateway, ALB and Step Functions limits, EventBridge and SQS failure-handling patterns, ECS-specific practice (deployment circuit breaker, Service Connect), container security baselines, service-mesh guidance and CNCF survey methodology.
