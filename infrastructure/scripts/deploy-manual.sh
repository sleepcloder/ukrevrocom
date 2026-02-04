#!/bin/bash
# Manual deployment script
# Run this locally to deploy without GitHub Actions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load environment variables
if [ -f "$SCRIPT_DIR/../docker/.env" ]; then
    source "$SCRIPT_DIR/../docker/.env"
fi

# Required variables
AWS_REGION=${AWS_REGION:-eu-central-1}
ECR_REPOSITORY=${ECR_REPOSITORY:-}
EC2_HOST=${EC2_HOST:-}
SSH_KEY=${SSH_KEY:-~/.ssh/id_rsa}

if [ -z "$ECR_REPOSITORY" ] || [ -z "$EC2_HOST" ]; then
    echo "Error: ECR_REPOSITORY and EC2_HOST must be set"
    echo "Set them in infrastructure/docker/.env or as environment variables"
    exit 1
fi

echo "=== UkrEvrocom Manual Deployment ==="
echo ""
echo "ECR Repository: $ECR_REPOSITORY"
echo "EC2 Host: $EC2_HOST"
echo "AWS Region: $AWS_REGION"
echo ""

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REPOSITORY"

# Build and push backend
echo ""
echo "Building backend..."
cd "$PROJECT_ROOT/backend"
docker build --platform linux/arm64 -t "$ECR_REPOSITORY:backend-latest" .

echo "Pushing backend..."
docker push "$ECR_REPOSITORY:backend-latest"

# Build and push frontend
echo ""
echo "Building frontend..."
cd "$PROJECT_ROOT/frontend"
docker build --platform linux/arm64 \
    --build-arg NEXT_PUBLIC_API_URL=/api \
    -t "$ECR_REPOSITORY:frontend-latest" .

echo "Pushing frontend..."
docker push "$ECR_REPOSITORY:frontend-latest"

# Deploy to EC2
echo ""
echo "Deploying to EC2..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ec2-user@$EC2_HOST" << 'ENDSSH'
cd /opt/ukrevrocom

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPOSITORY

# Pull latest images
docker-compose pull

# Restart services
docker-compose up -d --remove-orphans

# Health check
sleep 10
curl -f http://localhost:8000/health || exit 1
curl -f http://localhost:3000 || exit 1

# Cleanup
docker image prune -f

echo "Deployment completed!"
ENDSSH

echo ""
echo "=== Deployment Successful ==="
echo "Application is live at: http://$EC2_HOST"
