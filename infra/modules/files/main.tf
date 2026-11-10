# Files (docs/FILES.md, decisions 151 and 156): the owner's one storage area for photos, videos, PDFs, documents and any
# other file, which the departments read and write. One private, KMS-encrypted, versioned bucket; one table of
# file records; the files Lambda that describes each file (Claude captions, document text, video frames and
# Transcribe), embeds the description with Titan Text Embeddings V2 and keeps the vector on the record. Driven by
# events: S3 object created, MediaConvert and Transcribe job state changes. ~$0 idle.
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
variable "app_origin" {
  type        = string
  description = "The HUD's origin: the only one allowed to PUT uploads and read previews (CORS)."
}
variable "lambda_zip_path" { type = string }
variable "lambda_zip_hash" { type = string }
variable "ledger_table" { type = string }
variable "ledger_arn" { type = string }
variable "bus_name" { type = string }
variable "bus_arn" { type = string }
variable "utility_invoke_arns" {
  type        = list(string)
  description = "Haiku 5.5 (utility role): image and frame captions, descriptions from text, scanned PDFs."
}
variable "utility_profile_arn" { type = string }
variable "profile_prefix" { type = string }
variable "mediaconvert_role_name" {
  type        = string
  description = "The knowledge base's MediaConvert role: the permission boundary lets roles pass only that one, so Files reuses it."
}
variable "mediaconvert_role_arn" { type = string }
variable "api_role_name" { type = string }
variable "agent_role_names" { type = map(string) }
variable "workspace_role_name" { type = string }
variable "workspace_role_arn" { type = string }
variable "deletion_protection" {
  type    = bool
  default = true
}
variable "log_retention_days" {
  type    = number
  default = 30
}

locals {
  signing_secret = "vaic/prod/files-signing-key"
  tags           = { Component = "files" }
  base           = "${var.name}-files"
  function_name  = local.base
  embedding      = jsondecode(file("${path.module}/../../../config/models.json")).embeddings.files
  # Titan V2 in-Region (the owner's exception, decision 147): it only turns descriptions into vectors.
  embedding_model_arn = "arn:aws:bedrock:${var.region}::foundation-model/${local.embedding.modelId}"
  table_rw            = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query"]
}

# ---------- S3: files/<id>/<name>, thumbs/<id>.jpg, work/<id>/…, hires/<hire>/files/… (departments' drop) ----------
resource "aws_s3_bucket" "this" {
  #checkov:skip=CKV_AWS_144:One-region personal store; versioning and the KMS key protect it, cross-region replication would double the cost.
  #checkov:skip=CKV_AWS_18:Access logging would need another bucket; CloudTrail data events can be enabled if needed.
  bucket        = local.base
  force_destroy = false
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
  # Frames, the extracted sound and transcripts are only needed while a file is being described.
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
  # A department's drop is adopted into files/ within seconds; anything left there is a failed adoption.
  rule {
    id     = "expire-drops"
    status = "Enabled"
    filter {
      prefix = "hires/"
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

# The HUD uploads straight to S3 with presigned PUTs (single and multipart; multipart needs the ETag) and shows
# previews with presigned GETs (a PDF's first page is read by the browser, which needs GET with CORS).
resource "aws_s3_bucket_cors_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  cors_rule {
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = [var.app_origin]
    allowed_headers = ["content-type", "content-md5", "range", "x-amz-*"]
    expose_headers  = ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "TlsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.this.arn, "${aws_s3_bucket.this.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      },
      # Previews and thumbnails through this module's CloudFront distribution only (decision 156).
      {
        Sid       = "CloudFrontReadsPreviews"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = ["${aws_s3_bucket.this.arn}/files/*", "${aws_s3_bucket.this.arn}/thumbs/*"]
        Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.previews.arn } }
      },
    ]
  })
  depends_on = [aws_s3_bucket_public_access_block.this]
}

resource "aws_s3_bucket_notification" "this" {
  bucket      = aws_s3_bucket.this.id
  eventbridge = true
}

# ---------- file records ----------
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
  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn
  }
  tags = local.tags
}

# ---------- MediaConvert: the knowledge base's role also reads files/ and writes work/ here ----------
resource "aws_iam_role_policy" "mediaconvert" {
  name = "files-in-work-out"
  role = reverse(split("/", var.mediaconvert_role_arn))[0] # from the ARN, so this waits for the role
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "ReadFiles", Effect = "Allow", Action = ["s3:GetObject"], Resource = ["${aws_s3_bucket.this.arn}/files/*"] },
      { Sid = "WriteWork", Effect = "Allow", Action = ["s3:PutObject"], Resource = ["${aws_s3_bucket.this.arn}/work/*"] },
    ]
  })
}

# ---------- the files Lambda ----------
resource "aws_cloudwatch_log_group" "fn" {
  #checkov:skip=CKV_AWS_338:Retention is the log_retention_days variable (30 days by default) to keep cost low; the file records keep the durable state.
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn
  tags              = local.tags
}

resource "aws_iam_role" "fn" {
  name                 = "${var.name}-fn-files"
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
      { Sid = "Objects", Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = ["${aws_s3_bucket.this.arn}/*"] },
      { Sid = "ListWork", Effect = "Allow", Action = ["s3:ListBucket"], Resource = [aws_s3_bucket.this.arn], Condition = { StringLike = { "s3:prefix" = ["work/*"] } } },
      { Sid = "Records", Effect = "Allow", Action = local.table_rw, Resource = [aws_dynamodb_table.this.arn, "${aws_dynamodb_table.this.arn}/index/*"] },
      { Sid = "Transcribe", Effect = "Allow", Action = ["transcribe:StartTranscriptionJob", "transcribe:GetTranscriptionJob"], Resource = ["arn:aws:transcribe:${var.region}:${var.account_id}:transcription-job/vaic-files-*"] },
      { Sid = "MediaConvert", Effect = "Allow", Action = ["mediaconvert:CreateJob", "mediaconvert:GetJob"], Resource = ["arn:aws:mediaconvert:${var.region}:${var.account_id}:queues/Default", "arn:aws:mediaconvert:${var.region}:${var.account_id}:jobs/*"] },
      { Sid = "PassMediaConvertRole", Effect = "Allow", Action = ["iam:PassRole"], Resource = [var.mediaconvert_role_arn], Condition = { StringEquals = { "iam:PassedToService" = "mediaconvert.amazonaws.com" } } },
      # Converse is authorized as bedrock:InvokeModel: Haiku 5.5 (utility) for descriptions, Titan V2 for vectors.
      { Sid = "Utility", Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = var.utility_invoke_arns },
      { Sid = "Embed", Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = [local.embedding_model_arn] },
      { Sid = "Events", Effect = "Allow", Action = ["events:PutEvents"], Resource = [var.bus_arn] },
      # The ledger: cost rows and caps for the Haiku calls, and the department a hire works for (adopting its files).
      { Sid = "Ledger", Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"], Resource = [var.ledger_arn, "${var.ledger_arn}/index/*"] },
    ]
  })
}

resource "aws_lambda_function" "fn" {
  #checkov:skip=CKV_AWS_117:No VPC: the function calls AWS APIs only; a VPC would add NAT cost.
  #checkov:skip=CKV_AWS_272:Code signing is not set up for a single-owner project; deploys run from the owner's approved workflow.
  #checkov:skip=CKV_AWS_116:Invoked asynchronously by EventBridge (retry policy and DLQ on the targets) and the api (Try again).
  function_name                  = local.function_name
  role                           = aws_iam_role.fn.arn
  runtime                        = "python3.13"
  architectures                  = ["arm64"]
  handler                        = "vaic.lambdas.files.handler"
  filename                       = var.lambda_zip_path
  source_code_hash               = var.lambda_zip_hash
  timeout                        = 900
  memory_size                    = 2048 # images and PDFs are CPU-bound; CPU scales with memory
  kms_key_arn                    = var.kms_key_arn
  reserved_concurrent_executions = 20
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
      VAIC_REGION              = var.region
      VAIC_EVENT_BUS           = var.bus_name
      VAIC_LEDGER_TABLE        = var.ledger_table
      VAIC_PROFILE_PREFIX      = var.profile_prefix
      VAIC_APP_PROFILE_UTILITY = var.utility_profile_arn
      FILES_TABLE              = aws_dynamodb_table.this.name
      FILES_BUCKET             = aws_s3_bucket.this.bucket
      MEDIACONVERT_ROLE_ARN    = var.mediaconvert_role_arn
    }
  }
  tags = local.tags
}

# ---------- events: an object arrived, a MediaConvert or Transcribe job of ours finished ----------
resource "aws_sqs_queue" "dlq" {
  name                      = "${local.base}-events-dlq"
  message_retention_seconds = 1209600
  kms_master_key_id         = var.kms_key_arn
  tags                      = local.tags
}

locals {
  rules = {
    object-created = {
      description = "A file landed in the files bucket (an upload, or a department's drop)"
      pattern = {
        source        = ["aws.s3"]
        "detail-type" = ["Object Created"]
        detail = {
          bucket = { name = [aws_s3_bucket.this.bucket] }
          object = { key = [{ prefix = "files/" }, { prefix = "hires/" }] }
        }
      }
      input_paths    = { key = "$.detail.object.key" }
      input_template = "{\"action\": \"object_created\", \"key\": <key>}"
    }
    mediaconvert = {
      description = "A MediaConvert job started by Files finished or failed"
      pattern = {
        source        = ["aws.mediaconvert"]
        "detail-type" = ["MediaConvert Job State Change"]
        detail        = { status = ["COMPLETE", "ERROR"], userMetadata = { component = ["files"] } }
      }
      input_paths    = { detail = "$.detail" }
      input_template = "{\"action\": \"mediaconvert_done\", \"detail\": <detail>}"
    }
    transcribe = {
      description = "A Transcribe job started by Files finished or failed"
      pattern = {
        source        = ["aws.transcribe"]
        "detail-type" = ["Transcribe Job State Change"]
        detail        = { TranscriptionJobStatus = ["COMPLETED", "FAILED"], TranscriptionJobName = [{ prefix = "vaic-files-" }] }
      }
      input_paths    = { detail = "$.detail" }
      input_template = "{\"action\": \"transcribe_done\", \"detail\": <detail>}"
    }
  }
}

resource "aws_cloudwatch_event_rule" "this" {
  for_each       = local.rules
  name           = "${local.base}-${each.key}"
  description    = each.value.description
  event_bus_name = "default" # S3, MediaConvert and Transcribe send their events to the default bus
  event_pattern  = jsonencode(each.value.pattern)
  tags           = local.tags
}

resource "aws_cloudwatch_event_target" "this" {
  for_each       = local.rules
  rule           = aws_cloudwatch_event_rule.this[each.key].name
  event_bus_name = "default"
  target_id      = "files-${each.key}"
  arn            = aws_lambda_function.fn.arn
  input_transformer {
    input_paths    = each.value.input_paths
    input_template = each.value.input_template
  }
  retry_policy {
    maximum_event_age_in_seconds = 3600
    maximum_retry_attempts       = 10
  }
  dead_letter_config {
    arn = aws_sqs_queue.dlq.arn
  }
}

resource "aws_sqs_queue_policy" "dlq" {
  queue_url = aws_sqs_queue.dlq.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.dlq.arn
      Condition = { ArnEquals = { "aws:SourceArn" = [for r in aws_cloudwatch_event_rule.this : r.arn] } }
    }]
  })
}

resource "aws_lambda_permission" "events" {
  for_each      = local.rules
  statement_id  = "events-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.this[each.key].arn
}

# ---------- the api: the /files routes (records, presigned uploads and downloads, Try again) ----------
resource "aws_iam_policy" "api" {
  name = "${var.name}-api-files"
  tags = local.tags
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "FileRecords", Effect = "Allow", Action = local.table_rw, Resource = [aws_dynamodb_table.this.arn, "${aws_dynamodb_table.this.arn}/index/*"] },
      { Sid = "UploadAndShowFiles", Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"], Resource = ["${aws_s3_bucket.this.arn}/files/*"] },
      { Sid = "ShowThumbnails", Effect = "Allow", Action = ["s3:GetObject", "s3:DeleteObject"], Resource = ["${aws_s3_bucket.this.arn}/thumbs/*"] },
      { Sid = "DeleteWork", Effect = "Allow", Action = ["s3:DeleteObject"], Resource = ["${aws_s3_bucket.this.arn}/work/*"] },
      { Sid = "ListFile", Effect = "Allow", Action = ["s3:ListBucket"], Resource = [aws_s3_bucket.this.arn], Condition = { StringLike = { "s3:prefix" = ["files/*", "work/*"] } } },
      { Sid = "FilesKey", Effect = "Allow", Action = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"], Resource = [var.kms_key_arn] },
      { Sid = "EmbedSearches", Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = [local.embedding_model_arn] },
      { Sid = "DescribeAgain", Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = [aws_lambda_function.fn.arn] },
      # Signs CloudFront preview URLs (decision 156); the api is the only reader of the private key.
      { Sid = "SignPreviews", Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = [aws_secretsmanager_secret.signing.arn] },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api" {
  role       = var.api_role_name
  policy_arn = aws_iam_policy.api.arn
}

# ---------- the agents: search for VAIC, managers and workers; VAIC presigns the chat's previews ----------
resource "aws_iam_policy" "agents" {
  name = "${var.name}-agents-files"
  tags = local.tags
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "ReadFileRecords", Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:BatchGetItem"], Resource = [aws_dynamodb_table.this.arn, "${aws_dynamodb_table.this.arn}/index/*"] },
      { Sid = "EmbedSearches", Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = [local.embedding_model_arn] },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "agents" {
  for_each   = { for r, n in var.agent_role_names : r => n if contains(["vaic", "manager", "worker"], r) }
  role       = each.value
  policy_arn = aws_iam_policy.agents.arn
}

# VAIC signs the short-lived preview and download addresses of the files it shows in the chat (read only).
resource "aws_iam_policy" "vaic" {
  name = "${var.name}-vaic-files"
  tags = local.tags
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "ShowFilesInTheChat", Effect = "Allow", Action = ["s3:GetObject"], Resource = ["${aws_s3_bucket.this.arn}/files/*", "${aws_s3_bucket.this.arn}/thumbs/*"] },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "vaic" {
  role       = var.agent_role_names["vaic"]
  policy_arn = aws_iam_policy.vaic.arn
}

# Managers assume the session-tagged workspace role (tag mgr-…) to save into Files.
resource "aws_iam_policy" "manager_workspace" {
  name = "${var.name}-manager-files-workspace"
  tags = local.tags
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "AssumeOwnWorkspace", Effect = "Allow", Action = ["sts:AssumeRole", "sts:TagSession"], Resource = [var.workspace_role_arn] },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "manager_workspace" {
  role       = var.agent_role_names["manager"]
  policy_arn = aws_iam_policy.manager_workspace.arn
}

# The workspace role (assumed with the hire's id as a session tag): every hire reads all files; it writes only
# into its own hires/<its id>/files/ drop, which the files Lambda adopts and marks with the hire's department.
resource "aws_iam_role_policy" "workspace" {
  name = "files"
  role = var.workspace_role_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "ReadAllFiles", Effect = "Allow", Action = ["s3:GetObject"], Resource = ["${aws_s3_bucket.this.arn}/files/*"] },
      { Sid = "WriteOwnDropOnly", Effect = "Allow", Action = ["s3:PutObject", "s3:AbortMultipartUpload"], Resource = ["${aws_s3_bucket.this.arn}/hires/$${aws:PrincipalTag/hire_id}/files/*"] },
      { Sid = "FilesKey", Effect = "Allow", Action = ["kms:Decrypt", "kms:GenerateDataKey"], Resource = [var.kms_key_arn] },
    ]
  })
}

# ---------- previews through CloudFront, signed per view (decision 156) ----------
# The signing key pair is made inside Secrets Manager by a one-time Lambda: Terraform creates the empty secret, invokes
# the Lambda (which fills the secret only when it is empty) and gets back the public key alone. The private key is never
# in Terraform state, code, the deploy log or a person's hands.
resource "aws_secretsmanager_secret" "signing" {
  #checkov:skip=CKV2_AWS_57:The key pair is replaced by emptying the secret and re-applying; there is no rotation Lambda.
  name                    = local.signing_secret
  description             = "CloudFront signing key for Files' previews (private key; written only by the signing-key Lambda)"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 7
  tags                    = local.tags
}

resource "aws_cloudwatch_log_group" "signing" {
  #checkov:skip=CKV_AWS_338:Retention is the log_retention_days variable; the function logs nothing about the key.
  name              = "/aws/lambda/${local.base}-signing-key"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn
  tags              = local.tags
}

resource "aws_iam_role" "signing" {
  name                 = "${var.name}-fn-files-signing-key"
  permissions_boundary = var.boundary_arn
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "signing" {
  name = "make-the-key-pair"
  role = aws_iam_role.signing.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "Logs", Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.signing.arn}:*" },
      { Sid = "TheKeySecret", Effect = "Allow", Action = ["secretsmanager:GetSecretValue", "secretsmanager:PutSecretValue"], Resource = [aws_secretsmanager_secret.signing.arn] },
      { Sid = "Key", Effect = "Allow", Action = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"], Resource = var.kms_key_arn },
    ]
  })
}

resource "aws_lambda_function" "signing" {
  #checkov:skip=CKV_AWS_117:No VPC: it only talks to Secrets Manager.
  #checkov:skip=CKV_AWS_272:Code signing is not set up for a single-owner project.
  #checkov:skip=CKV_AWS_116:Invoked synchronously by Terraform only.
  #checkov:skip=CKV_AWS_115:Runs once per apply at most; no concurrency limit needed.
  #checkov:skip=CKV_AWS_50:X-Ray adds nothing to a one-call function.
  function_name    = "${local.base}-signing-key"
  role             = aws_iam_role.signing.arn
  runtime          = "python3.13"
  architectures    = ["arm64"]
  handler          = "vaic.lambdas.files.signing_key_handler"
  filename         = var.lambda_zip_path
  source_code_hash = var.lambda_zip_hash
  timeout          = 30
  memory_size      = 256
  kms_key_arn      = var.kms_key_arn
  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.signing.name
  }
  environment {
    variables = { FILES_SIGNING_SECRET = aws_secretsmanager_secret.signing.name }
  }
  tags       = local.tags
  depends_on = [aws_iam_role_policy.signing]
}

# Only the public key comes back (and so only it is in state).
resource "aws_lambda_invocation" "signing" {
  function_name = aws_lambda_function.signing.function_name
  input         = jsonencode({ action = "signing_key", secret = aws_secretsmanager_secret.signing.name })
}

resource "aws_cloudfront_public_key" "previews" {
  name        = "${local.base}-previews"
  comment     = "Files' preview signing key (the private key is in Secrets Manager only)"
  encoded_key = jsondecode(aws_lambda_invocation.signing.result).public_key_pem
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_cloudfront_key_group" "previews" {
  name    = "${local.base}-previews"
  comment = "Signs Files' preview and thumbnail URLs"
  items   = [aws_cloudfront_public_key.previews.id]
}

resource "aws_cloudfront_origin_access_control" "files" {
  name                              = local.base
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "previews" {
  #checkov:skip=CKV_AWS_86:Access logging needs a log bucket with ACLs; every view is a short-lived signed URL the api issued.
  #checkov:skip=CKV_AWS_174:The default certificate enforces TLS 1.2 on *.cloudfront.net; no custom domain.
  #checkov:skip=CKV_AWS_310:One private S3 origin; failover is not needed.
  #checkov:skip=CKV_AWS_374:No geo restriction: the owner travels.
  #checkov:skip=CKV2_AWS_42:Custom certificate only with a custom domain (not configured).
  #checkov:skip=CKV_AWS_305:No root object: every request is one signed object.
  #checkov:skip=CKV2_AWS_47:Every request must carry a valid signature from the trusted key group; nothing is public.
  #checkov:skip=CKV_AWS_68:No WAF: unsigned requests are refused at the edge before any origin access.
  enabled         = true
  comment         = "AI City Files previews and thumbnails (signed URLs only)"
  price_class     = "PriceClass_100"
  http_version    = "http2and3"
  is_ipv6_enabled = true
  origin {
    origin_id                = "files"
    domain_name              = aws_s3_bucket.this.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.files.id
  }
  default_cache_behavior {
    target_origin_id       = "files"
    viewer_protocol_policy = "https-only"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    trusted_key_groups     = [aws_cloudfront_key_group.previews.id]
    # Managed-CachingOptimized: the query string (the signature) is not part of the cache key, so a thumbnail is
    # fetched from S3 once and served from the edge to every later signed view.
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }
  tags = local.tags
}

output "bucket" { value = aws_s3_bucket.this.bucket }
output "cdn_url" { value = "https://${aws_cloudfront_distribution.previews.domain_name}" }
output "cdn_key_id" { value = aws_cloudfront_public_key.previews.id }
output "signing_secret" { value = aws_secretsmanager_secret.signing.name }
output "bucket_arn" { value = aws_s3_bucket.this.arn }
output "table" { value = aws_dynamodb_table.this.name }
output "table_arn" { value = aws_dynamodb_table.this.arn }
output "function_name" { value = aws_lambda_function.fn.function_name }
output "function_arn" { value = aws_lambda_function.fn.arn }
output "dlq_name" { value = aws_sqs_queue.dlq.name }
