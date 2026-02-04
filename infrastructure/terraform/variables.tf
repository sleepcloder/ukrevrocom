variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1" # Frankfurt - closest to Ukraine
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "ukrevrocom"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

# EC2 Configuration
variable "ec2_instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t4g.micro" # ARM-based, free tier eligible, cheapest option
}

variable "ec2_key_name" {
  description = "Name of the SSH key pair"
  type        = string
  default     = "ukrevrocom-key"
}

# RDS Configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro" # ARM-based, free tier eligible
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "ukrevrocom"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "ukrevrocom_admin"
  sensitive   = true
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["eu-central-1a", "eu-central-1b"]
}
