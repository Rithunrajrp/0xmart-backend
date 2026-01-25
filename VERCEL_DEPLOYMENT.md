# Vercel Deployment Guide - api.0xmart.com

This guide walks through deploying the 0xMart NestJS backend to Vercel with the subdomain `api.0xmart.com`.

## Prerequisites

- Vercel account (sign up at https://vercel.com)
- Vercel CLI installed: `npm i -g vercel`
- Domain `0xmart.com` added to your Vercel account
- PostgreSQL database (recommended: Vercel Postgres, Supabase, or Neon)
- All required API keys and secrets

## Quick Start

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Link Project (First Time)

From the backend directory:

```bash
cd 0xmart-backend
vercel
```

Follow the prompts:
- **Set up and deploy?** Y
- **Which scope?** Select your account/team
- **Link to existing project?** N (first time) or Y (subsequent)
- **Project name?** `0xmart-api`
- **Directory?** `./` (current directory)
- **Override settings?** N

### 4. Configure Custom Domain

After first deployment:

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add custom domain: `api.0xmart.com`
3. Vercel will provide DNS instructions:
   - Type: `CNAME`
   - Name: `api`
   - Value: `cname.vercel-dns.com`
4. Add DNS record in your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)
5. Wait for DNS propagation (5-30 minutes)

### 5. Configure Environment Variables

Add all environment variables from `.env` to Vercel:

**Option A: Via Vercel Dashboard**
1. Go to Project → Settings → Environment Variables
2. Add each variable from `.env`

**Option B: Via Vercel CLI**
```bash
# Add all production environment variables
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel env add SENDGRID_API_KEY production
# ... repeat for all variables
```

**Option C: Bulk Import (Recommended)**
```bash
# Pull current env vars
vercel env pull .env.vercel

# Push to production
vercel env add < .env.production
```

### 6. Deploy to Production

```bash
# Build locally first (optional, to test)
npm run build

# Deploy to production
vercel --prod
```

## Environment Variables Checklist

Make sure to add these to Vercel:

### Required Variables

```bash
# Application
NODE_ENV=production
PORT=8000
API_PREFIX=api/v1

# Database (use production PostgreSQL URL)
DATABASE_URL=postgresql://user:password@host:5432/0xmart?schema=public

# JWT Authentication
JWT_SECRET=your-production-jwt-secret-here
JWT_REFRESH_SECRET=your-production-jwt-refresh-secret-here
JWT_EXPIRATION=30d
JWT_REFRESH_EXPIRATION=60d

# Master Key Encryption
MASTER_KEY_ENCRYPTION_SECRET=your-64-char-encryption-secret
MASTER_KEY_ENCRYPTION_SALT=your-64-char-encryption-salt

# Email (SendGrid)
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@0xmart.com
SENDGRID_FROM_NAME=0xMart

# SendGrid Template IDs
SENDGRID_OTP_TEMPLATE_ID=d-xxxxx
SENDGRID_DEPOSIT_TEMPLATE_ID=d-xxxxx
SENDGRID_WITHDRAWAL_TEMPLATE_ID=d-xxxxx
SENDGRID_WITHDRAWAL_FAILED_TEMPLATE_ID=d-xxxxx
SENDGRID_WELCOME_TEMPLATE_ID=d-xxxxx
SENDGRID_TRANSACTION_TEMPLATE_ID=d-xxxxx
SENDGRID_KYC_APPROVED_TEMPLATE_ID=d-xxxxx
SENDGRID_KYC_REJECTED_TEMPLATE_ID=d-xxxxx
SENDGRID_ORDER_CONFIRMED_TEMPLATE_ID=d-xxxxx
SENDGRID_ORDER_SHIPPED_TEMPLATE_ID=d-xxxxx
SENDGRID_MERCHANT_ONBOARDING_TEMPLATE_ID=d-xxxxx
SUPPORT_LINK=https://support.0xmart.com/help

# Payment Providers
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx

# KYC Provider
SUMSUB_APP_TOKEN=xxxxx
SUMSUB_SECRET_KEY=xxxxx
SUMSUB_BASE_URL=https://api.sumsub.com

# AWS Services
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_S3_BUCKET=0xmart-products-bucket

# Master Seed (CRITICAL - Use production seed)
MASTER_SEED="your production twelve word mnemonic phrase"

# Hot Wallet Addresses
HOT_WALLET_ADDRESS=0xYourProductionAddress
SOLANA_HOT_WALLET_ADDRESS=YourSolanaAddress
SUI_HOT_WALLET_ADDRESS=0xYourSuiAddress

# Frontend URL (for CORS)
FRONTEND_URL=https://0xmart.com

# reCAPTCHA
RECAPTCHA_SECRET_KEY=your-production-recaptcha-key
```

### Blockchain RPC URLs (Production)

Add production RPC URLs for all supported networks:

```bash
# EVM Networks - Mainnet
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY
BSC_RPC_URL=https://bsc-dataseed1.binance.org
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY
OPTIMISM_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/YOUR_API_KEY
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Non-EVM Networks
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
TON_RPC_URL=https://toncenter.com/api/v2/jsonRPC
TON_API_KEY=xxxxx
```

### Smart Contract Addresses (Production)

```bash
# EVM Payment Contracts (Update after mainnet deployment)
ETHEREUM_PAYMENT_CONTRACT=0x0000000000000000000000000000000000000000
POLYGON_PAYMENT_CONTRACT=0x0000000000000000000000000000000000000000
BSC_PAYMENT_CONTRACT=0x0000000000000000000000000000000000000000
ARBITRUM_PAYMENT_CONTRACT=0x0000000000000000000000000000000000000000
OPTIMISM_PAYMENT_CONTRACT=0x0000000000000000000000000000000000000000
AVALANCHE_PAYMENT_CONTRACT=0x0000000000000000000000000000000000000000
BASE_PAYMENT_CONTRACT=0x0000000000000000000000000000000000000000

# Non-EVM Contracts
SOLANA_PROGRAM_ID=YourProgramID
SUI_PAYMENT_CONTRACT=0xYourSuiContractAddress
TON_PAYMENT_CONTRACT=YourTonContractAddress
```

## Database Setup

### Option 1: Vercel Postgres (Recommended)

1. Go to Vercel Dashboard → Storage → Create Database
2. Select "Postgres"
3. Choose region (same as API deployment)
4. Vercel will automatically add `DATABASE_URL` to your project

### Option 2: External PostgreSQL (Supabase, Neon, Railway)

1. Create PostgreSQL database on your provider
2. Get connection string
3. Add to Vercel: `DATABASE_URL=postgresql://...`

### Run Migrations

After deploying:

```bash
# Install dependencies on your local machine
npm install

# Run migrations against production database
npx prisma migrate deploy

# Seed initial data (optional)
npm run prisma:seed
```

**⚠️ Important:** Set `DATABASE_URL` locally to production URL when running migrations, or use:

```bash
DATABASE_URL="your-production-url" npx prisma migrate deploy
```

## Build Configuration

The project is configured with:

**vercel.json:**
- Builds the `dist/main.js` file using `@vercel/node`
- Routes all `/api/v1/*` requests to NestJS
- Serves payment widget from `/widget/*`

**package.json:**
- Build command: `nest build`
- Start command: `node dist/main`

## Post-Deployment Checklist

After deployment, verify:

- [ ] API is accessible at `https://api.0xmart.com/api/v1`
- [ ] Health check: `curl https://api.0xmart.com/api/v1/health`
- [ ] Swagger docs (if enabled): `https://api.0xmart.com/api/v1/docs`
- [ ] Database migrations ran successfully
- [ ] Environment variables are set correctly
- [ ] CORS allows your frontend domain
- [ ] Webhook endpoints are accessible (for Stripe, Razorpay, Sumsub)
- [ ] Payment widget is accessible: `https://api.0xmart.com/widget/0xmart-payment.js`

## Update Frontend Configuration

After API deployment, update frontend:

### 0xmart-web/.env.production

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.0xmart.com/api/v1
NEXT_PUBLIC_APP_URL=https://0xmart.com
```

Then redeploy frontend:

```bash
cd ../0xmart-web
vercel --prod
```

## Monitoring & Logs

### View Logs

```bash
# Real-time logs
vercel logs --follow

# Production logs
vercel logs --prod

# Specific deployment
vercel logs [deployment-url]
```

### Vercel Dashboard

- Go to Project → Deployments
- Click on a deployment to see:
  - Build logs
  - Function logs
  - Performance metrics
  - Error tracking

## Troubleshooting

### Build Fails

**Issue:** Build timeout or errors

**Solutions:**
1. Check build logs: `vercel logs`
2. Test build locally: `npm run build`
3. Ensure all dependencies are in `package.json`
4. Check TypeScript errors: `npm run lint`

### Database Connection Issues

**Issue:** Cannot connect to database

**Solutions:**
1. Verify `DATABASE_URL` is set in Vercel
2. Check database is accessible from external connections
3. Whitelist Vercel IP ranges (if using IP restrictions)
4. Test connection string locally

### CORS Errors

**Issue:** Frontend cannot access API

**Solutions:**
1. Verify frontend domain in `allowedOrigins` (src/main.ts:23-37)
2. Check `FRONTEND_URL` environment variable in Vercel
3. Ensure HTTPS in production (not HTTP)

### Environment Variables Not Working

**Issue:** API returns errors about missing config

**Solutions:**
1. Check all required env vars are in Vercel
2. Redeploy after adding variables: `vercel --prod`
3. Use same variable names as in `.env.example`

### Function Timeout

**Issue:** Requests timeout after 10 seconds

**Solutions:**
1. Upgrade to Vercel Pro (60s timeout)
2. Optimize long-running operations
3. Use background jobs for heavy processing
4. Consider moving scheduled tasks to external cron service

## Vercel Limitations for NestJS

### ⚠️ Important Limitations

1. **Serverless Functions:** Each API route becomes a serverless function
2. **Cold Starts:** First request after idle may be slow (1-3s)
3. **Execution Time:**
   - Free: 10 seconds max
   - Pro: 60 seconds max
   - Enterprise: 900 seconds max
4. **No WebSockets:** Use external service (Pusher, Ably) for real-time features
5. **No Cron Jobs:** Use Vercel Cron or external service (cron-job.org)
6. **File System:** Read-only except `/tmp` directory

### Scheduled Tasks Workaround

For deposit monitoring and withdrawal processing:

**Option 1: Vercel Cron**

Create `vercel.json` cron configuration:

```json
{
  "crons": [
    {
      "path": "/api/v1/cron/deposit-monitor",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/v1/cron/withdrawal-processor",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

Then create cron endpoints in NestJS.

**Option 2: External Cron Service**

Use https://cron-job.org or similar to hit:
- `https://api.0xmart.com/api/v1/cron/deposit-monitor` (every 5 min)
- `https://api.0xmart.com/api/v1/cron/withdrawal-processor` (every 10 min)

Secure with API key header.

## Production Optimizations

### 1. Enable Caching

Add to API responses:

```typescript
@Header('Cache-Control', 'public, max-age=60')
```

### 2. Database Connection Pooling

Use connection pooling for PostgreSQL:

```env
DATABASE_URL=postgresql://user:password@host:5432/0xmart?schema=public&connection_limit=5&pool_timeout=10
```

### 3. Enable Compression

Already configured in `src/main.ts`:

```typescript
app.use(compression());
```

### 4. Use Edge Functions (Optional)

For faster responses in multiple regions, consider Vercel Edge Functions for static/cached endpoints.

## Support

- **Vercel Docs:** https://vercel.com/docs
- **NestJS Deployment:** https://docs.nestjs.com/deployment
- **Issues:** https://github.com/vercel/vercel/discussions

## Next Steps

1. Deploy to production: `vercel --prod`
2. Add custom domain: `api.0xmart.com`
3. Configure environment variables
4. Run database migrations
5. Update frontend API URL
6. Test all endpoints
7. Set up monitoring and alerts
8. Configure webhook URLs in Stripe/Razorpay/Sumsub dashboards

---

**Last Updated:** 2025-01-25
**Deployment Status:** ✅ Ready for Production
