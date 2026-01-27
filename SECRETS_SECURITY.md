# Secrets Management - Security Guide

## Your Setup is ALREADY SECURE! ✅

### How It Works

**1. What's Committed to GitHub (SAFE):**
```yaml
# docker-compose.prod.yml
environment:
  JWT_SECRET: ${JWT_SECRET}              # ← Variable reference
  STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}  # ← NOT the actual secret!
```

**2. Actual Secrets Stay Local (NEVER committed):**
```bash
# .env file (blocked by .gitignore)
JWT_SECRET=your_actual_secret_here
STRIPE_SECRET_KEY=sk_live_your_real_key
```

**3. .gitignore Protection:**
```bash
# .gitignore already includes:
.env
.env.*
.env.local
.env.production
```

## Quick Verification

```bash
# Check .env is ignored
git status  # Should NOT show .env

# Verify .gitignore
cat .gitignore | grep "^\.env"
```

## Setup Process

### Local Development
```bash
# 1. Copy template (template is safe to commit)
cp .env.docker.example .env

# 2. Edit with real values
nano .env

# 3. Verify it's not tracked
git status  # .env should NOT appear
```

### Production (EC2)
```bash
# On your EC2 server (never on local machine for production secrets)
cp .env.docker.example .env

# Generate secure secrets
openssl rand -base64 32  # JWT_SECRET
openssl rand -base64 32  # JWT_REFRESH_SECRET

# Edit with production values
nano .env

# Restrict permissions
chmod 600 .env  # Only you can read/write
```

## Best Practices

### ✅ DO

1. **Keep .env files local**
   - Never commit to Git
   - Already blocked by .gitignore

2. **Use strong secrets**
   ```bash
   openssl rand -base64 32  # Generate random secrets
   ```

3. **Different secrets per environment**
   - Development: weak/test keys OK
   - Production: strong/live keys required

4. **Restrict file permissions**
   ```bash
   chmod 600 .env
   ```

5. **Use AWS Secrets Manager (advanced)**
   ```bash
   aws secretsmanager create-secret --name 0xmart/prod --secret-string file://secrets.json
   ```

### ❌ DON'T

1. **Never hardcode secrets in code**
   ```typescript
   // ❌ BAD
   const key = 'sk_live_123456';
   
   // ✅ GOOD
   const key = process.env.STRIPE_SECRET_KEY;
   ```

2. **Never commit .env files**
   ```bash
   # Already protected by .gitignore
   ```

3. **Never share secrets via email/Slack**
   - Use password managers
   - Use secure sharing tools

4. **Never log secrets**
   ```typescript
   // ❌ BAD
   console.log(process.env.JWT_SECRET);
   
   // ✅ GOOD
   console.log('JWT configured:', !!process.env.JWT_SECRET);
   ```

## What Gets Committed?

### ✅ Safe to Commit
- `docker-compose.yml` - Variable references only
- `docker-compose.prod.yml` - Variable references only
- `.env.docker.example` - Template with placeholders
- `.gitignore` - Blocks .env files

### ❌ NEVER Commit
- `.env` - Actual secrets
- `.env.local` - Local secrets
- `.env.production` - Production secrets
- `secrets.json` - JSON with secrets

## Emergency: Secrets Exposed?

**If you accidentally commit secrets:**

### Immediate Actions:

1. **Rotate ALL secrets**
   - Generate new API keys everywhere
   - Change all passwords
   - Update .env with new values

2. **Revoke old credentials**
   - Stripe/Razorpay dashboard
   - SendGrid settings
   - AWS console
   - All service providers

3. **Remove from Git history**
   ```bash
   # Install BFG Repo Cleaner
   brew install bfg  # macOS
   
   # Remove file from history
   bfg --delete-files .env
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   git push --force
   ```

4. **Monitor for abuse**
   - Check API usage dashboards
   - Review billing for unusual charges
   - Check access logs

## Environment Variable Priority

Docker Compose reads in this order:

1. Shell environment variables (highest priority)
2. `.env` file in project root
3. Default values in docker-compose.yml (lowest priority)

## Advanced: AWS Secrets Manager

For production teams:

```bash
# Store secrets
aws secretsmanager create-secret \
  --name 0xmart/backend/prod \
  --secret-string file://secrets.json

# Retrieve on EC2
aws secretsmanager get-secret-value \
  --secret-id 0xmart/backend/prod \
  --query SecretString \
  --output text | jq -r 'to_entries | .[] | "\(.key)=\(.value)"' > .env
```

## Summary

Your Docker setup is **ALREADY SECURE**:

✅ `.env` files blocked by `.gitignore`  
✅ Docker Compose uses variable references  
✅ Only `.env.docker.example` (template) is committed  
✅ Actual secrets stay on your local machine/server  

**As long as you never commit .env files, your secrets are safe!**

To verify:
```bash
git status  # .env should NOT appear
```

