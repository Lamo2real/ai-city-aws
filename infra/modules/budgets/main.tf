# The backstop: a monthly cost budget on the WHOLE account (Claude on Bedrock is billed partly
# through AWS Marketplace, so a Bedrock-only filter would miss it), alerts at 50/80/100 % and a
# forecast alert, and a budget action at 100 % that attaches a deny-Bedrock policy to the four
# agent roles. Budget actions reset each budget period; Budgets data lags by several hours.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
  }
}

variable "name" { type = string }
variable "account_id" { type = string }
variable "owner_email" { type = string }
variable "monthly_budget_usd" { type = number }
variable "agent_role_names" { type = list(string) }
variable "boundary_arn" { type = string }
variable "kms_key_arn" { type = string }
variable "budget_function_arn" { type = string }

locals {
  tags = { Component = "budgets" }
}

resource "aws_sns_topic" "budget" {
  name              = "${var.name}-budget-alerts"
  kms_master_key_id = var.kms_key_arn
  tags              = local.tags
}

resource "aws_sns_topic_policy" "budget" {
  arn = aws_sns_topic.budget.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "BudgetsPublish"
      Effect    = "Allow"
      Principal = { Service = "budgets.amazonaws.com" }
      Action    = "SNS:Publish"
      Resource  = aws_sns_topic.budget.arn
      Condition = { StringEquals = { "aws:SourceAccount" = var.account_id } }
    }]
  })
}

resource "aws_sns_topic_subscription" "budget_lambda" {
  topic_arn = aws_sns_topic.budget.arn
  protocol  = "lambda"
  endpoint  = var.budget_function_arn
}

resource "aws_lambda_permission" "budget" {
  statement_id  = "budget-alerts"
  action        = "lambda:InvokeFunction"
  function_name = var.budget_function_arn
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.budget.arn
}

resource "aws_budgets_budget" "monthly" {
  name         = "${var.name}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  # No cost filters: the whole account.

  dynamic "notification" {
    for_each = [50, 80, 100]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.owner_email]
      subscriber_sns_topic_arns  = [aws_sns_topic.budget.arn]
    }
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.owner_email]
  }
  tags = local.tags
}

resource "aws_iam_policy" "deny_bedrock" {
  name        = "${var.name}-deny-bedrock"
  description = "Attached by the budget action at 100%: no model calls until the owner detaches it."
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Sid = "BudgetExhausted", Effect = "Deny", Action = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream", "bedrock:Converse", "bedrock:ConverseStream"], Resource = "*" }]
  })
  tags = local.tags
}

resource "aws_iam_role" "budget_action" {
  name                 = "${var.name}-budget-action"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "budgets.amazonaws.com" }, Action = "sts:AssumeRole", Condition = { StringEquals = { "aws:SourceAccount" = var.account_id } } }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "budget_action" {
  name = "attach-deny-bedrock"
  role = aws_iam_role.budget_action.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = ["iam:AttachRolePolicy", "iam:DetachRolePolicy"]
      Resource  = [for r in var.agent_role_names : "arn:aws:iam::${var.account_id}:role/${r}"]
      Condition = { ArnEquals = { "iam:PolicyARN" = aws_iam_policy.deny_bedrock.arn } }
    }]
  })
}

resource "aws_budgets_budget_action" "deny_bedrock" {
  budget_name        = aws_budgets_budget.monthly.name
  action_type        = "APPLY_IAM_POLICY"
  approval_model     = "AUTOMATIC"
  notification_type  = "ACTUAL"
  execution_role_arn = aws_iam_role.budget_action.arn
  action_threshold {
    action_threshold_type  = "PERCENTAGE"
    action_threshold_value = 100
  }
  definition {
    iam_action_definition {
      policy_arn = aws_iam_policy.deny_bedrock.arn
      roles      = var.agent_role_names
    }
  }
  subscriber {
    address           = var.owner_email
    subscription_type = "EMAIL"
  }
  tags = local.tags
}

output "budget_name" { value = aws_budgets_budget.monthly.name }
output "deny_policy_arn" { value = aws_iam_policy.deny_bedrock.arn }
