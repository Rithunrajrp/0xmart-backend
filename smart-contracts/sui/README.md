# 0xMart Payment Contract - Sui Network

This directory contains the Sui Move smart contract for processing payments on the 0xMart platform.

## Prerequisites

1. **Install Sui CLI**
   ```bash
   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui
   ```

2. **Create a Sui Wallet**
   ```bash
   sui client new-address ed25519
   ```

3. **Get Testnet SUI Tokens**
   - Join Sui Discord: https://discord.gg/sui
   - Request tokens in #testnet-faucet channel
   - Or use: `sui client faucet`

4. **Install Dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

## Environment Variables

Create a `.env` file in this directory:

```env
# Hot wallet address to receive payments
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

## Contract Overview

The `oxmart::payment` module provides:

- **Payment Processing**: Accept single and batch payments in supported stablecoins
- **Order Deduplication**: Prevent duplicate order processing
- **Hot Wallet Integration**: Automatic transfer to hot wallet
- **Platform Fees**: Configurable platform fee (basis points)
- **Commission Tracking**: Track API partner commissions
- **Token Management**: Admin can add/remove supported tokens
- **Pause Mechanism**: Emergency pause functionality
- **Admin Controls**: Hot wallet updates, fee adjustments

## Deployment

### Step 1: Build the Contract

```bash
sui move build
```

This will compile the Move code and check for errors.

### Step 2: Run Tests (Optional)

```bash
sui move test
```

### Step 3: Deploy to Testnet

```bash
# Publish the package
sui client publish --gas-budget 100000000

# Or use the npm script (after manual publish)
npm run deploy:testnet
```

**Important**: After publishing, note the:
- `Package ID` - The published package identifier
- `SharedObject` - The PaymentConfig object ID

Update your `.env` file:
```env
SUI_PACKAGE_ID=0x<package_id>
SUI_CONFIG_OBJECT_ID=0x<config_object_id>
```

### Step 4: Add Supported Tokens

Update `scripts/add-tokens.ts` with actual token type addresses, then run:

```bash
npm run add-tokens:testnet
```

## Usage Examples

### Initialize Payment Contract

The contract is automatically initialized during deployment with:
- Admin: Deployer address
- Hot Wallet: From `SUI_HOT_WALLET_ADDRESS`
- Platform Fee: 0 basis points (0%)

### Process a Payment

```typescript
import { TransactionBlock } from '@mysten/sui.js/transactions';

const tx = new TransactionBlock();

// Transfer coin to payment function
tx.moveCall({
  target: `${packageId}::payment::process_payment`,
  typeArguments: ['0x2::sui::SUI'], // or stablecoin type
  arguments: [
    tx.object(configObjectId),           // PaymentConfig
    tx.pure([1, 2, 3, 4, 5, 6]),         // order_id as bytes
    coinObject,                           // Coin<T> to pay with
    tx.pure('product-123'),               // product_id
    tx.pure('0x...'),                     // api_key_owner address
    tx.pure(500),                         // commission_bps (5%)
  ],
});

const result = await client.signAndExecuteTransactionBlock({
  signer: keypair,
  transactionBlock: tx,
});
```

### Add a Supported Token (Admin Only)

```typescript
const tx = new TransactionBlock();

tx.moveCall({
  target: `${packageId}::payment::add_supported_token`,
  typeArguments: ['0x...::usdc::USDC'],
  arguments: [tx.object(configObjectId)],
});
```

### Update Platform Fee (Admin Only)

```typescript
const tx = new TransactionBlock();

tx.moveCall({
  target: `${packageId}::payment::update_platform_fee`,
  arguments: [
    tx.object(configObjectId),
    tx.pure(200), // 2% fee (200 basis points)
  ],
});
```

### Pause Contract (Admin Only)

```typescript
const tx = new TransactionBlock();

tx.moveCall({
  target: `${packageId}::payment::pause`,
  arguments: [tx.object(configObjectId)],
});
```

## Query Contract State

### Check if Token is Supported

```bash
sui client call \
  --package $PACKAGE_ID \
  --module payment \
  --function is_token_supported \
  --args $CONFIG_OBJECT_ID "0x...::usdc::USDC"
```

### Get Hot Wallet Address

```bash
sui client call \
  --package $PACKAGE_ID \
  --module payment \
  --function get_hot_wallet \
  --args $CONFIG_OBJECT_ID
```

### Get Platform Fee

```bash
sui client call \
  --package $PACKAGE_ID \
  --module payment \
  --function get_platform_fee \
  --args $CONFIG_OBJECT_ID
```

### Check if Order is Processed

```bash
sui client call \
  --package $PACKAGE_ID \
  --module payment \
  --function is_order_processed \
  --args $CONFIG_OBJECT_ID "[1,2,3,4,5,6]"
```

## Events

The contract emits the following events:

### PaymentReceived
```move
struct PaymentReceived {
    order_id: vector<u8>,
    buyer: address,
    token_type: String,
    amount: u64,
    platform_fee: u64,
    api_key_owner: address,
    commission: u64,
    commission_bps: u64,
    product_id: String,
}
```

### HotWalletUpdated
```move
struct HotWalletUpdated {
    old_wallet: address,
    new_wallet: address,
}
```

### TokenSupportChanged
```move
struct TokenSupportChanged {
    token_type: String,
    is_supported: bool,
}
```

### PlatformFeeUpdated
```move
struct PlatformFeeUpdated {
    old_fee_bps: u64,
    new_fee_bps: u64,
}
```

## Mainnet Deployment

1. Ensure you have mainnet SUI tokens for gas
2. Update `.env` with mainnet configuration
3. Deploy:
   ```bash
   sui client publish --gas-budget 100000000
   npm run deploy:mainnet
   ```
4. Add tokens:
   ```bash
   npm run add-tokens:mainnet
   ```

## Security Considerations

- **Admin Key Management**: Store admin private keys securely (use hardware wallet in production)
- **Hot Wallet Security**: Use a secure hot wallet with monitoring
- **Token Verification**: Only add verified stablecoin contracts
- **Fee Limits**: Maximum platform fee is 10% (1000 basis points)
- **Order IDs**: Use cryptographically secure random bytes for order IDs
- **Pause Mechanism**: Test pause/unpause flow before mainnet deployment

## Troubleshooting

### "Insufficient gas" error
Increase gas budget: `--gas-budget 200000000`

### "Object not found" error
Verify the config object ID is correct and the object is shared

### "Type mismatch" error
Ensure token type addresses are correct and match the deployed contracts

### "Not authorized" error
Verify you're using the admin keypair for admin functions

## Resources

- [Sui Documentation](https://docs.sui.io/)
- [Move Language Book](https://move-language.github.io/move/)
- [Sui TypeScript SDK](https://sdk.mystenlabs.com/typescript)
- [Sui Explorer](https://suiexplorer.com/)
