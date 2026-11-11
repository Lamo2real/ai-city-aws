---
id: infrastructure.aws.cloud-architecture
department: infrastructure
domain: aws
title: 'IT infrastructure: AWS cloud architecture'
summary: Well-Architected, multi-account organisation, service control policies, Control Tower, global-service dependencies, networking, compute and database choice, OpenSearch and Neptune operating rules, EU Regions, data residency and the European Sovereign Cloud.
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
- security
- cost
sources:
- https://docs.aws.amazon.com/wellarchitected/latest/framework/document-revisions.html
- https://www.infoq.com/news/2025/12/aws-expands-well-architected
- https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/recommended-ous-and-accounts.html
- https://docs.aws.amazon.com/whitepapers/latest/building-scalable-secure-multi-vpc-network-infrastructure/welcome.html
- https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html
- https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/global-services.html
- https://docs.aws.amazon.com/controltower/latest/userguide/best-practices.html
- https://docs.aws.amazon.com/decision-guides/latest/containers-on-aws-how-to-choose/choosing-aws-container-service.html
- https://docs.aws.amazon.com/decision-guides/latest/databases-on-aws-how-to-choose/databases-on-aws-how-to-choose.html
- https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html
- https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp.html
- https://docs.aws.amazon.com/neptune/latest/userguide/best-practices-general-basic.html
- https://docs.aws.amazon.com/aws-backup/latest/devguide/logicallyairgappedvault.html
- https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html
- https://press.aboutamazon.com/aws/2026/1/aws-launches-aws-european-sovereign-cloud-and-announces-expansion-across-europe
- https://aws.eu/faq/
- https://www.infoq.com/news/2026/01/aws-european-sovereign-cloud
related:
- infrastructure.reliability.backup-and-disaster-recovery
- infrastructure.iac.infrastructure-as-code
cross_refs:
  '5':
  - infrastructure.compute.kubernetes-containers-serverless
seed_version: 1
---

**When to use this:** Before designing or changing anything on AWS: accounts, SCPs, Control Tower, us-east-1 dependencies, networking, compute, databases, OpenSearch, Neptune, EU Regions and the European Sovereign Cloud.

**Source section:** 2. AWS cloud architecture

## 2. AWS cloud architecture

### Well-Architected Framework: six pillars, AI lenses added

**[DURABLE] [PLATFORM CLAIM]** The AWS Well-Architected Framework has six pillars: operational excellence, security, reliability, performance efficiency, cost optimization and sustainability. Use it as the review checklist for every workload design ([AWS Well-Architected document revisions](https://docs.aws.amazon.com/wellarchitected/latest/framework/document-revisions.html)).

**[FAST-MOVING, Nov 2024 to Dec 2025]** The framework's revision log shows major updates on 27 June 2024 (new best practices in Security and Cost Optimization) and 6 November 2024 (large Reliability refresh, refinements to Security and Operational Excellence, Sustainability additions); no 2025 or 2026 core revision was visible when checked ([AWS Well-Architected document revisions](https://docs.aws.amazon.com/wellarchitected/latest/framework/document-revisions.html)). Trade press dated 19 December 2025 reports that AWS added a Responsible AI Lens with ten dimensions and updated the Machine Learning Lens (six lifecycle stages) and the Generative AI Lens (agentic workflows, scalable inference, secure data handling) at re:Invent 2025 ([InfoQ, Dec 2025](https://www.infoq.com/news/2025/12/aws-expands-well-architected)). **[GAP]** Whether a core-framework revision was published after November 2024 was not confirmed.

### Multi-account structure: organisational units AWS recommends

**[DURABLE] [PLATFORM CLAIM]** AWS's recommended organisational units are Security and Infrastructure as the foundation, Workloads split into production and non-production, Sandbox, the procedural units Exceptions, Transitional, Suspended and Policy Staging, and the advanced units Individual Business Users, Deployments and Business Continuity. AWS says an organisation does not need all of them at once and can expand over time ([Organizing Your AWS Environment: recommended OUs](https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/recommended-ous-and-accounts.html)). AWS Control Tower's baseline creates a Security OU with Log Archive and Audit accounts plus a Sandbox OU, and further OUs are registered afterwards ([AWS multi-VPC network whitepaper, 17 Apr 2024](https://docs.aws.amazon.com/whitepapers/latest/building-scalable-secure-multi-vpc-network-infrastructure/welcome.html)).

**[INFERENCE]** A minimum starting organisation for a small SaaS company is a management account with no workloads, a Security OU (log archive, audit and security tooling), an Infrastructure OU (network, shared services), a Workloads OU split into production and non-production, a Sandbox OU and a Suspended OU. Add Deployments and Policy Staging when pipeline count and policy volume justify them. This is the researchers' reduction of the AWS list, not an AWS statement.

### Service control policies: what they do and how to roll them out

**[DURABLE] [PLATFORM CLAIM]** Service control policies (SCPs) set the maximum permissions for IAM users and roles in member accounts and grant nothing themselves; the effective permission is the intersection of SCPs, resource control policies, identity policies and resource policies. SCPs do not apply to the management account or to service-linked roles, but they do apply to member-account root users and delegated-administrator accounts, and they require the organisation's "all features" mode ([AWS Organizations SCP documentation](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)).

**[DURABLE] [PLATFORM CLAIM]** AWS's SCP rollout rules are: never attach an untested SCP to the organisation root; create a test OU and move accounts in one at a time or in small numbers; use IAM last-accessed data and CloudTrail to see which services are actually used; and do not remove the FullAWSAccess policy without an allow-list replacement ([AWS Organizations SCP documentation](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)).

**[INFERENCE]** A region-restriction SCP for EU-only operation must exempt the global services whose control planes sit in us-east-1 or us-west-2 (IAM, Organizations, Route 53, CloudFront, Global Accelerator, billing tools), or it will break them. This follows from the control-plane locations in the AWS fault-isolation whitepaper ([AWS Fault Isolation Boundaries: global services](https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/global-services.html)) and is not stated by AWS in that form.

### Control Tower: how controls are enforced

**[PLATFORM CLAIM]** AWS Control Tower enforces preventive controls through service control policies, resource control policies or declarative policies, and detective controls through AWS Config rules. AWS advises restricting the Control Tower console to management-account administrators, telling member-account teams which preventive controls apply to their OU, and using IAM access advisor, the policy simulator and CloudTrail (member activity lands in the shared log-archive account) to scope access ([AWS Control Tower best practices](https://docs.aws.amazon.com/controltower/latest/userguide/best-practices.html)). **[GAP]** Landing-zone version, Region deny, drift handling, Account Factory for Terraform and data-residency controls were not verified.

### Global-service dependencies: keep us-east-1 off the recovery path

**[DURABLE] [PLATFORM CLAIM]** AWS Organizations and the IAM control plane are hosted in us-east-1, so organisation and IAM changes must not be a step in any recovery plan. The control planes of Route 53, CloudFront, WAF for CloudFront, ACM for CloudFront and Shield Advanced are also in us-east-1, and those of Global Accelerator and Application Recovery Controller (ARC) are in us-west-2; their data planes (name servers, edge locations, routing controls) keep working during a control-plane impairment. The practical rule is to pre-create health checks, distributions, web ACLs and certificates before they are needed ([AWS Fault Isolation Boundaries: global services](https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/global-services.html)).

**[DURABLE] [PLATFORM CLAIM]** Creating DNS records for ELB, RDS, DocumentDB, Neptune, Redshift, ElastiCache, MemoryDB and other services depends on Route 53 in us-east-1, and edge-optimised API Gateway endpoints depend on the CloudFront control plane, so regional API endpoints are preferred for recovery-critical APIs. Use regional STS endpoints (credentials issued regionally are valid in all Regions) and Region-specific console URLs ([AWS Fault Isolation Boundaries: global services](https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/global-services.html)).

**[DURABLE] [PLATFORM CLAIM]** S3 bucket-configuration APIs (replication, policy, versioning, public access block) and CreateBucket and DeleteBucket depend on us-east-1. Configure cross-Region replication before an incident, do not make recovery depend on creating a bucket with a specific name, and use Multi-Region Access Point failover controls, which avoid a control-plane dependency ([AWS Fault Isolation Boundaries: global services](https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/global-services.html)).

**[INFERENCE]** Because Cost Explorer, the Cost and Usage Report and Data Exports are us-east-1-only services, cost dashboards are not a dependable tool during a us-east-1 event; do not put them on an incident path. This is the researchers' reading of the fault-isolation whitepaper.

### Networking: plan addresses once, centralise the shared parts

**[DURABLE] [PLATFORM CLAIM]** AWS's IP-planning guidance is to plan addressing up front; assign hierarchical, summarisable CIDR ranges by environment, Region or business unit; keep on-premises and cloud ranges non-overlapping, with an approval process for any intentional overlap; size for future Regions and acquisitions; consider IPv6 or dual-stack; and use VPC IPAM to allocate and track addresses across accounts and Regions. The same whitepaper covers Transit Gateway, PrivateLink, Direct Connect, Gateway Load Balancer, Network Firewall and Route 53, organised as connectivity, centralised egress and endpoints, and DNS including hybrid DNS ([AWS multi-VPC network whitepaper, 17 Apr 2024](https://docs.aws.amazon.com/whitepapers/latest/building-scalable-secure-multi-vpc-network-infrastructure/welcome.html)).

**[GAP]** No source was read comparing Transit Gateway, Cloud WAN, VPC Lattice, VPC peering and PrivateLink, or covering Route 53 Resolver and Profiles patterns, centralised egress design or CloudFront practice. Agents must not present a topology recommendation as sourced from this document.

### Compute choice: pick by operating model and team capacity

**[FAST-MOVING, 16 May 2025] [PLATFORM CLAIM]** AWS's container decision guide (last updated 16 May 2025) says to decide on operating model (serverless or managed, Kubernetes, or self-managed), operational overhead versus control, team skills, workload shape, scale, portability and location. Its heuristic: with little infrastructure experience choose App Runner, Lambda, Lightsail or Batch; for AWS-native orchestration at scale choose ECS on Fargate or EC2; choose EKS when Kubernetes is needed and there is SRE capacity for upgrades; for on-premises or hybrid choose ECS Anywhere, EKS Anywhere or EKS Hybrid Nodes ([Choosing an AWS container service](https://docs.aws.amazon.com/decision-guides/latest/containers-on-aws-how-to-choose/choosing-aws-container-service.html)).

**[INFERENCE]** ECS on Fargate is the lower-toil default for a small team without Kubernetes-specific needs; choose EKS when ecosystem tooling (operators, GitOps controllers, GPU scheduling for AI) or portability justifies the upgrade burden. This combines the AWS decision guide with the EKS lifecycle facts in section 5.

### Database choice: purpose-built engines, mixed estates are normal

**[FAST-MOVING, 2 Jun 2026] [PLATFORM CLAIM]** AWS's database decision guide (updated 2 June 2026) maps needs to engines as in the table below, says most applications end up with a mix of purpose-built databases, and for vector search favours the engine the team already knows ([Databases on AWS: how to choose](https://docs.aws.amazon.com/decision-guides/latest/databases-on-aws-how-to-choose/databases-on-aws-how-to-choose.html)).

| Need | AWS's suggested engine (guide updated 2 Jun 2026) | Source |
|---|---|---|
| Relational workloads, less predictable query patterns | Aurora | [AWS database guide](https://docs.aws.amazon.com/decision-guides/latest/databases-on-aws-how-to-choose/databases-on-aws-how-to-choose.html) |
| Active-active multi-Region distributed SQL with strong consistency | Aurora DSQL | [AWS database guide](https://docs.aws.amazon.com/decision-guides/latest/databases-on-aws-how-to-choose/databases-on-aws-how-to-choose.html) |
| Writes or storage beyond a single instance | Aurora PostgreSQL Limitless | [AWS database guide](https://docs.aws.amazon.com/decision-guides/latest/databases-on-aws-how-to-choose/databases-on-aws-how-to-choose.html) |
| Managed commercial and open-source engines, including SQL Server, Oracle, Db2 | RDS | [AWS database guide](https://docs.aws.amazon.com/decision-guides/latest/databases-on-aws-how-to-choose/databases-on-aws-how-to-choose.html) |
| Key-value at single-digit-millisecond latency | DynamoDB | [AWS database guide](https://docs.aws.amazon.com/decision-guides/latest/databases-on-aws-how-to-choose/databases-on-aws-how-to-choose.html) |
| Highly connected data (fraud, recommendations, social graphs) | Neptune | [AWS database guide](https://docs.aws.amazon.com/decision-guides/latest/databases-on-aws-how-to-choose/databases-on-aws-how-to-choose.html) |
| Search, vector and RAG retrieval, log analytics (not transaction processing) | OpenSearch, managed or serverless | [AWS database guide](https://docs.aws.amazon.com/decision-guides/latest/databases-on-aws-how-to-choose/databases-on-aws-how-to-choose.html) |
| Caching | ElastiCache | [AWS database guide](https://docs.aws.amazon.com/decision-guides/latest/databases-on-aws-how-to-choose/databases-on-aws-how-to-choose.html) |
| In-memory store as the durable primary | MemoryDB | [AWS database guide](https://docs.aws.amazon.com/decision-guides/latest/databases-on-aws-how-to-choose/databases-on-aws-how-to-choose.html) |
| MongoDB-compatible documents; Cassandra; time series | DocumentDB; Keyspaces; Timestream | [AWS database guide](https://docs.aws.amazon.com/decision-guides/latest/databases-on-aws-how-to-choose/databases-on-aws-how-to-choose.html) |

**[PLATFORM CLAIM]** AWS's cross-Region data options are S3 replication, RDS read replicas, Aurora global database (AWS states secondary promotion in under a minute and replication lag typically under a second), DynamoDB global tables, DocumentDB global clusters and ElastiCache Global Datastore ([AWS disaster recovery whitepaper](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)).

### Amazon OpenSearch Service: sizing and operating rules (the vector index)

**[PLATFORM CLAIM]** For Amazon OpenSearch Service, AWS says to use three dedicated master nodes across three Availability Zones and to deploy Multi-AZ with Standby (two active zones, one standby, two replicas per index). Shard sizing is 10 to 30 GiB per shard for search workloads and 30 to 50 GiB for logs, with 50 GiB as the maximum; keep at most 25 shards per GiB of Java heap; start from about 1.5 vCPU per shard (no more than six shards on an 8-vCPU node); and make shard count a multiple of data-node count. The hard limit is 1,000 shards per node on Elasticsearch and OpenSearch 1.1 to 2.15 and 4,000 per node on OpenSearch 2.17 and later ([OpenSearch Service operational best practices](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp.html)).

**[PLATFORM CLAIM]** AWS says not to use T2 or t3.small instances for production OpenSearch domains, names r6g.large as the smallest suggested production size, and recommends current-generation instances and gp3 volumes, which it states are 9.6% cheaper than gp2. UltraWarm storage pays off at roughly 2.5 TiB of hot data to move. Check for service software updates on a schedule and apply them deliberately, because an eligible update left unapplied for a window (typically two weeks) is applied by the service itself; upgrade versions on a development domain first; enable Auto-Tune ([OpenSearch Service operational best practices](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp.html)).

**[PLATFORM CLAIM]** OpenSearch security settings AWS recommends are fine-grained access control on, the domain inside a VPC, a restrictive resource policy with no wildcard principal, and encryption at rest and node to node. Use Index State Management to snapshot and delete old indexes and configure the recommended CloudWatch alarms ([OpenSearch Service operational best practices](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp.html)). **[GAP]** The recommended-alarms page, with JVM-pressure and CPU percentages, was not read.

**[INFERENCE]** An OpenSearch capacity check a worker agent can run on a schedule: shard size inside the band for the workload, shards per node under 25 times heap GiB, three dedicated masters present, Multi-AZ with Standby on, and software-update status not left "eligible" for more than a week. The one-week figure is the researchers' margin inside AWS's two-week window.

### Amazon Neptune: operating rules (the graph database)

**[PLATFORM CLAIM]** For Amazon Neptune, AWS says read replicas should be at least as large as the writer, and ideally all instances the same size, so a failover does not land on a smaller machine; AWS puts failover downtime at about 3 to 5 seconds, the time to repoint the writer's address. Keep clients in the same Region and VPC for single-digit-millisecond responses. Data models with more than about a thousand distinct predicates cost performance, and the bulk loader's OVERSUBSCRIBE parallelism setting uses all available CPU, where loading generally needs 60 to 70% of CPU ([Neptune basic operational guidelines](https://docs.aws.amazon.com/neptune/latest/userguide/best-practices-general-basic.html)).

**[INFERENCE]** Create Neptune clusters encrypted from the start. AWS documents that unencrypted Aurora, DocumentDB and Neptune clusters cannot be copied to a logically air-gapped backup vault ([AWS Backup logically air-gapped vault](https://docs.aws.amazon.com/aws-backup/latest/devguide/logicallyairgappedvault.html)); that encryption cannot be added in place afterwards is the researchers' statement and was not read on the page. **[GAP]** Neptune sizing by buffer-cache metrics, backup retention, engine upgrades and Neptune Serverless limits were not read.

### EU Regions and data residency

**[PLATFORM CLAIM]** In AWS's standard partition the European Regions enabled by default are Frankfurt (eu-central-1), Ireland (eu-west-1), London (eu-west-2), Paris (eu-west-3) and Stockholm (eu-north-1); Milan (eu-south-1), Spain (eu-south-2) and Zurich (eu-central-2) are opt-in. All are listed with three Availability Zones ([AWS Regions list](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html)).

**[INFERENCE]** For a Sweden-based SaaS company selling in the EU, the default is eu-north-1 as primary with an EU secondary for backups and recovery (Frankfurt, Ireland or Paris). London and Zurich are in AWS's European list but are not in EU member states, so exclude them where a contract says data stays in the EU. This is the researchers' reading of the Region list and is not an AWS statement or legal advice. **[GAP]** Service availability in eu-north-1 for specific newer services and instance types was not checked.

### AWS European Sovereign Cloud: a second landing zone, not another Region

**[FAST-MOVING, 15 Jan 2026] [PLATFORM CLAIM]** AWS states that the AWS European Sovereign Cloud became generally available on 15 January 2026 with a first Region in Brandenburg, Germany, with more than 90 services at launch, operation only by EU residents, a parent company plus three German subsidiaries, an advisory board of EU citizens and residents, a design intended to keep running if cut off from the rest of the world, investment of more than EUR 7.8 billion in Germany, and sovereign Local Zones planned for Belgium, the Netherlands and Portugal with no dates. AWS itself says most customers can meet their requirements with the existing EU Regions ([Amazon press release, 15 Jan 2026](https://press.aboutamazon.com/aws/2026/1/aws-launches-aws-european-sovereign-cloud-and-announces-expansion-across-europe)).

**[FAST-MOVING, Jan 2026] [PLATFORM CLAIM]** Existing AWS accounts cannot be used in the European Sovereign Cloud: a new account is required, accounts are not interoperable with other Regions, Marketplace needs a separate account, billing is in EUR, the contracting party is AWS EMEA SARL in Luxembourg, and assurance rests on third-party audits against AWS's own Sovereign Reference Framework, with the audit described as underway ([aws.eu FAQ](https://aws.eu/faq/)). Trade press reports the partition name aws-eusc and Region code eusc-de-east-1, dedicated IAM and billing systems, and its own Route 53 name servers on European top-level domains ([InfoQ, Jan 2026](https://www.infoq.com/news/2026/01/aws-european-sovereign-cloud)).

**[CONTESTED]** Whether the European Sovereign Cloud removes exposure to US law is disputed. AWS presents the structure as sovereign by design ([Amazon press release, 15 Jan 2026](https://press.aboutamazon.com/aws/2026/1/aws-launches-aws-european-sovereign-cloud-and-announces-expansion-across-europe)); critics quoted in trade press argue a US-headquartered parent stays exposed to the CLOUD Act and FISA whatever the subsidiary structure, and an AWS engineer said fixes require coordination with staff inside the partition, which slows debugging ([InfoQ, Jan 2026](https://www.infoq.com/news/2026/01/aws-european-sovereign-cloud)). This is a legal question for counsel; the research did not check it against any legal source.

**[INFERENCE]** Treat the European Sovereign Cloud as a second landing zone (separate partition, accounts, IAM, billing and a smaller service set) and offer it only when a customer or regulator requires it; expect duplicated pipelines and feature gaps. **[GAP]** Its current service list, price premium, certifications obtained, Local Zone dates and supported cross-partition connectivity were not verified.

### Gaps in this section

**[GAP]** Not sourced for AWS architecture: network topology comparison, DNS resolver patterns, centralised egress, CloudFront and edge practice, S3 storage-class and lifecycle patterns, S3 data-protection patterns, ECS Managed Instances and Express Mode, App Runner's current status, SCP size and attachment quotas, and Landing Zone Accelerator status.
