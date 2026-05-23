# 0xMart CLI - Stripe-Level Payment Control for Crypto

## Executive Summary

The **0xMart CLI** is an enterprise-grade payment execution layer that gives developers Stripe-like control over crypto payments without requiring wallet integration. The CLI owns the entire payment lifecycle, from ad display to transaction confirmation.

**Core Principle:** Developers don't integrate wallets. The CLI does.

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPER APPLICATION                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           0xMart CLI (Embedded/Standalone)             │ │
│  │                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │ │
│  │  │  Ad Engine   │  │  Payment     │  │   Wallet    │ │ │
│  │  │              │  │  Executor    │  │  Abstraction│ │ │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │ │
│  │         │                  │                  │       │ │
│  └─────────┼──────────────────┼──────────────────┼───────┘ │
│            │                  │                  │         │
└────────────┼──────────────────┼──────────────────┼─────────┘
             │                  │                  │
             ▼                  ▼                  ▼
    ┌────────────────────────────────────────────────────────┐
    │              0xMart Platform API (402 Protocol)        │
    │                                                        │
    │  • Authentication (API Key)                            │
    │  • Ad Management                                       │
    │  • Payment Initiation                                  │
    │  • Transaction Verification                            │
    │  • Webhook Delivery                                    │
    └────────────────────────────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │   Blockchain RPCs    │
                  │  (Ethereum, Polygon, │
                  │   BSC, Arbitrum...)  │
                  └──────────────────────┘
```

---

## CLI Architecture

### Component Breakdown

#### 1. **CLI Core**
- Command parser & router
- Config management (`~/.0xmart/config.json`)
- Secure key storage (OS keychain integration)
- Update mechanism (auto-update)
- Error handling & logging

#### 2. **Authentication Module**
- API key validation
- Session management
- Token refresh (JWT)
- Scope enforcement
- Revocation checks

#### 3. **Ad Engine**
- Ad fetching (`GET /ads/get-recommendations`)
- Ad rendering (terminal UI)
- Click tracking (`POST /ads/open`)
- Impression logging
- A/B testing support

#### 4. **Payment Executor**
- 402 payment initiation
- Smart contract interaction
- Transaction signing
- Gas estimation & optimization
- Retry logic & idempotency

#### 5. **Wallet Abstraction Layer**
- Embedded wallet (hot wallet)
- Hardware wallet support (Ledger, Trezor)
- Custodial mode (enterprise)
- Non-custodial mode (end-user)
- Multi-network support

#### 6. **Security Module**
- Encrypted key storage
- Signed payloads
- Anti-phishing verification
- Rate limiting
- Fraud detection

---

## CLI Commands

### Installation

```bash
# NPM installation
npm install -g @0xmart/cli

# Verify installation
0xmart --version
```

### Authentication

```bash
# Login with API key
0xmart login
# Prompts: Enter your API key: ********

# Login with inline key
0xmart login --key YOUR_API_KEY

# Check auth status
0xmart whoami
# Output: Logged in as: developer@company.com (API Key: dev_***xyz)

# Logout
0xmart logout
```

### Configuration

```bash
# Initialize configuration
0xmart init
# Creates ~/.0xmart/config.json with defaults

# Set network preference
0xmart config set network polygon

# Set wallet mode (custodial/non-custodial)
0xmart config set wallet-mode custodial

# View current config
0xmart config list

# Reset to defaults
0xmart config reset
```

### Ad Management

```bash
# List available ads (402 protocol endpoints)
0xmart ads list
# Output:
# ID    Product              Price      Network    Commission
# ad_1  Gaming Mouse         $49.99     Polygon    $2.50
# ad_2  Crypto Hardware      $129.00    Ethereum   $6.45
# ad_3  NFT Artwork          $25.00     BSC        $1.25

# Get ad recommendations (personalized)
0xmart ads recommend --category electronics --budget 100
# Uses ML to suggest best-performing ads

# Display ad in terminal UI
0xmart ads show ad_1
# Renders rich terminal UI with product details, price, "Buy Now" button
```

### Payment Execution

```bash
# Execute payment (THE CORE COMMAND)
0xmart pay ad_1
# This command:
# 1. Initiates 402 payment request
# 2. Selects optimal network
# 3. Handles wallet interaction internally
# 4. Signs and submits transaction
# 5. Waits for confirmation
# 6. Returns success/failure

# Pay with specific network
0xmart pay ad_1 --network polygon

# Pay with custom amount (if allowed)
0xmart pay ad_1 --amount 50.00

# Dry run (estimate gas, preview transaction)
0xmart pay ad_1 --dry-run

# Pay with webhook notification
0xmart pay ad_1 --webhook https://yourapp.com/payment-success
```

### Wallet Management

```bash
# View wallet info
0xmart wallet info
# Output:
# Mode: Custodial
# Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
# Networks: Ethereum, Polygon, BSC, Arbitrum
# Balance: 150.25 USDC

# Fund wallet (deposit instructions)
0xmart wallet fund
# Shows deposit address + QR code

# Withdraw from wallet
0xmart wallet withdraw --network polygon --amount 100 --to 0x...

# Export private key (non-custodial mode only)
0xmart wallet export --confirm

# Import wallet (non-custodial mode)
0xmart wallet import --private-key YOUR_PRIVATE_KEY
```

### Transaction History

```bash
# List all transactions
0xmart history

# List with filters
0xmart history --status completed --network polygon

# Get transaction details
0xmart tx tx_abc123

# Export transaction history
0xmart history export --format csv --output transactions.csv
```

### Developer Tools

```bash
# Test API connection
0xmart test connection

# Validate API key
0xmart test auth

# Simulate payment (testnet)
0xmart test pay ad_1 --testnet

# View logs
0xmart logs --tail 100

# Debug mode
0xmart pay ad_1 --debug
```

---

## Wallet Abstraction Layer

### Design Philosophy

**The CLI manages wallets, not the developer.**

### Modes of Operation

#### 1. **Custodial Mode (Default)**

**Best for:** Enterprise applications, high-volume merchants

**How it works:**
- 0xMart hosts the wallet infrastructure
- Private keys stored in AWS KMS / Google Cloud KMS
- Developer never sees private keys
- Platform controls fund flow
- Instant transaction signing
- Regulatory compliance (KYC/AML enforced)

**Security:**
- Multi-sig approval (for large amounts)
- Rate limiting per API key
- IP whitelisting
- 2FA required for withdrawals

**Benefits:**
- Zero key management overhead
- Insurance coverage (optional)
- Transaction batching (lower gas)
- Guaranteed uptime

#### 2. **Non-Custodial Mode**

**Best for:** Privacy-focused applications, end-user wallets

**How it works:**
- CLI generates wallet locally
- Private key encrypted with user password
- Stored in OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- User has full control
- CLI only facilitates signing

**Security:**
- AES-256 encryption
- Key derivation (PBKDF2)
- No key transmission
- Hardware wallet support (Ledger, Trezor)

**Benefits:**
- Full user sovereignty
- No platform risk
- Trustless operation

#### 3. **Hybrid Mode (Advanced)**

**Best for:** Multi-tenant platforms, marketplaces

**How it works:**
- Platform wallet for merchant funds (custodial)
- User wallets for customer payments (non-custodial)
- Automatic fund routing
- Commission auto-deduction

**Example:**
```bash
# Platform receives payment
0xmart pay ad_1
# Flow:
# 1. Customer pays 100 USDC (from their non-custodial wallet)
# 2. Smart contract routes:
#    - 95 USDC → Merchant (custodial wallet)
#    - 5 USDC → Platform commission (platform wallet)
# 3. Instant settlement
```

### Wallet Security Features

**1. Encrypted Key Storage**
```json
// ~/.0xmart/wallets/polygon.json (encrypted)
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "encryptedPrivateKey": "U2FsdGVkX1...",
  "kdfParams": {
    "algorithm": "pbkdf2",
    "iterations": 100000,
    "salt": "..."
  }
}
```

**2. Transaction Signing**
- All transactions signed locally (never send private key)
- Hardware wallet support (USB connection)
- Multi-sig support (for high-value transactions)

**3. Gas Optimization**
- EIP-1559 support (Ethereum)
- Automatic gas estimation
- Fee sponsorship (platform-subsidized gas)

---

## 402 Protocol Enforcement

### Payment Flow (Stripe-Like Control)

```
┌────────────────────────────────────────────────────────────────┐
│                    PAYMENT EXECUTION FLOW                       │
└────────────────────────────────────────────────────────────────┘

1. Developer runs: `0xmart pay ad_1`
   ↓
2. CLI validates API key + ad ID
   ↓
3. CLI calls: POST /api/v1/payment/initiate
   Request:
   {
     "adId": "ad_1",
     "customerEmail": "user@example.com", // Optional
     "network": "polygon" // Optional, CLI auto-selects best
   }
   ↓
4. API validates + returns payment details:
   Response:
   {
     "paymentId": "pay_abc123",
     "orderId": "ord_xyz456",
     "amount": "49.99",
     "currency": "USDC",
     "network": "polygon",
     "contractAddress": "0x...",
     "recipientAddress": "0x...",
     "deadline": 1234567890, // Unix timestamp
     "signature": "0x..." // Platform-signed payload
   }
   ↓
5. CLI validates signature (anti-phishing)
   ↓
6. CLI prepares transaction:
   - Checks wallet balance
   - Estimates gas
   - Constructs contract call
   ↓
7. CLI prompts user (if non-custodial):
   "Confirm payment of 49.99 USDC to Gaming Mouse?"
   [Y/n]
   ↓
8. CLI signs transaction (wallet abstraction layer)
   ↓
9. CLI submits to blockchain
   txHash: 0x...
   ↓
10. CLI waits for confirmation (3 blocks)
    ↓
11. CLI calls: POST /api/v1/payment/confirm
    Request:
    {
      "paymentId": "pay_abc123",
      "txHash": "0x...",
      "network": "polygon"
    }
    ↓
12. API verifies transaction on-chain:
    - Checks block confirmation
    - Validates PaymentProcessed event
    - Updates order status
    ↓
13. API sends webhook to developer
    POST https://developer.com/webhook
    {
      "event": "payment.success",
      "paymentId": "pay_abc123",
      "orderId": "ord_xyz456",
      "amount": "49.99",
      "txHash": "0x..."
    }
    ↓
14. CLI outputs success:
    ✅ Payment successful!
    Transaction: 0x...
    Order ID: ord_xyz456
    View on Explorer: https://polygonscan.com/tx/0x...
```

### Idempotency & Retries

**Problem:** Network failures, gas spikes, blockchain reorgs

**Solution:**

```bash
# CLI automatically retries failed transactions
0xmart pay ad_1
# Attempt 1: Failed (gas too low)
# Attempt 2: Success (gas increased 20%)

# CLI maintains idempotency keys
# If transaction is already confirmed, CLI skips retry
```

**Implementation:**
- CLI stores pending transactions in `~/.0xmart/pending.json`
- Each transaction has unique idempotency key
- On retry, CLI checks if transaction already confirmed
- Maximum 3 retries with exponential backoff

### Failed Payment Handling

**Scenario 1: Insufficient Balance**
```
❌ Payment failed: Insufficient USDC balance
Current: 10.00 USDC
Required: 49.99 USDC

Fund your wallet:
0xmart wallet fund
```

**Scenario 2: Network Congestion**
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

**Scenario 3: Transaction Reverted**
```
❌ Transaction reverted on-chain
Reason: Contract paused by platform

Contact support: support@0xmart.com
```

---

## Security & Trust Model

### Authentication Security

**1. API Key Hierarchy**
```
Master Key (admin)
├── Production Key (prod_...)
│   ├── Read scope
│   ├── Write scope
│   └── Pay scope
└── Test Key (test_...)
    └── Limited to testnet
```

**2. Key Rotation**
```bash
# Generate new key (old key remains valid for 30 days)
0xmart keys rotate

# Revoke key immediately
0xmart keys revoke key_abc123
```

**3. Signed Payloads**

Every payment request includes a platform signature:

```javascript
// API generates signature
const payload = {
  paymentId: "pay_abc123",
  amount: "49.99",
  network: "polygon",
  timestamp: Date.now()
};
const signature = sign(payload, PLATFORM_PRIVATE_KEY);

// CLI verifies signature
const isValid = verify(payload, signature, PLATFORM_PUBLIC_KEY);
if (!isValid) throw new Error("Invalid signature - potential phishing attack");
```

**Benefits:**
- Prevents man-in-the-middle attacks
- Ensures payment requests come from 0xMart
- Protects against fake payment screens

### Anti-Phishing

**1. Visual Verification**
```
┌─────────────────────────────────────┐
│ 🔒 0xMart Secure Payment            │
│                                     │
│ Verified Merchant: Gaming Gear Co.  │
│ ✅ SSL Certificate Valid            │
│ ✅ Smart Contract Audited           │
│                                     │
│ Amount: 49.99 USDC                  │
│ Network: Polygon                    │
│ Gas Fee: ~0.01 USDC                 │
│                                     │
│ [Confirm Payment] [Cancel]          │
└─────────────────────────────────────┘
```

**2. Domain Verification**
- CLI verifies API domain matches `api.0xmart.com`
- SSL certificate pinning
- Rejects self-signed certificates

**3. Hardware Wallet Integration**
```bash
# When using Ledger, transaction details shown on device
0xmart pay ad_1 --ledger

# Ledger displays:
# "Send 49.99 USDC to 0x742d..."
# User physically confirms on device
```

### Rate Limiting & Fraud Detection

**1. Per-API-Key Limits**
```
Free Tier:     10 payments/hour
Basic Tier:    100 payments/hour
Pro Tier:      1000 payments/hour
Enterprise:    Unlimited (custom SLA)
```

**2. Fraud Detection**
- Unusual payment patterns
- IP geolocation mismatch
- Velocity checks (too many payments in short time)
- ML-based risk scoring

**3. Manual Review Queue**
```bash
# High-risk payment flagged
⚠️  Payment requires manual review
Reason: First payment from new API key
ETA: 5 minutes

Track status: 0xmart status pay_abc123
```

---

## Platform Control Mechanisms

### 1. **Payment UX Control**

**Platform enforces:**
- Minimum/maximum payment amounts
- Supported networks
- Gas fee caps
- Payment deadlines

**Example:**
```json
// Platform policy (enforced by API)
{
  "minPayment": "1.00",
  "maxPayment": "10000.00",
  "supportedNetworks": ["ethereum", "polygon", "bsc", "arbitrum"],
  "gasFeeCap": "5.00", // Max $5 in gas fees
  "paymentDeadline": 3600 // 1 hour
}
```

**CLI enforces these rules before submitting transaction.**

### 2. **Pricing Control**

**Dynamic Pricing:**
```bash
# Platform adjusts prices based on:
# - Network congestion
# - Token price volatility
# - Merchant settings

0xmart pay ad_1
# Price: 49.99 USDC (updated 2 minutes ago)
```

**Commission Enforcement:**
```solidity
// Smart contract enforces commission
function payForProduct(uint256 orderId, uint256 amount) external {
  uint256 commission = (amount * 5) / 100; // 5%
  uint256 merchantPayout = amount - commission;

  USDC.transferFrom(msg.sender, platformWallet, commission);
  USDC.transferFrom(msg.sender, merchantWallet, merchantPayout);

  emit PaymentProcessed(orderId, amount, commission);
}
```

### 3. **Access Control**

**Instant Revocation:**
```bash
# Platform admin revokes API key
# CLI immediately stops working

0xmart pay ad_1
# ❌ Error: API key revoked
# Reason: Terms of Service violation
# Contact: support@0xmart.com
```

**Scoped Permissions:**
```json
// API key scopes
{
  "keyId": "key_abc123",
  "scopes": [
    "ads:read",
    "ads:track",
    "payment:initiate",
    // "payment:execute" - REVOKED
  ]
}
```

### 4. **Analytics & Tracking**

**Platform tracks:**
- Impressions (ads shown)
- Clicks (ads clicked)
- Conversions (payments completed)
- Revenue (total volume)
- Churn (failed payments)

**Developer dashboard:**
```
┌──────────────────────────────────────────┐
│ 0xMart Analytics Dashboard               │
├──────────────────────────────────────────┤
│ Impressions:    10,450                   │
│ Clicks:         523 (5.0% CTR)           │
│ Conversions:    47 (9.0% conversion)     │
│ Revenue:        $2,345.30                │
│ Avg Order:      $49.90                   │
│ Failed Payments: 12 (20.3% of attempts)  │
└──────────────────────────────────────────┘
```

**CLI reports telemetry:**
```bash
# CLI sends anonymous usage data (opt-out available)
0xmart config set telemetry false
```

---

## Why This Feels Like Stripe/Razorpay

### Comparison Matrix

| Feature | Stripe | Razorpay | 0xMart CLI |
|---------|--------|----------|------------|
| **Developer owns payment flow** | ❌ No (Stripe does) | ❌ No (Razorpay does) | ❌ No (0xMart does) |
| **Plug-and-play integration** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Wallet abstraction** | ✅ Yes (cards) | ✅ Yes (UPI) | ✅ Yes (crypto) |
| **Single API key** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Instant settlement** | ❌ No (T+2) | ❌ No (T+1) | ✅ Yes (on-chain) |
| **Platform controls UX** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Fraud prevention** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Webhooks** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Dashboard analytics** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Global reach** | ✅ Yes | 🟡 Limited | ✅ Yes (9 networks) |

### Developer Experience

**Stripe Checkout:**
```javascript
// Developer code
const stripe = require('stripe')(API_KEY);
const session = await stripe.checkout.sessions.create({
  line_items: [{price: 'price_123', quantity: 1}],
  mode: 'payment',
});
// Stripe handles everything else
```

**0xMart CLI:**
```javascript
// Developer code
const { exec } = require('child_process');
exec('0xmart pay ad_1', (err, stdout) => {
  if (stdout.includes('✅ Payment successful')) {
    console.log('Order confirmed!');
  }
});
// 0xMart CLI handles everything else
```

**Key Similarity:**
- Developer writes minimal code
- Platform handles complexity
- Deterministic outcomes
- Enterprise-grade reliability

---

## What Makes This Better for Crypto

### 1. **Instant Settlement**
- Stripe: T+2 days
- 0xMart: 3 blocks (~5 minutes)

### 2. **Global by Default**
- No country restrictions
- No currency conversion fees
- Permissionless access

### 3. **Transparent Fees**
- Stripe: 2.9% + $0.30
- 0xMart: 5% + gas (~$0.01 on Polygon)

### 4. **No Chargebacks**
- Irreversible on-chain transactions
- Merchant protection built-in

### 5. **Programmable Money**
- Smart contract automation
- Escrow support
- Multi-party splits

### 6. **User Privacy**
- No bank account required
- Pseudonymous payments
- GDPR-compliant (no PII stored)

---

## Advanced Features

### 1. **Embedded Payment UI**

```bash
# Generate embeddable payment widget
0xmart widget create ad_1 --output payment.html

# Produces:
# <script src="https://cli.0xmart.com/widget.js"></script>
# <div id="0xmart-payment" data-ad="ad_1"></div>
```

**Use case:** E-commerce websites

### 2. **Subscription Payments**

```bash
# Create recurring payment
0xmart subscribe product_monthly --amount 9.99 --interval monthly

# Cancel subscription
0xmart subscription cancel sub_abc123
```

**Use case:** SaaS, memberships

### 3. **Escrow Payments**

```bash
# Create escrow
0xmart escrow create ad_1 --release-after 7d

# Release funds (after service delivered)
0xmart escrow release escrow_abc123
```

**Use case:** Freelance platforms, marketplaces

### 4. **Multi-Party Splits**

```bash
# Split payment between multiple recipients
0xmart pay ad_1 --split merchant:80,affiliate:15,platform:5
```

**Use case:** Affiliate marketing, revenue sharing

---

## Implementation Roadmap

### Phase 1: Core CLI (Weeks 1-4)
- ✅ Authentication system
- ✅ Basic payment flow
- ✅ Custodial wallet mode
- ✅ Terminal UI

### Phase 2: Wallet Abstraction (Weeks 5-8)
- ✅ Non-custodial mode
- ✅ Hardware wallet support
- ✅ Multi-network support
- ✅ Gas optimization

### Phase 3: Advanced Features (Weeks 9-12)
- ✅ Ad engine integration
- ✅ Subscription payments
- ✅ Escrow support
- ✅ Analytics dashboard

### Phase 4: Enterprise (Weeks 13-16)
- ✅ White-label CLI
- ✅ Custom branding
- ✅ SLA guarantees
- ✅ Dedicated support

---

## Success Metrics

**Developer Adoption:**
- 1,000 active API keys in 6 months
- 10,000 transactions/month
- $1M+ GMV in year 1

**Platform Control:**
- 99.9% uptime
- <1% fraud rate
- <5 seconds average payment time

**Developer Satisfaction:**
- NPS score > 50
- 90%+ integration success rate
- <10 minutes time-to-first-payment

---

## Conclusion

The **0xMart CLI** transforms crypto payments from a developer burden into a platform-controlled, Stripe-like experience.

**Key Differentiators:**
1. ✅ Platform owns the payment flow (not the developer)
2. ✅ Wallet abstraction (developer never touches keys)
3. ✅ 402 protocol enforcement (deterministic outcomes)
4. ✅ Enterprise-grade security (fraud prevention, rate limiting)
5. ✅ Instant settlement (crypto advantage)

This is not a flexible hobby tool.
This is the **default way developers will implement crypto payments**, just like Stripe Checkout today.
