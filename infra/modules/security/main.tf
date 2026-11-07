# One customer-managed KMS key for the city's data (DynamoDB, S3, SQS, SNS, Secrets Manager,
# CloudWatch Logs), and the permission boundary every role Terraform creates carries.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
  }
}

variable "name" { type = string }
variable "region" { type = string }
variable "account_id" { type = string }

locals {
  tags = { Component = "security" }
}

resource "aws_kms_key" "data" {
  description             = "${var.name} data"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AccountAdmin"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${var.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "ServicesUseTheKey"
        Effect    = "Allow"
        Principal = { Service = ["logs.${var.region}.amazonaws.com", "events.amazonaws.com", "sns.amazonaws.com", "sqs.amazonaws.com", "budgets.amazonaws.com", "cloudwatch.amazonaws.com", "states.amazonaws.com", "scheduler.amazonaws.com", "bedrock-agentcore.amazonaws.com"] }
        Action    = ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:DescribeKey"]
        Resource  = "*"
        Condition = { StringEquals = { "aws:SourceAccount" = var.account_id } }
      },
    ]
  })
  tags = local.tags
}

resource "aws_kms_alias" "data" {
  name          = "alias/${var.name}-data"
  target_key_id = aws_kms_key.data.key_id
}

# The boundary: the most any city role can ever do. It never allows IAM changes, Organizations,
# account or billing changes.
resource "aws_iam_policy" "boundary" {
  #checkov:skip=CKV_AWS_288:A permission boundary is a ceiling, not a grant; each role's own policy scopes resources.
  #checkov:skip=CKV_AWS_290:A permission boundary is a ceiling, not a grant; each role's own policy scopes resources.
  #checkov:skip=CKV_AWS_287:A permission boundary is a ceiling, not a grant; each role names its own secrets (check-iam.mjs).
  #checkov:skip=CKV_AWS_289:A permission boundary is a ceiling, not a grant; it allows no IAM writes at all.
  #checkov:skip=CKV_AWS_355:A permission boundary is a ceiling, not a grant; each role's own policy scopes resources.
  name        = "${var.name}-boundary"
  description = "Permission boundary for every AI City role"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CityServices"
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream", "bedrock:GetInferenceProfile", "bedrock:ListInferenceProfiles",
          "bedrock-agentcore:*", "dynamodb:*", "sqs:*", "events:PutEvents", "s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket",
          "logs:*", "xray:*", "cloudwatch:PutMetricData", "kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey*", "kms:DescribeKey",
          "secretsmanager:GetSecretValue", "secretsmanager:CreateSecret", "secretsmanager:PutSecretValue", "secretsmanager:DeleteSecret", "secretsmanager:TagResource", "sns:Publish", "states:*", "lambda:InvokeFunction", "execute-api:ManageConnections",
          "ecr:GetAuthorizationToken", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "sts:AssumeRole", "sts:TagSession",
          "transcribe:StartStreamTranscription", "transcribe:StartStreamTranscriptionWebSocket", "polly:SynthesizeSpeech",
        ]
        Resource = "*"
      },
      {
        Sid      = "NeverTheseServices"
        Effect   = "Deny"
        Action   = ["organizations:*", "account:*", "aws-portal:*", "budgets:Modify*", "budgets:Delete*", "ce:Update*", "iam:Create*", "iam:Delete*", "iam:Put*", "iam:Update*", "iam:PassRole", "iam:Tag*", "iam:Untag*"]
        Resource = "*"
      },
    ]
  })
  tags = local.tags
}

output "kms_key_arn" { value = aws_kms_key.data.arn }
output "boundary_arn" { value = aws_iam_policy.boundary.arn }
