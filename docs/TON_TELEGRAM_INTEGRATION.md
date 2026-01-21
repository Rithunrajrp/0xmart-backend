# TON Telegram Mini App Integration

## Overview

TON (The Open Network) payments are NOT processed through traditional deposit addresses. Instead, TON payments are handled via **Telegram Mini App** with **smart contract integration**.

## Why No Deposit Addresses for TON?

### Traditional Deposit Address Model (NOT USED)
```
❌ User gets TON deposit address
❌ User sends USDT/USDC to deposit address
❌ System monitors address for deposits
❌ System sweeps funds to hot wallet
```

### Telegram Mini App Model (USED)
```
✅ User opens Telegram Mini App
✅ User connects TON wallet in Telegram
✅ User makes payment via smart contract
✅ Smart contract handles payment directly
✅ No deposit address needed
```

## Architecture

### Payment Flow

```
User opens Telegram → Telegram Mini App loads → User selects product
         ↓
User clicks "Pay with TON"
         ↓
TON Wallet popup in Telegram
         ↓
User confirms transaction
         ↓
Smart contract executes payment
         ↓
Backend receives webhook/event
         ↓
Order confirmed
```

### Benefits

1. **Native Telegram Experience**: Seamless UX within Telegram
2. **No Address Management**: No need to generate/store TON addresses
3. **Instant Confirmation**: Smart contract confirms immediately
4. **Lower Gas Fees**: Single transaction, no sweep needed
5. **Security**: Payment enforced by smart contract
6. **Better UX**: Users don't need to copy/paste addresses

## Implementation Status

### Backend Changes

#### 1. Wallet Service - TON Blocked

**File**: `src/modules/wallets/wallets.service.ts`

```typescript
async createWallet(userId: string, createWalletDto: CreateWalletDto) {
  const { stablecoinType, network } = createWalletDto;

  // TON wallets are not supported for deposit addresses
  if (network === 'TON') {
    throw new BadRequestException(
      'TON wallets are not supported. TON payments are processed via Telegram mini app.'
    );
  }
  // ... rest of code
}
```

#### 2. Address Generator - TON Blocked

**File**: `src/modules/wallets/services/address-generator.service.ts`

```typescript
async generateDepositAddress(userId, index, network) {
  if (network === 'TON') {
    throw new Error(
      'TON deposit addresses are not supported. Use Telegram mini app with smart contract payments.'
    );
  }
  // ... rest of code
}
```

#### 3. Deposit Monitor - TON Ignored

TON deposit monitoring is not implemented since there are no deposit addresses to monitor.

### What's Removed

- ❌ `generateTonAddress()` method (no longer needed)
- ❌ TON deposit address generation
- ❌ TON deposit monitoring in `checkTonWalletForDeposits()`
- ❌ TON wallet creation via API

### What's Kept

- ✅ TON network type in Prisma schema (for future smart contract orders)
- ✅ TON RPC configuration (for reading blockchain state)
- ✅ TON blockchain service (for smart contract interactions)

## Telegram Mini App Architecture

### Component Structure

```
0xmart-telegram-miniapp/
├── src/
│   ├── components/
│   │   ├── ProductList.tsx
│   │   ├── ProductDetail.tsx
│   │   ├── Cart.tsx
│   │   └── TONPayment.tsx       # TON wallet integration
│   ├── hooks/
│   │   └── useTonWallet.ts      # TON Connect hook
│   ├── services/
│   │   ├── api.ts               # 0xMart API client
│   │   └── tonContract.ts       # Smart contract interface
│   └── App.tsx
├── public/
│   └── ton-connect-manifest.json
└── package.json
```

### Smart Contract Integration

**Smart Contract Functions**:

```solidity
// TON FunC pseudo-code
() pay_for_product(
  int order_id,
  int product_id,
  int amount,
  slice merchant_address
) impure {
  ;; Verify payment amount
  ;; Transfer to merchant
  ;; Emit event for backend
  ;; Update order status
}
```

**Frontend Integration**:

```typescript
// Using TON Connect
import { useTonConnectUI } from '@tonconnect/ui-react';

const TONPayment = ({ orderId, amount }) => {
  const [tonConnectUI] = useTonConnectUI();

  const handlePayment = async () => {
    const transaction = {
      validUntil: Date.now() + 5 * 60 * 1000, // 5 minutes
      messages: [
        {
          address: PAYMENT_CONTRACT_ADDRESS,
          amount: amount.toString(),
          payload: createPaymentPayload(orderId),
        },
      ],
    };

    try {
      const result = await tonConnectUI.sendTransaction(transaction);
      // Notify backend
      await api.confirmTonPayment(orderId, result.boc);
    } catch (error) {
      console.error('Payment failed:', error);
    }
  };

  return <button onClick={handlePayment}>Pay {amount} TON</button>;
};
```

## Backend API Endpoints

### Current Endpoints (Deposit Model - NOT FOR TON)

```
❌ POST /api/v1/wallets - Create wallet (rejects TON)
❌ GET /api/v1/wallets/:id/refresh - Refresh balance (no TON support)
```

### Future Endpoints (Smart Contract Model - FOR TON)

```
✅ POST /api/v1/ton/orders/:id/payment-intent - Create payment intent
✅ POST /api/v1/ton/orders/:id/confirm - Confirm payment via BOC
✅ GET /api/v1/ton/orders/:id/status - Check payment status
✅ POST /api/v1/ton/webhook - Receive blockchain events
```

## Migration Guide

### For Users Currently Using TON Deposits

If you previously created TON wallets (before this change):

1. **Existing TON wallets** will remain in database but are inactive
2. **No new TON deposits** will be detected
3. **Users should withdraw** any remaining TON balance (if any)
4. **Future TON payments** must use Telegram Mini App

### For Developers

```typescript
// OLD: Creating TON deposit wallet (NOW BLOCKED)
const wallet = await walletsService.createWallet(userId, {
  network: 'TON',
  stablecoinType: 'USDT',
});
// Throws: "TON wallets are not supported..."

// NEW: TON payments via Telegram Mini App
// User will use Telegram Mini App to pay directly to smart contract
// No wallet creation needed on backend
```

## TON Blockchain Service (Still Available)

The TON blockchain service is still available for reading blockchain state and interacting with smart contracts:

**File**: `src/modules/wallets/services/ton-blockchain.service.ts`

**Available Methods**:
- `getBalance(address)` - Read TON balance
- `getJettonBalance(address, jettonMaster)` - Read USDT/USDC balance
- `getTransaction(hash)` - Get transaction details
- `isTransactionConfirmed(hash)` - Check confirmation status
- `parseJettonTransfer(hash, address)` - Parse jetton transfers

**Usage**: Smart contract payment verification

```typescript
// Verify payment was successful
const tx = await tonService.getTransaction(txHash);
if (tx && tx.success) {
  // Confirm order
  await ordersService.confirmPayment(orderId);
}
```

## Configuration

### Environment Variables (Still Needed)

```bash
# TON RPC (for reading blockchain state)
TON_RPC_URL=https://toncenter.com/api/v2/jsonRPC
TON_TESTNET_RPC_URL=https://testnet.toncenter.com/api/v2/jsonRPC
TON_API_KEY=your-toncenter-api-key

# TON Smart Contract (Telegram Mini App will use this)
TON_PAYMENT_CONTRACT_ADDRESS=EQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_MINI_APP_URL=https://t.me/your_bot/app
```

### Database Schema (No Changes Needed)

TON network type remains in schema for future smart contract orders:

```prisma
enum NetworkType {
  ETHEREUM
  POLYGON
  BSC
  ARBITRUM
  OPTIMISM
  AVALANCHE
  SUI
  TON        // Still here for smart contract orders
  BASE
  SOLANA
}
```

## Testing TON Payments (Future)

Once Telegram Mini App is deployed:

### 1. Test Smart Contract Payment

```bash
# Open Telegram Mini App
https://t.me/your_bot/app

# Connect TON wallet in Telegram
# Browse products
# Click "Pay with TON"
# Confirm transaction in TON wallet popup
# Verify order confirmation
```

### 2. Verify Backend Received Payment

```bash
# Check order status
curl -X GET http://localhost:8000/api/v1/orders/:orderId \
  -H "Authorization: Bearer <jwt-token>"

# Should show status: PAID
```

## Future Development Roadmap

### Phase 1: Smart Contract (In Progress)
- [ ] Deploy TON payment smart contract
- [ ] Test on TON testnet
- [ ] Deploy to mainnet

### Phase 2: Telegram Mini App (Planned)
- [ ] Create Telegram bot
- [ ] Build React-based mini app
- [ ] Integrate TON Connect
- [ ] Test payment flow

### Phase 3: Backend Integration (Planned)
- [ ] Implement smart contract webhook endpoint
- [ ] Create payment verification logic
- [ ] Add TON payment confirmation flow
- [ ] Test end-to-end

### Phase 4: Production (Planned)
- [ ] Security audit
- [ ] Load testing
- [ ] Deploy to production
- [ ] Monitor and optimize

## FAQ

### Q: Can I still use TON for payments?

**A**: Yes, but only through the Telegram Mini App once it's deployed. Traditional deposit addresses are no longer supported.

### Q: What about existing TON deposits?

**A**: Contact support to withdraw any remaining balance. New TON deposits will not be processed.

### Q: Why remove TON deposit addresses?

**A**: TON payments work better through Telegram's native integration. This provides:
- Better UX (no address copying)
- Lower gas fees (single transaction)
- Instant confirmation
- Native Telegram experience

### Q: When will Telegram Mini App be ready?

**A**: Check the development roadmap above. Phase 1-3 must complete first.

### Q: Can I use TON for withdrawals?

**A**: Withdrawals to TON addresses will still work using the hot wallet mechanism (separate from deposits).

## Support

For TON-related questions:
- Check Telegram Mini App documentation (when available)
- Review smart contract documentation
- Contact development team

For other payment networks (SUI, Solana, EVM):
- Use standard deposit address flow
- Check respective documentation
