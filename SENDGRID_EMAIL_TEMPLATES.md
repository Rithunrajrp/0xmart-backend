# SendGrid Email Templates - Variable Reference

Complete list of all email templates and their dynamic variables for 0xMart platform.

---

## ✅ Already Created (by you)

### 1. **OTP Email** (Login/Verification)
**Template ID Env**: `SENDGRID_OTP_TEMPLATE_ID`

**Variables:**
```handlebars
{{first_name}}      - User's first name or email prefix
{{otp}}             - 6-digit OTP code
{{support_link}}    - Support URL (default: https://support.0xmart.com/help)
```

**Usage**: Sent when user requests login OTP

---

### 2. **Merchant Onboarding**
**Template ID Env**: `SENDGRID_MERCHANT_ONBOARDING_TEMPLATE_ID`

**Variables:**
```handlebars
{{company_name}}      - Merchant's company name
{{onboarding_link}}   - Unique onboarding URL with token
{{expiry_date}}       - Link expiration date (formatted: "January 8, 2026")
{{support_link}}      - Support URL (default: https://support.0xmart.com/help)
```

**Usage**: Sent when admin invites merchant to onboard

---

## ⬜ Need to Create

### 3. **Welcome Email**
**Template ID Env**: `SENDGRID_WELCOME_TEMPLATE_ID`

**Variables:**
```handlebars
{{first_name}}    - User's first name
```

**Usage**: Sent when user successfully registers/completes KYC

**Example Content:**
```
Subject: Welcome to 0xMart, {{first_name}}!

Welcome to 0xMart! Your account is now active.

Start shopping with stablecoins across 9 blockchain networks.

[Browse Products] [View Dashboard]
```

---

### 4. **Transaction Notification**
**Template ID Env**: `SENDGRID_TRANSACTION_TEMPLATE_ID`

**Variables:**
```handlebars
{{firstName}}         - User's first name
{{transactionType}}   - Type of transaction (e.g., "Purchase", "Deposit", "Withdrawal")
{{amount}}            - Transaction amount (e.g., "100.00")
{{currency}}          - Stablecoin type (e.g., "USDT")
{{transactionId}}     - Transaction ID/hash
```

**Usage**: Generic transaction notification

**Example Content:**
```
Subject: Transaction Confirmation - {{transactionType}}

Hi {{firstName}},

Your {{transactionType}} transaction has been completed.

Amount: {{amount}} {{currency}}
Transaction ID: {{transactionId}}

View Transaction Details
```

---

### 5. **Deposit Confirmed**
**Template ID Env**: `SENDGRID_DEPOSIT_TEMPLATE_ID`

**Variables:**
```handlebars
{{amount}}         - Deposited amount (e.g., "100.50")
{{stablecoin}}     - Stablecoin type (e.g., "USDT")
{{tx_hash}}        - Blockchain transaction hash
{{network}}        - Network name (e.g., "POLYGON")
{{explorer_url}}   - Block explorer URL for the transaction
{{dashboard_url}}  - User dashboard URL (https://yourdomain.com/dashboard)
```

**Usage**: Sent when blockchain deposit is detected and confirmed

**Example Content:**
```
Subject: Deposit Confirmed - {{amount}} {{stablecoin}}

Your deposit has been confirmed!

Amount: {{amount}} {{stablecoin}}
Network: {{network}}
Transaction Hash: {{tx_hash}}

[View on Explorer]({{explorer_url}})
[View Dashboard]({{dashboard_url}})
```

**Block Explorer URLs:**
- ETHEREUM: `https://etherscan.io/tx/{hash}`
- POLYGON: `https://polygonscan.com/tx/{hash}`
- BSC: `https://bscscan.com/tx/{hash}`
- ARBITRUM: `https://arbiscan.io/tx/{hash}`
- OPTIMISM: `https://optimistic.etherscan.io/tx/{hash}`

---

### 6. **Withdrawal Completed**
**Template ID Env**: `SENDGRID_WITHDRAWAL_TEMPLATE_ID`

**Variables:**
```handlebars
{{amount}}         - Withdrawal amount
{{stablecoin}}     - Stablecoin type
{{to_address}}     - Destination wallet address
{{tx_hash}}        - Blockchain transaction hash
{{network}}        - Network name
{{explorer_url}}   - Block explorer URL
```

**Usage**: Sent when withdrawal is successfully processed on blockchain

**Example Content:**
```
Subject: Withdrawal Completed - {{amount}} {{stablecoin}}

Your withdrawal has been successfully processed!

Amount: {{amount}} {{stablecoin}}
To Address: {{to_address}}
Network: {{network}}
Transaction Hash: {{tx_hash}}

[View on Explorer]({{explorer_url}})

Allow 5-15 minutes for blockchain confirmations.
```

---

### 7. **Withdrawal Failed**
**Template ID Env**: `SENDGRID_WITHDRAWAL_FAILED_TEMPLATE_ID`

**Variables:**
```handlebars
{{amount}}         - Withdrawal amount
{{stablecoin}}     - Stablecoin type
{{reason}}         - Failure reason (e.g., "Insufficient balance", "Network error")
{{support_link}}   - Support URL (https://support.0xmart.com)
```

**Usage**: Sent when withdrawal fails to process

**Example Content:**
```
Subject: Withdrawal Failed - Action Required

Your withdrawal request could not be processed.

Amount: {{amount}} {{stablecoin}}
Reason: {{reason}}

The amount has been refunded to your wallet balance.

Need help? [Contact Support]({{support_link}})
```

---

### 8. **KYC Approved**
**Template ID Env**: `SENDGRID_KYC_APPROVED_TEMPLATE_ID`

**Variables:**
```handlebars
{{first_name}}      - User's first name
{{support_link}}    - Support URL
```

**Usage**: Sent when KYC verification is approved

**Example Content:**
```
Subject: KYC Verification Approved!

Great news, {{first_name}}!

Your identity verification has been approved. You now have full access to:
- Unlimited deposits and withdrawals
- Higher transaction limits
- Priority customer support

[Access Dashboard]

Questions? [Contact Support]({{support_link}})
```

---

### 9. **KYC Rejected**
**Template ID Env**: `SENDGRID_KYC_REJECTED_TEMPLATE_ID`

**Variables:**
```handlebars
{{first_name}}      - User's first name
{{reason}}          - Rejection reason
{{support_link}}    - Support URL
```

**Usage**: Sent when KYC verification is rejected

**Example Content:**
```
Subject: KYC Verification - Additional Information Required

Hi {{first_name}},

{{reason}}

You can submit a new verification request with updated documents.

[Resubmit KYC]

Need assistance? [Contact Support]({{support_link}})
```

---

### 10. **Order Confirmed** (Not yet implemented in code)
**Template ID Env**: `SENDGRID_ORDER_CONFIRMED_TEMPLATE_ID`

**Suggested Variables:**
```handlebars
{{first_name}}         - Customer name
{{order_number}}       - Order number
{{order_items}}        - Array of items (JSON or formatted string)
{{total_amount}}       - Total order amount
{{stablecoin}}         - Payment stablecoin
{{transaction_hash}}   - Payment transaction hash
{{shipping_address}}   - Formatted shipping address
{{estimated_delivery}} - Estimated delivery date
{{order_url}}          - Order tracking URL
```

**Usage**: Sent when customer completes order payment

**Example Content:**
```
Subject: Order Confirmed - #{{order_number}}

Thanks for your order, {{first_name}}!

Order #{{order_number}}
Total: {{total_amount}} {{stablecoin}}
Transaction: {{transaction_hash}}

Shipping to:
{{shipping_address}}

Estimated Delivery: {{estimated_delivery}}

[Track Order]({{order_url}})
```

---

### 11. **Order Shipped** (Not yet implemented in code)
**Template ID Env**: `SENDGRID_ORDER_SHIPPED_TEMPLATE_ID`

**Suggested Variables:**
```handlebars
{{first_name}}         - Customer name
{{order_number}}       - Order number
{{tracking_number}}    - Shipping tracking number
{{carrier}}            - Shipping carrier name
{{tracking_url}}       - Carrier tracking URL
{{estimated_delivery}} - Estimated delivery date
{{shipping_address}}   - Formatted shipping address
```

**Usage**: Sent when merchant ships the order

**Example Content:**
```
Subject: Your Order Has Shipped! - #{{order_number}}

Good news, {{first_name}}!

Your order #{{order_number}} has been shipped!

Tracking Number: {{tracking_number}}
Carrier: {{carrier}}
Estimated Delivery: {{estimated_delivery}}

[Track Shipment]({{tracking_url}})

Shipping to:
{{shipping_address}}
```

---

## Environment Variables Setup

Add these to your `.env` file:

```bash
# SendGrid Configuration
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@0xmart.com
SENDGRID_FROM_NAME=0xMart

# Template IDs (get from SendGrid dashboard after creating templates)
SENDGRID_OTP_TEMPLATE_ID=d-xxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_WELCOME_TEMPLATE_ID=d-xxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_TRANSACTION_TEMPLATE_ID=d-xxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_DEPOSIT_TEMPLATE_ID=d-xxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_WITHDRAWAL_TEMPLATE_ID=d-xxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_WITHDRAWAL_FAILED_TEMPLATE_ID=d-xxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_KYC_APPROVED_TEMPLATE_ID=d-xxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_KYC_REJECTED_TEMPLATE_ID=d-xxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_ORDER_CONFIRMED_TEMPLATE_ID=d-xxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_ORDER_SHIPPED_TEMPLATE_ID=d-xxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_MERCHANT_ONBOARDING_TEMPLATE_ID=d-xxxxxxxxxxxxxxxxxxxxxxxx

# Optional
SUPPORT_LINK=https://support.0xmart.com/help
```

---

## Template Creation Checklist

- [x] OTP Email
- [x] Merchant Onboarding
- [ ] Welcome Email
- [ ] Transaction Notification
- [ ] Deposit Confirmed
- [ ] Withdrawal Completed
- [ ] Withdrawal Failed
- [ ] KYC Approved
- [ ] KYC Rejected
- [ ] Order Confirmed (needs implementation)
- [ ] Order Shipped (needs implementation)

---

## SendGrid Template Design Tips

1. **Subject Lines:**
   - Keep under 50 characters
   - Use personalization: "Hi {{first_name}}"
   - Include key info: amounts, order numbers

2. **Handlebars Syntax:**
   ```handlebars
   {{variable}}              - Simple variable
   {{#if variable}}...{{/if}} - Conditional
   {{#each items}}...{{/each}} - Loop
   ```

3. **Brand Consistency:**
   - Use 0xMart logo: `https://ik.imagekit.io/bgvtzewqf/0xmart/0XMART-BLACK-FONT-REMOVEBG.png`
   - Colors: Primary (#your-brand-color), Background (#F9FAFB)
   - Footer: Include social links, support link, unsubscribe

4. **Mobile-Friendly:**
   - Use responsive templates
   - Button font size: min 16px
   - Single column layout

5. **Security:**
   - Never include sensitive data like passwords or API keys
   - Include warning about phishing in financial emails
   - Add "If you didn't request this..." disclaimer for OTP/security emails

---

## Testing Templates

After creating templates in SendGrid:

1. **Get Template ID** from SendGrid dashboard
2. **Add to `.env`** file
3. **Test endpoint**: Use API to trigger email
4. **Check inbox**: Verify variables render correctly
5. **Test on mobile**: Check responsive design

**Development Mode**: When `SENDGRID_API_KEY` is not set, OTP codes are logged to console instead of sending emails.

---

## Order Email Implementation (Future)

The Order Confirmed and Order Shipped email functions are **not yet implemented** in the codebase. To add them:

1. **Add methods** to `EmailService` (`src/modules/auth/services/email.service.ts`):
   ```typescript
   async sendOrderConfirmedEmail(...)
   async sendOrderShippedEmail(...)
   ```

2. **Call from OrdersService** when order status changes:
   ```typescript
   await this.emailService.sendOrderConfirmedEmail(...);
   await this.emailService.sendOrderShippedEmail(...);
   ```

3. **Create SendGrid templates** with variables above
4. **Add template IDs** to `.env`
