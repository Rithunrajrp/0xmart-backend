# 0xMart CLI - Developer Guide

**The Stripe of Crypto Payments**

---

## Quick Start (5 Minutes to First Payment)

###Step 1: Install the CLI

```bash
npm install -g @0xmart/cli
```

### Step 2: Get Your API Key

1. Go to [0xmart.com/dashboard](https://0xmart.com/dashboard)
2. Navigate to **API Keys**
3. Click **Create New Key**
4. Copy your API key (`sk_live_...`)

### Step 3: Login

```bash
0xmart login
# Paste your API key when prompted
```

### Step 4: Execute Your First Payment

```bash
0xmart pay ad_demo_mouse
```

**That's it.** You just processed a crypto payment without:
- ❌ Integrating a wallet
- ❌ Managing private keys
- ❌ Writing smart contract code
- ❌ Handling gas fees
- ❌ Dealing with blockchain complexity

---

## What is 0xMart CLI?

0xMart CLI is a **platform-controlled payment execution layer** for crypto commerce.

**Think of it like:**
- **Stripe Checkout** → You don't build the payment UI
- **Razorpay** → You don't manage payment flows
- **0xMart CLI** → You don't integrate wallets

**The CLI owns:**
- ✅ Wallet management
- ✅ Transaction signing
- ✅ Gas optimization
- ✅ Network selection
- ✅ Payment verification
- ✅ Error handling

**You own:**
- ✅ Your product/service
- ✅ Your customer relationships
- ✅ Your business logic

---

## Core Concepts

### 1. Ads = Payment Entry Points

In 0xMart, **ads** are not just marketing content. They are **transaction-ready products**.

```bash
# List available ads
0xmart ads list

# Output:
# ID           Product              Price    Network   Commission
# ad_mouse_01  Gaming Mouse         $49.99   Polygon   $2.50
# ad_kb_01     Mechanical Keyboard  $129.00  Ethereum  $6.45
# ad_nft_01    NFT Artwork          $25.00   BSC       $1.25
```

Each ad has:
- Fixed price
- Assigned blockchain network
- Commission structure
- Ready-to-execute payment flow

### 2. 402 Payment Protocol

HTTP 402 means **"Payment Required"**. The 0xMart CLI implements this as:

```
Request → 402 Response → CLI Handles Payment → Retry Request → Success
```

**Traditional Web:**
```
GET /premium-content
← 402 Payment Required (dead end)
```

**0xMart CLI:**
```
GET /premium-content
← 402 Payment Required (paymentId=pay_123, amount=9.99)
0xmart pay pay_123
← Payment confirmed
GET /premium-content
← 200 OK (content delivered)
```

### 3. Wallet Modes

#### Custodial (Default)
```bash
0xmart config set wallet-mode custodial
```

**How it works:**
- 0xMart hosts your wallet
- Private keys stored securely (AWS KMS)
- Instant transaction signing
- No gas management needed
- Platform controls funds

**Best for:**
- Enterprise applications
- High-volume merchants
- SaaS platforms
- Marketplaces

**Pros:**
- ✅ Zero key management
- ✅ Insurance available
- ✅ Regulatory compliance
- ✅ Instant settlement

**Cons:**
- ❌ Platform custody (not your keys)

#### Non-Custodial
```bash
0xmart config set wallet-mode non-custodial
```

**How it works:**
- CLI generates wallet locally
- Private key encrypted with password
- Stored in OS keychain
- You have full control

**Best for:**
- Privacy-focused apps
- End-user wallets
- Decentralized platforms

**Pros:**
- ✅ Full sovereignty
- ✅ No platform risk
- ✅ Trustless

**Cons:**
- ❌ You manage keys
- ❌ Gas fee management

---

## CLI Commands Reference

### Authentication

#### `0xmart login`
Authenticate with your API key.

```bash
# Interactive
0xmart login

# Non-interactive
0xmart login --key sk_live_abc123
```

**Security:**
- API key stored in OS keychain (Keychain Access on macOS, Credential Manager on Windows)
- Never stored in plain text
- Encrypted at rest

#### `0xmart whoami`
Show current user info.

```bash
0xmart whoami

# Output:
# Logged in as: developer@company.com
# API Key: sk_live_abc***xyz
# Scopes: ads:read, payment:execute, wallet:manage
```

#### `0xmart logout`
Logout and clear credentials.

```bash
0xmart logout
```

---

### Configuration

#### `0xmart config set <key> <value>`
Update configuration.

```bash
# Set wallet mode
0xmart config set wallet-mode custodial

# Set default network
0xmart config set network polygon

# Disable telemetry
0xmart config set telemetry false
```

#### `0xmart config list`
View current configuration.

```bash
0xmart config list

# Output:
# walletMode: custodial
# network: polygon
# telemetry: true
```

#### `0xmart config reset`
Reset to defaults.

```bash
0xmart config reset
```

**Default Configuration:**
```json
{
  "walletMode": "custodial",
  "network": "polygon",
  "telemetry": true
}
```

---

### Ad Management

#### `0xmart ads list`
List all available ads.

```bash
0xmart ads list

# Output (table format):
# ID           Product              Price    Network   Commission
# ad_mouse_01  Gaming Mouse         $49.99   Polygon   $2.50
# ad_kb_01     Mechanical Keyboard  $129.00  Ethereum  $6.45
# ad_nft_01    NFT Artwork          $25.00   BSC       $1.25
```

#### `0xmart ads recommend`
Get personalized ad recommendations.

```bash
# Basic
0xmart ads recommend

# With filters
0xmart ads recommend --category electronics --budget 100

# Output:
# Top Recommendations:
# 1. Gaming Mouse ($49.99) - 8.5% conversion rate
# 2. USB-C Cable ($19.99) - 12.3% conversion rate
# 3. Wireless Charger ($39.99) - 6.7% conversion rate
```

**Uses ML to suggest best-performing ads based on:**
- Your API key's historical performance
- Category preferences
- Budget constraints
- Network preferences

#### `0xmart ads show <adId>`
Display ad details in rich terminal UI.

```bash
0xmart ads show ad_mouse_01

# Output:
# ┌────────────────────────────────────────┐
# │           Gaming Mouse                 │
# │                                        │
# │  [Product Image]                       │
# │                                        │
# │  Price: $49.99 USDC                    │
# │  Network: Polygon                      │
# │  Commission: $2.50 (5%)                │
# │  Est. Gas: ~$0.01                      │
# │                                        │
# │  [Buy Now]  [Share]                    │
# └────────────────────────────────────────┘
```

---

### Payment Execution

#### `0xmart pay <adId>`
Execute payment for an ad.

```bash
# Basic payment
0xmart pay ad_mouse_01

# Specify network
0xmart pay ad_mouse_01 --network polygon

# Dry run (estimate only)
0xmart pay ad_mouse_01 --dry-run

# With webhook
0xmart pay ad_mouse_01 --webhook https://yourapp.com/payment-success
```

**Payment Flow:**
```
1. Initiating payment... ✅
2. Displaying payment details
   ┌─────────────────────────────────────┐
   │ 🔒 0xMart Secure Payment            │
   ├─────────────────────────────────────┤
   │ Amount: 49.99 USDC                  │
   │ Network: Polygon                    │
   │ Order ID: ord_xyz456                │
   └─────────────────────────────────────┘

3. Confirm payment? (y/n): y

4. Executing transaction... ✅
5. Waiting for blockchain confirmation... ✅

✅ Payment successful!
Transaction: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Order ID: ord_xyz456
View on Explorer: https://polygonscan.com/tx/0x742d...
```

**Error Handling:**

**Insufficient Balance:**
```
❌ Payment failed: Insufficient USDC balance
Current: 10.00 USDC
Required: 49.99 USDC

Fund your wallet:
0xmart wallet fund
```

**Network Congestion:**
```
⚠️  Network congestion detected
Estimated wait: 5 minutes
Gas price: 150 Gwei

Options:
1. Wait and retry [Recommended]
2. Increase gas price (+20%)
3. Switch to Polygon (lower fees)
4. Cancel payment

Choice: _
```

**Transaction Reverted:**
```
❌ Transaction reverted on-chain
Reason: Contract paused by platform

Contact support: support@0xmart.com
```

---

### Wallet Management

#### `0xmart wallet info`
View wallet information.

```bash
0xmart wallet info

# Custodial Mode Output:
# Mode: Custodial
# Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
# Networks: Ethereum, Polygon, BSC, Arbitrum
# Balances:
#   Polygon: 150.25 USDC
#   Ethereum: 50.00 USDC
#   BSC: 25.00 USDC

# Non-Custodial Mode Output:
# Mode: Non-Custodial
# Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
# Balance: 150.25 USDC (Polygon)
# Encrypted: Yes
# Hardware Wallet: Not connected
```

#### `0xmart wallet fund`
Get deposit instructions.

```bash
0xmart wallet fund

# Output:
# Deposit Address (Polygon):
# 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
#
# [QR Code]
#
# ⚠️  Only send USDC on Polygon network to this address.
# Sending other tokens or wrong network will result in loss of funds.
```

#### `0xmart wallet withdraw`
Withdraw funds from wallet.

```bash
0xmart wallet withdraw --network polygon --amount 100 --to 0x...

# Output:
# Withdrawing 100 USDC from Polygon to 0x...
# Confirm withdrawal? (y/n): y
# Transaction: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

#### `0xmart wallet export`
Export private key (non-custodial only).

```bash
0xmart wallet export --confirm

# Output:
# ⚠️  WARNING: Never share your private key!
# Enter wallet password: ********
#
# Private Key: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
#
# Keep this safe. Anyone with this key can access your funds.
```

#### `0xmart wallet import`
Import existing wallet (non-custodial only).

```bash
# Import with private key
0xmart wallet import --private-key 0x...

# Import with mnemonic
0xmart wallet import --mnemonic "word1 word2 ... word12"

# Output:
# Wallet imported successfully!
# Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

---

### Transaction History

#### `0xmart history`
View transaction history.

```bash
# All transactions
0xmart history

# With filters
0xmart history --status completed --network polygon --limit 50

# Output (table format):
# Date       ID       Amount    Network  Status     Tx Hash
# 01/20/25   tx_001   49.99     Polygon  Completed  0x742d3...
# 01/19/25   tx_002   129.00    Ethereum Completed  0x8a4b2...
# 01/18/25   tx_003   25.00     BSC      Failed     0x3f7c1...
```

#### `0xmart tx <txId>`
Get transaction details.

```bash
0xmart tx tx_001

# Output:
# Transaction: tx_001
# Payment ID: pay_abc123
# Order ID: ord_xyz456
# Amount: 49.99 USDC
# Network: Polygon
# Status: Completed
# Tx Hash: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
# Block: 45678901
# Confirmations: 1234
# Gas Used: 0.01 USDC
# Created: 2025-01-20 14:30:00
# Confirmed: 2025-01-20 14:32:15
#
# View on Explorer: https://polygonscan.com/tx/0x742d...
```

#### `0xmart history export`
Export transaction history.

```bash
# Export to CSV
0xmart history export --format csv --output transactions.csv

# Export to JSON
0xmart history export --format json --output transactions.json

# Output:
# ✅ Exported 147 transactions to transactions.csv
```

---

### Developer Tools

#### `0xmart test connection`
Test API connectivity.

```bash
0xmart test connection

# Output:
# Testing connection to api.0xmart.com...
# ✅ API accessible
# ✅ SSL certificate valid
# ✅ Authentication successful
# ✅ Latency: 45ms
```

#### `0xmart test auth`
Validate API key permissions.

```bash
0xmart test auth

# Output:
# API Key: sk_live_abc***xyz
# Email: developer@company.com
# Scopes:
#   ✅ ads:read
#   ✅ ads:track
#   ✅ payment:initiate
#   ✅ payment:execute
#   ✅ wallet:manage
#   ❌ admin:manage (not granted)
```

#### `0xmart test pay <adId>`
Simulate payment on testnet.

```bash
0xmart test pay ad_mouse_01 --testnet

# Output:
# Running on Mumbai testnet...
# ✅ Payment simulation successful
# Transaction: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
# No real funds transferred.
```

#### `0xmart logs`
View CLI logs.

```bash
# Tail logs
0xmart logs --tail 100

# View all logs
0xmart logs

# Filter by level
0xmart logs --level error
```

#### `0xmart pay <adId> --debug`
Enable debug mode for payment.

```bash
0xmart pay ad_mouse_01 --debug

# Output includes:
# - API request/response bodies
# - Smart contract calls
# - Gas estimation details
# - Transaction raw data
# - Blockchain RPC calls
```

---

## Integration Patterns

### 1. E-Commerce Checkout

```javascript
// Your Node.js backend
const { exec } = require('child_process');

app.post('/checkout', async (req, res) => {
  const { adId } = req.body;

  // Execute payment via CLI
  exec(`0xmart pay ${adId}`, (err, stdout) => {
    if (stdout.includes('✅ Payment successful')) {
      // Extract order ID from stdout
      const orderId = stdout.match(/Order ID: (ord_\w+)/)[1];

      // Fulfill order
      await fulfillOrder(orderId);

      res.json({ success: true, orderId });
    } else {
      res.status(400).json({ error: 'Payment failed' });
    }
  });
});
```

### 2. Subscription Platform

```bash
# Create monthly subscription
0xmart subscribe product_premium --amount 9.99 --interval monthly

# CLI will automatically charge every month
# Cancel anytime:
0xmart subscription cancel sub_abc123
```

### 3. Marketplace with Escrow

```bash
# Buyer pays into escrow
0xmart escrow create ad_freelance_service --release-after 7d

# Seller delivers service
# Buyer reviews and releases funds:
0xmart escrow release escrow_abc123

# Or dispute:
0xmart escrow dispute escrow_abc123 --reason "Service not delivered"
```

### 4. Affiliate Marketing

```bash
# Pay with affiliate split
0xmart pay ad_mouse_01 --split merchant:80,affiliate:15,platform:5

# Funds automatically split:
# Merchant: $39.99 (80%)
# Affiliate: $7.50 (15%)
# Platform: $2.50 (5%)
```

---

## Security Best Practices

### 1. API Key Management

**✅ DO:**
- Store API keys in environment variables
- Use different keys for dev/staging/prod
- Rotate keys regularly (every 90 days)
- Use read-only keys for dashboards
- Enable IP whitelisting

**❌ DON'T:**
- Commit API keys to git
- Share keys via email/Slack
- Use production keys in dev
- Use same key across projects

**Example:**
```bash
# .env
OXMART_API_KEY=sk_live_abc123

# Your app
const apiKey = process.env.OXMART_API_KEY;
exec(`0xmart login --key ${apiKey}`);
```

### 2. Wallet Security

**Custodial Mode:**
- ✅ Enable 2FA for withdrawals
- ✅ Set withdrawal limits
- ✅ Whitelist destination addresses
- ✅ Enable email notifications

**Non-Custodial Mode:**
- ✅ Use strong wallet password (20+ characters)
- ✅ Backup mnemonic phrase securely
- ✅ Consider hardware wallet (Ledger/Trezor)
- ✅ Never share private key

### 3. Transaction Verification

**Always verify:**
- Payment amount matches expected price
- Blockchain network is correct
- Recipient address is valid
- Transaction hash on block explorer

**Example:**
```bash
# After payment
0xmart tx tx_abc123

# Verify on block explorer
# https://polygonscan.com/tx/0x...
```

### 4. Webhook Security

**Verify webhook signatures:**
```javascript
const crypto = require('crypto');

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-0xmart-signature'];
  const payload = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).send('Invalid signature');
  }

  // Process webhook
  const { event, paymentId, orderId } = req.body;
  if (event === 'payment.success') {
    fulfillOrder(orderId);
  }

  res.sendStatus(200);
});
```

---

## Troubleshooting

### Common Issues

#### "Not authenticated"
```bash
# Error:
# ❌ Not authenticated. Run: 0xmart login

# Solution:
0xmart login
```

#### "Insufficient balance"
```bash
# Error:
# ❌ Insufficient USDC balance

# Solution:
0xmart wallet fund
# Send USDC to displayed address
```

#### "API key revoked"
```bash
# Error:
# ❌ API key revoked

# Solution:
# 1. Go to dashboard.0xmart.com
# 2. Generate new API key
# 3. Login with new key
0xmart login --key sk_live_new_key
```

#### "Network congestion"
```bash
# Error:
# ⚠️  Network congestion detected

# Solutions:
# 1. Wait and retry (recommended)
# 2. Switch to cheaper network:
0xmart pay ad_mouse_01 --network polygon
```

#### "Transaction reverted"
```bash
# Error:
# ❌ Transaction reverted: Contract paused

# Solution:
# Contact support@0xmart.com with:
# - Payment ID
# - Transaction hash
# - Error message
```

### Debug Mode

```bash
# Enable debug logging
0xmart pay ad_mouse_01 --debug

# View logs
0xmart logs --tail 1000

# Test connection
0xmart test connection

# Validate auth
0xmart test auth
```

---

## FAQ

### Can I use my own wallet?
**Yes!** Switch to non-custodial mode:
```bash
0xmart config set wallet-mode non-custodial
0xmart wallet import --private-key YOUR_KEY
```

### What networks are supported?
- Ethereum (Mainnet)
- Polygon
- BSC (Binance Smart Chain)
- Arbitrum
- Optimism
- Avalanche
- Base
- Sui
- TON

### What tokens are supported?
- USDT
- USDC (recommended)
- DAI
- BUSD

### How much are fees?
- Platform commission: **5%** (varies by ad)
- Gas fees: **~$0.01 on Polygon**, ~$5 on Ethereum

### Can I get testnet credits?
**Yes!**
```bash
# Request testnet USDC
0xmart faucet --network mumbai

# You'll receive 100 testnet USDC
```

### How do I get support?
- Email: support@0xmart.com
- Discord: https://discord.gg/0xmart
- Docs: https://docs.0xmart.com
- GitHub: https://github.com/0xmart/cli

---

## What's Next?

### Upgrade Your Account
```bash
# View available tiers
0xmart tiers list

# Upgrade to Pro
0xmart upgrade pro

# Benefits:
# - Higher rate limits
# - Priority support
# - Custom branding
# - Webhook SLA
```

### Explore Advanced Features
- **Subscription payments**
- **Escrow transactions**
- **Multi-party splits**
- **Embedded payment widgets**

### Join the Community
- Read our blog: https://blog.0xmart.com
- Join Discord: https://discord.gg/0xmart
- Follow on Twitter: @0xMart
- Contribute on GitHub: https://github.com/0xmart

---

## Conclusion

You just learned how to use the **0xMart CLI** to process crypto payments with Stripe-like simplicity.

**Remember:**
- ✅ Platform owns the payment flow
- ✅ You don't integrate wallets
- ✅ Instant settlement on-chain
- ✅ Enterprise-grade security
- ✅ Global reach, no restrictions

**Start building:**
```bash
0xmart login
0xmart pay ad_demo_mouse
```

**Welcome to the future of crypto commerce.** 🚀
