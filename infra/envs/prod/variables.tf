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
  default     = 10000
  description = "Amount at which AWS Budgets emails the owner (50/80/100 % and forecast). Alerts only: nothing is blocked or paused."
  validation {
    condition     = var.monthly_budget_usd > 0 && var.monthly_budget_usd <= 10000
    error_message = "monthly_budget_usd must be between 1 and 10000."
  }
}

variable "agent_image_tag" {
  type        = string
  description = "Tag of the agent runtime image. terraform apply builds and pushes it (scripts/push-image.sh) before the runtimes."
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

variable "mail_providers" {
  type = object({
    google    = object({ enabled = bool, client_id = string })
    microsoft = object({ enabled = bool, client_id = string, tenant_id = string })
  })
  default = {
    google    = { enabled = false, client_id = "" }
    microsoft = { enabled = false, client_id = "", tenant_id = "common" }
  }
  description = "Google and Microsoft OAuth clients for mail and calendar (client ids are not secret; the client secrets go into aic/prod/oauth-google / aic/prod/oauth-microsoft). IMAP needs no flag."
  validation {
    condition     = alltrue([for p in values(var.mail_providers) : !p.enabled || length(p.client_id) > 0])
    error_message = "An enabled mail provider needs its client_id."
  }
}

variable "polly_voice" {
  description = "The default Polly generative voice for AIC (the owner can pick another per device in Settings)."
  type        = string
  default     = "Matthew"
}

variable "transcribe_region" {
  description = "Where the HUD runs Transcribe streaming and keeps its custom vocabulary. eu-north-1 refused this account (CloudTrail, 2026-11-07), so Frankfurt, like Polly."
  type        = string
  default     = "eu-central-1"
}

variable "polly_region" {
  description = "Where the HUD calls Polly: the generative engine is not offered in eu-north-1, so the nearest region that has it. Transcribe stays in var.region."
  type        = string
  default     = "eu-central-1"
}

variable "apns_enabled" {
  type        = bool
  default     = false
  description = "Create the APNs platform applications for iPhone notifications from the key the owner pasted into aic/prod/apns (GitHub variable AIC_APNS_ENABLED)."
}

variable "queues_enabled" {
  type        = bool
  default     = true
  description = "The owner's switch for the four queue triggers (GitHub variable AIC_QUEUES_ENABLED). false = the city is off."
}
