# Apps the city builds (docs/APPS.md): agent-written web apps on their own origin. A dedicated bucket
# behind a second CloudFront distribution (its own *.cloudfront.net domain), with a strict CSP that
# lets an app run scripts but reach nothing: no network, no frames, no forms. The HUD shows it only
# inside a sandboxed iframe. Same WAF web ACL as the HUD. The deploy uploads nothing here: the apps
# Lambda writes drafts/, the API writes live/ after the owner approves.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.68.0, < 7.0.0" }
  }
}

variable "name" { type = string }
variable "waf_acl_arn" {
  type        = string
  description = "The HUD's WAF web ACL (CLOUDFRONT scope, us-east-1), shared by the apps distribution."
}
variable "draft_expiry_days" {
  type    = number
  default = 30
}

locals {
  tags = { Component = "apps" }
  # frame-ancestors cannot name the HUD's exact domain: the HUD's CSP names this origin, so naming the
  # HUD here would make the two distributions depend on each other. The wildcard is the accepted
  # residual risk (docs/SECURITY.md); a custom domain removes it.
  csp = join("; ", [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'none'",
    "worker-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors https://*.cloudfront.net",
  ])
}

resource "aws_s3_bucket" "apps" {
  #checkov:skip=CKV_AWS_144:Drafts are rebuilt by the city and live apps can be republished; replication adds nothing.
  #checkov:skip=CKV_AWS_18:Access logging would need another bucket; CloudFront is the only reader.
  #checkov:skip=CKV2_AWS_62:No event notifications are needed; the apps Lambda is driven by app.submitted on the bus.
  #checkov:skip=CKV_AWS_145:SSE-S3 so CloudFront with OAC can read it (like the HUD bucket); it holds only public app files, never owner data.
  bucket        = "${var.name}-apps"
  force_destroy = false
  tags          = local.tags
}

resource "aws_s3_bucket_versioning" "apps" {
  bucket = aws_s3_bucket.apps.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "apps" {
  bucket = aws_s3_bucket.apps.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "apps" {
  bucket                  = aws_s3_bucket.apps.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "apps" {
  bucket = aws_s3_bucket.apps.id
  rule {
    id     = "drafts"
    status = "Enabled"
    filter {
      prefix = "drafts/"
    }
    expiration {
      days = var.draft_expiry_days
    }
  }
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

resource "aws_cloudfront_origin_access_control" "apps" {
  name                              = "${var.name}-apps"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "apps" {
  name = "${var.name}-apps-headers"
  # An opaque-origin document (sandbox without allow-same-origin) needs CORS for type="module" scripts.
  # Nothing on this origin is secret and it sets no cookies.
  cors_config {
    access_control_allow_credentials = false
    origin_override                  = true
    access_control_max_age_sec       = 600
    access_control_allow_origins {
      items = ["*"]
    }
    access_control_allow_methods {
      items = ["GET", "HEAD"]
    }
    access_control_allow_headers {
      items = ["*"]
    }
  }
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
    referrer_policy {
      referrer_policy = "no-referrer"
      override        = true
    }
    # No X-Frame-Options: apps must be framed by the HUD; frame-ancestors in the CSP governs that.
  }
  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = "camera=(), microphone=(), geolocation=(), usb=(), payment=(), clipboard-read=()"
      override = true
    }
  }
}

resource "aws_cloudfront_distribution" "apps" {
  #checkov:skip=CKV_AWS_86:Access logging needs a log bucket with ACLs; WAF logs and metrics cover the one owner's traffic.
  #checkov:skip=CKV_AWS_174:Uses the default CloudFront certificate, which enforces TLS 1.2 for viewers on *.cloudfront.net; a custom domain can be added later.
  #checkov:skip=CKV_AWS_310:A single S3 origin; failover is not needed for the owner's apps.
  #checkov:skip=CKV_AWS_374:No geo restriction: the owner travels.
  #checkov:skip=CKV2_AWS_42:Custom certificate only with a custom domain (not configured).
  #checkov:skip=CKV_AWS_305:No default root object on purpose: apps live under live/<app_id>/ and the root serves nothing.
  #checkov:skip=CKV2_AWS_47:The HUD's web ACL with the AWS managed common rules is attached; the Log4j rule is in KnownBadInputs, also attached.
  enabled         = true
  comment         = "AI City apps (agent-built, sandboxed)"
  price_class     = "PriceClass_100"
  http_version    = "http2and3"
  is_ipv6_enabled = true
  web_acl_id      = var.waf_acl_arn
  origin {
    origin_id                = "apps"
    domain_name              = aws_s3_bucket.apps.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.apps.id
  }
  default_cache_behavior {
    target_origin_id           = "apps"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized; objects carry their own Cache-Control
    response_headers_policy_id = aws_cloudfront_response_headers_policy.apps.id
  }
  # No SPA error rewrite and no default root object: a missing file is a plain 403/404.
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

resource "aws_s3_bucket_policy" "apps" {
  bucket = aws_s3_bucket.apps.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "CloudFrontOnly"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.apps.arn}/*"
        Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.apps.arn } }
      },
      {
        Sid       = "TlsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.apps.arn, "${aws_s3_bucket.apps.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      },
    ]
  })
}

output "bucket" { value = aws_s3_bucket.apps.bucket }
output "bucket_arn" { value = aws_s3_bucket.apps.arn }
output "distribution_id" { value = aws_cloudfront_distribution.apps.id }
output "distribution_arn" { value = aws_cloudfront_distribution.apps.arn }
output "url" { value = "https://${aws_cloudfront_distribution.apps.domain_name}" }
