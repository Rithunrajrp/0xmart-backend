# 🚀 Quick Deployment Guide - api.0xmart.com

**Get your 0xMart backend live on Vercel in 10 minutes!**

## Prerequisites

- ✅ Vercel account ([sign up free](https://vercel.com))
- ✅ Production PostgreSQL database (Vercel Postgres, Supabase, or Neon)
- ✅ Domain `0xmart.com` configured in your DNS provider

## 🎯 Quick Start (3 Commands)

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy

```bash
cd 0xmart-backend
vercel
```

**That's it!** Follow the prompts and your API will be deployed.

## 🌐 Configure Custom Domain

After first deployment:

1. **Go to Vercel Dashboard**
   - Navigate to your project
   - Click **Settings** → **Domains**

2. **Add Domain**
   - Enter: `api.0xmart.com`
   - Click **Add**

3. **Update DNS**
   - Vercel will show DNS instructions
   - Add this CNAME record to your domain registrar:
     ```
     Type:  CNAME
     Name:  api
     Value: cname.vercel-dns.com
     ```

4. **Wait for DNS Propagation**
   - Usually takes 5-30 minutes
   - Check status in Vercel dashboard

## ⚙️ Environment Variables (Critical!)

You **must** add these environment variables in Vercel:

### Quick Setup via Dashboard

1. Go to Project → **Settings** → **Environment Variables**
2. Add each variable below (use production values)

### Minimum Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/0xmart

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here

# Master Seed (IMPORTANT: Use production seed, not development)
MASTER_SEED="your twelve word production mnemonic phrase"

# SendGrid Email
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@0xmart.com

# All template IDs (copy from .env)
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

# Payments
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx

# KYC
SUMSUB_APP_TOKEN=xxxxx
SUMSUB_SECRET_KEY=xxxxx

# AWS
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_S3_BUCKET=0xmart-products-bucket

# Frontend URL
FRONTEND_URL=https://0xmart.com

# Hot Wallets
HOT_WALLET_ADDRESS=0xYourAddress
SOLANA_HOT_WALLET_ADDRESS=YourSolanaAddress
SUI_HOT_WALLET_ADDRESS=0xYourSuiAddress

# RPC URLs (use production/mainnet)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
# ... add all other networks
```

**💡 Tip:** Copy all from your `.env` file, but use **production** values!

## 🗄️ Database Migrations

After deployment, run migrations:

```bash
# Set production database URL locally
export DATABASE_URL="your-production-database-url"

# Run migrations
npx prisma migrate deploy

# Optional: Seed initial data
npm run prisma:seed
```

## ✅ Verify Deployment

Test your API:

```bash
# Health check
curl https://api.0xmart.com/api/v1/health

# Or open in browser
open https://api.0xmart.com/api/v1/docs
```

Expected response:
```json
{"status": "ok", "timestamp": "2025-01-25T..."}
```

## 🔄 Update Frontend

After backend is deployed, update frontend:

### 1. Update Frontend Environment Variable

```bash
# In Vercel dashboard for 0xmart-web project
NEXT_PUBLIC_API_BASE_URL=https://api.0xmart.com/api/v1
```

### 2. Redeploy Frontend

```bash
cd ../0xmart-web
vercel --prod
```

## 📝 Post-Deployment Checklist

- [ ] API accessible at `https://api.0xmart.com/api/v1`
- [ ] Database connected (check logs)
- [ ] Can create user account via frontend
- [ ] Can login and get JWT token
- [ ] Email OTPs are sending (check SendGrid)
- [ ] Payment widget accessible: `https://api.0xmart.com/widget/0xmart-payment.js`
- [ ] Update webhook URLs in:
  - [ ] Stripe Dashboard → Webhooks → `https://api.0xmart.com/api/v1/webhooks/stripe`
  - [ ] Razorpay Dashboard → Webhooks → `https://api.0xmart.com/api/v1/webhooks/razorpay`
  - [ ] Sumsub Dashboard → Webhooks → `https://api.0xmart.com/api/v1/webhooks/sumsub`

## 🐛 Common Issues

### Build Failed

**Error:** `Cannot find module '@nestjs/...'`

**Fix:** Ensure all dependencies are in `package.json`, then redeploy.

### Database Connection Error

**Error:** `Can't reach database server`

**Fix:**
1. Check `DATABASE_URL` is set in Vercel
2. Whitelist Vercel IPs in your database (if using IP restrictions)
3. Use connection pooling: add `?connection_limit=5` to DATABASE_URL

### CORS Error

**Error:** `Access-Control-Allow-Origin`

**Fix:**
1. Check `FRONTEND_URL` is set in Vercel
2. Verify frontend domain matches allowed origins in `src/main.ts`

### Missing Environment Variables

**Error:** `Cannot read property 'xxx' of undefined`

**Fix:** Double-check all required env vars are in Vercel, then redeploy.

## 📊 Monitoring

### View Logs

```bash
# Real-time logs
vercel logs --follow

# Production only
vercel logs --prod
```

### Vercel Dashboard

- **Deployments:** See all deployments and their status
- **Logs:** Real-time function logs
- **Analytics:** Request metrics and performance
- **Environment Variables:** Manage secrets

## 🚨 Important Notes

### ⚠️ Vercel Limitations

- **Serverless:** Each endpoint is a separate function (cold starts possible)
- **Timeout:** 10s (Free), 60s (Pro), 900s (Enterprise)
- **No Cron Jobs:** Use Vercel Cron or external cron service
- **No WebSockets:** Use external service if needed

### 🔒 Security

- ✅ All traffic is HTTPS by default
- ✅ Secrets encrypted at rest
- ✅ Use environment variables for all sensitive data
- ❌ Never commit `.env` to Git
- ❌ Never use development keys in production

## 🔄 Redeploy After Changes

```bash
# Make code changes
git add .
git commit -m "your changes"
git push

# Deploy to production
vercel --prod
```

Or enable **Auto Deploy** in Vercel:
- Settings → Git → Enable automatic deployments from `main` branch

## 📚 Full Documentation

For detailed information, see:
- **[VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)** - Complete deployment guide
- **[AWS_DEPLOYMENT_PLAN.md](./AWS_DEPLOYMENT_PLAN.md)** - Alternative AWS deployment

## 🆘 Need Help?

- **Vercel Support:** https://vercel.com/support
- **Vercel Docs:** https://vercel.com/docs
- **Discord:** Join Vercel community
- **GitHub Issues:** https://github.com/vercel/vercel/discussions

---

**Estimated Setup Time:** 10-15 minutes
**Cost:** Free tier available (upgrade to Pro for production recommended)
**Last Updated:** 2025-01-25
