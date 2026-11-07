# Lambdas (Node.js 24, arm64), the HTTP API (Cognito JWT authorizer), the WebSocket API (Lambda
# authorizer on $connect), SQS → dispatcher, EventBridge rules (City view, ledger, notifications,
# approvals), the Step Functions approval workflow and the EventBridge Scheduler jobs (all DISABLED).
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
variable "notify_topic_arn" { type = string }
variable "user_pool_id" { type = string }
variable "user_pool_arn" { type = string }
variable "owner_email" { type = string }
variable "user_pool_endpoint" { type = string }
variable "client_id" { type = string }
variable "app_origin" { type = string }
variable "runtime_arns" { type = map(string) }
variable "utility_invoke_arns" { type = list(string) }
variable "utility_profile_arn" { type = string }
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
variable "worker_queue_concurrency" {
  type    = number
  default = 50
}

locals {
  tags = { Component = "api" }
  common_env = {
    AIC_REGION             = var.region
    AIC_LEDGER_TABLE       = var.ledger_table
    AIC_EVENT_BUS          = var.bus_name
    AIC_QUEUE_ACE          = var.queue_urls["ace"]
    AIC_QUEUE_ORCHESTRATOR = var.queue_urls["orchestrator"]
    AIC_QUEUE_MANAGER      = var.queue_urls["manager"]
    AIC_QUEUE_WORKER       = var.queue_urls["worker"]
    AIC_PROFILE_PREFIX     = var.profile_prefix
  }
  # name => bundle, handler, timeout, memory, extra env
  functions = {
    api           = { bundle = "app", handler = "aic.lambdas.api.handler", timeout = 30, memory = 1024, env = { AIC_APP_PROFILE_UTILITY = var.utility_profile_arn, AIC_USER_POOL_ID = var.user_pool_id, AIC_OWNER_EMAIL = var.owner_email, KNOWLEDGE_TABLE = var.knowledge_table, KNOWLEDGE_BUCKET = var.knowledge_bucket, KNOWLEDGE_BASE_ID = var.knowledge_base_id, KNOWLEDGE_DATA_SOURCE_ID = var.knowledge_data_source_id, KNOWLEDGE_GRAPH_ID = var.knowledge_graph_id } }
    dispatcher    = { bundle = "app", handler = "aic.lambdas.dispatcher.handler", timeout = 120, memory = 256, env = { AIC_RUNTIME_ARN_ACE = var.runtime_arns["ace"], AIC_RUNTIME_ARN_ORCHESTRATOR = var.runtime_arns["orchestrator"], AIC_RUNTIME_ARN_MANAGER = var.runtime_arns["manager"], AIC_RUNTIME_ARN_WORKER = var.runtime_arns["worker"] } }
    factory       = { bundle = "app", handler = "aic.lambdas.factory.handler", timeout = 30, memory = 256, env = {} }
    ledger-writer = { bundle = "app", handler = "aic.lambdas.ledger_writer.handler", timeout = 30, memory = 256, env = {} }
    scheduler     = { bundle = "app", handler = "aic.lambdas.scheduler.handler", timeout = 120, memory = 256, env = {} }
    notifier      = { bundle = "app", handler = "aic.lambdas.notifier.handler", timeout = 30, memory = 256, env = { AIC_NOTIFY_TOPIC_ARN = var.notify_topic_arn } }
    approvals     = { bundle = "app", handler = "aic.lambdas.approvals.handler", timeout = 30, memory = 256, env = {} }
    ws-authorizer = { bundle = "app", handler = "aic.lambdas.ws.authorizer_handler", timeout = 10, memory = 256, env = { AIC_USER_POOL_ID = var.user_pool_id, AIC_USER_POOL_CLIENT_ID = var.client_id } }
    ws-connection = { bundle = "app", handler = "aic.lambdas.ws.connection_handler", timeout = 10, memory = 256, env = { AIC_CONNECTIONS_TABLE = var.connections_table } }
    ws-broadcast  = { bundle = "app", handler = "aic.lambdas.ws.broadcast_handler", timeout = 30, memory = 256, env = { AIC_CONNECTIONS_TABLE = var.connections_table, AIC_WS_ENDPOINT = "https://${aws_apigatewayv2_api.ws.id}.execute-api.${var.region}.amazonaws.com/prod" } }
  }
  ledger_rw = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:ConditionCheckItem"]
  # What each function may do, beyond logs, tracing and the KMS key.
  permissions = {
    api = [
      { Action = local.ledger_rw, Resource = [var.ledger_arn, "${var.ledger_arn}/index/*"] },
      { Action = ["events:PutEvents"], Resource = [var.bus_arn] },
      { Action = ["sqs:SendMessage"], Resource = values(var.queue_arns) },
      { Action = ["states:SendTaskSuccess", "states:SendTaskFailure"], Resource = [aws_sfn_state_machine.approval.arn] },
      { Action = ["bedrock:InvokeModel"], Resource = var.utility_invoke_arns },
      # "Send me a new first-login email": re-sends the owner's invitation, nothing else.
      { Action = ["cognito-idp:AdminCreateUser"], Resource = [var.user_pool_arn] },
      # The knowledge base (docs/KNOWLEDGE.md section 9): items, presigned uploads (single and multipart) under raw/,
      # scope changes rewrite normalized/…metadata.json, deletes remove the item's files, then a re-sync.
      { Action = local.ledger_rw, Resource = [var.knowledge_table_arn, "${var.knowledge_table_arn}/index/*"] },
      { Action = ["dynamodb:BatchWriteItem", "dynamodb:BatchGetItem"], Resource = [var.knowledge_table_arn] },
      { Action = ["s3:PutObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts", "s3:DeleteObject"], Resource = ["${var.knowledge_bucket_arn}/raw/*"] },
      { Action = ["s3:PutObject", "s3:DeleteObject"], Resource = ["${var.knowledge_bucket_arn}/normalized/*"] },
      { Action = ["s3:DeleteObject"], Resource = ["${var.knowledge_bucket_arn}/work/*"] },
      { Action = ["s3:ListBucket"], Resource = [var.knowledge_bucket_arn], Condition = { StringLike = { "s3:prefix" = ["raw/*", "work/*", "normalized/*"] } } },
      { Action = ["bedrock:IngestKnowledgeBaseDocuments", "bedrock:DeleteKnowledgeBaseDocuments"], Resource = [var.knowledge_base_arn] },
      { Action = ["neptune-graph:ReadDataViaQuery", "neptune-graph:WriteDataViaQuery", "neptune-graph:DeleteDataViaQuery"], Resource = [var.knowledge_graph_arn] },
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
      { Action = ["events:PutEvents"], Resource = [var.bus_arn] },
      { Action = ["sqs:SendMessage"], Resource = values(var.queue_arns) },
    ]
    notifier      = [{ Action = local.ledger_rw, Resource = [var.ledger_arn, "${var.ledger_arn}/index/*"] }, { Action = ["sns:Publish"], Resource = [var.notify_topic_arn] }]
    approvals     = [{ Action = local.ledger_rw, Resource = [var.ledger_arn, "${var.ledger_arn}/index/*"] }, { Action = ["sqs:SendMessage"], Resource = values(var.queue_arns) }]
    ws-authorizer = [{ Action = ["cognito-idp:DescribeUserPool"], Resource = ["arn:aws:cognito-idp:${var.region}:${var.account_id}:userpool/${var.user_pool_id}"] }]
    ws-connection = [{ Action = ["dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:UpdateItem"], Resource = [var.connections_arn] }]
    ws-broadcast = [
      { Action = ["dynamodb:Query", "dynamodb:DeleteItem"], Resource = [var.connections_arn, "${var.connections_arn}/index/*"] },
      { Action = ["execute-api:ManageConnections"], Resource = ["arn:aws:execute-api:${var.region}:${var.account_id}:${aws_apigatewayv2_api.ws.id}/prod/POST/@connections/*"] },
    ]
  }
  routes = [
    "GET /city", "GET /city/agent", "POST /city/instruct", "POST /messages", "POST /wake-check", "GET /tickets", "GET /tickets/{id}",
    "GET /departments", "GET /agents", "GET /workforce", "GET /costs", "GET /health", "GET /questions", "POST /questions/{id}/answer",
    "POST /questions/{id}/default", "POST /approvals/{id}", "GET /settings", "PUT /settings", "POST /city/pause", "POST /city/resume",
    "GET /memory", "POST /notes",
    "GET /knowledge", "GET /knowledge/{id}", "POST /knowledge/uploads", "POST /knowledge/uploads/{id}/complete", "POST /knowledge/links",
    "POST /knowledge/text", "PUT /knowledge/{id}", "DELETE /knowledge/{id}",
  ]
  queue_batch = { ace = 1, orchestrator = 5, manager = 5, worker = 10 }
  queue_conc  = { ace = 5, orchestrator = 10, manager = 20, worker = var.worker_queue_concurrency }
  jobs = {
    sweep       = { schedule = "rate(5 minutes)", fn = "scheduler", input = { job = "sweep" } }
    retire-idle = { schedule = "rate(1 hour)", fn = "scheduler", input = { job = "retire_idle" } }
    reminders   = { schedule = "rate(5 minutes)", fn = "scheduler", input = { job = "reminders" } }
    nudge       = { schedule = "rate(5 minutes)", fn = "notifier", input = { job = "nudge" } }
    improve     = { schedule = "cron(0 3 ? * SUN *)", fn = "scheduler", input = { job = "improve" } }
  }
}

data "archive_file" "bundle" {
  for_each    = toset(distinct([for f in local.functions : f.bundle]))
  type        = "zip"
  source_dir  = "${var.lambda_dist}/${each.key}"
  output_path = "${path.root}/.build/${each.key}.zip"
}

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
  #checkov:skip=CKV_AWS_117:No VPC: the functions call only AWS APIs, and a VPC would add NAT cost.
  #checkov:skip=CKV_AWS_272:Code signing is not set up for a single-owner project; deploys run from the owner's approved workflow.
  #checkov:skip=CKV_AWS_116:Synchronous and SQS/EventBridge-invoked functions; failed SQS work goes to the queues' DLQs.
  for_each         = local.functions
  function_name    = "${var.name}-${each.key}"
  role             = aws_iam_role.fn[each.key].arn
  runtime          = "python3.13"
  architectures    = ["arm64"]
  handler          = each.value.handler
  filename         = data.archive_file.bundle[each.value.bundle].output_path
  source_code_hash = data.archive_file.bundle[each.value.bundle].output_base64sha256
  timeout          = each.value.timeout
  memory_size      = each.value.memory
  # SnapStart (api only, docs/KNOWLEDGE.md section 14): each deploy publishes a version and snapshots its init;
  # API Gateway calls the `live` alias. Python 3.12+ SnapStart supports arm64.
  publish = each.key == "api"
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
  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.fn[each.key].name
  }
  environment {
    variables = merge(local.common_env, each.value.env)
  }
  tags = local.tags
}

# ---------- SQS → dispatcher ----------
resource "aws_lambda_event_source_mapping" "queue" {
  for_each                = var.queue_arns
  event_source_arn        = each.value
  function_name           = aws_lambda_function.fn["dispatcher"].arn
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
  event_pattern  = jsonencode({ source = ["aic.city"] })
  tags           = local.tags
}

resource "aws_cloudwatch_event_target" "all" {
  for_each       = toset(["ws-broadcast", "ledger-writer"])
  rule           = aws_cloudwatch_event_rule.all.name
  event_bus_name = var.bus_name
  target_id      = each.key
  arn            = aws_lambda_function.fn[each.key].arn
}

resource "aws_cloudwatch_event_rule" "notify" {
  name           = "${var.name}-notify"
  event_bus_name = var.bus_name
  event_pattern  = jsonencode({ source = ["aic.city"], "detail-type" = ["result", "spend.cap_reached", "city.state"] })
  tags           = local.tags
}

resource "aws_cloudwatch_event_target" "notify" {
  rule           = aws_cloudwatch_event_rule.notify.name
  event_bus_name = var.bus_name
  target_id      = "notifier"
  arn            = aws_lambda_function.fn["notifier"].arn
}

resource "aws_lambda_permission" "events" {
  for_each      = { ws-broadcast = aws_cloudwatch_event_rule.all.arn, ledger-writer = aws_cloudwatch_event_rule.all.arn, notifier = aws_cloudwatch_event_rule.notify.arn }
  statement_id  = "events"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn[each.key].function_name
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
  event_pattern  = jsonencode({ source = ["aic.city"], "detail-type" = ["approval.requested"] })
  tags           = local.tags
}

resource "aws_cloudwatch_event_target" "approval" {
  rule           = aws_cloudwatch_event_rule.approval.name
  event_bus_name = var.bus_name
  target_id      = "approval-workflow"
  arn            = aws_sfn_state_machine.approval.arn
  role_arn       = aws_iam_role.events_sfn.arn
}

# ---------- recurring jobs: all created DISABLED ----------
resource "aws_scheduler_schedule_group" "this" {
  name = var.name
  tags = local.tags
}

resource "aws_iam_role" "scheduler" {
  name                 = "${var.name}-scheduler"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "scheduler.amazonaws.com" }, Action = "sts:AssumeRole", Condition = { StringEquals = { "aws:SourceAccount" = var.account_id } } }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "scheduler" {
  name   = "invoke-jobs"
  role   = aws_iam_role.scheduler.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = [aws_lambda_function.fn["scheduler"].arn, aws_lambda_function.fn["notifier"].arn] }] })
}

resource "aws_scheduler_schedule" "job" {
  for_each                     = local.jobs
  name                         = "${var.name}-${each.key}"
  group_name                   = aws_scheduler_schedule_group.this.name
  state                        = "DISABLED"
  schedule_expression          = each.value.schedule
  schedule_expression_timezone = "UTC"
  kms_key_arn                  = var.kms_key_arn
  flexible_time_window {
    mode = "OFF"
  }
  target {
    arn      = aws_lambda_function.fn[each.value.fn].arn
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode(each.value.input)
  }
}

# The one Lambda bundle, reused by the knowledge module's function.
output "lambda_zip_path" { value = data.archive_file.bundle["app"].output_path }
output "lambda_zip_hash" { value = data.archive_file.bundle["app"].output_base64sha256 }
output "http_api_url" { value = aws_apigatewayv2_api.http.api_endpoint }
output "ws_url" { value = "${aws_apigatewayv2_api.ws.api_endpoint}/prod" }
output "function_arns" { value = { for k, f in aws_lambda_function.fn : k => f.arn } }
output "function_names" { value = { for k, f in aws_lambda_function.fn : k => f.function_name } }
output "event_source_mapping_uuids" { value = { for k, m in aws_lambda_event_source_mapping.queue : k => m.uuid } }
