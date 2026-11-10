# VAIC's voice through OpenAI text-to-speech (docs/VOICE.md, decision 96): the owner's OpenAI API key as a secret
# the api function may read (to call the speech API) and write (the owner pastes it in Settings → Voice).
# Created empty by Terraform; every deploy applies without it, and /speech answers 503 until it is filled.
# A voice service only: the agents stay on Anthropic models through Bedrock.

variable "name" { type = string }
variable "kms_key_arn" { type = string }
variable "api_role_name" { type = string }

locals {
  tags        = { Component = "voice" }
  secret_name = "vaic/prod/openai"
}

resource "aws_secretsmanager_secret" "openai" {
  #checkov:skip=CKV2_AWS_57:The owner issues and rotates the key in the OpenAI dashboard; there is no rotation Lambda to run.
  name                    = local.secret_name
  description             = "OpenAI API key for VAIC's spoken replies (text-to-speech only); pasted by the owner in Settings → Voice"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 7
  tags                    = local.tags
}

# The api function reads the key to call OpenAI and stores the one the owner pastes. Nothing else may read it.
resource "aws_iam_policy" "api" {
  name = "${var.name}-api-voice"
  tags = local.tags
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "ReadAndStoreOpenAIKey", Effect = "Allow", Action = ["secretsmanager:GetSecretValue", "secretsmanager:PutSecretValue", "secretsmanager:DescribeSecret"], Resource = [aws_secretsmanager_secret.openai.arn] },
      { Sid = "OpenAIKeyCrypto", Effect = "Allow", Action = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"], Resource = [var.kms_key_arn] },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api" {
  role       = var.api_role_name
  policy_arn = aws_iam_policy.api.arn
}

output "secret_name" { value = local.secret_name }
output "secret_arn" { value = aws_secretsmanager_secret.openai.arn }
