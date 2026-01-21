# Quick Start: Sweep Existing Balances

## What This Does

Sweeps **existing on-chain balances** from SUI and Solana deposit addresses to your hot wallet. This is for balances deposited **BEFORE** the automatic sweep feature was implemented.

## Quick Commands

### 1. Test First (No Transactions)

```bash
# Check what would be swept (safe, no gas cost)
npm run sweep-existing -- --network=ALL --dry-run
```

### 2. Execute Sweep

```bash
# Sweep SUI wallets
npm run sweep-existing -- --network=SUI

# Sweep Solana wallets
npm run sweep-existing -- --network=SOLANA

# Sweep all networks at once
npm run sweep-existing -- --network=ALL
```

## Before Running

Checklist:
- [ ] Hot wallet addresses in `.env`
- [ ] Hot wallets funded with gas (SUI: 0.1 SUI, Solana: 0.01 SOL)
- [ ] Solana ATAs created for USDC/USDT
- [ ] Database migration applied
- [ ] Encryption secret configured

## Expected Output

```
🧹 Existing Balance Sweep Script
================================

📍 Processing SUI wallets...
Found 10 SUI wallets

  Wallet: 0xabc...
  User: user@example.com
  💰 Balance: 100.5 USDC
  ✅ Swept! TX: 0xdef...

📊 Sweep Summary
================
Total wallets checked: 10
  ✅ Successful sweeps: 8
  💤 Zero balance: 2
  ❌ Failed: 0

💰 Total amount swept: 1,234.56 USDC

✨ Done!
```

## Verify Results

**Check hot wallet balance:**
- SUI: https://testnet.suivision.xyz/account/YOUR_HOT_WALLET
- Solana: https://explorer.solana.com/address/YOUR_HOT_WALLET?cluster=devnet

**Check database:**
```sql
SELECT * FROM sweep_transactions
WHERE createdAt > NOW() - INTERVAL '1 hour'
ORDER BY createdAt DESC;
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Hot wallet not configured" | Add `SUI_HOT_WALLET_ADDRESS` to `.env` |
| "Insufficient gas" | Fund hot wallet with more SUI/SOL |
| "Token account does not exist" | Create Solana ATA: `spl-token create-account <mint>` |

## After Sweeping

✅ All existing balances moved to hot wallet
✅ Future deposits automatically swept
✅ No action needed going forward

## Full Documentation

For detailed guide, see: `docs/SWEEP_EXISTING_BALANCES.md`
