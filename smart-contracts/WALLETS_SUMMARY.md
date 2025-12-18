# 0xMart Testnet Wallets Summary

This document contains all the wallet addresses and credentials for deploying 0xMart smart contracts to Sui, Solana, and TON testnets.

## ⚠️ SECURITY WARNING

**DO NOT SHARE THESE CREDENTIALS OR COMMIT THIS FILE TO PUBLIC REPOSITORIES**

These wallets are for TESTNET ONLY. Never use these keys on mainnet or store real funds.

---

## 1. Sui Wallet (Testnet)

### Address Information
- **Address**: `0x3d543ec09b0ce4bf5f9ea4431fd0f2aac16148ad11180d09c65c704028fc8cfb`
- **Alias**: `friendly-pearl`
- **Network**: Sui Testnet
- **Key Scheme**: ed25519

### Credentials
```
Seed Phrase (12 words):
adjust device flock author scare mosquito sponsor coyote typical mother tube explain
```

### Configuration
- **Config File**: `C:\Users\RITHUN\.sui\sui_config\client.yaml`
- **Network**: Connected to Sui Testnet

### Get Testnet Tokens
```bash
# Method 1: Using CLI
sui client faucet

# Method 2: Web Faucet
# Visit: https://faucet.sui.io/
```

### Useful Commands
```bash
# Check balance
sui client balance

# View all addresses
sui client addresses

# Switch networks
sui client switch --env testnet

# Deploy contract
sui client publish --gas-budget 100000000
```

---

## 2. Solana Wallet (Devnet)

### Address Information
- **Address**: `71jYLbrjnbksLZJ5qCn3b6Xmrr2426xqPJKUHfUSZjWT`
- **Network**: Solana Devnet
- **Wallet File**: `./solana-wallet.json`

### Credentials
The private key is stored in `solana-wallet.json` in the following format:
```json
{
  "publicKey": "71jYLbrjnbksLZJ5qCn3b6Xmrr2426xqPJKUHfUSZjWT",
  "secretKey": [array of 64 numbers]
}
```

### Get Testnet Tokens
```bash
# Method 1: Using CLI (2 SOL)
solana airdrop 2 71jYLbrjnbksLZJ5qCn3b6Xmrr2426xqPJKUHfUSZjWT --url devnet

# Method 2: Web Faucet
# Visit: https://faucet.solana.com/
# Or: https://solfaucet.com/
```

### Useful Commands
```bash
# Set Solana CLI to use devnet
solana config set --url devnet

# Set wallet as default
solana config set --keypair ./solana-wallet.json

# Check balance
solana balance 71jYLbrjnbksLZJ5qCn3b6Xmrr2426xqPJKUHfUSZjWT --url devnet

# Deploy program
solana program deploy <program.so> --url devnet -k ./solana-wallet.json
```

---

## 3. TON Wallet (Testnet)

### Address Information
- **Testnet Address**: `kQAtHOPYIhRP1f_iXXmoLrpQapUsbVSMET7hQJpW0Dx4CEvL`
- **Mainnet Address**: `EQAtHOPYIhRP1f_iXXmoLrpQapUsbVSMET7hQJpW0Dx4CPBB`
- **Network**: TON Testnet
- **Wallet Version**: V4
- **Wallet File**: `./ton-wallet.json`

### Credentials
```
Mnemonic (24 words):
hurdle clip erosion news kiwi buzz jazz return shadow seed output hub
furnace equip detail cousin water derive shiver flat lucky cloud arm reveal
```

The complete wallet data including public/private keys is stored in `ton-wallet.json`.

### Get Testnet Tokens
```
Method 1: Telegram Bot
1. Open Telegram
2. Search for @testgiver_ton_bot
3. Start the bot
4. Send your testnet address: kQAtHOPYIhRP1f_iXXmoLrpQapUsbVSMET7hQJpW0Dx4CEvL
5. Bot will send 2-5 test TON

Method 2: Web Faucet
Visit: https://faucet.toncoin.org/
```

### Useful Commands
```bash
# Check balance (if ton CLI is installed)
ton account kQAtHOPYIhRP1f_iXXmoLrpQapUsbVSMET7hQJpW0Dx4CEvL

# Deploy using scripts
cd smart-contracts/ton
npm run deploy:testnet
```

---

## Contract Deployment Status

### Sui
- [ ] Not yet deployed
- **Contract Path**: `smart-contracts/sui/sources/oxmart_payment.move`
- **Deploy Command**: `sui client publish --gas-budget 100000000`

### Solana
- [ ] Not yet deployed
- **Contract Path**: Not yet implemented
- **Note**: Solana program needs to be written in Rust

### TON
- [x] Contract compiled successfully
- [ ] Not yet deployed
- **Contract Path**: `smart-contracts/ton/contracts/oxmart_payment.tact`
- **Compiled Output**: `smart-contracts/ton/build/`
- **Deploy Script**: `npm run deploy:testnet` (in ton directory)

---

## Next Steps

### 1. Fund All Wallets
Before deploying contracts, ensure all wallets have sufficient testnet tokens:

```bash
# Sui - Check balance
sui client balance

# Solana - Check balance
solana balance 71jYLbrjnbksLZJ5qCn3b6Xmrr2426xqPJKUHfUSZjWT --url devnet

# TON - Use Telegram bot @testgiver_ton_bot
```

### 2. Deploy Contracts

#### Deploy to Sui
```bash
cd smart-contracts/sui
sui client publish --gas-budget 100000000
```

#### Deploy to TON
```bash
cd smart-contracts/ton
npm run deploy:testnet
```

#### Deploy to Solana
Solana smart contract needs to be implemented in Rust first.

### 3. After Deployment
- Update `smart-contracts/deployments/` with contract addresses
- Test contract functions on testnet
- Update backend configuration with contract addresses

---

## File Locations

```
smart-contracts/
├── solana-wallet.json           # Solana keypair
├── ton-wallet.json              # TON wallet data
├── sui/                         # Sui contract
│   └── sources/oxmart_payment.move
├── ton/                         # TON contract
│   ├── contracts/oxmart_payment.tact
│   └── build/                   # Compiled TON contract
└── WALLETS_SUMMARY.md          # This file
```

---

## Backup Information

### Wallet Recovery

If you need to recover these wallets:

**Sui**:
```bash
sui keytool import "adjust device flock author scare mosquito sponsor coyote typical mother tube explain" ed25519
```

**Solana**:
Use the `solana-wallet.json` file with any Solana-compatible wallet.

**TON**:
Import the 24-word mnemonic into any TON wallet (Tonkeeper, Tonhub, etc.)

---

## Important Notes

1. **Testnet Only**: These wallets are for testnet deployment only
2. **No Real Value**: Never send real crypto to these addresses
3. **Regular Funding**: Testnet tokens may expire, request more from faucets as needed
4. **Security**: Keep this file secure and never commit to public repositories
5. **Node Version**: TON compilation requires Node.js 20+ (works with warnings on Node 20.19.5)

---

Generated: 2025-12-18
Network: Testnet/Devnet
Purpose: 0xMart Smart Contract Deployment
