# Skills (docs/CONNECTORS_SKILLS.md §2.2, §2.5): owner-uploaded SKILL.md folders under skills/<name>/<version>/.
# Only the api Lambda writes them; every runtime role may read objects (GetObject, no ListBucket) and nothing more.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
  }
}

variable "name" { type = string }
variable "kms_key_arn" { type = string }
variable "agent_role_names" { type = map(string) }
variable "api_role_name" { type = string }

locals {
  tags = { Component = "skills" }
}

resource "aws_s3_bucket" "skills" {
  #checkov:skip=CKV_AWS_144:The owner keeps the originals; a replica of a few small files is not worth it.
  #checkov:skip=CKV_AWS_18:Access logging would need another bucket; CloudTrail data events can be enabled if needed.
  #checkov:skip=CKV2_AWS_62:No event notifications are needed.
  bucket = "${var.name}-skills"
  tags   = local.tags
}

resource "aws_s3_bucket_versioning" "skills" {
  bucket = aws_s3_bucket.skills.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "skills" {
  bucket = aws_s3_bucket.skills.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "skills" {
  bucket                  = aws_s3_bucket.skills.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "skills" {
  bucket = aws_s3_bucket.skills.id
  rule {
    id     = "old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 2
    }
  }
}

resource "aws_s3_bucket_policy" "skills" {
  bucket = aws_s3_bucket.skills.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "TlsOnly"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.skills.arn, "${aws_s3_bucket.skills.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

# Runtimes read skill files; the ledger read of pk = "SKILLS" is already in their ledger permissions.
resource "aws_iam_role_policy" "runtime_read" {
  for_each = var.agent_role_names
  name     = "skills-read"
  role     = each.value
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Sid = "ReadSkillFiles", Effect = "Allow", Action = ["s3:GetObject"], Resource = ["${aws_s3_bucket.skills.arn}/skills/*"] }]
  })
}

resource "aws_iam_role_policy" "api" {
  name = "skills"
  role = var.api_role_name
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Sid = "OwnerSkillFiles", Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = ["${aws_s3_bucket.skills.arn}/skills/*"] }]
  })
}

output "bucket" { value = aws_s3_bucket.skills.bucket }
