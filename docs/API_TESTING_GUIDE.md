# 0xMart API Testing Guide

## Overview

This guide explains how to test the 0xMart 402 Payment Protocol API in a safe testnet environment **without spending real money**. When you create an API key with testnet mode enabled, all transactions will use testnet networks where you can get free test tokens.

## Table of Contents

1. [Creating a Testnet API Key](#creating-a-testnet-API-key)
2. [Getting Testnet Tokens](#getting-testnet-tokens)
3. [Complete Payment Flow Testing](#complete-payment-flow-testing)
4. [Supported Testnet Networks](#supported-testnet-networks)
5. [Testing Best Practices](#testing-best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Creating a Testnet API Key

### Step 1: Register & Login

1. Create an account at `http://localhost:3000` (or your deployment URL)
2. Verify your email with the OTP sent to your inbox
3. Login to your dashboard

### Step 2: Generate API Key in Testnet Mode

Navigate to **Dashboard > API Keys** and create a new key with these settings:

```json
POST /api/v1/api-keys

{
  "name": "My Testnet API Key",
  "subscriptionTier": "free",
  "isTestnetMode": true,  // ⚠️ IMPORTANT: Set this to true for testing
  "supportedNetworks": [
    "ETHEREUM",     // Sepolia testnet
    "POLYGON",      // Amoy testnet
    "OPTIMISM",     // Optimism Sepolia
    "ARBITRUM",     // Arbitrum Sepolia
    "BASE",         // Base Sepolia
    "AVALANCHE",    // Fuji testnet
    "BSC",          // BSC testnet
    "SUI",          // Sui testnet
    "TON",          // TON testnet
    "SOLANA"        // Solana devnet
  ],
  "webhookUrl": "https://your-app.com/webhooks/0xmart"  // Optional
}
```

**Response:**
```json
{
  "id": "api-key-uuid",
  "apiKey": "xmart_xxxxxxxxxxxxxxxxxxxxxxxx",        // Save this!
  "apiSecret": "xms_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",  // Save this!
  "prefix": "xmart_xx",
  "tier": "free",
  "isTestnetMode": true,
  "supportedNetworks": ["ETHEREUM", "POLYGON", ...],
  "webhookSecret": "webhook-secret-here",             // Save this!
  "createdAt": "2025-01-01T00:00:00Z"
}
```

> ⚠️ **CRITICAL**: Save your `apiKey`, `apiSecret`, and `webhookSecret` immediately. They will **NEVER** be shown again!

---

## Getting Testnet Tokens

With testnet mode enabled, you'll need free testnet tokens to complete transactions. Here's how to get them:

### EVM Testnet Faucets

| Network | Testnet Name | Faucet URLs | Tokens Available |
|---------|-------------|-------------|------------------|
| **Ethereum** | Sepolia | • [Alchemy Faucet](https://sepoliafaucet.com/)<br>• [Infura Faucet](https://www.infura.io/faucet/sepolia) | ETH, USDT, USDC, DAI, BUSD |
| **Polygon** | Amoy | • [Alchemy Faucet](https://www.alchemy.com/faucets/polygon-amoy)<br>• [Official Faucet](https://faucet.polygon.technology/) | MATIC, USDT, USDC, DAI |
| **Optimism** | Sepolia | • [Alchemy Faucet](https://www.alchemy.com/faucets/optimism-sepolia)<br>• [Optimism Faucet](https://app.optimism.io/faucet) | ETH, USDC |
| **Arbitrum** | Sepolia | • [Alchemy Faucet](https://www.alchemy.com/faucets/arbitrum-sepolia)<br>• [Arbitrum Faucet](https://faucet.arbitrum.io/) | ETH, USDT, USDC |
| **Base** | Sepolia | • [Alchemy Faucet](https://www.alchemy.com/faucets/base-sepolia)<br>• [Coinbase Faucet](https://portal.cdp.coinbase.com/products/faucet) | ETH, USDC |
| **Avalanche** | Fuji | • [Ava Labs Faucet](https://core.app/tools/testnet-faucet/)<br>• [Chainlink Faucet](https://faucets.chain.link/fuji) | AVAX, USDT, USDC |
| **BSC** | Testnet | • [BNB Faucet](https://testnet.bnbchain.org/faucet-smart)<br>• [BscScan Faucet](https://testnet.bscscan.com/faucet) | BNB, USDT, BUSD |

### Non-EVM Testnet Faucets

| Network | Faucet URLs | How to Get Tokens |
|---------|------------|-------------------|
| **SUI** | • [Sui Faucet](https://faucet.sui.io/)<br>• CLI: `sui client faucet` | Request via website or CLI |
| **TON** | • [@testgiver_ton_bot](https://t.me/testgiver_ton_bot) on Telegram<br>• [TON Faucet](https://faucet.toncoin.org/) | Send wallet address to bot |
| **Solana** | • [Solana Faucet](https://faucet.solana.com/)<br>• CLI: `solana airdrop 2 <ADDRESS> --url devnet` | Request via website or CLI |

### Quick Start: Get Test USDC on Polygon Amoy

```bash
# 1. Visit Alchemy Faucet
https://www.alchemy.com/faucets/polygon-amoy

# 2. Enter your wallet address (you'll get this from the API response)

# 3. Request MATIC (for gas) and USDC (for payment)

# 4. Wait ~30 seconds for tokens to arrive
```

---

## Complete Payment Flow Testing

Here's a complete example of testing the 402 Payment Protocol:

### Step 1: Initiate Payment

```bash
curl -X POST https://api.0xmart.com/api/v1/payment/initiate \
  -H "X-API-Key: xmart_your_testnet_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "product-123",
    "quantity": 1,
    "email": "customer@example.com",
    "phone": "+1234567890",
    "stablecoinType": "USDC",
    "network": "POLYGON"
  }'
```

**Response:**
```json
{
  "status": "INITIATED",
  "orderId": "order-uuid",
  "orderNumber": "EXT-1234567890-0001",
  "need": {
    "emailVerification": true,
    "phoneVerification": false,
    "address": true,
    "networkSelection": false
  },
  "product": {
    "id": "product-123",
    "name": "Test Product",
    "price": "10.00",
    "currency": "USDC"
  },
  "suggestedNetworks": ["POLYGON", "BSC", "ARBITRUM"]
}
```

### Step 2: Verify OTP

```bash
curl -X POST https://api.0xmart.com/api/v1/payment/verify-otp \
  -H "X-API-Key: xmart_your_testnet_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-uuid",
    "otp": "123456",
    "type": "email"
  }'
```

### Step 3: Submit Shipping Address

```bash
curl -X POST https://api.0xmart.com/api/v1/payment/submit-address \
  -H "X-API-Key: xmart_your_testnet_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-uuid",
    "fullName": "John Doe",
    "addressLine1": "123 Test Street",
    "city": "Test City",
    "state": "TC",
    "postalCode": "12345",
    "country": "USA"
  }'
```

### Step 4: Select Network & Get Deposit Address

```bash
curl -X POST https://api.0xmart.com/api/v1/payment/select-network \
  -H "X-API-Key: xmart_your_testnet_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-uuid",
    "network": "POLYGON"
  }'
```

**Response:**
```json
{
  "success": true,
  "payment": {
    "depositAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "amount": "10.00",
    "currency": "USDC",
    "network": "POLYGON",
    "expiresAt": "2025-01-02T00:00:00Z",
    "qrData": "{...}"
  }
}
```

### Step 5: Send Test Tokens

Now use your testnet wallet (MetaMask on Polygon Amoy) to send **10 USDC** to the deposit address.

> 💡 **Tip**: Since you're in testnet mode, the deposit address is on **Polygon Amoy**, not Polygon mainnet.

### Step 6: Confirm Payment (Optional)

```bash
curl -X POST https://api.0xmart.com/api/v1/payment/confirm \
  -H "X-API-Key: xmart_your_testnet_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-uuid",
    "txHash": "0xabcdef1234567890..."
  }'
```

### Step 7: Monitor Order Status

```bash
curl -X GET https://api.0xmart.com/api/v1/payment/status/order-uuid \
  -H "X-API-Key: xmart_your_testnet_api_key"
```

**Response:**
```json
{
  "orderId": "order-uuid",
  "orderNumber": "EXT-1234567890-0001",
  "status": "PAYMENT_DETECTED",  // Changes as payment is processed
  "payment": {
    "depositAddress": "0x...",
    "network": "POLYGON",
    "expectedAmount": "10.00",
    "receivedAmount": "10.00",
    "txHash": "0xabcdef..."
  }
}
```

### Step 8: Receive Webhook Notification

Your webhook endpoint will receive:

```json
POST https://your-app.com/webhooks/0xmart

Headers:
  X-0xMart-Signature: hmac-sha256-signature
  X-0xMart-Event: PAYMENT_CONFIRMED

Body:
{
  "event": "PAYMENT_CONFIRMED",
  "orderId": "order-uuid",
  "orderNumber": "EXT-1234567890-0001",
  "status": "PAYMENT_CONFIRMED",
  "amount": "10.00",
  "currency": "USDC",
  "network": "POLYGON",
  "txHash": "0xabcdef...",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

---

## Supported Testnet Networks

When `isTestnetMode: true`, your API key uses these testnet networks:

| Network Type | Mainnet | Testnet (Used in Testing) |
|-------------|---------|---------------------------|
| ETHEREUM | Ethereum Mainnet | **Sepolia** |
| POLYGON | Polygon Mainnet | **Amoy** (formerly Mumbai) |
| BSC | BNB Smart Chain | **BSC Testnet** |
| ARBITRUM | Arbitrum One | **Arbitrum Sepolia** |
| OPTIMISM | Optimism Mainnet | **Optimism Sepolia** |
| AVALANCHE | Avalanche C-Chain | **Fuji** |
| BASE | Base Mainnet | **Base Sepolia** |
| SUI | Sui Mainnet | **Sui Testnet** |
| TON | TON Mainnet | **TON Testnet** |
| SOLANA | Solana Mainnet | **Solana Devnet** |

### Testnet Contract Addresses

Our 0xMart payment contracts are deployed on these testnets:

```bash
# EVM Testnets
Ethereum Sepolia:    0xfFfD214731036E826A283d1600c967771fDdABAe
Polygon Amoy:        0xfFfD214731036E826A283d1600c967771fDdABAe
Optimism Sepolia:    0xfFfD214731036E826A283d1600c967771fDdABAe
Arbitrum Sepolia:    0xfFfD214731036E826A283d1600c967771fDdABAe
Base Sepolia:        0xfFfD214731036E826A283d1600c967771fDdABAe
Avalanche Fuji:      0xfFfD214731036E826A283d1600c967771fDdABAe

# Non-EVM Testnets
SUI Testnet:         0xd3c5601b3110dad07821c27050dfc873a04f48e172463fba7cca5a5aa2b489cd
TON Testnet:         kQC4Gn_21IQVPj3ey44TKG3PA1ciL-XjeMmYbcO7jnAmKard
Solana Devnet:       Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
```

---

## Testing Best Practices

### 1. **Always Use Testnet Mode for Integration**

```javascript
// ✅ CORRECT: Testnet mode
const apiKey = await createApiKey({
  name: "Development API Key",
  isTestnetMode: true,  // Free testing!
  subscriptionTier: "free"
});

// ❌ WRONG: Mainnet mode during development
const apiKey = await createApiKey({
  name: "Development API Key",
  isTestnetMode: false,  // This uses REAL MONEY!
  subscriptionTier: "free"
});
```

### 2. **Test All Payment States**

Simulate different scenarios:

- ✅ Successful payment
- ✅ Insufficient payment (send less than required)
- ✅ Overpayment (send more than required)
- ✅ Expired payment (wait 24 hours)
- ✅ Wrong network payment
- ✅ Webhook failures and retries

### 3. **Verify Webhook Signatures**

Always verify webhooks in your test environment:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Use in your webhook handler
app.post('/webhooks/0xmart', (req, res) => {
  const signature = req.headers['x-0xmart-signature'];
  const isValid = verifyWebhookSignature(req.body, signature, WEBHOOK_SECRET);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook...
});
```

### 4. **Monitor Rate Limits**

Free tier limits (testnet mode):
- **30 requests/minute**
- **1,000 requests/day**
- **1,000 requests/month**

Check headers in responses:
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 27
X-RateLimit-Reset: 1640000000
```

### 5. **Use Idempotency Keys**

Prevent duplicate orders:

```javascript
const idempotencyKey = `${userId}-${productId}-${Date.now()}`;

const response = await fetch('https://api.0xmart.com/api/v1/payment/initiate', {
  method: 'POST',
  headers: {
    'X-API-Key': 'xmart_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    productId: 'product-123',
    email: 'customer@example.com',
    phone: '+1234567890',
    idempotencyKey  // Prevents duplicate orders
  })
});
```

---

## Troubleshooting

### Common Issues

#### 1. **"Invalid API Key" Error**

```json
{
  "statusCode": 401,
  "message": "Invalid API key"
}
```

**Solutions:**
- ✅ Check that API key starts with `xmart_`
- ✅ Verify you're using the correct header: `X-API-Key`
- ✅ Ensure API key is active (not revoked/expired)
- ✅ Check for typos or extra spaces

#### 2. **"Network Not Supported" Error**

```json
{
  "statusCode": 400,
  "message": "Network ETHEREUM not supported by this API key"
}
```

**Solution:**
- ✅ Check `supportedNetworks` when creating the API key
- ✅ Only use networks you specified during key creation

#### 3. **Payment Not Detected**

**Checklist:**
- ✅ Are you sending to the correct testnet? (e.g., Polygon Amoy, not Polygon Mainnet)
- ✅ Did you send the exact amount specified?
- ✅ Is the transaction confirmed? (Wait for block confirmations)
- ✅ Check transaction on testnet block explorer

#### 4. **Testnet Tokens Not Arriving**

**Solutions:**
- ✅ Wait 1-2 minutes (testnet faucets can be slow)
- ✅ Try a different faucet from the list
- ✅ Check faucet cooldown period (usually 24 hours)
- ✅ Verify wallet address is correct

#### 5. **Webhook Not Received**

**Debugging steps:**
1. Check webhook URL is publicly accessible
2. Verify HTTPS (most testnets require HTTPS)
3. Check webhook logs in your API key dashboard
4. Test with [webhook.site](https://webhook.site) temporarily
5. Verify webhook signature validation isn't rejecting requests

---

## Switching to Production

Once testing is complete, create a new API key with `isTestnetMode: false`:

```json
POST /api/v1/api-keys

{
  "name": "Production API Key",
  "isTestnetMode": false,  // ⚠️ Uses REAL mainnet networks
  "subscriptionTier": "pro",
  "supportedNetworks": ["POLYGON", "ARBITRUM", "BASE"],
  "webhookUrl": "https://your-production-app.com/webhooks/0xmart"
}
```

> ⚠️ **Important Differences:**
> - Real cryptocurrency transactions
> - Real money required
> - Higher gas fees on mainnet
> - Transactions are irreversible
> - Consider upgrading to Pro/Enterprise tier for production

---

## Need Help?

- 📧 Email: support@0xmart.com
- 💬 Discord: [discord.gg/0xmart](https://discord.gg/0xmart)
- 📖 Full API Docs: [docs.0xmart.com](https://docs.0xmart.com)
- 🐛 Report Issues: [github.com/0xmart/issues](https://github.com/0xmart/issues)

---

**Last Updated:** December 2025
**API Version:** v1
**Testnet Supported:** ✅ Yes
