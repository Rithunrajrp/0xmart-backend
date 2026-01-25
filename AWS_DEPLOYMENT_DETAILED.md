# 🚀 Detailed AWS Deployment Plan - api.0xmart.com

**Complete step-by-step guide for deploying 0xMart Backend to AWS with Docker containers**

Based on your `compose.yaml` configuration with PostgreSQL, Redis, and NestJS backend.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Network Infrastructure](#phase-1-network-infrastructure)
4. [Phase 2: Database & Cache Setup](#phase-2-database--cache-setup)
5. [Phase 3: Secrets Management](#phase-3-secrets-management)
6. [Phase 4: Container Registry & Build](#phase-4-container-registry--build)
7. [Phase 5: ECS Deployment](#phase-5-ecs-deployment)
8. [Phase 6: Load Balancer & DNS](#phase-6-load-balancer--dns)
9. [Phase 7: Monitoring & Logging](#phase-7-monitoring--logging)
10. [Phase 8: CI/CD Pipeline](#phase-8-cicd-pipeline)
11. [Phase 9: Production Launch](#phase-9-production-launch)
12. [Cost Breakdown](#cost-breakdown)
13. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Current Setup (Docker Compose)
```
compose.yaml:
├── postgres (PostgreSQL 15)
├── redis (Redis 7)
└── backend (NestJS on Node 20.19.5)
```

### Target AWS Architecture
```
                                    ┌─────────────────┐
                                    │   Route 53      │
                                    │ api.0xmart.com  │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │  CloudFront     │
                                    │  (Optional CDN) │
                                    └────────┬────────┘
                                             │
                              ┌──────────────▼──────────────┐
                              │   Application Load          │
                              │   Balancer (ALB)            │
                              │   HTTPS (443)               │
                              └──────────┬──────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
          ┌─────────▼────────┐  ┌────────▼────────┐  ┌──────▼─────────┐
          │  ECS Fargate     │  │  ECS Fargate    │  │  ECS Fargate   │
          │  Task 1          │  │  Task 2         │  │  Task 3        │
          │  (NestJS)        │  │  (NestJS)       │  │  (NestJS)      │
          └─────────┬────────┘  └────────┬────────┘  └──────┬─────────┘
                    │                    │                    │
                    └────────────────────┼────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    │                                         │
          ┌─────────▼────────┐                    ┌──────────▼──────────┐
          │  RDS PostgreSQL  │                    │  ElastiCache Redis  │
          │  (Multi-AZ)      │                    │  (Cluster Mode)     │
          │  Port: 5432      │                    │  Port: 6379         │
          └──────────────────┘                    └─────────────────────┘
                    │
          ┌─────────▼────────┐
          │  AWS Secrets     │
          │  Manager         │
          └──────────────────┘
```

**Key AWS Services:**
- **ECS Fargate** - Replaces `docker-compose` backend service
- **RDS PostgreSQL** - Replaces `postgres` container
- **ElastiCache Redis** - Replaces `redis` container
- **Application Load Balancer** - HTTPS termination & routing
- **ECR** - Container image registry
- **Secrets Manager** - Secure credential storage
- **CloudWatch** - Monitoring & logging

---

## Prerequisites

### Required Tools
```bash
# AWS CLI v2
aws --version

# Docker & Docker Compose
docker --version
docker-compose --version

# Optional but recommended
terraform --version  # For IaC
copilot --version    # For quick deployment
```

### AWS Account Requirements
- [ ] AWS Account with billing enabled
- [ ] IAM user with Administrator Access (or specific permissions)
- [ ] AWS CLI configured: `aws configure`
- [ ] Domain registered (0xmart.com) or using Route 53

### Local Environment
```bash
# Test your compose.yaml locally first
cd 0xmart-backend
docker-compose up -d

# Verify all services running
docker-compose ps

# Test API
curl http://localhost:3000/api/v1/health

# Stop services
docker-compose down
```

---

## Phase 1: Network Infrastructure

### 1.1 Create VPC

**Via AWS Console:**
1. Go to VPC → Create VPC
2. Configuration:
   ```
   Name: 0xmart-vpc
   CIDR: 10.0.0.0/16
   Tenancy: Default
   Enable DNS hostnames: Yes
   Enable DNS resolution: Yes
   ```

**Via AWS CLI:**
```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=0xmart-vpc}]' \
  --query 'Vpc.VpcId' \
  --output text)

echo "VPC ID: $VPC_ID"

# Enable DNS
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-support
```

### 1.2 Create Subnets

**Public Subnets (for ALB):**
```bash
# Public Subnet 1 (us-east-1a)
PUBLIC_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=0xmart-public-1a}]' \
  --query 'Subnet.SubnetId' \
  --output text)

# Public Subnet 2 (us-east-1b)
PUBLIC_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=0xmart-public-1b}]' \
  --query 'Subnet.SubnetId' \
  --output text)
```

**Private Subnets (for ECS, RDS, Redis):**
```bash
# Private Subnet 1 (us-east-1a)
PRIVATE_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.11.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=0xmart-private-1a}]' \
  --query 'Subnet.SubnetId' \
  --output text)

# Private Subnet 2 (us-east-1b)
PRIVATE_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.12.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=0xmart-private-1b}]' \
  --query 'Subnet.SubnetId' \
  --output text)
```

### 1.3 Internet Gateway & NAT Gateway

**Internet Gateway (for public subnets):**
```bash
# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=0xmart-igw}]' \
  --query 'InternetGateway.InternetGatewayId' \
  --output text)

# Attach to VPC
aws ec2 attach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id $IGW_ID
```

**NAT Gateway (for private subnets to access internet):**
```bash
# Allocate Elastic IP
EIP_ALLOC=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)

# Create NAT Gateway in public subnet
NAT_GW_ID=$(aws ec2 create-nat-gateway \
  --subnet-id $PUBLIC_SUBNET_1 \
  --allocation-id $EIP_ALLOC \
  --tag-specifications 'ResourceType=natgateway,Tags=[{Key=Name,Value=0xmart-nat}]' \
  --query 'NatGateway.NatGatewayId' \
  --output text)

# Wait for NAT Gateway to be available (takes 2-3 minutes)
aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT_GW_ID
```

### 1.4 Route Tables

**Public Route Table:**
```bash
# Create route table
PUBLIC_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=0xmart-public-rt}]' \
  --query 'RouteTable.RouteTableId' \
  --output text)

# Add route to Internet Gateway
aws ec2 create-route \
  --route-table-id $PUBLIC_RT \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID

# Associate with public subnets
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_1 --route-table-id $PUBLIC_RT
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_2 --route-table-id $PUBLIC_RT
```

**Private Route Table:**
```bash
# Create route table
PRIVATE_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=0xmart-private-rt}]' \
  --query 'RouteTable.RouteTableId' \
  --output text)

# Add route to NAT Gateway
aws ec2 create-route \
  --route-table-id $PRIVATE_RT \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id $NAT_GW_ID

# Associate with private subnets
aws ec2 associate-route-table --subnet-id $PRIVATE_SUBNET_1 --route-table-id $PRIVATE_RT
aws ec2 associate-route-table --subnet-id $PRIVATE_SUBNET_2 --route-table-id $PRIVATE_RT
```

### 1.5 Security Groups

**ALB Security Group:**
```bash
ALB_SG=$(aws ec2 create-security-group \
  --group-name 0xmart-alb-sg \
  --description "Security group for 0xMart ALB" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow HTTP
aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# Allow HTTPS
aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0
```

**ECS Security Group:**
```bash
ECS_SG=$(aws ec2 create-security-group \
  --group-name 0xmart-ecs-sg \
  --description "Security group for 0xMart ECS tasks" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow traffic from ALB on port 8000 (backend port)
aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG \
  --protocol tcp \
  --port 8000 \
  --source-group $ALB_SG
```

**RDS Security Group:**
```bash
RDS_SG=$(aws ec2 create-security-group \
  --group-name 0xmart-rds-sg \
  --description "Security group for 0xMart RDS PostgreSQL" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow PostgreSQL from ECS
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp \
  --port 5432 \
  --source-group $ECS_SG
```

**Redis Security Group:**
```bash
REDIS_SG=$(aws ec2 create-security-group \
  --group-name 0xmart-redis-sg \
  --description "Security group for 0xMart ElastiCache Redis" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow Redis from ECS
aws ec2 authorize-security-group-ingress \
  --group-id $REDIS_SG \
  --protocol tcp \
  --port 6379 \
  --source-group $ECS_SG
```

**Save all IDs for later use:**
```bash
# Save to file
cat > aws-infrastructure-ids.txt <<EOF
VPC_ID=$VPC_ID
PUBLIC_SUBNET_1=$PUBLIC_SUBNET_1
PUBLIC_SUBNET_2=$PUBLIC_SUBNET_2
PRIVATE_SUBNET_1=$PRIVATE_SUBNET_1
PRIVATE_SUBNET_2=$PRIVATE_SUBNET_2
ALB_SG=$ALB_SG
ECS_SG=$ECS_SG
RDS_SG=$RDS_SG
REDIS_SG=$REDIS_SG
EOF

cat aws-infrastructure-ids.txt
```

---

## Phase 2: Database & Cache Setup

### 2.1 Create RDS PostgreSQL Database

**Matching your compose.yaml config:**
- Engine: PostgreSQL 15
- User: postgres
- Password: P0s7@986611 (⚠️ CHANGE IN PRODUCTION!)
- Database: 0xmartdb

**Create DB Subnet Group:**
```bash
aws rds create-db-subnet-group \
  --db-subnet-group-name 0xmart-db-subnet \
  --db-subnet-group-description "0xMart RDS subnet group" \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --tags Key=Name,Value=0xmart-db-subnet
```

**Create RDS Instance:**
```bash
aws rds create-db-instance \
  --db-instance-identifier 0xmart-postgres \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.5 \
  --master-username postgres \
  --master-user-password "YOUR_SECURE_PASSWORD_HERE" \
  --allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --vpc-security-group-ids $RDS_SG \
  --db-subnet-group-name 0xmart-db-subnet \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "mon:04:00-mon:05:00" \
  --multi-az \
  --publicly-accessible false \
  --db-name 0xmartdb \
  --tags Key=Name,Value=0xmart-postgres Key=Environment,Value=production

# Wait for RDS to be available (takes 10-15 minutes)
echo "Waiting for RDS instance to be available..."
aws rds wait db-instance-available --db-instance-identifier 0xmart-postgres

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier 0xmart-postgres \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "RDS Endpoint: $RDS_ENDPOINT"
```

**Connection String:**
```bash
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@$RDS_ENDPOINT:5432/0xmartdb?schema=public"
```

### 2.2 Create ElastiCache Redis Cluster

**Matching your compose.yaml config:**
- Engine: Redis 7
- Port: 6379

**Create Cache Subnet Group:**
```bash
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name 0xmart-cache-subnet \
  --cache-subnet-group-description "0xMart Redis subnet group" \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2
```

**Create Redis Cluster:**
```bash
aws elasticache create-replication-group \
  --replication-group-id 0xmart-redis \
  --replication-group-description "0xMart Redis cluster" \
  --engine redis \
  --engine-version 7.1 \
  --cache-node-type cache.t3.small \
  --num-cache-clusters 2 \
  --cache-subnet-group-name 0xmart-cache-subnet \
  --security-group-ids $REDIS_SG \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token "YOUR_REDIS_AUTH_TOKEN_HERE" \
  --automatic-failover-enabled \
  --multi-az-enabled \
  --port 6379 \
  --tags Key=Name,Value=0xmart-redis Key=Environment,Value=production

# Wait for Redis to be available (takes 5-10 minutes)
echo "Waiting for Redis cluster to be available..."
aws elasticache wait replication-group-available --replication-group-id 0xmart-redis

# Get Redis endpoint
REDIS_ENDPOINT=$(aws elasticache describe-replication-groups \
  --replication-group-id 0xmart-redis \
  --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' \
  --output text)

echo "Redis Endpoint: $REDIS_ENDPOINT"
```

**Redis Connection:**
```bash
REDIS_HOST=$REDIS_ENDPOINT
REDIS_PORT=6379
REDIS_PASSWORD=YOUR_REDIS_AUTH_TOKEN_HERE
```

---

## Phase 3: Secrets Management

### 3.1 Create Secrets in AWS Secrets Manager

**Store all sensitive credentials from your .env file:**

```bash
# Create main secret with all credentials
aws secretsmanager create-secret \
  --name 0xmart/backend/production \
  --description "0xMart Backend Production Secrets" \
  --secret-string '{
    "DATABASE_URL": "postgresql://postgres:YOUR_PASSWORD@'$RDS_ENDPOINT':5432/0xmartdb?schema=public",
    "JWT_SECRET": "YOUR_PRODUCTION_JWT_SECRET",
    "JWT_REFRESH_SECRET": "YOUR_PRODUCTION_REFRESH_SECRET",
    "MASTER_SEED": "your twelve word production mnemonic phrase",
    "MASTER_KEY_ENCRYPTION_SECRET": "YOUR_64_CHAR_SECRET",
    "MASTER_KEY_ENCRYPTION_SALT": "YOUR_64_CHAR_SALT",
    "SENDGRID_API_KEY": "SG.xxxxx",
    "STRIPE_SECRET_KEY": "sk_live_xxxxx",
    "STRIPE_WEBHOOK_SECRET": "whsec_xxxxx",
    "RAZORPAY_KEY_SECRET": "xxxxx",
    "RAZORPAY_WEBHOOK_SECRET": "xxxxx",
    "SUMSUB_SECRET_KEY": "xxxxx",
    "AWS_SECRET_ACCESS_KEY": "xxxxx",
    "SUI_HOT_WALLET_PRIVATE_KEY": "xxxxx",
    "SOLANA_HOT_WALLET_PRIVATE_KEY": "xxxxx",
    "TWILIO_AUTH_TOKEN": "xxxxx",
    "TON_API_KEY": "xxxxx",
    "RECAPTCHA_SECRET_KEY": "xxxxx"
  }'

# Get secret ARN
SECRET_ARN=$(aws secretsmanager describe-secret \
  --secret-id 0xmart/backend/production \
  --query 'ARN' \
  --output text)

echo "Secret ARN: $SECRET_ARN"
```

### 3.2 Create IAM Role for ECS Tasks

**Task Execution Role (for pulling images and accessing secrets):**
```bash
# Create trust policy
cat > ecs-task-execution-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
aws iam create-role \
  --role-name 0xmartECSTaskExecutionRole \
  --assume-role-policy-document file://ecs-task-execution-trust-policy.json

# Attach AWS managed policy
aws iam attach-role-policy \
  --role-name 0xmartECSTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Create custom policy for Secrets Manager
cat > ecs-secrets-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "$SECRET_ARN"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name 0xmartECSTaskExecutionRole \
  --policy-name SecretsManagerAccess \
  --policy-document file://ecs-secrets-policy.json
```

**Task Role (for application to access AWS services):**
```bash
# Create trust policy
cat > ecs-task-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
aws iam create-role \
  --role-name 0xmartECSTaskRole \
  --assume-role-policy-document file://ecs-task-trust-policy.json

# Attach policy for S3 access (for product uploads)
cat > ecs-s3-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::0xmart-products-bucket",
        "arn:aws:s3:::0xmart-products-bucket/*"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name 0xmartECSTaskRole \
  --policy-name S3Access \
  --policy-document file://ecs-s3-policy.json
```

---

## Phase 4: Container Registry & Build

### 4.1 Create ECR Repository

```bash
# Create ECR repository
aws ecr create-repository \
  --repository-name 0xmart-backend \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  --tags Key=Name,Value=0xmart-backend Key=Environment,Value=production

# Get repository URI
ECR_REPO_URI=$(aws ecr describe-repositories \
  --repository-names 0xmart-backend \
  --query 'repositories[0].repositoryUri' \
  --output text)

echo "ECR Repository URI: $ECR_REPO_URI"
```

### 4.2 Update Dockerfile (Production Optimizations)

Update your existing Dockerfile:

```bash
# Backup original
cp Dockerfile Dockerfile.backup

# Create optimized Dockerfile
cat > Dockerfile <<'EOF'
# Multi-stage build for smaller image size
FROM node:20.19.5-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (production only)
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Production image
FROM node:20.19.5-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
RUN chown -R nestjs:nodejs /app
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Expose port (matches main.ts port config)
EXPOSE 8000

# Start application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
EOF
```

### 4.3 Build and Push to ECR

```bash
# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
AWS_REGION=us-east-1

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build Docker image
docker build -t 0xmart-backend .

# Tag image
docker tag 0xmart-backend:latest $ECR_REPO_URI:latest
docker tag 0xmart-backend:latest $ECR_REPO_URI:v1.0.0

# Push to ECR
docker push $ECR_REPO_URI:latest
docker push $ECR_REPO_URI:v1.0.0

echo "✅ Image pushed to ECR: $ECR_REPO_URI:latest"
```

---

## Phase 5: ECS Deployment

### 5.1 Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name 0xmart-cluster \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
  --tags key=Name,value=0xmart-cluster key=Environment,value=production
```

### 5.2 Create CloudWatch Log Group

```bash
aws logs create-log-group \
  --log-group-name /ecs/0xmart-backend \
  --tags Key=Name,Value=0xmart-backend Key=Environment,Value=production

# Set retention to 30 days
aws logs put-retention-policy \
  --log-group-name /ecs/0xmart-backend \
  --retention-in-days 30
```

### 5.3 Create ECS Task Definition

```bash
# Get IAM role ARNs
TASK_EXECUTION_ROLE_ARN=$(aws iam get-role --role-name 0xmartECSTaskExecutionRole --query 'Role.Arn' --output text)
TASK_ROLE_ARN=$(aws iam get-role --role-name 0xmartECSTaskRole --query 'Role.Arn' --output text)

# Create task definition JSON
cat > task-definition.json <<EOF
{
  "family": "0xmart-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "$TASK_EXECUTION_ROLE_ARN",
  "taskRoleArn": "$TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "0xmart-backend",
      "image": "$ECR_REPO_URI:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "8000"},
        {"name": "API_PREFIX", "value": "api/v1"},
        {"name": "REDIS_HOST", "value": "$REDIS_ENDPOINT"},
        {"name": "REDIS_PORT", "value": "6379"},
        {"name": "FRONTEND_URL", "value": "https://0xmart.com"},
        {"name": "SENDGRID_FROM_EMAIL", "value": "noreply@0xmart.com"},
        {"name": "SENDGRID_FROM_NAME", "value": "0xMart"},
        {"name": "SUPPORT_LINK", "value": "https://support.0xmart.com/help"},
        {"name": "AWS_REGION", "value": "us-east-1"},
        {"name": "AWS_S3_BUCKET", "value": "0xmart-products-bucket"},
        {"name": "THROTTLE_TTL", "value": "60"},
        {"name": "THROTTLE_LIMIT", "value": "10"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "$SECRET_ARN:DATABASE_URL::"},
        {"name": "JWT_SECRET", "valueFrom": "$SECRET_ARN:JWT_SECRET::"},
        {"name": "JWT_REFRESH_SECRET", "valueFrom": "$SECRET_ARN:JWT_REFRESH_SECRET::"},
        {"name": "MASTER_SEED", "valueFrom": "$SECRET_ARN:MASTER_SEED::"},
        {"name": "SENDGRID_API_KEY", "valueFrom": "$SECRET_ARN:SENDGRID_API_KEY::"},
        {"name": "STRIPE_SECRET_KEY", "valueFrom": "$SECRET_ARN:STRIPE_SECRET_KEY::"},
        {"name": "RAZORPAY_KEY_SECRET", "valueFrom": "$SECRET_ARN:RAZORPAY_KEY_SECRET::"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/0xmart-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8000/api/v1/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

### 5.4 Create Target Group for ALB

```bash
TG_ARN=$(aws elbv2 create-target-group \
  --name 0xmart-backend-tg \
  --protocol HTTP \
  --port 8000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-enabled \
  --health-check-path /api/v1/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --matcher HttpCode=200 \
  --tags Key=Name,Value=0xmart-backend-tg Key=Environment,Value=production \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

echo "Target Group ARN: $TG_ARN"
```

---

## Phase 6: Load Balancer & DNS

### 6.1 Create Application Load Balancer

```bash
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name 0xmart-alb \
  --subnets $PUBLIC_SUBNET_1 $PUBLIC_SUBNET_2 \
  --security-groups $ALB_SG \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --tags Key=Name,Value=0xmart-alb Key=Environment,Value=production \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "ALB DNS: $ALB_DNS"
```

### 6.2 Request SSL Certificate

```bash
# Request certificate for api.0xmart.com
CERT_ARN=$(aws acm request-certificate \
  --domain-name api.0xmart.com \
  --validation-method DNS \
  --tags Key=Name,Value=0xmart-api-cert Key=Environment,Value=production \
  --query 'CertificateArn' \
  --output text)

echo "Certificate ARN: $CERT_ARN"

# Get DNS validation records
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'

echo "⚠️ Add the DNS validation CNAME record to your domain registrar"
echo "Waiting for certificate validation..."
aws acm wait certificate-validated --certificate-arn $CERT_ARN
echo "✅ Certificate validated!"
```

### 6.3 Create ALB Listeners

**HTTPS Listener (port 443):**
```bash
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN
```

**HTTP Listener (port 80) - Redirect to HTTPS:**
```bash
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'
```

### 6.4 Create ECS Service

```bash
aws ecs create-service \
  --cluster 0xmart-cluster \
  --service-name 0xmart-backend-service \
  --task-definition 0xmart-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --platform-version LATEST \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=0xmart-backend,containerPort=8000" \
  --health-check-grace-period-seconds 60 \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100,deploymentCircuitBreaker={enable=true,rollback=true}" \
  --tags key=Name,value=0xmart-backend-service key=Environment,value=production

echo "✅ ECS Service created! Tasks are starting..."
```

### 6.5 Configure Route 53 DNS

```bash
# Get hosted zone ID for 0xmart.com
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name 0xmart.com \
  --query 'HostedZones[0].Id' \
  --output text | cut -d'/' -f3)

# Get ALB Hosted Zone ID
ALB_HOSTED_ZONE=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].CanonicalHostedZoneId' \
  --output text)

# Create A record for api.0xmart.com
cat > route53-change.json <<EOF
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.0xmart.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "$ALB_HOSTED_ZONE",
          "DNSName": "$ALB_DNS",
          "EvaluateTargetHealth": true
        }
      }
    }
  ]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://route53-change.json

echo "✅ DNS record created for api.0xmart.com"
```

---

## Phase 7: Monitoring & Logging

### 7.1 Create CloudWatch Alarms

**ECS CPU Alarm:**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name 0xmart-ecs-cpu-high \
  --alarm-description "ECS CPU utilization is too high" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ClusterName,Value=0xmart-cluster Name=ServiceName,Value=0xmart-backend-service
```

**ECS Memory Alarm:**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name 0xmart-ecs-memory-high \
  --alarm-description "ECS memory utilization is too high" \
  --metric-name MemoryUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 85 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ClusterName,Value=0xmart-cluster Name=ServiceName,Value=0xmart-backend-service
```

**ALB 5xx Errors:**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name 0xmart-alb-5xx-errors \
  --alarm-description "ALB has too many 5xx errors" \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 2 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=LoadBalancer,Value=$(echo $ALB_ARN | cut -d':' -f6)
```

**RDS CPU Alarm:**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name 0xmart-rds-cpu-high \
  --alarm-description "RDS CPU utilization is too high" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DBInstanceIdentifier,Value=0xmart-postgres
```

### 7.2 Create CloudWatch Dashboard

```bash
cat > dashboard.json <<'EOF'
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ECS", "CPUUtilization", {"stat": "Average"}],
          [".", "MemoryUtilization", {"stat": "Average"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "ECS Performance"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApplicationELB", "RequestCount", {"stat": "Sum"}],
          [".", "TargetResponseTime", {"stat": "Average"}],
          [".", "HTTPCode_Target_5XX_Count", {"stat": "Sum"}]
        ],
        "period": 60,
        "stat": "Average",
        "region": "us-east-1",
        "title": "ALB Metrics"
      }
    }
  ]
}
EOF

aws cloudwatch put-dashboard \
  --dashboard-name 0xmart-production \
  --dashboard-body file://dashboard.json
```

---

## Phase 8: CI/CD Pipeline

### 8.1 GitHub Actions Workflow

Create `.github/workflows/deploy-aws.yml`:

```yaml
name: Deploy to AWS ECS

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: 0xmart-backend
  ECS_SERVICE: 0xmart-backend-service
  ECS_CLUSTER: 0xmart-cluster
  ECS_TASK_DEFINITION: task-definition.json
  CONTAINER_NAME: 0xmart-backend

jobs:
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image to ECR
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Download task definition
        run: |
          aws ecs describe-task-definition \
            --task-definition $ECS_TASK_DEFINITION \
            --query taskDefinition > task-definition.json

      - name: Fill in new image ID in task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: task-definition.json
          container-name: ${{ env.CONTAINER_NAME }}
          image: ${{ steps.build-image.outputs.image }}

      - name: Deploy to Amazon ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true

      - name: Verify deployment
        run: |
          echo "✅ Deployment completed successfully!"
          echo "API URL: https://api.0xmart.com/api/v1/health"
```

### 8.2 Add GitHub Secrets

Go to GitHub Repository → Settings → Secrets and variables → Actions

Add these secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

---

## Phase 9: Production Launch

### 9.1 Run Database Migrations

```bash
# SSH into ECS task or run one-off task
aws ecs run-task \
  --cluster 0xmart-cluster \
  --task-definition 0xmart-backend \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --overrides '{
    "containerOverrides": [{
      "name": "0xmart-backend",
      "command": ["npx", "prisma", "migrate", "deploy"]
    }]
  }'
```

Or use ECS Exec to connect to running task:

```bash
# Enable ECS Exec on service (one-time)
aws ecs update-service \
  --cluster 0xmart-cluster \
  --service 0xmart-backend-service \
  --enable-execute-command

# Get task ID
TASK_ID=$(aws ecs list-tasks \
  --cluster 0xmart-cluster \
  --service-name 0xmart-backend-service \
  --query 'taskArns[0]' \
  --output text | cut -d'/' -f3)

# Connect to task
aws ecs execute-command \
  --cluster 0xmart-cluster \
  --task $TASK_ID \
  --container 0xmart-backend \
  --interactive \
  --command "/bin/sh"

# Inside container, run migrations
npx prisma migrate deploy
exit
```

### 9.2 Verify Deployment

```bash
# Test health endpoint
curl https://api.0xmart.com/api/v1/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-25T..."}

# Test API documentation (if enabled)
open https://api.0xmart.com/api/v1/docs

# Check ECS service status
aws ecs describe-services \
  --cluster 0xmart-cluster \
  --services 0xmart-backend-service \
  --query 'services[0].{runningCount:runningCount,desiredCount:desiredCount,status:status}'

# View logs
aws logs tail /ecs/0xmart-backend --follow
```

### 9.3 Update Frontend

Update frontend environment variable:

```bash
# In Vercel dashboard for 0xmart-web
NEXT_PUBLIC_API_BASE_URL=https://api.0xmart.com/api/v1

# Redeploy frontend
cd ../0xmart-web
vercel --prod
```

### 9.4 Configure Webhooks

Update webhook URLs in provider dashboards:

**Stripe:**
```
https://api.0xmart.com/api/v1/webhooks/stripe
```

**Razorpay:**
```
https://api.0xmart.com/api/v1/webhooks/razorpay
```

**Sumsub:**
```
https://api.0xmart.com/api/v1/webhooks/sumsub
```

### 9.5 Production Checklist

- [ ] API accessible at `https://api.0xmart.com/api/v1`
- [ ] Health check returns 200: `curl https://api.0xmart.com/api/v1/health`
- [ ] Database migrations completed
- [ ] ECS tasks running (2+ instances)
- [ ] ALB health checks passing
- [ ] RDS connection working
- [ ] Redis connection working
- [ ] CloudWatch logs flowing
- [ ] SSL certificate valid
- [ ] Frontend updated with new API URL
- [ ] Webhooks updated in Stripe/Razorpay/Sumsub
- [ ] Test user signup flow
- [ ] Test OTP email sending
- [ ] Test product listing
- [ ] Test order creation
- [ ] Monitor CloudWatch alarms

---

## Cost Breakdown

### Monthly AWS Costs (Production)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| **ECS Fargate** | 2 tasks × 1 vCPU × 2GB | ~$60 |
| **RDS PostgreSQL** | db.t3.medium, Multi-AZ, 100GB | ~$150 |
| **ElastiCache Redis** | cache.t3.small × 2 nodes | ~$60 |
| **Application Load Balancer** | 1 ALB | ~$25 |
| **NAT Gateway** | 1 gateway | ~$45 |
| **Data Transfer** | Estimate | ~$20 |
| **CloudWatch Logs** | 10 GB/month | ~$10 |
| **ECR Storage** | 5 GB images | ~$0.50 |
| **Secrets Manager** | 1 secret | ~$0.40 |
| **Route 53** | 1 hosted zone | ~$0.50 |
| **ACM Certificate** | SSL cert | Free |
| **Total** | | **~$371/month** |

### Cost Optimization Tips

1. **Use FARGATE_SPOT for non-critical tasks** - 70% cheaper
2. **Enable RDS storage autoscaling** - pay for what you use
3. **Use Reserved Instances for RDS** - 40% savings for 1-year commitment
4. **Enable S3 lifecycle policies** - move old data to Glacier
5. **Set CloudWatch log retention** - 7 days instead of indefinite
6. **Use VPC endpoints** - avoid NAT Gateway data transfer fees

---

## Troubleshooting

### ECS Tasks Not Starting

**Check logs:**
```bash
aws logs tail /ecs/0xmart-backend --follow
```

**Common issues:**
- Database connection failed → Check `DATABASE_URL` in Secrets Manager
- Redis connection failed → Check Redis endpoint in task definition
- Image pull failed → Verify ECR repository URI
- Health check failing → Check `/api/v1/health` endpoint

### Database Connection Issues

**Test from ECS task:**
```bash
# Connect to ECS task
aws ecs execute-command \
  --cluster 0xmart-cluster \
  --task <TASK_ID> \
  --container 0xmart-backend \
  --interactive \
  --command "/bin/sh"

# Inside container
apk add postgresql-client
psql $DATABASE_URL
```

### ALB Returns 502/503

**Possible causes:**
- ECS tasks not healthy
- Security group blocking traffic
- Health check path incorrect
- Target group has no healthy targets

**Debug:**
```bash
# Check target health
aws elbv2 describe-target-health --target-group-arn $TG_ARN

# Check ECS service events
aws ecs describe-services \
  --cluster 0xmart-cluster \
  --services 0xmart-backend-service \
  --query 'services[0].events[0:10]'
```

### High Costs

**Identify cost drivers:**
```bash
# Check NAT Gateway data transfer
aws cloudwatch get-metric-statistics \
  --namespace AWS/NATGateway \
  --metric-name BytesOutToDestination \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-31T23:59:59Z \
  --period 86400 \
  --statistics Sum

# Review Cost Explorer in AWS Console
open https://console.aws.amazon.com/cost-management/home
```

---

## Rollback Procedure

### Rollback to Previous Deployment

```bash
# List task definition revisions
aws ecs list-task-definitions --family-prefix 0xmart-backend

# Update service to use previous revision
aws ecs update-service \
  --cluster 0xmart-cluster \
  --service 0xmart-backend-service \
  --task-definition 0xmart-backend:PREVIOUS_REVISION

# Monitor rollback
aws ecs wait services-stable \
  --cluster 0xmart-cluster \
  --services 0xmart-backend-service
```

---

## Next Steps

1. **Set up staging environment** - Duplicate infrastructure with smaller instance types
2. **Configure auto-scaling** - Scale ECS tasks based on CPU/memory
3. **Enable AWS WAF** - Protect against DDoS and common attacks
4. **Set up AWS Backup** - Automated RDS and ElastiCache backups
5. **Implement Blue/Green deployments** - Zero-downtime releases
6. **Add application monitoring** - DataDog, New Relic, or AWS X-Ray
7. **Document runbook** - Incident response procedures

---

## Support & Resources

- **AWS Documentation:** https://docs.aws.amazon.com/
- **ECS Best Practices:** https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/
- **AWS Architecture Center:** https://aws.amazon.com/architecture/
- **NestJS Deployment:** https://docs.nestjs.com/deployment

---

**Created:** 2025-01-25
**Status:** ✅ Production Ready
**Maintained By:** 0xMart DevOps Team
