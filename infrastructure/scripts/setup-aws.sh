#!/bin/bash
# AWS Setup Script
# Run this once to prepare your AWS account for the infrastructure

set -e

echo "=== UkrEvrocom AWS Setup ==="
echo ""

# Check prerequisites
command -v aws >/dev/null 2>&1 || { echo "AWS CLI is required but not installed. Aborting." >&2; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "Terraform is required but not installed. Aborting." >&2; exit 1; }

# Check AWS credentials
echo "Checking AWS credentials..."
aws sts get-caller-identity || { echo "AWS credentials not configured. Run 'aws configure' first." >&2; exit 1; }

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-eu-central-1}

echo ""
echo "AWS Account: $AWS_ACCOUNT_ID"
echo "AWS Region: $AWS_REGION"
echo ""

# Create S3 bucket for Terraform state (optional but recommended)
BUCKET_NAME="ukrevrocom-terraform-state-${AWS_ACCOUNT_ID}"
echo "Creating S3 bucket for Terraform state: $BUCKET_NAME"

if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo "Bucket already exists, skipping..."
else
    aws s3api create-bucket \
        --bucket "$BUCKET_NAME" \
        --region "$AWS_REGION" \
        --create-bucket-configuration LocationConstraint="$AWS_REGION"

    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "$BUCKET_NAME" \
        --versioning-configuration Status=Enabled

    # Enable encryption
    aws s3api put-bucket-encryption \
        --bucket "$BUCKET_NAME" \
        --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

    # Block public access
    aws s3api put-public-access-block \
        --bucket "$BUCKET_NAME" \
        --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

    echo "Bucket created successfully!"
fi

# Create DynamoDB table for state locking (optional but recommended)
TABLE_NAME="terraform-state-lock"
echo ""
echo "Creating DynamoDB table for state locking: $TABLE_NAME"

if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$AWS_REGION" 2>/dev/null; then
    echo "Table already exists, skipping..."
else
    aws dynamodb create-table \
        --table-name "$TABLE_NAME" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "$AWS_REGION"

    echo "Table created successfully!"
fi

# Create IAM user for GitHub Actions
echo ""
echo "Creating IAM user for GitHub Actions: github-actions-ukrevrocom"

if aws iam get-user --user-name github-actions-ukrevrocom 2>/dev/null; then
    echo "User already exists, skipping..."
else
    aws iam create-user --user-name github-actions-ukrevrocom

    # Create access key
    echo ""
    echo "Creating access key (save these credentials!):"
    aws iam create-access-key --user-name github-actions-ukrevrocom
fi

# Attach policies to the user
echo ""
echo "Attaching policies to GitHub Actions user..."

# Create custom policy
POLICY_DOCUMENT='{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:PutImage",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ec2:DescribeInstances",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeSubnets",
                "ec2:DescribeVpcs"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ssm:GetParameter",
                "ssm:GetParameters"
            ],
            "Resource": "arn:aws:ssm:*:*:parameter/ukrevrocom/*"
        }
    ]
}'

POLICY_NAME="github-actions-ukrevrocom-policy"
POLICY_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${POLICY_NAME}"

if aws iam get-policy --policy-arn "$POLICY_ARN" 2>/dev/null; then
    echo "Policy already exists, skipping..."
else
    aws iam create-policy \
        --policy-name "$POLICY_NAME" \
        --policy-document "$POLICY_DOCUMENT"
fi

aws iam attach-user-policy \
    --user-name github-actions-ukrevrocom \
    --policy-arn "$POLICY_ARN" 2>/dev/null || true

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Save the access key credentials above"
echo "2. Add them to GitHub repository secrets"
echo "3. Update infrastructure/terraform/versions.tf to enable S3 backend"
echo "4. Run 'cd infrastructure/terraform && terraform init'"
echo ""
