variable "region" {
  type        = string
  default     = "eu-north-1"
  description = "One region for everything (WAF for CloudFront is always us-east-1)."
}

variable "owner_email" {
  type        = string
  description = "The owner's email: Cognito user, alerts, and the Owner cost-allocation tag."
  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.owner_email))
    error_message = "owner_email must be an email address."
  }
}

variable "monthly_budget_usd" {
  type        = number
  default     = 150
  description = "AWS Budgets backstop for the whole account. Starting value; heavy Fable/Opus use needs more."
  validation {
    condition     = var.monthly_budget_usd > 0 && var.monthly_budget_usd <= 10000
    error_message = "monthly_budget_usd must be between 1 and 10000."
  }
}

variable "agent_image_tag" {
  type        = string
  description = "Tag of the agent runtime image in ECR (pushed by deploy.yml before the runtimes are applied)."
}

variable "profile_prefix" {
  type        = string
  default     = "global"
  description = "Inference profile prefix: global (cheapest, may leave the EU) or eu (Fable roles fall back to Opus 5.5)."
  validation {
    condition     = contains(["global", "eu", "us"], var.profile_prefix)
    error_message = "profile_prefix must be global, eu or us."
  }
}

variable "use_application_inference_profiles" {
  type        = bool
  default     = true
  description = "One tagged application inference profile per role. Set false if AWS refuses to copy a global profile."
}

variable "turn_timeout_minutes" {
  type    = number
  default = 15
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "deletion_protection" {
  type        = bool
  default     = true
  description = "Deletion protection on Cognito and DynamoDB. Set false (and apply) before terraform destroy."
}

variable "enable_gateway" {
  type        = bool
  default     = false
  description = "AgentCore Gateway for external tools (built, off)."
}

variable "polly_voice" {
  type    = string
  default = "Matthew"
}
