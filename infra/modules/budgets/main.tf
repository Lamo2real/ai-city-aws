# Spend visibility only, by the owner's choice: AI City has no spend limit. A monthly cost budget on the
# WHOLE account (Claude on Bedrock is billed partly through AWS Marketplace, so a Bedrock-only filter would
# miss it) emails the owner at 50/80/100 % of the amount and on a forecast above it. Nothing is blocked
# and the city is never paused by it. Budgets data lags by several hours.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
  }
}

variable "name" { type = string }
variable "owner_email" { type = string }
variable "monthly_budget_usd" {
  type        = number
  description = "Alert amount only (emails), not a limit."
}

locals {
  tags = { Component = "budgets" }
}

resource "aws_budgets_budget" "monthly" {
  name         = "${var.name}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  # No cost filters: the whole account. No budget action: alerts only.

  dynamic "notification" {
    for_each = [50, 80, 100]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.owner_email]
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

output "budget_name" { value = aws_budgets_budget.monthly.name }
