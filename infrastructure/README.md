# UkrEvrocom Infrastructure

AWS infrastructure for UkrEvrocom project with Terraform, Docker, and GitHub Actions CI/CD.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Cloud                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    VPC (10.0.0.0/16)                     │   │
│  │  ┌──────────────────┐    ┌──────────────────┐          │   │
│  │  │  Public Subnet   │    │  Private Subnet  │          │   │
│  │  │   10.0.1.0/24    │    │   10.0.2.0/24    │          │   │
│  │  │                  │    │                  │          │   │
│  │  │  ┌────────────┐  │    │  ┌────────────┐  │          │   │
│  │  │  │   EC2      │  │    │  │    RDS     │  │          │   │
│  │  │  │ t4g.micro  │──┼────┼─▶│ PostgreSQL │  │          │   │
│  │  │  │ (ARM)      │  │    │  │ db.t4g.micro│ │          │   │
│  │  │  │            │  │    │  └────────────┘  │          │   │
│  │  │  │ ┌────────┐ │  │    │                  │          │   │
│  │  │  │ │ Docker │ │  │    │                  │          │   │
│  │  │  │ │Compose │ │  │    │                  │          │   │
│  │  │  │ └────────┘ │  │    │                  │          │   │
│  │  │  └────────────┘  │    │                  │          │   │
│  │  └──────────────────┘    └──────────────────┘          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │   ECR   │  │   S3    │  │   SSM   │  │  Route  │            │
│  │ Images  │  │ Backups │  │ Params  │  │   53    │            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Cost Estimation

| Component | Free Tier (12 months) | After Free Tier |
|-----------|----------------------|-----------------|
| EC2 t4g.micro | $0 | ~$6/month |
| RDS db.t4g.micro | $0 | ~$12-15/month |
| EBS 30GB | $0 | ~$3/month |
| Elastic IP | $3.60/month | $3.60/month |
| Data Transfer | 100GB free | ~$0-5/month |
| **Total** | **~$3.60/month** | **~$25-30/month** |

## Prerequisites

1. **AWS Account** with admin access
2. **AWS CLI** installed and configured
3. **Terraform** >= 1.0 installed
4. **Docker** and Docker Compose installed
5. **SSH key pair** (`~/.ssh/id_rsa` and `~/.ssh/id_rsa.pub`)

## Quick Start

### 1. Initial Setup

```bash
# Clone the repository
git clone https://github.com/sleepcloder/ukrevrocom.git
cd ukrevrocom/infrastructure/terraform

# Copy and edit variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

### 2. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply changes
terraform apply
```

### 3. Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access key with ECR and EC2 permissions |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `EC2_HOST` | EC2 public IP (from Terraform output) |
| `EC2_SSH_KEY` | Private SSH key content |
| `ECR_REGISTRY` | ECR registry URL (from Terraform output) |
| `DB_USERNAME` | Database username |

### 4. Deploy Application

Push to `master` branch to trigger automatic deployment:

```bash
git push origin master
```

Or manually trigger via GitHub Actions:
1. Go to Actions → Deploy to AWS
2. Click "Run workflow"
3. Select target (all, backend, frontend)

## Directory Structure

```
infrastructure/
├── terraform/
│   ├── modules/
│   │   ├── vpc/          # VPC, subnets, routing
│   │   ├── ec2/          # EC2 instance, security groups
│   │   ├── rds/          # PostgreSQL database
│   │   ├── ecr/          # Container registry
│   │   └── s3/           # Storage buckets
│   ├── main.tf           # Main configuration
│   ├── variables.tf      # Input variables
│   ├── outputs.tf        # Output values
│   └── versions.tf       # Provider versions
├── docker/
│   ├── docker-compose.yml      # Local development
│   ├── docker-compose.prod.yml # Production
│   ├── nginx.conf              # Nginx config
│   └── .env.example            # Environment template
└── README.md
```

## Local Development

```bash
cd infrastructure/docker

# Copy environment file
cp .env.example .env
# Edit .env with your values

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Manual Deployment

SSH into EC2 and run:

```bash
ssh -i ~/.ssh/id_rsa ec2-user@<EC2_PUBLIC_IP>

# Run deployment script
/opt/ukrevrocom/deploy.sh
```

## SSL/HTTPS Setup

After deployment, set up SSL with Let's Encrypt:

```bash
ssh -i ~/.ssh/id_rsa ec2-user@<EC2_PUBLIC_IP>

# Install certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

## Monitoring & Logs

### View application logs:
```bash
ssh ec2-user@<EC2_PUBLIC_IP>
cd /opt/ukrevrocom
docker-compose logs -f
```

### View specific service logs:
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Database Access

```bash
# Connect via SSH tunnel
ssh -L 5432:rds-endpoint:5432 ec2-user@<EC2_PUBLIC_IP>

# Then connect locally
psql -h localhost -U ukrevrocom_admin -d ukrevrocom
```

## Backup & Restore

### Manual database backup:
```bash
ssh ec2-user@<EC2_PUBLIC_IP>

# Create backup
pg_dump -h <RDS_ENDPOINT> -U ukrevrocom_admin ukrevrocom > backup.sql

# Upload to S3
aws s3 cp backup.sql s3://ukrevrocom-production-backups/
```

## Troubleshooting

### Services not starting:
```bash
# Check container status
docker-compose ps

# Check container logs
docker-compose logs backend
docker-compose logs frontend
```

### Database connection issues:
```bash
# Test database connectivity from EC2
psql -h <RDS_ENDPOINT> -U ukrevrocom_admin -d ukrevrocom
```

### CI/CD failures:
1. Check GitHub Actions logs
2. Verify AWS credentials in secrets
3. Ensure EC2 security group allows SSH from GitHub Actions IPs

## Destroying Infrastructure

⚠️ **Warning**: This will delete all resources including the database!

```bash
cd infrastructure/terraform
terraform destroy
```

## Security Considerations

1. **SSH Access**: Restrict SSH to your IP in `modules/ec2/main.tf`
2. **Database**: RDS is in private subnet, not publicly accessible
3. **Secrets**: Use AWS SSM Parameter Store for sensitive data
4. **SSL**: Always use HTTPS in production with Let's Encrypt
5. **Updates**: Enable automatic security updates on EC2

## Support

For issues, please create a GitHub issue or contact the team.
