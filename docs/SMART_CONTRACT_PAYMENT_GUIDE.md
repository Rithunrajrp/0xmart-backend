# Smart Contract Payment Integration Guide

## Overview

0xMart now uses **smart contract-based payments** instead of deposit addresses. This provides:

- ✅ **Instant verification** - Payments verified immediately via blockchain events
- ✅ **No manual transfers** - Customers interact directly with smart contracts
- ✅ **Automatic commission tracking** - Built into the smart contract
- ✅ **Better UX** - Single transaction approval in wallet
- ✅ **Easy integration** - Use our payment widget (no Web3 knowledge required)

---

## Architecture

### Old Model (Deposit Address)
```
Customer → Manually sends tokens → Deposit Address → Backend monitors blockchain → Confirms payment
```

### New Model (Smart Contract)
```
Customer → Wallet popup → Smart Contract (payForProduct) → Event emitted → Backend instantly verifies
```

---

## Payment Flow

### 1. Backend Returns Smart Contract Parameters

When you call `/api/v1/payment/select-network`:

```json
{
  "success": true,
  "payment": {
    "contractAddress": "0x1234...ABCD",
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "amount": "54.99",
    "amountWei": "54990000",
    "currency": "USDT",
    "network": "POLYGON",
    "method": "payForProduct",
    "params": {
      "orderId": "EXT-1234567890-0001",
      "productId": "P123",
      "token": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      "amount": "54990000"
    },
    "abi": [...],
    "tokenAbi": [...],
    "estimatedGas": "200000"
  }
}
```

### 2. Client Invokes Wallet (Two Options)

#### Option A: Use Our Payment Widget (Recommended)

**Zero Web3 code required!** Just include our widget:

```html
<script src="https://api.0xmart.com/widget/0xmart-payment.js"></script>

<button onclick="payWithCrypto()">Pay with Crypto</button>

<script>
function payWithCrypto() {
  OxMartPayment.pay({
    apiKey: 'your_api_key',
    apiSecret: 'your_api_secret',
    orderId: 'order_123',
    onSuccess: (txHash) => {
      alert('Payment successful!');
    },
    onError: (error) => {
      alert('Payment failed: ' + error.message);
    }
  });
}
</script>
```

**What the widget does:**
1. Fetches payment details from your backend
2. Connects to customer's wallet (MetaMask, etc.)
3. Checks network and switches if needed
4. Approves token spending (if needed)
5. Calls `contract.payForProduct()`
6. Waits for confirmation
7. Notifies your backend

---

#### Option B: Custom Web3 Integration

If you want full control, implement it yourself:

```javascript
import { ethers } from 'ethers';

async function payWithWeb3(paymentDetails) {
  // 1. Connect wallet
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = provider.getSigner();

  // 2. Check/approve token
  const tokenContract = new ethers.Contract(
    paymentDetails.tokenAddress,
    paymentDetails.tokenAbi,
    signer
  );

  const allowance = await tokenContract.allowance(
    await signer.getAddress(),
    paymentDetails.contractAddress
  );

  if (allowance.lt(paymentDetails.amountWei)) {
    const approveTx = await tokenContract.approve(
      paymentDetails.contractAddress,
      paymentDetails.amountWei
    );
    await approveTx.wait();
  }

  // 3. Call payment contract
  const paymentContract = new ethers.Contract(
    paymentDetails.contractAddress,
    paymentDetails.abi,
    signer
  );

  const tx = await paymentContract.payForProduct(
    paymentDetails.params.orderId,
    paymentDetails.params.productId,
    paymentDetails.params.token,
    paymentDetails.params.amount
  );

  const receipt = await tx.wait();

  // 4. Confirm with backend
  await fetch('/api/v1/payment/confirm', {
    method: 'POST',
    headers: {
      'X-API-Key': 'your_api_key',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orderId: paymentDetails.params.orderId,
      txHash: tx.hash
    })
  });

  return tx.hash;
}
```

---

### 3. Backend Verifies Transaction

When you call `/api/v1/payment/confirm`:

```javascript
// Backend verifies:
// 1. Transaction succeeded
// 2. Sent to correct contract
// 3. PaymentProcessed event emitted
// 4. Order ID matches
// 5. Amount matches

// If verified, order status → PAYMENT_CONFIRMED
```

---

## Smart Contract Details

### Contract Address (Per Network)

Set these in your `.env`:

```bash
# Polygon
POLYGON_PAYMENT_CONTRACT=0x1234567890123456789012345678901234567890

# BSC
BSC_PAYMENT_CONTRACT=0x1234567890123456789012345678901234567890

# Arbitrum
ARBITRUM_PAYMENT_CONTRACT=0x1234567890123456789012345678901234567890

# ... etc for each network
```

### Contract Function

```solidity
function payForProduct(
    string calldata orderId,      // "EXT-1234567890-0001"
    string calldata productId,    // "P123"
    address token,                // USDT/USDC token address
    uint256 amount                // Amount in wei (e.g., 54990000 for 54.99 USDT)
) external nonReentrant whenNotPaused
```

### Events Emitted

```solidity
event PaymentProcessed(
    string indexed orderId,
    address indexed customer,
    address indexed token,
    uint256 amount,
    uint256 commission,
    address merchant,
    uint256 timestamp
);
```

Backend listens for this event to verify payment.

---

## Deploying Smart Contracts

### Prerequisites

```bash
npm install --save-dev hardhat @openzeppelin/contracts
```

### Deploy Script

Create `scripts/deploy-payment-contract.js`:

```javascript
const hre = require("hardhat");

async function main() {
  const merchantAddress = "0xYourMerchantAddress";
  const commissionRate = 500; // 5% = 500 basis points

  const PaymentProcessor = await hre.ethers.getContractFactory("PaymentProcessor");
  const contract = await PaymentProcessor.deploy(merchantAddress, commissionRate);

  await contract.deployed();

  console.log("PaymentProcessor deployed to:", contract.address);

  // Add supported tokens
  const USDT = "0x..."; // Token address on this network
  const USDC = "0x...";

  await contract.addSupportedToken(USDT);
  await contract.addSupportedToken(USDC);

  console.log("Supported tokens added");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Deploy to Networks

```bash
# Polygon
npx hardhat run scripts/deploy-payment-contract.js --network polygon

# BSC
npx hardhat run scripts/deploy-payment-contract.js --network bsc

# Arbitrum
npx hardhat run scripts/deploy-payment-contract.js --network arbitrum
```

Copy the deployed addresses to your `.env` file.

---

## Testing

### Test Widget Integration

1. Start your backend: `npm run start:dev`
2. Open: `http://localhost:8000/widget/example.html`
3. Fill in your API key, secret, and order ID
4. Click "Pay with Crypto"
5. Approve in MetaMask
6. Payment completes!

### Test API Directly

```bash
# 1. Initiate payment
curl -X POST http://localhost:8000/api/v1/payment/initiate \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "P123",
    "phone": "+1234567890",
    "email": "customer@example.com",
    "stablecoinType": "USDT",
    "network": "POLYGON"
  }'

# 2. Submit address (if needed)
curl -X POST http://localhost:8000/api/v1/payment/submit-address \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_xxx",
    "fullName": "John Doe",
    "addressLine1": "123 Main St",
    "city": "New York",
    "postalCode": "10001",
    "country": "USA"
  }'

# 3. Select network (get smart contract params)
curl -X POST http://localhost:8000/api/v1/payment/select-network \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_xxx",
    "network": "POLYGON"
  }'

# Response contains contractAddress, tokenAddress, abi, etc.

# 4. Customer uses wallet to call contract.payForProduct()

# 5. Confirm payment
curl -X POST http://localhost:8000/api/v1/payment/confirm \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_xxx",
    "txHash": "0xabc123..."
  }'
```

---

## Troubleshooting

### "Payment contract not deployed on [NETWORK]"

**Solution:** Deploy the smart contract to that network and add the address to `.env`

```bash
POLYGON_PAYMENT_CONTRACT=0xYourContractAddress
```

### "Token not available on [NETWORK]"

**Solution:** Check `src/common/constants/contracts.ts` and ensure the token address is correct for that network.

### "PaymentProcessed event not found"

**Causes:**
- Transaction sent to wrong contract
- Wrong order ID used
- Transaction failed

**Solution:** Check the transaction on blockchain explorer (Polygonscan, etc.)

### "Please install MetaMask"

**Solution:** Customer needs a Web3 wallet. Guide them to install:
- MetaMask: https://metamask.io
- Trust Wallet: https://trustwallet.com
- Coinbase Wallet: https://wallet.coinbase.com

---

## Migration from Deposit Address Model

If you have existing integrations using deposit addresses:

### Backend Migration

✅ **Already done!** The new smart contract parameters are returned by `/payment/select-network`

### Frontend Migration

**Option 1:** Use our widget (easiest)
- Replace manual payment flow with `OxMartPayment.pay()`
- Widget handles everything

**Option 2:** Update existing Web3 code
- Instead of `eth_sendTransaction` to deposit address
- Use `contract.payForProduct()` with provided parameters

### Data Migration

Old `ExternalDepositAddress` records are kept for historical purposes but marked as `@deprecated` in the code.

---

## FAQ

**Q: Can customers still pay without the widget?**

A: Yes, they can manually:
1. Approve token spending to contract address
2. Call `payForProduct()` on the contract
3. Submit the transaction hash via your app

**Q: What if customer is on wrong network?**

A: The widget automatically prompts them to switch. Or reject the payment and ask them to switch manually.

**Q: How are commissions handled?**

A: The smart contract automatically:
- Deducts 5% commission
- Sends 95% to merchant
- Stores commission in contract
- You can withdraw via `withdrawCommission()`

**Q: Can I customize commission rate?**

A: Yes, when deploying the contract, set `commissionRate` parameter (in basis points: 500 = 5%)

**Q: Is this more expensive (gas fees)?**

A: Slightly higher than plain transfers, but:
- More secure
- Instant verification
- Better UX
- Worth the trade-off

**Q: Which networks are supported?**

A: Currently EVM networks:
- Ethereum
- Polygon
- BSC
- Arbitrum
- Optimism
- Avalanche
- Base

SUI and TON coming soon (different smart contract languages).

---

## Support

- **GitHub Issues:** https://github.com/0xmart/issues
- **API Docs:** http://localhost:8000/api/v1/docs
- **Example Widget:** http://localhost:8000/widget/example.html

