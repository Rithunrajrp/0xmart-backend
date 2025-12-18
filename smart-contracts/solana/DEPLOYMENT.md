# Solana Program Deployment Guide

## Prerequisites

### 1. Install Solana CLI

**Windows (PowerShell as Administrator)**:
```powershell
cmd /c "curl https://release.solana.com/stable/solana-install-init-x86_64-pc-windows-msvc.exe --output C:\solana-install-tmp\solana-install-init.exe"
C:\solana-install-tmp\solana-install-init.exe v1.18.0
```

**Linux/macOS**:
```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```

Add to PATH and verify:
```bash
solana --version
```

### 2. Install Rust (if not already installed)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 3. Install Solana Build Tools

```bash
cargo install --git https://github.com/solana-labs/cargo-build-sbf --tag v1.18.0 cargo-build-sbf
```

## Deployment Steps

### Step 1: Configure Solana CLI

Set to devnet:
```bash
solana config set --url devnet
```

Set your wallet:
```bash
solana config set --keypair E:\company\0xMart\0xmart-application\0xmart-backend\smart-contracts\solana-wallet.json
```

Verify configuration:
```bash
solana config get
```

Expected output:
```
Config File: C:\Users\<user>\.config\solana\cli\config.yml
RPC URL: https://api.devnet.solana.com
WebSocket URL: wss://api.devnet.solana.com/ (computed)
Keypair Path: E:\company\0xMart\0xmart-application\0xmart-backend\smart-contracts\solana-wallet.json
Commitment: confirmed
```

### Step 2: Check Wallet Balance

```bash
solana balance
```

You should have at least 2-3 SOL for deployment. If not, request from faucet:
```bash
solana airdrop 2
```

### Step 3: Build the Program

```bash
cd smart-contracts/solana
cargo build-sbf
```

This creates: `target/deploy/oxmart_payment.so`

### Step 4: Deploy to Devnet

```bash
solana program deploy target/deploy/oxmart_payment.so
```

**Expected Output**:
```
Program Id: <PROGRAM_ID>
```

**IMPORTANT**: Copy the Program ID and save it!

### Step 5: Update Program ID

Edit `src/lib.rs` and replace the program ID:

```rust
solana_program::declare_id!("<YOUR_PROGRAM_ID>");
```

### Step 6: Rebuild and Upgrade (Optional)

If you need to update the program ID in the binary:

```bash
cargo build-sbf
solana program deploy target/deploy/oxmart_payment.so --program-id <YOUR_PROGRAM_ID>
```

## Post-Deployment

### 1. Verify Deployment

Check program account:
```bash
solana program show <PROGRAM_ID>
```

View on Solana Explorer:
```
https://explorer.solana.com/address/<PROGRAM_ID>?cluster=devnet
```

### 2. Initialize the Program

You'll need to create a TypeScript/JavaScript client to initialize the program with:
- Hot wallet address
- Add supported tokens (USDC, USDT, etc.)

Example initialization (pseudocode):
```typescript
// 1. Initialize config
await program.methods
  .initialize(hotWalletPubkey)
  .accounts({
    authority: wallet.publicKey,
    config: configPDA,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

// 2. Add USDC as supported token
await program.methods
  .addSupportedToken(usdcMintDevnet)
  .accounts({
    authority: wallet.publicKey,
    config: configPDA,
    supportedToken: usdcTokenPDA,
    mint: usdcMintDevnet,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

### 3. Update Environment Variables

Add to `.env`:
```bash
SOLANA_DEVNET_PROGRAM_ID=<YOUR_PROGRAM_ID>
SOLANA_DEVNET_CONFIG_PDA=<CONFIG_PDA_ADDRESS>
```

## Devnet Token Mints

Common stablecoins on Solana devnet:

- **USDC (devnet)**: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- **USDT (you may need to create a test token)**

To create test tokens, use:
```bash
spl-token create-token
spl-token create-account <TOKEN_MINT>
spl-token mint <TOKEN_MINT> <AMOUNT>
```

## Troubleshooting

### Error: "Insufficient funds"
```bash
solana airdrop 2
```

### Error: "Program account does not exist"
Make sure you're on the correct cluster:
```bash
solana config set --url devnet
```

### Error: "cargo-build-sbf not found"
Install build tools:
```bash
cargo install --git https://github.com/solana-labs/cargo-build-sbf cargo-build-sbf
```

### Check Program Logs
```bash
solana logs <PROGRAM_ID>
```

## Testing

### Unit Tests
```bash
cargo test
```

### Integration Tests with Local Validator

Start local validator:
```bash
solana-test-validator
```

In another terminal:
```bash
solana config set --url localhost
cargo test-sbf
```

## Upgrade Program

To upgrade an existing program:

```bash
cargo build-sbf
solana program deploy target/deploy/oxmart_payment.so --program-id <EXISTING_PROGRAM_ID>
```

**Note**: Only the upgrade authority can upgrade the program.

## Close Program (Clean Up)

To close the program and reclaim rent:
```bash
solana program close <PROGRAM_ID>
```

## Wallet Information

**Devnet Wallet**:
- Address: `71jYLbrjnbksLZJ5qCn3b6Xmrr2426xqPJKUHfUSZjWT`
- Keypair: `smart-contracts/solana-wallet.json`
- Balance: 2.5 SOL (testnet)

## Resources

- Solana CLI: https://docs.solana.com/cli
- Solana Program Library: https://spl.solana.com/
- Explorer: https://explorer.solana.com/?cluster=devnet
- Faucet: https://faucet.solana.com/

## Next Steps

1. Install Solana CLI tools
2. Build the program: `cargo build-sbf`
3. Deploy to devnet
4. Initialize with hot wallet
5. Add supported tokens
6. Test payment processing

---

**Status**: Code complete ✓ | Ready for deployment ⏳
