# Terraform Outputs

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "ec2_public_ip" {
  description = "EC2 Public IP (Elastic IP)"
  value       = module.ec2.public_ip
}

output "ec2_instance_id" {
  description = "EC2 Instance ID"
  value       = module.ec2.instance_id
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.endpoint
}

output "rds_address" {
  description = "RDS address (hostname only)"
  value       = module.rds.address
}

output "ecr_repository_url" {
  description = "ECR Repository URL"
  value       = module.ecr.repository_url
}

output "s3_backups_bucket" {
  description = "S3 Backups Bucket Name"
  value       = module.s3.backups_bucket_name
}

output "s3_static_bucket" {
  description = "S3 Static Assets Bucket Name"
  value       = module.s3.static_bucket_name
}

output "ssh_command" {
  description = "SSH command to connect to EC2"
  value       = "ssh -i ~/.ssh/id_rsa ec2-user@${module.ec2.public_ip}"
}

output "deploy_command" {
  description = "Command to deploy on EC2"
  value       = "ssh -i ~/.ssh/id_rsa ec2-user@${module.ec2.public_ip} '/opt/ukrevrocom/deploy.sh'"
}

output "database_connection_string" {
  description = "Database connection string"
  value       = "postgresql://${var.db_username}:****@${module.rds.address}:5432/${var.db_name}"
  sensitive   = true
}
