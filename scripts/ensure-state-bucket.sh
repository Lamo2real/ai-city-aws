#!/usr/bin/env bash
# Run by deploy.yml (never from an agent session). Makes sure the Terraform state bucket exists, so the
# owner only has to provide the OIDC deploy role. The name is derived from the account and region:
#   aic-prod-tfstate-<account-id>-<region>
# Created once: private, versioned, encrypted (SSE-KMS with the AWS-managed key), TLS-only, tagged.
# Prints the bucket name, and writes bucket=<name> to $GITHUB_OUTPUT when it is set.
set -euo pipefail
: "${AWS_REGION:?AWS_REGION must be set}"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="aic-prod-tfstate-${ACCOUNT}-${AWS_REGION}"

if aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
  echo "State bucket ${BUCKET} already exists."
else
  echo "Creating state bucket ${BUCKET} ..."
  if [ "$AWS_REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_REGION" \
      --create-bucket-configuration "LocationConstraint=${AWS_REGION}" >/dev/null
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
    'TagSet=[{Key=Project,Value=ai-city},{Key=App,Value=aic},{Key=Environment,Value=prod},{Key=ManagedBy,Value=deploy.yml},{Key=CostCenter,Value=ai-city},{Key=Component,Value=terraform-state}]'
  echo "Created ${BUCKET}."
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "bucket=${BUCKET}" >>"$GITHUB_OUTPUT"; fi
echo "$BUCKET"
