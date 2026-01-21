# Solana Automatic Sweep Implementation

## Overview

This document describes the automatic sweep mechanism for Solana SPL token deposits. When users send USDC or other SPL tokens to their Solana deposit addresses, the system automatically transfers (sweeps) those funds to a centralized hot wallet after deposit confirmation.

## Architecture

### Flow Diagram

```
User sends USDC to deposit address (SPL token)
         ↓
System detects deposit (DepositMonitorService)
         ↓
Deposit confirms after 32 confirmations (~13 seconds)
         ↓
System credits user's wallet balance
         ↓
Sweep transaction triggered automatically
         ↓
Funds transferred from deposit address to hot wallet
         ↓
Sweep transaction recorded in database
```

## Key Differences from SUI

### Solana SPL Token Model
- **Token Accounts**: SPL tokens are held in Associated Token Accounts (ATAs)
- **Account Creation**: Destination ATA must exist before transfer
- **Gas Token**: SOL is used for transaction fees (similar to ETH on Ethereum)
- **Fast Finality**: ~400ms with 32 confirmations for finality

### Transaction Structure
```typescript
1. Get source ATA (user's deposit address token account)
2. Get destination ATA (hot wallet token account)
3. Create transfer instruction with full balance
4. Sign with deposit address keypair
5. Send and confirm transaction
6. Return signature and fees
```

## Implementation Details

### 1. Solana Blockchain Service

**Location**: `src/modules/wallets/services/solana-blockchain.service.ts`

**New Method**: `sweepTokens(privateKey, hotWalletAddress, tokenMintAddress)`

**Features**:
- Creates Ed25519 keypair from private key (same as SUI)
- Gets Associated Token Addresses for source and destination
- Reads current token balance from source account
- Creates SPL token transfer instruction
- Signs and sends transaction with confirmation
- Returns signature, amount, and gas fee in lamports

**Dependencies**:
```typescript
import {
  Keypair, Transaction, SystemProgram,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
```

### 2. Deposit Monitor Integration

**Location**: `src/modules/deposit-monitor/deposit-monitor.service.ts`

**New Method**: `sweepSolanaDeposit(deposit)`

**Process**:
1. Get Solana hot wallet address from config
2. Decrypt deposit address private key
3. Get SPL token mint address from token config
4. Create pending sweep transaction record
5. Execute sweep via `SolanaBlockchainService.sweepTokens()`
6. Update sweep transaction as completed/failed
7. Convert lamports to SOL for gas fee recording
8. Create audit log entry

**Error Handling**:
- Logs all errors with context
- Updates sweep transaction status as FAILED
- Increments retry count
- Does not block deposit confirmation if sweep fails

### 3. Token Configuration

**Solana SPL Token Mint Addresses** (in `deposit-monitor.service.ts`):

```typescript
SOLANA: {
  USDT: {
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
  },
  USDC: {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
  },
  DAI: {
    address: 'EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCWNWqxWV4J6o',
    decimals: 8,
  },
  BUSD: {
    address: 'AJ1W9A9N9dEMdVyoDiam2rV44gnBm2csrPDP7xqcapgX',
    decimals: 8,
  },
}
```

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Solana Hot Wallet (for automatic sweep of deposits)
# CRITICAL: Store securely in production (AWS Secrets Manager, HashiCorp Vault)
SOLANA_HOT_WALLET_ADDRESS=<your-solana-hot-wallet-base58-address>
SOLANA_HOT_WALLET_PRIVATE_KEY=<hex-encoded-private-key>

# Master Key Encryption (if not already set)
MASTER_KEY_ENCRYPTION_SECRET=<32-character-hex-string>
```

### Configuration Service

**Location**: `config/configuration.ts`

```typescript
blockchain: {
  // ... other networks ...
  solana: process.env.SOLANA_RPC_URL,
  solanaHotWallet: process.env.SOLANA_HOT_WALLET_ADDRESS,
  solanaHotWalletPrivateKey: process.env.SOLANA_HOT_WALLET_PRIVATE_KEY,
}
```

## Setup Instructions

### 1. Generate Solana Hot Wallet

```bash
# Using Solana CLI (recommended)
solana-keygen new --outfile ~/solana-hot-wallet.json

# Get the public address
solana-keygen pubkey ~/solana-hot-wallet.json

# Get the private key (first 32 bytes in base58, convert to hex for storage)
# The JSON file contains the byte array of the keypair
```

**Or generate programmatically**:
```typescript
import { Keypair } from '@solana/web3.js';

const keypair = Keypair.generate();
console.log('Public Key:', keypair.publicKey.toString());
console.log('Private Key (hex):', Buffer.from(keypair.secretKey).toString('hex'));
```

### 2. Fund Hot Wallet with SOL

The hot wallet needs SOL for transaction fees:

```bash
# Devnet faucet
solana airdrop 2 <hot-wallet-address> --url https://api.devnet.solana.com

# Mainnet: Transfer SOL manually
solana transfer <hot-wallet-address> 1 --from ~/your-wallet.json
```

### 3. Create Associated Token Accounts

**IMPORTANT**: The hot wallet must have ATAs for each SPL token:

```bash
# Using Solana CLI
spl-token create-account <token-mint-address>

# For USDC on devnet
spl-token create-account EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Or the system will create it automatically on first transfer (costs more gas)
```

### 4. Set Environment Variables

```bash
# Add to .env
SOLANA_HOT_WALLET_ADDRESS=<your-public-key>
SOLANA_HOT_WALLET_PRIVATE_KEY=<hex-encoded-secret-key>
MASTER_KEY_ENCRYPTION_SECRET=<32-char-secret>
```

### 5. Restart Backend

```bash
npm run start:dev
```

## Testing

### 1. Test Wallet Creation

```bash
# Create a Solana wallet via API
curl -X POST http://localhost:8000/api/v1/wallets \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "stablecoinType": "USDC",
    "network": "SOLANA"
  }'

# Verify encrypted private key is stored
# Check database: SELECT id, depositAddress, encryptedPrivateKey FROM wallets WHERE network = 'SOLANA';
```

### 2. Test Deposit and Sweep

**Step 1**: Get a test wallet address
```sql
SELECT depositAddress FROM wallets
WHERE network = 'SOLANA' AND stablecoinType = 'USDC'
LIMIT 1;
```

**Step 2**: Send test USDC to the deposit address
```bash
# Using Solana CLI
spl-token transfer <usdc-mint> 1 <deposit-address> --fund-recipient

# Or use a Solana wallet UI (Phantom, Solflare, etc.)
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
# - "New Solana deposit detected"
# - "Confirming deposit"
# - "Initiating Solana sweep"
# - "✅ Sweep successful!"
```

**Step 5**: Verify sweep transaction
```bash
# Check database
SELECT * FROM sweep_transactions
WHERE status = 'COMPLETED' AND network = 'SOLANA'
ORDER BY createdAt DESC LIMIT 1;

# Check hot wallet balance on Solana explorer
https://explorer.solana.com/address/<hot-wallet-address>?cluster=devnet
```

## Monitoring

### Database Queries

**Check Solana sweeps**:
```sql
SELECT * FROM sweep_transactions
WHERE network = 'SOLANA'
ORDER BY createdAt DESC;
```

**Failed Solana sweeps**:
```sql
SELECT * FROM sweep_transactions
WHERE network = 'SOLANA' AND status = 'FAILED'
ORDER BY createdAt DESC;
```

**Solana sweep statistics**:
```sql
SELECT
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(gasFee) as avg_gas_fee_sol
FROM sweep_transactions
WHERE network = 'SOLANA'
GROUP BY status;
```

### Key Metrics

1. **Success Rate**: Should be >99%
2. **Average Gas Fee**: ~0.000005 SOL (5000 lamports)
3. **Processing Time**: <5 seconds after confirmation
4. **Failed Sweeps**: Should be <1%

### Alerts to Set Up

1. **Failed sweeps**: Alert if `retryCount >= maxRetries` AND `network = 'SOLANA'`
2. **Hot wallet SOL balance**: Alert if balance < 0.01 SOL
3. **Missing ATAs**: Alert if sweep fails with "Token account does not exist"
4. **High gas fees**: Alert if `gasFee > 0.001 SOL` (unusual)

## Troubleshooting

### Issue: "Token account does not exist"

**Cause**: Hot wallet doesn't have an Associated Token Account for this SPL token

**Solution**:
```bash
# Create the ATA for the token
spl-token create-account <token-mint-address> --owner <hot-wallet-address>

# Or send a small amount to hot wallet first (creates ATA automatically)
spl-token transfer <token-mint> 0.000001 <hot-wallet-address> --fund-recipient
```

### Issue: "Insufficient SOL for gas"

**Cause**: Hot wallet doesn't have enough SOL for transaction fees

**Solution**:
```bash
# Check balance
solana balance <hot-wallet-address>

# Add more SOL
solana transfer <hot-wallet-address> 0.1
```

### Issue: Sweep fails with "Invalid private key format"

**Cause**: Private key encoding issue or encryption secret changed

**Solution**:
1. Verify `MASTER_KEY_ENCRYPTION_SECRET` hasn't changed
2. Check private key is hex-encoded (not base58)
3. Test decryption manually
4. Regenerate wallet if needed (will create new deposit address)

### Issue: Transaction timeout

**Cause**: Solana network congestion or RPC issues

**Solution**:
1. Check Solana network status: https://status.solana.com
2. Increase transaction timeout in code
3. Retry failed sweep transactions
4. Use a premium RPC endpoint (QuickNode, Helius, Alchemy)

## Differences from SUI Sweep

| Feature | SUI | Solana |
|---------|-----|--------|
| **Address Format** | 0x... (hex, 64 chars) | Base58 (32-44 chars) |
| **Coin Model** | Coin objects | Associated Token Accounts |
| **Gas Token** | SUI | SOL |
| **Finality** | 1 checkpoint (~400ms) | 32 confirmations (~13s) |
| **Transaction** | Merge + Transfer | Single transfer |
| **Account Creation** | Automatic | Manual (or auto with extra fee) |
| **Average Gas** | 0.001-0.01 SUI | 0.000005 SOL |
| **SDK** | @mysten/sui | @solana/web3.js + @solana/spl-token |

## Security Considerations

### Private Key Storage

✅ **Encrypted at rest**: Same AES-256-GCM encryption as SUI
✅ **Unique IV**: Each encryption uses unique initialization vector
✅ **Key derivation**: PBKDF2 used to derive encryption key
⚠️ **Master secret**: Must be stored in AWS Secrets Manager in production
⚠️ **Hot wallet**: Should use multi-sig for large amounts

### Access Control

- Only `DepositMonitorService` can trigger sweeps
- No API endpoint exposes sweep functionality
- Private keys never returned in API responses
- Audit logs track all sweep operations

### Gas Management

- Hot wallet must maintain minimum 0.01 SOL balance
- Sweep transactions use ~5000 lamports (0.000005 SOL)
- Failed sweeps due to insufficient gas are logged
- ATAs can be pre-created to reduce gas costs

## Future Enhancements

1. **Automatic ATA creation**: Check and create ATAs before sweep
2. **Batch sweeping**: Combine multiple deposits in one transaction
3. **Priority fees**: Add priority fees during network congestion
4. **Versioned transactions**: Use v0 transactions for better efficiency
5. **Lookup tables**: Use address lookup tables to reduce transaction size
6. **Compute units**: Optimize compute unit usage for lower fees

## References

- [Solana Transaction Guide](https://docs.solana.com/developing/programming-model/transactions)
- [SPL Token Program](https://spl.solana.com/token)
- [Associated Token Accounts](https://spl.solana.com/associated-token-account)
- [Keypair Generation](https://docs.solana.com/cli/wallets/paper)
