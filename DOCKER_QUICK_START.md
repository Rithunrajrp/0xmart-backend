# Docker Quick Start - 0xMart Backend

Get your 0xMart backend running with Docker in 5 minutes!

## Local Development

```bash
# 1. Copy environment file
cp .env.docker.example .env

# 2. Edit .env with your values (at minimum set passwords)
nano .env

# 3. Build and start
docker compose up -d

# 4. Check status
docker compose ps
docker compose logs -f backend

# 5. Access API
curl http://localhost:8000/api/v1/health
```

That's it! API is running at `http://localhost:8000/api/v1`

## Production Deployment

### Quick Deploy to EC2

1. **Launch EC2 Instance**
   - Type: t3.medium
   - AMI: Ubuntu 22.04
   - Ports: 22, 80, 443

2. **Install Docker**
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip

curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
sudo apt install docker-compose-plugin git -y
```

3. **Deploy Application**
```bash
git clone your-repo
cd 0xmart-backend
cp .env.docker.example .env
nano .env  # Update with production values
nano nginx/conf.d/api.conf  # Update domain
docker compose -f docker-compose.prod.yml up -d
```

4. **Configure DNS**
   - Add A record: `api` -> Your EC2 IP

5. **Enable SSL**
```bash
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --email your-email@example.com -d api.yourdomain.com
  
# Uncomment SSL lines in nginx/conf.d/api.conf
docker compose -f docker-compose.prod.yml restart nginx
```

## Files Created

- `Dockerfile` - Production-ready multi-stage build
- `docker-compose.yml` - Local development setup
- `docker-compose.prod.yml` - Production setup with Nginx + SSL
- `.dockerignore` - Excludes unnecessary files
- `nginx/nginx.conf` - Nginx main configuration
- `nginx/conf.d/api.conf` - API reverse proxy config
- `.env.docker.example` - Environment variables template

## Useful Commands

```bash
# View logs
docker compose logs -f backend

# Restart service
docker compose restart backend

# Access database
docker compose exec postgres psql -U postgres -d 0xmartdb

# Backup database
docker compose exec postgres pg_dump -U postgres 0xmartdb > backup.sql

# Run migrations
docker compose exec backend npx prisma migrate deploy

# Stop everything
docker compose down
```

## Documentation

- **[DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)** - Complete Docker deployment guide
- **[EC2_DEPLOYMENT.md](./EC2_DEPLOYMENT.md)** - AWS EC2 setup guide with SSL

## Need Help?

1. Check logs: `docker compose logs`
2. Verify environment variables in `.env`
3. Ensure ports 8000, 5432, 6379 are available
4. Review troubleshooting section in documentation

