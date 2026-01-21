# Sweeping Existing Balances

## Problem

You may have **existing balances** in SUI and Solana deposit addresses that were deposited **BEFORE** the automatic sweep mechanism was implemented. These funds are:

- ✅ Credited to user's database balance
- ✅ Showing in user's wallet on frontend
- ❌ Still sitting in individual deposit addresses
- ❌ Not swept to hot wallet

## Solution

Use the **sweep-existing-balances** script to migrate all existing on-chain balances to the hot wallet.

## How It Works

The script:
1. Queries all SUI/Solana wallets with encrypted private keys
2. Checks on-chain balance for each deposit address
3. If balance > 0, executes sweep transaction
4. Records sweep in `sweep_transactions` table
5. Provides summary of results

## Usage

### Dry Run (Recommended First)

Test without executing any transactions:

```bash
# Check SUI wallets
npm run sweep-existing -- --network=SUI --dry-run

# Check Solana wallets
npm run sweep-existing -- --network=SOLANA --dry-run

# Check all networks
npm run sweep-existing -- --network=ALL --dry-run
```

**Output Example**:
```
🧹 Existing Balance Sweep Script
================================
Network: SUI
Mode: DRY RUN

⚠️  DRY RUN MODE - No transactions will be executed

📍 Processing SUI wallets...

📋 Fetching SUI wallets...
Found 5 SUI wallets with private keys stored

  Wallet: 0xabc123...
  User: user@example.com
  Token: USDC
  💰 Balance: 100.5 USDC
  ✅ Would sweep 100.5 USDC (DRY RUN)

📊 Sweep Summary
================
Total wallets checked: 5
  ✅ Successful sweeps: 3
  💤 Zero balance: 2
  ❌ Failed: 0

💰 Total amount to sweep: 250.75 USDC

✨ Done!
```

### Live Execution

Execute actual sweep transactions:

```bash
# Sweep SUI wallets
npm run sweep-existing -- --network=SUI

# Sweep Solana wallets
npm run sweep-existing -- --network=SOLANA

# Sweep all networks
npm run sweep-existing -- --network=ALL
```

**⚠️ WARNING**: This executes real blockchain transactions and costs gas!

## Prerequisites

Before running the script:

### 1. Environment Variables Must Be Set

```bash
# SUI
SUI_HOT_WALLET_ADDRESS=0x...
SUI_HOT_WALLET_PRIVATE_KEY=...

# Solana
SOLANA_HOT_WALLET_ADDRESS=...
SOLANA_HOT_WALLET_PRIVATE_KEY=...

# Encryption
MASTER_KEY_ENCRYPTION_SECRET=...
```

### 2. Hot Wallets Must Have Gas

- **SUI**: Hot wallet needs SUI for gas (~0.01 SUI per sweep)
- **Solana**: Hot wallet needs SOL for gas (~0.000005 SOL per sweep)

Check balances before running:

```bash
# SUI
sui client gas --address <hot-wallet-address>

# Solana
solana balance <hot-wallet-address>
```

### 3. Solana: ATAs Must Exist

For Solana, the hot wallet must have Associated Token Accounts (ATAs) for each SPL token:

```bash
# Create ATA for USDC
spl-token create-account EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Create ATA for USDT
spl-token create-account Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
```

## Step-by-Step Guide

### Step 1: Run Dry Run

```bash
npm run sweep-existing -- --network=ALL --dry-run
```

Review the output:
- How many wallets have balances?
- What's the total amount to sweep?
- Are there any errors?

### Step 2: Verify Prerequisites

- ✅ Hot wallet addresses configured
- ✅ Hot wallets funded with gas
- ✅ Solana ATAs created
- ✅ Backend can connect to RPC nodes

### Step 3: Execute Sweep (Small Batch First)

Test with a single network first:

```bash
npm run sweep-existing -- --network=SUI
```

Monitor the output and check:
- Transactions succeed on blockchain explorer
- sweep_transactions table updated
- Hot wallet receives funds

### Step 4: Execute Full Sweep

Once confident, sweep all networks:

```bash
npm run sweep-existing -- --network=ALL
```

### Step 5: Verify Results

Check hot wallet balances increased:

```bash
# SUI Explorer
https://testnet.suivision.xyz/account/<hot-wallet-address>

# Solana Explorer
https://explorer.solana.com/address/<hot-wallet-address>?cluster=devnet
```

Check sweep transactions in database:

```sql
SELECT
  network,
  stablecoinType,
  COUNT(*) as sweeps,
  SUM(amount) as total_amount,
  SUM(gasFee) as total_gas
FROM sweep_transactions
WHERE createdAt > NOW() - INTERVAL '1 hour'
  AND status = 'COMPLETED'
GROUP BY network, stablecoinType;
```

## What Gets Swept

### Included
- ✅ Wallets with `encryptedPrivateKey` stored
- ✅ On-chain balance > 0
- ✅ SUI: USDT, USDC
- ✅ Solana: USDT, USDC

### Excluded
- ❌ Wallets without encrypted private keys (old wallets before feature)
- ❌ Zero balance wallets
- ❌ TON wallets (disabled)
- ❌ EVM wallets (no sweep needed, address reuse)

## Script Behavior

### Rate Limiting

The script waits **2 seconds** between each sweep to avoid:
- RPC rate limits
- Network congestion
- Transaction failures

### Error Handling

If a sweep fails:
- Script continues to next wallet
- Error logged to console
- Failed sweep shown in summary
- No database record created for failed sweep

### Transaction Recording

Successful sweeps create a record in `sweep_transactions`:

```sql
INSERT INTO sweep_transactions (
  walletId,
  fromAddress,
  toAddress,
  amount,
  stablecoinType,
  network,
  txHash,
  gasUsed,
  gasFee,
  status,
  completedAt
) VALUES (...);
```

## Troubleshooting

### "SUI hot wallet not configured"

**Solution**: Set `SUI_HOT_WALLET_ADDRESS` in `.env`

### "Solana service not configured"

**Solution**: Set `SOLANA_RPC_URL` in `.env`

### "Error checking balance: Invalid address"

**Cause**: Wallet has invalid deposit address

**Solution**: Skip this wallet or investigate why address is invalid

### "Token account does not exist" (Solana)

**Cause**: Hot wallet doesn't have ATA for this token

**Solution**:
```bash
spl-token create-account <token-mint-address>
```

### "Insufficient funds for gas"

**Cause**: Hot wallet doesn't have enough SUI/SOL

**Solution**: Fund hot wallet with more gas tokens

### "Sweep failed: Transaction timeout"

**Cause**: Network congestion or RPC issues

**Solution**:
- Wait and retry
- Use premium RPC endpoint
- Increase timeout in code

## Cost Estimation

### Gas Costs

**SUI**:
- Average: 0.001-0.01 SUI per sweep
- 100 sweeps ≈ 0.1-1 SUI (~$0.10-$1)

**Solana**:
- Average: 0.000005 SOL per sweep
- 100 sweeps ≈ 0.0005 SOL (~$0.05)

### Time Estimation

With 2-second delay between sweeps:
- 10 wallets ≈ 20 seconds
- 50 wallets ≈ 100 seconds (~2 minutes)
- 100 wallets ≈ 200 seconds (~3.5 minutes)

## Safety Features

### Dry Run Mode
- Shows what would be swept
- No transactions executed
- No gas spent
- Safe to run anytime

### Wallet Validation
- Only sweeps wallets with encrypted keys
- Verifies on-chain balance before sweep
- Skips zero-balance wallets automatically

### Transaction Logging
- All successful sweeps recorded in database
- Transaction hashes stored for verification
- Gas fees tracked

## After Sweeping

### Monitor Hot Wallet

Set up monitoring for hot wallet balances:

```sql
-- Check hot wallet should have swept funds
SELECT
  network,
  SUM(amount) as total_swept
FROM sweep_transactions
WHERE status = 'COMPLETED'
GROUP BY network;
```

### Verify User Balances

User balances in database should match hot wallet:

```sql
-- Total user balances
SELECT
  network,
  stablecoinType,
  SUM(balance) as total_user_balance
FROM wallets
WHERE network IN ('SUI', 'SOLANA')
GROUP BY network, stablecoinType;
```

### Clean Up (Optional)

Old wallets without encrypted keys can be marked:

```sql
-- Find wallets that can't be swept (no private key)
SELECT
  id,
  network,
  depositAddress,
  balance
FROM wallets
WHERE network IN ('SUI', 'SOLANA')
  AND encryptedPrivateKey IS NULL
  AND balance > 0;
```

These wallets need manual investigation - why don't they have encrypted keys?

## Best Practices

### 1. Test First
Always run `--dry-run` before live execution

### 2. Start Small
Test with single network before doing --network=ALL

### 3. Monitor Progress
Watch console output during execution

### 4. Verify Results
Check blockchain explorers and database after completion

### 5. Document
Keep record of:
- When sweep was run
- How many wallets swept
- Total amount swept
- Any issues encountered

## Scheduling (Optional)

For ongoing maintenance, you could schedule periodic sweeps:

```bash
# Linux cron (weekly sweep)
0 2 * * 0 cd /path/to/backend && npm run sweep-existing -- --network=ALL >> /var/log/sweep.log 2>&1
```

However, with automatic sweep enabled for new deposits, this should rarely be needed.

## Support

If you encounter issues:

1. Run with `--dry-run` to diagnose
2. Check hot wallet gas balances
3. Verify environment variables
4. Review console output for specific errors
5. Check blockchain explorers for failed transactions
6. Query `sweep_transactions` table for history

## Example Workflow

```bash
# 1. Check what needs sweeping (no execution)
npm run sweep-existing -- --network=ALL --dry-run

# Output shows: "💰 Total amount to sweep: 1,234.56 USDC"

# 2. Fund hot wallets with enough gas
# SUI: 1 SUI should be enough
# Solana: 0.01 SOL should be enough

# 3. Execute SUI sweep first
npm run sweep-existing -- --network=SUI

# Monitor output...
# ✅ Swept! TX: 0xabc123...

# 4. Verify on SUI explorer
# Check: https://testnet.suivision.xyz/txblock/0xabc123...

# 5. Execute Solana sweep
npm run sweep-existing -- --network=SOLANA

# 6. Check summary
# Total wallets checked: 47
# ✅ Successful sweeps: 45
# 💤 Zero balance: 2
# 💰 Total amount swept: 1,234.56

# 7. Verify hot wallet balance increased
```

## Complete!

After running this script, all existing on-chain balances will be swept to the hot wallet. Future deposits will be automatically swept by the deposit monitor service.
