# AWS EC2 Deployment Guide - 0xMart Backend

Deploy 0xMart backend on AWS EC2 with Docker, SSL, and domain configuration.

## EC2 Instance Setup

### Launch Instance

**Specifications:**
- Instance Type: t3.medium (2 vCPU, 4GB RAM) minimum
- AMI: Ubuntu Server 22.04 LTS
- Storage: 30GB gp3 SSD
- Security Group: Allow ports 22, 80, 443

### Security Group Rules

| Type  | Port | Source    | Description |
|-------|------|-----------|-------------|
| SSH   | 22   | Your IP   | SSH access  |
| HTTP  | 80   | 0.0.0.0/0 | HTTP        |
| HTTPS | 443  | 0.0.0.0/0 | HTTPS       |

**Do NOT expose:** PostgreSQL (5432) or Redis (6379)

### Allocate Elastic IP

```bash
aws ec2 allocate-address
aws ec2 associate-address --instance-id i-xxxxx --allocation-id eipalloc-xxxxx
```

## Install Docker

### Connect to EC2

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
newgrp docker

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Install Git and tools
sudo apt install git certbot -y

# Verify
docker --version
docker compose version
```

## Deploy Application

### Upload Code

```bash
# Clone repository
git clone https://github.com/your-org/0xmart-backend.git
cd 0xmart-backend
```

Or upload via SCP from local machine:
```bash
scp -i your-key.pem -r 0xmart-backend ubuntu@your-ec2-ip:~/
```

### Configure Environment

```bash
# Copy template
cp .env.docker.example .env

# Generate secrets
openssl rand -base64 32  # JWT_SECRET
openssl rand -base64 32  # JWT_REFRESH_SECRET
openssl rand -base64 24  # POSTGRES_PASSWORD
openssl rand -base64 24  # REDIS_PASSWORD

# Edit .env file with production values
nano .env
```

### Update Domain

```bash
# Edit nginx config
nano nginx/conf.d/api.conf

# Replace api.0xmart.com with your domain: api.yourdomain.com
```

### Start Services

```bash
# Build images
docker compose -f docker-compose.prod.yml build

# Start services (comment out SSL lines in nginx config first)
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose logs -f
```

## Configure DNS

Add A record in your DNS provider:

```
Type: A
Name: api
Value: YOUR_EC2_ELASTIC_IP
TTL: 300
```

Wait 5-10 minutes for propagation, then test:
```bash
nslookup api.yourdomain.com
curl http://api.yourdomain.com/api/v1/health
```

## SSL Certificate (Let's Encrypt)

### Generate Certificate

```bash
# Generate certificate
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --email your-email@example.com --agree-tos --no-eff-email \
  -d api.yourdomain.com
```

### Enable SSL

```bash
# Uncomment SSL lines in nginx config
nano nginx/conf.d/api.conf

# Restart nginx
docker compose -f docker-compose.prod.yml restart nginx

# Test HTTPS
curl https://api.yourdomain.com/api/v1/health
```

Certificates auto-renew via certbot container.

## Security Setup

### Firewall (UFW)

```bash
# Enable UFW
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### Fail2Ban

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

### Secure SSH

```bash
sudo nano /etc/ssh/sshd_config
```

Set:
```
PermitRootLogin no
PasswordAuthentication no
```

```bash
sudo systemctl restart sshd
```

## Monitoring & Maintenance

### Automated Backups

Create backup script:
```bash
cat > ~/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p ~/backups
cd ~/0xmart-backend
docker compose exec -T postgres pg_dump -U postgres 0xmartdb | gzip > ~/backups/db_$DATE.sql.gz
find ~/backups -name "*.gz" -mtime +7 -delete
EOF

chmod +x ~/backup.sh

# Schedule daily backups
crontab -e
# Add: 0 2 * * * ~/backup.sh
```

### View Logs

```bash
# Application logs
docker compose logs -f backend

# System logs
sudo journalctl -xe

# Resource usage
docker stats
df -h
free -h
```

## Common Operations

### Update Application

```bash
cd ~/0xmart-backend
git pull
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d backend
docker compose logs -f backend
```

### Restart Services

```bash
docker compose -f docker-compose.prod.yml restart
```

### Database Migration

```bash
docker compose exec backend npx prisma migrate deploy
```

## Troubleshooting

### Check SSL Certificate

```bash
ls -la certbot/conf/live/api.yourdomain.com/
docker compose exec nginx nginx -t
```

### Database Issues

```bash
docker compose logs postgres
docker compose exec postgres pg_isready -U postgres
```

### Disk Space

```bash
df -h
docker system prune -a --volumes
sudo journalctl --vacuum-time=7d
```

## Cost Optimization

- Use Reserved Instances (save up to 70%)
- Set up CloudWatch billing alarms
- Use S3 for backups
- Consider spot instances for dev/staging

## Next Steps

1. Set up CI/CD pipeline (GitHub Actions)
2. Configure CloudWatch monitoring
3. Add database replication
4. Configure CDN (CloudFront)

