# 0xMart Payment Contract - TON Network

This directory contains the TON Tact smart contract for processing payments on the 0xMart platform.

## Prerequisites

1. **Install Node.js** (v18 or higher)
   ```bash
   node --version  # Should be >= 18
   ```

2. **Install Dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Get TON Wallet**
   - For testnet: Use @testgiver_ton_bot on Telegram
   - For mainnet: Use Tonkeeper, TON Wallet, or other TON wallets

4. **Get Testnet Tokens** (for testing)
   - Message @testgiver_ton_bot on Telegram with your address

## Environment Variables

Create a `.env` file in this directory:

```env
# Hot wallet address to receive payments (user-friendly format)
TON_HOT_WALLET_ADDRESS=UQC...

# Deployer wallet mnemonic (24 words)
TON_DEPLOYER_MNEMONIC="word1 word2 word3 ... word24"

# Admin wallet mnemonic (can be same as deployer)
TON_ADMIN_MNEMONIC="word1 word2 word3 ... word24"

# TonCenter API key (optional, for higher rate limits)
# Get from: https://toncenter.com/api/v2/
TONCENTER_API_KEY=...

# After deployment, add this:
TON_CONTRACT_ADDRESS=EQC...
```

## Contract Overview

The `OxMartPayment` contract provides:

- **Payment Processing**: Accept single and batch payments in supported jettons
- **Order Deduplication**: Prevent duplicate order processing
- **Hot Wallet Integration**: Automatic transfer to hot wallet
- **Platform Fees**: Configurable platform fee (basis points)
- **Commission Tracking**: Track API partner commissions
- **Jetton Management**: Admin can add/remove supported jettons
- **Pause Mechanism**: Emergency pause functionality
- **Admin Controls**: Hot wallet updates, fee adjustments

## TON-Specific Features

- **Message-Based Architecture**: Uses TON's message passing model
- **Jetton Support**: Compatible with TON's jetton standard (similar to ERC-20)
- **Gas Optimization**: Efficient message handling and storage
- **Ownable**: Built-in ownership management from Tact standard library

## Deployment

### Step 1: Generate Wallet (if needed)

If you don't have a deployment wallet, the script will generate one:

```bash
npm run deploy:testnet
```

Save the generated mnemonic in your `.env` file.

### Step 2: Fund the Deployer Wallet

For **testnet**:
1. Copy your deployer address from the script output
2. Message @testgiver_ton_bot on Telegram: `Your_Address`
3. Wait for confirmation

For **mainnet**:
1. Send at least 1 TON to the deployer address
2. Keep extra TON for future operations

### Step 3: Build the Contract

```bash
npm run build
```

This compiles the Tact code to FunC and then to TON bytecode.

### Step 4: Deploy

The deployment process with Tact:

1. **Build generates deployment code**:
   ```bash
   npm run build
   ```

2. **Review build output** in `./build/` directory:
   - `oxmart_payment.code.fc` - FunC code
   - `oxmart_payment.code.boc` - Compiled bytecode
   - `oxmart_payment.ts` - TypeScript wrapper

3. **Deploy using the generated code**:
   ```typescript
   // The build generates a complete deployment wrapper
   // Follow the instructions in build/oxmart_payment.ts
   ```

4. **Update `.env`** with contract address:
   ```env
   TON_CONTRACT_ADDRESS=EQC...
   ```

### Step 5: Add Supported Jettons

Update `scripts/add-tokens.ts` with actual jetton master contract addresses, then run:

```bash
npm run add-tokens:testnet
```

## Contract Interface

### Messages

#### ProcessPayment
Process a single payment:
```tact
message ProcessPayment {
    orderId: String;
    tokenAddress: Address;
    amount: Int as coins;
    productId: String;
    apiKeyOwner: Address;
    commissionBps: Int as uint16;
}
```

#### ProcessBatchPayment
Process multiple products in one transaction:
```tact
message ProcessBatchPayment {
    orderId: String;
    tokenAddress: Address;
    totalAmount: Int as coins;
    productIds: map<Int, String>;
    apiKeyOwner: Address;
    commissionBps: Int as uint16;
}
```

#### Admin Messages
```tact
message UpdateHotWallet {
    newHotWallet: Address;
}

message UpdatePlatformFee {
    newFeeBps: Int as uint16;
}

message AddSupportedToken {
    tokenAddress: Address;
}

message RemoveSupportedToken {
    tokenAddress: Address;
}

message PauseContract {}
message UnpauseContract {}
message EmergencyWithdraw {
    tokenAddress: Address;
}
```

### Getter Methods

```tact
get fun hotWallet(): Address
get fun platformFeeBps(): Int
get fun isPaused(): Bool
get fun isTokenSupported(tokenAddress: Address): Bool
get fun isOrderProcessed(orderId: String): Bool
```

## Usage Examples

### Send Payment Message

```typescript
import { Address, toNano } from '@ton/core';

// Prepare payment message
const payment = {
  orderId: 'order-12345',
  tokenAddress: Address.parse('EQC...'), // Jetton master address
  amount: toNano('100'), // 100 USDT
  productId: 'product-abc',
  apiKeyOwner: Address.parse('UQC...'),
  commissionBps: 500, // 5%
};

// Send to contract
await wallet.sendTransfer({
  to: contractAddress,
  value: toNano('0.1'), // Gas fee
  body: // ProcessPayment message body
});
```

### Add Supported Jetton (Admin)

```typescript
import { beginCell, Address } from '@ton/core';

const body = beginCell()
  .storeUint(0, 32)  // op for AddSupportedToken
  .storeAddress(jettonMasterAddress)
  .endCell();

await wallet.sendTransfer({
  to: contractAddress,
  value: toNano('0.05'),
  body,
});
```

### Update Platform Fee (Admin)

```typescript
const body = beginCell()
  .storeUint(0, 32)  // op for UpdatePlatformFee
  .storeUint(200, 16)  // 2% fee
  .endCell();

await wallet.sendTransfer({
  to: contractAddress,
  value: toNano('0.05'),
  body,
});
```

### Query Contract State

Using TON Client:

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

// Check if token is supported
const isSupported = await client.runMethod(
  contractAddress,
  'isTokenSupported',
  [{ type: 'slice', cell: jettonAddress }]
);
```

## Events

The contract emits events via `emit()`:

### PaymentReceived
```tact
emit(PaymentReceived{
    orderId: String,
    buyer: Address,
    tokenAddress: Address,
    amount: Int,
    platformFee: Int,
    apiKeyOwner: Address,
    commission: Int,
    commissionBps: Int,
    productId: String
}.toCell());
```

Events can be tracked by:
- Monitoring transaction logs
- Using TonAPI or other indexers
- Listening to contract events via TON Connect

## Jetton Integration

### How Jetton Payments Work in TON

1. **User's Jetton Wallet** → Sends jettons to contract's jetton wallet
2. **Contract's Jetton Wallet** → Notifies the contract via internal message
3. **Contract** → Processes payment and emits event
4. **Contract's Jetton Wallet** → Forwards jettons to hot wallet

### Jetton Addresses

You need the **jetton master contract address**, not the wallet address:

- **USDT (jUSDT)**: `EQC...` (update with actual)
- **USDC (jUSDC)**: `EQC...` (update with actual)
- **Other stablecoins**: Add as available on TON

Find jetton addresses:
- [TON Jetton Registry](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md)
- [DeDust Jetton List](https://dedust.io/)
- [TON Explorer](https://tonviewer.com/)

## Testing

### Local Testing

1. **Unit Tests** (using Tact testing framework):
   ```bash
   npm run test
   ```

2. **Sandbox Testing** (using TON Sandbox):
   ```typescript
   // Create test environment
   import { Blockchain } from '@ton-community/sandbox';

   const blockchain = await Blockchain.create();
   // Deploy and test contract
   ```

### Testnet Testing

1. Deploy to testnet
2. Use @testgiver_ton_bot for test TON
3. Test all functions
4. Monitor on https://testnet.tonviewer.com/

## Mainnet Deployment

1. **Audit the contract** thoroughly
2. **Test extensively** on testnet
3. **Prepare mainnet wallet** with sufficient TON
4. **Update environment**:
   ```env
   TON_HOT_WALLET_ADDRESS=<mainnet_hot_wallet>
   TON_DEPLOYER_MNEMONIC=<mainnet_deployer_mnemonic>
   ```
5. **Deploy**:
   ```bash
   npm run build
   npm run deploy:mainnet
   ```
6. **Add jettons**:
   ```bash
   npm run add-tokens:mainnet
   ```
7. **Verify** on https://tonviewer.com/

## Security Considerations

- **Mnemonic Security**: NEVER commit mnemonics to git. Use `.env` and `.gitignore`
- **Admin Key Management**: Store admin mnemonics in secure key management system
- **Hot Wallet Monitoring**: Monitor hot wallet activity and set up alerts
- **Jetton Verification**: Only add verified jetton contracts
- **Fee Limits**: Maximum platform fee is 10% (1000 basis points)
- **Order ID Security**: Use cryptographically secure random strings
- **Pause Testing**: Test pause/unpause before mainnet
- **Gas Fees**: Always send enough TON for gas (typically 0.05-0.1 TON)

## Troubleshooting

### "Wallet not deployed" error
- Fund the wallet with test TON first
- Wait for the wallet to be deployed (send TON to it)

### "Insufficient funds" error
- Check wallet balance
- Ensure enough TON for gas fees (0.1 TON minimum)

### "Contract not found" error
- Verify contract address is correct
- Check if contract is deployed on the right network

### "Invalid message" error
- Verify message structure matches contract interface
- Check that all required fields are provided
- Ensure addresses are in correct format

### "Transaction failed" error
- Check contract logs on TON Explorer
- Verify you're sending correct op codes
- Ensure gas limit is sufficient

## Resources

- [TON Documentation](https://docs.ton.org/)
- [Tact Language](https://tact-lang.org/)
- [TON TypeScript SDK](https://github.com/ton-org/ton)
- [TON Explorer](https://tonviewer.com/)
- [TON Testnet Explorer](https://testnet.tonviewer.com/)
- [TON Jettons (TEP-74)](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md)
- [Tact Standard Library](https://tact-lang.org/ref/stdlib)

## Support

For issues specific to:
- **TON Network**: [TON Dev Chat](https://t.me/tondev)
- **Tact Language**: [Tact Community](https://t.me/tactlang)
- **0xMart Contract**: Create an issue in the repository
