# Smart Contract Deployment Guide

## What Changed

Your 0xMart backend has been **successfully modified** to use smart contract payments instead of deposit addresses.

### Key Changes

| Component | Old Behavior | New Behavior |
|-----------|-------------|--------------|
| **Payment Method** | Customer manually sends tokens to deposit address | Customer's wallet automatically invoked to call smart contract |
| **Verification** | Backend polls blockchain for deposits | Instant verification via `PaymentProcessed` event |
| **API Response** | Returns deposit address | Returns smart contract parameters (address, ABI, function params) |
| **Client Integration** | Manual wallet interaction | Use provided widget OR custom Web3 code |
| **Commission** | Tracked in database | Enforced by smart contract |

---

## Files Modified

### Backend Changes

1. **`contracts/PaymentProcessor.sol`** (NEW)
   - Solidity smart contract for processing payments
   - Handles token transfers, commissions, and events
   - Prevents double-spending via `processedOrders` mapping

2. **`src/common/constants/contracts.ts`** (NEW)
   - Contract addresses per network
   - Stablecoin token addresses
   - Contract ABIs

3. **`src/modules/external-payment/external-payment.service.ts`** (MODIFIED)
   - `selectNetwork()` now returns smart contract parameters instead of deposit address
   - `verifyPaymentOnChain()` verifies `PaymentProcessed` event instead of direct transfers
   - Deprecated `getOrCreateDepositAddress()` and `createNewDepositAddress()`

4. **`src/modules/external-payment/external-payment.controller.ts`** (MODIFIED)
   - Updated Swagger documentation for smart contract response

### Widget & Documentation

5. **`public/widget/0xmart-payment.js`** (NEW)
   - JavaScript widget for third-party integrators
   - Handles wallet connection, token approval, contract calls
   - Zero Web3 knowledge required for integrators

6. **`public/widget/example.html`** (NEW)
   - Live demo and integration example
   - Shows how to use the widget

7. **`docs/SMART_CONTRACT_PAYMENT_GUIDE.md`** (NEW)
   - Complete integration guide
   - Architecture explanation
   - Code examples
   - Troubleshooting

---

## Next Steps: Deployment

### ⚠️ IMPORTANT: You Must Deploy Smart Contracts

The backend is ready, but you need to **deploy the smart contract** to each blockchain network before it works.

### Step 1: Install Hardhat

```bash
cd 0xmart-backend
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts
npx hardhat init
```

Choose "Create a TypeScript project" or "Create a JavaScript project"

### Step 2: Configure Hardhat

Edit `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    polygon: {
      url: process.env.POLYGON_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 137,
    },
    bsc: {
      url: process.env.BSC_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 56,
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 42161,
    },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 8453,
    },
    // Add more networks as needed
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY,
      bsc: process.env.BSCSCAN_API_KEY,
      arbitrum: process.env.ARBISCAN_API_KEY,
      base: process.env.BASESCAN_API_KEY,
    }
  }
};
```

### Step 3: Add Environment Variables

Add to your `.env`:

```bash
# Deployment wallet (NEVER commit this!)
DEPLOYER_PRIVATE_KEY=your_private_key_here

# Merchant address (receives payments)
MERCHANT_ADDRESS=0xYourMerchantWalletAddress

# Commission rate (500 = 5%)
COMMISSION_RATE=500

# Block explorer API keys (for verification)
POLYGONSCAN_API_KEY=your_key
BSCSCAN_API_KEY=your_key
ARBISCAN_API_KEY=your_key
BASESCAN_API_KEY=your_key
```

### Step 4: Create Deployment Script

Create `scripts/deploy.js`:

```javascript
const hre = require("hardhat");

async function main() {
  const merchantAddress = process.env.MERCHANT_ADDRESS;
  const commissionRate = process.env.COMMISSION_RATE || 500;

  console.log("Deploying PaymentProcessor...");
  console.log("Merchant:", merchantAddress);
  console.log("Commission Rate:", commissionRate / 100 + "%");

  const PaymentProcessor = await hre.ethers.getContractFactory("PaymentProcessor");
  const contract = await PaymentProcessor.deploy(merchantAddress, commissionRate);

  await contract.deployed();

  console.log("✅ PaymentProcessor deployed to:", contract.address);

  // Wait for a few block confirmations
  console.log("Waiting for block confirmations...");
  await contract.deployTransaction.wait(5);

  // Get network info
  const network = await hre.ethers.provider.getNetwork();
  console.log("Network:", network.name, "(Chain ID:", network.chainId + ")");

  // Add supported tokens based on network
  const tokens = getTokensForNetwork(network.chainId);

  for (const [symbol, address] of Object.entries(tokens)) {
    if (address !== '0x0000000000000000000000000000000000000000') {
      console.log(`Adding ${symbol} token: ${address}`);
      const tx = await contract.addSupportedToken(address);
      await tx.wait();
    }
  }

  console.log("\n✅ Deployment complete!");
  console.log("\n📝 Add this to your .env file:");
  console.log(`${getNetworkEnvVar(network.chainId)}=${contract.address}`);

  // Verify on block explorer
  if (process.env.VERIFY_CONTRACT === 'true') {
    console.log("\nVerifying contract on block explorer...");
    try {
      await hre.run("verify:verify", {
        address: contract.address,
        constructorArguments: [merchantAddress, commissionRate],
      });
      console.log("✅ Contract verified!");
    } catch (error) {
      console.log("⚠️  Verification failed:", error.message);
    }
  }
}

function getTokensForNetwork(chainId) {
  const tokens = {
    137: { // Polygon
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    },
    56: { // BSC
      USDT: '0x55d398326f99059fF775485246999027B3197955',
      USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      DAI: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
      BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    },
    42161: { // Arbitrum
      USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    },
    8453: { // Base
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    },
  };

  return tokens[chainId] || {};
}

function getNetworkEnvVar(chainId) {
  const networks = {
    137: 'POLYGON_PAYMENT_CONTRACT',
    56: 'BSC_PAYMENT_CONTRACT',
    42161: 'ARBITRUM_PAYMENT_CONTRACT',
    8453: 'BASE_PAYMENT_CONTRACT',
    10: 'OPTIMISM_PAYMENT_CONTRACT',
    43114: 'AVALANCHE_PAYMENT_CONTRACT',
    1: 'ETHEREUM_PAYMENT_CONTRACT',
  };

  return networks[chainId] || 'UNKNOWN_PAYMENT_CONTRACT';
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Step 5: Deploy to Networks

```bash
# Deploy to Polygon
npx hardhat run scripts/deploy.js --network polygon

# Deploy to BSC
npx hardhat run scripts/deploy.js --network bsc

# Deploy to Arbitrum
npx hardhat run scripts/deploy.js --network arbitrum

# Deploy to Base
npx hardhat run scripts/deploy.js --network base
```

After each deployment, **copy the contract address to your `.env`**:

```bash
POLYGON_PAYMENT_CONTRACT=0x1234567890123456789012345678901234567890
BSC_PAYMENT_CONTRACT=0xABCDEF1234567890123456789012345678901234
ARBITRUM_PAYMENT_CONTRACT=0x9876543210987654321098765432109876543210
BASE_PAYMENT_CONTRACT=0xFEDCBA0987654321098765432109876543210987
```

### Step 6: Test the Integration

1. Restart your backend:
```bash
npm run start:dev
```

2. Open the example widget:
```
http://localhost:8000/widget/example.html
```

3. Test a payment with real wallet on testnet first!

---

## Testing on Testnets (Recommended)

Before deploying to mainnet, test on testnets:

### Get Testnet Tokens

1. **Polygon Mumbai Testnet**
   - Faucet: https://faucet.polygon.technology/
   - Test USDC: Deploy your own or use existing

2. **BSC Testnet**
   - Faucet: https://testnet.bnbchain.org/faucet-smart

3. **Arbitrum Sepolia**
   - Faucet: https://faucet.quicknode.com/arbitrum/sepolia

### Deploy to Testnet

```bash
# Polygon Mumbai
npx hardhat run scripts/deploy.js --network mumbai

# BSC Testnet
npx hardhat run scripts/deploy.js --network bscTestnet

# Arbitrum Sepolia
npx hardhat run scripts/deploy.js --network arbitrumSepolia
```

---

## Verifying Contracts

To make your contract visible on block explorers:

```bash
# Set environment variable
export VERIFY_CONTRACT=true

# Then deploy
npx hardhat run scripts/deploy.js --network polygon
```

Or manually verify after deployment:

```bash
npx hardhat verify --network polygon \
  0xYourContractAddress \
  "0xMerchantAddress" \
  500
```

---

## Cost Estimates

### Deployment Costs (One-time)

| Network | Estimated Gas | Cost (USD) |
|---------|--------------|------------|
| Polygon | ~2M gas | $0.50 - $2 |
| BSC | ~2M gas | $1 - $5 |
| Arbitrum | ~2M gas | $5 - $15 |
| Base | ~2M gas | $0.50 - $2 |
| Ethereum | ~2M gas | $50 - $200+ |

### Per-Transaction Costs

| Network | Estimated Gas | Customer Pays |
|---------|--------------|---------------|
| Polygon | ~150k gas | $0.01 - $0.05 |
| BSC | ~150k gas | $0.05 - $0.20 |
| Arbitrum | ~150k gas | $0.10 - $0.50 |
| Base | ~150k gas | $0.01 - $0.05 |

---

## Production Checklist

Before going live:

- [ ] Deploy contracts to all required networks
- [ ] Add contract addresses to `.env`
- [ ] Verify contracts on block explorers
- [ ] Test widget on testnet
- [ ] Test full payment flow with real wallet
- [ ] Set correct merchant address
- [ ] Set appropriate commission rate
- [ ] Update widget URL in production (`apiBaseUrl`)
- [ ] Enable CORS for widget domain
- [ ] Monitor first few transactions
- [ ] Set up withdrawal process for commissions

---

## Withdrawal of Commissions

Commissions accumulate in the smart contract. To withdraw:

### Option 1: Via Etherscan

1. Go to your contract on Polygonscan/BSCscan
2. Connect wallet (must be owner)
3. Call `withdrawCommission(tokenAddress, recipientAddress)`

### Option 2: Via Script

Create `scripts/withdraw-commission.js`:

```javascript
const hre = require("hardhat");

async function main() {
  const contractAddress = process.env.POLYGON_PAYMENT_CONTRACT;
  const tokenAddress = "0xUSDTAddress";
  const recipient = process.env.COMMISSION_RECIPIENT;

  const contract = await hre.ethers.getContractAt("PaymentProcessor", contractAddress);

  const balance = await contract.getCommissionBalance(tokenAddress);
  console.log("Commission balance:", hre.ethers.utils.formatUnits(balance, 6), "USDT");

  if (balance.gt(0)) {
    const tx = await contract.withdrawCommission(tokenAddress, recipient);
    await tx.wait();
    console.log("✅ Commission withdrawn!");
  }
}

main().catch(console.error);
```

Run:
```bash
npx hardhat run scripts/withdraw-commission.js --network polygon
```

---

## Troubleshooting

### "Contract not deployed"
- Check `.env` has correct contract address
- Verify network is correct
- Restart backend after updating `.env`

### "Insufficient funds for gas"
- Deployer wallet needs native tokens (MATIC, BNB, ETH)
- Get from faucet or exchange

### "Token not supported"
- Check token address in `contracts.ts` matches network
- Run `addSupportedToken()` if missed during deployment

### "Transaction failed"
- Check customer has enough tokens
- Check customer approved token spending
- Check gas price is reasonable

---

## Support & Resources

- **Hardhat Docs:** https://hardhat.org/docs
- **OpenZeppelin Contracts:** https://docs.openzeppelin.com/contracts
- **Ethers.js Docs:** https://docs.ethers.org/
- **Your Integration Guide:** `docs/SMART_CONTRACT_PAYMENT_GUIDE.md`
- **Widget Example:** `public/widget/example.html`

---

## Summary

✅ **Backend Modified** - Returns smart contract parameters instead of deposit addresses

✅ **Widget Created** - Third-party integrators can use it with 3 lines of code

✅ **Verification Updated** - Backend verifies `PaymentProcessed` events

🔜 **Next:** Deploy smart contracts to each network and test!

