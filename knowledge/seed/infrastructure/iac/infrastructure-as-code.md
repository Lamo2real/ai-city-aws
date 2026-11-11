---
id: infrastructure.iac.infrastructure-as-code
department: infrastructure
domain: iac
title: 'IT infrastructure: Infrastructure as code'
summary: Terraform or OpenTofu pinned, state storage, a baseline IaC checklist for AWS, CDK rules, pipelines separated by change type, configuration staged like code, GitOps and drift.
type: playbook
audience: both
confidence: platform-claim
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- aws
- terraform
objectives:
- delivery
- reliability
sources:
- https://www.infoq.com/news/2026/06/terraform-1-15/
- https://www.infoq.com/news/2026/05/opentofu-release-terraform
- https://developer.hashicorp.com/terraform/language/backend/s3
- https://opentofu.org/docs/language/state/encryption/
- https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html
- https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments
- https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html
- https://www.ncsc.gov.uk/collection/vulnerability-management/guidance/policy-update-by-default
- https://blog.cloudflare.com/5-december-2025-outage/
- https://www.thousandeyes.com/blog/microsoft-azure-front-door-outage-analysis-october-29-2025
- https://www.cncf.io/announcements/2026/01/20/kubernetes-established-as-the-de-facto-operating-system-for-ai-as-production-use-hits-82-in-2025-cncf-annual-cloud-native-survey/
seed_version: 1
---

**When to use this:** Before writing or changing Terraform, OpenTofu or CDK, pipelines, configuration rollouts or drift handling.

**Source section:** 3. Infrastructure as code

## 3. Infrastructure as code

### Pick one of Terraform or OpenTofu and pin it

**[FAST-MOVING, Jun 2026]** Terraform and OpenTofu have diverged enough that a team should standardise on one. Trade press reports Terraform 1.15 was released on 29 April 2026 with dynamic module sources, a deprecated attribute for variables and outputs, a convert function, type constraints on outputs, native Windows ARM64 builds, S3 backend support for credentials from `aws login`, and variable validation in Stacks. The same report says OpenTofu forked in August 2023 after HashiCorp moved to the Business Source Licence, and has since added native state encryption, `for_each` on provider blocks, OCI registry support, S3 state locking without DynamoDB and experimental OpenTelemetry tracing, while Terraform concentrated on ephemeral values, write-only attributes and HCP integration ([InfoQ, June 2026](https://www.infoq.com/news/2026/06/terraform-1-15/)).

**[FAST-MOVING, 14 May 2026]** OpenTofu 1.12.0 (14 May 2026) added a variable-driven `prevent_destroy` (protect production and leave development unprotected with one module), a `destroy = false` meta-argument that drops a resource from state without destroying it, `-json-into=FILE` for machine-readable output alongside human output, and single-pass lock-file checksums; the WinRM provisioner and 32-bit builds are being phased out ([InfoQ, May 2026](https://www.infoq.com/news/2026/05/opentofu-release-terraform)).

**[INFERENCE]** Because features now differ in both directions, modules written to one tool's newer features will not run on the other; pick one tool, pin its version, and record the choice. For a company that only uses Terraform internally, the general reading is that the Business Source Licence restricts offering Terraform as a competing hosted service and not internal use; this was not re-verified on HashiCorp's licence FAQ and is unverified background, not legal advice. **[GAP]** The Terraform version current in November 2026, IBM ownership details, HCP Terraform pricing and registry differences were not confirmed.

### State storage: native locking, versioning, encryption, a separate account

**[FAST-MOVING, 2026] [PLATFORM CLAIM]** For the Terraform S3 backend, set `use_lockfile = true` for S3-native locking (the default is false); DynamoDB-based locking is deprecated and slated for removal in a future minor version, and both can be set together during migration. HashiCorp strongly recommends bucket versioning so state can be recovered after deletion or human error, and server-side encryption, optionally with a KMS key. Least-privilege access is ListBucket on the prefix, Get and Put on the state object, and Get, Put and Delete on the `.tflock` file ([Terraform S3 backend documentation](https://developer.hashicorp.com/terraform/language/backend/s3)).

**[DURABLE] [PLATFORM CLAIM]** HashiCorp's multi-account pattern keeps state in a separate administrative account; each environment account exposes a role that trusts the administrative account; backend access uses the operator's own credentials while resource changes use the assumed role. Avoid hard-coded credentials and credentials passed with `-backend-config`, because they persist in the `.terraform` directory and in plan files ([Terraform S3 backend documentation](https://developer.hashicorp.com/terraform/language/backend/s3)).

**[FAST-MOVING, 2026] [PLATFORM CLAIM]** OpenTofu encrypts state and plan files client-side with AES-GCM, with key providers PBKDF2 (passphrase of at least 16 characters, 600,000 iterations by default), AWS KMS, GCP KMS, OpenBao Transit, Azure Key Vault and an external-command provider; the documentation read was for version 1.13.x. Its operating rules are one KMS key per state file, `enforced = true` so unencrypted state is never written, and a `fallback` block for key rotation and for migrating from plaintext. Losing the key makes state unrecoverable, and encryption does not stop replay of older state or access by whoever runs the tool. The OpenBao provider is documented as compatible with HashiCorp Vault 1.14 but not later BUSL-licensed versions ([OpenTofu state encryption documentation](https://opentofu.org/docs/language/state/encryption/)).

### Baseline IaC checklist for an AWS shop

**[INFERENCE]** A working infrastructure-as-code baseline: one state file per account, environment and stack to keep blast radius small; state in a dedicated account with versioning, encryption, native locking and access logging; plans produced and applied only by CI using short-lived role credentials; provider and module versions pinned with the lock file committed; and modules versioned and promoted from development to staging to production as the same artifact with different variables. This is the researchers' synthesis of the HashiCorp and OpenTofu documentation above. OpenTofu's variable-driven `prevent_destroy` removes a common reason to fork modules per environment; teams on Terraform cannot rely on it.

### AWS CDK: organisation, code and safety rules

**[PLATFORM CLAIM]** AWS's CDK guidance on organisation: a small expert team sets standards; build on a Control Tower landing zone; developers test in their own accounts and CDK Pipelines deploy from a CI/CD account to test and production. On code: one application per repository; shared constructs in their own repository and a private registry; infrastructure and runtime code together; model with constructs and deploy with stacks; configure through properties and not environment variables; unit-test, and avoid network lookups at synthesis so a commit always yields the same template ([AWS CDK best practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)).

**[PLATFORM CLAIM]** AWS's CDK safety rules for stateful resources: never change their logical IDs, because that causes replacement, and assert this in tests; put stateful and stateless resources in separate stacks with termination protection on the stateful stack; set removal policies and log retention explicitly; use generated names instead of hard-coded ones; and commit `cdk.context.json`. On guardrails AWS says not to rely on wrapper constructs for compliance: enforce with SCPs and permission boundaries at organisation level and check templates before deployment with Aspects or CloudFormation Guard. Model every environment in code, keep secrets in Secrets Manager or Parameter Store, and create alarms and dashboards in the same code ([AWS CDK best practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)).

**[INFERENCE]** The CDK rule on stable logical IDs and separate stateful stacks is the infrastructure-as-code form of "never delete and recreate a stateful resource". An agent reviewing a CDK or Terraform diff must stop on any replacement of a database, bucket, search domain or graph cluster and escalate.

### Pipelines: separate by change type, roll back by redeploying

**[DURABLE] [PLATFORM CLAIM]** Amazon describes running separate pipelines for application code, infrastructure, operating-system patching, configuration and feature flags, and operator tools, so that one failing pipeline does not block the others; rollback redeploys the previous immutable, checksum-verified artifact instead of patching forward. The article dates from 2020 ([AWS Builders' Library: Automating safe, hands-off deployments](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)). AWS's disaster-recovery guidance names CloudFormation or CDK, with StackSets for multi-Region, as the way to redeploy infrastructure in a recovery Region, and expects infrastructure to be reproducible from code at every recovery tier ([AWS disaster recovery whitepaper](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)). The UK NCSC also recommends infrastructure as code as a patching method: replace the running image with the updated one ([UK NCSC vulnerability management guidance, reviewed 1 May 2026](https://www.ncsc.gov.uk/collection/vulnerability-management/guidance/policy-update-by-default)).

### Configuration is a change: stage it like code

**[FAST-MOVING, Oct to Dec 2025] [PLATFORM CLAIM]** Configuration pushed globally without a staged rollout caused three of the largest 2025 outages: Cloudflare on 18 November and 5 December and Azure Front Door on 29 October. Cloudflare committed to staged, health-validated rollouts for configuration data and not only code ([Cloudflare 5 Dec 2025 post-mortem](https://blog.cloudflare.com/5-december-2025-outage/); [ThousandEyes on Azure Front Door, 29 Oct 2025](https://www.thousandeyes.com/blog/microsoft-azure-front-door-outage-analysis-october-29-2025)). **[INFERENCE]** Feature flags, WAF rules, DNS plans and policy data deserve the same staged rollout, validation and rollback as code in an internal pipeline.

### GitOps adoption and drift detection

**[FAST-MOVING, 20 Jan 2026]** In the CNCF 2025 annual survey (published 20 January 2026), 58% of the organisations CNCF classes as cloud-native "innovators" use GitOps principles extensively, against 23% of "adopters" ([CNCF announcement, 20 Jan 2026](https://www.cncf.io/announcements/2026/01/20/kubernetes-established-as-the-de-facto-operating-system-for-ai-as-production-use-hits-82-in-2025-cncf-annual-cloud-native-survey/)). **[INFERENCE]** Scheduled plan-only runs that alert on a non-empty plan are the tool-neutral way to detect drift; vendor drift features were not verified.

### Gaps in this section

**[GAP]** Not sourced: CloudFormation drift detection and drift-aware change sets, CloudFormation Hooks and the IaC generator, policy as code (OPA and Rego, Conftest, Sentinel, Checkov, cfn-guard detail, Kyverno), GitOps tooling practice (Argo CD, Flux, OpenGitOps principles), Terragrunt, Atmos, Spacelift and Atlantis patterns, module testing (`terraform test`, Terratest), Terraform Stacks, and the OpenTofu version that first shipped state encryption.
