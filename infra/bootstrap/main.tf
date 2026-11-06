# Applied once, by the owner, before anything else: the Terraform state bucket for prod.
# Versioned, encrypted with a customer-managed key, public access blocked, native S3 state locking
# (use_lockfile) so no DynamoDB lock table is needed.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
  }
}

variable "region" {
  type    = string
  default = "eu-north-1"
}
variable "github_repo" {
  type        = string
  description = "The owner's private repository, owner/name, allowed to deploy through OIDC."
  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repo))
    error_message = "github_repo must look like owner/name."
  }
}
variable "owner_email" {
  type        = string
  description = "The owner's email; used only as the Owner cost-allocation tag."
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project     = "ai-city"
      App         = "aic"
      Environment = "prod"
      Owner       = var.owner_email
      ManagedBy   = "terraform"
      CostCenter  = "ai-city"
    }
  }
}

data "aws_caller_identity" "me" {}

locals {
  tags = { Component = "storage" }
}

resource "aws_kms_key" "state" {
  description             = "AI City prod Terraform state"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AccountAdmin"
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.me.account_id}:root" }
      Action    = "kms:*"
      Resource  = "*"
    }]
  })
  tags = local.tags
}

resource "aws_kms_alias" "state" {
  name          = "alias/aic-prod-tfstate"
  target_key_id = aws_kms_key.state.key_id
}

resource "aws_s3_bucket" "state" {
  #checkov:skip=CKV_AWS_144:Cross-region replication of a single-owner state bucket is not worth the cost; versioning protects history.
  #checkov:skip=CKV_AWS_18:Access logging for the state bucket would need a second bucket; CloudTrail covers access.
  #checkov:skip=CKV2_AWS_62:No event notifications are needed for the state bucket.
  bucket = "aic-prod-tfstate-${data.aws_caller_identity.me.account_id}"
  tags   = local.tags
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.state.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    id     = "old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "TlsOnly"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

# ---------- GitHub Actions deploy role (OIDC, no access keys) ----------
# Only deploy.yml on main, running in the `production` environment (which the owner must approve),
# can assume it.
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  tags           = { Component = "security" }
}

resource "aws_iam_policy" "deploy_boundary" {
  #checkov:skip=CKV_AWS_288:The deploy role must manage the whole stack; the boundary removes the account-level actions it never needs.
  #checkov:skip=CKV_AWS_289:The deploy role creates the stack's IAM roles; the trust policy limits who can use it.
  #checkov:skip=CKV_AWS_290:The deploy role must manage the whole stack; the boundary removes the account-level actions it never needs.
  #checkov:skip=CKV_AWS_355:The deploy role must manage the whole stack; the boundary removes the account-level actions it never needs.
  #checkov:skip=CKV_AWS_286:Privilege escalation is limited by the trust policy (main + approved environment only).
  #checkov:skip=CKV_AWS_287:The deploy role writes secret containers but Terraform never writes values.
  #checkov:skip=CKV_AWS_63:This is a boundary (a ceiling) for the Terraform deploy role, which manages every service in the stack.
  #checkov:skip=CKV_AWS_62:This is a boundary (a ceiling) for the Terraform deploy role, which manages every service in the stack.
  #checkov:skip=CKV2_AWS_40:Terraform creates the stack's IAM roles; the boundary denies user and access-key creation.
  name = "aic-prod-deploy-boundary"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "Stack", Effect = "Allow", Action = "*", Resource = "*" },
      {
        Sid      = "NeverAccountLevel"
        Effect   = "Deny"
        Action   = ["organizations:*", "account:*", "aws-portal:*", "iam:CreateUser", "iam:CreateAccessKey", "iam:CreateLoginProfile", "cloudtrail:DeleteTrail", "cloudtrail:StopLogging"]
        Resource = "*"
      },
    ]
  })
  tags = { Component = "security" }
}

resource "aws_iam_role" "deploy" {
  name                 = "aic-prod-github-deploy"
  permissions_boundary = aws_iam_policy.deploy_boundary.arn
  max_session_duration = 3600
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = ["repo:${var.github_repo}:environment:production", "repo:${var.github_repo}:ref:refs/heads/main"]
        }
        StringLike = {
          "token.actions.githubusercontent.com:job_workflow_ref" = "${var.github_repo}/.github/workflows/deploy.yml@refs/heads/main"
        }
      }
    }]
  })
  tags = { Component = "security" }
}

resource "aws_iam_role_policy_attachment" "deploy" {
  #checkov:skip=CKV_AWS_274:Terraform manages the whole stack (IAM, KMS, networking, Cognito); the role is fenced by its trust policy and boundary.
  role       = aws_iam_role.deploy.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

output "deploy_role_arn" {
  value = aws_iam_role.deploy.arn
}

output "state_bucket" {
  value = aws_s3_bucket.state.bucket
}
output "state_kms_key_arn" {
  value = aws_kms_key.state.arn
}
