# AI City, single environment: prod. Applied by the owner (or deploy.yml after the owner approves).
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws        = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
    archive    = { source = "hashicorp/archive", version = ">= 2.7.0, < 3.0.0" }
    opensearch = { source = "opensearch-project/opensearch", version = ">= 2.6.0, < 3.0.0" }
    time       = { source = "hashicorp/time", version = ">= 0.13.0, < 1.0.0" }
  }
  # Filled in at init time: terraform init -backend-config=backend.hcl (see backend.hcl.example).
  backend "s3" {}
}

locals {
  name  = "aic-prod"
  roles = ["ace", "orchestrator", "manager", "worker"]
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

# Transcribe streaming and its custom vocabulary run here (CloudTrail showed Transcribe streaming refusing this
# account in eu-north-1: "Your account isn't authorized to call this operation"). The identity pool stays in var.region.
provider "aws" {
  alias  = "speech"
  region = var.transcribe_region
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

# The role behind the deploy session (OpenSearch data-access policies name roles, not sessions).
data "aws_iam_session_context" "me" {
  arn = data.aws_caller_identity.me.arn
}

# Creates the knowledge index inside the OpenSearch Serverless collection (no hashicorp/aws resource exists for
# an index; decision 67). Signs with the deploy role's credentials (SigV4, service aoss).
provider "opensearch" {
  url                   = module.knowledge.collection_endpoint
  aws_region            = var.region
  sign_aws_requests     = true
  aws_signature_service = "aoss"
  healthcheck           = false
  opensearch_version    = "2.17" # skips the version ping, which OpenSearch Serverless doesn't answer
}

provider "time" {}

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
  turn_timeout_seconds = var.turn_timeout_minutes * 60
}

module "frontend" {
  source            = "../../modules/frontend"
  providers         = { aws = aws, aws.us_east_1 = aws.us_east_1 }
  name              = local.name
  region            = var.region
  polly_region      = var.polly_region
  transcribe_region = var.transcribe_region
  apps_url          = module.apps.url
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
  providers           = { aws = aws, aws.speech = aws.speech }
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
  # Connectors, skills and mail are read at turn start, so new ones work without a redeploy.
  runtime_env = {
    for r in local.roles : r => merge(
      { AIC_GATEWAY_URL = module.connectors.gateway_url, AIC_SKILLS_BUCKET = module.skills.bucket },
      r == "worker" ? {} : { AIC_MAIL_WORKLOAD = module.mail.workload_name, AIC_MAIL_PROVIDERS = module.mail.providers, AIC_HUD_ORIGIN = module.frontend.url },
    )
  }
  # The knowledge base: every runtime searches it; AIC (ace) may add to it.
  knowledge_table          = module.knowledge.table
  knowledge_table_arn      = module.knowledge.table_arn
  knowledge_bucket         = module.knowledge.bucket
  knowledge_bucket_arn     = module.knowledge.bucket_arn
  knowledge_base_id        = module.knowledge.knowledge_base_id
  knowledge_base_arn       = module.knowledge.knowledge_base_arn
  knowledge_data_source_id = module.knowledge.data_source_id
  knowledge_graph_id       = module.knowledge.graph_id
  knowledge_graph_arn      = module.knowledge.graph_arn
  apps_url                 = module.apps.url
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
  apns_enabled          = var.apns_enabled
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
  # The knowledge routes (docs/KNOWLEDGE.md section 5).
  knowledge_table          = module.knowledge.table
  knowledge_table_arn      = module.knowledge.table_arn
  knowledge_bucket         = module.knowledge.bucket
  knowledge_bucket_arn     = module.knowledge.bucket_arn
  knowledge_base_id        = module.knowledge.knowledge_base_id
  knowledge_base_arn       = module.knowledge.knowledge_base_arn
  knowledge_data_source_id = module.knowledge.data_source_id
  knowledge_graph_id       = module.knowledge.graph_id
  knowledge_graph_arn      = module.knowledge.graph_arn
  api_env = {
    AIC_CONNECTORS_FUNCTION = "${local.name}-connectors"
    AIC_CONNECTORS_WORKLOAD = "${local.name}-connectors"
    AIC_HUD_ORIGIN          = module.frontend.url
    AIC_KMS_KEY_ARN         = module.security.kms_key_arn
    AIC_DEFAULT_TAGS        = jsonencode(local.base_tags) # the code adds Component (connectors or mail)
    AIC_SKILLS_BUCKET       = "${local.name}-skills"
    AIC_MAIL_WORKLOAD       = "${local.name}-mail"
    AIC_MAIL_PROVIDERS      = join(",", [for k, p in var.mail_providers : k if p.enabled])
  }
  # Apps' granted connector reads run in the app-bridge Lambda, through the connectors Gateway (docs/APPS.md v2).
  app_bridge_env = { AIC_GATEWAY_URL = module.connectors.gateway_url }
}

# The owner's knowledge base (docs/KNOWLEDGE.md): bucket, S3 Vectors + Bedrock Knowledge Base, graph table,
# the knowledge Lambda and the ingest workflow.
module "knowledge" {
  source              = "../../modules/knowledge"
  providers           = { aws = aws, opensearch = opensearch, time = time }
  name                = local.name
  region              = var.region
  account_id          = data.aws_caller_identity.me.account_id
  kms_key_arn         = module.security.kms_key_arn
  boundary_arn        = module.security.boundary_arn
  app_origin          = module.frontend.url
  lambda_zip_path     = module.api.lambda_zip_path
  lambda_zip_hash     = module.api.lambda_zip_hash
  ledger_table        = module.ledger.ledger_table
  ledger_arn          = module.ledger.ledger_arn
  bus_name            = module.bus.bus_name
  bus_arn             = module.bus.bus_arn
  utility_invoke_arns = module.agents.utility_invoke_arns
  utility_profile_arn = module.agents.utility_profile_arn
  profile_prefix      = var.profile_prefix
  deletion_protection = var.deletion_protection
  log_retention_days  = var.log_retention_days
  deployer_arn        = data.aws_iam_session_context.me.issuer_arn
}

# Connectors: any MCP server, added at runtime by asking AIC (docs/CONNECTORS_SKILLS.md). Terraform names none.
module "connectors" {
  source               = "../../modules/connectors"
  name                 = local.name
  region               = var.region
  account_id           = data.aws_caller_identity.me.account_id
  kms_key_arn          = module.security.kms_key_arn
  boundary_arn         = module.security.boundary_arn
  ledger_arn           = module.ledger.ledger_arn
  ledger_table         = module.ledger.ledger_table
  bus_arn              = module.bus.bus_arn
  bus_name             = module.bus.bus_name
  hud_origin           = module.frontend.url
  bundle_path          = module.api.bundle_path
  bundle_hash          = module.api.bundle_hash
  agent_role_names     = module.agents.role_names
  api_role_name        = module.api.role_names["api"]
  app_bridge_role_name = module.api.role_names["app-bridge"]
  default_tags         = local.base_tags
  log_retention_days   = var.log_retention_days
}

# Mail and calendar accounts (docs/MAIL_CALENDAR.md §8). Workers get none of it.
module "mail" {
  source               = "../../modules/mail"
  name                 = local.name
  region               = var.region
  account_id           = data.aws_caller_identity.me.account_id
  kms_key_arn          = module.security.kms_key_arn
  hud_origin           = module.frontend.url
  default_tags         = local.base_tags
  providers_config     = var.mail_providers
  api_role_name        = module.api.role_names["api"]
  app_bridge_role_name = module.api.role_names["app-bridge"]
  reader_role_names    = { for r, n in module.agents.role_names : r => n if r != "worker" }
}

# iPhone push notifications (docs/NOTIFICATIONS.md): one per finished job, no email.
module "notifications" {
  source             = "../../modules/notifications"
  name               = local.name
  region             = var.region
  account_id         = data.aws_caller_identity.me.account_id
  kms_key_arn        = module.security.kms_key_arn
  apns_enabled       = var.apns_enabled
  api_role_name      = module.api.role_names["api"]
  notifier_role_name = module.api.role_names["notifier"]
}

# Owner-uploaded skills (docs/CONNECTORS_SKILLS.md §2).
module "skills" {
  source           = "../../modules/skills"
  name             = local.name
  kms_key_arn      = module.security.kms_key_arn
  agent_role_names = module.agents.role_names
  api_role_name    = module.api.role_names["api"]
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
  dlq_names        = merge(module.bus.dlq_names, { apps = module.api.apps_dlq_name, knowledge-start = module.knowledge.start_dlq_name })
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
    pollyRegion          = var.polly_region
    transcribeRegion     = var.transcribe_region
    budgetAlertUsd       = var.monthly_budget_usd
    transcribeVocabulary = module.auth.vocabulary_name
    appsUrl              = module.apps.url
  })
  tags = { Component = "frontend" }
}
