# Backend Integration Guide - Smart Contract Deployment

**Date**: December 9, 2025
**Network**: Sepolia Testnet (Ethereum)
**Status**: ✅ Ready for Integration

---

## 🎉 Deployment Summary

Your OxMartPayment smart contract is now live on Sepolia testnet with all functionality tested and verified!

### Deployed Contracts

#### Payment Contract
- **Address**: `0xB01Ad2dDA2Fa80edd70142c60B600693cD49B557`
- **Network**: Sepolia (Ethereum Testnet)
- **Chain ID**: 11155111
- **Deployer**: 0x444dB037770Fe4583188f9A4807d356D8352Bd18
- **Hot Wallet**: 0x444dB037770Fe4583188f9A4807d356D8352Bd18
- **Etherscan**: https://sepolia.etherscan.io/address/0xB01Ad2dDA2Fa80edd70142c60B600693cD49B557

#### Mock Stablecoins (Test Tokens)

| Token | Address | Decimals | Etherscan |
|-------|---------|----------|-----------|
| USDT | `0xC3f4d3E184c54947Bb60a5B3751F69acd3F79363` | 6 | [View](https://sepolia.etherscan.io/address/0xC3f4d3E184c54947Bb60a5B3751F69acd3F79363) |
| USDC | `0x9Ee3b1D73B6C2370Da6Ac7e5688B9aC495104383` | 6 | [View](https://sepolia.etherscan.io/address/0x9Ee3b1D73B6C2370Da6Ac7e5688B9aC495104383) |
| DAI | `0x4016859e142e9Ed9DE77F718c986EeC31bbBcD61` | 18 | [View](https://sepolia.etherscan.io/address/0x4016859e142e9Ed9DE77F718c986EeC31bbBcD61) |
| BUSD | `0xE66dDDbb1FDCF7F57f4b775c9C05f749CbCc4291` | 18 | [View](https://sepolia.etherscan.io/address/0xE66dDDbb1FDCF7F57f4b775c9C05f749CbCc4291) |

---

## 📝 Step 1: Update Backend Environment Variables

### Location
Update the `.env` file in: `0xmart-backend/.env`

### Add These Variables

```env
# Smart Contract Configuration - Sepolia Testnet
ETHEREUM_SEPOLIA_CONTRACT_ADDRESS=0xB01Ad2dDA2Fa80edd70142c60B600693cD49B557
ETHEREUM_SEPOLIA_HOT_WALLET=0x444dB037770Fe4583188f9A4807d356D8352Bd18

# RPC URL (if not already set)
ETHEREUM_SEPOLIA_RPC_URL=https://sepolia.drpc.org

# Test Token Addresses (Sepolia)
SEPOLIA_USDT_ADDRESS=0xC3f4d3E184c54947Bb60a5B3751F69acd3F79363
SEPOLIA_USDC_ADDRESS=0x9Ee3b1D73B6C2370Da6Ac7e5688B9aC495104383
SEPOLIA_DAI_ADDRESS=0x4016859e142e9Ed9DE77F718c986EeC31bbBcD61
SEPOLIA_BUSD_ADDRESS=0xE66dDDbb1FDCF7F57f4b775c9C05f749CbCc4291

# Network Configuration
ETHEREUM_SEPOLIA_CHAIN_ID=11155111
ETHEREUM_SEPOLIA_NETWORK_NAME=sepolia
```

---

## 📄 Step 2: Contract ABI

The contract ABI is needed for the backend to interact with the smart contract.

### Location
Create/update: `0xmart-backend/src/common/contracts/OxMartPayment.json`

I'll copy the ABI from the deployment artifacts.

### Key Functions for Backend

1. **processPayment** - Process single payment
2. **processBatchPayment** - Process cart payment
3. **supportedTokens** - Check if token is supported
4. **processedOrders** - Check if order already paid
5. **hotWallet** - Get hot wallet address
6. **platformFeeBps** - Get platform fee

### Key Events

1. **PaymentReceived** - Emitted when payment is processed
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

---

## 🔧 Step 3: Update SmartContractService

### Location
`0xmart-backend/src/common/services/smart-contract.service.ts`

### Updates Needed

1. **Add Sepolia Contract Address**
   ```typescript
   private getContractAddress(network: NetworkType): string {
     switch (network) {
       case NetworkType.ETHEREUM:
         return process.env.ETHEREUM_SEPOLIA_CONTRACT_ADDRESS;
       // ... other networks
     }
   }
   ```

2. **Verify the RPC providers are initialized** for Sepolia

3. **Test contract connection**

---

## 🎧 Step 4: Update BlockchainEventListenerService

### Location
`0xmart-backend/src/common/services/blockchain-event-listener.service.ts`

### What This Service Does

1. **Listens for PaymentReceived events** on the smart contract
2. **Updates transaction status** in database
3. **Marks orders as paid**
4. **Credits API key owner commissions**
5. **Triggers webhooks** to developers

### Testing the Event Listener

1. Start the backend:
   ```bash
   cd 0xmart-backend
   npm run start:dev
   ```

2. The event listener should automatically:
   - Connect to Sepolia RPC
   - Subscribe to PaymentReceived events
   - Log connection status

3. Look for these logs:
   ```
   [BlockchainEventListener] Initializing event listeners...
   [BlockchainEventListener] Connected to ETHEREUM network
   [BlockchainEventListener] Listening for PaymentReceived events on 0xB01...
   ```

---

## 🧪 Step 5: Testing Integration

### Test 1: Check Contract Connection

Create a test script: `0xmart-backend/src/scripts/test-contract-connection.ts`

```typescript
import { ethers } from 'ethers';

async function testConnection() {
  const provider = new ethers.JsonRpcProvider(
    process.env.ETHEREUM_SEPOLIA_RPC_URL
  );

  const contractAddress = process.env.ETHEREUM_SEPOLIA_CONTRACT_ADDRESS;
  const abi = [
    "function hotWallet() view returns (address)",
    "function platformFeeBps() view returns (uint256)",
    "function supportedTokens(address) view returns (bool)"
  ];

  const contract = new ethers.Contract(contractAddress, abi, provider);

  console.log('Testing contract connection...');
  console.log('Hot Wallet:', await contract.hotWallet());
  console.log('Platform Fee:', await contract.platformFeeBps());
  console.log('USDT Supported:', await contract.supportedTokens(
    process.env.SEPOLIA_USDT_ADDRESS
  ));
}

testConnection();
```

Run:
```bash
npx ts-node src/scripts/test-contract-connection.ts
```

### Test 2: Monitor Events

The event listener should automatically log when it detects payments.

Trigger a test payment from the frontend or via the contract directly, and watch the backend logs.

Expected log:
```
[BlockchainEventListener] PaymentReceived event detected
[BlockchainEventListener] Order ID: 0xfaef...
[BlockchainEventListener] Buyer: 0x444d...
[BlockchainEventListener] Amount: 100000000 (100 USDT)
[BlockchainEventListener] Updating transaction in database...
```

### Test 3: API Key Integration

Test the external payment flow:

1. **Create API key** via POST `/api/v1/api-keys`
2. **Initiate payment** via POST `/api/v1/payment/initiate`
3. **Process payment** on blockchain
4. **Verify commission** was credited to API key owner

---

## 📊 Step 6: Database Updates

### Ensure These Tables Have Smart Contract Fields

From your Prisma schema, verify these fields exist:

**Transaction Model:**
- `smartContractAddress` - Contract used
- `blockNumber` - Block number
- `blockTimestamp` - Block timestamp
- `gasUsed` - Gas used
- `confirmations` - Number of confirmations
- `apiKeyId` - API key that initiated
- `platformFee` - Platform fee deducted
- `apiCommission` - Commission amount

**ApiKey Model:**
- `supportedNetworks` - Networks this key supports

If these fields are missing, run:
```bash
npx prisma migrate dev
npx prisma generate
```

---

## 🔗 Step 7: Frontend Integration

### Contract Addresses for Frontend

Update `0xmart-web/.env.local`:

```env
NEXT_PUBLIC_SEPOLIA_CONTRACT_ADDRESS=0xB01Ad2dDA2Fa80edd70142c60B600693cD49B557
NEXT_PUBLIC_SEPOLIA_USDT_ADDRESS=0xC3f4d3E184c54947Bb60a5B3751F69acd3F79363
NEXT_PUBLIC_SEPOLIA_USDC_ADDRESS=0x9Ee3b1D73B6C2370Da6Ac7e5688B9aC495104383
NEXT_PUBLIC_SEPOLIA_DAI_ADDRESS=0x4016859e142e9Ed9DE77F718c986EeC31bbBcD61
NEXT_PUBLIC_SEPOLIA_BUSD_ADDRESS=0xE66dDDbb1FDCF7F57f4b775c9C05f749CbCc4291
```

### Wallet Integration

The frontend needs to:
1. Connect to MetaMask or other wallet
2. Switch to Sepolia network
3. Call `processPayment` on the contract
4. Handle transaction confirmation

---

## ✅ Integration Checklist

### Backend Configuration
- [ ] Add contract addresses to `.env`
- [ ] Add RPC URL to `.env`
- [ ] Add token addresses to `.env`
- [ ] Copy contract ABI to backend
- [ ] Update SmartContractService
- [ ] Verify BlockchainEventListenerService is running

### Testing
- [ ] Test contract connection
- [ ] Test event listener
- [ ] Test payment processing
- [ ] Test commission crediting
- [ ] Test webhook notifications

### Frontend
- [ ] Add contract addresses to frontend `.env`
- [ ] Integrate wallet connection (MetaMask)
- [ ] Implement payment flow
- [ ] Test end-to-end payment

### Database
- [ ] Run Prisma migrations if needed
- [ ] Verify transaction fields exist
- [ ] Test data storage

---

## 📚 Reference Information

### Contract Functions (Read)

```typescript
// Get hot wallet address
function hotWallet() external view returns (address)

// Get platform fee in basis points
function platformFeeBps() external view returns (uint256)

// Check if token is supported
function supportedTokens(address token) external view returns (bool)

// Check if order has been processed
function processedOrders(bytes32 orderId) external view returns (bool)

// Get owner address
function owner() external view returns (address)

// Check if paused
function paused() external view returns (bool)
```

### Contract Functions (Write)

```typescript
// Process single payment
function processPayment(
    bytes32 orderId,
    address token,
    uint256 amount,
    string calldata productId,
    address apiKeyOwner,
    uint256 commissionBps
) external

// Process batch payment
function processBatchPayment(
    bytes32 orderId,
    address token,
    uint256 totalAmount,
    string[] calldata productIds,
    address apiKeyOwner,
    uint256 commissionBps
) external
```

### Event Structure

```typescript
interface PaymentReceivedEvent {
  orderId: string;        // bytes32
  buyer: string;          // address
  token: string;          // address
  amount: BigNumber;      // uint256
  platformFee: BigNumber; // uint256
  apiKeyOwner: string;    // address
  commission: BigNumber;  // uint256
  productId: string;      // string
}
```

---

## 🐛 Troubleshooting

### Issue: Event listener not connecting
**Solution**:
- Check RPC URL is correct
- Verify contract address is correct
- Check network is accessible

### Issue: Events not being received
**Solution**:
- Verify WebSocket connection (use wss:// URL if available)
- Check fallback polling is enabled
- Verify contract has been deployed

### Issue: Transaction not updating in database
**Solution**:
- Check event parsing logic
- Verify transaction ID matches
- Check database connection

---

## 📞 Next Steps

1. **Start Backend**: `npm run start:dev`
2. **Test Contract Connection**: Run test script
3. **Monitor Logs**: Watch for event listener connection
4. **Test Payment**: Process a test payment
5. **Verify Database**: Check transaction was recorded

---

## 🎯 Ready to Integrate!

Everything is set up and ready. The contract is deployed, tested, and waiting for your backend to connect.

**Contract Address**: `0xB01Ad2dDA2Fa80edd70142c60B600693cD49B557`
**Network**: Sepolia
**Status**: ✅ Live and Ready

**For the next session:**
- We can deploy Solana, Sui, or TON contracts
- Test multi-chain payment flows
- Implement frontend wallet integration

---

**Questions?**
- Check the contract on Etherscan
- Review the test transaction
- Check deployment files in `smart-contracts/deployments/`

Good luck with the integration! 🚀
