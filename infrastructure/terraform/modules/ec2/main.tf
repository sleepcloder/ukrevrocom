# EC2 Module - Creates the application server

variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "instance_type" {
  type    = string
  default = "t4g.micro"
}

variable "key_name" {
  type = string
}

variable "db_host" {
  type = string
}

variable "db_name" {
  type = string
}

variable "db_username" {
  type = string
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "ecr_repository_url" {
  type = string
}

variable "aws_region" {
  type = string
}

# Get latest Amazon Linux 2023 AMI (ARM64 for t4g instances)
data "aws_ami" "amazon_linux_2023_arm" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-arm64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Security Group for EC2
resource "aws_security_group" "ec2" {
  name        = "${var.project_name}-${var.environment}-ec2-sg"
  description = "Security group for EC2 instance"
  vpc_id      = var.vpc_id

  # SSH access (restrict to your IP in production)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # TODO: Restrict to your IP
    description = "SSH access"
  }

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP access"
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS access"
  }

  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-ec2-sg"
  }
}

# IAM Role for EC2
resource "aws_iam_role" "ec2" {
  name = "${var.project_name}-${var.environment}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy for ECR access
resource "aws_iam_role_policy" "ecr_access" {
  name = "${var.project_name}-${var.environment}-ecr-access"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.project_name}-*",
          "arn:aws:s3:::${var.project_name}-*/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:*:*:parameter/${var.project_name}/*"
      }
    ]
  })
}

# Attach SSM policy for Session Manager (optional, for SSH-less access)
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Instance Profile
resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project_name}-${var.environment}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# User Data script for initial setup
locals {
  user_data = <<-EOF
    #!/bin/bash
    set -e

    # Update system
    dnf update -y

    # Install Docker
    dnf install -y docker
    systemctl start docker
    systemctl enable docker
    usermod -aG docker ec2-user

    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

    # Install AWS CLI v2
    curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
    dnf install -y unzip
    unzip awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip

    # Install Nginx
    dnf install -y nginx
    systemctl start nginx
    systemctl enable nginx

    # Install Certbot for SSL
    dnf install -y certbot python3-certbot-nginx

    # Create app directory
    mkdir -p /opt/ukrevrocom
    chown ec2-user:ec2-user /opt/ukrevrocom

    # Create environment file
    cat > /opt/ukrevrocom/.env <<'ENVFILE'
    DATABASE_URL=postgresql://${var.db_username}:${var.db_password}@${var.db_host}:5432/${var.db_name}
    DB_HOST=${var.db_host}
    DB_PORT=5432
    DB_NAME=${var.db_name}
    DB_USER=${var.db_username}
    DB_PASSWORD=${var.db_password}
    AWS_REGION=${var.aws_region}
    ECR_REPOSITORY=${var.ecr_repository_url}
    ENVIRONMENT=${var.environment}
    ENVFILE

    chmod 600 /opt/ukrevrocom/.env
    chown ec2-user:ec2-user /opt/ukrevrocom/.env

    # Create docker-compose.yml
    cat > /opt/ukrevrocom/docker-compose.yml <<'COMPOSE'
    version: '3.8'

    services:
      backend:
        image: ${var.ecr_repository_url}:backend-latest
        container_name: ukrevrocom-backend
        restart: unless-stopped
        env_file:
          - .env
        environment:
          - PORT=8000
        ports:
          - "8000:8000"
        healthcheck:
          test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
          interval: 30s
          timeout: 10s
          retries: 3

      frontend:
        image: ${var.ecr_repository_url}:frontend-latest
        container_name: ukrevrocom-frontend
        restart: unless-stopped
        env_file:
          - .env
        environment:
          - PORT=3000
          - NEXT_PUBLIC_API_URL=http://backend:8000
        ports:
          - "3000:3000"
        depends_on:
          - backend
        healthcheck:
          test: ["CMD", "curl", "-f", "http://localhost:3000"]
          interval: 30s
          timeout: 10s
          retries: 3
    COMPOSE

    chown ec2-user:ec2-user /opt/ukrevrocom/docker-compose.yml

    # Create Nginx config
    cat > /etc/nginx/conf.d/ukrevrocom.conf <<'NGINX'
    upstream frontend {
        server 127.0.0.1:3000;
    }

    upstream backend {
        server 127.0.0.1:8000;
    }

    server {
        listen 80;
        server_name _;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Backend API
        location /api {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check endpoint
        location /health {
            proxy_pass http://backend/health;
        }
    }
    NGINX

    # Remove default nginx config
    rm -f /etc/nginx/conf.d/default.conf

    # Restart nginx
    systemctl restart nginx

    # Create deployment script
    cat > /opt/ukrevrocom/deploy.sh <<'DEPLOY'
    #!/bin/bash
    set -e

    cd /opt/ukrevrocom

    # Login to ECR
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${var.ecr_repository_url}

    # Pull latest images
    docker-compose pull

    # Restart services
    docker-compose up -d

    # Cleanup old images
    docker image prune -f

    echo "Deployment completed successfully!"
    DEPLOY

    chmod +x /opt/ukrevrocom/deploy.sh
    chown ec2-user:ec2-user /opt/ukrevrocom/deploy.sh

    echo "EC2 initialization completed!"
  EOF
}

# EC2 Instance
resource "aws_instance" "app" {
  ami                    = data.aws_ami.amazon_linux_2023_arm.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  root_block_device {
    volume_size           = 30 # GB - free tier eligible
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  user_data = base64encode(local.user_data)

  tags = {
    Name = "${var.project_name}-${var.environment}-app"
  }

  lifecycle {
    ignore_changes = [ami, user_data]
  }
}

# Elastic IP
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-${var.environment}-eip"
  }
}

# Outputs
output "instance_id" {
  value = aws_instance.app.id
}

output "public_ip" {
  value = aws_eip.app.public_ip
}

output "private_ip" {
  value = aws_instance.app.private_ip
}

output "security_group_id" {
  value = aws_security_group.ec2.id
}
