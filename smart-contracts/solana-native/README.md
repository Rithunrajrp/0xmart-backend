# 0xMart Payment Program for Solana

A Solana program for processing stablecoin payments with commission tracking and platform fees.

## Features

- Single payment processing with SPL tokens
- Commission tracking for API partners (configurable rate)
- Platform fee management (0-10%)
- Hot wallet integration for payment collection
- Order deduplication (prevents double-processing)
- Emergency pause mechanism
- Admin controls for token management

## Program Structure

```
src/
├── lib.rs           # Program entry point
├── entrypoint.rs    # Solana program entrypoint
├── processor.rs     # Main business logic
├── instruction.rs   # Instruction definitions
├── state.rs         # Account state structures
└── error.rs         # Custom error types
```

## Account Structure

### PaymentConfig (PDA: seeds: ["config"])
- Authority (admin public key)
- Hot wallet address
- Platform fee in basis points
- Pause state

### SupportedToken (PDA: seeds: ["token", mint_pubkey])
- Token mint address
- Is supported flag

### ProcessedOrder (PDA: seeds: ["order", order_id_hash])
- Order details and payment tracking
- Prevents duplicate processing

## Instructions

### 1. Initialize
Creates the payment configuration account.

**Accounts**:
- Authority (signer)
- Config PDA (writable)
- System program

### 2. ProcessPayment
Processes a payment and transfers tokens to hot wallet.

**Accounts**:
- Buyer (signer)
- Buyer's token account (writable)
- Hot wallet's token account (writable)
- Token mint
- Config PDA
- Supported token PDA (writable)
- Processed order PDA (writable)
- API key owner
- Token program
- System program

### 3. AddSupportedToken
Adds a token to the supported list (admin only).

### 4. RemoveSupportedToken
Removes a token from supported list (admin only).

### 5. UpdateHotWallet
Updates the hot wallet address (admin only).

### 6. UpdatePlatformFee
Updates the platform fee (admin only, max 10%).

### 7. Pause / Unpause
Emergency pause/unpause functionality (admin only).

## Building

```bash
cargo build-sbf
```

This will create the compiled program at:
`target/deploy/oxmart_payment.so`

## Deploying

### Prerequisites
1. Solana CLI installed
2. Wallet with SOL for deployment
3. Set cluster to devnet: `solana config set --url devnet`

### Deploy Command
```bash
solana program deploy target/deploy/oxmart_payment.so
```

The command will output your program ID. Update `lib.rs` with this ID and rebuild.

## Testing

Run unit tests:
```bash
cargo test
```

Run with Solana test validator:
```bash
cargo test-sbf
```

## Usage Example

### 1. Initialize the Program
```javascript
const initIx = await program.methods
  .initialize(hotWalletPubkey)
  .accounts({
    authority: authority.publicKey,
    config: configPDA,
    systemProgram: SystemProgram.programId,
  })
  .instruction();
```

### 2. Add Supported Token
```javascript
const addTokenIx = await program.methods
  .addSupportedToken(usdcMint)
  .accounts({
    authority: authority.publicKey,
    config: configPDA,
    supportedToken: tokenPDA,
    mint: usdcMint,
    systemProgram: SystemProgram.programId,
  })
  .instruction();
```

### 3. Process Payment
```javascript
const paymentIx = await program.methods
  .processPayment("order-123", new BN(1000000), "product-1", 500) // 5% commission
  .accounts({
    buyer: buyer.publicKey,
    buyerTokenAccount: buyerTokenAccount,
    hotWalletTokenAccount: hotWalletTokenAccount,
    tokenMint: usdcMint,
    config: configPDA,
    supportedToken: tokenPDA,
    processedOrder: orderPDA,
    apiKeyOwner: apiKeyOwner.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .instruction();
```

## Security Considerations

- All admin functions require authority signature
- PDAs are derived using consistent seeds
- Arithmetic overflow checks enabled
- Order deduplication prevents replay attacks
- Pause mechanism for emergency stops

## Constants

- `MAX_PLATFORM_FEE_BPS`: 1000 (10%)
- `MAX_COMMISSION_BPS`: 10000 (100%)

## Error Codes

- `InvalidInstruction` - Invalid instruction data
- `NotAuthorized` - Caller is not authorized
- `AlreadyInitialized` - Account already initialized
- `OrderAlreadyProcessed` - Order has been processed
- `TokenNotSupported` - Token is not in supported list
- `InvalidAmount` - Payment amount is zero
- `ContractPaused` - Program is paused
- `ArithmeticOverflow` - Calculation overflow

## License

MIT
