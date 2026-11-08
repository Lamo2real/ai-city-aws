# The owner's GitHub token (docs/GITHUB_ACCESS.md, decision 110): one classic personal access token for the whole
# city, pasted by the owner in Settings → GitHub. The api function stores it and reports who it belongs to; every
# agent runtime reads it at session start so git and the GitHub CLI work with the owner's account.
# Created empty by Terraform; every deploy applies without it, and GET /github answers "not configured" until it is filled.

variable "name" { type = string }
variable "kms_key_arn" { type = string }
variable "api_role_name" { type = string }
variable "agent_role_names" { type = map(string) }

locals {
  tags        = { Component = "github" }
  secret_name = "aic/prod/github"
}

resource "aws_secretsmanager_secret" "github" {
  #checkov:skip=CKV2_AWS_57:The owner issues and revokes the token on GitHub; there is no rotation Lambda to run.
  name                    = local.secret_name
  description             = "The owner's GitHub token for the city's agents (git push, gh, the GitHub API); pasted by the owner in Settings → GitHub"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 7
  tags                    = local.tags
}

# The api function stores the token the owner pastes, reads it to say who it belongs to, and clears it on Remove.
resource "aws_iam_policy" "api" {
  name = "${var.name}-api-github"
  tags = local.tags
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "ReadAndStoreGitHubToken", Effect = "Allow", Action = ["secretsmanager:GetSecretValue", "secretsmanager:PutSecretValue", "secretsmanager:DescribeSecret"], Resource = [aws_secretsmanager_secret.github.arn] },
      { Sid = "GitHubTokenCrypto", Effect = "Allow", Action = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"], Resource = [var.kms_key_arn] },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api" {
  role       = var.api_role_name
  policy_arn = aws_iam_policy.api.arn
}

# Every agent runtime reads the token at session start (the common policy already lets the roles use the KMS key).
resource "aws_iam_policy" "agents" {
  name = "${var.name}-agents-github"
  tags = local.tags
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "ReadGitHubToken", Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = [aws_secretsmanager_secret.github.arn] },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "agents" {
  for_each   = var.agent_role_names
  role       = each.value
  policy_arn = aws_iam_policy.agents.arn
}

output "secret_name" { value = local.secret_name }
output "secret_arn" { value = aws_secretsmanager_secret.github.arn }
