# One CloudWatch dashboard (turns, latency, queue depth, live workers, tokens by model, cache reads,
# throttles, refusals, spend today) and alarms that email the owner when work lands in a DLQ.
# AgentCore Observability and X-Ray tracing are on in the runtimes and Lambdas themselves.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
  }
}

variable "name" { type = string }
variable "region" { type = string }
variable "dlq_names" { type = map(string) }
variable "queue_names" { type = list(string) }
variable "function_names" { type = map(string) }
variable "notify_topic_arn" { type = string }

locals {
  tags   = { Component = "observability" }
  aic    = "AIC"
  models = ["sonnet-5-5", "fable-5-1", "opus-5-5", "haiku-5-5"]
  roles  = ["ace", "orchestrator", "manager", "worker", "utility"]
}

resource "aws_cloudwatch_dashboard" "city" {
  dashboard_name = var.name
  dashboard_body = jsonencode({
    widgets = [
      { type = "text", x = 0, y = 0, width = 24, height = 1, properties = { markdown = "## AI City — all money figures are estimates; the AWS bill is the truth" } },
      { type = "metric", x = 0, y = 1, width = 8, height = 6, properties = { title = "Turns by role", region = var.region, stat = "Sum", period = 300, metrics = [for r in local.roles : [local.aic, "Turns", "Role", r, "Model", r == "worker" ? "opus-5-5" : r == "ace" ? "sonnet-5-5" : r == "utility" ? "haiku-5-5" : "fable-5-1"]] } },
      { type = "metric", x = 8, y = 1, width = 8, height = 6, properties = { title = "Spend today (estimate, USD)", region = var.region, stat = "Sum", period = 86400, metrics = [for r in local.roles : [{ expression = "SEARCH('{AIC,Role,Model} MetricName=\"SpendUsd\" Role=\"${r}\"', 'Sum', 86400)", label = r, id = "s_${r}" }]] } },
      { type = "metric", x = 16, y = 1, width = 8, height = 6, properties = { title = "Queue depth", region = var.region, stat = "Maximum", period = 60, metrics = [for q in var.queue_names : ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", q]] } },
      { type = "metric", x = 0, y = 7, width = 8, height = 6, properties = { title = "Tokens by model (input, output, cache read)", region = var.region, stat = "Sum", period = 300, metrics = [for e in setproduct(local.models, ["InputTokens", "OutputTokens", "CacheReadTokens"]) : [{ expression = "SEARCH('{AIC,Role,Model} MetricName=\"${e[1]}\" Model=\"${e[0]}\"', 'Sum', 300)", label = "${e[0]} ${e[1]}", id = lower("t_${replace(e[0], "-", "_")}_${e[1]}") }]] } },
      { type = "metric", x = 8, y = 7, width = 8, height = 6, properties = { title = "Refusals and fallbacks", region = var.region, stat = "Sum", period = 300, metrics = [[{ expression = "SEARCH('{AIC,Role,Model} MetricName=\"Refusals\"', 'Sum', 300)", id = "refusals", label = "refusals" }], [{ expression = "SEARCH('{AIC,Role,Model} MetricName=\"Fallbacks\"', 'Sum', 300)", id = "fallbacks", label = "fallbacks" }]] } },
      { type = "metric", x = 16, y = 7, width = 8, height = 6, properties = { title = "Dispatcher: duration, errors, throttles", region = var.region, period = 300, metrics = [["AWS/Lambda", "Duration", "FunctionName", var.function_names["dispatcher"], { stat = "p90" }], ["AWS/Lambda", "Errors", "FunctionName", var.function_names["dispatcher"], { stat = "Sum" }], ["AWS/Lambda", "Throttles", "FunctionName", var.function_names["dispatcher"], { stat = "Sum" }]] } },
      { type = "metric", x = 0, y = 13, width = 8, height = 6, properties = { title = "Live AgentCore sessions (workers busy)", region = var.region, stat = "Maximum", period = 60, metrics = [[{ expression = "SEARCH('{bedrock-agentcore} MetricName=\"Sessions\"', 'Maximum', 60)", id = "sessions", label = "sessions" }]] } },
      { type = "metric", x = 8, y = 13, width = 8, height = 6, properties = { title = "API latency (p90)", region = var.region, stat = "p90", period = 300, metrics = [["AWS/Lambda", "Duration", "FunctionName", var.function_names["api"]]] } },
      { type = "metric", x = 16, y = 13, width = 8, height = 6, properties = { title = "Work in dead-letter queues", region = var.region, stat = "Maximum", period = 300, metrics = [for d in values(var.dlq_names) : ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", d]] } },
    ]
  })
}

resource "aws_cloudwatch_metric_alarm" "dlq" {
  for_each            = var.dlq_names
  alarm_name          = "${each.value}-not-empty"
  alarm_description   = "Work for ${each.key} failed three times and is waiting in its dead-letter queue."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = each.value }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.notify_topic_arn]
  tags                = local.tags
}
