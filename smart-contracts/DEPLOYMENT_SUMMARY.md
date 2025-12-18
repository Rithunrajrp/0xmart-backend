# 0xMart Smart Contract Deployment Summary

Generated: 2025-12-18

## ✅ EVM Testnets - DEPLOYED SUCCESSFULLY

### 1. Ethereum Sepolia
- **Network:** Sepolia (Chain ID: 11155111)
- **Payment Contract:** `0xfFfD214731036E826A283d1600c967771fDdABAe`
- **Hot Wallet:** `0x0b8338c719E6b9627E27b9D984d72b5278b17F10`
- **Status:** ✅ Deployed & Configured

**Mock Tokens:**
- **USDT:** `0x78B3EeCea6a1f17a5552566619F3570C58C87930` (6 decimals)
- **USDC:** `0x33B88bB907eE71cBA2c95666bb5b807b49a14d80` (6 decimals)
- **DAI:** `0x467C1A0F1B3330681d69eA154904ee70bbeA9e13` (18 decimals)
- **BUSD:** `0x902d76b5083a2368Fe6c758C5E00F3325E55A22A` (18 decimals)

**Explorer:** https://sepolia.etherscan.io/address/0xfFfD214731036E826A283d1600c967771fDdABAe

---

### 2. Polygon Amoy (Mumbai Deprecated)
- **Network:** Polygon Amoy (Chain ID: 80002)
- **Payment Contract:** `0xfFfD214731036E826A283d1600c967771fDdABAe`
- **Hot Wallet:** `0x0b8338c719E6b9627E27b9D984d72b5278b17F10`
- **Status:** ✅ Deployed & Configured

**Mock Tokens:**
- **USDT:** `0x78B3EeCea6a1f17a5552566619F3570C58C87930` (6 decimals)
- **USDC:** `0x33B88bB907eE71cBA2c95666bb5b807b49a14d80` (6 decimals)
- **DAI:** `0x467C1A0F1B3330681d69eA154904ee70bbeA9e13` (18 decimals)
- **BUSD:** `0x902d76b5083a2368Fe6c758C5E00F3325E55A22A` (18 decimals)

**Explorer:** https://amoy.polygonscan.com/address/0xfFfD214731036E826A283d1600c967771fDdABAe

---

### 3. Avalanche Fuji
- **Network:** Avalanche Fuji (Chain ID: 43113)
- **Payment Contract:** `0xfFfD214731036E826A283d1600c967771fDdABAe`
- **Hot Wallet:** `0x0b8338c719E6b9627E27b9D984d72b5278b17F10`
- **Status:** ✅ Deployed & Configured

**Mock Tokens:**
- **USDT:** `0x78B3EeCea6a1f17a5552566619F3570C58C87930` (6 decimals)
- **USDC:** `0x33B88bB907eE71cBA2c95666bb5b807b49a14d80` (6 decimals)
- **DAI:** `0x467C1A0F1B3330681d69eA154904ee70bbeA9e13` (18 decimals)
- **BUSD:** `0x902d76b5083a2368Fe6c758C5E00F3325E55A22A` (18 decimals)

**Explorer:** https://testnet.snowtrace.io/address/0xfFfD214731036E826A283d1600c967771fDdABAe

---

## ⏸️ EVM Testnets - PENDING (Need Funding)

### 4. Arbitrum Sepolia
- **Network:** Arbitrum Sepolia (Chain ID: 421614)
- **Status:** ⏸️ Awaiting testnet ETH funding
- **Faucet:** https://www.alchemy.com/faucets/arbitrum-sepolia

### 5. Optimism Sepolia
- **Network:** Optimism Sepolia (Chain ID: 11155420)
- **Status:** ⏸️ Awaiting testnet ETH funding
- **Faucet:** https://www.alchemy.com/faucets/optimism-sepolia

### 6. Base Sepolia
- **Network:** Base Sepolia (Chain ID: 84532)
- **Status:** ⏸️ Awaiting testnet ETH funding
- **Faucet:** https://www.alchemy.com/faucets/base-sepolia

### 7. BSC Testnet
- **Network:** BSC Testnet (Chain ID: 97)
- **Status:** ⏸️ Awaiting testnet BNB funding
- **Faucet:** https://testnet.bnbchain.org/faucet-smart

---

## 📋 Non-EVM Networks - READY FOR DEPLOYMENT

### Sui Testnet
- **Status:** 🔧 Ready for manual deployment
- **Contract:** `smart-contracts/sui/sources/oxmart_payment.move`
- **Documentation:** `smart-contracts/sui/README.md`

**Prerequisites:**
1. Install Sui CLI:
   ```bash
   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui
   ```

2. Create Sui wallet:
   ```bash
   sui client new-address ed25519
   ```

3. Get testnet SUI:
   - Join Sui Discord: https://discord.gg/sui
   - Request in #testnet-faucet
   - Or: `sui client faucet`

**Deployment Steps:**
```bash
cd smart-contracts/sui

# Build
sui move build

# Deploy
sui client publish --gas-budget 100000000

# Note the Package ID and SharedObject ID from output
# Update .env with:
# SUI_PACKAGE_ID=<package_id>
# SUI_CONFIG_OBJECT_ID=<config_object_id>
```

---

### TON Testnet
- **Status:** 🔧 Ready for manual deployment
- **Contract:** `smart-contracts/ton/contracts/oxmart_payment.tact`
- **Documentation:** `smart-contracts/ton/README.md`

**Prerequisites:**
1. Install dependencies:
   ```bash
   cd smart-contracts/ton
   npm install
   ```

2. Generate TON wallet (if needed):
   ```bash
   npm run deploy:testnet
   # Save the mnemonic to .env
   ```

3. Get testnet TON:
   - Message @testgiver_ton_bot on Telegram with your address

**Deployment Steps:**
```bash
cd smart-contracts/ton

# Build contract
npm run build

# Deploy (follow instructions in build output)
npm run deploy:testnet

# After deployment, set TON_CONTRACT_ADDRESS in .env
# Then add supported jettons:
npm run add-tokens:testnet
```

---

### Solana Devnet
- **Status:** ❌ No Solana contracts found
- **Note:** Solana support not yet implemented

**To Add Solana Support:**
1. Create Solana program using Anchor framework
2. Add deployment scripts
3. Deploy to devnet

---

## 📝 Deployment Configuration

### Deployer Wallet
- **Address:** `0x0b8338c719E6b9627E27b9D984d72b5278b17F10`
- **Private Key:** Stored in `.env` (DEPLOYER_PRIVATE_KEY)
- **Mnemonic:** `acid victory diagram edit treat weapon once review foam crowd fancy screen`

⚠️ **SECURITY WARNING:** This is a testnet-only wallet. NEVER use these credentials for mainnet!

### Hot Wallet
- **Address:** `0x0b8338c719E6b9627E27b9D984d72b5278b17F10`
- **Purpose:** Receives all payments from smart contracts
- **Note:** Using same address as deployer for testnet simplicity

---

## 🎯 Next Steps

### Immediate Actions:

1. **Fund Remaining EVM Testnets:**
   - Get Sepolia ETH for Arbitrum, Optimism, Base (same address works for all)
   - Get BNB testnet tokens for BSC
   - Run deployments once funded

2. **Deploy to Sui:**
   - Install Sui CLI
   - Build and publish contract
   - Configure supported tokens

3. **Deploy to TON:**
   - Build Tact contract
   - Deploy to testnet
   - Add supported jettons

4. **Update Backend .env:**
   After all deployments, update the main `.env` file with contract addresses:
   ```env
   # Testnet Contract Addresses
   ETHEREUM_SEPOLIA_CONTRACT_ADDRESS=0xfFfD214731036E826A283d1600c967771fDdABAe
   POLYGON_AMOY_CONTRACT_ADDRESS=0xfFfD214731036E826A283d1600c967771fDdABAe
   AVALANCHE_FUJI_CONTRACT_ADDRESS=0xfFfD214731036E826A283d1600c967771fDdABAe
   # ... add others as deployed
   ```

### Testing:

1. **Test Payment Flow:**
   - Mint test tokens to a test user
   - Approve payment contract to spend tokens
   - Call `processPayment` function
   - Verify tokens transferred to hot wallet

2. **Test Events:**
   - Monitor `PaymentReceived` events
   - Ensure backend processes deposits correctly

3. **Test Admin Functions:**
   - Update hot wallet
   - Adjust platform fees
   - Pause/unpause contract

---

## 📚 Resources

### Deployment Files
- Deployment info: `smart-contracts/deployments/*.json`
- Mock tokens: `smart-contracts/deployments/mock-tokens-*.json`

### Contract Code
- EVM: `smart-contracts/contracts/OxMartPayment.sol`
- Sui: `smart-contracts/sui/sources/oxmart_payment.move`
- TON: `smart-contracts/ton/contracts/oxmart_payment.tact`

### Scripts
- Deploy: `smart-contracts/scripts/deploy.js`
- Deploy tokens: `smart-contracts/scripts/deployMockTokens.js`
- Add tokens: `smart-contracts/scripts/addTokensFromDeployment.js`

---

## ✅ Deployment Checklist

- [x] Sepolia - Deployed & Configured
- [x] Polygon Amoy - Deployed & Configured
- [x] Avalanche Fuji - Deployed & Configured
- [ ] Arbitrum Sepolia - Pending funding
- [ ] Optimism Sepolia - Pending funding
- [ ] Base Sepolia - Pending funding
- [ ] BSC Testnet - Pending funding
- [ ] Sui Testnet - Ready for deployment
- [ ] TON Testnet - Ready for deployment
- [ ] Solana Devnet - Not implemented

---

**Deployment Date:** December 18, 2025
**Deployer:** 0xMart Team
**Network:** Testnets Only
**Purpose:** Development & Testing
