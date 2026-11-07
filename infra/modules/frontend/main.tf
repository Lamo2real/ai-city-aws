# The HUD: a private S3 bucket behind CloudFront with Origin Access Control, HTTPS only, security
# headers and a strict Content Security Policy, and AWS WAF (managed common rules, IP reputation,
# rate limit). WAF for CloudFront lives in us-east-1, hence the aliased provider.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0", configuration_aliases = [aws.us_east_1] }
  }
}

variable "name" { type = string }
variable "region" { type = string }
variable "apps_url" {
  type        = string
  description = "The apps origin (https://<id>.cloudfront.net). The HUD may frame it and load icons from it, nothing else."
}
variable "rate_limit_per_5min" {
  type    = number
  default = 1000
}

locals {
  tags = { Component = "frontend" }
  # The browser talks only to: itself, the API and WebSocket, Cognito, and the voice services.
  # It frames (and loads icons from) the apps origin only; connect-src never names it.
  csp = join("; ", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data: blob: ${var.apps_url}",
    "media-src 'self' blob:",
    "connect-src 'self' https://*.execute-api.${var.region}.amazonaws.com wss://*.execute-api.${var.region}.amazonaws.com https://*.auth.${var.region}.amazoncognito.com https://cognito-idp.${var.region}.amazonaws.com https://cognito-identity.${var.region}.amazonaws.com https://transcribestreaming.${var.region}.amazonaws.com wss://transcribestreaming.${var.region}.amazonaws.com:8443 https://polly.${var.region}.amazonaws.com https://${var.name}-knowledge.s3.${var.region}.amazonaws.com https://${var.name}-knowledge.s3.amazonaws.com",
    "frame-src ${var.apps_url}",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self' https://*.auth.${var.region}.amazoncognito.com",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ])
}

resource "aws_s3_bucket" "site" {
  #checkov:skip=CKV_AWS_144:The site is rebuilt from Git on every deploy; replication adds nothing.
  #checkov:skip=CKV_AWS_18:Access logging would need another bucket; CloudFront is the only reader.
  #checkov:skip=CKV2_AWS_62:No event notifications are needed.
  #checkov:skip=CKV_AWS_145:The site bucket uses SSE-S3 so CloudFront with OAC can read it without a KMS key policy dance; it holds only public app files.
  bucket = "${var.name}-hud"
  tags   = local.tags
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    id     = "old-builds"
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

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.name}-hud"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "security" {
  name = "${var.name}-security-headers"
  security_headers_config {
    content_security_policy {
      content_security_policy = local.csp
      override                = true
    }
    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "no-referrer"
      override        = true
    }
  }
  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = "microphone=(self), camera=(), geolocation=()"
      override = true
    }
  }
}

resource "aws_wafv2_web_acl" "site" {
  provider = aws.us_east_1
  name     = "${var.name}-hud"
  scope    = "CLOUDFRONT"
  default_action {
    allow {}
  }
  rule {
    name     = "common"
    priority = 1
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "common"
      sampled_requests_enabled   = true
    }
  }
  rule {
    name     = "ip-reputation"
    priority = 2
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "ip-reputation"
      sampled_requests_enabled   = true
    }
  }
  rule {
    name     = "known-bad-inputs"
    priority = 3
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }
  rule {
    name     = "rate-limit"
    priority = 4
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.rate_limit_per_5min
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit"
      sampled_requests_enabled   = true
    }
  }
  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name}-hud"
    sampled_requests_enabled   = true
  }
  tags = local.tags
}

resource "aws_cloudwatch_log_group" "waf" {
  #checkov:skip=CKV_AWS_338:WAF logs are kept 30 days to keep cost low.
  provider          = aws.us_east_1
  name              = "aws-waf-logs-${var.name}-hud"
  retention_in_days = 30
  tags              = local.tags
  #checkov:skip=CKV_AWS_158:WAF logs live in us-east-1, where the data key does not; they carry no secrets.
}

resource "aws_wafv2_web_acl_logging_configuration" "site" {
  provider                = aws.us_east_1
  resource_arn            = aws_wafv2_web_acl.site.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
  redacted_fields {
    single_header {
      name = "authorization"
    }
  }
}

resource "aws_cloudfront_distribution" "site" {
  #checkov:skip=CKV_AWS_86:Access logging needs a log bucket with ACLs; WAF logs and metrics cover the one owner's traffic.
  #checkov:skip=CKV_AWS_174:Uses the default CloudFront certificate, which enforces TLS 1.2 for viewers on *.cloudfront.net; a custom domain can be added later.
  #checkov:skip=CKV_AWS_310:A single S3 origin; failover is not needed for a personal HUD.
  #checkov:skip=CKV_AWS_374:No geo restriction: the owner travels.
  #checkov:skip=CKV2_AWS_42:Custom certificate only with a custom domain (not configured).
  #checkov:skip=CKV2_AWS_47:The AWS managed common rules are attached; the Log4j rule is in KnownBadInputs, also attached.
  enabled             = true
  comment             = "AI City HUD"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  http_version        = "http2and3"
  web_acl_id          = aws_wafv2_web_acl.site.arn
  origin {
    origin_id                = "hud"
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }
  default_cache_behavior {
    target_origin_id           = "hud"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }
  # The single-page app answers every path with index.html.
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
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

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "CloudFrontOnly"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.site.arn}/*"
        Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.site.arn } }
      },
      {
        Sid       = "TlsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.site.arn, "${aws_s3_bucket.site.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      },
    ]
  })
}

output "bucket" { value = aws_s3_bucket.site.bucket }
output "distribution_id" { value = aws_cloudfront_distribution.site.id }
output "waf_acl_arn" { value = aws_wafv2_web_acl.site.arn }
output "url" { value = "https://${aws_cloudfront_distribution.site.domain_name}" }
