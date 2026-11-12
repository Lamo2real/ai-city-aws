# Agents on Amazon Bedrock AgentCore: one image (ECR), four runtimes (vaic, orchestrator, manager,
# worker), one tagged application inference profile per role (plus the utility profile), AgentCore
# Memory per role, and one least-privilege IAM role per runtime. Departments and workers are
# sessions, not runtimes. Model IDs come from config/models.json and nowhere else.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
  }
}

variable "name" { type = string }
variable "region" { type = string }
variable "account_id" { type = string }
variable "kms_key_arn" { type = string }
variable "boundary_arn" { type = string }
variable "image_tag" { type = string }
variable "profile_prefix" { type = string }
variable "use_application_inference_profiles" { type = bool }
variable "ledger_arn" { type = string }
variable "ledger_table" { type = string }
variable "bus_arn" { type = string }
variable "bus_name" { type = string }
variable "queue_arns" { type = map(string) }
variable "queue_urls" { type = map(string) }
variable "factory_function_arn" { type = string }
variable "factory_function_name" { type = string }
# VAIC acts for the owner through the HUD's own API (decision 143): it invokes the API Lambda's live alias directly.
variable "api_function_name" {
  type    = string
  default = ""
}
variable "api_function_arn" {
  type    = string
  default = ""
}
variable "workspaces_bucket" { type = string }
variable "workspaces_arn" { type = string }
variable "runtime_env" {
  type        = map(map(string))
  default     = {}
  description = "Extra environment per role (connectors, skills, mail), keyed by role."
}
variable "knowledge_table" { type = string }
variable "knowledge_table_arn" { type = string }
variable "knowledge_bucket" { type = string }
variable "knowledge_bucket_arn" { type = string }
variable "knowledge_base_id" { type = string }
variable "knowledge_base_arn" { type = string }
variable "knowledge_data_source_id" { type = string }
variable "knowledge_graph_id" { type = string }
variable "knowledge_graph_arn" { type = string }
variable "apps_url" {
  description = "The public apps origin; workers read an app's current version from it (load_app, docs/APPS.md § v3)."
  type        = string
  default     = ""
}

locals {
  tags   = { Component = "agents" }
  models = jsondecode(file("${path.module}/../../../config/models.json"))
  roles  = ["vaic", "orchestrator", "manager", "worker"]
  # utility, chief_of_staff and executive are calls without a runtime of their own: a profile each, so the bill
  # splits by role. The executives (decision 140) are called from VAIC's and the Orchestrator's runtimes and the
  # executives Lambda.
  all_roles = concat(local.roles, ["utility", "chief_of_staff", "executive"])
  # The runtimes that consult the executives may call the executives' models through their profile.
  consults = ["vaic", "orchestrator"]
  # Plain model names each role may call: its own and its fallback, plus, for the roles named in departmentModels,
  # the model the owner's chosen departments run on (decision 129: Fable for the workers of Media, Research, Legal).
  dept_models = try(compact([local.models.departmentModels.model, local.models.departmentModels.fallback]), [])
  dept_roles  = try(local.models.departmentModels.roles, ["manager", "worker"])
  role_models = {
    for r in local.all_roles : r => distinct(compact(concat(
      [local.models.roles[r].model, local.models.roles[r].fallback],
      contains(local.dept_roles, r) ? local.dept_models : [],
    )))
  }
  system_profile_arn = {
    for m, v in local.models.models : m => "arn:aws:bedrock:${var.region}:${var.account_id}:inference-profile/${var.profile_prefix}.${v.modelId}"
  }
  foundation_model_arns = { for m, v in local.models.models : m => "arn:aws:bedrock:*::foundation-model/${v.modelId}" }
  app_profile_arn       = { for r in local.all_roles : r => var.use_application_inference_profiles ? aws_bedrock_inference_profile.role[r].arn : "" }
  # Every ARN a role needs to invoke: application profile, system profiles and foundation models of its models.
  invoke_arns = {
    for r in local.all_roles : r => compact(concat(
      [local.app_profile_arn[r]],
      [for m in local.role_models[r] : local.system_profile_arn[m]],
      [for m in local.role_models[r] : local.foundation_model_arns[m]],
    ))
  }
  profile_arns = {
    for r in local.all_roles : r => compact(concat([local.app_profile_arn[r]], [for m in local.role_models[r] : local.system_profile_arn[m]]))
  }
}

resource "aws_ecr_repository" "runtime" {
  name                 = "${var.name}-agent-runtime"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.kms_key_arn
  }
  tags = local.tags
}

resource "aws_ecr_lifecycle_policy" "runtime" {
  repository = aws_ecr_repository.runtime.name
  policy = jsonencode({
    rules = [{ rulePriority = 1, description = "keep the last 20 images", selection = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 20 }, action = { type = "expire" } }]
  })
}

# One application inference profile per role, copied from the role's global profile, so the AWS
# bill splits model cost by role (AgentRole tag). Off: the runtimes call the global profiles.
resource "aws_bedrock_inference_profile" "role" {
  for_each = var.use_application_inference_profiles ? toset(local.all_roles) : toset([])
  name     = "vaic-${each.key}"
  # Bedrock allows only letters, digits, ":" and "." separated by single spaces, "_" or "-" here.
  description = "AI City ${each.key} ${local.models.roles[each.key].model}"
  model_source {
    copy_from = local.system_profile_arn[local.models.roles[each.key].model]
  }
  tags = merge(local.tags, { AgentRole = each.key })
}

resource "aws_bedrockagentcore_memory" "role" {
  for_each              = toset(local.roles)
  name                  = "${replace(var.name, "-", "_")}_${each.key}_memory"
  description           = "AI City ${each.key} memory (starts empty)"
  event_expiry_duration = 30
  encryption_key_arn    = var.kms_key_arn
  tags                  = merge(local.tags, { AgentRole = each.key })
}

# ---------- IAM: one role per runtime ----------
resource "aws_iam_role" "agent" {
  for_each             = toset(local.roles)
  name                 = "${var.name}-agent-${each.key}"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "bedrock-agentcore.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = { "aws:SourceAccount" = var.account_id }
        ArnLike      = { "aws:SourceArn" = "arn:aws:bedrock-agentcore:${var.region}:${var.account_id}:*" }
      }
    }]
  })
  tags = merge(local.tags, { AgentRole = each.key })
}

resource "aws_iam_role_policy" "common" {
  for_each = toset(local.roles)
  name     = "common"
  role     = aws_iam_role.agent[each.key].id
  policy = templatefile("${path.module}/policies/common.json.tftpl", {
    region       = var.region
    account_id   = var.account_id
    ecr_repo_arn = aws_ecr_repository.runtime.arn
    memory_arn   = aws_bedrockagentcore_memory.role[each.key].arn
    model_arns   = jsonencode(distinct(concat(local.invoke_arns[each.key], contains(local.consults, each.key) ? local.invoke_arns["executive"] : [])))
    profile_arns = jsonencode(distinct(concat(local.profile_arns[each.key], contains(local.consults, each.key) ? local.profile_arns["executive"] : [])))
    kms_key_arn  = var.kms_key_arn
    bus_arn      = var.bus_arn
  })
}

# VAIC, the Orchestrator and managers coordinate: ledger and queues. Workers don't (see worker.json).
resource "aws_iam_role_policy" "coordinator" {
  for_each = toset(["vaic", "orchestrator", "manager"])
  name     = "coordinate"
  role     = aws_iam_role.agent[each.key].id
  policy = templatefile("${path.module}/policies/coordinator.json.tftpl", {
    ledger_arn = var.ledger_arn
    queue_arns = jsonencode(values(var.queue_arns))
  })
}

# Every role searches the owner's knowledge base; only VAIC (vaic) may add to it (docs/KNOWLEDGE.md section 9).
resource "aws_iam_role_policy" "knowledge" {
  for_each = toset(local.roles)
  name     = "knowledge-read"
  role     = aws_iam_role.agent[each.key].id
  policy = templatefile("${path.module}/policies/knowledge.json.tftpl", {
    knowledge_base_arn  = var.knowledge_base_arn
    knowledge_table_arn = var.knowledge_table_arn
    knowledge_graph_arn = var.knowledge_graph_arn
  })
}

resource "aws_iam_role_policy" "knowledge_vaic" {
  name = "knowledge-add"
  role = aws_iam_role.agent["vaic"].id
  policy = templatefile("${path.module}/policies/knowledge-vaic.json.tftpl", {
    knowledge_table_arn  = var.knowledge_table_arn
    knowledge_bucket_arn = var.knowledge_bucket_arn
  })
}

# VAIC's real-time voice (decision 120): only VAIC's role may open Nova Sonic's two-way audio stream.
resource "aws_iam_role_policy" "voice" {
  name = "voice"
  role = aws_iam_role.agent["vaic"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "SpeakWithNovaSonic"
      Effect   = "Allow"
      Action   = ["bedrock:InvokeModelWithBidirectionalStream"]
      Resource = distinct([for c in local.models.voice.speech : "arn:aws:bedrock:${c.region}::foundation-model/${c.modelId}"])
    }]
  })
}

# VAIC's browser (decision 265): one AgentCore Browser session per turn, driven over its automation stream. The
# AWS-managed browser only; VAIC never creates browsers or touches anyone else's.
resource "aws_iam_role_policy" "browser" {
  name = "browser"
  role = aws_iam_role.agent["vaic"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "BrowseForTheOwner"
      Effect = "Allow"
      Action = [
        "bedrock-agentcore:StartBrowserSession", "bedrock-agentcore:StopBrowserSession", "bedrock-agentcore:GetBrowserSession",
        "bedrock-agentcore:ConnectBrowserAutomationStream",
      ]
      Resource = ["arn:aws:bedrock-agentcore:${var.region}:aws:browser/aws.browser.v1"]
    }]
  })
}

# Only VAIC may run HUD routes as the owner (decision 143); the API refuses secret-taking routes on this path.
resource "aws_iam_role_policy" "owner_api" {
  count = var.api_function_arn == "" ? 0 : 1
  name  = "owner-api"
  role  = aws_iam_role.agent["vaic"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "RunHudRoutesForTheOwner"
      Effect   = "Allow"
      Action   = ["lambda:InvokeFunction"]
      Resource = [var.api_function_arn]
    }]
  })
}

resource "aws_iam_role_policy" "factory" {
  name   = "agent-factory"
  role   = aws_iam_role.agent["manager"].id
  policy = templatefile("${path.module}/policies/factory.json.tftpl", { factory_arn = var.factory_function_arn })
}

resource "aws_iam_role_policy" "worker" {
  name = "worker"
  role = aws_iam_role.agent["worker"].id
  policy = templatefile("${path.module}/policies/worker.json.tftpl", {
    region             = var.region
    ledger_arn         = var.ledger_arn
    manager_queue_arn  = var.queue_arns["manager"]
    workspace_role_arn = aws_iam_role.workspace.arn
  })
}

# Workers reach S3 only through this role, assumed with a session tag naming the hire: each hire
# can touch hires/<its id>/ and nothing else. Managers assume it too (tag mgr-…), only to save into Files
# (decision 147; the files module grants the files bucket's hires/<tag>/files/ prefix).
resource "aws_iam_role" "workspace" {
  name                 = "${var.name}-worker-workspace"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { AWS = aws_iam_role.agent["worker"].arn }
        Action    = ["sts:AssumeRole", "sts:TagSession"]
        Condition = { StringLike = { "aws:RequestTag/hire_id" = "wkr-*" } }
      },
      {
        Effect    = "Allow"
        Principal = { AWS = aws_iam_role.agent["manager"].arn }
        Action    = ["sts:AssumeRole", "sts:TagSession"]
        Condition = { StringLike = { "aws:RequestTag/hire_id" = "mgr-*" } }
      },
    ]
  })
  tags = merge(local.tags, { AgentRole = "worker" })
}

resource "aws_iam_role_policy" "workspace" {
  name   = "own-hire-prefix"
  role   = aws_iam_role.workspace.id
  policy = templatefile("${path.module}/policies/workspace.json.tftpl", { bucket_arn = var.workspaces_arn, kms_key_arn = var.kms_key_arn })
}

# ---------- the image ----------
# Built and pushed during `terraform apply` (deploy.yml, after the owner approves the plan), after the
# repository exists and before the runtimes, so one reviewed plan deploys from nothing. A new tag rebuilds.
resource "terraform_data" "image" {
  # The repository's URL too: a new repository (the AIC → VAIC rename) gets its image even with an unchanged tag.
  triggers_replace = [var.image_tag, aws_ecr_repository.runtime.repository_url]
  depends_on       = [aws_ecr_repository.runtime]
  provisioner "local-exec" {
    command = "bash ${abspath("${path.module}/../../../scripts/push-image.sh")}"
    environment = {
      REPO_URL    = aws_ecr_repository.runtime.repository_url
      IMAGE_TAG   = var.image_tag
      AWS_REGION  = var.region
      CONTEXT_DIR = abspath("${path.module}/../../..")
    }
  }
}

# ---------- the four runtimes ----------
resource "aws_bedrockagentcore_agent_runtime" "role" {
  for_each           = toset(local.roles)
  depends_on         = [terraform_data.image]
  agent_runtime_name = "${replace(var.name, "-", "_")}_${each.key}"
  description        = "AI City ${each.key}"
  role_arn           = aws_iam_role.agent[each.key].arn
  platform_version   = "V2"
  agent_runtime_artifact {
    container_configuration {
      container_uri = "${aws_ecr_repository.runtime.repository_url}:${var.image_tag}"
    }
  }
  network_configuration {
    network_mode = "PUBLIC" # Bedrock, GitHub and the web; inbound only through AgentCore with IAM
  }
  lifecycle_configuration {
    # VAIC: a warm-kept session (the scheduler's warm_vaic ping every 5 min) that lives the whole day, so the owner's
    # message never waits for a container start. Workers: long jobs. Others: an hour.
    idle_runtime_session_timeout = each.key == "vaic" ? 1800 : 900
    max_lifetime                 = contains(["vaic", "worker"], each.key) ? 28800 : 3600
  }
  environment_variables = merge(
    {
      VAIC_ROLE                      = each.key
      VAIC_REGION                    = var.region
      VAIC_LEDGER_TABLE              = var.ledger_table
      VAIC_EVENT_BUS                 = var.bus_name
      VAIC_QUEUE_VAIC                = var.queue_urls["vaic"]
      VAIC_QUEUE_ORCHESTRATOR        = var.queue_urls["orchestrator"]
      VAIC_QUEUE_MANAGER             = var.queue_urls["manager"]
      VAIC_QUEUE_WORKER              = var.queue_urls["worker"]
      VAIC_FACTORY_FUNCTION          = var.factory_function_name
      VAIC_WORKSPACES_BUCKET         = var.workspaces_bucket
      VAIC_WORKSPACE_ROLE_ARN        = aws_iam_role.workspace.arn
      VAIC_PROFILE_PREFIX            = var.profile_prefix
      KNOWLEDGE_TABLE                = var.knowledge_table
      KNOWLEDGE_BASE_ID              = var.knowledge_base_id
      KNOWLEDGE_DATA_SOURCE_ID       = var.knowledge_data_source_id
      KNOWLEDGE_GRAPH_ID             = var.knowledge_graph_id
      CLAUDE_CODE_USE_BEDROCK        = "1"
      CLAUDE_CODE_DISABLE_1M_CONTEXT = "1"
    },
    each.key == "vaic" ? { KNOWLEDGE_BUCKET = var.knowledge_bucket } : {},
    each.key == "vaic" && var.api_function_name != "" ? { VAIC_API_FUNCTION = var.api_function_name } : {},
    # Only workers run shell commands, so only they scrub their environment (needs bubblewrap, in the image).
    # On the other roles Claude Code refuses to start with it set and nothing to sandbox.
    each.key == "worker" ? { CLAUDE_CODE_SUBPROCESS_ENV_SCRUB = "1" } : {},
    each.key == "worker" && var.apps_url != "" ? { VAIC_APPS_URL = var.apps_url } : {},
    var.use_application_inference_profiles ? { "VAIC_APP_PROFILE_${upper(each.key)}" = aws_bedrock_inference_profile.role[each.key].arn } : {},
    var.use_application_inference_profiles && contains(local.consults, each.key) ? { VAIC_APP_PROFILE_EXECUTIVE = aws_bedrock_inference_profile.role["executive"].arn } : {},
    lookup(var.runtime_env, each.key, {}),
  )
  tags = merge(local.tags, { AgentRole = each.key })
}

output "role_arns" { value = { for r, x in aws_iam_role.agent : r => x.arn } }
output "role_names" { value = { for r, x in aws_iam_role.agent : r => x.name } }
output "workspace_role_name" { value = aws_iam_role.workspace.name }
output "workspace_role_arn" { value = aws_iam_role.workspace.arn }
output "runtime_arns" { value = { for r, x in aws_bedrockagentcore_agent_runtime.role : r => x.agent_runtime_arn } }
output "runtime_ids" { value = { for r, x in aws_bedrockagentcore_agent_runtime.role : r => x.agent_runtime_id } }
output "ecr_repository_url" { value = aws_ecr_repository.runtime.repository_url }
output "utility_invoke_arns" { value = local.invoke_arns["utility"] }
output "utility_profile_arn" { value = local.app_profile_arn["utility"] }
output "chief_of_staff_invoke_arns" { value = local.invoke_arns["chief_of_staff"] }
output "chief_of_staff_profile_arn" { value = local.app_profile_arn["chief_of_staff"] }
output "executive_invoke_arns" { value = local.invoke_arns["executive"] }
output "executive_profile_arn" { value = local.app_profile_arn["executive"] }
