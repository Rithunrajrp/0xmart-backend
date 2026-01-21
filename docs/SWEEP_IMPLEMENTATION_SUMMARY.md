# Automatic Sweep Implementation - Summary of Changes

## Overview

Implemented automatic sweep mechanism for **SUI** and **Solana** deposits that transfers funds from user deposit addresses to centralized hot wallets after confirmation.

**Networks with Sweep**: SUI, Solana
**Networks without Sweep**: EVM chains (address reuse optimization), TON (Telegram Mini App)

## Files Modified

### 1. Database Schema
**File**: `prisma/schema.prisma`

**Changes**:
- Added `encryptedPrivateKey` field to `Wallet` model
- Created new `SweepTransaction` model with fields:
  - walletId, depositId, fromAddress, toAddress
  - amount, stablecoinType, network, txHash
  - gasUsed, gasFee, status, timestamps
  - retryCount, maxRetries, failureReason
- Added relation from Wallet to SweepTransaction

### 2. Environment Configuration
**File**: `.env.example`

**Changes**:
- Added `SUI_HOT_WALLET_ADDRESS` - SUI hot wallet address
- Added `SUI_HOT_WALLET_PRIVATE_KEY` - SUI hot wallet private key (hex-encoded)
- Added `SOLANA_HOT_WALLET_ADDRESS` - Solana hot wallet address (base58)
- Added `SOLANA_HOT_WALLET_PRIVATE_KEY` - Solana hot wallet private key (hex-encoded)

### 3. Application Configuration
**File**: `config/configuration.ts`

**Changes**:
- Added `blockchain.suiHotWallet` configuration
- Added `blockchain.suiHotWalletPrivateKey` configuration
- Added `blockchain.solanaHotWallet` configuration
- Added `blockchain.solanaHotWalletPrivateKey` configuration

### 4. Encryption Utility (NEW)
**File**: `src/common/utils/encryption.util.ts`

**Features**:
- AES-256-GCM encryption with unique IV per encryption
- PBKDF2-based key derivation from master secret
- Base64 encoding for database storage
- Methods: `encrypt()`, `decrypt()`, `validateEncryption()`

### 5. Address Generator Service
**File**: `src/modules/wallets/services/address-generator.service.ts`

**Changes**:
- Added `encryptionSecret` property from environment
- Added `encryptPrivateKey()` method
- Added `decryptPrivateKey()` method
- Validates encryption secret on initialization
- **TON address generation disabled** - throws error directing users to Telegram Mini App

### 6. Wallet Service
**File**: `src/modules/wallets/wallets.service.ts`

**Changes**:
- Modified `createWallet()` to encrypt and store private keys
- For EVM wallets: reuses encrypted key if address is reused
- For non-EVM wallets (SUI, Solana): generates and encrypts new private key
- Stores encrypted private key in database
- **TON wallet creation blocked** - returns error directing users to Telegram Mini App

### 7. SUI Blockchain Service
**File**: `src/modules/wallets/services/sui-blockchain.service.ts`

**Changes**:
- Added imports: `Transaction`, `Ed25519Keypair`, `fromHex`
- Added `sweepCoins()` method:
  - Creates keypair from private key
  - Queries all coin objects for address
  - Merges multiple coins if needed
  - Transfers to hot wallet
  - Returns digest, amount, gas fee
- Added `getCoinObjects()` helper method

### 8. Solana Blockchain Service (NEW)
**File**: `src/modules/wallets/services/solana-blockchain.service.ts`

**Changes**:
- Added imports: `Keypair`, `Transaction`, `SystemProgram`, `sendAndConfirmTransaction`
- Added SPL token imports: `getAssociatedTokenAddress`, `createTransferInstruction`, `getAccount`
- Added `sweepTokens()` method:
  - Creates keypair from private key
  - Gets Associated Token Addresses for source and destination
  - Reads token balance from source ATA
  - Creates SPL token transfer instruction
  - Signs and sends transaction
  - Returns signature, amount, gas fee in lamports
- Added `getTokenAccount()` helper method

### 9. Deposit Monitor Service
**File**: `src/modules/deposit-monitor/deposit-monitor.service.ts`

**Changes**:
- Added `AddressGeneratorService` and `ConfigService` dependencies
- Modified `confirmDeposit()` to trigger sweep for SUI and Solana deposits
- Added `sweepSuiDeposit()` method:
  - Gets hot wallet address from config
  - Decrypts deposit address private key
  - Creates sweep transaction record
  - Executes sweep via SuiBlockchainService
  - Updates sweep transaction status
  - Creates audit log entry
  - Handles errors gracefully
- Added `sweepSolanaDeposit()` method:
  - Gets Solana hot wallet address from config
  - Decrypts deposit address private key
  - Gets SPL token mint address from config
  - Creates sweep transaction record
  - Executes sweep via SolanaBlockchainService
  - Updates sweep transaction status
  - Converts lamports to SOL for gas fee recording
  - Creates audit log entry
  - Handles errors gracefully

## New Files Created

### 1. Encryption Utility
- `src/common/utils/encryption.util.ts`

### 2. Documentation
- `docs/SUI_SWEEP_IMPLEMENTATION.md` - SUI sweep complete guide
- `docs/SOLANA_SWEEP_IMPLEMENTATION.md` - Solana sweep complete guide
- `docs/TON_TELEGRAM_INTEGRATION.md` - TON Telegram Mini App explanation
- `docs/SWEEP_IMPLEMENTATION_SUMMARY.md` - This file

### 3. Migration Script
- `prisma/migrations/manual_sweep_migration.sql` - Manual SQL migration

## Setup Instructions

### 1. Environment Variables

Add to your `.env` file:

```bash
# SUI Hot Wallet
SUI_HOT_WALLET_ADDRESS=0x<your-hot-wallet-address>
SUI_HOT_WALLET_PRIVATE_KEY=<hex-encoded-private-key>

# Solana Hot Wallet
SOLANA_HOT_WALLET_ADDRESS=<your-solana-hot-wallet-base58-address>
SOLANA_HOT_WALLET_PRIVATE_KEY=<hex-encoded-private-key>

# Encryption (if not already set)
MASTER_KEY_ENCRYPTION_SECRET=<32-character-hex-string>
```

### 2. Generate Encryption Secrets

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run Database Migration

**Option A - Manual Migration** (Recommended if automatic fails):

```bash
# Connect to PostgreSQL
psql -U <user> -d <database>

# Run migration
\i prisma/migrations/manual_sweep_migration.sql
```

**Option B - Automatic Migration**:

```bash
cd 0xmart-backend
npx prisma migrate dev --name add_sweep_functionality
npx prisma generate
```

### 4. Fund Hot Wallet with SUI

The hot wallet needs SUI for gas fees:

```bash
# Testnet faucet
curl --location --request POST 'https://faucet.testnet.sui.io/gas' \
  --header 'Content-Type: application/json' \
  --data-raw '{"FixedAmountRequest":{"recipient":"<hot-wallet-address>"}}'
```

### 5. Restart Backend

```bash
npm run start:dev
```

## How It Works

1. **User Deposits**: User sends USDC to their SUI deposit address
2. **Detection**: DepositMonitorService detects the transaction
3. **Confirmation**: After 1 checkpoint, deposit is confirmed
4. **Balance Credit**: User's wallet balance is updated in database
5. **Sweep Trigger**: `sweepSuiDeposit()` is automatically called
6. **Private Key Decryption**: Deposit address private key is decrypted
7. **Transaction Building**: SUI transaction is built to transfer all coins
8. **Execution**: Transaction is signed and executed on-chain
9. **Recording**: Sweep transaction is recorded in database
10. **Completion**: Funds are now in hot wallet, user balance unchanged

## Security Features

✅ **Encrypted Storage**: All private keys encrypted with AES-256-GCM
✅ **Unique IVs**: Each encryption uses unique initialization vector
✅ **Key Derivation**: PBKDF2 used to derive encryption key
✅ **No API Exposure**: No endpoints expose private keys or sweep functionality
✅ **Audit Logging**: All sweep operations are logged
✅ **Error Handling**: Failed sweeps don't block deposit confirmation

## Testing Checklist

- [ ] Environment variables configured
- [ ] Database migration applied
- [ ] Hot wallet funded with SUI
- [ ] Backend restarted
- [ ] Encryption test passed
- [ ] Wallet creation stores encrypted key
- [ ] Deposit detected and confirmed
- [ ] Sweep transaction triggered
- [ ] Funds transferred to hot wallet
- [ ] Sweep transaction recorded in database

## Monitoring

### Key Metrics to Track

1. **Sweep Success Rate**: `COUNT(status='COMPLETED') / COUNT(*)`
2. **Average Gas Fee**: `AVG(gasFee)`
3. **Failed Sweeps**: `COUNT(status='FAILED')`
4. **Pending Sweeps**: `COUNT(status='PENDING')`

### Database Queries

```sql
-- Recent sweeps
SELECT * FROM sweep_transactions ORDER BY createdAt DESC LIMIT 10;

-- Failed sweeps needing attention
SELECT * FROM sweep_transactions WHERE status = 'FAILED' AND retryCount >= maxRetries;

-- Sweep statistics
SELECT status, COUNT(*), SUM(amount), AVG(gasFee) FROM sweep_transactions GROUP BY status;
```

### Log Monitoring

Watch for these log messages:
- `✅ Sweep successful!` - Sweep completed
- `Sweep transaction failed` - Sweep error
- `Failed to decrypt private key` - Encryption issue
- `SUI hot wallet address not configured` - Config missing

## Known Limitations

1. **Manual Retry**: Failed sweeps currently require manual intervention
2. **Single Network**: Only SUI supported (Solana/TON to be added)
3. **No Batching**: Each deposit sweeps individually
4. **Fixed Gas Budget**: Uses 0.01 SUI fixed gas budget
5. **No Admin UI**: No dashboard to view/manage sweeps

## Future Enhancements

- [ ] Automatic retry with exponential backoff
- [ ] Batch sweep multiple deposits
- [ ] Dynamic gas estimation
- [ ] Admin dashboard for sweep management
- [ ] Manual sweep endpoint for admins
- [ ] Extend to Solana and TON
- [ ] Webhook notifications on sweep completion
- [ ] Gas optimization strategies

## Rollback Instructions

If you need to rollback this feature:

1. **Remove sweep trigger**:
   ```typescript
   // In deposit-monitor.service.ts confirmDeposit() method
   // Comment out: await this.sweepSuiDeposit(deposit);
   ```

2. **Keep database changes**: The new fields/tables don't affect existing functionality

3. **Restart backend**: Changes take effect immediately

## Support

For issues or questions:
1. Check logs in `0xmart-backend` console
2. Query `sweep_transactions` table for status
3. Verify environment variables are set
4. Ensure hot wallet has sufficient SUI
5. Review `docs/SUI_SWEEP_IMPLEMENTATION.md` for detailed troubleshooting

## Implementation Completed

All components are implemented and ready for testing. Follow the setup instructions above to activate the sweep functionality.
