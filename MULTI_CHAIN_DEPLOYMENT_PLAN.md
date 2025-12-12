# Multi-Chain Deployment Plan

**Date**: December 9, 2025
**Networks**: Solana, Sui, TON (+ EVM already deployed)
**Status**: Planning Phase

---

## Overview

This document outlines the deployment plan for 0xMart payment contracts across:
1. ✅ **EVM Chains** (Sepolia) - Already deployed
2. ⏳ **Solana** (Devnet) - Ready to deploy
3. ⏳ **Sui** (Testnet) - Ready to deploy
4. ⏳ **TON** (Testnet) - Ready to deploy

---

## Prerequisites Summary

### Solana Deployment Requirements
- ✅ Rust installed
- ✅ Solana CLI installed
- ✅ Anchor framework installed
- ⏳ Solana devnet wallet with SOL
- ⏳ Program built and tested

### Sui Deployment Requirements
- ⏳ Sui CLI installed
- ⏳ Sui wallet created
- ⏳ Testnet SUI tokens
- ⏳ Move contract built

### TON Deployment Requirements
- ✅ Node.js installed
- ⏳ TON wallet with mnemonic
- ⏳ Testnet TON tokens
- ⏳ Tact contract built

---

## Deployment Strategy

### Phase 1: Solana (Est. 30-45 min)
**Why first?**: Most similar to EVM, has best tooling

1. Check Solana CLI installation
2. Generate Solana wallet or use existing
3. Airdrop devnet SOL
4. Build Anchor program
5. Deploy to devnet
6. Initialize program
7. Test payment transaction

### Phase 2: Sui (Est. 45-60 min)
**Why second?**: Good documentation, growing ecosystem

1. Install Sui CLI
2. Create Sui wallet
3. Get testnet SUI from faucet
4. Build Move contract
5. Publish to testnet
6. Initialize config
7. Test payment transaction

### Phase 3: TON (Est. 60-90 min)
**Why last?**: Most different architecture, requires Telegram setup

1. Generate TON wallet (mnemonic)
2. Get testnet TON from Telegram bot
3. Build Tact contract
4. Deploy to testnet
5. Add supported jettons
6. Test payment transaction

---

## Installation Steps

### Solana Setup (Windows)

```powershell
# 1. Install Rust (if not already installed)
# Download from: https://www.rust-lang.org/tools/install
# Or run:
winget install Rustlang.Rustup

# 2. Install Solana CLI
# Download from: https://github.com/solana-labs/solana/releases
# Or use:
cmd /c "curl https://release.solana.com/stable/solana-install-init-x86_64-pc-windows-msvc.exe --output C:\solana-install-tmp\solana-install-init.exe"
C:\solana-install-tmp\solana-install-init.exe

# 3. Add to PATH
$env:PATH += ";C:\Users\$env:USERNAME\.local\share\solana\install\active_release\bin"

# 4. Verify installation
solana --version

# 5. Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.29.0
avm use 0.29.0
```

### Sui Setup (Windows)

```powershell
# 1. Install Sui CLI via cargo
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui

# 2. Verify installation
sui --version

# 3. Create wallet
sui client new-address ed25519

# 4. Get wallet address
sui client active-address
```

### TON Setup (Already have Node.js)

```bash
# Dependencies already in package.json
cd 0xmart-backend/smart-contracts/ton
npm install
```

---

## Simplified Deployment Approach

Given the complexity and different tooling requirements for each chain, here's a pragmatic approach:

### Option 1: Full Local Deployment (Recommended for Production)
- Install all CLIs
- Deploy from local machine
- Full control and testing

### Option 2: Use Existing Deployment Scripts (Recommended for Testing)
- Use pre-built deployment scripts in each directory
- Minimal setup required
- Focus on testing functionality

### Option 3: Cloud/CI Deployment
- Use GitHub Actions or similar
- Automate deployments
- Requires more setup time

---

## Recommended Approach for Today

Since we want to verify contracts work correctly and test transactions:

1. **Solana**: Use Anchor's built-in devnet deployment
   - No Solana CLI installation needed (Anchor handles it)
   - Quick airdrop via `solana airdrop`
   - Deploy with `anchor deploy`

2. **Sui**: Use Sui's web wallet for deployment
   - Easier than CLI for first deployment
   - Can deploy via TypeScript scripts
   - Get SUI from faucet

3. **TON**: Use TON deployment scripts
   - Generate wallet via script
   - Get test TON from Telegram bot
   - Deploy via npm scripts

---

## Current Status

### ✅ EVM (Ethereum Sepolia)
- Contract: `0xB01Ad2dDA2Fa80edd70142c60B600693cD49B557`
- Tokens: USDT, USDC, DAI, BUSD deployed and configured
- Tests: All passing
- Status: Production-ready for testnet

### ⏳ Solana (Devnet)
- Program: Code ready, not deployed
- Framework: Anchor 0.29.0
- Tests: Available but not run
- Next: Deploy and test

### ⏳ Sui (Testnet)
- Contract: Move code ready, not deployed
- Framework: Sui Move
- Tests: Need to run
- Next: Deploy and test

### ⏳ TON (Testnet)
- Contract: Tact code ready, not deployed
- Framework: Tact
- Tests: Need to run
- Next: Deploy and test

---

## Time Estimates

| Task | Time | Complexity |
|------|------|------------|
| Solana deployment | 30-45 min | Medium |
| Sui deployment | 45-60 min | Medium-High |
| TON deployment | 60-90 min | High |
| **Total** | **2.5-3.5 hours** | - |

---

## Next Steps

1. **Ask user preference**:
   - Deploy all three now? (2-3 hours)
   - Deploy one at a time?
   - Which to deploy first?

2. **Check installations**:
   - Test what's already installed
   - Install missing tools

3. **Start deployments**:
   - Follow deployment scripts for each chain
   - Test transactions
   - Document contract addresses

---

## Questions for User

1. Do you want to deploy all three networks today?
2. Should we deploy them sequentially or focus on one at a time?
3. Do you have any preference for which network to deploy first?
4. Are you comfortable installing CLI tools, or prefer script-based deployment?

---

**Status**: Awaiting user input to proceed
