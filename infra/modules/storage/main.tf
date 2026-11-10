# Workers' workspaces (per-hire prefixes, lifecycle-expired), and the empty secret containers the
# owner fills in the console. Terraform never writes a secret value.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
  }
}

variable "name" { type = string }
variable "kms_key_arn" { type = string }
variable "workspace_days" {
  type    = number
  default = 30
}

locals {
  tags = { Component = "storage" }
  # The GitHub token moved to infra/modules/github (decision 110): the owner pastes it in Settings → GitHub.
  secrets = { google = "Google Calendar/Gmail OAuth (integration off)", spotify = "Spotify OAuth (integration off)" }
}

resource "aws_s3_bucket" "workspaces" {
  #checkov:skip=CKV_AWS_144:Workspaces are scratch space, expired after 30 days; replication is not worth it.
  #checkov:skip=CKV_AWS_18:Access logging would need another bucket; CloudTrail data events can be enabled if needed.
  #checkov:skip=CKV2_AWS_62:No event notifications are needed.
  bucket        = "${var.name}-workspaces"
  force_destroy = true # the AIC → VAIC rename (docs/RENAME_PLAN.md); back to false afterwards
  tags          = local.tags
}

resource "aws_s3_bucket_versioning" "workspaces" {
  bucket = aws_s3_bucket.workspaces.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "workspaces" {
  bucket = aws_s3_bucket.workspaces.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "workspaces" {
  bucket                  = aws_s3_bucket.workspaces.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "workspaces" {
  bucket = aws_s3_bucket.workspaces.id
  rule {
    id     = "expire-hires"
    status = "Enabled"
    filter {
      prefix = "hires/"
    }
    expiration {
      days = var.workspace_days
    }
    noncurrent_version_expiration {
      noncurrent_days = 7
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 2
    }
  }
  rule {
    id     = "abort-uploads-everywhere"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 2
    }
  }
}

resource "aws_s3_bucket_policy" "workspaces" {
  bucket = aws_s3_bucket.workspaces.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "TlsOnly"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.workspaces.arn, "${aws_s3_bucket.workspaces.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

resource "aws_secretsmanager_secret" "this" {
  #checkov:skip=CKV2_AWS_57:These hold OAuth tokens the owner issues and rotates in the provider's console; there is no rotation Lambda to run.
  for_each                = local.secrets
  name                    = "aic/prod/${each.key}"
  description             = each.value
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 7
  tags                    = local.tags
}

output "workspaces_bucket" { value = aws_s3_bucket.workspaces.bucket }
output "workspaces_arn" { value = aws_s3_bucket.workspaces.arn }
output "secret_arns" { value = { for k, s in aws_secretsmanager_secret.this : k => s.arn } }
