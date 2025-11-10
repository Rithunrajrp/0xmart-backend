// ============================================
// SECURITY BEST PRACTICES
// ============================================
/\*

✅ Implemented:

- OTP expires in 10 minutes
- Max 5 attempts per OTP
- OTPs stored in memory (cleaned up automatically)
- JWT tokens with short expiration
- Refresh tokens stored in database
- Session management with revocation
- Audit logging for all auth events
- Email validation
- Protection against timing attacks

🔒 Additional recommendations:

- Rate limiting on OTP endpoints (already in ThrottlerModule)
- CAPTCHA for send-otp endpoint (implement with Google reCAPTCHA)
- IP-based rate limiting
- Device fingerprinting
- Email verification for sensitive operations
- 2FA for admin accounts

\*/

CRITICAL:

Save this mnemonic in a secure location
In production, store in AWS Secrets Manager or HashiCorp Vault
NEVER commit to Git
This controls ALL generated wallets

🔒 Security Best Practices

1. Hot Wallet Management
   DO:

✅ Keep minimal funds (only what's needed for daily withdrawals)
✅ Use AWS Secrets Manager for private key
✅ Set up automatic cold storage sweeps
✅ Monitor hot wallet balance 24/7
✅ Use multi-sig for hot wallet in production

DON'T:

❌ Store private key in .env in production
❌ Keep large amounts in hot wallet
❌ Share private key in code repositories
❌ Use same wallet for all networks

🔒 CRITICAL SECURITY MEASURES:

1. PRIVATE KEY MANAGEMENT:
   - ❌ NEVER store private key in .env in production
   - ✅ Use AWS Secrets Manager
   - ✅ Or use HashiCorp Vault
   - ✅ Or use Azure Key Vault
   - ✅ Rotate keys periodically

2. HOT WALLET STRATEGY:
   - Keep minimal funds in hot wallet
   - Transfer majority to cold storage
   - Set up automatic cold storage sweep
   - Monitor hot wallet balance

3. MULTI-SIGNATURE APPROVAL:
   - Require 2-3 admins for large amounts
   - Use Gnosis Safe for hot wallet
   - Implement approval workflow
   - Time-locked transactions

4. WITHDRAWAL LIMITS:
   - Daily limit per user
   - Single transaction limit
   - KYC-based limits
   - Velocity checks

5. FRAUD DETECTION:
   - Flag unusual withdrawal patterns
   - Check withdrawal frequency
   - Verify destination addresses
   - AML screening

6. MONITORING:
   - Alert on large withdrawals
   - Alert on failed transactions
   - Hot wallet balance alerts
   - Gas price alerts

7. BACKUP & RECOVERY:
   - Backup private keys (encrypted)
   - Multiple key holders
   - Recovery procedures documented
   - Test recovery process
