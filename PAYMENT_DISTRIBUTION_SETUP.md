# Payment Distribution System - Setup Guide

**Date:** March 17, 2026
**Status:** ✅ **IMPLEMENTED**
**Purpose:** Automatically distribute order payments to merchants and platform owner

---

## Overview

The payment distribution system automatically transfers funds from completed orders to:
1. **Merchants** - Receive 80% of order total (base price)
2. **Platform Owner** - Receives 20% platform fee

### How It Works

```
User places order for $100 USDT
    ↓
User's wallet: -$100 USDT (deducted)
    ↓
Payment Distribution Service:
    ├─→ Merchant: +$80 USDT (transferred to merchant wallet)
    └─→ Platform Owner: +$20 USDT (transferred to your wallet)
```

---

## Prerequisites

Before deploying to production, you need:

1. **Master Wallet** - A wallet with private key for sending transactions
2. **Platform Owner Wallets** - One wallet address per blockchain network
3. **Gas Funds** - ETH/MATIC/BNB etc. in master wallet for gas fees
4. **Merchant Configuration** - Each merchant must set payout wallet address

---

## Step 1: Create Master Wallet

The master wallet is used to send payments to merchants and platform owner.

### Option A: Create New Wallet (Recommended)

```bash
# Using ethers.js
node -e "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Address:', wallet.address); console.log('Private Key:', wallet.privateKey); console.log('Mnemonic:', wallet.mnemonic.phrase);"
```

**Output:**
```
Address: 0x1234567890123456789012345678901234567890
Private Key: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
Mnemonic: word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12
```

**CRITICAL: Save these securely!**
- Store private key in password manager
- Write down mnemonic on paper (offline backup)
- NEVER commit to git
- NEVER share with anyone

### Option B: Use Existing Wallet

If you already have a wallet, export the private key from MetaMask:
1. Open MetaMask
2. Click account menu → Account Details
3. Click "Export Private Key"
4. Enter password
5. Copy private key (starts with 0x)

**Security Note:** Using an existing wallet is convenient but less secure. Consider creating a dedicated wallet for the platform.

---

## Step 2: Fund Master Wallet with Gas

The master wallet needs native tokens for gas fees on each network:

| Network | Native Token | Minimum Balance | Purpose |
|---------|--------------|-----------------|---------|
| Ethereum | ETH | 0.1 ETH (~$300) | Gas for USDT/USDC/DAI transfers |
| Polygon | MATIC | 10 MATIC (~$10) | Gas for USDT/USDC/DAI transfers |
| BSC | BNB | 0.1 BNB (~$50) | Gas for USDT/USDC/DAI transfers |
| Arbitrum | ETH | 0.05 ETH (~$150) | Gas for USDT/USDC/DAI transfers |
| Optimism | ETH | 0.05 ETH (~$150) | Gas for USDT/USDC/DAI transfers |
| Avalanche | AVAX | 1 AVAX (~$35) | Gas for USDT/USDC/DAI transfers |
| Base | ETH | 0.05 ETH (~$150) | Gas for USDT/USDC/DAI transfers |

**How to fund:**
1. Copy master wallet address
2. Send native tokens from your exchange/wallet
3. Verify balance on blockchain explorer (etherscan.io, polygonscan.com, etc.)

**Estimated Monthly Gas Costs:**
- 100 orders/month: ~$50-100 total gas fees across all networks
- 1,000 orders/month: ~$500-1,000 total gas fees
- 10,000 orders/month: ~$5,000-10,000 total gas fees

**Gas Monitoring:**
Set up alerts to refill master wallet when balance drops below threshold.

---

## Step 3: Configure Platform Owner Wallets

Create or designate one wallet address per network where YOU will receive platform fees.

### Recommended: Use Same Address Across All EVM Networks

For simplicity, you can use the same wallet address on all EVM-compatible chains (Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Base):

```bash
# Your platform owner address (same for all EVM networks)
YOUR_WALLET_ADDRESS=0xYourAddressHere...
```

**Advantages:**
- Single wallet to manage
- Easier accounting
- Can view all earnings in one MetaMask account

### Alternative: Separate Wallets Per Network

For advanced setups, you might want separate wallets per network for accounting purposes:

```bash
PLATFORM_OWNER_WALLET_ETHEREUM=0xEthereumWalletAddress...
PLATFORM_OWNER_WALLET_POLYGON=0xPolygonWalletAddress...
PLATFORM_OWNER_WALLET_BSC=0xBSCWalletAddress...
# etc.
```

---

## Step 4: Update Environment Variables

Add the following to your `.env` file:

```bash
# Master Wallet Private Key (for sending transactions)
MASTER_WALLET_PRIVATE_KEY=0xYourPrivateKeyHere...

# Platform Owner Wallets (for receiving fees)
PLATFORM_OWNER_WALLET_ETHEREUM=0xYourWalletAddress...
PLATFORM_OWNER_WALLET_POLYGON=0xYourWalletAddress...
PLATFORM_OWNER_WALLET_BSC=0xYourWalletAddress...
PLATFORM_OWNER_WALLET_ARBITRUM=0xYourWalletAddress...
PLATFORM_OWNER_WALLET_OPTIMISM=0xYourWalletAddress...
PLATFORM_OWNER_WALLET_AVALANCHE=0xYourWalletAddress...
PLATFORM_OWNER_WALLET_BASE=0xYourWalletAddress...
PLATFORM_OWNER_WALLET_SUI=0xYourWalletAddress...
PLATFORM_OWNER_WALLET_TON=0xYourWalletAddress...
PLATFORM_OWNER_WALLET_SOLANA=0xYourWalletAddress...
```

### For Production (Vercel/Railway/Render)

1. **Never commit .env to git**
2. Set environment variables in deployment platform:
   - Vercel: Settings → Environment Variables
   - Railway: Variables tab
   - Render: Environment tab
3. Use secrets manager for sensitive values:
   - AWS Secrets Manager
   - HashiCorp Vault
   - Google Cloud Secret Manager

---

## Step 5: Configure Merchant Payout Wallets

Each merchant must configure their payout wallet address and network in the merchant portal.

### Merchant Setup Flow

1. Merchant logs into merchant portal: `merchant.0xmart.com`
2. Navigate to **Settings** → **Payout Settings**
3. Enter payout wallet address
4. Select preferred network (e.g., Polygon for low fees)
5. Save configuration

### Database Fields

Merchant payout configuration is stored in the `sellers` table:

```prisma
model Seller {
  // ...
  payoutWalletAddress   String?        // Merchant's wallet address
  payoutNetwork         NetworkType?   // Preferred network for payouts
  // ...
}
```

### Validation

The system will reject orders if merchant hasn't configured payout wallet:

```
Error: Merchant "ABC Company" has not configured payout wallet.
Please configure in merchant settings.
```

---

## Step 6: Test on Testnet

Before going live, test the payment flow on testnet:

### 1. Configure Testnet RPC URLs

```bash
# Use testnet RPCs in .env
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
```

### 2. Get Testnet Tokens

- **Sepolia ETH:** https://sepoliafaucet.com
- **Amoy MATIC:** https://faucet.polygon.technology
- **BSC Testnet BNB:** https://testnet.binance.org/faucet-smart

### 3. Get Testnet Stablecoins

Use the faucets or deploy test ERC20 tokens with mint function.

### 4. Create Test Order

1. Create test user account
2. Fund wallet with testnet stablecoins
3. Create test product
4. Place order
5. Monitor logs for payment distribution

### 5. Verify Transactions

Check blockchain explorer:
- **Merchant received:** 80% of order total
- **Platform owner received:** 20% of order total
- **Transaction hashes recorded** in database

---

## Step 7: Monitoring & Alerts

### Database Monitoring

Query failed payouts:

```sql
SELECT * FROM seller_payouts
WHERE status = 'FAILED'
ORDER BY created_at DESC;
```

### Log Monitoring

Watch for payment distribution errors:

```bash
# Backend logs
grep "Failed to distribute payment" logs/backend.log

# Or in Vercel
vercel logs --filter="Failed to distribute payment"
```

### Recommended Alerts

Set up alerts for:
1. **Failed payment distributions** - Immediate action required
2. **Low gas balance in master wallet** - Refill needed
3. **Unusually high gas fees** - Investigate network congestion
4. **Merchant payout pending > 1 hour** - Check transaction status

### Metrics Dashboard

Track these KPIs:
- Total revenue (all orders)
- Platform fees collected
- Merchant payouts sent
- Failed distribution rate
- Average gas cost per transaction

---

## Architecture Details

### Payment Distribution Flow

```typescript
// 1. User places order
OrdersService.create() → Order created with CONFIRMED status

// 2. Payment distribution triggered
PaymentDistributionService.distributeOrderPayment()
  ├─→ Calculate splits (20% platform, 80% merchant)
  ├─→ Get merchant payout configuration
  ├─→ BlockchainService.transfer() to merchant
  ├─→ BlockchainService.transfer() to platform owner
  └─→ Record in SellerPayout table

// 3. Update order metadata
Order.metadata = {
  merchantTxHash: "0xabc...",
  platformTxHash: "0xdef...",
  sellerPayoutId: "uuid",
  distributedAt: "2026-03-17T10:30:00Z"
}
```

### Error Handling

Payment distribution is **asynchronous** and **non-blocking**:

```typescript
// If distribution fails, order is still confirmed
// but payment is marked as failed for manual retry

try {
  await distributeOrderPayment(order);
} catch (error) {
  logger.error('Failed to distribute payment', error);
  // SellerPayout record created with FAILED status
  // Admin can manually retry from admin panel
}
```

### Retry Logic

Failed distributions can be retried:

```typescript
// Admin endpoint
POST /api/v1/orders/:orderId/retry-distribution

// Or via service
await paymentDistributionService.retryFailedDistribution(orderId);
```

---

## Security Best Practices

### 1. Private Key Management

❌ **NEVER:**
- Commit private keys to git
- Store private keys in plaintext
- Share private keys via email/Slack
- Use personal wallet as master wallet

✅ **ALWAYS:**
- Use secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Rotate keys periodically (every 6 months)
- Use different keys for dev/staging/production
- Enable MFA on accounts that can access secrets

### 2. Master Wallet Security

**Recommendations:**
- Use a **dedicated hardware wallet** (Ledger/Trezor) for production
- Implement **multi-signature** for large transfers
- Set up **spending limits** using smart contracts
- Enable **transaction monitoring** and anomaly detection

### 3. Network Security

- Use **private RPC endpoints** (not public)
- Implement **rate limiting** on blockchain calls
- Use **paid providers** (Alchemy, Infura, QuickNode)
- Set up **fallback RPCs** for redundancy

### 4. Audit Trail

- Log all payment distributions
- Store transaction hashes
- Implement webhook notifications
- Regular financial reconciliation

---

## Troubleshooting

### Issue: "MASTER_WALLET_PRIVATE_KEY not configured"

**Cause:** Environment variable not set

**Fix:**
```bash
# Add to .env
MASTER_WALLET_PRIVATE_KEY=0xYourPrivateKeyHere...
```

### Issue: "Platform owner wallet not configured for network: POLYGON"

**Cause:** Platform owner wallet address missing for specific network

**Fix:**
```bash
# Add to .env
PLATFORM_OWNER_WALLET_POLYGON=0xYourWalletAddress...
```

### Issue: "Merchant has not configured payout wallet"

**Cause:** Merchant hasn't set up payout settings

**Fix:**
1. Contact merchant
2. Guide them to merchant portal → Settings → Payout Settings
3. They need to enter wallet address and select network

### Issue: "Transaction failed" or "Insufficient gas"

**Cause:** Master wallet has insufficient gas balance

**Fix:**
1. Check master wallet balance on blockchain explorer
2. Send ETH/MATIC/BNB to master wallet
3. Retry failed distribution

### Issue: "Token address not configured for USDT on BSC"

**Cause:** Token address missing in BlockchainService

**Fix:**
Token addresses are hardcoded in `blockchain.service.ts`. Update the `getTokenAddress()` method with correct mainnet addresses.

---

## Migration Guide for Existing Orders

If you already have orders in the database from before implementing payment distribution:

### 1. Calculate Owed Amounts

```sql
-- Query all confirmed orders without payment distribution
SELECT
  o.id,
  o.order_number,
  o.total,
  o.stablecoin_type,
  o.network,
  p.seller_id,
  s.company_name,
  s.payout_wallet_address
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
JOIN sellers s ON s.id = p.seller_id
WHERE o.status = 'CONFIRMED'
  AND o.platform_fee = 0  -- No platform fee recorded
  AND o.created_at < '2026-03-17'  -- Before payment distribution implemented
ORDER BY o.created_at DESC;
```

### 2. Manual Payment Script

Create a script to process backlog:

```typescript
// scripts/migrate-existing-orders.ts
import { PrismaClient } from '@prisma/client';
import { PaymentDistributionService } from '../src/modules/orders/services/payment-distribution.service';

const prisma = new PrismaClient();
const paymentDistributionService = new PaymentDistributionService(/* inject dependencies */);

async function migrateExistingOrders() {
  const orders = await prisma.order.findMany({
    where: {
      status: 'CONFIRMED',
      platformFee: 0,
      createdAt: { lt: new Date('2026-03-17') }
    },
    include: { items: true }
  });

  console.log(`Found ${orders.length} orders to process`);

  for (const order of orders) {
    try {
      console.log(`Processing order: ${order.orderNumber}`);
      await paymentDistributionService.distributeOrderPayment(order);
      console.log(`✅ Success: ${order.orderNumber}`);
    } catch (error) {
      console.error(`❌ Failed: ${order.orderNumber}`, error.message);
    }
  }
}

migrateExistingOrders();
```

### 3. Notify Merchants

Send email to all merchants explaining:
- Payment system has been updated
- They will now receive automatic payouts
- Instructions to configure payout wallet address
- Timeline for processing backlog

---

## FAQ

### Q: What if a merchant's wallet address is invalid?

**A:** The transaction will fail and be recorded with FAILED status. Admin can contact merchant to update address and retry.

### Q: Can merchants change their payout wallet address?

**A:** Yes, they can update it anytime in merchant settings. New address will be used for future orders.

### Q: What happens if master wallet runs out of gas?

**A:** Transactions will fail with "insufficient gas" error. Monitor gas balance and set up auto-refill alerts.

### Q: Can I use a different platform fee percentage?

**A:** Yes, update `PLATFORM_FEE_PERCENTAGE` in `PaymentDistributionService` (currently set to 0.20 for 20%).

### Q: How do I track platform revenue?

**A:** Query `seller_payouts` table and sum the `platformFee` column. Or check your platform owner wallet balances.

### Q: What if blockchain transaction is stuck?

**A:** Increase gas price and resubmit, or wait for network congestion to clear. Consider using flashbots for MEV protection.

---

## Support

For technical support or questions:
- **GitHub Issues:** https://github.com/0xmart/0xmart-application/issues
- **Email:** dev@0xmart.com
- **Documentation:** See PAYMENT_FLOW_ANALYSIS.md for detailed analysis

---

**Implementation Complete:** March 17, 2026
**Status:** ✅ Ready for Production Testing
**Next Steps:** Test on testnet → Deploy to production → Monitor for 48 hours
