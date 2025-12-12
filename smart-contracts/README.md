# 0xMart Smart Contracts

Smart contract infrastructure for 0xMart payment processing across multiple EVM chains.

## Overview

The `OxMartPayment` contract enables direct wallet payments for product purchases, replacing the deposit address monitoring system with instant on-chain payment confirmation.

## Features

- ✅ Single-product and batch payment processing
- ✅ Multi-stablecoin support (USDT, USDC, DAI, BUSD)
- ✅ Commission tracking for external API integrations
- ✅ Reentrancy protection
- ✅ Emergency pause functionality
- ✅ Hot wallet management
- ✅ Platform fee configuration

## Supported Networks

### Testnets
- Ethereum Sepolia
- Polygon Mumbai
- BSC Testnet
- Arbitrum Sepolia
- Optimism Sepolia
- Avalanche Fuji
- Base Sepolia

### Mainnets (Production)
- Ethereum
- Polygon
- BSC (BNB Chain)
- Arbitrum
- Optimism
- Avalanche C-Chain
- Base

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your values
```

3. **Compile contracts:**
```bash
npx hardhat compile
```

## Deployment

### Deploy to testnet:
```bash
# Ethereum Sepolia
npx hardhat run scripts/deploy.ts --network sepolia

# Polygon Mumbai
npx hardhat run scripts/deploy.ts --network mumbai

# BSC Testnet
npx hardhat run scripts/deploy.ts --network bscTestnet
```

### Add supported tokens:
```bash
npx hardhat run scripts/addTokens.ts --network sepolia
```

### Deploy to mainnet:
```bash
# ⚠️ CAUTION: Ensure thorough testing before mainnet deployment
npx hardhat run scripts/deploy.ts --network ethereum
npx hardhat run scripts/addTokens.ts --network ethereum
```

## Testing

```bash
# Run all tests
npx hardhat test

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run with coverage
npx hardhat coverage
```

## Contract Verification

After deployment, verify the contract on block explorers:

```bash
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS "HOT_WALLET_ADDRESS"
```

## Usage

### Process Payment

```javascript
const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-123"));
const tokenAddress = "0x..."; // USDT address
const amount = ethers.parseUnits("100", 6); // 100 USDT
const productId = "product-456";
const apiKeyOwner = "0x..."; // Address to credit commission
const commissionBps = 500; // 5%

await contract.processPayment(
  orderId,
  tokenAddress,
  amount,
  productId,
  apiKeyOwner,
  commissionBps
);
```

### Process Batch Payment

```javascript
const orderId = ethers.keccak256(ethers.toUtf8Bytes("order-789"));
const tokenAddress = "0x...";
const totalAmount = ethers.parseUnits("250", 6); // 250 USDT
const productIds = ["product-1", "product-2", "product-3"];
const apiKeyOwner = "0x...";
const commissionBps = 500;

await contract.processBatchPayment(
  orderId,
  tokenAddress,
  totalAmount,
  productIds,
  apiKeyOwner,
  commissionBps
);
```

## Admin Functions

### Add Supported Token
```javascript
await contract.addSupportedToken("0x...TOKEN_ADDRESS");
```

### Update Hot Wallet
```javascript
await contract.updateHotWallet("0x...NEW_HOT_WALLET");
```

### Pause/Unpause
```javascript
await contract.pause();
await contract.unpause();
```

### Emergency Withdrawal
```javascript
// Only if contract has balance (should normally be empty)
await contract.emergencyWithdraw("0x...TOKEN_ADDRESS");
```

## Security

- ✅ OpenZeppelin contracts for security primitives
- ✅ ReentrancyGuard on all payment functions
- ✅ Ownable for admin functions
- ✅ Pausable for emergency stops
- ✅ Input validation on all functions
- ✅ Prevents double-spending via order ID tracking

## Gas Optimization

- Batch payments for multiple products
- Efficient storage patterns
- Minimal external calls

## Events

### PaymentReceived
```solidity
event PaymentReceived(
    bytes32 indexed orderId,
    address indexed buyer,
    address indexed token,
    uint256 amount,
    uint256 platformFee,
    address apiKeyOwner,
    uint256 commission,
    string productId
);
```

Backend listens for this event to confirm orders instantly.

## File Structure

```
smart-contracts/
├── contracts/
│   └── OxMartPayment.sol       # Main payment contract
├── scripts/
│   ├── deploy.ts                # Deployment script
│   └── addTokens.ts             # Token configuration script
├── test/
│   └── OxMartPayment.test.ts    # Contract tests (to be created)
├── deployments/                 # Deployment records (generated)
├── hardhat.config.ts            # Hardhat configuration
├── .env.example                 # Environment template
└── README.md                    # This file
```

## Next Steps

1. ✅ Contract developed and deployed to testnets
2. ⏳ Write comprehensive test suite
3. ⏳ Backend integration (event listeners)
4. ⏳ Frontend Web3 integration
5. ⏳ Security audit
6. ⏳ Mainnet deployment

## Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Ethers.js v6 Documentation](https://docs.ethers.org/v6/)

## Support

For questions or issues, refer to the main project documentation or contact the development team.
