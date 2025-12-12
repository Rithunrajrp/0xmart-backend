# Testnet Deployment - Ready to Execute

**Status**: ✅ All prerequisites complete
**Date**: December 4, 2025

---

## 🚀 Quick Start (5 Steps)

### Step 1: Set Up Environment Variables

1. Copy the example file:
```bash
cd 0xmart-backend/smart-contracts
cp .env.example .env
```

2. Edit `.env` and fill in these **required** fields:

```env
# Your wallet private key (for testnet only!)
DEPLOYER_PRIVATE_KEY=0x...  # ⚠️ Never use mainnet key!

# Address that will receive payments
HOT_WALLET_ADDRESS=0x...

# Get free API key from https://alchemy.com or https://infura.io
ETHEREUM_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Optional: For contract verification
ETHERSCAN_API_KEY=...  # Get from https://etherscan.io/apis
```

### Step 2: Get Testnet ETH

Visit any of these faucets to get free Sepolia ETH:
- https://sepoliafaucet.com/ (recommended)
- https://faucet.quicknode.com/ethereum/sepolia
- https://www.alchemy.com/faucets/ethereum-sepolia

**Amount needed**: 0.5 ETH (will last for many deployments)

### Step 3: Check Your Balance

```bash
npx hardhat run scripts/checkBalance.js --network sepolia
```

**Expected output**:
```
Deployer address: 0x...
Balance: 0.5 ETH
Network: sepolia
Chain ID: 11155111

✅ Sufficient balance for deployment

🔥 Hot Wallet Address: 0x...
```

### Step 4: Deploy the Contract

```bash
npm run deploy:sepolia
```

**Expected output**:
```
Starting deployment...

Deploying contracts with account: 0x...
Account balance: 0.5 ETH

Hot Wallet Address: 0x...
Deploying OxMartPayment contract...

✅ OxMartPayment deployed to: 0xABCD1234...
Network: sepolia
Chain ID: 11155111

📄 Deployment info saved to: ./deployments/sepolia-11155111.json

✨ Deployment complete!
```

**🎉 Contract deployed! Copy the contract address (0xABCD...)**

### Step 5: Deploy Mock Tokens (for testing)

```bash
npx hardhat run scripts/deployMockTokens.js --network sepolia
```

This will deploy 4 test tokens (USDT, USDC, DAI, BUSD) and save their addresses.

Then add them to your payment contract:
```bash
npm run tokens:sepolia
```

---

## ✅ Verification Checklist

After deployment, verify everything works:

### 1. Check Deployment Files

```bash
ls deployments/
```

You should see:
- `sepolia-11155111.json` - Contract deployment info
- `mock-tokens-sepolia-11155111.json` - Token addresses

### 2. View Contract on Etherscan

Visit: `https://sepolia.etherscan.io/address/YOUR_CONTRACT_ADDRESS`

You should see:
- Contract balance: 0 ETH
- Creator: Your deployer address
- Transactions: 1 (contract creation)

### 3. Verify Contract Source Code (Optional but Recommended)

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> "<HOT_WALLET_ADDRESS>"
```

Example:
```bash
npx hardhat verify --network sepolia 0xABCD1234... "0xYourHotWallet..."
```

After verification, the contract page will show the source code and allow interaction via the UI.

### 4. Test Contract Functions

Visit the verified contract on Etherscan and try:

**Read Contract** (no gas needed):
- `hotWallet()` - Should return your hot wallet address
- `owner()` - Should return your deployer address
- `platformFeeBps()` - Should return 0
- `supportedTokens(tokenAddress)` - Check if tokens were added

**Write Contract** (requires wallet connection):
- Connect your wallet
- Try `addSupportedToken()` with one of your mock token addresses
- Try `pause()` and `unpause()` to test emergency functions

---

## 📊 What Was Created

### Smart Contract
- **Name**: OxMartPayment
- **Version**: 1.0.0
- **Solidity**: 0.8.20
- **Features**:
  - Single & batch payments
  - Commission tracking (5%)
  - Platform fees (0%, configurable)
  - Hot wallet management
  - Emergency pause
  - Access control

### Test Tokens (if deployed)
- **USDT**: 6 decimals, 1M minted to deployer
- **USDC**: 6 decimals, 1M minted to deployer
- **DAI**: 18 decimals, 1M minted to deployer
- **BUSD**: 18 decimals, 1M minted to deployer

### Deployment Artifacts
- Contract address stored in `deployments/sepolia-11155111.json`
- Token addresses stored in `deployments/mock-tokens-sepolia-11155111.json`
- Can be imported into backend for integration

---

## 🧪 Testing the Deployment

### Test 1: Read Contract State

Create `scripts/testDeployment.js`:

```javascript
const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "YOUR_DEPLOYED_ADDRESS";
  const payment = await ethers.getContractAt("OxMartPayment", contractAddress);

  console.log("Hot Wallet:", await payment.hotWallet());
  console.log("Owner:", await payment.owner());
  console.log("Platform Fee:", (await payment.platformFeeBps()).toString(), "bps");

  // Check if USDT is supported
  const usdtAddress = "YOUR_USDT_ADDRESS";
  console.log("USDT Supported:", await payment.supportedTokens(usdtAddress));
}

main().catch(console.error);
```

Run:
```bash
npx hardhat run scripts/testDeployment.js --network sepolia
```

### Test 2: Make a Test Payment

```javascript
// scripts/testPayment.js
const { ethers } = require("hardhat");

async function main() {
  const [buyer] = await ethers.getSigners();

  const paymentAddress = "YOUR_CONTRACT_ADDRESS";
  const payment = await ethers.getContractAt("OxMartPayment", paymentAddress);

  const usdtAddress = "YOUR_USDT_ADDRESS";
  const usdt = await ethers.getContractAt("MockERC20", usdtAddress);

  // Approve payment
  const amount = ethers.parseUnits("100", 6); // 100 USDT
  await usdt.approve(paymentAddress, amount);
  console.log("✅ Approved 100 USDT");

  // Process payment
  const orderId = ethers.keccak256(ethers.toUtf8Bytes("test-order-1"));
  const tx = await payment.processPayment(
    orderId,
    usdtAddress,
    amount,
    "product-123",
    ethers.ZeroAddress, // No API key owner for test
    500 // 5% commission
  );

  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  console.log("✅ Payment processed!");
}

main().catch(console.error);
```

Run:
```bash
npx hardhat run scripts/testPayment.js --network sepolia
```

---

## 🐛 Troubleshooting

### Issue: "Insufficient funds"
**Solution**: Get more Sepolia ETH from faucets (Step 2)

### Issue: "Invalid address" in .env
**Solution**:
- Ensure DEPLOYER_PRIVATE_KEY starts with `0x`
- Ensure HOT_WALLET_ADDRESS is a valid Ethereum address (starts with `0x`, 42 chars)

### Issue: "Network sepolia not supported"
**Solution**: Check that `hardhat.config.js` has sepolia configuration and ETHEREUM_SEPOLIA_RPC_URL is set

### Issue: Contract verification fails
**Solution**:
1. Wait 1-2 minutes after deployment
2. Ensure ETHERSCAN_API_KEY is set in .env
3. Check constructor argument (hot wallet address) is correct
4. Try manual verification on Etherscan if automatic fails

### Issue: "Cannot find module 'hardhat'"
**Solution**:
```bash
cd 0xmart-backend/smart-contracts
npm install
```

### Issue: Mock tokens not deploying
**Solution**: Check you have enough Sepolia ETH (need ~0.1 ETH for 4 token contracts)

---

## 📝 What to Document

Save these details for backend integration:

```json
{
  "network": "sepolia",
  "chainId": 11155111,
  "contracts": {
    "OxMartPayment": "0xABC...",
    "USDT": "0xDEF...",
    "USDC": "0xGHI...",
    "DAI": "0xJKL...",
    "BUSD": "0xMNO..."
  },
  "hotWallet": "0xPQR...",
  "deployer": "0xSTU...",
  "deploymentDate": "2025-12-04",
  "blockNumber": 123456
}
```

---

## ⏭️ Next Steps After Deployment

### Immediate (Phase 1 remaining)
1. [ ] Deploy to additional testnets (Mumbai, BSC, etc.)
2. [ ] Test payment flows end-to-end
3. [ ] Monitor for any issues

### Phase 2: Backend Integration
1. [ ] Create smart contract module in NestJS
2. [ ] Add event listeners for PaymentReceived
3. [ ] Implement payment initiation API
4. [ ] Test backend → contract → backend flow

### Phase 3: Frontend Integration
1. [ ] Add ethers.js to web frontend
2. [ ] Create wallet connection UI
3. [ ] Implement payment flow UI
4. [ ] Test in browser with MetaMask

### Phase 4: Production
1. [ ] Get external audit
2. [ ] Deploy to mainnets
3. [ ] Transfer ownership to multi-sig
4. [ ] Launch!

---

## 🎓 Learning Resources

**Hardhat**:
- https://hardhat.org/tutorial
- https://hardhat.org/hardhat-runner/docs/guides/deploying

**Ethers.js**:
- https://docs.ethers.org/v6/
- https://docs.ethers.org/v6/api/contract/

**Sepolia Testnet**:
- Explorer: https://sepolia.etherscan.io/
- Faucets: Multiple available
- RPC: https://chainlist.org/chain/11155111

**OpenZeppelin**:
- https://docs.openzeppelin.com/contracts/
- https://wizard.openzeppelin.com/ (contract generator)

---

## ✨ You're Ready!

Everything is set up and ready to deploy:
- ✅ Smart contract written and tested (39 tests passing)
- ✅ 100% test coverage
- ✅ Deployment scripts ready
- ✅ Mock tokens for testing
- ✅ Helper scripts created
- ✅ Documentation complete

**Just follow the 5 steps above and you'll have a live testnet deployment in minutes!**

---

**Questions?**
- Check `DEPLOYMENT_GUIDE.md` for detailed info
- Check `TEST_RESULTS.md` for test coverage details
- Check `README.md` for project overview

Good luck! 🚀
