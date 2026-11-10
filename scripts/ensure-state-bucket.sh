#!/usr/bin/env bash
# Run by deploy.yml (never from an agent session). Makes sure the Terraform state bucket exists, so the
# owner only has to provide the OIDC deploy role.
#   STATE_BUCKET  bucket name (deploy.yml: VAIC_STATE_BUCKET, default lamo-labs-state-bucket)
#   AWS_REGION    region to create it in if it does not exist yet
# An existing bucket is used as it is (its settings are not touched) and its own region is reported,
# because the S3 backend must use the bucket's region. A missing bucket is created private, versioned,
# encrypted (SSE-KMS with the AWS-managed key), TLS-only and tagged.
# Writes bucket=<name> and region=<region> to $GITHUB_OUTPUT when it is set.
set -euo pipefail
: "${STATE_BUCKET:?STATE_BUCKET must be set}" "${AWS_REGION:?AWS_REGION must be set}"
BUCKET="$STATE_BUCKET"

if err="$(aws s3api head-bucket --bucket "$BUCKET" 2>&1 >/dev/null)"; then
  loc="$(aws s3api get-bucket-location --bucket "$BUCKET" --query LocationConstraint --output text)"
  case "$loc" in None | null | "") REGION="us-east-1" ;; EU) REGION="eu-west-1" ;; *) REGION="$loc" ;; esac
  echo "State bucket ${BUCKET} already exists (region ${REGION}); using it as it is."
elif printf '%s' "$err" | grep -q '404\|Not Found'; then
  REGION="$AWS_REGION"
  echo "Creating state bucket ${BUCKET} in ${REGION} ..."
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration "LocationConstraint=${REGION}" >/dev/null
  fi
  aws s3api wait bucket-exists --bucket "$BUCKET"
  aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
  aws s3api put-bucket-ownership-controls --bucket "$BUCKET" \
    --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'
  aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
  aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"},"BucketKeyEnabled":true}]}'
  aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"TlsOnly\",\"Effect\":\"Deny\",\"Principal\":\"*\",\"Action\":\"s3:*\",\"Resource\":[\"arn:aws:s3:::${BUCKET}\",\"arn:aws:s3:::${BUCKET}/*\"],\"Condition\":{\"Bool\":{\"aws:SecureTransport\":\"false\"}}}]}"
  aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration \
    '{"Rules":[{"ID":"old-state-versions","Status":"Enabled","Filter":{},"NoncurrentVersionExpiration":{"NoncurrentDays":90},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":7}}]}'
  aws s3api put-bucket-tagging --bucket "$BUCKET" --tagging \
    'TagSet=[{Key=Project,Value=ai-city},{Key=App,Value=vaic},{Key=Environment,Value=prod},{Key=ManagedBy,Value=deploy.yml},{Key=CostCenter,Value=ai-city},{Key=Component,Value=terraform-state}]'
  echo "Created ${BUCKET}."
else
  echo "::error::State bucket ${BUCKET} exists but this role cannot use it (owned by another account, or missing s3 permissions): ${err}"
  exit 1
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "bucket=${BUCKET}" >>"$GITHUB_OUTPUT"
  echo "region=${REGION}" >>"$GITHUB_OUTPUT"
fi
echo "$BUCKET $REGION"
