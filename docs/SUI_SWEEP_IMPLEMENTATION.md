# SUI Automatic Sweep Implementation

## Overview

This document describes the automatic sweep mechanism for SUI deposits. When users send USDC or other stablecoins to their SUI deposit addresses, the system automatically transfers (sweeps) those funds to a centralized hot wallet after deposit confirmation.

## Architecture

### Flow Diagram

```
User sends USDC to deposit address
         ↓
System detects deposit (DepositMonitorService)
         ↓
Deposit confirms after 1 checkpoint
         ↓
System credits user's wallet balance
         ↓
Sweep transaction triggered automatically
         ↓
Funds transferred from deposit address to hot wallet
         ↓
Sweep transaction recorded in database
```

### Why Sweep?

1. **Security**: Consolidates user deposits into a single, well-secured hot wallet
2. **Gas Optimization**: Easier to manage gas/SUI for withdrawals from one wallet
3. **Operational Efficiency**: Simplifies withdrawal processing and fund management
4. **Auditing**: Clear separation between deposit tracking and fund custody

## Components

### 1. Database Schema

#### Updated `wallets` table
```sql
ALTER TABLE wallets ADD COLUMN encryptedPrivateKey TEXT;
```
- Stores AES-256-GCM encrypted private key for each deposit address
- Only populated for non-EVM networks (SUI, Solana, TON)
- EVM wallets reuse the same address across networks

#### New `sweep_transactions` table
```sql
CREATE TABLE sweep_transactions (
  id                TEXT PRIMARY KEY,
  walletId          TEXT NOT NULL REFERENCES wallets(id),
  depositId         TEXT,
  fromAddress       TEXT NOT NULL,  -- User's deposit address
  toAddress         TEXT NOT NULL,  -- Hot wallet address
  amount            DECIMAL(20,8) NOT NULL,
  stablecoinType    TEXT NOT NULL,
  network           TEXT NOT NULL,
  txHash            TEXT UNIQUE,
  gasUsed           TEXT,
  gasFee            DECIMAL(20,8),
  status            TEXT NOT NULL DEFAULT 'PENDING',
  createdAt         TIMESTAMP DEFAULT NOW(),
  processedAt       TIMESTAMP,
  completedAt       TIMESTAMP,
  failureReason     TEXT,
  retryCount        INT DEFAULT 0,
  maxRetries        INT DEFAULT 3
);
```

### 2. Encryption Utility

**Location**: `src/common/utils/encryption.util.ts`

**Features**:
- AES-256-GCM encryption (authenticated encryption)
- Unique IV (initialization vector) per encryption
- PBKDF2 key derivation from master secret
- Base64-encoded output for database storage

**Methods**:
- `encrypt(plaintext, secret)` - Encrypts private keys
- `decrypt(encrypted, secret)` - Decrypts private keys
- `validateEncryption(secret)` - Tests encryption/decryption

### 3. SUI Blockchain Service

**Location**: `src/modules/wallets/services/sui-blockchain.service.ts`

**New Method**: `sweepCoins(privateKey, hotWalletAddress, coinType)`

**Features**:
- Creates Ed25519 keypair from private key
- Queries all coin objects for the deposit address
- Merges multiple coin objects if needed
- Transfers merged coins to hot wallet in single transaction
- Returns transaction digest, amount, and gas fee

**Transaction Flow**:
```typescript
1. Load keypair from encrypted private key
2. Get all coin objects for deposit address
3. If multiple coins, merge them
4. Transfer merged coins to hot wallet
5. Set gas budget (0.01 SUI default)
6. Sign and execute transaction
7. Return result with digest and gas fee
```

### 4. Deposit Monitor Service

**Location**: `src/modules/deposit-monitor/deposit-monitor.service.ts`

**Modified Method**: `confirmDeposit()`
- After confirming deposit and crediting wallet balance
- Calls `sweepSuiDeposit()` for SUI network deposits

**New Method**: `sweepSuiDeposit(deposit)`

**Process**:
1. Get hot wallet address from config
2. Decrypt deposit address private key
3. Get coin type from token config
4. Create pending sweep transaction record
5. Execute sweep via `SuiBlockchainService.sweepCoins()`
6. Update sweep transaction as completed/failed
7. Create audit log entry

**Error Handling**:
- Logs all errors with context
- Updates sweep transaction status as FAILED
- Increments retry count
- Does not block deposit confirmation if sweep fails

### 5. Wallet Service

**Location**: `src/modules/wallets/wallets.service.ts`

**Modified Method**: `createWallet()`
- Generates deposit address and private key
- Encrypts private key using EncryptionUtil
- Stores encrypted private key in database
- For EVM wallets, reuses existing address/key if available

## Configuration

### Environment Variables

Add to `.env`:

```bash
# SUI Hot Wallet (for automatic sweep of deposits)
# CRITICAL: Store securely in production (AWS Secrets Manager, HashiCorp Vault)
SUI_HOT_WALLET_ADDRESS=0x<your-hot-wallet-address>
SUI_HOT_WALLET_PRIVATE_KEY=<base64-encoded-private-key>

# Master Key Encryption (for secure storage of private keys)
# Generate using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
MASTER_KEY_ENCRYPTION_SECRET=<32-character-hex-string>
MASTER_KEY_ENCRYPTION_SALT=<32-character-hex-string>
```

### Configuration Service

**Location**: `config/configuration.ts`

```typescript
blockchain: {
  // ... other networks ...
  sui: process.env.SUI_RPC_URL,
  suiHotWallet: process.env.SUI_HOT_WALLET_ADDRESS,
  suiHotWalletPrivateKey: process.env.SUI_HOT_WALLET_PRIVATE_KEY,
}
```

## Setup Instructions

### 1. Generate Hot Wallet

```bash
# Using SUI CLI (recommended)
sui client new-address ed25519

# Or use the address generator service
# The generated address and private key should be stored securely
```

### 2. Fund Hot Wallet with SUI

The hot wallet needs SUI for gas fees:

```bash
# Testnet faucet
curl --location --request POST 'https://faucet.testnet.sui.io/gas' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "FixedAmountRequest": {
      "recipient": "<hot-wallet-address>"
    }
  }'

# Mainnet: Transfer SUI manually
```

### 3. Set Environment Variables

```bash
# Add to .env
SUI_HOT_WALLET_ADDRESS=0x<address>
SUI_HOT_WALLET_PRIVATE_KEY=<private-key>
MASTER_KEY_ENCRYPTION_SECRET=<32-char-secret>
```

### 4. Run Database Migration

Option A - Automatic (if Prisma works):
```bash
cd 0xmart-backend
npx prisma migrate dev --name add_sweep_functionality
npx prisma generate
```

Option B - Manual (if Prisma migration fails):
```bash
# Connect to PostgreSQL
psql -U <user> -d <database>

# Run the migration script
\i prisma/migrations/manual_sweep_migration.sql
```

### 5. Restart Backend

```bash
npm run start:dev
```

## Testing

### 1. Test Encryption

```bash
# Run encryption test
node -e "
const { EncryptionUtil } = require('./dist/src/common/utils/encryption.util');
const secret = process.env.MASTER_KEY_ENCRYPTION_SECRET;
console.log('Testing encryption...');
EncryptionUtil.validateEncryption(secret).then(valid => {
  console.log('Encryption test:', valid ? 'PASSED' : 'FAILED');
});
"
```

### 2. Test Wallet Creation

```bash
# Create a SUI wallet via API
curl -X POST http://localhost:8000/api/v1/wallets \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "stablecoinType": "USDC",
    "network": "SUI"
  }'

# Verify encrypted private key is stored
# Check database: SELECT id, depositAddress, encryptedPrivateKey FROM wallets WHERE network = 'SUI';
```

### 3. Test Deposit Detection and Sweep

**Step 1**: Get a test wallet address
```bash
# Via API or database
SELECT depositAddress FROM wallets WHERE network = 'SUI' AND stablecoinType = 'USDC' LIMIT 1;
```

**Step 2**: Send test USDC to the deposit address
```bash
# Using SUI CLI or wallet
sui client transfer-sui \
  --to <deposit-address> \
  --sui-coin-object-id <coin-object> \
  --gas-budget 10000000
```

**Step 3**: Trigger manual deposit scan
```bash
# Via API
curl -X POST http://localhost:8000/api/v1/deposit-monitor/scan \
  -H "Authorization: Bearer <admin-token>"

# Or via wallet refresh
curl -X POST http://localhost:8000/api/v1/wallets/<wallet-id>/refresh \
  -H "Authorization: Bearer <jwt-token>"
```

**Step 4**: Monitor logs
```bash
# Check backend logs for:
# - "New SUI deposit detected"
# - "Confirming deposit"
# - "Initiating SUI sweep"
# - "Sweep successful!"
```

**Step 5**: Verify sweep transaction
```bash
# Check database
SELECT * FROM sweep_transactions WHERE status = 'COMPLETED' ORDER BY createdAt DESC LIMIT 1;

# Check hot wallet balance on SUI explorer
https://testnet.suivision.xyz/account/<hot-wallet-address>
```

## Monitoring

### Database Queries

**Check pending sweeps**:
```sql
SELECT * FROM sweep_transactions
WHERE status = 'PENDING'
ORDER BY createdAt DESC;
```

**Check failed sweeps**:
```sql
SELECT * FROM sweep_transactions
WHERE status = 'FAILED'
ORDER BY createdAt DESC;
```

**Get sweep statistics**:
```sql
SELECT
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(gasFee) as avg_gas_fee
FROM sweep_transactions
GROUP BY status;
```

### Logs to Monitor

- `New SUI deposit detected` - Deposit found by monitor
- `Confirming deposit` - Deposit reached required confirmations
- `Initiating SUI sweep` - Sweep process started
- `Sweep successful!` - Funds transferred to hot wallet
- `Sweep transaction failed` - Error occurred during sweep

### Alerts to Set Up

1. **Failed sweeps**: Alert if `retryCount >= maxRetries`
2. **Hot wallet balance**: Alert if SUI balance < 0.1 (not enough for gas)
3. **Encryption failures**: Alert on decryption errors
4. **Pending sweeps**: Alert if sweep pending > 5 minutes

## Security Considerations

### Private Key Storage

✅ **Encrypted at rest**: All private keys encrypted with AES-256-GCM
✅ **Unique IV**: Each encryption uses unique initialization vector
✅ **Key derivation**: PBKDF2 used to derive encryption key from master secret
⚠️ **Master secret**: Must be stored in AWS Secrets Manager or HSM in production
⚠️ **Hot wallet**: Should have multi-sig or cold wallet backup for large amounts

### Access Control

- Only `DepositMonitorService` can trigger sweeps (internal service)
- No API endpoint exposes sweep functionality
- Private keys never returned in API responses
- Audit logs track all sweep operations

### Gas Management

- Hot wallet must maintain minimum SUI balance for gas
- Sweep transactions set gas budget to 0.01 SUI
- Failed sweeps due to insufficient gas are logged and can be retried

## Troubleshooting

### Issue: Sweep fails with "Invalid private key format"

**Cause**: Encrypted private key is corrupted or encryption secret changed

**Solution**:
1. Check `MASTER_KEY_ENCRYPTION_SECRET` hasn't changed
2. Verify wallet has `encryptedPrivateKey` field populated
3. Test decryption manually:
   ```typescript
   const decrypted = await addressGenerator.decryptPrivateKey(wallet.encryptedPrivateKey);
   console.log('Decrypted length:', decrypted.length);
   ```

### Issue: Sweep fails with "Insufficient SUI for gas"

**Cause**: Hot wallet doesn't have enough SUI for transaction fees

**Solution**:
1. Check hot wallet balance: `sui client gas --address <hot-wallet>`
2. Send more SUI to hot wallet
3. Retry failed sweep transactions

### Issue: Deposit detected but sweep not triggered

**Cause**: Network mismatch or sweep logic not enabled

**Solution**:
1. Verify deposit network is 'SUI'
2. Check `confirmDeposit()` method calls `sweepSuiDeposit()`
3. Check logs for errors in sweep process
4. Verify `SUI_HOT_WALLET_ADDRESS` is configured

### Issue: Multiple sweep attempts for same deposit

**Cause**: Sweep failed but deposit already confirmed

**Solution**:
1. Check `sweep_transactions` table for failed attempts
2. Verify `retryCount < maxRetries`
3. Check `failureReason` in database
4. Manually retry if needed (future feature: admin endpoint to retry)

## Future Enhancements

1. **Retry mechanism**: Automatic retry of failed sweeps with exponential backoff
2. **Batch sweeping**: Combine multiple small deposits into single sweep transaction
3. **Dynamic gas estimation**: Adjust gas budget based on transaction complexity
4. **Admin dashboard**: View and manage sweep transactions
5. **Manual sweep endpoint**: Allow admins to trigger sweeps manually
6. **Multi-network support**: Extend to Solana and TON deposits
7. **Webhook notifications**: Notify external systems of sweep completions
8. **Gas optimization**: Use SUI gas station for optimal gas prices

## References

- [SUI Transaction Building](https://docs.sui.io/guides/developer/sui-101/building-ptb)
- [SUI Coin Management](https://docs.sui.io/guides/developer/sui-101/working-with-ptbs)
- [Ed25519 Keypairs](https://docs.sui.io/guides/developer/cryptography/transaction-auth/signatures)
- [AES-256-GCM Encryption](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
