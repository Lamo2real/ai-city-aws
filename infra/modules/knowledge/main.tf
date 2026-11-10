# The owner's knowledge base (docs/KNOWLEDGE.md, v2: performance first): the S3 bucket for raw and normalized
# files, an Amazon Bedrock Knowledge Base on OpenSearch Serverless (hybrid search; Titan Text Embeddings V2 from
# config/models.json), the Neptune Analytics graph, the item table, the knowledge Lambda, the ingest workflow
# (Step Functions, direct ingestion) and the rule that starts it when a file lands under raw/. ~$610/month fixed.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws        = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
    opensearch = { source = "opensearch-project/opensearch", version = ">= 2.6.0, < 3.0.0" }
    time       = { source = "hashicorp/time", version = ">= 0.13.0, < 1.0.0" }
  }
}

variable "name" { type = string }
variable "region" { type = string }
variable "account_id" { type = string }
variable "kms_key_arn" { type = string }
variable "boundary_arn" { type = string }
variable "app_origin" {
  type        = string
  description = "The HUD's origin: the only one allowed to PUT presigned uploads (CORS)."
}
variable "deployer_arn" {
  type        = string
  description = "The IAM role (not the session) that runs terraform apply: it alone may create the OpenSearch index."
}
variable "lambda_zip_path" {
  type        = string
  description = "The same Lambda bundle the api module builds (backend/dist/lambda/app)."
}
variable "lambda_zip_hash" { type = string }
variable "ledger_table" {
  type        = string
  description = "The ledger: the knowledge Lambda records the cost of its Haiku calls and checks pause and spend caps first."
}
variable "ledger_arn" { type = string }
variable "bus_name" { type = string }
variable "bus_arn" { type = string }
variable "utility_invoke_arns" {
  type        = list(string)
  description = "Haiku 5.5 (utility role) profiles and models: summaries, entities, images and scanned PDFs."
}
variable "utility_profile_arn" { type = string }
variable "profile_prefix" { type = string }
variable "deletion_protection" {
  type    = bool
  default = true
}
variable "log_retention_days" {
  type    = number
  default = 30
}

locals {
  tags      = { Component = "knowledge" }
  base      = "${var.name}-knowledge"
  embedding = jsondecode(file("${path.module}/../../../config/models.json")).embeddings.knowledge
  # The one embedding model, in-Region (owner's exception, 2026-11-07). Its ID lives only in config/models.json.
  embedding_model_arn = "arn:aws:bedrock:${var.region}::foundation-model/${local.embedding.modelId}"
  collection          = local.base
  function_name       = local.base
  state_machine_name  = "${local.base}-ingest"
  state_machine_arn   = "arn:aws:states:${var.region}:${var.account_id}:stateMachine:${local.state_machine_name}"
  mediaconvert_role   = "${local.base}-mediaconvert"
  table_rw            = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:BatchGetItem", "dynamodb:BatchWriteItem", "dynamodb:ConditionCheckItem"]
  lambda_errors       = ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
}

# ---------- S3: raw/, work/, normalized/ ----------
resource "aws_s3_bucket" "this" {
  #checkov:skip=CKV_AWS_144:One-region personal store; versioning and the KMS key protect it, cross-region replication would double the cost.
  #checkov:skip=CKV_AWS_18:Access logging would need another bucket; CloudTrail data events can be enabled if needed.
  bucket        = local.base
  force_destroy = true # the AIC → VAIC rename (docs/RENAME_PLAN.md); back to false afterwards
  tags          = local.tags
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    id     = "expire-work"
    status = "Enabled"
    filter {
      prefix = "work/"
    }
    expiration {
      days = 7
    }
    noncurrent_version_expiration {
      noncurrent_days = 1
    }
  }
  # Deleted or replaced files stay recoverable for 30 days, then are gone for good.
  rule {
    id     = "old-versions-and-uploads"
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

# The HUD uploads straight to S3 with presigned PUTs (single and multipart; multipart needs the ETag).
resource "aws_s3_bucket_cors_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = [var.app_origin]
    allowed_headers = ["content-type", "content-md5", "x-amz-*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "TlsOnly"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.this.arn, "${aws_s3_bucket.this.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.this]
}

# Object events go to EventBridge (default bus); the rule below picks raw/ only.
resource "aws_s3_bucket_notification" "this" {
  bucket      = aws_s3_bucket.this.id
  eventbridge = true
}

# ---------- vectors + keywords: OpenSearch Serverless + the Bedrock Knowledge Base ----------
# One VECTORSEARCH collection without standby replicas (1 OCU minimum, ~$186/month): tens of ms per query and
# hybrid search (BM25 + k-NN). Reached only with IAM SigV4 and the data-access policy below.
resource "aws_opensearchserverless_security_policy" "encryption" {
  name = local.base
  type = "encryption"
  policy = jsonencode({
    Rules       = [{ ResourceType = "collection", Resource = ["collection/${local.collection}"] }]
    AWSOwnedKey = false
    KmsARN      = var.kms_key_arn
  })
}

# Public endpoint (dashboards off), IAM-authenticated: Bedrock, and the deploy runner that creates the index,
# reach it without a VPC. With AllowFromPublic the source-service list is not needed (and not allowed).
resource "aws_opensearchserverless_security_policy" "network" {
  name = local.base
  type = "network"
  policy = jsonencode([{
    Rules           = [{ ResourceType = "collection", Resource = ["collection/${local.collection}"] }]
    AllowFromPublic = true
  }])
}

resource "aws_opensearchserverless_collection" "this" {
  name             = local.collection
  description      = "The owner's knowledge: vectors and keywords for the Bedrock Knowledge Base"
  type             = "VECTORSEARCH"
  standby_replicas = "DISABLED"
  tags             = local.tags
  depends_on       = [aws_opensearchserverless_security_policy.encryption, aws_opensearchserverless_security_policy.network]
}

# Who may touch the data: the KB role reads and writes index items; the deploy role only creates and updates
# that index (Describe is how the provider reads it back).
resource "aws_opensearchserverless_access_policy" "data" {
  name = local.base
  type = "data"
  policy = jsonencode([
    {
      Rules = [
        { ResourceType = "collection", Resource = ["collection/${local.collection}"], Permission = ["aoss:DescribeCollectionItems"] },
        { ResourceType = "index", Resource = ["index/${local.collection}/items"], Permission = ["aoss:DescribeIndex", "aoss:UpdateIndex", "aoss:ReadDocument", "aoss:WriteDocument"] },
      ]
      Principal = [aws_iam_role.kb.arn]
    },
    {
      Rules     = [{ ResourceType = "index", Resource = ["index/${local.collection}/items"], Permission = ["aoss:CreateIndex", "aoss:UpdateIndex", "aoss:DescribeIndex"] }]
      Principal = [var.deployer_arn]
    },
  ])
}

# Data-access policies take up to a minute to apply; the index is created after that.
resource "time_sleep" "data_policy" {
  create_duration = "60s"
  triggers        = { policy = aws_opensearchserverless_access_policy.data.policy_version }
}

# The index Bedrock writes into (docs/KNOWLEDGE.md section 14), created before the KB.
# The AIC → VAIC rename (docs/RENAME_PLAN.md): the old collection takes its index with it, so Terraform only forgets
# the old index (no call to the old collection's endpoint) and makes this one in the new collection.
removed {
  from = opensearch_index.items
  lifecycle {
    destroy = false
  }
}

resource "opensearch_index" "knowledge" {
  name                           = "items"
  index_knn                      = true
  index_knn_algo_param_ef_search = "512"
  force_destroy                  = true # the AIC → VAIC rename
  mappings = jsonencode({
    properties = {
      # Titan V2 vectors are normalized, so inner product is cosine.
      embedding = {
        type      = "knn_vector"
        dimension = local.embedding.dimensions
        data_type = "float"
        method    = { name = "hnsw", engine = "faiss", space_type = "innerproduct", parameters = { m = 16, ef_construction = 512 } }
      }
      text     = { type = "text" }
      metadata = { type = "text", index = false }
      item_id  = { type = "keyword" }
      scope    = { type = "keyword" }
      kind     = { type = "keyword" }
    }
  })
  depends_on = [time_sleep.data_policy]
  lifecycle {
    ignore_changes = [mappings] # Bedrock adds its own fields; the mapping above is only the start.
  }
}

# A new index takes up to a minute to be visible to Bedrock; creating the knowledge base before that fails
# the first apply with "storage configuration is invalid".
resource "time_sleep" "index" {
  create_duration = "60s"
  triggers        = { index = opensearch_index.knowledge.id }
}

resource "aws_iam_role" "kb" {
  name                 = "${local.base}-kb"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "bedrock.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = { "aws:SourceAccount" = var.account_id }
        ArnLike      = { "aws:SourceArn" = "arn:aws:bedrock:${var.region}:${var.account_id}:knowledge-base/*" }
      }
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "kb" {
  name = "knowledge-base"
  role = aws_iam_role.kb.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "Embed", Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = [local.embedding_model_arn] },
      { Sid = "ListNormalized", Effect = "Allow", Action = ["s3:ListBucket"], Resource = [aws_s3_bucket.this.arn], Condition = { StringLike = { "s3:prefix" = ["normalized/*"] }, StringEquals = { "aws:ResourceAccount" = var.account_id } } },
      { Sid = "ReadNormalized", Effect = "Allow", Action = ["s3:GetObject"], Resource = ["${aws_s3_bucket.this.arn}/normalized/*"], Condition = { StringEquals = { "aws:ResourceAccount" = var.account_id } } },
      { Sid = "Collection", Effect = "Allow", Action = ["aoss:APIAccessAll"], Resource = [aws_opensearchserverless_collection.this.arn] },
      { Sid = "Key", Effect = "Allow", Action = ["kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"], Resource = var.kms_key_arn },
    ]
  })
}

resource "aws_bedrockagent_knowledge_base" "this" {
  name        = local.base
  description = "The owner's stored knowledge (links, documents, images, audio, video, notes)"
  role_arn    = aws_iam_role.kb.arn
  knowledge_base_configuration {
    type = "VECTOR"
    vector_knowledge_base_configuration {
      embedding_model_arn = local.embedding_model_arn
      embedding_model_configuration {
        bedrock_embedding_model_configuration {
          dimensions          = local.embedding.dimensions
          embedding_data_type = "FLOAT32"
        }
      }
    }
  }
  storage_configuration {
    type = "OPENSEARCH_SERVERLESS"
    opensearch_serverless_configuration {
      collection_arn    = aws_opensearchserverless_collection.this.arn
      vector_index_name = opensearch_index.knowledge.name
      field_mapping {
        vector_field   = "embedding"
        text_field     = "text"
        metadata_field = "metadata"
      }
    }
  }
  tags       = local.tags
  depends_on = [aws_iam_role_policy.kb, opensearch_index.knowledge, time_sleep.index]
}

resource "aws_bedrockagent_data_source" "normalized" {
  knowledge_base_id    = aws_bedrockagent_knowledge_base.this.id
  name                 = "normalized"
  description          = "normalized/<item_id>/… with .metadata.json (item_id, scope, kind)"
  data_deletion_policy = "DELETE"
  data_source_configuration {
    type = "S3"
    s3_configuration {
      bucket_arn              = aws_s3_bucket.this.arn
      bucket_owner_account_id = var.account_id
      inclusion_prefixes      = ["normalized/"]
    }
  }
  server_side_encryption_configuration {
    kms_key_arn = var.kms_key_arn
  }
}

# ---------- the graph: Neptune Analytics (in-memory, openCypher; ~$424/month) ----------
# Public endpoint with IAM SigV4: only the neptune-graph query permissions below reach it (no VPC, no NAT).
resource "aws_neptunegraph_graph" "this" {
  graph_name          = "${local.base}-graph"
  provisioned_memory  = 16
  replica_count       = 0
  public_connectivity = true
  kms_key_identifier  = var.kms_key_arn
  deletion_protection = var.deletion_protection
  tags                = local.tags
}

# ---------- item records ----------
resource "aws_dynamodb_table" "this" {
  name                        = local.base
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  range_key                   = "sk"
  deletion_protection_enabled = var.deletion_protection

  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }
  attribute {
    name = "gsi1pk"
    type = "S"
  }
  attribute {
    name = "gsi1sk"
    type = "S"
  }
  attribute {
    name = "gsi2pk"
    type = "S"
  }
  attribute {
    name = "gsi2sk"
    type = "S"
  }
  global_secondary_index {
    name            = "gsi1"
    projection_type = "ALL"
    key_schema {
      attribute_name = "gsi1pk"
      key_type       = "HASH"
    }
    key_schema {
      attribute_name = "gsi1sk"
      key_type       = "RANGE"
    }
  }
  global_secondary_index {
    name            = "gsi2"
    projection_type = "ALL"
    key_schema {
      attribute_name = "gsi2pk"
      key_type       = "HASH"
    }
    key_schema {
      attribute_name = "gsi2sk"
      key_type       = "RANGE"
    }
  }
  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn
  }
  tags = local.tags
}

# ---------- MediaConvert: video and odd audio → m4a under work/ ----------
resource "aws_iam_role" "mediaconvert" {
  name                 = local.mediaconvert_role
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "mediaconvert.amazonaws.com" }, Action = "sts:AssumeRole", Condition = { StringEquals = { "aws:SourceAccount" = var.account_id } } }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "mediaconvert" {
  name = "raw-in-work-out"
  role = aws_iam_role.mediaconvert.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "ReadRaw", Effect = "Allow", Action = ["s3:GetObject"], Resource = ["${aws_s3_bucket.this.arn}/raw/*"] },
      { Sid = "WriteWork", Effect = "Allow", Action = ["s3:PutObject"], Resource = ["${aws_s3_bucket.this.arn}/work/*"] },
      { Sid = "Key", Effect = "Allow", Action = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"], Resource = var.kms_key_arn },
    ]
  })
}

# ---------- the knowledge Lambda (one handler, `action` field) ----------
resource "aws_cloudwatch_log_group" "fn" {
  #checkov:skip=CKV_AWS_338:Retention is the log_retention_days variable (30 days by default) to keep cost low; the item records keep the durable state.
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn
  tags              = local.tags
}

resource "aws_iam_role" "fn" {
  name                 = "${var.name}-fn-knowledge"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "fn" {
  name = "least-privilege"
  role = aws_iam_role.fn.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "Logs", Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.fn.arn}:*" },
      { Sid = "Tracing", Effect = "Allow", Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"], Resource = "*" },
      { Sid = "Key", Effect = "Allow", Action = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"], Resource = var.kms_key_arn },
      { Sid = "Files", Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"], Resource = ["${aws_s3_bucket.this.arn}/*"] },
      { Sid = "ListFiles", Effect = "Allow", Action = ["s3:ListBucket"], Resource = [aws_s3_bucket.this.arn] },
      { Sid = "Items", Effect = "Allow", Action = local.table_rw, Resource = [aws_dynamodb_table.this.arn, "${aws_dynamodb_table.this.arn}/index/*"] },
      # Transcribe reads raw/ or work/ and writes work/ with this role's own S3 permissions.
      { Sid = "Transcribe", Effect = "Allow", Action = ["transcribe:StartTranscriptionJob", "transcribe:GetTranscriptionJob"], Resource = ["arn:aws:transcribe:${var.region}:${var.account_id}:transcription-job/*"] },
      { Sid = "MediaConvert", Effect = "Allow", Action = ["mediaconvert:CreateJob", "mediaconvert:GetJob"], Resource = ["arn:aws:mediaconvert:${var.region}:${var.account_id}:queues/Default", "arn:aws:mediaconvert:${var.region}:${var.account_id}:jobs/*"] },
      { Sid = "PassMediaConvertRole", Effect = "Allow", Action = ["iam:PassRole"], Resource = [aws_iam_role.mediaconvert.arn], Condition = { StringEquals = { "iam:PassedToService" = "mediaconvert.amazonaws.com" } } },
      # Converse is authorized as bedrock:InvokeModel; Haiku 5.5 (utility) only.
      { Sid = "Utility", Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = var.utility_invoke_arns },
      # Direct ingestion per item (no data-source syncs: AWS says not to mix them).
      # AWS's direct-ingestion policy (kb-direct-ingestion-prereq): IngestKnowledgeBaseDocuments is also authorised as
      # StartIngestionJob; without it Bedrock answered AccessDenied and every item failed (2026-11-09).
      { Sid = "Ingest", Effect = "Allow", Action = ["bedrock:StartIngestionJob", "bedrock:IngestKnowledgeBaseDocuments", "bedrock:GetKnowledgeBaseDocuments", "bedrock:ListKnowledgeBaseDocuments", "bedrock:DeleteKnowledgeBaseDocuments"], Resource = [aws_bedrockagent_knowledge_base.this.arn] },
      { Sid = "Graph", Effect = "Allow", Action = ["neptune-graph:ReadDataViaQuery", "neptune-graph:WriteDataViaQuery", "neptune-graph:DeleteDataViaQuery"], Resource = [aws_neptunegraph_graph.this.arn] },
      { Sid = "Events", Effect = "Allow", Action = ["events:PutEvents"], Resource = [var.bus_arn] },
      { Sid = "Ledger", Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"], Resource = [var.ledger_arn, "${var.ledger_arn}/index/*"] },
      # EventBridge cannot name an execution, so the `start` action names it after the item (one run per item).
      { Sid = "Pipeline", Effect = "Allow", Action = ["states:StartExecution"], Resource = [local.state_machine_arn] },
      { Sid = "PipelineStatus", Effect = "Allow", Action = ["states:DescribeExecution"], Resource = ["arn:aws:states:${var.region}:${var.account_id}:execution:${local.state_machine_name}:*"] },
    ]
  })
}

resource "aws_lambda_function" "fn" {
  #checkov:skip=CKV_AWS_117:No VPC: the function calls AWS APIs and fetches the owner's links (with an address guard); a VPC would add NAT cost.
  #checkov:skip=CKV_AWS_272:Code signing is not set up for a single-owner project; deploys run from the owner's approved workflow.
  #checkov:skip=CKV_AWS_116:Invoked by Step Functions (which retries and records failures) and by EventBridge (retry policy and DLQ on the target).
  function_name                  = local.function_name
  role                           = aws_iam_role.fn.arn
  runtime                        = "python3.13"
  architectures                  = ["arm64"]
  handler                        = "vaic.lambdas.knowledge.handler"
  filename                       = var.lambda_zip_path
  source_code_hash               = var.lambda_zip_hash
  timeout                        = 900
  memory_size                    = 2048 # PDF and image work is CPU-bound; CPU scales with memory
  kms_key_arn                    = var.kms_key_arn
  reserved_concurrent_executions = 50 # items ingest in parallel
  ephemeral_storage {
    size = 2048
  }
  tracing_config {
    mode = "Active"
  }
  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.fn.name
  }
  environment {
    variables = {
      VAIC_REGION                 = var.region
      VAIC_EVENT_BUS              = var.bus_name
      VAIC_LEDGER_TABLE           = var.ledger_table
      VAIC_PROFILE_PREFIX         = var.profile_prefix
      VAIC_APP_PROFILE_UTILITY    = var.utility_profile_arn
      KNOWLEDGE_TABLE             = aws_dynamodb_table.this.name
      KNOWLEDGE_BUCKET            = aws_s3_bucket.this.bucket
      KNOWLEDGE_BASE_ID           = aws_bedrockagent_knowledge_base.this.id
      KNOWLEDGE_DATA_SOURCE_ID    = aws_bedrockagent_data_source.normalized.data_source_id
      KNOWLEDGE_GRAPH_ID          = aws_neptunegraph_graph.this.id
      KNOWLEDGE_STATE_MACHINE_ARN = local.state_machine_arn
      MEDIACONVERT_ROLE_ARN       = aws_iam_role.mediaconvert.arn
    }
  }
  tags = local.tags
}

# ---------- the ingest workflow ----------
resource "aws_cloudwatch_log_group" "sfn" {
  #checkov:skip=CKV_AWS_338:Retention is the log_retention_days variable (30 days by default) to keep cost low; the item records keep the durable state.
  name              = "/aws/vendedlogs/states/${local.state_machine_name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn
  tags              = local.tags
}

resource "aws_iam_role" "sfn" {
  name                 = "${var.name}-sfn-knowledge"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "states.amazonaws.com" }, Action = "sts:AssumeRole", Condition = { StringEquals = { "aws:SourceAccount" = var.account_id } } }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "sfn" {
  name = "knowledge-ingest"
  role = aws_iam_role.sfn.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = [aws_lambda_function.fn.arn] },
      { Effect = "Allow", Action = ["logs:CreateLogDelivery", "logs:GetLogDelivery", "logs:UpdateLogDelivery", "logs:DeleteLogDelivery", "logs:ListLogDeliveries", "logs:PutResourcePolicy", "logs:DescribeResourcePolicies", "logs:DescribeLogGroups"], Resource = "*" },
      { Effect = "Allow", Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords", "xray:GetSamplingRules", "xray:GetSamplingTargets"], Resource = "*" },
      { Effect = "Allow", Action = ["kms:Decrypt", "kms:GenerateDataKey"], Resource = var.kms_key_arn },
    ]
  })
}

resource "aws_sfn_state_machine" "ingest" {
  #checkov:skip=CKV_AWS_285:All events are logged (level ALL) but without execution data: payloads carry the owner's item ids and error text, and the item record holds the state.
  name     = local.state_machine_name
  role_arn = aws_iam_role.sfn.arn
  type     = "STANDARD"
  definition = templatefile("${path.module}/pipeline.asl.json.tftpl", {
    function_arn  = aws_lambda_function.fn.arn
    lambda_errors = jsonencode(local.lambda_errors)
  })
  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.sfn.arn}:*"
    include_execution_data = false
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

# ---------- start: object created under raw/ → knowledge Lambda `start` → execution named after the item ----------
resource "aws_cloudwatch_event_rule" "raw_created" {
  name           = "${local.base}-raw-created"
  description    = "A file landed under raw/ in the knowledge bucket"
  event_bus_name = "default" # S3 sends its events to the default bus
  event_pattern = jsonencode({
    source        = ["aws.s3"]
    "detail-type" = ["Object Created"]
    detail = {
      bucket = { name = [aws_s3_bucket.this.bucket] }
      object = { key = [{ prefix = "raw/" }] }
    }
  })
  tags = local.tags
}

resource "aws_sqs_queue" "start_dlq" {
  name                      = "${local.base}-start-dlq"
  message_retention_seconds = 1209600
  kms_master_key_id         = var.kms_key_arn
  tags                      = local.tags
}

resource "aws_sqs_queue_policy" "start_dlq" {
  queue_url = aws_sqs_queue.start_dlq.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.start_dlq.arn
      Condition = { ArnEquals = { "aws:SourceArn" = aws_cloudwatch_event_rule.raw_created.arn } }
    }]
  })
}

resource "aws_cloudwatch_event_target" "raw_created" {
  rule           = aws_cloudwatch_event_rule.raw_created.name
  event_bus_name = "default"
  target_id      = "knowledge-start"
  arn            = aws_lambda_function.fn.arn
  input_transformer {
    input_paths    = { bucket = "$.detail.bucket.name", key = "$.detail.object.key" }
    input_template = "{\"action\": \"start\", \"bucket\": <bucket>, \"key\": <key>}"
  }
  retry_policy {
    maximum_event_age_in_seconds = 3600
    maximum_retry_attempts       = 10
  }
  dead_letter_config {
    arn = aws_sqs_queue.start_dlq.arn
  }
}

resource "aws_lambda_permission" "events" {
  statement_id  = "events-raw-created"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.raw_created.arn
}

output "bucket" { value = aws_s3_bucket.this.bucket }
output "bucket_arn" { value = aws_s3_bucket.this.arn }
output "table" { value = aws_dynamodb_table.this.name }
output "table_arn" { value = aws_dynamodb_table.this.arn }
output "knowledge_base_id" { value = aws_bedrockagent_knowledge_base.this.id }
output "knowledge_base_arn" { value = aws_bedrockagent_knowledge_base.this.arn }
output "data_source_id" { value = aws_bedrockagent_data_source.normalized.data_source_id }
output "graph_id" { value = aws_neptunegraph_graph.this.id }
output "graph_arn" { value = aws_neptunegraph_graph.this.arn }
output "collection_endpoint" { value = aws_opensearchserverless_collection.this.collection_endpoint }
output "state_machine_arn" { value = aws_sfn_state_machine.ingest.arn }
output "mediaconvert_role_arn" { value = aws_iam_role.mediaconvert.arn }
output "function_names" { value = { knowledge = aws_lambda_function.fn.function_name } }
output "start_dlq_name" { value = aws_sqs_queue.start_dlq.name }
