# SendGrid Template Variables - Quick Reference

Copy these variables when creating templates in SendGrid.

---

## 1. OTP Email ✅ Created
```
{{first_name}}
{{otp}}
{{support_link}}
```

---

## 2. Merchant Onboarding ✅ Created
```
{{company_name}}
{{onboarding_link}}
{{expiry_date}}
{{support_link}}
```

---

## 3. Welcome Email ⬜ Create
```
{{first_name}}
```

---

## 4. Transaction Notification ⬜ Create
```
{{firstName}}
{{transactionType}}
{{amount}}
{{currency}}
{{transactionId}}
```

---

## 5. Deposit Confirmed ⬜ Create
```
{{amount}}
{{stablecoin}}
{{tx_hash}}
{{network}}
{{explorer_url}}
{{dashboard_url}}
```

---

## 6. Withdrawal Completed ⬜ Create
```
{{amount}}
{{stablecoin}}
{{to_address}}
{{tx_hash}}
{{network}}
{{explorer_url}}
```

---

## 7. Withdrawal Failed ⬜ Create
```
{{amount}}
{{stablecoin}}
{{reason}}
{{support_link}}
```

---

## 8. KYC Approved ⬜ Create
```
{{first_name}}
{{support_link}}
```

---

## 9. KYC Rejected ⬜ Create
```
{{first_name}}
{{reason}}
{{support_link}}
```

---

## 10. Order Confirmed ⬜ Create (Not Implemented)
```
{{first_name}}
{{order_number}}
{{order_items}}
{{total_amount}}
{{stablecoin}}
{{transaction_hash}}
{{shipping_address}}
{{estimated_delivery}}
{{order_url}}
```

---

## 11. Order Shipped ⬜ Create (Not Implemented)
```
{{first_name}}
{{order_number}}
{{tracking_number}}
{{carrier}}
{{tracking_url}}
{{estimated_delivery}}
{{shipping_address}}
```

---

## Common Values

### support_link
Default: `https://support.0xmart.com/help`

### dashboard_url
Default: `https://yourdomain.com/dashboard`

### Block Explorer URLs
- ETHEREUM: `https://etherscan.io/tx/{tx_hash}`
- POLYGON: `https://polygonscan.com/tx/{tx_hash}`
- BSC: `https://bscscan.com/tx/{tx_hash}`
- ARBITRUM: `https://arbiscan.io/tx/{tx_hash}`
- OPTIMISM: `https://optimistic.etherscan.io/tx/{tx_hash}`

---

## Template ID Environment Variables

```bash
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
```

---

## Handlebars Syntax

**Variable:**
```handlebars
{{first_name}}
```

**Conditional:**
```handlebars
{{#if first_name}}
  Hi {{first_name}}!
{{else}}
  Hi there!
{{/if}}
```

**Loop:**
```handlebars
{{#each order_items}}
  - {{this.name}}: {{this.quantity}} x {{this.price}}
{{/each}}
```

---

## Brand Assets

**Logo:** `https://ik.imagekit.io/bgvtzewqf/0xmart/0XMART-BLACK-FONT-REMOVEBG.png`

**Social Links:**
- Twitter: `https://twitter.com/0xmart`
- Instagram: `https://instagram.com/0xmart`
- Discord: `https://discord.gg/0xmart`
- Telegram: `https://t.me/0xmart`
