# AWS Deployment Plan for 0xMart Backend

## Architecture Overview

**Production-ready, scalable architecture** with the following AWS services:

### Compute Layer
- **AWS ECS Fargate** (containerized NestJS app) - serverless container orchestration
- **Application Load Balancer** (ALB) - for HTTPS termination and traffic distribution

### Database Layer
- **Amazon RDS for PostgreSQL** - managed database with automated backups
- **Amazon ElastiCache for Redis** - managed Redis for caching & rate limiting

### Security & Secrets
- **AWS Secrets Manager** - secure storage for sensitive credentials (JWT secrets, API keys, MASTER_SEED, private keys)
- **AWS Systems Manager Parameter Store** - for non-sensitive config

### Monitoring & Logging
- **CloudWatch Logs** - centralized logging
- **CloudWatch Alarms** - uptime monitoring, error alerts
- **AWS X-Ray** (optional) - distributed tracing

### Storage
- **Amazon S3** - already integrated for file uploads
- **CloudFront** (optional) - CDN for static assets

### Networking
- **VPC with private/public subnets** - isolated network environment
- **Security Groups** - firewall rules
- **NAT Gateway** - outbound internet access for private subnets

---

## Deployment Plan - Step by Step

### Phase 1: Infrastructure Setup (AWS Console/Terraform/CDK)

#### 1.1 VPC & Networking
- Create VPC with CIDR `10.0.0.0/16`
- 2 public subnets (for ALB) in different AZs
- 2 private subnets (for ECS, RDS, Redis) in different AZs
- Internet Gateway for public subnets
- NAT Gateway for private subnets
- Route tables configured

#### 1.2 Security Groups
- **ALB Security Group**: Allow HTTP (80), HTTPS (443) from `0.0.0.0/0`
- **ECS Security Group**: Allow traffic from ALB security group on port 8000
- **RDS Security Group**: Allow PostgreSQL (5432) from ECS security group
- **Redis Security Group**: Allow Redis (6379) from ECS security group

#### 1.3 Database - Amazon RDS PostgreSQL
```
Engine: PostgreSQL 16.x
Instance Class: db.t3.medium (production) or db.t3.small (staging)
Storage: 100 GB SSD (gp3)
Multi-AZ: Yes (production), No (staging)
Automated Backups: 7-day retention
Encryption: Yes (at-rest and in-transit)
Network: Private subnets
Parameter Group: Create custom for timezone, connection limits
```

#### 1.4 Cache - Amazon ElastiCache Redis
```
Engine: Redis 7.x
Node Type: cache.t3.micro (staging) or cache.t3.small (production)
Number of nodes: 1 (staging), 2 with replication (production)
Network: Private subnets
Encryption: Yes (at-rest and in-transit)
```

---

### Phase 2: Secrets & Configuration

#### 2.1 AWS Secrets Manager - Store sensitive credentials
```json
Secret: 0xmart/backend/production
{
  "DATABASE_URL": "postgresql://user:pass@rds-endpoint:5432/0xmart",
  "JWT_SECRET": "...",
  "JWT_REFRESH_SECRET": "...",
  "MASTER_SEED": "twelve word mnemonic...",
  "SENDGRID_API_KEY": "...",
  "STRIPE_SECRET_KEY": "...",
  "STRIPE_WEBHOOK_SECRET": "...",
  "RAZORPAY_KEY_SECRET": "...",
  "SUMSUB_SECRET_KEY": "...",
  "SUI_HOT_WALLET_PRIVATE_KEY": "...",
  "SOLANA_HOT_WALLET_PRIVATE_KEY": "...",
  "MASTER_KEY_ENCRYPTION_SECRET": "...",
  "AWS_SECRET_ACCESS_KEY": "..."
}
```

#### 2.2 Systems Manager Parameter Store - Non-sensitive config
```
/0xmart/backend/production/PORT: 8000
/0xmart/backend/production/NODE_ENV: production
/0xmart/backend/production/ETHEREUM_RPC_URL: https://...
/0xmart/backend/production/POLYGON_RPC_URL: https://...
... (all blockchain RPC URLs)
```

---

### Phase 3: Container & ECS Setup

#### 3.1 Update Dockerfile (minor improvements needed)
```dockerfile
FROM node:20.19.5 AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20.19.5-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

EXPOSE 8000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```

#### 3.2 Amazon ECR - Container Registry
```bash
# Create ECR repository
aws ecr create-repository --repository-name 0xmart-backend --region us-east-1

# Push image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker build -t 0xmart-backend .
docker tag 0xmart-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/0xmart-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/0xmart-backend:latest
```

#### 3.3 ECS Cluster & Task Definition
```json
{
  "family": "0xmart-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::<account>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<account>:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "0xmart-backend",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/0xmart-backend:latest",
      "portMappings": [{"containerPort": 8000, "protocol": "tcp"}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "8000"},
        {"name": "REDIS_HOST", "value": "<redis-endpoint>"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:..."},
        {"name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:..."}
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
        "command": ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

#### 3.4 ECS Service with ALB
```
Desired count: 2 (production), 1 (staging)
Launch type: FARGATE
Network: Private subnets
Load balancer: Application Load Balancer
Target group health check: /health endpoint
Auto-scaling: CPU > 70% or Memory > 80%
Deployment: Rolling update
```

---

### Phase 4: Load Balancer & DNS

#### 4.1 Application Load Balancer
- Create ALB in public subnets
- HTTPS listener on port 443 (requires SSL certificate)
- HTTP listener on port 80 → redirect to HTTPS
- Target group: ECS service on port 8000
- Health check: `/health` endpoint

#### 4.2 SSL Certificate (AWS Certificate Manager)
- Request certificate for `api.0xmart.com`
- Validate via DNS (add CNAME records)
- Attach to ALB HTTPS listener

#### 4.3 Route 53 DNS
- Create A record `api.0xmart.com` → ALB (alias record)

---

### Phase 5: Scheduled Tasks (Cron Jobs)

Your backend has cron jobs for deposit monitoring and withdrawal processing. Two approaches:

#### Option A: ECS Scheduled Tasks (Recommended)
```yaml
# EventBridge rule to run deposit monitor every 5 minutes
Schedule: rate(5 minutes)
Target: ECS Task (separate task definition for cron jobs)
Command Override: ["node", "dist/cron/deposit-monitor"]
```

#### Option B: Keep in-app cron (Current setup with @nestjs/schedule)
- Ensure only ONE ECS task runs cron jobs (use leader election)
- Or run cron in separate ECS service with desired count = 1

---

### Phase 6: Monitoring & Alerts

#### 6.1 CloudWatch Alarms
- ECS CPU > 80% for 5 minutes
- ECS Memory > 85% for 5 minutes
- ALB Target Unhealthy Count > 0
- RDS CPU > 80%
- RDS Free Storage < 10 GB
- Redis CPU > 75%
- 5xx errors > 10 in 5 minutes

#### 6.2 CloudWatch Logs
- ECS logs: `/ecs/0xmart-backend`
- Log retention: 30 days (adjust as needed)
- Log Insights queries for errors, performance

#### 6.3 CloudWatch Dashboards
- ECS metrics (CPU, memory, task count)
- ALB metrics (request count, latency, errors)
- RDS metrics (connections, IOPS, lag)
- Redis metrics (CPU, memory, evictions)

---

### Phase 7: CI/CD Pipeline (GitHub Actions)

#### 7.1 Create `.github/workflows/deploy.yml`
```yaml
name: Deploy to AWS ECS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build, tag, and push image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: 0xmart-backend
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster 0xmart-cluster --service 0xmart-backend --force-new-deployment
```

---

## Cost Estimation (Monthly)

### Production Environment
- ECS Fargate (2 tasks, 1 vCPU, 2GB): ~$60
- RDS PostgreSQL (db.t3.medium, Multi-AZ): ~$150
- ElastiCache Redis (cache.t3.small): ~$30
- Application Load Balancer: ~$25
- NAT Gateway: ~$45
- Data Transfer: ~$20
- CloudWatch Logs: ~$10
- **Total: ~$340/month**

### Staging Environment
- ECS Fargate (1 task): ~$30
- RDS PostgreSQL (db.t3.small): ~$40
- ElastiCache Redis (cache.t3.micro): ~$15
- ALB: ~$25
- **Total: ~$110/month**

---

## Migration Checklist

- [ ] Create VPC and networking infrastructure
- [ ] Set up RDS PostgreSQL database
- [ ] Set up ElastiCache Redis cluster
- [ ] Store secrets in AWS Secrets Manager
- [ ] Create ECS cluster and task definition
- [ ] Build and push Docker image to ECR
- [ ] Create Application Load Balancer
- [ ] Request SSL certificate (ACM)
- [ ] Configure Route 53 DNS
- [ ] Deploy ECS service
- [ ] Run database migrations (`npx prisma migrate deploy`)
- [ ] Test health check endpoint
- [ ] Configure CloudWatch alarms
- [ ] Set up GitHub Actions CI/CD
- [ ] Update frontend `NEXT_PUBLIC_API_BASE_URL` to `https://api.0xmart.com`
- [ ] Test webhook endpoints (Stripe, Razorpay, Sumsub)
- [ ] Test blockchain monitoring cron jobs
- [ ] Load test with realistic traffic
- [ ] Set up database backups verification
- [ ] Document rollback procedure

---

## Alternative: Quick Start with AWS Copilot CLI

For faster deployment, use AWS Copilot (opinionated AWS tool):

```bash
cd 0xmart-backend

# Initialize
copilot app init 0xmart

# Create environment
copilot env init --name production --profile default --default-config

# Create service (automatically provisions ECS, ALB, etc.)
copilot svc init --name backend --svc-type "Load Balanced Web Service" --dockerfile ./Dockerfile --port 8000

# Add secrets
copilot secret init --name DATABASE_URL
copilot secret init --name JWT_SECRET

# Deploy
copilot svc deploy --name backend --env production
```

---

## Next Steps

Choose one of the following approaches:

1. **Infrastructure-as-Code** (Terraform or AWS CDK) - Full automation
2. **GitHub Actions CI/CD Pipeline** - Automated deployments
3. **Detailed Migration Runbook** - Step-by-step manual deployment
4. **Cost Optimization Strategies** - Reduce AWS costs

---

## Important Notes

### Security Considerations
- All sensitive credentials MUST be stored in AWS Secrets Manager
- Never commit secrets to Git
- Use IAM roles for service-to-service authentication
- Enable encryption at rest and in transit for all services
- Implement VPC Flow Logs for network monitoring
- Regular security audits and penetration testing

### High Availability
- Multi-AZ deployment for RDS (production)
- Multiple ECS tasks across different AZs
- ALB distributes traffic across healthy targets
- Auto-scaling based on CPU/Memory metrics

### Disaster Recovery
- RDS automated backups (7-day retention)
- Point-in-time recovery enabled
- Cross-region backup replication (optional)
- Database export to S3 for long-term retention

### Performance Optimization
- Redis caching for frequently accessed data
- CDN (CloudFront) for static assets
- Database connection pooling
- ECS task auto-scaling
- ALB connection draining for zero-downtime deployments

---

**Last Updated:** 2026-01-21
**Status:** Planning Phase
