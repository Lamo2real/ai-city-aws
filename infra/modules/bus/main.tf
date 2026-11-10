# The Question & Instruction Bus (EventBridge custom bus), one SQS queue per role level with a
# dead-letter queue each, and the owner's notification topic.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
  }
}

variable "name" { type = string }
variable "kms_key_arn" { type = string }
variable "turn_timeout_seconds" {
  type    = number
  default = 900
}

locals {
  tags   = { Component = "bus" }
  queues = toset(["vaic", "orchestrator", "manager", "worker"])
}

resource "aws_cloudwatch_event_bus" "this" {
  name               = var.name
  kms_key_identifier = var.kms_key_arn
  tags               = local.tags
}

resource "aws_sqs_queue" "dlq" {
  for_each                  = local.queues
  name                      = "${var.name}-${each.key}-dlq"
  message_retention_seconds = 1209600
  kms_master_key_id         = var.kms_key_arn
  tags                      = local.tags
}

resource "aws_sqs_queue" "work" {
  for_each                   = local.queues
  name                       = "${var.name}-${each.key}"
  visibility_timeout_seconds = var.turn_timeout_seconds + 60 # the turn limit plus a minute
  message_retention_seconds  = 345600
  kms_master_key_id          = var.kms_key_arn
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[each.key].arn
    maxReceiveCount     = 3
  })
  tags = local.tags
}

# Alarm actions only (observability). No subscription: the owner gets no email from the city; finished jobs
# reach the owner's iPhone through modules/notifications instead.
resource "aws_sns_topic" "notify" {
  name              = "${var.name}-notify"
  kms_master_key_id = var.kms_key_arn
  tags              = local.tags
}

output "bus_name" { value = aws_cloudwatch_event_bus.this.name }
output "bus_arn" { value = aws_cloudwatch_event_bus.this.arn }
output "queue_urls" { value = { for k, q in aws_sqs_queue.work : k => q.url } }
output "queue_arns" { value = { for k, q in aws_sqs_queue.work : k => q.arn } }
output "dlq_names" { value = { for k, q in aws_sqs_queue.dlq : k => q.name } }
output "notify_topic_arn" { value = aws_sns_topic.notify.arn }
