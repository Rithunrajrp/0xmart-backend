# Docker Deployment Guide - 0xMart Backend

Complete guide for deploying the 0xMart backend using Docker with PostgreSQL and Redis.

## Quick Start (Local Development)

### 1. Prerequisites
- Docker Engine 20.10+
- Docker Compose V2

### 2. Setup

```bash
# Copy environment file
cp .env.docker.example .env

# Edit with your values
nano .env

# Build and start
docker compose build
docker compose up -d

# View logs
docker compose logs -f backend
```

### 3. Access
- API: http://localhost:8000/api/v1
- Health: http://localhost:8000/api/v1/health

## Production Deployment

### 1. Prepare Environment

```bash
# Generate secure secrets
openssl rand -base64 32  # JWT_SECRET
openssl rand -base64 32  # JWT_REFRESH_SECRET  
openssl rand -base64 24  # POSTGRES_PASSWORD
openssl rand -base64 24  # REDIS_PASSWORD

# Update .env with production values
nano .env
```

### 2. Update Domain
Edit `nginx/conf.d/api.conf` and replace `api.0xmart.com` with your domain.

### 3. Deploy

```bash
# Build and start with production compose
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## SSL Certificate Setup (Let's Encrypt)

### Initial Certificate

```bash
# Temporarily comment out SSL lines in nginx/conf.d/api.conf

# Start nginx
docker compose -f docker-compose.prod.yml up -d nginx

# Generate certificate
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --email your-email@example.com --agree-tos --no-eff-email \
  -d api.yourdomain.com

# Uncomment SSL lines in nginx config
nano nginx/conf.d/api.conf

# Restart nginx
docker compose -f docker-compose.prod.yml restart nginx
```

Certificates auto-renew via the certbot container.

## Common Commands

### Service Management
```bash
# View status
docker compose ps

# View logs
docker compose logs -f backend

# Restart service
docker compose restart backend

# Stop all
docker compose down
```

### Database Operations
```bash
# Access PostgreSQL
docker compose exec postgres psql -U postgres -d 0xmartdb

# Backup database
docker compose exec postgres pg_dump -U postgres 0xmartdb > backup.sql

# Restore database
docker compose exec -T postgres psql -U postgres 0xmartdb < backup.sql

# Run migrations
docker compose exec backend npx prisma migrate deploy
```

### Redis Operations
```bash
# Access Redis CLI
docker compose exec redis redis-cli -a your_redis_password

# Test connection
docker compose exec redis redis-cli -a your_redis_password PING
```

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker compose logs backend

# Check database health
docker compose ps postgres

# Test database connection
docker compose exec postgres pg_isready -U postgres
```

### Port already in use
```bash
# Change PORT in .env file
# Or stop conflicting service
```

### SSL issues
```bash
# Check nginx config syntax
docker compose exec nginx nginx -t

# View nginx logs
docker compose logs nginx

# Reload nginx
docker compose exec nginx nginx -s reload
```

## Backup Strategy

Create `backup.sh`:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p backups
docker compose exec -T postgres pg_dump -U postgres 0xmartdb | gzip > backups/db_$DATE.sql.gz
```

## Next Steps

- Configure DNS to point to your server IP
- Set up monitoring
- Configure CI/CD pipeline
- See EC2_DEPLOYMENT.md for AWS deployment

