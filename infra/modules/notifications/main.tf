# iPhone push notifications (docs/NOTIFICATIONS.md): the owner's Apple key as a secret, the SNS platform
# applications for APNs once that key is in, and the rights the api (device registration, the key) and
# notifier (one push per finished job) functions need. No email anywhere: the owner asked for one notification
# per finished job, on the phone, and nothing else.
#
# Until the owner pastes the key in Settings and turns `apns_enabled` on (GitHub variable VAIC_APNS_ENABLED),
# the secret exists empty, no platform application is created, and every deploy still applies.

variable "name" { type = string }
variable "region" { type = string }
variable "account_id" { type = string }
variable "kms_key_arn" { type = string }
variable "apns_enabled" {
  type        = bool
  default     = false
  description = "Create the APNs platform applications from the key in vaic/prod/apns (the owner pastes it first)."
}
variable "api_role_name" { type = string }
variable "notifier_role_name" { type = string }

locals {
  tags        = { Component = "notifications" }
  secret_name = "vaic/prod/apns"
  # Deterministic names, so the api and notifier functions can be given their ARNs before the applications exist.
  app_names = { APNS = "${var.name}-apns", APNS_SANDBOX = "${var.name}-apns-sandbox" }
  app_arns  = { for k, n in local.app_names : k => "arn:aws:sns:${var.region}:${var.account_id}:app/${k}/${n}" }
  endpoints = [for k, n in local.app_names : "arn:aws:sns:${var.region}:${var.account_id}:endpoint/${k}/${n}/*"]
  key       = var.apns_enabled ? jsondecode(data.aws_secretsmanager_secret_version.apns[0].secret_string) : null
}

resource "aws_secretsmanager_secret" "apns" {
  #checkov:skip=CKV2_AWS_57:The Apple APNs key is issued and rotated in Apple Developer; there is no rotation Lambda to run.
  name                    = local.secret_name
  description             = "Apple APNs token key for AI City's iPhone notifications, as {key_id, team_id, bundle_id, p8}; pasted by the owner in Settings"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 7
  tags                    = local.tags
}

data "aws_secretsmanager_secret_version" "apns" {
  count     = var.apns_enabled ? 1 : 0
  secret_id = aws_secretsmanager_secret.apns.id
}

# APNS for App Store / TestFlight builds, APNS_SANDBOX for debug builds from Xcode: Apple routes them to
# different gateways, and one token key serves both.
resource "aws_sns_platform_application" "apns" {
  for_each                 = var.apns_enabled ? local.app_names : {}
  name                     = each.value
  platform                 = each.key
  platform_credential      = local.key.p8     # the .p8 private key
  platform_principal       = local.key.key_id # the signing key id
  apple_platform_team_id   = local.key.team_id
  apple_platform_bundle_id = local.key.bundle_id
}

# The api function registers phones (an endpoint per token) and stores the owner's pasted key.
resource "aws_iam_policy" "api" {
  name = "${var.name}-api-notifications"
  tags = local.tags
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "RegisterPhones", Effect = "Allow", Action = ["sns:CreatePlatformEndpoint"], Resource = values(local.app_arns) },
      { Sid = "ManagePhones", Effect = "Allow", Action = ["sns:SetEndpointAttributes", "sns:GetEndpointAttributes", "sns:DeleteEndpoint"], Resource = local.endpoints },
      { Sid = "StoreAppleKey", Effect = "Allow", Action = ["secretsmanager:PutSecretValue", "secretsmanager:DescribeSecret"], Resource = [aws_secretsmanager_secret.apns.arn] },
      { Sid = "EncryptAppleKey", Effect = "Allow", Action = ["kms:Encrypt", "kms:GenerateDataKey"], Resource = [var.kms_key_arn] },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api" {
  role       = var.api_role_name
  policy_arn = aws_iam_policy.api.arn
}

# The notifier sends to endpoints and forgets the ones APNs disabled. Nothing else: no topic, no email.
resource "aws_iam_policy" "notifier" {
  name = "${var.name}-notifier-push"
  tags = local.tags
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "Push", Effect = "Allow", Action = ["sns:Publish"], Resource = local.endpoints },
      { Sid = "ForgetGonePhones", Effect = "Allow", Action = ["sns:DeleteEndpoint"], Resource = local.endpoints },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "notifier" {
  role       = var.notifier_role_name
  policy_arn = aws_iam_policy.notifier.arn
}

output "secret_name" { value = local.secret_name }
output "secret_arn" { value = aws_secretsmanager_secret.apns.arn }
output "apns_arn" { value = var.apns_enabled ? local.app_arns["APNS"] : "" }
output "apns_sandbox_arn" { value = var.apns_enabled ? local.app_arns["APNS_SANDBOX"] : "" }
