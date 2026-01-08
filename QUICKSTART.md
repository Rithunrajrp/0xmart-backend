# 🚀 Smart Contract Payment - Quick Start

## ✅ What's Been Done

Your backend now returns **smart contract parameters** instead of deposit addresses. Payments are processed via smart contracts with wallet invocation.

## 🎯 What You Need to Do

### 1. Deploy Smart Contracts (REQUIRED)

```bash
# Install Hardhat
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts

# Initialize Hardhat
npx hardhat init

# Deploy to Polygon testnet (Mumbai)
npx hardhat run scripts/deploy.js --network mumbai

# Copy the contract address
POLYGON_PAYMENT_CONTRACT=0xYourContractAddress
```

**📖 Full guide:** `SMART_CONTRACT_DEPLOYMENT.md`

### 2. Test the Payment Widget

```bash
# Start your backend
npm run start:dev

# Open browser
http://localhost:8000/widget/example.html

# Enter your API key and order ID
# Click "Pay with Crypto"
# Approve in MetaMask
```

### 3. Integrate in Third-Party Apps

Share this with external developers:

```html
<script src="https://api.0xmart.com/widget/0xmart-payment.js"></script>
<script>
  OxMartPayment.pay({
    apiKey: 'their_api_key',
    orderId: 'order_123',
    onSuccess: (txHash) => alert('Paid!'),
    onError: (error) => alert('Failed: ' + error.message)
  });
</script>
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `contracts/PaymentProcessor.sol` | Smart contract (deploy this) |
| `public/widget/0xmart-payment.js` | Payment widget (share with devs) |
| `public/widget/example.html` | Live demo |
| `SMART_CONTRACT_DEPLOYMENT.md` | Deployment guide |
| `docs/SMART_CONTRACT_PAYMENT_GUIDE.md` | Integration guide |
| `IMPLEMENTATION_SUMMARY.md` | Complete overview |

## 🔧 API Changes

### Before

```bash
POST /payment/select-network
Response:
{
  "depositAddress": "0x1234...",
  "amount": "54.99"
}
```

### After

```bash
POST /payment/select-network
Response:
{
  "contractAddress": "0x1234...",
  "tokenAddress": "0x5678...",
  "method": "payForProduct",
  "params": {
    "orderId": "EXT-123",
    "productId": "P123",
    "token": "0x5678...",
    "amount": "54990000"
  },
  "abi": [...],
  "estimatedGas": "200000"
}
```

## 🎨 User Experience

**Customer sees:**
1. Clicks "Pay with Crypto"
2. MetaMask popup: "Approve USDT" → Click
3. MetaMask popup: "Confirm Payment" → Click
4. Done! ✅

**Developer writes:**
```javascript
OxMartPayment.pay({
  apiKey: 'key',
  orderId: 'order_123',
  onSuccess: (txHash) => console.log('Paid!')
});
```

3 lines. That's it.

## ⚠️ Important Notes

1. **Smart contracts must be deployed** before payments work
2. **Testnet first!** Deploy to Mumbai/BSC Testnet before mainnet
3. **Gas fees:** Customer pays gas (standard for blockchain)
4. **Widget URL:** Update `apiBaseUrl` in widget for production
5. **Merchant address:** Set in `.env` when deploying contracts

## 📊 Benefits

| Feature | Before (Deposit) | After (Smart Contract) |
|---------|-----------------|------------------------|
| Payment time | 10+ minutes | Instant (1 block) |
| Customer steps | 5-7 manual | 2 clicks |
| Integration | Medium | 3 lines of code |
| Verification | Backend polling | Event-based |
| UX | Copy-paste address | Wallet popup |

## 🆘 Need Help?

**Deployment issues?** → See `SMART_CONTRACT_DEPLOYMENT.md`
**Integration questions?** → See `docs/SMART_CONTRACT_PAYMENT_GUIDE.md`
**Architecture details?** → See `IMPLEMENTATION_SUMMARY.md`

## 🎉 You're Ready!

1. ✅ Backend modified
2. ✅ Smart contract created
3. ✅ Payment widget ready
4. ✅ Documentation complete
5. 🔜 Deploy contracts
6. 🔜 Test end-to-end
7. 🔜 Share with integrators

**Next command:**
```bash
npx hardhat run scripts/deploy.js --network mumbai
```

Good luck! 🚀
