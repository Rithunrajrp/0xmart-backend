# 0xMart Smart Contracts - Testnet Deployment Guide

**Version:** 1.0
**Date:** March 18, 2026
**Status:** ✅ Ready for Testnet Deployment

This guide walks you through deploying the 0xMart smart contracts to testnets across all supported blockchain platforms.

---

## Prerequisites

### Required Tools

```bash
# Node.js & NPM
node --version  # Should be v18+
npm --version   # Should be v9+

# Hardhat (EVM contracts)
npm install --save-dev hardhat

# Solana CLI
solana --version  # Should be v1.18+
anchor --version  # Should be v0.29+

# Sui CLI
sui --version  # Should be latest
```

### Required Accounts & Funds

| Network | Testnet | Faucet | Min Balance |
|---------|---------|--------|-------------|
| Ethereum | Sepolia | [Sepolia Faucet](https://sepoliafaucet.com/) | 0.5 ETH |
| Polygon | Mumbai | [Mumbai Faucet](https://faucet.polygon.technology/) | 1 MATIC |
| BSC | BSC Testnet | [BSC Faucet](https://testnet.bnbchain.org/faucet-smart) | 0.5 BNB |
| Solana | Devnet | `solana airdrop 2` | 2 SOL |
| Sui | Testnet | [Sui Faucet](https://discord.gg/sui) | 10 SUI |

---

## Part 1: EVM Contracts Deployment

### 1.1 Setup Environment

Create `.env` file in `smart-contracts/` directory:

```bash
# Network RPC URLs
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545

# Deployer Private Key (TESTNET ONLY - use separate key!)
PRIVATE_KEY=your_testnet_private_key_here

# Block Explorers (for verification)
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
BSCSCAN_API_KEY=your_bscscan_api_key

# Deployment Parameters
HOT_WALLET_ADDRESS=0x_your_hot_wallet_address
PLATFORM_FEE_BPS=0  # 0% initially, can be updated later
```

**⚠️ SECURITY WARNING:**
- Never use mainnet private keys on testnet
- Never commit `.env` file to git (add to `.gitignore`)
- Use a dedicated testnet wallet with minimal funds

### 1.2 Update Hardhat Config

Verify `hardhat.config.js` has testnet configurations:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 11155111
    },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 80001
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 97
    }
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY,
      bscTestnet: process.env.BSCSCAN_API_KEY
    }
  }
};
```

### 1.3 Create Deployment Script

Create `scripts/deploy-testnet.js`:

```javascript
const hre = require("hardhat");

async function main() {
  console.log("Deploying to:", hre.network.name);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Get hot wallet address from env
  const hotWallet = process.env.HOT_WALLET_ADDRESS;
  if (!hotWallet) {
    throw new Error("HOT_WALLET_ADDRESS not set in .env");
  }

  console.log("\n📝 Deployment Parameters:");
  console.log("Hot Wallet:", hotWallet);
  console.log("Network:", hre.network.name);

  // Deploy OxMartPayment
  console.log("\n🚀 Deploying OxMartPayment...");
  const OxMartPayment = await hre.ethers.getContractFactory("OxMartPayment");
  const oxMartPayment = await OxMartPayment.deploy(hotWallet);
  await oxMartPayment.waitForDeployment();
  const oxMartPaymentAddress = await oxMartPayment.getAddress();
  console.log("✅ OxMartPayment deployed to:", oxMartPaymentAddress);

  // Deploy PaymentProcessor
  console.log("\n🚀 Deploying PaymentProcessor...");
  const PaymentProcessor = await hre.ethers.getContractFactory("PaymentProcessor");
  const paymentProcessor = await PaymentProcessor.deploy(hotWallet);
  await paymentProcessor.waitForDeployment();
  const paymentProcessorAddress = await paymentProcessor.getAddress();
  console.log("✅ PaymentProcessor deployed to:", paymentProcessorAddress);

  // Deploy Mock Tokens (TESTNET ONLY)
  console.log("\n🚀 Deploying Mock USDT...");
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const mockUSDT = await MockERC20.deploy("Mock USDT", "USDT", 6);
  await mockUSDT.waitForDeployment();
  const mockUSDTAddress = await mockUSDT.getAddress();
  console.log("✅ Mock USDT deployed to:", mockUSDTAddress);

  console.log("\n🚀 Deploying Mock USDC...");
  const mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6);
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("✅ Mock USDC deployed to:", mockUSDCAddress);

  console.log("\n🚀 Deploying Mock DAI...");
  const mockDAI = await MockERC20.deploy("Mock DAI", "DAI", 18);
  await mockDAI.waitForDeployment();
  const mockDAIAddress = await mockDAI.getAddress();
  console.log("✅ Mock DAI deployed to:", mockDAIAddress);

  // Configure contracts
  console.log("\n⚙️  Configuring OxMartPayment...");
  await oxMartPayment.addSupportedToken(mockUSDTAddress);
  await oxMartPayment.addSupportedToken(mockUSDCAddress);
  await oxMartPayment.addSupportedToken(mockDAIAddress);
  console.log("✅ Tokens added to OxMartPayment");

  console.log("\n⚙️  Configuring PaymentProcessor...");
  await paymentProcessor.addSupportedToken(mockUSDTAddress);
  await paymentProcessor.addSupportedToken(mockUSDCAddress);
  await paymentProcessor.addSupportedToken(mockDAIAddress);
  console.log("✅ Tokens added to PaymentProcessor");

  // Mint test tokens to deployer
  console.log("\n💰 Minting test tokens...");
  await mockUSDT.mint(deployer.address, hre.ethers.parseUnits("1000000", 6));
  await mockUSDC.mint(deployer.address, hre.ethers.parseUnits("1000000", 6));
  await mockDAI.mint(deployer.address, hre.ethers.parseUnits("1000000", 18));
  console.log("✅ Test tokens minted to deployer");

  // Print deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Hot Wallet:", hotWallet);
  console.log("\nContracts:");
  console.log("- OxMartPayment:", oxMartPaymentAddress);
  console.log("- PaymentProcessor:", paymentProcessorAddress);
  console.log("\nMock Tokens (Testnet Only):");
  console.log("- USDT:", mockUSDTAddress);
  console.log("- USDC:", mockUSDCAddress);
  console.log("- DAI:", mockDAIAddress);
  console.log("=".repeat(60));

  // Save deployment info to file
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    hotWallet: hotWallet,
    timestamp: new Date().toISOString(),
    contracts: {
      oxMartPayment: oxMartPaymentAddress,
      paymentProcessor: paymentProcessorAddress,
    },
    mockTokens: {
      usdt: mockUSDTAddress,
      usdc: mockUSDCAddress,
      dai: mockDAIAddress
    }
  };

  const filename = `deployments/${hre.network.name}-deployment.json`;
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${filename}`);

  // Verification instructions
  console.log("\n📝 To verify contracts on block explorer, run:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${oxMartPaymentAddress} "${hotWallet}"`);
  console.log(`npx hardhat verify --network ${hre.network.name} ${paymentProcessorAddress} "${hotWallet}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### 1.4 Deploy to Sepolia (Ethereum Testnet)

```bash
cd 0xmart-backend/smart-contracts

# Deploy
npx hardhat run scripts/deploy-testnet.js --network sepolia

# Verify contracts (wait 1-2 minutes after deployment)
npx hardhat verify --network sepolia <OXMART_PAYMENT_ADDRESS> "<HOT_WALLET_ADDRESS>"
npx hardhat verify --network sepolia <PAYMENT_PROCESSOR_ADDRESS> "<HOT_WALLET_ADDRESS>"
```

**Expected Output:**
```
Deploying to: sepolia
Deploying with account: 0x...
✅ OxMartPayment deployed to: 0x...
✅ PaymentProcessor deployed to: 0x...
✅ Mock USDT deployed to: 0x...
✅ Tokens configured
💾 Deployment info saved to: deployments/sepolia-deployment.json
```

### 1.5 Deploy to Mumbai (Polygon Testnet)

```bash
npx hardhat run scripts/deploy-testnet.js --network mumbai
```

### 1.6 Deploy to BSC Testnet

```bash
npx hardhat run scripts/deploy-testnet.js --network bscTestnet
```

---

## Part 2: Solana Contract Deployment

### 2.1 Setup Solana Wallet

```bash
# Generate new keypair for testnet (if needed)
solana-keygen new --outfile ~/.config/solana/testnet-keypair.json

# Set cluster to devnet
solana config set --url https://api.devnet.solana.com

# Check your address
solana address

# Airdrop test SOL
solana airdrop 2
solana balance
```

### 2.2 Configure Anchor

Update `solana-anchor/Anchor.toml`:

```toml
[programs.devnet]
oxmart_payment = "YOUR_PROGRAM_ID_HERE"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/testnet-keypair.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
```

### 2.3 Build and Deploy

```bash
cd 0xmart-backend/smart-contracts/solana-anchor

# Build the program
anchor build

# Get the program ID
solana address -k target/deploy/oxmart_payment-keypair.json

# Update Anchor.toml and lib.rs with the program ID
# In lib.rs, update: declare_id!("YOUR_PROGRAM_ID");

# Rebuild after updating program ID
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Initialize the program (after deployment)
anchor run initialize --provider.cluster devnet
```

### 2.4 Create Initialization Script

Create `solana-anchor/scripts/initialize-devnet.ts`:

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OxmartPayment } from "../target/types/oxmart_payment";

async function main() {
  // Configure the client
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.OxmartPayment as Program<OxmartPayment>;

  // Hot wallet address (your testnet wallet)
  const hotWallet = new anchor.web3.PublicKey("YOUR_HOT_WALLET_PUBKEY");

  // Platform fee (0% initially)
  const platformFeeBps = 0;

  // Initialize program
  console.log("Initializing payment program...");
  const tx = await program.methods
    .initialize(hotWallet, platformFeeBps)
    .accounts({
      authority: program.provider.publicKey,
    })
    .rpc();

  console.log("✅ Program initialized!");
  console.log("Transaction signature:", tx);

  // Get config account address
  const [configPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  console.log("Config PDA:", configPDA.toString());

  // Fetch and display config
  const config = await program.account.config.fetch(configPDA);
  console.log("\n📋 Program Configuration:");
  console.log("Authority:", config.authority.toString());
  console.log("Hot Wallet:", config.hotWallet.toString());
  console.log("Platform Fee BPS:", config.platformFeeBps);
  console.log("Paused:", config.paused);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

Run initialization:
```bash
npx ts-node scripts/initialize-devnet.ts
```

---

## Part 3: Sui Contract Deployment

### 3.1 Setup Sui Wallet

```bash
# Initialize Sui client (if not done)
sui client

# Create new address for testnet
sui client new-address ed25519

# Set active network to testnet
sui client switch --env testnet

# Get testnet tokens from faucet
# Visit: https://discord.gg/sui (use faucet channel)
# Or use CLI: sui client faucet

# Check balance
sui client gas
```

### 3.2 Update Move.toml

Update `sui/Move.toml`:

```toml
[package]
name = "oxmart_payment"
version = "0.1.0"
edition = "2024"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "mainnet" }

[addresses]
oxmart = "0x0"  # Will be replaced after deployment
```

### 3.3 Build and Deploy

```bash
cd 0xmart-backend/smart-contracts/sui

# Build the package
sui move build

# Publish to testnet
sui client publish --gas-budget 100000000

# Save the package ID from output
# Example output: "Published Modules: oxmart::payment"
# Package ID: 0x1234...
```

### 3.4 Initialize Sui Contract

Create `sui/scripts/initialize-testnet.sh`:

```bash
#!/bin/bash

# Your hot wallet address on Sui
HOT_WALLET="0x_your_hot_wallet_address"

# Your deployed package ID
PACKAGE_ID="0x_your_package_id"

echo "Initializing Sui payment contract..."
echo "Package ID: $PACKAGE_ID"
echo "Hot Wallet: $HOT_WALLET"

# Call initialize function
sui client call \
  --package $PACKAGE_ID \
  --module payment \
  --function initialize \
  --args $HOT_WALLET \
  --gas-budget 10000000

echo "✅ Initialization complete!"
```

Run:
```bash
chmod +x sui/scripts/initialize-testnet.sh
./sui/scripts/initialize-testnet.sh
```

---

## Part 4: Post-Deployment Verification

### 4.1 Verify EVM Contracts

**Test Single Payment:**
```javascript
// scripts/test-payment.js
const hre = require("hardhat");
const deployment = require("../deployments/sepolia-deployment.json");

async function main() {
  const [buyer] = await hre.ethers.getSigners();

  // Get contracts
  const payment = await hre.ethers.getContractAt("OxMartPayment", deployment.contracts.oxMartPayment);
  const usdt = await hre.ethers.getContractAt("MockERC20", deployment.mockTokens.usdt);

  // Approve tokens
  console.log("Approving tokens...");
  const amount = hre.ethers.parseUnits("100", 6);
  await usdt.approve(deployment.contracts.oxMartPayment, amount);

  // Process payment
  console.log("Processing payment...");
  const orderId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test-order-1"));
  const tx = await payment.processPayment(
    orderId,
    deployment.mockTokens.usdt,
    amount,
    "test-product-1",
    buyer.address,
    0 // 0% commission
  );

  await tx.wait();
  console.log("✅ Payment successful!");
  console.log("Transaction:", tx.hash);

  // Verify order was processed
  const processed = await payment.processedOrders(orderId);
  console.log("Order processed:", processed);
}

main().catch(console.error);
```

Run:
```bash
npx hardhat run scripts/test-payment.js --network sepolia
```

### 4.2 Verify Solana Contract

Create test script to process a payment on Solana devnet.

### 4.3 Verify Sui Contract

Create test script to process a payment on Sui testnet.

---

## Part 5: Integration with Backend

### 5.1 Update Backend Environment Variables

Add to `0xmart-backend/.env`:

```bash
# Sepolia (Ethereum Testnet)
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
SEPOLIA_OXMART_PAYMENT=0x_deployed_address
SEPOLIA_PAYMENT_PROCESSOR=0x_deployed_address
SEPOLIA_USDT=0x_mock_usdt_address
SEPOLIA_USDC=0x_mock_usdc_address

# Mumbai (Polygon Testnet)
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
MUMBAI_OXMART_PAYMENT=0x_deployed_address
MUMBAI_PAYMENT_PROCESSOR=0x_deployed_address

# Solana Devnet
SOLANA_DEVNET_RPC=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=YOUR_PROGRAM_ID

# Sui Testnet
SUI_TESTNET_RPC=https://fullnode.testnet.sui.io
SUI_PACKAGE_ID=0x_your_package_id
```

### 5.2 Configure Event Listeners

Update `0xmart-backend/src/modules/blockchain/blockchain.service.ts` to listen for testnet events.

---

## Part 6: Testing on Testnet

### 6.1 Test Checklist

- [ ] Deploy all contracts successfully
- [ ] Verify contracts on block explorers
- [ ] Configure supported tokens
- [ ] Test single payment
- [ ] Test batch payment
- [ ] Test with multiple users
- [ ] Test order deduplication
- [ ] Test access control (try unauthorized actions)
- [ ] Test pause/unpause
- [ ] Test emergency withdrawal initiation
- [ ] Monitor gas costs
- [ ] Verify backend receives events
- [ ] Test with real testnet USDT/USDC (if available)

### 6.2 Load Testing

Create script to simulate multiple concurrent payments:

```javascript
// scripts/load-test.js
async function loadTest() {
  const buyers = await Promise.all(
    Array(10).fill().map(() => hre.ethers.Wallet.createRandom())
  );

  // Fund buyers, approve tokens, execute payments concurrently
  // ...
}
```

---

## Part 7: Monitoring & Alerting

### 7.1 Set Up Tenderly

1. Go to [Tenderly](https://tenderly.co/)
2. Create project
3. Add contracts
4. Configure alerts:
   - Payment events
   - Emergency withdrawal initiations
   - Pause events
   - Large transactions (> $10,000)

### 7.2 Set Up OpenZeppelin Defender

1. Go to [OpenZeppelin Defender](https://defender.openzeppelin.com/)
2. Add contracts
3. Configure Sentinels for monitoring
4. Set up Autotasks for automated responses

---

## Part 8: Multi-Signature Setup

### 8.1 EVM - Gnosis Safe

```bash
# 1. Go to https://app.safe.global/
# 2. Select testnet (Sepolia, Mumbai, etc.)
# 3. Create new Safe
# 4. Add signers (recommend 2/3 or 3/5)
# 5. Transfer ownership of contracts to Safe

# Script to transfer ownership
npx hardhat run scripts/transfer-ownership-to-safe.js --network sepolia
```

### 8.2 Solana - Squads Protocol

1. Visit [Squads Protocol](https://squads.so/)
2. Create new Squad on Devnet
3. Add members
4. Transfer authority to Squad

### 8.3 Sui - Multi-Sig

Use Sui's built-in multi-sig:
```bash
sui client multi-sig --threshold 2 --keys <KEY1> <KEY2> <KEY3>
```

---

## Troubleshooting

### Common Issues

**Issue:** Insufficient gas/balance
**Solution:** Get more testnet tokens from faucets

**Issue:** Contract deployment fails
**Solution:** Check RPC URL, private key, and gas settings

**Issue:** Verification fails
**Solution:** Wait 1-2 minutes and try again, ensure constructor args match

**Issue:** Transaction reverts
**Solution:** Check contract is not paused, tokens are whitelisted, order not already processed

---

## Success Criteria

✅ All contracts deployed successfully
✅ All contracts verified on block explorers
✅ Test payments execute without errors
✅ Events are emitted correctly
✅ Backend receives and processes events
✅ Gas costs are acceptable
✅ No reverts during normal operations
✅ Multi-sig wallets configured
✅ Monitoring and alerting active

---

## Next Steps After Testnet

1. Monitor testnet for 1-2 weeks
2. Fix any issues discovered
3. Conduct load testing
4. Optional: Third-party audit
5. Deploy to mainnet

---

**Guide Version:** 1.0
**Last Updated:** March 18, 2026
**Status:** ✅ Ready for Use

For questions or issues, refer to:
- **Full Audit Report:** `PROFESSIONAL_SECURITY_AUDIT.md`
- **Test Report:** `TEST_REPORT.md`
- **Status:** `FINAL_AUDIT_STATUS.md`
