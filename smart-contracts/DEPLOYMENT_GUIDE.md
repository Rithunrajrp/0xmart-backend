# Smart Contract Deployment Guide

**Status**: Ready for Testnet Deployment
**Date**: December 7, 2025

This guide covers deployment of 0xMart payment processing contracts across all supported blockchain networks:
- **EVM Chains** (Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Base) - Solidity
- **Sui Network** - Move
- **TON Network** - Tact

---

## Table of Contents

1. [EVM Chains (Solidity)](#evm-chains-deployment)
2. [Sui Network (Move)](#sui-network-deployment)
3. [TON Network (Tact)](#ton-network-deployment)
4. [Post-Deployment Checklist](#post-deployment-checklist)
5. [Mainnet Deployment](#mainnet-deployment)

---

# EVM Chains Deployment

## Prerequisites

### 1. Environment Setup

Create `.env` file from template:
```bash
cp .env.example .env
```

### 2. Required Environment Variables

```env
# Deployer wallet (DO NOT use mainnet private key for testing!)
DEPLOYER_PRIVATE_KEY=0x...

# Hot wallet that will receive payments
HOT_WALLET_ADDRESS=0x...

# RPC URLs (get free API keys from Alchemy, Infura, or QuickNode)
ETHEREUM_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
POLYGON_MUMBAI_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_API_KEY
OPTIMISM_SEPOLIA_RPC_URL=https://opt-sepolia.g.alchemy.com/v2/YOUR_API_KEY
AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Block Explorer API Keys (for contract verification)
ETHERSCAN_API_KEY=...
POLYGONSCAN_API_KEY=...
BSCSCAN_API_KEY=...
ARBISCAN_API_KEY=...
OPTIMISTIC_ETHERSCAN_API_KEY=...
SNOWTRACE_API_KEY=...
BASESCAN_API_KEY=...
```

### 3. Get Testnet Funds

#### Ethereum Sepolia
- Faucet: https://sepoliafaucet.com/
- Alternative: https://faucet.quicknode.com/ethereum/sepolia
- Amount needed: 0.5 ETH (for deployment + gas)

#### Polygon Mumbai
- Faucet: https://faucet.polygon.technology/
- Amount needed: 1 MATIC

#### BSC Testnet
- Faucet: https://testnet.bnbchain.org/faucet-smart
- Amount needed: 0.5 BNB

#### Arbitrum Sepolia
- Faucet: https://faucet.quicknode.com/arbitrum/sepolia
- Amount needed: 0.1 ETH

#### Optimism Sepolia
- Faucet: https://faucet.quicknode.com/optimism/sepolia
- Amount needed: 0.1 ETH

#### Avalanche Fuji
- Faucet: https://faucet.avax.network/
- Amount needed: 1 AVAX

#### Base Sepolia
- Faucet: https://faucet.quicknode.com/base/sepolia
- Amount needed: 0.1 ETH

---

## Deployment Steps

### Step 1: Verify Environment

```bash
# Check deployer balance
npx hardhat run scripts/checkBalance.js --network sepolia
```

### Step 2: Deploy Contract

```bash
# Ethereum Sepolia
npm run deploy:sepolia

# Other networks
npm run deploy:mumbai
npm run deploy:bscTestnet
npm run deploy:arbitrumSepolia
npm run deploy:optimismSepolia
npm run deploy:avalancheFuji
npm run deploy:baseSepolia
```

**Expected Output**:
```
Starting deployment...

Deploying contracts with account: 0x...
Account balance: 0.5 ETH

Hot Wallet Address: 0x...
Deploying OxMartPayment contract...

✅ OxMartPayment deployed to: 0xABCD...
Network: sepolia
Chain ID: 11155111

📄 Deployment info saved to: ./deployments/sepolia-11155111.json

⚠️  IMPORTANT: Add supported tokens after deployment!
Use the following commands:

const contract = await ethers.getContractAt("OxMartPayment", "0xABCD...");

// Example token addresses (update with actual addresses for your network):
await contract.addSupportedToken("0x...USDT_ADDRESS");
await contract.addSupportedToken("0x...USDC_ADDRESS");
await contract.addSupportedToken("0x...DAI_ADDRESS");
await contract.addSupportedToken("0x...BUSD_ADDRESS");

✨ Deployment complete!
```

### Step 3: Add Supported Tokens

The `addTokens.js` script contains pre-configured token addresses for each network.

```bash
# Ethereum Sepolia
npm run tokens:sepolia

# Other networks
npm run tokens:mumbai
npm run tokens:bscTestnet
```

**Note**: For testnets, you may need to deploy your own mock tokens or find testnet token addresses.

### Step 4: Verify Contract on Block Explorer

```bash
# Ethereum Sepolia
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> "<HOT_WALLET_ADDRESS>"

# Example
npx hardhat verify --network sepolia 0xABCD1234... "0xHotWallet..."
```

**Expected Output**:
```
Successfully submitted source code for contract
contracts/OxMartPayment.sol:OxMartPayment at 0xABCD...
for verification on the block explorer. Waiting for verification result...

Successfully verified contract OxMartPayment on Etherscan.
https://sepolia.etherscan.io/address/0xABCD...#code
```

### Step 5: Test Payment Flow

Create a test script to verify the deployment:

```javascript
// scripts/testPayment.js
const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0xYOUR_DEPLOYED_CONTRACT";
  const payment = await ethers.getContractAt("OxMartPayment", contractAddress);

  // Check hot wallet
  const hotWallet = await payment.hotWallet();
  console.log("Hot Wallet:", hotWallet);

  // Check supported tokens
  const usdtAddress = "0x...";
  const isSupported = await payment.supportedTokens(usdtAddress);
  console.log("USDT Supported:", isSupported);

  // Check platform fee
  const fee = await payment.platformFeeBps();
  console.log("Platform Fee:", fee.toString(), "bps");
}

main().catch(console.error);
```

Run test:
```bash
npx hardhat run scripts/testPayment.js --network sepolia
```

---

## Testnet Token Addresses

### Ethereum Sepolia

**Note**: Most testnet tokens don't have official deployments. You may need to:
1. Deploy your own MockERC20 tokens, or
2. Use existing testnet faucets

**Option 1: Deploy Mock Tokens**
```bash
npx hardhat run scripts/deployMockTokens.js --network sepolia
```

**Option 2: Find Existing Testnet Tokens**
- Search on Sepolia Etherscan
- Check community token lists

### Polygon Mumbai

Potential testnet tokens (verify before using):
- USDT: Find on Mumbai explorer
- USDC: Find on Mumbai explorer
- DAI: Find on Mumbai explorer

### BSC Testnet

BSC provides testnet versions:
- Check https://testnet.bscscan.com/

### Important Note on Testnet Tokens

⚠️ **Testnet token addresses change frequently**. Always verify current addresses before deployment.

For testing purposes, consider:
1. Deploying your own MockERC20 contracts
2. Using the MockERC20 contract included in the test suite
3. Minting test tokens to your wallet

---

## Post-Deployment Checklist

### ✅ Contract Deployment
- [ ] Contract deployed successfully
- [ ] Deployment info saved to `deployments/` directory
- [ ] Hot wallet address is correct
- [ ] Owner address is correct

### ✅ Token Configuration
- [ ] USDT added as supported token
- [ ] USDC added as supported token
- [ ] DAI added as supported token
- [ ] BUSD added as supported token (if available)
- [ ] All tokens verified as supported

### ✅ Contract Verification
- [ ] Contract verified on block explorer
- [ ] Source code visible
- [ ] Contract ABI accessible
- [ ] Read/Write functions work on explorer

### ✅ Functionality Testing
- [ ] Hot wallet address readable
- [ ] Supported tokens query works
- [ ] Platform fee is 0 (default)
- [ ] Owner can add/remove tokens
- [ ] Owner can pause/unpause
- [ ] Payment processing works (end-to-end test)

### ✅ Documentation
- [ ] Contract address documented
- [ ] Deployment date recorded
- [ ] Block number recorded
- [ ] Deployer address recorded
- [ ] Hot wallet address recorded

---

## Deployment Artifacts

After deployment, you'll have:

```
deployments/
├── sepolia-11155111.json
├── mumbai-80001.json
├── bscTestnet-97.json
├── arbitrumSepolia-421614.json
├── optimismSepolia-11155420.json
├── avalancheFuji-43113.json
└── baseSepolia-84532.json
```

Each file contains:
```json
{
  "network": "sepolia",
  "chainId": "11155111",
  "contractAddress": "0x...",
  "hotWalletAddress": "0x...",
  "deployer": "0x...",
  "deploymentTime": "2025-12-04T...",
  "blockNumber": 123456
}
```

---

## Troubleshooting

### Issue: Insufficient funds
**Error**: `insufficient funds for intrinsic transaction cost`
**Solution**: Get more testnet tokens from faucets

### Issue: Nonce too low
**Error**: `nonce has already been used`
**Solution**:
```bash
# Reset account nonce
npx hardhat clean
# Or specify nonce manually in deployment script
```

### Issue: Contract verification fails
**Error**: `Unable to verify contract`
**Solution**:
1. Wait 1-2 minutes after deployment
2. Ensure correct constructor arguments
3. Check network name matches exactly
4. Verify API key is valid

### Issue: RPC rate limit
**Error**: `429 Too Many Requests`
**Solution**:
- Use paid RPC provider (Alchemy, Infura)
- Add delays between transactions
- Reduce parallel requests

### Issue: Hot wallet address mismatch
**Error**: Payments going to wrong address
**Solution**:
1. Verify HOT_WALLET_ADDRESS in .env
2. Check deployed contract hot wallet
3. Update if needed using `updateHotWallet()`

---

## Security Considerations for Production

When deploying to mainnet:

### 1. Private Key Management
- ⚠️ Never commit .env to git
- ⚠️ Use hardware wallet for mainnet
- ⚠️ Consider using Gnosis Safe for deployment
- ⚠️ Store keys in secure key management system

### 2. Multi-Sig Ownership
```bash
# After deployment, transfer ownership to multi-sig
const multisigAddress = "0x..."; // Gnosis Safe
await contract.transferOwnership(multisigAddress);
```

### 3. Audit Requirements
- ✅ Internal audit complete (tests passing)
- ⏳ External audit recommended (Certik, OpenZeppelin, etc.)
- ⏳ Bug bounty program consideration

### 4. Deployment Process
1. Deploy to testnet first
2. Test thoroughly for 1-2 weeks
3. Get external audit
4. Deploy to mainnet
5. Transfer ownership to multi-sig
6. Announce contract addresses

### 5. Monitoring
- Set up event listeners for PaymentReceived
- Monitor hot wallet balance
- Set up alerts for:
  - Unusual transaction volumes
  - Failed transactions
  - Pause events
  - Ownership transfers

---

## Next Steps After Deployment

1. **Backend Integration** (Phase 2)
   - Set up event listeners
   - Create smart contract module
   - Implement payment initiation API

2. **Frontend Integration** (Phase 3)
   - Add Web3 library (ethers.js)
   - Create payment flow UI
   - Add wallet connection

3. **Testing**
   - End-to-end payment testing
   - Load testing
   - Security testing

4. **Mainnet Deployment**
   - External audit
   - Bug bounty
   - Phased rollout

---

## Support

For issues or questions:
1. Check deployment logs in `deployments/` directory
2. Review contract on block explorer
3. Test contract functions using explorer's Write Contract feature
4. Check Hardhat documentation: https://hardhat.org

---

# Sui Network Deployment

## Prerequisites

### 1. Install Sui CLI

```bash
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui
```

Verify installation:
```bash
sui --version
```

### 2. Create Sui Wallet

```bash
sui client new-address ed25519
```

Save the mnemonic phrase securely.

### 3. Environment Setup

Navigate to the sui directory and create `.env`:

```bash
cd sui
cp .env.example .env
```

Configure environment variables:

```env
# Hot wallet address to receive payments (Sui format)
SUI_HOT_WALLET_ADDRESS=0x...

# Deployer private key (base64 encoded)
# Export from sui client: sui keytool export --key-identity <address>
SUI_DEPLOYER_PRIVATE_KEY=...

# Admin private key (can be same as deployer)
SUI_ADMIN_PRIVATE_KEY=...

# After deployment, add these:
SUI_PACKAGE_ID=0x...
SUI_CONFIG_OBJECT_ID=0x...
```

### 4. Get Testnet SUI

For testnet deployment:

**Option 1: Discord Faucet**
1. Join Sui Discord: https://discord.gg/sui
2. Go to #testnet-faucet channel
3. Request tokens with your address

**Option 2: CLI Faucet**
```bash
sui client faucet
```

You need at least 1 SUI for deployment and testing.

## Deployment Steps

### Step 1: Install Dependencies

```bash
cd sui
npm install
```

### Step 2: Build Contract

```bash
npm run build
# Or: sui move build
```

This compiles the Move code and checks for errors.

### Step 3: Run Tests (Optional)

```bash
sui move test
```

### Step 4: Deploy to Testnet

```bash
# Publish the package
sui client publish --gas-budget 100000000
```

**Important**: Save the output:
- `Package ID` - Your deployed package identifier
- `SharedObject` - The PaymentConfig object ID (look for `oxmart::payment::PaymentConfig`)

Update your `.env`:
```env
SUI_PACKAGE_ID=0x<package_id>
SUI_CONFIG_OBJECT_ID=0x<config_object_id>
```

### Step 5: Add Supported Tokens

Update token addresses in `scripts/add-tokens.ts`:

```typescript
const TOKEN_TYPES = {
  testnet: {
    USDT: '0x...::usdt::USDT',  // Update with actual token types
    USDC: '0x...::usdc::USDC',
    DAI: '0x...::dai::DAI',
    BUSD: '0x...::busd::BUSD',
  },
};
```

Then run:
```bash
npm run add-tokens:testnet
```

### Step 6: Verify Deployment

Check your contract on Sui Explorer:
- Testnet: https://suiexplorer.com/?network=testnet
- Search for your Package ID

Query contract state:
```bash
# Get hot wallet
sui client call \
  --package $PACKAGE_ID \
  --module payment \
  --function get_hot_wallet \
  --args $CONFIG_OBJECT_ID

# Check if token is supported
sui client call \
  --package $PACKAGE_ID \
  --module payment \
  --function is_token_supported \
  --args $CONFIG_OBJECT_ID "0x...::usdt::USDT"
```

## Sui-Specific Notes

### Move Contract Features
- **Generic Type Support**: Tokens are specified via type parameters (not addresses)
- **Shared Objects**: PaymentConfig is a shared object accessible to all
- **Event Emission**: Payment events are emitted for indexing
- **Table Storage**: Orders and tokens stored in efficient table structures

### Gas Costs (Approximate)
- Package publish: ~10-50 MIST (0.00001-0.00005 SUI)
- Process payment: ~0.001 SUI
- Add token: ~0.0005 SUI
- Admin operations: ~0.0005 SUI

### Testing Payment Flow

Create a test transaction:

```typescript
import { TransactionBlock } from '@mysten/sui.js/transactions';

const tx = new TransactionBlock();

tx.moveCall({
  target: `${packageId}::payment::process_payment`,
  typeArguments: ['0x2::sui::SUI'],
  arguments: [
    tx.object(configObjectId),
    tx.pure([1, 2, 3, 4, 5, 6]),  // order_id
    coinObject,                     // payment coin
    tx.pure('product-123'),
    tx.pure('0x...'),              // api_key_owner
    tx.pure(500),                   // commission_bps
  ],
});

const result = await client.signAndExecuteTransactionBlock({
  signer: keypair,
  transactionBlock: tx,
});
```

---

# TON Network Deployment

## Prerequisites

### 1. Install Dependencies

```bash
cd ton
npm install
```

### 2. Environment Setup

Create `.env` file:

```env
# Hot wallet address (TON user-friendly format)
TON_HOT_WALLET_ADDRESS=UQC...

# Deployer wallet mnemonic (24 words)
TON_DEPLOYER_MNEMONIC="word1 word2 word3 ... word24"

# Admin wallet mnemonic (can be same as deployer)
TON_ADMIN_MNEMONIC="word1 word2 word3 ... word24"

# TonCenter API key (optional, for higher rate limits)
# Get from: https://toncenter.com/api/v2/
TONCENTER_API_KEY=...

# After deployment
TON_CONTRACT_ADDRESS=EQC...
```

### 3. Generate Wallet (if needed)

Run the deployment script without a mnemonic:

```bash
npm run deploy:testnet
```

It will generate a new wallet and display the mnemonic. **Save it securely!**

### 4. Fund Wallet

For **testnet**:
1. Copy your deployer address from script output
2. Open Telegram and message: @testgiver_ton_bot
3. Send your address to the bot
4. Wait for confirmation (you'll receive 5 testnet TON)

For **mainnet**:
1. Send at least 1 TON to your deployer address
2. Use Tonkeeper, TON Wallet, or other TON wallets

## Deployment Steps

### Step 1: Build Contract

```bash
npm run build
```

This compiles Tact code to FunC and then to TON bytecode.

Build output will be in `./build/` directory:
- `oxmart_payment.code.fc` - FunC intermediate code
- `oxmart_payment.code.boc` - Compiled bytecode
- `oxmart_payment.ts` - TypeScript deployment wrapper

### Step 2: Deploy Contract

The build process generates deployment code. Follow the instructions in the build output.

Typically:
1. Review generated TypeScript wrapper in `build/oxmart_payment.ts`
2. Deploy using the wrapper with your hot wallet address as init parameter
3. Note the deployed contract address

Update `.env`:
```env
TON_CONTRACT_ADDRESS=EQC...
```

### Step 3: Add Supported Jettons

Update jetton addresses in `scripts/add-tokens.ts`:

```typescript
const JETTON_ADDRESSES = {
  testnet: {
    USDT: 'EQC...',  // Jetton master contract address
    USDC: 'EQC...',
    DAI: 'EQC...',
    BUSD: 'EQC...',
  },
};
```

Then run:
```bash
npm run add-tokens:testnet
```

**Note**: You need the jetton **master contract address**, not the wallet address.

### Step 4: Verify Deployment

Check your contract on TON Explorer:
- Testnet: https://testnet.tonviewer.com/
- Mainnet: https://tonviewer.com/

Query contract state using TON Client:

```typescript
import { TonClient } from '@ton/ton';

const client = new TonClient({
  endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC'
});

// Get hot wallet
const result = await client.runMethod(
  contractAddress,
  'hotWallet'
);

// Get platform fee
const feeResult = await client.runMethod(
  contractAddress,
  'platformFeeBps'
);
```

## TON-Specific Notes

### Tact Contract Features
- **Message-Based**: Uses TON's message passing architecture
- **Jetton Support**: Compatible with TON's jetton standard (like ERC-20)
- **Ownable**: Built-in ownership from Tact standard library
- **Gas Optimized**: Efficient message handling and storage

### Gas Costs (Approximate)
- Deploy contract: ~0.5 TON
- Process payment: ~0.05 TON
- Add jetton: ~0.05 TON
- Admin operations: ~0.05 TON

### Jetton Integration

TON jetton payments work differently from EVM:

1. User sends jettons to contract's jetton wallet
2. Contract's jetton wallet notifies the contract
3. Contract processes payment and emits event
4. Contract's jetton wallet forwards to hot wallet

You need jetton master contract addresses (not wallet addresses):
- Find on [TON Jetton Registry](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md)
- Check [DeDust](https://dedust.io/) or other TON DEXes
- Search on [TON Explorer](https://tonviewer.com/)

### Testing Payment Flow

Send a payment message:

```typescript
import { Address, toNano, beginCell } from '@ton/core';

// Build ProcessPayment message
const body = beginCell()
  .storeUint(0, 32)  // op code
  .storeString('order-12345')
  .storeAddress(jettonAddress)
  .storeCoins(toNano('100'))
  .storeString('product-abc')
  .storeAddress(apiKeyOwner)
  .storeUint(500, 16)
  .endCell();

await wallet.sendTransfer({
  to: contractAddress,
  value: toNano('0.1'),  // Gas fee
  body,
});
```

---

# Post-Deployment Checklist

## All Networks

### ✅ Contract Deployment
- [ ] Contract deployed successfully
- [ ] Deployment info saved
- [ ] Hot wallet address is correct
- [ ] Owner/Admin address is correct

### ✅ Token Configuration
- [ ] USDT added as supported token
- [ ] USDC added as supported token
- [ ] DAI added as supported token
- [ ] BUSD added as supported token (if available)
- [ ] All tokens verified

### ✅ Contract Verification
- [ ] **EVM**: Contract verified on block explorer
- [ ] **Sui**: Package visible on Sui Explorer
- [ ] **TON**: Contract visible on TON Explorer
- [ ] Source code/ABI accessible

### ✅ Functionality Testing
- [ ] Hot wallet address readable
- [ ] Supported tokens query works
- [ ] Platform fee is 0 (default)
- [ ] Admin can add/remove tokens
- [ ] Admin can pause/unpause
- [ ] Payment processing works (test transaction)

### ✅ Documentation
- [ ] Contract address documented
- [ ] Network documented
- [ ] Deployment date recorded
- [ ] Deployer address recorded
- [ ] Hot wallet address recorded

---

# Mainnet Deployment

## Pre-Mainnet Checklist

Before deploying to mainnet on any network:

### 1. Security Audit
- [ ] Internal code review complete
- [ ] External audit (recommended for mainnet)
- [ ] Bug bounty program considered

### 2. Testing
- [ ] Deployed to testnet
- [ ] All features tested for 1-2 weeks
- [ ] Load testing completed
- [ ] Edge cases covered
- [ ] Gas costs optimized

### 3. Key Management
- [ ] Use hardware wallet for mainnet admin keys
- [ ] Consider multi-sig for admin operations
- [ ] Backup all mnemonics/private keys securely
- [ ] Document key storage location

### 4. Monitoring
- [ ] Event listeners configured
- [ ] Alerts set up for unusual activity
- [ ] Hot wallet monitoring enabled
- [ ] Block explorer tracking enabled

## Mainnet Deployment Process

### EVM Mainnet

```bash
# 1. Update .env with mainnet values
HOT_WALLET_ADDRESS=0x...  # Production hot wallet
PRIVATE_KEY=0x...         # From hardware wallet

# 2. Deploy to mainnet
npm run deploy:mainnet
# Or specific network:
npm run deploy:polygon
npm run deploy:bsc

# 3. Add tokens with mainnet addresses
npm run tokens:mainnet

# 4. Verify contract
npx hardhat verify --network mainnet <ADDRESS> "<HOT_WALLET>"

# 5. Consider transferring ownership to multi-sig
# const multisig = "0x...";
# await contract.transferOwnership(multisig);
```

### Sui Mainnet

```bash
cd sui

# 1. Update .env
SUI_HOT_WALLET_ADDRESS=0x...
SUI_DEPLOYER_PRIVATE_KEY=...

# 2. Build
npm run build

# 3. Deploy
sui client publish --gas-budget 100000000

# 4. Update .env with package and config IDs
SUI_PACKAGE_ID=0x...
SUI_CONFIG_OBJECT_ID=0x...

# 5. Add tokens
npm run add-tokens:mainnet
```

### TON Mainnet

```bash
cd ton

# 1. Update .env
TON_HOT_WALLET_ADDRESS=UQC...
TON_DEPLOYER_MNEMONIC="mainnet wallet words"

# 2. Build
npm run build

# 3. Deploy (follow build output instructions)
npm run deploy:mainnet

# 4. Update .env
TON_CONTRACT_ADDRESS=EQC...

# 5. Add jettons
npm run add-tokens:mainnet
```

## Post-Mainnet Steps

1. **Announce Deployment**
   - Update documentation with contract addresses
   - Announce on official channels
   - Verify on all explorers

2. **Monitor Closely**
   - Watch first transactions carefully
   - Monitor gas usage
   - Track hot wallet balance
   - Set up 24/7 alerts

3. **Have Rollback Plan**
   - Document pause procedure
   - Have emergency contact list
   - Test emergency withdrawal
   - Document recovery procedures

---

**Last Updated**: December 7, 2025
**Contract Version**: 1.0.0
**Supported Networks**: EVM (7 chains), Sui, TON
