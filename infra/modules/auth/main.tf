# Cognito: one owner, no self-sign-up, MFA required (TOTP), sign-in on the HUD's own screens (SRP), short
# access tokens, rotating refresh tokens, one `owner` group. Plus an identity pool that gives the
# signed-in owner short-lived credentials for Transcribe streaming and Polly only (voice).
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
  }
}

variable "name" { type = string }
variable "region" { type = string }
variable "owner_email" { type = string }
variable "app_url" {
  type        = string
  description = "The HUD's HTTPS origin (the CloudFront URL), for the sign-in redirect."
}
variable "boundary_arn" { type = string }
variable "deletion_protection" {
  type    = bool
  default = true
}

locals {
  tags = { Component = "security" }
}

resource "aws_cognito_user_pool" "this" {
  name                     = "${var.name}-owner"
  deletion_protection      = var.deletion_protection ? "ACTIVE" : "INACTIVE"
  mfa_configuration        = "ON"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  user_pool_tier           = "ESSENTIALS"

  admin_create_user_config {
    allow_admin_create_user_only = true # no self-sign-up
    invite_message_template {
      email_subject = "Welcome to AI City: your first sign-in"
      email_message = "<p>Hi,</p><p>Your AI City account is ready. Sign in once with the temporary password below, then choose your own.</p><p><b>1.</b> Open <a href=\"${var.app_url}/\">${var.app_url}</a></p><p><b>2.</b> Email: <b>{username}</b><br>Temporary password: <b>{####}</b><br>(copy it exactly; it works once and expires in 7 days)</p><p><b>3.</b> Choose your own password. You use it from then on.</p><p><b>4.</b> Connect an authenticator app (Microsoft Authenticator, Google Authenticator or 1Password): scan the QR code AI City shows, then type the 6-digit code.</p><p>Temporary password expired? On the sign-in page choose <i>First time here, or the temporary password expired?</i> to get a new email.</p><p>AI City</p>"
      sms_message   = "AI City: user {username}, temporary password {####}"
    }
  }
  software_token_mfa_configuration {
    enabled = true
  }
  password_policy {
    minimum_length                   = 14
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your AI City password reset code"
    email_message        = "<p>Your AI City password reset code is <b>{####}</b>.</p><p>Type it on the AI City sign-in page and choose a new password. If you did not ask for this, ignore this email; your password stays the same.</p>"
  }
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
  tags = local.tags
}

resource "aws_cognito_user_pool_domain" "this" {
  domain                = "${var.name}-${substr(sha256(var.owner_email), 0, 8)}"
  user_pool_id          = aws_cognito_user_pool.this.id
  managed_login_version = 2
}

resource "aws_cognito_user_pool_client" "hud" {
  name                                 = "${var.name}-hud"
  user_pool_id                         = aws_cognito_user_pool.this.id
  generate_secret                      = false # a browser app: code flow with PKCE
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]
  callback_urls                        = ["${var.app_url}/"]
  logout_urls                          = ["${var.app_url}/"]
  # SRP for the HUD's own sign-in screens. No ALLOW_REFRESH_TOKEN_AUTH: with refresh token rotation on, Cognito
  # refuses it, and Amplify refreshes through GetTokensFromRefreshToken instead.
  explicit_auth_flows           = ["ALLOW_USER_SRP_AUTH"]
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
  access_token_validity         = 15
  id_token_validity             = 15
  refresh_token_validity        = 7
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
  refresh_token_rotation {
    feature                    = "ENABLED"
    retry_grace_period_seconds = 10
  }
}

resource "aws_cognito_managed_login_branding" "hud" {
  user_pool_id                = aws_cognito_user_pool.this.id
  client_id                   = aws_cognito_user_pool_client.hud.id
  use_cognito_provided_values = true
}

resource "aws_cognito_user_group" "owner" {
  name         = "owner"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "The owner. Every API route requires this group."
}

# The owner's account: Cognito emails a temporary password; the owner sets their own on first sign-in.
resource "aws_cognito_user" "owner" {
  user_pool_id             = aws_cognito_user_pool.this.id
  username                 = var.owner_email
  desired_delivery_mediums = ["EMAIL"]
  attributes = {
    email          = var.owner_email
    email_verified = "true"
  }
  lifecycle {
    ignore_changes = [attributes, temporary_password]
  }
}

resource "aws_cognito_user_in_group" "owner" {
  user_pool_id = aws_cognito_user_pool.this.id
  group_name   = aws_cognito_user_group.owner.name
  username     = aws_cognito_user.owner.username
}

# ---------- voice: Transcribe + Polly with short-lived credentials ----------
resource "aws_cognito_identity_pool" "voice" {
  identity_pool_name               = "${var.name}-voice"
  allow_unauthenticated_identities = false
  allow_classic_flow               = false
  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.hud.id
    provider_name           = aws_cognito_user_pool.this.endpoint
    server_side_token_check = true
  }
  tags = local.tags
}

resource "aws_iam_role" "voice" {
  name                 = "${var.name}-voice"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = "cognito-identity.amazonaws.com" }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals             = { "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.voice.id }
        "ForAnyValue:StringLike" = { "cognito-identity.amazonaws.com:amr" = "authenticated" }
      }
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "voice" {
  #checkov:skip=CKV_AWS_355:Transcribe streaming and Polly SynthesizeSpeech have no resource-level ARNs to scope to; the role allows only these two speech actions.
  name = "speech-only"
  role = aws_iam_role.voice.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["transcribe:StartStreamTranscriptionWebSocket", "transcribe:StartStreamTranscription"], Resource = "*" },
      { Effect = "Allow", Action = ["polly:SynthesizeSpeech"], Resource = "*" },
    ]
  })
}

resource "aws_cognito_identity_pool_roles_attachment" "voice" {
  identity_pool_id = aws_cognito_identity_pool.voice.id
  roles            = { authenticated = aws_iam_role.voice.arn }
}

resource "aws_transcribe_vocabulary" "names" {
  vocabulary_name = "${var.name}-names"
  language_code   = "en-US"
  phrases         = ["A.I.C.", "AI-City", "Orchestrator"]
  tags            = local.tags
}

output "user_pool_id" { value = aws_cognito_user_pool.this.id }
output "user_pool_arn" { value = aws_cognito_user_pool.this.arn }
output "user_pool_endpoint" { value = aws_cognito_user_pool.this.endpoint }
output "client_id" { value = aws_cognito_user_pool_client.hud.id }
output "domain" { value = "${aws_cognito_user_pool_domain.this.domain}.auth.${var.region}.amazoncognito.com" }
output "identity_pool_id" { value = aws_cognito_identity_pool.voice.id }
output "vocabulary_name" { value = aws_transcribe_vocabulary.names.vocabulary_name }
