# Connectors (docs/CONNECTORS_SKILLS.md §1.6, §1.9, §1.10): one AgentCore Gateway with AWS_IAM inbound auth and a
# Cedar policy engine in ENFORCE mode, one workload identity for the token vault, the bridge Lambda every Gateway
# target points at, the connectors admin Lambda, a bucket for OpenAPI specs, and the generic MCP host runtime for
# package servers. Terraform names no connector: targets, credential providers, secrets and Cedar policies are
# city data, created at runtime after the owner's approval (decisions 75, 76 and 81).
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
variable "ledger_arn" { type = string }
variable "ledger_table" { type = string }
variable "bus_arn" { type = string }
variable "bus_name" { type = string }
variable "hud_origin" {
  type        = string
  description = "The HUD's origin (https://…). The sign-in return address is <origin>/?connect=return."
}
variable "bundle_path" {
  type        = string
  description = "The Python Lambda package zip, built by the api module (one package for every function)."
}
variable "bundle_hash" { type = string }
variable "agent_role_names" {
  type        = map(string)
  description = "The four runtime roles (ace, orchestrator, manager, worker): they get InvokeGateway and nothing else here."
}
variable "api_role_name" { type = string }
variable "utility_invoke_arns" {
  type        = list(string)
  description = "Haiku 5.5 (utility role): which departments use a connector that just connected (decision 173)."
}
variable "utility_profile_arn" { type = string }
variable "app_bridge_role_name" {
  type        = string
  default     = "aic-prod-fn-app-bridge"
  description = "The apps feature's bridge role (docs/APPS.md): the Cedar principal for app reads, and the one Lambda role besides the runtimes that may invoke the Gateway."
}
variable "default_tags" {
  type        = map(string)
  description = "The cost-allocation tags. Secrets and providers the city creates at runtime carry them, with Component = connectors."
}
variable "log_retention_days" {
  type    = number
  default = 30
}

locals {
  tags        = { Component = "connectors" }
  runtime_tag = merge(var.default_tags, local.tags)
  arn         = "arn:aws:bedrock-agentcore:${var.region}:${var.account_id}"
  workload    = "${var.name}-connectors"
  # Fixed names, so the gateway role's policy can exist before the gateway (no cycle through the bridge's env).
  bridge_arn   = "arn:aws:lambda:${var.region}:${var.account_id}:function:${var.name}-connector-bridge"
  gateway_arns = "${local.arn}:gateway/${var.name}-connectors-*"
  # Identity resources a token call is authorized on: the provider, the vault, the workload identity and its directory.
  vault        = "${local.arn}:token-vault/default"
  directory    = "${local.arn}:workload-identity-directory/default"
  workload_arn = "${local.directory}/workload-identity/${local.workload}"
  oauth_arns   = "${local.vault}/oauth2credentialprovider/aic-conn-*"
  apikey_arns  = "${local.vault}/apikeycredentialprovider/aic-conn-*"
  # API keys and package env values (EXTERNAL providers), and the client secrets AgentCore keeps for OAuth providers (MANAGED).
  conn_secrets    = "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:aic/prod/connectors/*"
  managed_oauth   = "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:bedrock-agentcore-identity!default/oauth2/aic-conn-*"
  managed_apikey  = "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:bedrock-agentcore-identity!default/apikey/aic-conn-*"
  owner_only      = { StringEquals = { "bedrock-agentcore:userid" = "owner" } }
  required_tags   = { "aws:RequestTag/Project" = var.default_tags["Project"], "aws:RequestTag/Component" = "connectors" }
  allowed_tagkeys = { "aws:TagKeys" = keys(local.runtime_tag) }
  host_dir        = abspath("${path.module}/../../../services/mcp-host")
  # A new image only when the host's own sources change (the agent image's tag works the same way, in deploy.yml).
  host_tag = "mh-${substr(sha256(join("", [for f in sort(fileset(local.host_dir, "**")) : filesha256("${local.host_dir}/${f}")])), 0, 16)}"
  functions = {
    connector-bridge = { handler = "aic.lambdas.connector_bridge.handler", timeout = 70, memory = 512 }
    connectors       = { handler = "aic.lambdas.connectors.handler", timeout = 300, memory = 512 }
  }
  common_env = {
    AIC_REGION              = var.region
    AIC_LEDGER_TABLE        = var.ledger_table
    AIC_CONNECTORS_WORKLOAD = local.workload
    AIC_CONNECTORS_BUCKET   = aws_s3_bucket.specs.bucket
    AIC_MCP_HOST_ARN        = aws_bedrockagentcore_agent_runtime.mcp_host.agent_runtime_arn
  }
  env = {
    connector-bridge = local.common_env
    connectors = merge(local.common_env, {
      AIC_EVENT_BUS        = var.bus_name
      AIC_GATEWAY_ID       = aws_bedrockagentcore_gateway.this.gateway_id
      AIC_POLICY_ENGINE_ID = aws_bedrockagentcore_policy_engine.this.policy_engine_id
      AIC_BRIDGE_ARN       = local.bridge_arn
      AIC_APP_BRIDGE_ROLE  = var.app_bridge_role_name
      AIC_KMS_KEY_ARN      = var.kms_key_arn
      AIC_DEFAULT_TAGS     = jsonencode(local.runtime_tag)
      # Decision 173: a gated utility turn on every successful connection picks the departments that hang its sign.
      AIC_APP_PROFILE_UTILITY = var.utility_profile_arn
    })
  }
  ledger_read = ["dynamodb:GetItem", "dynamodb:Query"]
  ledger_rw   = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"]
  host_invoke = [aws_bedrockagentcore_agent_runtime.mcp_host.agent_runtime_arn, "${aws_bedrockagentcore_agent_runtime.mcp_host.agent_runtime_arn}/*"]
  # What each function may do, beyond its log group, tracing and the project key.
  permissions = {
    connector-bridge = [
      { Sid = "VaultUserOwner", Action = ["bedrock-agentcore:GetWorkloadAccessTokenForUserId"], Resource = [local.directory, local.workload_arn], Condition = local.owner_only },
      { Sid = "ConnectorCredentials", Action = ["bedrock-agentcore:GetResourceOauth2Token", "bedrock-agentcore:GetResourceApiKey"], Resource = [local.vault, local.directory, local.workload_arn, local.oauth_arns, local.apikey_arns] },
      { Sid = "ConnectorSecrets", Action = ["secretsmanager:GetSecretValue"], Resource = [local.conn_secrets, local.managed_oauth, local.managed_apikey] },
      { Sid = "LedgerConnectors", Action = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:UpdateItem"], Resource = [var.ledger_arn], Condition = { "ForAllValues:StringEquals" = { "dynamodb:LeadingKeys" = ["CONNECTORS"] } } },
      { Sid = "ReadSpecs", Action = ["s3:GetObject"], Resource = ["${aws_s3_bucket.specs.arn}/specs/*"] },
      { Sid = "PackageServers", Action = ["bedrock-agentcore:InvokeAgentRuntime", "bedrock-agentcore:StopRuntimeSession"], Resource = local.host_invoke },
    ]
    connectors = [
      { Sid = "GatewayTargets", Action = ["bedrock-agentcore:GetGateway", "bedrock-agentcore:CreateGatewayTarget", "bedrock-agentcore:UpdateGatewayTarget", "bedrock-agentcore:DeleteGatewayTarget", "bedrock-agentcore:GetGatewayTarget", "bedrock-agentcore:ListGatewayTargets", "bedrock-agentcore:InvokeGateway", "bedrock-agentcore:ManageResourceScopedPolicy"], Resource = [aws_bedrockagentcore_gateway.this.gateway_arn] },
      { Sid = "CedarPolicies", Action = ["bedrock-agentcore:CreatePolicy", "bedrock-agentcore:UpdatePolicy", "bedrock-agentcore:DeletePolicy", "bedrock-agentcore:GetPolicy", "bedrock-agentcore:ListPolicies"], Resource = [aws_bedrockagentcore_policy_engine.this.policy_engine_arn, "${aws_bedrockagentcore_policy_engine.this.policy_engine_arn}/policy/*"] },
      { Sid = "CreateProvidersTagged", Action = ["bedrock-agentcore:CreateOauth2CredentialProvider", "bedrock-agentcore:CreateApiKeyCredentialProvider", "bedrock-agentcore:TagResource"], Resource = [local.vault, local.oauth_arns, local.apikey_arns], Condition = { StringEquals = local.required_tags, "ForAllValues:StringEquals" = local.allowed_tagkeys } },
      # Creating a provider at runtime also checks (and on first use creates) the default token vault (decision 163).
      { Sid = "TokenVault", Action = ["bedrock-agentcore:GetTokenVault", "bedrock-agentcore:CreateTokenVault"], Resource = [local.vault] },
      { Sid = "ManageProviders", Action = ["bedrock-agentcore:UpdateOauth2CredentialProvider", "bedrock-agentcore:DeleteOauth2CredentialProvider", "bedrock-agentcore:GetOauth2CredentialProvider", "bedrock-agentcore:UpdateApiKeyCredentialProvider", "bedrock-agentcore:DeleteApiKeyCredentialProvider", "bedrock-agentcore:GetApiKeyCredentialProvider"], Resource = [local.vault, local.oauth_arns, local.apikey_arns] },
      { Sid = "VaultUserOwner", Action = ["bedrock-agentcore:GetWorkloadAccessTokenForUserId"], Resource = [local.directory, local.workload_arn], Condition = local.owner_only },
      { Sid = "ConnectorCredentials", Action = ["bedrock-agentcore:GetResourceOauth2Token", "bedrock-agentcore:GetResourceApiKey"], Resource = [local.vault, local.directory, local.workload_arn, local.oauth_arns, local.apikey_arns] },
      { Sid = "CreateSecretsTagged", Action = ["secretsmanager:CreateSecret", "secretsmanager:TagResource"], Resource = [local.conn_secrets], Condition = { StringEquals = local.required_tags, "ForAllValues:StringEquals" = local.allowed_tagkeys } },
      { Sid = "ConnectorSecrets", Action = ["secretsmanager:PutSecretValue", "secretsmanager:DeleteSecret", "secretsmanager:GetSecretValue"], Resource = [local.conn_secrets] },
      # OAuth clients from dynamic registration are stored by AgentCore as MANAGED secrets, with the caller's permissions.
      { Sid = "ManagedProviderSecrets", Action = ["secretsmanager:CreateSecret", "secretsmanager:PutSecretValue", "secretsmanager:DeleteSecret", "secretsmanager:GetSecretValue", "secretsmanager:TagResource"], Resource = [local.managed_oauth, local.managed_apikey] },
      { Sid = "LedgerConnectorsAndApps", Action = local.ledger_rw, Resource = [var.ledger_arn], Condition = { "ForAllValues:StringLike" = { "dynamodb:LeadingKeys" = ["CONNECTORS", "APPROVAL#*"] } } },
      { Sid = "ReadAppGrants", Action = local.ledger_read, Resource = [var.ledger_arn], Condition = { "ForAllValues:StringEquals" = { "dynamodb:LeadingKeys" = ["APPS"] } } },
      { Sid = "Events", Action = ["events:PutEvents"], Resource = [var.bus_arn] },
      { Sid = "Specs", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = ["${aws_s3_bucket.specs.arn}/specs/*"] },
      # remove deletes every stored spec of a connector, so it lists its own prefix.
      { Sid = "ListSpecs", Action = ["s3:ListBucket"], Resource = [aws_s3_bucket.specs.arn], Condition = { StringLike = { "s3:prefix" = ["specs/", "specs/*"] } } },
      { Sid = "PackageServers", Action = ["bedrock-agentcore:InvokeAgentRuntime", "bedrock-agentcore:StopRuntimeSession"], Resource = local.host_invoke },
      # Decision 173: which departments use a connector, one gated utility turn on Haiku 5.5 (Converse is
      # authorized as bedrock:InvokeModel). The turn reads the settings, the caps' spend and the departments, and
      # writes its turn and spend rows; nothing else in the ledger.
      { Sid = "Utility", Action = ["bedrock:InvokeModel"], Resource = var.utility_invoke_arns },
      { Sid = "UtilityTurnLedger", Action = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem"], Resource = [var.ledger_arn], Condition = { "ForAllValues:StringLike" = { "dynamodb:LeadingKeys" = ["CONFIG", "SPEND#*", "TURN#*", "IDEMP#*", "AGENT#utility"] } } },
      # The department list is the ledger's gsi1 (partition DEPT); a read of the index, no writes.
      { Sid = "ReadDepartments", Action = ["dynamodb:Query"], Resource = ["${var.ledger_arn}/index/gsi1"] },
    ]
  }
}

# ---------- the Gateway, its role and the policy engine ----------
resource "aws_bedrockagentcore_policy_engine" "this" {
  # AgentCore's own encryption: a customer key would need forward-access grants for every caller, and Cedar holds no secret.
  name        = replace("${var.name}-connectors", "-", "_")
  description = "AI City connectors. Policies are city data, rewritten by the connectors Lambda (decision 76)."
  tags        = local.tags
}

resource "aws_iam_role" "gateway" {
  name                 = "${var.name}-gateway"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "bedrock-agentcore.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = { "aws:SourceAccount" = var.account_id }
        ArnLike      = { "aws:SourceArn" = "${local.arn}:gateway/*" }
      }
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "gateway" {
  name = "bridge-and-policy"
  role = aws_iam_role.gateway.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "InvokeBridgeOnly", Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = [local.bridge_arn] },
      { Sid = "PolicyEngineConfiguration", Effect = "Allow", Action = ["bedrock-agentcore:GetPolicyEngine"], Resource = [aws_bedrockagentcore_policy_engine.this.policy_engine_arn] },
      { Sid = "PolicyEngineAuthorization", Effect = "Allow", Action = ["bedrock-agentcore:AuthorizeAction", "bedrock-agentcore:PartiallyAuthorizeActions"], Resource = [aws_bedrockagentcore_policy_engine.this.policy_engine_arn, local.gateway_arns] },
      { Sid = "UseTheDataKey", Effect = "Allow", Action = ["kms:Decrypt", "kms:GenerateDataKey"], Resource = var.kms_key_arn },
    ]
  })
}

resource "aws_bedrockagentcore_gateway" "this" {
  # Without the policy permissions in place, attaching the engine fails and every call is denied (AgentCore docs).
  depends_on      = [aws_iam_role_policy.gateway]
  name            = "${var.name}-connectors"
  description     = "AI City connectors: one Lambda target per connector, all on the bridge."
  role_arn        = aws_iam_role.gateway.arn
  authorizer_type = "AWS_IAM"
  protocol_type   = "MCP"
  kms_key_arn     = var.kms_key_arn
  policy_engine_configuration {
    arn  = aws_bedrockagentcore_policy_engine.this.policy_engine_arn
    mode = "ENFORCE"
  }
  tags = local.tags
}

resource "aws_bedrockagentcore_workload_identity" "this" {
  name                                = local.workload
  allowed_resource_oauth2_return_urls = ["${var.hud_origin}/?connect=return"]
  tags                                = local.tags
}

# ---------- OpenAPI specs (§1.11) ----------
resource "aws_s3_bucket" "specs" {
  #checkov:skip=CKV_AWS_144:Specs are re-fetched from their URL on refresh; replication is not worth it.
  #checkov:skip=CKV_AWS_18:Access logging would need another bucket; CloudTrail data events can be enabled if needed.
  #checkov:skip=CKV2_AWS_62:No event notifications are needed.
  bucket = "${var.name}-connectors"
  tags   = local.tags
}

resource "aws_s3_bucket_versioning" "specs" {
  bucket = aws_s3_bucket.specs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "specs" {
  bucket = aws_s3_bucket.specs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "specs" {
  bucket                  = aws_s3_bucket.specs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "specs" {
  bucket = aws_s3_bucket.specs.id
  rule {
    id     = "old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 2
    }
  }
}

resource "aws_s3_bucket_policy" "specs" {
  bucket = aws_s3_bucket.specs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "TlsOnly"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.specs.arn, "${aws_s3_bucket.specs.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

# ---------- the MCP host runtime for package servers (§1.10) ----------
resource "aws_ecr_repository" "mcp_host" {
  name                 = "${var.name}-mcp-host"
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

resource "aws_ecr_lifecycle_policy" "mcp_host" {
  repository = aws_ecr_repository.mcp_host.name
  policy = jsonencode({
    rules = [{ rulePriority = 1, description = "keep the last 10 images", selection = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 10 }, action = { type = "expire" } }]
  })
}

# Built and pushed during `terraform apply` (deploy.yml), like the agent image. The context is services/mcp-host only:
# the host carries no city code.
resource "terraform_data" "mcp_host_image" {
  triggers_replace = [local.host_tag]
  depends_on       = [aws_ecr_repository.mcp_host]
  provisioner "local-exec" {
    command = "bash ${abspath("${path.module}/../../../scripts/push-image.sh")}"
    environment = {
      REPO_URL    = aws_ecr_repository.mcp_host.repository_url
      IMAGE_TAG   = local.host_tag
      AWS_REGION  = var.region
      CONTEXT_DIR = local.host_dir
      DOCKERFILE  = "${local.host_dir}/Dockerfile"
    }
  }
}

resource "aws_iam_role" "mcp_host" {
  name                 = "${var.name}-mcp-host"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "bedrock-agentcore.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = { "aws:SourceAccount" = var.account_id }
        ArnLike      = { "aws:SourceArn" = "${local.arn}:*" }
      }
    }]
  })
  tags = merge(local.tags, { AgentRole = "mcp-host" })
}

# Logs and its own image, nothing else: no Secrets Manager, no Identity, no ledger, no Bedrock. A package that
# reaches the credentials endpoint finds a role that can do nothing in the city.
resource "aws_iam_role_policy" "mcp_host" {
  name = "logs-only"
  role = aws_iam_role.mcp_host.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "PullOwnImage", Effect = "Allow", Action = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"], Resource = aws_ecr_repository.mcp_host.arn },
      { Sid = "EcrToken", Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
      { Sid = "UseTheImageKey", Effect = "Allow", Action = ["kms:Decrypt"], Resource = var.kms_key_arn, Condition = { StringEquals = { "kms:ViaService" = "ecr.${var.region}.amazonaws.com" } } },
      { Sid = "Logs", Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams", "logs:DescribeLogGroups"], Resource = "arn:aws:logs:${var.region}:${var.account_id}:log-group:/aws/bedrock-agentcore/runtimes/*" },
    ]
  })
}

resource "aws_bedrockagentcore_agent_runtime" "mcp_host" {
  depends_on         = [terraform_data.mcp_host_image, aws_iam_role_policy.mcp_host]
  agent_runtime_name = replace("${var.name}-mcp-host", "-", "_")
  description        = "AI City MCP host: runs one approved npm or PyPI MCP server per session"
  role_arn           = aws_iam_role.mcp_host.arn
  agent_runtime_artifact {
    container_configuration {
      container_uri = "${aws_ecr_repository.mcp_host.repository_url}:${local.host_tag}"
    }
  }
  network_configuration {
    network_mode = "PUBLIC" # packages install from npm and PyPI; inbound only through AgentCore with IAM (the bridge)
  }
  lifecycle_configuration {
    idle_runtime_session_timeout = 900
    max_lifetime                 = 28800
  }
  tags = merge(local.tags, { AgentRole = "mcp-host" })
}

# ---------- the bridge and the connectors Lambda ----------
resource "aws_cloudwatch_log_group" "fn" {
  #checkov:skip=CKV_AWS_338:Retention is the log_retention_days variable (30 days by default) to keep cost low; the ledger keeps the durable record.
  for_each          = local.functions
  name              = "/aws/lambda/${var.name}-${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn
  tags              = local.tags
}

resource "aws_iam_role" "fn" {
  for_each             = local.functions
  name                 = "${var.name}-fn-${each.key}"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "fn" {
  for_each = local.functions
  name     = "least-privilege"
  role     = aws_iam_role.fn[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.fn[each.key].arn}:*" },
        { Effect = "Allow", Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"], Resource = "*" },
        { Effect = "Allow", Action = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"], Resource = var.kms_key_arn },
      ],
      [for p in local.permissions[each.key] : merge({ Effect = "Allow" }, p)],
    )
  })
}

resource "aws_lambda_function" "fn" {
  #checkov:skip=CKV_AWS_117:No VPC: the bridge reaches remote MCP servers and APIs on the internet, and a VPC would add NAT cost.
  #checkov:skip=CKV_AWS_272:Code signing is not set up for a single-owner project; deploys run from the owner's approved workflow.
  #checkov:skip=CKV_AWS_116:The bridge is invoked synchronously by the Gateway; the connectors Lambda's async failures set the connector to error.
  for_each                       = local.functions
  function_name                  = "${var.name}-${each.key}"
  role                           = aws_iam_role.fn[each.key].arn
  runtime                        = "python3.13"
  architectures                  = ["arm64"]
  handler                        = each.value.handler
  filename                       = var.bundle_path
  source_code_hash               = var.bundle_hash
  timeout                        = each.value.timeout
  memory_size                    = each.value.memory
  kms_key_arn                    = var.kms_key_arn
  reserved_concurrent_executions = each.key == "connector-bridge" ? 50 : 5
  tracing_config {
    mode = "Active"
  }
  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.fn[each.key].name
  }
  environment {
    variables = local.env[each.key]
  }
  tags = local.tags
}

# Only the gateway role may invoke the bridge (check-iam.mjs asserts no other role has it in its policy).
resource "aws_lambda_permission" "bridge" {
  statement_id  = "gateway-role"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn["connector-bridge"].function_name
  principal     = aws_iam_role.gateway.arn
}

# ---------- what the other roles get ----------
# The runtimes reach connectors only through the Gateway; Cedar decides which tools each role may call.
resource "aws_iam_role_policy" "runtime_gateway" {
  for_each = var.agent_role_names
  name     = "connectors-gateway"
  role     = each.value
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Sid = "InvokeConnectorsGateway", Effect = "Allow", Action = ["bedrock-agentcore:InvokeGateway"], Resource = [aws_bedrockagentcore_gateway.this.gateway_arn] }]
  })
}

# The app-bridge Lambda runs apps' granted connector reads (docs/APPS.md v2): InvokeGateway on this Gateway only.
# The api role never gets Gateway access.
resource "aws_iam_role_policy" "app_bridge_gateway" {
  name = "connectors-gateway"
  role = var.app_bridge_role_name
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Sid = "InvokeConnectorsGateway", Effect = "Allow", Action = ["bedrock-agentcore:InvokeGateway"], Resource = [aws_bedrockagentcore_gateway.this.gateway_arn] }]
  })
}

# The api Lambda: start admin actions, sign the owner in, and store a key the owner typed into the secure field.
# It never reads API keys (only the bridge and the connectors Lambda do).
# A managed policy, not inline: the api role carries one inline policy per feature and IAM caps
# a role's inline policies at 10,240 bytes in total (the connectors release hit it).
resource "aws_iam_policy" "api" {
  name = "${var.name}-api-connectors"
  tags = local.tags
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "StartAdminActions", Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = [aws_lambda_function.fn["connectors"].arn] },
      { Sid = "VaultUserOwner", Effect = "Allow", Action = ["bedrock-agentcore:GetWorkloadAccessTokenForUserId", "bedrock-agentcore:CompleteResourceTokenAuth"], Resource = [local.directory, local.workload_arn, local.vault, local.oauth_arns], Condition = local.owner_only },
      { Sid = "SignIn", Effect = "Allow", Action = ["bedrock-agentcore:GetResourceOauth2Token"], Resource = [local.vault, local.directory, local.workload_arn, local.oauth_arns] },
      { Sid = "CreateApiKeyProvidersTagged", Effect = "Allow", Action = ["bedrock-agentcore:CreateApiKeyCredentialProvider", "bedrock-agentcore:TagResource"], Resource = [local.vault, local.apikey_arns], Condition = { StringEquals = local.required_tags, "ForAllValues:StringEquals" = local.allowed_tagkeys } },
      { Sid = "TokenVault", Effect = "Allow", Action = ["bedrock-agentcore:GetTokenVault", "bedrock-agentcore:CreateTokenVault"], Resource = [local.vault] },
      { Sid = "UpdateProviders", Effect = "Allow", Action = ["bedrock-agentcore:UpdateApiKeyCredentialProvider", "bedrock-agentcore:GetApiKeyCredentialProvider", "bedrock-agentcore:UpdateOauth2CredentialProvider", "bedrock-agentcore:GetOauth2CredentialProvider"], Resource = [local.vault, local.oauth_arns, local.apikey_arns] },
      { Sid = "CreateSecretsTagged", Effect = "Allow", Action = ["secretsmanager:CreateSecret", "secretsmanager:TagResource"], Resource = [local.conn_secrets], Condition = { StringEquals = local.required_tags, "ForAllValues:StringEquals" = local.allowed_tagkeys } },
      { Sid = "WriteKeysOnly", Effect = "Allow", Action = ["secretsmanager:PutSecretValue"], Resource = [local.conn_secrets] },
      # The OAuth client secret only: AgentCore checks that the caller of GetResourceOauth2Token may read it.
      { Sid = "OAuthClientSecrets", Effect = "Allow", Action = ["secretsmanager:GetSecretValue", "secretsmanager:PutSecretValue"], Resource = [local.managed_oauth] },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api" {
  role       = var.api_role_name
  policy_arn = aws_iam_policy.api.arn
}

output "gateway_url" { value = aws_bedrockagentcore_gateway.this.gateway_url }
output "gateway_arn" { value = aws_bedrockagentcore_gateway.this.gateway_arn }
output "gateway_id" { value = aws_bedrockagentcore_gateway.this.gateway_id }
output "policy_engine_id" { value = aws_bedrockagentcore_policy_engine.this.policy_engine_id }
output "workload_name" { value = aws_bedrockagentcore_workload_identity.this.name }
output "connectors_function_name" { value = aws_lambda_function.fn["connectors"].function_name }
output "bridge_arn" { value = aws_lambda_function.fn["connector-bridge"].arn }
output "mcp_host_arn" { value = aws_bedrockagentcore_agent_runtime.mcp_host.agent_runtime_arn }
output "mcp_host_image_tag" { value = local.host_tag }
output "specs_bucket" { value = aws_s3_bucket.specs.bucket }
output "function_names" { value = { for k, f in aws_lambda_function.fn : k => f.function_name } }
output "runtime_tags" { value = local.runtime_tag }
