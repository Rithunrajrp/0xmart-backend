# Email Implementation - Quick TODO

## ✅ Working (7)
1. OTP Email - ✅
2. Merchant Onboarding - ✅
3. Deposit Confirmed - ✅
4. Withdrawal Completed - ✅
5. Withdrawal Failed - ✅
6. KYC Approved - ✅
7. KYC Rejected - ✅

## ⚠️ Not Used (2)
8. Welcome Email - Function exists, not called
9. Transaction Notification - Function exists, not called

## ❌ Missing (2)
10. **Order Confirmed** - Need to implement
11. **Order Shipped** - Need to implement

---

## What You Need to Do

### 1. Implement Order Confirmed Email

**Add to** `src/modules/auth/services/email.service.ts`:

```typescript
async sendOrderConfirmedEmail(
  email: string,
  orderData: {
    firstName: string;
    orderNumber: string;
    totalAmount: string;
    stablecoin: string;
    transactionHash: string;
    shippingAddress: string;
  },
): Promise<void> {
  const apiKey = this.configService.get<string>('sendgrid.apiKey');
  if (!apiKey) return;

  try {
    const templateId = this.configService.get<string>(
      'sendgrid.orderConfirmedTemplateId',
    );
    const fromEmail = this.configService.get<string>('sendgrid.fromEmail');
    const fromName = this.configService.get<string>('sendgrid.fromName') || '0xMart';

    if (!templateId || !fromEmail) return;

    await sgMail.send({
      to: email,
      from: { email: fromEmail, name: fromName },
      templateId,
      dynamicTemplateData: {
        first_name: orderData.firstName,
        order_number: orderData.orderNumber,
        total_amount: orderData.totalAmount,
        stablecoin: orderData.stablecoin,
        transaction_hash: orderData.transactionHash,
        shipping_address: orderData.shippingAddress,
        order_url: `https://oxmart.com/orders/${orderData.orderNumber}`,
      },
    });

    this.logger.log(`✅ Order confirmed email sent: ${orderData.orderNumber}`);
  } catch (error) {
    this.logger.error(`❌ Order confirmed email failed: ${error.message}`);
  }
}
```

### 2. Implement Order Shipped Email

**Add to** `src/modules/auth/services/email.service.ts`:

```typescript
async sendOrderShippedEmail(
  email: string,
  orderData: {
    firstName: string;
    orderNumber: string;
    trackingNumber: string;
    carrier: string;
    shippingAddress: string;
  },
): Promise<void> {
  const apiKey = this.configService.get<string>('sendgrid.apiKey');
  if (!apiKey) return;

  try {
    const templateId = this.configService.get<string>(
      'sendgrid.orderShippedTemplateId',
    );
    const fromEmail = this.configService.get<string>('sendgrid.fromEmail');
    const fromName = this.configService.get<string>('sendgrid.fromName') || '0xMart';

    if (!templateId || !fromEmail) return;

    await sgMail.send({
      to: email,
      from: { email: fromEmail, name: fromName },
      templateId,
      dynamicTemplateData: {
        first_name: orderData.firstName,
        order_number: orderData.orderNumber,
        tracking_number: orderData.trackingNumber,
        carrier: orderData.carrier,
        tracking_url: `https://track.carrier.com/${orderData.trackingNumber}`,
        shipping_address: orderData.shippingAddress,
      },
    });

    this.logger.log(`✅ Order shipped email sent: ${orderData.orderNumber}`);
  } catch (error) {
    this.logger.error(`❌ Order shipped email failed: ${error.message}`);
  }
}
```

### 3. Call These Functions from OrdersService

**In** `src/modules/orders/orders.service.ts`:

**When order is confirmed** (after payment):
```typescript
const user = await this.prisma.user.findUnique({ where: { id: order.userId }});

await this.emailService.sendOrderConfirmedEmail(user.email, {
  firstName: user.email.split('@')[0],
  orderNumber: order.orderNumber,
  totalAmount: order.total.toString(),
  stablecoin: order.stablecoinType,
  transactionHash: order.transactionHash,
  shippingAddress: JSON.stringify(order.shippingAddress),
});
```

**When order is shipped**:
```typescript
await this.emailService.sendOrderShippedEmail(user.email, {
  firstName: user.email.split('@')[0],
  orderNumber: order.orderNumber,
  trackingNumber: order.trackingNumber,
  carrier: 'FedEx', // or get from request
  shippingAddress: JSON.stringify(order.shippingAddress),
});
```

---

## After Implementation

1. Restart backend: `npm run start:dev`
2. Test order confirmation flow
3. Test order shipping flow
4. Check emails in inbox

---

## Summary

**Templates Created in SendGrid**: 11/11 ✅
**Code Implementation**: 7/11 ✅ (64%)
**Missing Code**: 2/11 ❌ (Order emails)
**Unused**: 2/11 ⚠️ (Welcome, Transaction generic)
