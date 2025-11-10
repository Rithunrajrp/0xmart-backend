FULL USER JOURNEY:

1. ✅ Sign up → Email OTP
2. ✅ Complete KYC → Verified identity
3. ✅ Fund wallet:
   - Buy with fiat (Stripe/Razorpay)
   - Deposit crypto (auto-detected)
4. ✅ Browse products → Multi-currency pricing
5. ✅ Place orders → Stablecoin checkout
6. ✅ Withdraw funds → Auto-processed ← NEW!
7. ✅ Email notifications → Every step

Sign Up → KYC → Fund Wallet (Fiat/Crypto) → Browse Products → Place Order → Pay with Stablecoin → Withdraw Funds → Receive at External Address

User initiates → Calculates rates → Creates payment → User pays → Webhook triggers → Wallet credited ✅

All Core Features Implemented:

Authentication - Email OTP login
KYC Verification - Sumsub integration
Wallet Management - HD wallet generation
Fiat Purchase - Stripe + Razorpay
Deposit Monitor - Auto-credit deposits
Withdrawal Processor - Auto-send withdrawals ← DONE!
Products & Orders - E-commerce
Notifications - Email alerts

COMPLETE BACKEND FEATURES:

- Authentication & Authorization
- KYC Verification
- Wallet Generation & Management
- Fiat Purchase (Stripe + Razorpay)
- Deposit Monitoring (Auto-credit)
- Withdrawal Processing (Auto-send) ← NEW!
- Products & Orders
- Email Notifications
- Admin Dashboard APIs
- Audit Logging
- Multi-network Support

Dual Payment Provider Support:

✅ Stripe - Global (Cards, Apple Pay, Google Pay)
✅ Razorpay - India (UPI, Cards, NetBanking)

Smart Features:

✅ Live exchange rates with 5-min cache
✅ Automatic fee calculation (Stripe 2.9%+$0.30, Razorpay 2%)
✅ KYC enforcement - Must be approved to purchase
✅ Auto wallet credit via webhooks
✅ Refund handling by admin
✅ Complete audit trail

Buy $100 USD worth of USDT:

Fiat Amount: $100.00
Processing Fee: $3.20
Exchange Rate: 1 USDT = $1.005
You Get: 96.32 USDT in your wallet

// ============================================
// MIGRATION TO TWILIO (FUTURE)
// ============================================
/\*

When you're ready to add SMS support:

1. Sign up for Twilio and get credentials
2. Add to .env:
   TWILIO_ACCOUNT_SID=ACxxxxx
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_PHONE_NUMBER=+1234567890

3. Update TwilioService to use actual Twilio client:

import \* as twilio from 'twilio';

export class TwilioService {
private client: twilio.Twilio;

constructor(private configService: ConfigService) {
const accountSid = this.configService.get<string>('twilio.accountSid');
const authToken = this.configService.get<string>('twilio.authToken');

    if (accountSid && authToken) {
      this.client = twilio.default(accountSid, authToken);
    }

}

async sendOtp(countryCode: string, phoneNumber: string, otp: string): Promise<void> {
if (!this.client) return;

    const fullPhoneNumber = `${countryCode}${phoneNumber}`;

    await this.client.messages.create({
      body: `Your Stablecoin Commerce OTP is: ${otp}. Valid for 10 minutes.`,
      from: this.configService.get<string>('twilio.phoneNumber'),
      to: fullPhoneNumber,
    });

}
}

4. Update SendOtpDto to make phone required:
   @IsNotEmpty() on phoneNumber and countryCode

5. Update auth flow to send both email and SMS

\*/

// ============================================
// MULTI-SIGNATURE WALLET SUPPORT (Advanced)
// ============================================

/\*
If you want to use multi-sig wallets for security:

1. Deploy Gnosis Safe contract
2. Generate deposit addresses from Safe contract
3. Update monitor to watch Safe transactions
4. Require multiple admins to approve withdrawals

Example Safe integration:
import { ethers } from 'ethers';

async function deploySafeWallet(owners: string[], threshold: number) {
const safeFactory = new ethers.ContractFactory(SafeAbi, SafeBytecode, signer);
const safe = await safeFactory.deploy(owners, threshold);
return safe.address;
}
\*/

// ============================================
// GAS OPTIMIZATION
// ============================================

For production, optimize RPC calls:

1. Use archive nodes for historical data
2. Cache block ranges already scanned
3. Use multicall for batch queries
4. Implement exponential backoff for retries

Example cache implementation:
private scanCache = new Map<string, number>(); // walletId -> lastBlock

private getLastScannedBlock(walletId: string): number {
return this.scanCache.get(walletId) || 0;
}

private updateLastScannedBlock(walletId: string, blockNumber: number) {
this.scanCache.set(walletId, blockNumber);
}

// ============================================
// ADVANCED FEATURES
// ============================================

/\*

### 1. MULTI-SIGNATURE WITHDRAWALS

For large amounts, require multiple approvals:

```typescript
interface WithdrawalApproval {
  adminId: string;
  approvedAt: Date;
  signature?: string;
}

async function approveWithdrawal(withdrawalId: string, adminId: string) {
  const withdrawal = await this.prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
  });

  const amount = new Decimal(withdrawal.amount);
  const largeAmountThreshold = new Decimal('1000');

  if (amount.greaterThan(largeAmountThreshold)) {
    // Require 2 approvals
    const approvals = withdrawal.metadata?.approvals || [];
    approvals.push({
      adminId,
      approvedAt: new Date(),
    });

    await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        metadata: { ...withdrawal.metadata, approvals },
      },
    });

    if (approvals.length >= 2) {
      // Now approve for processing
      await this.prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: { approvedAt: new Date() },
      });
    } else {
      return {
        success: true,
        message: `1 of 2 approvals received. Need ${2 - approvals.length} more.`,
      };
    }
  }
}
```

### 2. DYNAMIC GAS OPTIMIZATION

Use gas price oracles for optimal fees:

```typescript
async function getOptimalGasPrice(network: NetworkType): Promise<BigNumber> {
  // For Ethereum, use gas price oracle
  if (network === 'ETHEREUM') {
    const response = await axios.get(
      'https://api.etherscan.io/api?module=gastracker&action=gasoracle',
    );
    const safeLow = response.data.result.SafeGasPrice;
    return ethers.utils.parseUnits(safeLow, 'gwei');
  }

  // For other networks, use provider
  const provider = this.blockchain.getProvider(network);
  return provider.getGasPrice();
}
```

### 3. NONCE MANAGEMENT

Handle concurrent transactions:

```typescript
private nonceManager = new Map<string, number>();

async function getNextNonce(address: string, provider: any): Promise<number> {
  const currentNonce = await provider.getTransactionCount(address, 'pending');
  const cachedNonce = this.nonceManager.get(address) || currentNonce;

  const nextNonce = Math.max(currentNonce, cachedNonce);
  this.nonceManager.set(address, nextNonce + 1);

  return nextNonce;
}
```

### 4. TRANSACTION RETRY LOGIC

Retry failed transactions with higher gas:

```typescript
async function retryTransaction(withdrawalId: string) {
  const withdrawal = await this.prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
  });

  if (!withdrawal.txHash) {
    // Transaction never sent, retry
    await this.processWithdrawal(withdrawal);
    return;
  }

  const provider = this.blockchain.getProvider(withdrawal.network);
  const tx = await provider.getTransaction(withdrawal.txHash);

  if (!tx) {
    // Transaction not found, probably dropped
    // Resend with higher gas price
    const newGasPrice = tx.gasPrice.mul(120).div(100); // 20% higher
    await this.processWithdrawal(withdrawal, { gasPrice: newGasPrice });
  }
}
```

### 5. WEBHOOK FOR EXTERNAL SERVICES

Notify external services about withdrawal status:

```typescript
async function notifyWebhook(withdrawal: any, status: string) {
  const webhookUrl = this.configService.get<string>('WITHDRAWAL_WEBHOOK_URL');

  if (!webhookUrl) return;

  try {
    await axios.post(
      webhookUrl,
      {
        event: 'withdrawal.status_changed',
        data: {
          withdrawalId: withdrawal.id,
          userId: withdrawal.wallet.userId,
          amount: withdrawal.amount.toString(),
          status: status,
          txHash: withdrawal.txHash,
          timestamp: new Date().toISOString(),
        },
      },
      {
        headers: {
          'X-Webhook-Secret': this.configService.get<string>('WEBHOOK_SECRET'),
        },
      },
    );
  } catch (error) {
    this.logger.error(`Webhook failed: ${error.message}`);
  }
}
```

\*/
