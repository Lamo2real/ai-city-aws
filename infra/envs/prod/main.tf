# AI City, single environment: prod. Applied by the owner (or deploy.yml after the owner approves).
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws     = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
    archive = { source = "hashicorp/archive", version = ">= 2.7.0, < 3.0.0" }
  }
  # Filled in at init time: terraform init -backend-config=backend.hcl (see backend.hcl.example).
  backend "s3" {}
}

locals {
  name = "aic-prod"
  base_tags = {
    Project     = "ai-city"
    App         = "aic"
    Environment = "prod"
    Owner       = var.owner_email
    ManagedBy   = "terraform"
    CostCenter  = "ai-city"
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = local.base_tags
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = local.base_tags
  }
}

data "aws_caller_identity" "me" {}

module "security" {
  source     = "../../modules/security"
  name       = local.name
  region     = var.region
  account_id = data.aws_caller_identity.me.account_id
}

module "storage" {
  source      = "../../modules/storage"
  name        = local.name
  kms_key_arn = module.security.kms_key_arn
}

module "ledger" {
  source              = "../../modules/ledger"
  name                = local.name
  kms_key_arn         = module.security.kms_key_arn
  deletion_protection = var.deletion_protection
}

module "bus" {
  source               = "../../modules/bus"
  name                 = local.name
  kms_key_arn          = module.security.kms_key_arn
  owner_email          = var.owner_email
  turn_timeout_seconds = var.turn_timeout_minutes * 60
}

module "frontend" {
  source    = "../../modules/frontend"
  providers = { aws = aws, aws.us_east_1 = aws.us_east_1 }
  name      = local.name
  region    = var.region
  apps_url  = module.apps.url
}

# Apps the city builds, on their own origin (docs/APPS.md). It reuses the HUD's WAF web ACL; the HUD's
# CSP names this origin, never the other way round (no cycle).
module "apps" {
  source      = "../../modules/apps"
  name        = local.name
  waf_acl_arn = module.frontend.waf_acl_arn
}

module "auth" {
  source              = "../../modules/auth"
  name                = local.name
  region              = var.region
  owner_email         = var.owner_email
  app_url             = module.frontend.url
  boundary_arn        = module.security.boundary_arn
  deletion_protection = var.deletion_protection
}

module "agents" {
  source                             = "../../modules/agents"
  name                               = local.name
  region                             = var.region
  account_id                         = data.aws_caller_identity.me.account_id
  kms_key_arn                        = module.security.kms_key_arn
  boundary_arn                       = module.security.boundary_arn
  image_tag                          = var.agent_image_tag
  profile_prefix                     = var.profile_prefix
  use_application_inference_profiles = var.use_application_inference_profiles
  ledger_arn                         = module.ledger.ledger_arn
  ledger_table                       = module.ledger.ledger_table
  bus_arn                            = module.bus.bus_arn
  bus_name                           = module.bus.bus_name
  queue_arns                         = module.bus.queue_arns
  queue_urls                         = module.bus.queue_urls
  # The Factory's name is fixed, so the agents module need not wait for the api module (no cycle).
  factory_function_name = "${local.name}-factory"
  factory_function_arn  = "arn:aws:lambda:${var.region}:${data.aws_caller_identity.me.account_id}:function:${local.name}-factory"
  workspaces_bucket     = module.storage.workspaces_bucket
  workspaces_arn        = module.storage.workspaces_arn
  github_secret_arn     = module.storage.secret_arns["github"]
  enable_gateway        = var.enable_gateway
  apps_url              = module.apps.url
}

module "api" {
  source                = "../../modules/api"
  name                  = local.name
  region                = var.region
  account_id            = data.aws_caller_identity.me.account_id
  kms_key_arn           = module.security.kms_key_arn
  boundary_arn          = module.security.boundary_arn
  lambda_dist           = "${path.root}/../../../backend/dist/lambda"
  ledger_table          = module.ledger.ledger_table
  ledger_arn            = module.ledger.ledger_arn
  connections_table     = module.ledger.connections_table
  connections_arn       = module.ledger.connections_arn
  bus_name              = module.bus.bus_name
  bus_arn               = module.bus.bus_arn
  queue_urls            = module.bus.queue_urls
  queue_arns            = module.bus.queue_arns
  notify_topic_arn      = module.bus.notify_topic_arn
  user_pool_id          = module.auth.user_pool_id
  user_pool_arn         = module.auth.user_pool_arn
  owner_email           = var.owner_email
  user_pool_endpoint    = module.auth.user_pool_endpoint
  client_id             = module.auth.client_id
  app_origin            = module.frontend.url
  runtime_arns          = module.agents.runtime_arns
  runtime_version       = var.agent_image_tag
  ace_role_name         = module.agents.role_names["ace"]
  utility_invoke_arns   = module.agents.utility_invoke_arns
  utility_profile_arn   = module.agents.utility_profile_arn
  profile_prefix        = var.profile_prefix
  log_retention_days    = var.log_retention_days
  workspaces_bucket     = module.storage.workspaces_bucket
  workspaces_arn        = module.storage.workspaces_arn
  apps_bucket           = module.apps.bucket
  apps_bucket_arn       = module.apps.bucket_arn
  apps_url              = module.apps.url
  apps_distribution_id  = module.apps.distribution_id
  apps_distribution_arn = module.apps.distribution_arn
}

module "budgets" {
  source             = "../../modules/budgets"
  name               = local.name
  owner_email        = var.owner_email
  monthly_budget_usd = var.monthly_budget_usd
}

module "observability" {
  source           = "../../modules/observability"
  name             = local.name
  region           = var.region
  dlq_names        = merge(module.bus.dlq_names, { apps = module.api.apps_dlq_name })
  queue_names      = [for k in ["ace", "orchestrator", "manager", "worker"] : "${local.name}-${k}"]
  function_names   = module.api.function_names
  notify_topic_arn = module.bus.notify_topic_arn
}

# The HUD's runtime settings: public values only (endpoints and IDs), read by the browser.
resource "aws_s3_object" "config" {
  bucket        = module.frontend.bucket
  key           = "config.json"
  content_type  = "application/json"
  cache_control = "no-store"
  content = jsonencode({
    region               = var.region
    apiUrl               = module.api.http_api_url
    wsUrl                = module.api.ws_url
    cognitoDomain        = module.auth.domain
    clientId             = module.auth.client_id
    userPoolId           = module.auth.user_pool_id
    identityPoolId       = module.auth.identity_pool_id
    redirectUri          = "${module.frontend.url}/"
    pollyVoice           = var.polly_voice
    transcribeVocabulary = module.auth.vocabulary_name
    appsUrl              = module.apps.url
  })
  tags = { Component = "frontend" }
}
