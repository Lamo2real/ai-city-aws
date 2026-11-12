# Lambdas (Node.js 24, arm64), the HTTP API (Cognito JWT authorizer), the WebSocket API (Lambda
# authorizer on $connect), SQS → dispatcher, EventBridge rules (City view, ledger, notifications,
# approvals), the Step Functions approval workflow and the scheduled jobs (EventBridge rules).
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws     = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
    archive = { source = "hashicorp/archive", version = ">= 2.7.0, < 3.0.0" }
  }
}

variable "name" { type = string }
variable "region" { type = string }
variable "account_id" { type = string }
variable "kms_key_arn" { type = string }
variable "boundary_arn" { type = string }
variable "lambda_dist" {
  type        = string
  description = "backend/dist/lambda, built by `python3 backend/scripts/build_lambdas.py` before plan (one Python package, folder app/)."
}
variable "ledger_table" { type = string }
variable "ledger_arn" { type = string }
variable "connections_table" { type = string }
variable "connections_arn" { type = string }
variable "bus_name" { type = string }
variable "bus_arn" { type = string }
variable "queue_urls" { type = map(string) }
variable "queue_arns" { type = map(string) }
variable "apns_enabled" {
  type        = bool
  default     = false
  description = "Whether modules/notifications created the APNs platform applications (their ARNs follow from the name)."
}
variable "user_pool_id" { type = string }
variable "user_pool_arn" { type = string }
variable "owner_email" { type = string }
variable "user_pool_endpoint" { type = string }
variable "client_id" { type = string }
variable "app_origin" { type = string }
variable "runtime_arns" { type = map(string) }
variable "queues_enabled" {
  type        = bool
  default     = true
  description = "Whether the four SQS triggers run. false = the city is switched off until the owner turns it on."
}
variable "vaic_role_name" {
  type        = string
  description = "VAIC's runtime role: it streams its reply straight to the HUD's WebSocket connections."
}
variable "runtime_version" {
  type        = string
  default     = ""
  description = "The agent image tag. Part of VAIC's session id, so a deploy reaches VAIC on its next message."
}
variable "utility_invoke_arns" { type = list(string) }
variable "utility_profile_arn" { type = string }
variable "chief_of_staff_invoke_arns" { type = list(string) }
variable "chief_of_staff_profile_arn" { type = string }
variable "executive_invoke_arns" { type = list(string) }
variable "executive_profile_arn" { type = string }
variable "profile_prefix" { type = string }
variable "knowledge_table" { type = string }
variable "knowledge_table_arn" { type = string }
variable "knowledge_bucket" { type = string }
variable "knowledge_bucket_arn" { type = string }
variable "knowledge_base_id" { type = string }
variable "knowledge_base_arn" { type = string }
variable "knowledge_data_source_id" { type = string }
variable "knowledge_graph_id" { type = string }
variable "knowledge_graph_arn" { type = string }
variable "log_retention_days" {
  type    = number
  default = 30
}
variable "api_env" {
  type        = map(string)
  default     = {}
  description = "Extra environment for the api Lambda (connectors, skills, mail)."
}
variable "app_bridge_env" {
  type        = map(string)
  default     = {}
  description = "Extra environment for the app-bridge Lambda: VAIC_GATEWAY_URL from the connectors module, so apps' granted connector reads reach the Gateway."
}
variable "workspaces_bucket" { type = string }
variable "workspaces_arn" { type = string }
variable "apps_bucket" { type = string }
variable "apps_bucket_arn" { type = string }
variable "apps_url" { type = string }
variable "apps_distribution_id" { type = string }
variable "apps_distribution_arn" { type = string }
variable "worker_queue_concurrency" {
  type    = number
  default = 50
}

locals {
  tags = { Component = "api" }
  common_env = {
    VAIC_REGION             = var.region
    VAIC_LEDGER_TABLE       = var.ledger_table
    VAIC_EVENT_BUS          = var.bus_name
    VAIC_QUEUE_VAIC         = var.queue_urls["vaic"]
    VAIC_QUEUE_ORCHESTRATOR = var.queue_urls["orchestrator"]
    VAIC_QUEUE_MANAGER      = var.queue_urls["manager"]
    VAIC_QUEUE_WORKER       = var.queue_urls["worker"]
    VAIC_PROFILE_PREFIX     = var.profile_prefix
  }
  # name => bundle, handler, timeout, memory, extra env
  functions = {
    api           = { bundle = "app", handler = "vaic.lambdas.api.handler", timeout = 30, memory = 1024, env = merge(local.apns_env, { VAIC_APP_PROFILE_UTILITY = var.utility_profile_arn, VAIC_USER_POOL_ID = var.user_pool_id, VAIC_OWNER_EMAIL = var.owner_email, KNOWLEDGE_TABLE = var.knowledge_table, KNOWLEDGE_BUCKET = var.knowledge_bucket, KNOWLEDGE_BASE_ID = var.knowledge_base_id, KNOWLEDGE_DATA_SOURCE_ID = var.knowledge_data_source_id, KNOWLEDGE_GRAPH_ID = var.knowledge_graph_id, VAIC_APPS_BUCKET = var.apps_bucket, VAIC_APPS_URL = var.apps_url, VAIC_APPS_DISTRIBUTION_ID = var.apps_distribution_id, VAIC_APP_BRIDGE_FUNCTION = local.app_bridge_name, VAIC_SCHEDULER_FUNCTION = local.scheduler_name, VAIC_RUNTIME_ARN_VAIC = var.runtime_arns["vaic"], VAIC_RUNTIME_VERSION = var.runtime_version }, var.api_env) }
    dispatcher    = { bundle = "app", handler = "vaic.lambdas.dispatcher.handler", timeout = 120, memory = 1024, env = { VAIC_RUNTIME_ARN_VAIC = var.runtime_arns["vaic"], VAIC_RUNTIME_ARN_ORCHESTRATOR = var.runtime_arns["orchestrator"], VAIC_RUNTIME_ARN_MANAGER = var.runtime_arns["manager"], VAIC_RUNTIME_ARN_WORKER = var.runtime_arns["worker"], VAIC_RUNTIME_VERSION = var.runtime_version, VAIC_WS_ENDPOINT = "https://${aws_apigatewayv2_api.ws.id}.execute-api.${var.region}.amazonaws.com/prod", VAIC_CONNECTIONS_TABLE = var.connections_table } }
    factory       = { bundle = "app", handler = "vaic.lambdas.factory.handler", timeout = 30, memory = 256, env = {} }
    ledger-writer = { bundle = "app", handler = "vaic.lambdas.ledger_writer.handler", timeout = 30, memory = 256, env = {} }
    scheduler     = { bundle = "app", handler = "vaic.lambdas.scheduler.handler", timeout = 120, memory = 256, env = merge({ VAIC_RUNTIME_ARN_VAIC = var.runtime_arns["vaic"], VAIC_RUNTIME_VERSION = var.runtime_version, VAIC_WS_ENDPOINT = "https://${aws_apigatewayv2_api.ws.id}.execute-api.${var.region}.amazonaws.com/prod", VAIC_CONNECTIONS_TABLE = var.connections_table }, local.scheduler_mail_env) }
    notifier      = { bundle = "app", handler = "vaic.lambdas.notifier.handler", timeout = 90, memory = 256, env = local.apns_env } # 90 s: a call rings up to 45 s before the message
    approvals     = { bundle = "app", handler = "vaic.lambdas.approvals.handler", timeout = 30, memory = 256, env = {} }
    # The executives (decision 140): only the optional scheduled reviews the owner switched on (all off by default).
    executives = { bundle = "app", handler = "vaic.lambdas.executives.handler", timeout = 600, memory = 256, env = { VAIC_APP_PROFILE_EXECUTIVE = var.executive_profile_arn } }
    # The Chief of Staff (decision 124): decides Needs you items; carries each out through the api (live alias).
    chief-of-staff = { bundle = "app", handler = "vaic.lambdas.chief_of_staff.handler", timeout = 300, memory = 256, env = { VAIC_APP_PROFILE_CHIEF_OF_STAFF = var.chief_of_staff_profile_arn, VAIC_API_FUNCTION = "${local.api_name}:live" } }
    ws-authorizer  = { bundle = "app", handler = "vaic.lambdas.ws.authorizer_handler", timeout = 10, memory = 256, env = { VAIC_USER_POOL_ID = var.user_pool_id, VAIC_USER_POOL_CLIENT_ID = var.client_id } }
    ws-connection  = { bundle = "app", handler = "vaic.lambdas.ws.connection_handler", timeout = 10, memory = 256, env = { VAIC_CONNECTIONS_TABLE = var.connections_table } }
    apps           = { bundle = "app", handler = "vaic.lambdas.apps.handler", timeout = 120, memory = 512, env = { VAIC_APPS_BUCKET = var.apps_bucket, VAIC_APPS_URL = var.apps_url, VAIC_WORKSPACES_BUCKET = var.workspaces_bucket } }
    app-bridge     = { bundle = "app", handler = "vaic.lambdas.app_bridge.handler", timeout = 25, memory = 512, env = var.app_bridge_env }
    ws-broadcast   = { bundle = "app", handler = "vaic.lambdas.ws.broadcast_handler", timeout = 30, memory = 256, env = { VAIC_CONNECTIONS_TABLE = var.connections_table, VAIC_WS_ENDPOINT = "https://${aws_apigatewayv2_api.ws.id}.execute-api.${var.region}.amazonaws.com/prod" } }
  }
  # Named, not referenced: the api function's env and policy name it, and both live in the same for_each.
  app_bridge_name = "${var.name}-app-bridge"
  api_name        = "${var.name}-api"
  scheduler_name  = "${var.name}-scheduler"
  # The calendar import (job calendar_import) reads mail accounts the way the api does; its read path is attached
  # by the mail module (docs/MAIL_CALENDAR.md §12).
  scheduler_mail_env = { for k in ["VAIC_MAIL_WORKLOAD", "VAIC_MAIL_PROVIDERS"] : k => var.api_env[k] if contains(keys(var.api_env), k) }
  apps_tagged        = ["apps", "app-bridge"]
  ledger_rw          = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:ConditionCheckItem"]
  # What each function may do, beyond logs, tracing and the KMS key.
  permissions = {
    api = [
      { Action = local.ledger_rw, Resource = [var.ledger_arn, "${var.ledger_arn}/index/*"] },
      { Action = ["events:PutEvents"], Resource = [var.bus_arn] },
      { Action = ["sqs:SendMessage"], Resource = values(var.queue_arns) },
      # The owner's "start over" (POST /city/reset): read every key, delete the city's work in batches, purge the queues.
      { Action = ["dynamodb:Scan", "dynamodb:BatchWriteItem"], Resource = [var.ledger_arn] },
      { Action = ["sqs:PurgeQueue"], Resource = values(var.queue_arns) },
      { Action = ["states:SendTaskSuccess", "states:SendTaskFailure"], Resource = [aws_sfn_state_machine.approval.arn] },
      { Action = ["bedrock:InvokeModel"], Resource = var.utility_invoke_arns },
      # VAIC's real-time voice (decision 120): signs the browser's WebSocket address to VAIC's runtime only.
      { Action = ["bedrock-agentcore:InvokeAgentRuntimeWithWebSocketStream"], Resource = [var.runtime_arns["vaic"], "${var.runtime_arns["vaic"]}/*"] },
      # "Send me a new first-login email": re-sends the owner's invitation, nothing else.
      { Action = ["cognito-idp:AdminCreateUser"], Resource = [var.user_pool_arn] },
      # The knowledge base (docs/KNOWLEDGE.md section 9): items, presigned uploads (single and multipart) under raw/,
      # scope changes rewrite normalized/…metadata.json, deletes remove the item's files, then a re-sync.
      { Action = local.ledger_rw, Resource = [var.knowledge_table_arn, "${var.knowledge_table_arn}/index/*"] },
      { Action = ["dynamodb:BatchWriteItem", "dynamodb:BatchGetItem"], Resource = [var.knowledge_table_arn] },
      { Action = ["s3:PutObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts", "s3:DeleteObject"], Resource = ["${var.knowledge_bucket_arn}/raw/*"] },
      { Action = ["s3:PutObject", "s3:DeleteObject"], Resource = ["${var.knowledge_bucket_arn}/normalized/*"] },
      { Action = ["s3:DeleteObject"], Resource = ["${var.knowledge_bucket_arn}/work/*"] },
      # Download (the owner's, 2026-11-11): presigned GETs of an upload's original and the built-in guide's PDF, and
      # of a department entry's file, written under downloads/ (expires after a day) on each request.
      # A link's download is the page text it saved under normalized/ (decision 270).
      { Action = ["s3:GetObject"], Resource = ["${var.knowledge_bucket_arn}/raw/*", "${var.knowledge_bucket_arn}/normalized/*"] },
      # A department's zip (decision 268) is uploaded with the managed upload, which goes multipart when large.
      { Action = ["s3:PutObject", "s3:GetObject", "s3:AbortMultipartUpload"], Resource = ["${var.knowledge_bucket_arn}/downloads/*"] },
      { Action = ["s3:ListBucket"], Resource = [var.knowledge_bucket_arn], Condition = { StringLike = { "s3:prefix" = ["raw/*", "work/*", "normalized/*"] } } },
      { Action = ["bedrock:StartIngestionJob", "bedrock:IngestKnowledgeBaseDocuments", "bedrock:GetKnowledgeBaseDocuments", "bedrock:ListKnowledgeBaseDocuments", "bedrock:DeleteKnowledgeBaseDocuments"], Resource = [var.knowledge_base_arn] },
      { Action = ["neptune-graph:ReadDataViaQuery", "neptune-graph:WriteDataViaQuery", "neptune-graph:DeleteDataViaQuery"], Resource = [var.knowledge_graph_arn] },
      # Publishing an approved app (drafts/ → live/) and removing one; only the owner reaches these routes.
      { Action = ["s3:GetObject"], Resource = ["${var.apps_bucket_arn}/drafts/*"] },
      { Action = ["s3:ListBucket"], Resource = [var.apps_bucket_arn], Condition = { StringLike = { "s3:prefix" = ["drafts/*", "live/*"] } } },
      { Action = ["s3:PutObject", "s3:DeleteObject"], Resource = ["${var.apps_bucket_arn}/live/*"] },
      { Action = ["cloudfront:CreateInvalidation"], Resource = [var.apps_distribution_arn] },
      # Apps' data reads run only in the app-bridge Lambda; the api role itself gets no Gateway access.
      { Action = ["lambda:InvokeFunction"], Resource = ["arn:aws:lambda:${var.region}:${var.account_id}:function:${local.app_bridge_name}"] },
    ]
    # Runs an app's granted read (docs/APPS.md v2). Invoked only by the api role. Reads the app's grants, the
    # connector list and the mail account rows; writes only its rate counters and the audit rows of agent app-<id>.
    # Its Gateway access (InvokeGateway, this gateway only) is attached by the connectors module, and its mail and
    # calendar read path (tokens per account, app passwords) by the mail module, from those modules' own ARNs.
    app-bridge = [
      { Action = ["dynamodb:GetItem", "dynamodb:Query"], Resource = [var.ledger_arn], Condition = { "ForAllValues:StringEquals" = { "dynamodb:LeadingKeys" = ["APPS", "CONNECTORS", "MAIL"] } } },
      { Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"], Resource = [var.ledger_arn], Condition = { "ForAllValues:StringLike" = { "dynamodb:LeadingKeys" = ["RATE#app-*", "TOOL#app-*"] } } },
    ]
    # Checks a worker's submission and stages it as a draft. Never live/, never another ledger key.
    apps = [
      { Action = ["s3:GetObject"], Resource = ["${var.workspaces_arn}/hires/*/app/*"] },
      { Action = ["s3:ListBucket"], Resource = [var.workspaces_arn], Condition = { StringLike = { "s3:prefix" = ["hires/*/app/*"] } } },
      { Action = ["s3:PutObject"], Resource = ["${var.apps_bucket_arn}/drafts/*"] },
      { Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"], Resource = [var.ledger_arn], Condition = { "ForAllValues:StringEquals" = { "dynamodb:LeadingKeys" = ["APPDRAFTS"] } } },
      { Action = ["events:PutEvents"], Resource = [var.bus_arn] },
      { Action = ["sqs:SendMessage"], Resource = [aws_sqs_queue.apps_dlq.arn] },
    ]
    dispatcher = [
      { Action = local.ledger_rw, Resource = [var.ledger_arn, "${var.ledger_arn}/index/*"] },
      { Action = ["events:PutEvents"], Resource = [var.bus_arn] },
      { Action = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"], Resource = values(var.queue_arns) },
      { Action = ["bedrock-agentcore:InvokeAgentRuntime"], Resource = concat(values(var.runtime_arns), [for a in values(var.runtime_arns) : "${a}/*"]) },
    ]
    factory       = [{ Action = local.ledger_rw, Resource = [var.ledger_arn, "${var.ledger_arn}/index/*"] }, { Action = ["events:PutEvents"], Resource = [var.bus_arn] }]
    ledger-writer = [{ Action = ["dynamodb:PutItem"], Resource = [var.ledger_arn] }]
    scheduler = [
      { Action = local.ledger_rw, Resource = [var.ledger_arn, "${var.ledger_arn}/index/*"] },
      # The calendar import removes events that are gone in one batch (features/calendar.py).
      { Action = ["dynamodb:BatchWriteItem"], Resource = [var.ledger_arn] },
      { Action = ["events:PutEvents"], Resource = [var.bus_arn] },
      { Action = ["sqs:SendMessage"], Resource = values(var.queue_arns) },
      # warm_vaic: the "warm" ping to VAIC's runtime only (never the other roles).
      { Action = ["bedrock-agentcore:InvokeAgentRuntime"], Resource = [var.runtime_arns["vaic"], "${var.runtime_arns["vaic"]}/*"] },
    ]
    # Reads the inbox, the jobs and the owner's notes; writes only its own marks, turns and claims. Calls its model, and
    # the api's live alias, which carries each decision out exactly as the owner's click does.
    chief-of-staff = [
      { Action = local.ledger_rw, Resource = [var.ledger_arn, "${var.ledger_arn}/index/*"] },
      { Action = ["events:PutEvents"], Resource = [var.bus_arn] },
      { Action = ["bedrock:InvokeModel"], Resource = var.chief_of_staff_invoke_arns },
      { Action = ["lambda:InvokeFunction"], Resource = ["arn:aws:lambda:${var.region}:${var.account_id}:function:${local.api_name}:live"] },
    ]
    # Reads the city's records, writes its recommendations and VAIC's chat line, calls its model. Starts no work: no
    # queues, no runtimes, no other function.
    executives = [
      { Action = local.ledger_rw, Resource = [var.ledger_arn, "${var.ledger_arn}/index/*"] },
      { Action = ["events:PutEvents"], Resource = [var.bus_arn] },
      { Action = ["bedrock:InvokeModel"], Resource = var.executive_invoke_arns },
    ]
    notifier = [{ Action = local.ledger_rw, Resource = [var.ledger_arn, "${var.ledger_arn}/index/*"] }] # push rights: modules/notifications
    approvals = [
      { Action = local.ledger_rw, Resource = [var.ledger_arn, "${var.ledger_arn}/index/*"] },
      # An approval nobody answered in time closes its card (approval.withdrawn).
      { Action = ["events:PutEvents"], Resource = [var.bus_arn] },
      { Action = ["sqs:SendMessage"], Resource = values(var.queue_arns) },
      # An approval decided before its token was stored (decision 125): this function sends the result itself.
      # Named, not referenced: the state machine already depends on this function.
      { Action = ["states:SendTaskSuccess", "states:SendTaskFailure"], Resource = ["arn:aws:states:${var.region}:${var.account_id}:stateMachine:${var.name}-approval"] },
    ]
    ws-authorizer = [{ Action = ["cognito-idp:DescribeUserPool"], Resource = ["arn:aws:cognito-idp:${var.region}:${var.account_id}:userpool/${var.user_pool_id}"] }]
    ws-connection = [{ Action = ["dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:UpdateItem"], Resource = [var.connections_arn] }]
    ws-broadcast = [
      { Action = ["dynamodb:Query", "dynamodb:DeleteItem"], Resource = [var.connections_arn, "${var.connections_arn}/index/*"] },
      { Action = ["execute-api:ManageConnections"], Resource = ["arn:aws:execute-api:${var.region}:${var.account_id}:${aws_apigatewayv2_api.ws.id}/prod/POST/@connections/*"] },
    ]
  }
  routes = [
    "GET /city", "GET /city/agent", "POST /city/instruct", "POST /messages", "POST /wake-check", "GET /tickets", "GET /tickets/{id}", "GET /jobs",
    "GET /departments", "POST /departments", "DELETE /departments/{id}", "GET /departments/presets", "GET /departments/choices", "POST /departments/recommend", "GET /agents", "GET /workforce", "GET /costs", "GET /health", "GET /questions", "POST /questions/{id}/answer",
    "POST /questions/{id}/default", "POST /approvals/{id}", "GET /settings", "PUT /settings", "GET /chief-of-staff",
    # Autopilot (decision 125): while the owner is away.
    "GET /away-summary", "GET /support-tickets", "GET /deals", "GET /company", "PUT /company", "DELETE /company", "GET /executives", "PUT /executives", "GET /standing-orders", "POST /standing-orders", "PUT /standing-orders/{id}", "DELETE /standing-orders/{id}",
    # AI workflows (decision 126): the walkthrough's pages, its mode and Stop.
    "GET /workflows", "GET /workflows/runs/{id}", "POST /workflows/runs/{id}/step",
    "POST /workflows/runs/{id}/mode", "POST /workflows/runs/{id}/cancel",
    # Taste questions (decision 127): asked along the way, answered from the card, never waited on.
    "GET /workflows/taste", "POST /workflows/taste/{id}",
    "POST /workers/home", "POST /tasks/{id}/cancel", "POST /messages/{id}/stop", "POST /city/reset", "POST /agents/{id}/home",
    "GET /memory", "POST /notes", "GET /apps", "DELETE /apps/{id}", "PUT /apps/{id}",
    "POST /apps/{id}/bridge", "POST /apps/{id}/proposals", "POST /apps/{id}/rollback", "GET /apps/{id}/activity",
    "GET /knowledge", "GET /knowledge/{id}", "POST /knowledge/uploads", "POST /knowledge/uploads/{id}/complete", "POST /knowledge/links",
    "POST /knowledge/text", "PUT /knowledge/{id}", "DELETE /knowledge/{id}",
    # Department knowledge entries (docs/KNOWLEDGE.md section 17).
    "GET /knowledge/entries", "POST /knowledge/entries", "GET /knowledge/entries/{entry}", "PUT /knowledge/entries/{entry}",
    "DELETE /knowledge/entries/{entry}", "POST /knowledge/entries/{entry}/{verb}",
    # Download (decisions 246 and 268): an item's original or the guide, one entry, a department's whole knowledge.
    "GET /knowledge/{id}/download", "GET /knowledge/entries/{entry}/download", "GET /knowledge/departments/{dept}/download",
    # Files (docs/FILES.md §7): the owner's storage; uploads and downloads go straight to S3, presigned.
    "GET /files", "GET /files/{id}", "POST /files/uploads", "POST /files/uploads/{id}/complete", "PUT /files/{id}",
    "DELETE /files/{id}", "POST /files/{id}/retry",
    # Connectors (docs/CONNECTORS_SKILLS.md §1.7), skills (§2.4) and mail accounts (docs/MAIL_CALENDAR.md §4).
    "GET /connectors", "POST /connectors", "PUT /connectors/{id}", "DELETE /connectors/{id}", "POST /connectors/{id}/login",
    "POST /connectors/{id}/login/complete", "PUT /connectors/{id}/key", "POST /connectors/{id}/refresh",
    "GET /skills", "POST /skills", "GET /skills/{name}", "PUT /skills/{name}", "DELETE /skills/{name}",
    # Skills → Discover (decision 188): the bundled catalog, one skill with its SKILL.md, and adding one.
    "GET /skills/catalog", "GET /skills/catalog/{name}", "POST /skills/catalog/{name}",
    "GET /mail/accounts", "POST /mail/accounts", "PUT /mail/accounts/{id}", "DELETE /mail/accounts/{id}",
    "POST /mail/accounts/{id}/signin", "POST /mail/accounts/{id}/complete", "POST /mail/accounts/{id}/imap",
    "GET /mail/rules", "POST /mail/rules", "DELETE /mail/rules/{id}",
    # City → Features and the owner's calendar (docs/MAIL_CALENDAR.md §12): read-only for meetings.
    "GET /features", "PUT /features/{id}", "GET /calendar/events", "POST /calendar/refresh",
    # iPhone notifications (docs/NOTIFICATIONS.md): the owner's phones and the Apple key.
    "GET /devices", "POST /devices", "DELETE /devices/{id}", "GET /notifications/apns", "PUT /notifications/apns",
    # VAIC calls the owner's iPhone (decision 245): the phone reports a call answered, missed or ended.
    "GET /calls/{id}", "POST /calls/{id}/answered", "POST /calls/{id}/missed", "POST /calls/{id}/ended",
    # VAIC's voice through OpenAI text-to-speech (docs/VOICE.md): the key the owner pastes, and the speech itself.
    "POST /speech", "GET /voice/openai", "PUT /voice/openai-key",
    # The owner's GitHub token (docs/GITHUB_ACCESS.md): who it belongs to, store it, remove it.
    "GET /github", "PUT /github/token", "DELETE /github/token",
    # VAIC's real-time voice (decision 120): a five-minute signed address to VAIC's own runtime.
    "POST /voice/session",
    # VAIC's real-time voice on OpenAI GPT-Live (decision 128): the browser's WebRTC offer in, the answer out.
    "POST /voice/live",
    # Why the browser's voice WebSocket was refused: the API repeats the handshake and reports AWS's answer.
    "POST /voice/check",
  ]
  queue_batch = { vaic = 1, orchestrator = 5, manager = 5, worker = 10 }
  queue_conc  = { vaic = 5, orchestrator = 10, manager = 20, worker = var.worker_queue_concurrency }
  # Enabled: the crash sweep, idle-agent retirement, reminders and nudges are part of the product (the owner
  # asked for everything to run). The weekly self-improvement job stays DISABLED by rule.
  # The APNs platform applications live in modules/notifications under names that follow from ours, so the
  # functions can be told their ARNs without a dependency cycle; empty until the owner's key is deployed.
  apns_env = {
    VAIC_APNS_ARN         = var.apns_enabled ? "arn:aws:sns:${var.region}:${var.account_id}:app/APNS/${var.name}-apns" : ""
    VAIC_APNS_SANDBOX_ARN = var.apns_enabled ? "arn:aws:sns:${var.region}:${var.account_id}:app/APNS_SANDBOX/${var.name}-apns-sandbox" : ""
    # VAIC's calls (decision 245): PushKit VoIP pushes ring the AI City app as an incoming call.
    VAIC_APNS_VOIP_ARN         = var.apns_enabled ? "arn:aws:sns:${var.region}:${var.account_id}:app/APNS_VOIP/${var.name}-apns-voip" : ""
    VAIC_APNS_VOIP_SANDBOX_ARN = var.apns_enabled ? "arn:aws:sns:${var.region}:${var.account_id}:app/APNS_VOIP_SANDBOX/${var.name}-apns-voip-sandbox" : ""
    VAIC_APNS_SECRET           = "vaic/prod/apns"
  }
  jobs = {
    sweep       = { schedule = "rate(5 minutes)", fn = "scheduler", input = { job = "sweep" }, state = "ENABLED" }
    retire-idle = { schedule = "rate(1 hour)", fn = "scheduler", input = { job = "retire_idle" }, state = "ENABLED" }
    reminders   = { schedule = "rate(5 minutes)", fn = "scheduler", input = { job = "reminders" }, state = "ENABLED" }
    improve     = { schedule = "cron(0 3 ? * SUN *)", fn = "scheduler", input = { job = "improve" } }
    # Enabled from the start: keeps VAIC's container running so a message never waits for a cold start
    # (AgentCore bills active processing only, so a warm idle container costs nothing). The owner's under-3-seconds target.
    warm-vaic = { schedule = "rate(2 minutes)", fn = "scheduler", input = { job = "warm_vaic" }, state = "ENABLED" }
    # The owner's calendar: every connected account read every 15 minutes (skipped when the feature is off).
    calendar-import = { schedule = "rate(15 minutes)", fn = "scheduler", input = { job = "calendar_import" }, state = "ENABLED" }
    # The Chief of Staff (decision 124): a sweep for anything still undecided, and the daily digest (18:00 Stockholm, winter).
    chief-sweep = { schedule = "rate(5 minutes)", fn = "chief-of-staff", input = { job = "sweep" }, state = "ENABLED" }
    # Standing orders (decision 125): each due order starts one job for its department.
    standing-orders = { schedule = "rate(5 minutes)", fn = "scheduler", input = { job = "standing_orders" }, state = "ENABLED" }
    chief-digest    = { schedule = "cron(0 17 * * ? *)", fn = "chief-of-staff", input = { job = "digest" }, state = "ENABLED" }
    # Decision 140: runs only the reviews the owner switched on, each when due; with all off it reads one record.
    executive-reviews = { schedule = "rate(1 hour)", fn = "executives", input = { job = "reviews" }, state = "ENABLED" }
  }
}

data "archive_file" "bundle" {
  # Every function runs the one "app" bundle. A literal set keeps the zip independent of the functions' settings, so
  # other modules can build from it and feed the api's env (Files' preview signing key, decision 156) without a cycle.
  for_each    = toset(["app"])
  type        = "zip"
  source_dir  = "${var.lambda_dist}/${each.key}"
  output_path = "${path.root}/.build/${each.key}.zip"
}

# The bundle goes to S3 once and every function's code points at that object. With a local `filename` the AWS
# provider updates one function at a time (it holds a lock while it uploads each zip): ~12 s per function, three
# minutes a deploy. From S3 they all update in parallel. The repository is public, so S3-managed keys suffice.
resource "aws_s3_bucket" "code" {
  #checkov:skip=CKV_AWS_145:The Lambda package is built from this public repository; S3-managed encryption is enough.
  #checkov:skip=CKV_AWS_144:Rebuilt by every deploy; a replica is not needed.
  #checkov:skip=CKV_AWS_18:Access logging would need another bucket; only the deploy role writes here.
  #checkov:skip=CKV2_AWS_62:No event notifications are needed.
  bucket        = "${var.name}-lambda-code-${var.account_id}"
  force_destroy = true # nothing but rebuildable packages
  tags          = local.tags
}

resource "aws_s3_bucket_versioning" "code" {
  bucket = aws_s3_bucket.code.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "code" {
  bucket = aws_s3_bucket.code.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "code" {
  bucket                  = aws_s3_bucket.code.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "code" {
  bucket     = aws_s3_bucket.code.id
  depends_on = [aws_s3_bucket_versioning.code]
  rule {
    id     = "old-packages"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 14
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

resource "aws_s3_bucket_policy" "code" {
  bucket = aws_s3_bucket.code.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "TlsOnly"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.code.arn, "${aws_s3_bucket.code.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

resource "aws_s3_object" "bundle" {
  for_each    = data.archive_file.bundle
  bucket      = aws_s3_bucket.code.id
  key         = "lambda/${each.key}.zip"
  source      = each.value.output_path
  source_hash = each.value.output_base64sha256
  depends_on  = [aws_s3_bucket_versioning.code, aws_s3_bucket_server_side_encryption_configuration.code, aws_s3_bucket_policy.code]
  tags        = local.tags
}

resource "aws_cloudwatch_log_group" "fn" {
  #checkov:skip=CKV_AWS_338:Retention is the log_retention_days variable (30 days by default) to keep cost low; the ledger keeps the durable record.
  for_each          = local.functions
  name              = "/aws/lambda/${var.name}-${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn
  tags              = contains(local.apps_tagged, each.key) ? { Component = "apps" } : local.tags
}

resource "aws_iam_role" "fn" {
  for_each             = local.functions
  name                 = "${var.name}-fn-${each.key}"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
  tags = contains(local.apps_tagged, each.key) ? { Component = "apps" } : local.tags
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
  #checkov:skip=CKV_AWS_117:No VPC: the functions call only AWS APIs, and a VPC would add NAT cost.
  #checkov:skip=CKV_AWS_272:Code signing is not set up for a single-owner project; deploys run from the owner's approved workflow.
  #checkov:skip=CKV_AWS_116:Synchronous and SQS/EventBridge-invoked functions; failed SQS work goes to the queues' DLQs.
  for_each          = local.functions
  function_name     = "${var.name}-${each.key}"
  role              = aws_iam_role.fn[each.key].arn
  runtime           = "python3.13"
  architectures     = ["arm64"]
  handler           = each.value.handler
  s3_bucket         = aws_s3_object.bundle[each.value.bundle].bucket
  s3_key            = aws_s3_object.bundle[each.value.bundle].key
  s3_object_version = aws_s3_object.bundle[each.value.bundle].version_id
  source_code_hash  = data.archive_file.bundle[each.value.bundle].output_base64sha256
  timeout           = each.value.timeout
  memory_size       = each.value.memory
  # SnapStart (api only, docs/KNOWLEDGE.md section 14): each deploy publishes a version and snapshots its init;
  # API Gateway calls the `live` alias. Python 3.12+ SnapStart supports arm64.
  # The dispatcher and ws-broadcast are always on instead (provisioned concurrency on a `live` alias, below), so
  # the owner's message never waits for a Lambda cold start on its way to VAIC or back to the HUD.
  publish = contains(["api", "dispatcher", "ws-broadcast"], each.key)
  dynamic "snap_start" {
    for_each = each.key == "api" ? [1] : []
    content {
      apply_on = "PublishedVersions"
    }
  }
  kms_key_arn                    = var.kms_key_arn
  reserved_concurrent_executions = each.key == "dispatcher" ? 200 : (each.key == "api" ? 50 : 20)
  tracing_config {
    mode = "Active"
  }
  # The apps function is invoked asynchronously by EventBridge; what still fails after retries lands here.
  dynamic "dead_letter_config" {
    for_each = each.key == "apps" ? [aws_sqs_queue.apps_dlq.arn] : []
    content {
      target_arn = dead_letter_config.value
    }
  }
  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.fn[each.key].name
  }
  environment {
    variables = merge(local.common_env, each.value.env)
  }
  tags = contains(local.apps_tagged, each.key) ? { Component = "apps" } : local.tags
}

# ---------- SQS → dispatcher ----------
# The owner's switch: with queues_enabled = false the four triggers stay off across deploys (nothing is
# picked up; queued work waits). The emergency brake turns them off by hand; this keeps them off.
resource "aws_lambda_event_source_mapping" "queue" {
  for_each                = var.queue_arns
  event_source_arn        = each.value
  enabled                 = var.queues_enabled
  function_name           = aws_lambda_alias.always_on["dispatcher"].arn # the always-on alias, never $LATEST
  batch_size              = local.queue_batch[each.key]
  function_response_types = ["ReportBatchItemFailures"]
  scaling_config {
    maximum_concurrency = local.queue_conc[each.key]
  }
  tags = local.tags
}

# ---------- HTTP API ----------
resource "aws_cloudwatch_log_group" "http" {
  #checkov:skip=CKV_AWS_338:Retention is the log_retention_days variable (30 days by default) to keep cost low; the ledger keeps the durable record.
  name              = "/aws/apigateway/${var.name}-http"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn
  tags              = local.tags
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.name}-http"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = [var.app_origin]
    allow_methods = ["GET", "POST", "PUT", "DELETE"]
    allow_headers = ["authorization", "content-type"]
    max_age       = 600
  }
  tags = local.tags
}

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.http.id
  name             = "cognito-owner"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  jwt_configuration {
    issuer   = "https://${var.user_pool_endpoint}"
    audience = [var.client_id]
  }
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_alias.api_live.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}

resource "aws_apigatewayv2_route" "http" {
  for_each           = toset(local.routes)
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = each.key
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# The one route that works before sign-in: it can only re-send the owner's first-login email (to the
# owner's own address, at most once every 10 minutes), so it needs no token.
resource "aws_apigatewayv2_route" "first_login_email" {
  #checkov:skip=CKV_AWS_309:Public on purpose: it only re-sends the owner's invitation to the owner's own email, rate-limited in the Lambda.
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST /auth/first-login-email"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_stage" "http" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = 50
    throttling_rate_limit  = 20
  }
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.http.arn
    format          = jsonencode({ requestId = "$context.requestId", route = "$context.routeKey", status = "$context.status", latency = "$context.responseLatency", authError = "$context.authorizer.error" })
  }
  tags = local.tags
}

# The HTTP API calls this alias, so it always runs the latest published (snapshotted) version.
resource "aws_lambda_alias" "api_live" {
  name             = "live"
  description      = "Latest published api version (SnapStart)"
  function_name    = aws_lambda_function.fn["api"].function_name
  function_version = aws_lambda_function.fn["api"].version
}

# Always on (the owner's under-3-seconds target): one warm copy each of the dispatcher (SQS → VAIC's runtime) and
# ws-broadcast (events → the HUD). Each deploy publishes a version, the `live` alias moves to it, and provisioned
# concurrency keeps one initialized environment ready. About $11/month for the dispatcher's 1 GB and $3/month
# for ws-broadcast's 256 MB. SnapStart stays on the api function only; the two don't combine.
resource "aws_lambda_alias" "always_on" {
  for_each         = toset(["dispatcher", "ws-broadcast"])
  name             = "live"
  description      = "Latest published version, kept warm"
  function_name    = aws_lambda_function.fn[each.key].function_name
  function_version = aws_lambda_function.fn[each.key].version
}

resource "aws_lambda_provisioned_concurrency_config" "always_on" {
  for_each                          = aws_lambda_alias.always_on
  function_name                     = each.value.function_name
  qualifier                         = each.value.name
  provisioned_concurrent_executions = 1
}

resource "aws_lambda_permission" "http" {
  statement_id  = "http-api"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn["api"].function_name
  qualifier     = aws_lambda_alias.api_live.name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ---------- WebSocket API ----------
resource "aws_apigatewayv2_api" "ws" {
  name                       = "${var.name}-ws"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
  tags                       = local.tags
}

resource "aws_apigatewayv2_authorizer" "ws" {
  api_id           = aws_apigatewayv2_api.ws.id
  name             = "cognito-owner"
  authorizer_type  = "REQUEST"
  authorizer_uri   = aws_lambda_function.fn["ws-authorizer"].invoke_arn
  identity_sources = ["route.request.querystring.token"]
}

resource "aws_apigatewayv2_integration" "ws" {
  api_id           = aws_apigatewayv2_api.ws.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.fn["ws-connection"].invoke_arn
}

resource "aws_apigatewayv2_route" "ws_connect" {
  #checkov:skip=CKV_AWS_309:$connect uses the Lambda authorizer below; this check expects one on every route, but WebSocket authorizers apply only to $connect.
  api_id             = aws_apigatewayv2_api.ws.id
  route_key          = "$connect"
  target             = "integrations/${aws_apigatewayv2_integration.ws.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.ws.id
}

resource "aws_apigatewayv2_route" "ws_other" {
  #checkov:skip=CKV_AWS_309:Only $connect can carry an authorizer on a WebSocket API; these routes run on the already-authorized connection.
  for_each  = toset(["$disconnect", "$default"])
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.ws.id}"
}

resource "aws_apigatewayv2_stage" "ws" {
  #checkov:skip=CKV2_AWS_51:Browsers cannot present client certificates; $connect is authorized with the owner's Cognito token.
  #checkov:skip=CKV_AWS_76:WebSocket stage logging needs the account-wide API Gateway CloudWatch role, which this shared account does not set; the WebSocket Lambdas log every connect, message and broadcast.
  api_id      = aws_apigatewayv2_api.ws.id
  name        = "prod"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = 50
    throttling_rate_limit  = 20
  }
  # No stage access logs: on WebSocket APIs they need the account-wide API Gateway CloudWatch role
  # (aws_api_gateway_account), an account singleton this project should not own in a shared account.
  tags = local.tags
}

resource "aws_lambda_permission" "ws" {
  for_each      = toset(["ws-authorizer", "ws-connection"])
  statement_id  = "ws-api"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.ws.execution_arn}/*"
}

# ---------- EventBridge rules ----------
resource "aws_cloudwatch_event_rule" "all" {
  name           = "${var.name}-city-events"
  event_bus_name = var.bus_name
  event_pattern  = jsonencode({ source = ["vaic.city"] })
  tags           = local.tags
}

resource "aws_cloudwatch_event_target" "all" {
  for_each       = toset(["ws-broadcast", "ledger-writer"])
  rule           = aws_cloudwatch_event_rule.all.name
  event_bus_name = var.bus_name
  target_id      = each.key
  arn            = each.key == "ws-broadcast" ? aws_lambda_alias.always_on["ws-broadcast"].arn : aws_lambda_function.fn[each.key].arn
}

resource "aws_cloudwatch_event_rule" "notify" {
  name           = "${var.name}-notify"
  event_bus_name = var.bus_name
  event_pattern  = jsonencode({ source = ["vaic.city"], "detail-type" = ["ticket.status"], detail = { ticket = { kind = ["task"], status = ["done", "failed", "cancelled"] } } })
  tags           = local.tags
}

resource "aws_cloudwatch_event_target" "notify" {
  rule           = aws_cloudwatch_event_rule.notify.name
  event_bus_name = var.bus_name
  target_id      = "notifier"
  arn            = aws_lambda_function.fn["notifier"].arn
}

# VAIC calls the owner (decision 245): an ad spend approval (decision 240) or the owner's "call me" → the notifier
# rings the iPhone once and sends one message only if the call isn't answered.
resource "aws_cloudwatch_event_rule" "call" {
  name           = "${var.name}-call-owner"
  event_bus_name = var.bus_name
  event_pattern = jsonencode({
    source = ["vaic.city"]
    "$or" = [
      { "detail-type" = ["approval.requested"], detail = { kind = ["ad.spend"] } },
      { "detail-type" = ["call.requested"] },
    ]
  })
  tags = local.tags
}

resource "aws_cloudwatch_event_target" "call" {
  rule           = aws_cloudwatch_event_rule.call.name
  event_bus_name = var.bus_name
  target_id      = "notifier"
  arn            = aws_lambda_function.fn["notifier"].arn
}

resource "aws_lambda_permission" "call" {
  statement_id  = "call-owner"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn["notifier"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.call.arn
}

# A worker's submit_app → the apps function (validate, stage drafts/, write the draft, put app.draft).
resource "aws_cloudwatch_event_rule" "app_submitted" {
  name           = "${var.name}-app-submitted"
  event_bus_name = var.bus_name
  event_pattern  = jsonencode({ source = ["vaic.city"], "detail-type" = ["app.submitted"] })
  tags           = { Component = "apps" }
}

resource "aws_cloudwatch_event_target" "app_submitted" {
  rule           = aws_cloudwatch_event_rule.app_submitted.name
  event_bus_name = var.bus_name
  target_id      = "apps"
  arn            = aws_lambda_function.fn["apps"].arn
  retry_policy {
    maximum_retry_attempts       = 3
    maximum_event_age_in_seconds = 3600
  }
  dead_letter_config {
    arn = aws_sqs_queue.apps_dlq.arn
  }
}

resource "aws_sqs_queue" "apps_dlq" {
  # SSE-SQS rather than the data key: EventBridge delivers failed events here, and the events carry
  # only file names and sizes, no owner data.
  name                      = "${var.name}-apps-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
  tags                      = { Component = "apps" }
}

resource "aws_sqs_queue_policy" "apps_dlq" {
  queue_url = aws_sqs_queue.apps_dlq.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EventBridgeDeadLetters"
        Effect    = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.apps_dlq.arn
        Condition = { ArnEquals = { "aws:SourceArn" = aws_cloudwatch_event_rule.app_submitted.arn } }
      },
      {
        Sid       = "TlsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "sqs:*"
        Resource  = aws_sqs_queue.apps_dlq.arn
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      },
    ]
  })
}

resource "aws_lambda_function_event_invoke_config" "apps" {
  function_name                = aws_lambda_function.fn["apps"].function_name
  maximum_retry_attempts       = 2
  maximum_event_age_in_seconds = 3600
}

resource "aws_lambda_permission" "events" {
  for_each      = { ws-broadcast = aws_cloudwatch_event_rule.all.arn, ledger-writer = aws_cloudwatch_event_rule.all.arn, notifier = aws_cloudwatch_event_rule.notify.arn, apps = aws_cloudwatch_event_rule.app_submitted.arn }
  statement_id  = "events"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn[each.key].function_name
  qualifier     = each.key == "ws-broadcast" ? aws_lambda_alias.always_on["ws-broadcast"].name : null
  principal     = "events.amazonaws.com"
  source_arn    = each.value
}

# ---------- approvals: Step Functions with a task token ----------
resource "aws_cloudwatch_log_group" "sfn" {
  #checkov:skip=CKV_AWS_338:Retention is the log_retention_days variable (30 days by default) to keep cost low; the ledger keeps the durable record.
  name              = "/aws/vendedlogs/states/${var.name}-approval"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn
  tags              = local.tags
}

resource "aws_iam_role" "sfn" {
  name                 = "${var.name}-sfn-approval"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "states.amazonaws.com" }, Action = "sts:AssumeRole", Condition = { StringEquals = { "aws:SourceAccount" = var.account_id } } }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "sfn" {
  name = "approval"
  role = aws_iam_role.sfn.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = [aws_lambda_function.fn["approvals"].arn] },
      { Effect = "Allow", Action = ["logs:CreateLogDelivery", "logs:GetLogDelivery", "logs:UpdateLogDelivery", "logs:DeleteLogDelivery", "logs:ListLogDeliveries", "logs:PutResourcePolicy", "logs:DescribeResourcePolicies", "logs:DescribeLogGroups"], Resource = "*" },
      { Effect = "Allow", Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords", "xray:GetSamplingRules", "xray:GetSamplingTargets"], Resource = "*" },
      { Effect = "Allow", Action = ["kms:Decrypt", "kms:GenerateDataKey"], Resource = var.kms_key_arn },
    ]
  })
}

resource "aws_sfn_state_machine" "approval" {
  #checkov:skip=CKV_AWS_285:All events are logged (level ALL) but without execution data, because approvals name the exact action an agent wants to run.
  name     = "${var.name}-approval"
  role_arn = aws_iam_role.sfn.arn
  type     = "STANDARD"
  definition = jsonencode({
    Comment = "Wait for the owner's decision on one exact action, then wake the agent."
    StartAt = "WaitForOwner"
    States = {
      WaitForOwner = {
        Type           = "Task"
        Resource       = "arn:aws:states:::lambda:invoke.waitForTaskToken"
        Parameters     = { FunctionName = aws_lambda_function.fn["approvals"].arn, Payload = { step = "store_token", "approvalId.$" = "$.detail.id", "taskToken.$" = "$$.Task.Token" } }
        TimeoutSeconds = 86400
        ResultPath     = "$.decision"
        Catch          = [{ ErrorEquals = ["States.ALL"], ResultPath = "$.error", Next = "Refused" }]
        Next           = "Approved"
      }
      Approved = { Type = "Task", Resource = "arn:aws:states:::lambda:invoke", Parameters = { FunctionName = aws_lambda_function.fn["approvals"].arn, Payload = { step = "resume", approved = true, "approvalId.$" = "$.detail.id" } }, End = true }
      Refused  = { Type = "Task", Resource = "arn:aws:states:::lambda:invoke", Parameters = { FunctionName = aws_lambda_function.fn["approvals"].arn, Payload = { step = "resume", approved = false, "approvalId.$" = "$.detail.id" } }, End = true }
    }
  })
  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.sfn.arn}:*"
    include_execution_data = false # approvals name actions; keep them out of logs
    level                  = "ALL"
  }
  tracing_configuration {
    enabled = true
  }
  encryption_configuration {
    type                              = "CUSTOMER_MANAGED_KMS_KEY"
    kms_key_id                        = var.kms_key_arn
    kms_data_key_reuse_period_seconds = 300
  }
  tags = local.tags
}

resource "aws_iam_role" "events_sfn" {
  name                 = "${var.name}-events-to-sfn"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "events.amazonaws.com" }, Action = "sts:AssumeRole", Condition = { StringEquals = { "aws:SourceAccount" = var.account_id } } }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "events_sfn" {
  name   = "start-approval"
  role   = aws_iam_role.events_sfn.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["states:StartExecution"], Resource = [aws_sfn_state_machine.approval.arn] }] })
}

resource "aws_cloudwatch_event_rule" "approval" {
  name           = "${var.name}-approval-requested"
  event_bus_name = var.bus_name
  event_pattern  = jsonencode({ source = ["vaic.city"], "detail-type" = ["approval.requested"] })
  tags           = local.tags
}

resource "aws_cloudwatch_event_target" "approval" {
  rule           = aws_cloudwatch_event_rule.approval.name
  event_bus_name = var.bus_name
  target_id      = "approval-workflow"
  arn            = aws_sfn_state_machine.approval.arn
  role_arn       = aws_iam_role.events_sfn.arn
}

# ---------- recurring jobs: classic EventBridge rules ----------
# EventBridge Scheduler could never invoke the Lambda in this account (every attempt a TargetError, with the
# role's policy simulating as allowed: an organisation-level refusal of role-based service invocations).
# The Chief of Staff decides each new question and approval the moment it is asked (decision 124).
resource "aws_cloudwatch_event_rule" "chief" {
  name           = "${var.name}-chief-of-staff"
  event_bus_name = var.bus_name
  event_pattern  = jsonencode({ source = ["vaic.city"], "detail-type" = ["question.asked", "approval.requested"] })
  tags           = local.tags
}

resource "aws_cloudwatch_event_target" "chief" {
  rule           = aws_cloudwatch_event_rule.chief.name
  event_bus_name = var.bus_name
  target_id      = "chief-of-staff"
  arn            = aws_lambda_function.fn["chief-of-staff"].arn
}

resource "aws_lambda_permission" "chief" {
  statement_id  = "chief-of-staff-events"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn["chief-of-staff"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.chief.arn
}

# Rules invoke through the function's resource policy, which works here (the city-event rules do).
resource "aws_cloudwatch_event_rule" "job" {
  for_each            = local.jobs
  name                = "${var.name}-${each.key}"
  schedule_expression = each.value.schedule
  state               = lookup(each.value, "state", "DISABLED")
  tags                = local.tags
}

resource "aws_cloudwatch_event_target" "job" {
  for_each  = local.jobs
  rule      = aws_cloudwatch_event_rule.job[each.key].name
  target_id = each.key
  arn       = aws_lambda_function.fn[each.value.fn].arn
  input     = jsonencode(each.value.input)
}

resource "aws_lambda_permission" "job" {
  for_each      = local.jobs
  statement_id  = "job-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn[each.value.fn].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.job[each.key].arn
}

# The one Lambda bundle in S3, reused by the knowledge, files and connectors functions.
output "code" {
  value = {
    bucket  = aws_s3_object.bundle["app"].bucket
    key     = aws_s3_object.bundle["app"].key
    version = aws_s3_object.bundle["app"].version_id
    hash    = data.archive_file.bundle["app"].output_base64sha256
  }
}

# VAIC streams its reply straight to the open HUDs (no EventBridge → Lambda hop per piece): it reads the
# connection list and posts to those connections, the same two things ws-broadcast may do.
resource "aws_iam_role_policy" "vaic_live_reply" {
  name = "live-reply"
  role = var.vaic_role_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["dynamodb:Query", "dynamodb:DeleteItem"], Resource = [var.connections_arn, "${var.connections_arn}/index/*"] },
      { Effect = "Allow", Action = ["execute-api:ManageConnections"], Resource = ["arn:aws:execute-api:${var.region}:${var.account_id}:${aws_apigatewayv2_api.ws.id}/prod/POST/@connections/*"] },
    ]
  })
}

output "http_api_url" { value = aws_apigatewayv2_api.http.api_endpoint }
output "ws_url" { value = "${aws_apigatewayv2_api.ws.api_endpoint}/prod" }
output "function_arns" { value = { for k, f in aws_lambda_function.fn : k => f.arn } }
output "function_names" { value = { for k, f in aws_lambda_function.fn : k => f.function_name } }
output "apps_dlq_name" { value = aws_sqs_queue.apps_dlq.name }
output "event_source_mapping_uuids" { value = { for k, m in aws_lambda_event_source_mapping.queue : k => m.uuid } }
output "role_names" { value = { for k, r in aws_iam_role.fn : k => r.name } }
