# Main Terraform configuration
# This file orchestrates all modules

# SSH Key Pair
resource "aws_key_pair" "main" {
  key_name   = var.ec2_key_name
  public_key = file("~/.ssh/id_rsa.pub") # Or use: var.ssh_public_key

  tags = {
    Name = "${var.project_name}-${var.environment}-key"
  }
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
}

# ECR Module
module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
  environment  = var.environment
}

# S3 Module
module "s3" {
  source = "./modules/s3"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region
}

# RDS Module
module "rds" {
  source = "./modules/rds"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.private_subnet_ids
  ec2_security_group_id = module.ec2.security_group_id
  instance_class        = var.db_instance_class
  db_name               = var.db_name
  db_username           = var.db_username

  depends_on = [module.ec2]
}

# EC2 Module
module "ec2" {
  source = "./modules/ec2"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  subnet_id          = module.vpc.public_subnet_ids[0]
  instance_type      = var.ec2_instance_type
  key_name           = aws_key_pair.main.key_name
  ecr_repository_url = module.ecr.repository_url
  aws_region         = var.aws_region

  # Database configuration (will be updated after RDS is created)
  db_host     = "pending" # Placeholder, updated after apply
  db_name     = var.db_name
  db_username = var.db_username
  db_password = "pending" # Placeholder, updated after apply

  depends_on = [module.vpc, module.ecr]
}
