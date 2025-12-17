# Testnet Deployment Guide

This guide explains how to deploy smart contracts to testnets and configure the backend to use them.

## Automatic Testnet/Mainnet Switching

The backend automatically switches between testnet and mainnet RPC URLs based on the `NODE_ENV` environment variable:

- **Development** (`NODE_ENV=development`): Uses testnet RPC URLs
- **Production** (`NODE_ENV=production`): Uses mainnet RPC URLs

## Environment Variables Setup

### 1. Add Testnet RPC URLs to `.env`

```bash
# NODE_ENV (important!)
NODE_ENV=development

# EVM Testnets
ETHEREUM_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_API_KEY
OPTIMISM_SEPOLIA_RPC_URL=https://opt-sepolia.g.alchemy.com/v2/YOUR_API_KEY
AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Solana Testnet
SOLANA_TESTNET_RPC_URL=https://api.devnet.solana.com
# Or use a paid provider for better performance:
# SOLANA_TESTNET_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY

# TON Testnet
TON_TESTNET_RPC_URL=https://testnet.toncenter.com/api/v2/jsonRPC
TON_TESTNET_API_KEY=your-testnet-api-key-from-tonconsole

# SUI Testnet
SUI_TESTNET_RPC_URL=https://fullnode.testnet.sui.io
```

## Smart Contract Deployment

### EVM Chains (Ethereum, Polygon, BSC, etc.)

1. **Navigate to smart-contracts directory:**
   ```bash
   cd 0xmart-backend/smart-contracts
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Deploy to testnet (example with Sepolia):**
   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```

4. **Deploy to multiple testnets:**
   ```bash
   # Ethereum Sepolia
   npx hardhat run scripts/deploy.js --network sepolia

   # Polygon Amoy
   npx hardhat run scripts/deploy.js --network polygonAmoy

   # BSC Testnet
   npx hardhat run scripts/deploy.js --network bscTestnet

   # Arbitrum Sepolia
   npx hardhat run scripts/deploy.js --network arbitrumSepolia

   # Optimism Sepolia
   npx hardhat run scripts/deploy.js --network optimismSepolia

   # Avalanche Fuji
   npx hardhat run scripts/deploy.js --network avalancheFuji

   # Base Sepolia
   npx hardhat run scripts/deploy.js --network baseSepolia
   ```

5. **Update contract addresses in `.env`:**
   ```bash
   SEPOLIA_PAYMENT_CONTRACT=0xYourDeployedContractAddress
   SEPOLIA_USDT=0xTestnetUSDTAddress
   SEPOLIA_USDC=0xTestnetUSDCAddress
   # Repeat for other networks...
   ```

### Solana

1. **Deploy your Anchor program to devnet:**
   ```bash
   anchor build
   anchor deploy --provider.cluster devnet
   ```

2. **Update contract address in `.env`:**
   ```bash
   SOLANA_DEVNET_PROGRAM_ID=YourProgramIDHere111111111111111111
   ```

3. **Update token addresses (if using custom tokens):**
   ```bash
   SOLANA_DEVNET_USDC=YourDevnetUSDCAddress111111111111111
   SOLANA_DEVNET_USDT=YourDevnetUSDTAddress111111111111111
   ```

### TON

1. **Deploy your contract to TON testnet:**
   ```bash
   # Using Blueprint or your deployment tool
   npm run deploy:testnet
   ```

2. **Update contract address in your configuration**

### SUI

1. **Deploy your Move package to testnet:**
   ```bash
   sui client publish --gas-budget 100000000 --network testnet
   ```

2. **Update package ID in your configuration**

## Contract Address Configuration

The backend reads contract addresses from these environment variables:

### Solana
```bash
# Mainnet
SOLANA_PROGRAM_ID=YourMainnetProgramID

# Testnet (Devnet)
SOLANA_DEVNET_PROGRAM_ID=YourDevnetProgramID
SOLANA_DEVNET_USDC=DevnetUSDCAddress
SOLANA_DEVNET_USDT=DevnetUSDTAddress
```

### EVM Networks (Sepolia, Mumbai, etc.)
```bash
# Ethereum Sepolia
SEPOLIA_PAYMENT_CONTRACT=0x...
SEPOLIA_USDT=0x...
SEPOLIA_USDC=0x...

# Polygon Mumbai
MUMBAI_PAYMENT_CONTRACT=0x...

# BSC Testnet
BSC_TESTNET_PAYMENT_CONTRACT=0x...

# And so on for other testnets...
```

## Testing Transaction Flow

### 1. Start Backend in Development Mode

Make sure `NODE_ENV=development` in your `.env`:

```bash
cd 0xmart-backend
NODE_ENV=development npm run start:dev
```

### 2. Verify RPC Connection

Check the logs on startup. You should see:
```
[SolanaBlockchainService] ✅ Solana provider initialized: https://api.devnet.solana.com
[TonBlockchainService] ✅ TON provider initialized: https://testnet.toncenter.com/api/v2/jsonRPC
[SuiBlockchainService] ✅ SUI provider initialized: https://fullnode.testnet.sui.io
```

### 3. Create Test Wallets

The backend will generate wallet addresses using the same derivation paths for both testnet and mainnet.

### 4. Fund Test Wallets

Get testnet tokens:

**EVM Testnets:**
- **Ethereum Sepolia**: [Sepolia Faucet](https://sepoliafaucet.com/) or [Alchemy Faucet](https://sepoliafaucet.com/)
- **Polygon Amoy**: [Polygon Faucet](https://faucet.polygon.technology/)
- **BSC Testnet**: [BSC Faucet](https://testnet.bnbchain.org/faucet-smart)
- **Arbitrum Sepolia**: [Arbitrum Faucet](https://faucet.quicknode.com/arbitrum/sepolia)
- **Optimism Sepolia**: [Optimism Faucet](https://app.optimism.io/faucet)
- **Avalanche Fuji**: [Avalanche Faucet](https://core.app/tools/testnet-faucet/)
- **Base Sepolia**: [Base Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)

**Non-EVM Testnets:**
- **Solana**: [Solana Faucet](https://faucet.solana.com/)
- **TON**: [TON Testnet Faucet](https://t.me/testgiver_ton_bot)
- **SUI**: [SUI Testnet Faucet](https://discord.gg/sui)

### 5. Create Test Order

Use the frontend or API to create an order. The backend will:
1. Generate a deposit address
2. Monitor the testnet for incoming transactions
3. Process the payment when received
4. Update order status

### 6. Monitor Transactions

Watch the backend logs for deposit detection:
```
[DepositMonitorService] 💰 Deposit detected: 10 USDC from 0x... to order #123
[SolanaListenerService] ✅ Payment event processed: Order #123, Amount: 10000000
```

## Production Deployment Checklist

Before deploying to production:

1. **Update environment variables:**
   ```bash
   NODE_ENV=production
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   TON_RPC_URL=https://toncenter.com/api/v2/jsonRPC
   SUI_RPC_URL=https://fullnode.mainnet.sui.io
   ```

2. **Deploy contracts to mainnet:**
   - Audit your smart contracts
   - Deploy to mainnet
   - Update contract addresses in `.env`

3. **Update mainnet contract addresses:**
   ```bash
   SOLANA_PROGRAM_ID=MainnetProgramID
   ETHEREUM_PAYMENT_CONTRACT=0xMainnetAddress
   POLYGON_PAYMENT_CONTRACT=0xMainnetAddress
   # etc.
   ```

4. **Test with small amounts first**

5. **Monitor transactions closely**

## Switching Between Networks

### Force Testnet (Development)
```bash
NODE_ENV=development npm run start:dev
```

### Force Mainnet (Production)
```bash
NODE_ENV=production npm run start:prod
```

## Troubleshooting

### Issue: Still connecting to mainnet in development

**Solution**: Check your `.env` file:
```bash
# Make sure this is set
NODE_ENV=development

# And testnet URLs are configured
SOLANA_TESTNET_RPC_URL=https://api.devnet.solana.com
TON_TESTNET_RPC_URL=https://testnet.toncenter.com/api/v2/jsonRPC
SUI_TESTNET_RPC_URL=https://fullnode.testnet.sui.io
```

### Issue: Transactions not being detected

**Solution**:
1. Check contract address is correct
2. Verify RPC URL is accessible
3. Check logs for connection errors
4. Ensure sufficient RPC rate limits

### Issue: Invalid contract address

**Solution**:
1. Verify contract was deployed successfully
2. Check the deployment logs for the correct address
3. Update `.env` with the correct address
4. Restart the backend

## Network-Specific Notes

### Solana Devnet
- Faster block times than mainnet
- Tokens have no value
- Resets periodically (addresses may need refunding)
- Use Helius or QuickNode for better RPC performance

### TON Testnet
- Requires API key from TON Console
- Test tokens available via Telegram bot
- Similar behavior to mainnet

### SUI Testnet
- Full feature parity with mainnet
- Regular testnet resets
- Faucet available via Discord

## Resources

- [Solana Devnet](https://docs.solana.com/clusters#devnet)
- [TON Testnet](https://docs.ton.org/develop/smart-contracts/testing/testnet)
- [SUI Testnet](https://docs.sui.io/build/sui-testnet)
- [Ethereum Sepolia](https://sepolia.dev/)
- [Polygon Mumbai](https://mumbai.polygonscan.com/)
