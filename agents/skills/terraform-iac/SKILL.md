---
name: terraform-iac
description: "Write and change infrastructure as code with Terraform: current provider versions, modules, plan before apply, no secrets in state."
---
# Terraform infrastructure as code

## Always
- Look up the **current** Terraform and provider versions with the **Context7** connector (`hashicorp/terraform`, `hashicorp/aws` provider docs) or the Terraform Registry before writing code. Pin them: `required_version` and `required_providers` with `~>` on the minor version.
- Remote state with locking (S3 backend with `use_lockfile = true`, or the owner's existing backend). Never commit `.tfstate`, `.terraform/` or `*.tfvars` holding secrets.
- Small modules with typed `variable`s (with `description` and `validation`), `output`s, and default tags in the provider block.
- `terraform fmt -recursive`, `terraform validate`, then `terraform plan -out=plan.tfplan`; read the plan, call out anything replaced or destroyed. `apply` only the saved plan, and only when the goal says so.
- No secrets in code or state: reference Secrets Manager or SSM by name; mark sensitive outputs `sensitive = true`.
- Prefer `for_each` over `count`; `moved` blocks instead of destroy-and-recreate when renaming.
- Lint with `tflint` and scan with `checkov` or `trivy config` when available; fix or justify every finding.

## Deliverable
The branch with the code, the plan's summary (adds, changes, destroys) and the checks run.
