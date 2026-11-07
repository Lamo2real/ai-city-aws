# Mail and calendar accounts (docs/MAIL_CALENDAR.md §8): the workload identity whose token vault holds one user per
# account (ma-<8 hex>), the Google and Microsoft OAuth2 providers (each behind a flag, client secret EXTERNAL in
# Secrets Manager, pasted by the owner), the empty secret containers, and the IAM of the read path. Workers get
# none of it (check-iam.mjs).
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
  }
}

variable "name" { type = string }
variable "region" { type = string }
variable "account_id" { type = string }
variable "kms_key_arn" { type = string }
variable "hud_origin" { type = string }
variable "default_tags" { type = map(string) }
variable "providers_config" {
  type = object({
    google    = object({ enabled = bool, client_id = string })
    microsoft = object({ enabled = bool, client_id = string, tenant_id = string })
  })
}
variable "api_role_name" { type = string }
variable "reader_role_names" {
  type        = map(string)
  description = "Runtime roles on the mail read path: ace, orchestrator, manager (the runtime enforces mail_access). Never the worker."
  validation {
    condition     = !contains(keys(var.reader_role_names), "worker") && alltrue([for n in values(var.reader_role_names) : !endswith(n, "-agent-worker")])
    error_message = "The worker role gets no mail access (docs/MAIL_CALENDAR.md §8)."
  }
}

locals {
  tags     = { Component = "mail" }
  workload = "${var.name}-mail"
  arn      = "arn:aws:bedrock-agentcore:${var.region}:${var.account_id}"
  sm       = "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret"
  vendors  = { google = "GoogleOauth2", microsoft = "MicrosoftOauth2" }
  enabled  = [for k in ["google", "microsoft"] : k if var.providers_config[k].enabled]
  # Fixed names, so IAM needs no provider to exist.
  vault          = "${local.arn}:token-vault/default"
  directory      = "${local.arn}:workload-identity-directory/default"
  workload_arn   = "${local.directory}/workload-identity/${local.workload}"
  provider_arns  = [for k in keys(local.vendors) : "${local.vault}/oauth2credentialprovider/${var.name}-${k}"]
  client_secrets = [for k in keys(local.vendors) : "${local.sm}:aic/prod/oauth-${k}-*"]
  app_passwords  = "${local.sm}:aic/prod/mail/*"
  account_users  = { StringLike = { "bedrock-agentcore:userid" = "ma-*" } }
  read_path = [
    { Sid = "VaultUserPerAccount", Effect = "Allow", Action = ["bedrock-agentcore:GetWorkloadAccessTokenForUserId"], Resource = [local.directory, local.workload_arn], Condition = local.account_users },
    { Sid = "AccountTokens", Effect = "Allow", Action = ["bedrock-agentcore:GetResourceOauth2Token"], Resource = concat([local.vault, local.directory, local.workload_arn], local.provider_arns) },
    # AgentCore checks that the caller of GetResourceOauth2Token may read the provider's client secret.
    { Sid = "ClientSecretsAndAppPasswords", Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = concat([local.app_passwords], local.client_secrets) },
    { Sid = "UseTheDataKey", Effect = "Allow", Action = ["kms:Decrypt"], Resource = var.kms_key_arn },
  ]
}

resource "aws_bedrockagentcore_workload_identity" "mail" {
  name                                = local.workload
  allowed_resource_oauth2_return_urls = ["${var.hud_origin}/?connect=return"]
  tags                                = local.tags
}

# Empty containers: the owner pastes {"client_secret": "…"} once (docs/RUNBOOK.md). Terraform never writes a value.
resource "aws_secretsmanager_secret" "client" {
  #checkov:skip=CKV2_AWS_57:OAuth client secrets are issued and rotated in Google Cloud and Microsoft Entra; there is no rotation Lambda to run.
  for_each                = local.vendors
  name                    = "aic/prod/oauth-${each.key}"
  description             = "${title(each.key)} OAuth client secret for mail and calendar, as {\"client_secret\": \"...\"}"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 7
  tags                    = local.tags
}

resource "aws_bedrockagentcore_oauth2_credential_provider" "provider" {
  for_each                   = toset(local.enabled)
  name                       = "${var.name}-${each.key}"
  credential_provider_vendor = local.vendors[each.key]
  oauth2_provider_config {
    dynamic "google_oauth2_provider_config" {
      for_each = each.key == "google" ? [1] : []
      content {
        client_id            = var.providers_config.google.client_id
        client_secret_source = "EXTERNAL"
        client_secret_config {
          secret_id = aws_secretsmanager_secret.client["google"].arn
          json_key  = "client_secret"
        }
      }
    }
    dynamic "microsoft_oauth2_provider_config" {
      for_each = each.key == "microsoft" ? [1] : []
      content {
        client_id            = var.providers_config.microsoft.client_id
        tenant_id            = var.providers_config.microsoft.tenant_id
        client_secret_source = "EXTERNAL"
        client_secret_config {
          secret_id = aws_secretsmanager_secret.client["microsoft"].arn
          json_key  = "client_secret"
        }
      }
    }
  }
  tags = local.tags
}

# ---------- IAM ----------
resource "aws_iam_role_policy" "reader" {
  for_each = var.reader_role_names
  name     = "mail-read-path"
  role     = each.value
  policy   = jsonencode({ Version = "2012-10-17", Statement = local.read_path })
}

# The api Lambda: the read path, plus finishing a sign-in and storing IMAP app passwords from the HUD's form.
resource "aws_iam_role_policy" "api" {
  name = "mail"
  role = var.api_role_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(local.read_path, [
      { Sid = "CompleteSignIn", Effect = "Allow", Action = ["bedrock-agentcore:CompleteResourceTokenAuth"], Resource = concat([local.vault, local.directory, local.workload_arn], local.provider_arns), Condition = local.account_users },
      {
        Sid       = "CreateAppPasswordsTagged"
        Effect    = "Allow"
        Action    = ["secretsmanager:CreateSecret", "secretsmanager:TagResource"]
        Resource  = [local.app_passwords]
        Condition = { StringEquals = { "aws:RequestTag/Project" = var.default_tags["Project"], "aws:RequestTag/Component" = "mail" }, "ForAllValues:StringEquals" = { "aws:TagKeys" = keys(merge(var.default_tags, local.tags)) } }
      },
      { Sid = "ManageAppPasswords", Effect = "Allow", Action = ["secretsmanager:PutSecretValue", "secretsmanager:DeleteSecret"], Resource = [local.app_passwords] },
      { Sid = "EncryptAppPasswords", Effect = "Allow", Action = ["kms:Encrypt", "kms:GenerateDataKey"], Resource = var.kms_key_arn },
    ])
  })
}

output "workload_name" { value = aws_bedrockagentcore_workload_identity.mail.name }
output "providers" { value = join(",", local.enabled) }
# The redirect URI to register in Google Cloud and Microsoft Entra (printed by deploy.yml).
output "callback_urls" { value = { for k, p in aws_bedrockagentcore_oauth2_credential_provider.provider : k => p.callback_url } }
output "runtime_tags" { value = merge(var.default_tags, local.tags) }
