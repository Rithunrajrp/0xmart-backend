# 0xMart Backend - Frontend Integration Guide

## Overview

This document provides comprehensive documentation for frontend developers to integrate with the 0xMart backend API. The backend is a **stablecoin commerce platform** that enables:

- **External API Integration** - Third-party developers can integrate 0xMart products into their apps
- **402 Payment Protocol** - Customer verification, address collection, and crypto payment flow
- **Seller/Company System** - Products are linked to verified sellers with company information
- **Commission System** - API users earn 5% commission on sales
- **Ad Recommendations** - Product recommendations with click tracking

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication](#authentication)
3. [API Modules](#api-modules)
   - [External Payment Flow](#1-external-payment-flow-402-protocol)
   - [Sellers](#2-sellers-module)
   - [Ads & Recommendations](#3-ads--recommendations)
   - [Commissions](#4-commissions)
   - [Webhooks](#5-webhooks)
   - [API Keys Management](#6-api-keys-management)
4. [Data Types](#data-types)
5. [Error Handling](#error-handling)
6. [Frontend Implementation Checklist](#frontend-implementation-checklist)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        0xMart Platform                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐           │
│  │ External    │───▶│ 402 Payment  │───▶│ Commission    │           │
│  │ Payment API │    │ Flow         │    │ Tracking      │           │
│  └─────────────┘    └──────────────┘    └───────────────┘           │
│                            │                                         │
│                            ▼                                         │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐           │
│  │ Ads/Recs    │───▶│ Products +   │◀──▶│ Webhooks      │           │
│  │             │    │ Sellers      │    │               │           │
│  └─────────────┘    └──────────────┘    └───────────────┘           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **API Key** | Authentication for external developers (`X-API-Key` header) |
| **402 Protocol** | Payment flow with customer verification |
| **Seller** | Company/manufacturer that owns products |
| **Commission** | 5% earnings for API users on each sale |
| **Webhook** | Real-time notifications for payment events |

---

## Authentication

### For External API Users (Third-party Developers)

All external API endpoints require API key authentication:

```http
X-API-Key: xmart_aBc123XyZ456DeF789...
```

### For Platform Users (0xMart Users)

Use JWT Bearer token:

```http
Authorization: Bearer <jwt_token>
```

---

## API Modules

### 1. External Payment Flow (402 Protocol)

The external payment flow enables third-party developers to sell 0xMart products on their platforms.

#### Flow Diagram

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Initiate│───▶│ Verify  │───▶│ Submit  │───▶│ Select  │───▶│ Confirm │
│ Payment │    │ OTP     │    │ Address │    │ Network │    │ Payment │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
  Return:       Verify          Collect        Get deposit   Submit tx
  - orderId     email/phone     shipping       address       hash
  - what's      via OTP         address        + amount
    needed
```

#### Endpoints

##### 1.1 Initiate Payment

```http
POST /api/v1/payment/initiate
X-API-Key: xmart_...
Content-Type: application/json

{
  "productId": "uuid",
  "quantity": 1,
  "phone": "+1234567890",
  "email": "customer@example.com",
  "stablecoinType": "USDT",
  "network": "POLYGON",           // Optional - can select later
  "adClickToken": "token...",     // Optional - for ad tracking
  "idempotencyKey": "unique-key"  // Optional - prevent duplicates
}
```

**Response (200 OK):**

```json
{
  "status": "INITIATED",
  "orderId": "uuid",
  "orderNumber": "EXT-1234567890-1234",
  "need": {
    "emailVerification": true,
    "phoneVerification": false,
    "address": true,
    "networkSelection": true
  },
  "customer": {
    "email": "cu***@example.com",
    "phone": "+123****90",
    "emailVerified": false,
    "phoneVerified": true,
    "hasAddress": false
  },
  "product": {
    "id": "uuid",
    "name": "Product Name",
    "price": "110.00",
    "currency": "USDT"
  },
  "suggestedNetworks": ["TON", "SUI", "POLYGON", "BSC"],
  "reason": "New customer - verification required"
}
```

##### 1.2 Verify OTP

```http
POST /api/v1/payment/verify-otp
X-API-Key: xmart_...

{
  "orderId": "uuid",
  "otp": "123456",
  "type": "email"  // or "phone"
}
```

**Response:**

```json
{
  "success": true,
  "nextStep": "SUBMIT_ADDRESS"  // or "SELECT_NETWORK" or "READY_FOR_PAYMENT"
}
```

##### 1.3 Resend OTP

```http
POST /api/v1/payment/resend-otp
X-API-Key: xmart_...

{
  "orderId": "uuid",
  "type": "email"
}
```

##### 1.4 Submit Address

```http
POST /api/v1/payment/submit-address
X-API-Key: xmart_...

{
  "orderId": "uuid",
  "fullName": "John Doe",
  "addressLine1": "123 Main St",
  "addressLine2": "Apt 4B",
  "city": "New York",
  "state": "NY",
  "postalCode": "10001",
  "country": "USA",
  "landmark": "Near Central Park"
}
```

##### 1.5 Select Network

```http
POST /api/v1/payment/select-network
X-API-Key: xmart_...

{
  "orderId": "uuid",
  "network": "POLYGON"
}
```

**Response:**

```json
{
  "success": true,
  "payment": {
    "depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "amount": "110.00",
    "currency": "USDT",
    "network": "POLYGON",
    "expiresAt": "2024-01-02T12:00:00Z",
    "qrData": "{...}"
  }
}
```

##### 1.6 Confirm Payment

```http
POST /api/v1/payment/confirm
X-API-Key: xmart_...

{
  "orderId": "uuid",
  "txHash": "0xabc123..."
}
```

**Response:**

```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "orderNumber": "EXT-1234567890-1234",
    "status": "PAYMENT_DETECTED",
    "total": "110.00"
  },
  "commission": {
    "id": "uuid",
    "amount": "5.50",
    "rate": "5%"
  }
}
```

##### 1.7 Get Order Status

```http
GET /api/v1/payment/status/:orderId
X-API-Key: xmart_...
```

---

### 2. Sellers Module

Products are linked to verified sellers (companies/manufacturers).

#### Endpoints

##### 2.1 List Verified Sellers

```http
GET /api/v1/sellers?page=1&limit=20&country=USA&type=MANUFACTURER
X-API-Key: xmart_...
```

**Response:**

```json
{
  "sellers": [
    {
      "id": "uuid",
      "name": "TechCorp Inc.",
      "tradingName": "TechCorp",
      "type": "MANUFACTURER",
      "logo": "https://...",
      "description": "Leading electronics...",
      "location": "San Francisco, USA",
      "rating": "4.85",
      "totalReviews": 1250,
      "totalSales": 5000,
      "productCount": 150
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

##### 2.2 Get Seller Details

```http
GET /api/v1/sellers/:id
X-API-Key: xmart_...
```

**Response:**

```json
{
  "id": "uuid",
  "name": "TechCorp Inc.",
  "tradingName": "TechCorp",
  "type": "MANUFACTURER",
  "isVerified": true,
  "verifiedAt": "2024-01-01T00:00:00Z",
  "logo": "https://...",
  "banner": "https://...",
  "description": "Leading manufacturer...",
  "website": "https://techcorp.com",
  "location": {
    "city": "San Francisco",
    "state": "CA",
    "country": "USA"
  },
  "stats": {
    "rating": "4.85",
    "totalReviews": 1250,
    "totalSales": 5000
  },
  "memberSince": "2023-01-01T00:00:00Z"
}
```

##### 2.3 Get Seller Products

```http
GET /api/v1/sellers/:id/products?page=1&limit=20&category=Electronics
X-API-Key: xmart_...
```

---

### 3. Ads & Recommendations

Get product recommendations and track ad clicks for analytics.

#### Endpoints

##### 3.1 Get Recommendations

```http
POST /api/v1/ads/get-recommendations
X-API-Key: xmart_...

{
  "category": "Electronics",
  "limit": 10,
  "excludeProductIds": ["uuid1", "uuid2"]
}
```

**Response:**

```json
{
  "recommendations": [
    {
      "productId": "uuid",
      "name": "Product Name",
      "description": "Short description...",
      "imageUrl": "https://...",
      "images": ["https://..."],
      "category": "Electronics",
      "brand": "BrandName",
      "rating": "4.5",
      "totalReviews": 120,
      "stock": 50,
      "prices": [
        { "currency": "USDT", "price": "99.99" },
        { "currency": "USDC", "price": "99.99" }
      ],
      "seller": {
        "id": "uuid",
        "name": "TechCorp",
        "isVerified": true,
        "rating": "4.8"
      },
      "clickToken": "eyJhbGc..."
    }
  ],
  "total": 10
}
```

##### 3.2 Open Ad (Track Click)

```http
POST /api/v1/ads/open
X-API-Key: xmart_...

{
  "clickToken": "eyJhbGc..."
}
```

**Response:**

```json
{
  "success": true,
  "product": {
    "id": "uuid",
    "name": "Product Name",
    "description": "Full description...",
    "images": ["https://..."],
    "specifications": {...},
    "prices": [...],
    "seller": {...}
  }
}
```

##### 3.3 Get Ad Analytics

```http
GET /api/v1/ads/analytics?startDate=2024-01-01&endDate=2024-01-31
X-API-Key: xmart_...
```

---

### 4. Commissions

API users earn 5% commission on sales. Commissions become available for payout after a 14-day return window.

#### Commission Lifecycle

```
PENDING ──▶ CONFIRMED ──▶ AVAILABLE ──▶ PAID
   │            │             │           │
   │            │             │           └── Payout completed
   │            │             └── 14 days passed, can request payout
   │            └── Payment confirmed on blockchain
   └── Order placed, commission created
```

#### Endpoints

##### 4.1 Get Commission Dashboard

```http
GET /api/v1/commissions/dashboard
X-API-Key: xmart_...
```

**Response:**

```json
{
  "summary": {
    "commissionRate": "5%",
    "totalEarnings": "1500.00",
    "pendingEarnings": "250.00",
    "availableEarnings": "1250.00",
    "payoutWallet": "0x742d35...",
    "payoutNetwork": "POLYGON"
  },
  "breakdown": {
    "pending": { "count": 5, "amount": "250.00" },
    "confirmed": { "count": 10, "amount": "500.00" },
    "available": { "count": 20, "amount": "1000.00" },
    "paid": { "count": 50, "amount": "2500.00" },
    "cancelled": { "count": 2, "amount": "100.00" }
  },
  "recentCommissions": [
    {
      "id": "uuid",
      "orderNumber": "EXT-123...",
      "productName": "Product Name",
      "orderTotal": "100.00",
      "commissionAmount": "5.00",
      "status": "CONFIRMED",
      "createdAt": "2024-01-01T00:00:00Z",
      "availableAt": "2024-01-15T00:00:00Z"
    }
  ]
}
```

##### 4.2 Get Commission History

```http
GET /api/v1/commissions/history?status=AVAILABLE&page=1&limit=20
X-API-Key: xmart_...
```

##### 4.3 Request Payout

```http
POST /api/v1/commissions/payout
X-API-Key: xmart_...

{
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "network": "POLYGON",
  "stablecoinType": "USDT"
}
```

**Response:**

```json
{
  "payoutId": "uuid",
  "amount": "1250.00",
  "currency": "USDT",
  "network": "POLYGON",
  "walletAddress": "0x742d35...",
  "status": "PENDING",
  "message": "Payout request submitted. Processing typically takes 1-3 business days."
}
```

**Note:** Minimum payout amount is $10.

##### 4.4 Get Payout History

```http
GET /api/v1/commissions/payouts
X-API-Key: xmart_...
```

##### 4.5 Update Payout Wallet

```http
PATCH /api/v1/commissions/payout-wallet
X-API-Key: xmart_...

{
  "walletAddress": "0x...",
  "network": "POLYGON"
}
```

---

### 5. Webhooks

Receive real-time notifications for payment events.

#### Webhook Events

| Event | Description |
|-------|-------------|
| `PAYMENT_INITIATED` | Customer started payment flow |
| `PAYMENT_DETECTED` | Payment transaction detected |
| `PAYMENT_CONFIRMED` | Payment confirmed on blockchain |
| `PAYMENT_FAILED` | Payment failed or expired |
| `ORDER_SHIPPED` | Order has been shipped |
| `ORDER_DELIVERED` | Order delivered |

#### Webhook Payload

```json
{
  "event": "PAYMENT_CONFIRMED",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "orderId": "uuid",
    "orderNumber": "EXT-123...",
    "status": "PAYMENT_CONFIRMED",
    "amount": "110.00",
    "currency": "USDT",
    "network": "POLYGON",
    "txHash": "0xabc123...",
    "commission": {
      "id": "uuid",
      "amount": "5.50"
    }
  }
}
```

#### Webhook Signature Verification

Webhooks include HMAC signature in `X-Webhook-Signature` header:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return signature === expectedSignature;
}
```

#### Configure Webhook URL

```http
PATCH /api-keys/:id/webhook
Authorization: Bearer <jwt_token>

{
  "webhookUrl": "https://your-app.com/webhooks/0xmart",
  "webhookSecret": "your-secret-key"
}
```

---

### 6. API Keys Management

For platform users to manage their API keys.

#### Endpoints

##### 6.1 Create API Key

```http
POST /api-keys
Authorization: Bearer <jwt_token>

{
  "name": "Production API Key",
  "expiresInDays": 90,
  "subscriptionTier": "pro",
  "webhookUrl": "https://..."
}
```

**Response:**

```json
{
  "id": "uuid",
  "name": "Production API Key",
  "apiKey": "xmart_aBc123...",     // ONLY SHOWN ONCE!
  "apiSecret": "xms_XyZ789...",    // ONLY SHOWN ONCE!
  "prefix": "xmart_aB",
  "tier": "pro",
  "createdAt": "2024-01-01T00:00:00Z",
  "expiresAt": "2024-04-01T00:00:00Z"
}
```

##### 6.2 List API Keys

```http
GET /api-keys
Authorization: Bearer <jwt_token>
```

##### 6.3 Rotate API Key

```http
POST /api-keys/:id/rotate
Authorization: Bearer <jwt_token>
```

##### 6.4 Get Analytics

```http
GET /api-keys/:id/analytics?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <jwt_token>
```

##### 6.5 Update Subscription Tier

```http
PATCH /api-keys/:id/tier
Authorization: Bearer <jwt_token>

{
  "tier": "enterprise"
}
```

#### Subscription Tiers

| Tier | Monthly Quota | Rate Limit/min | Rate Limit/day |
|------|---------------|----------------|----------------|
| free | 1,000 | 30 | 1,000 |
| basic | 10,000 | 60 | 10,000 |
| pro | 100,000 | 120 | 50,000 |
| enterprise | 1,000,000 | 300 | 200,000 |

---

## Data Types

### Enums

```typescript
// Network types
type NetworkType =
  | 'ETHEREUM' | 'POLYGON' | 'BSC' | 'ARBITRUM'
  | 'OPTIMISM' | 'AVALANCHE' | 'SUI' | 'TON' | 'BASE';

// Stablecoin types
type StablecoinType = 'USDT' | 'USDC' | 'DAI' | 'BUSD';

// Seller types
type SellerType =
  | 'MANUFACTURER' | 'DISTRIBUTOR' | 'WHOLESALER'
  | 'RETAILER' | 'AGENCY' | 'BRAND' | 'INDIVIDUAL';

// Order status
type ExternalOrderStatus =
  | 'INITIATED' | 'AWAITING_VERIFICATION' | 'AWAITING_ADDRESS'
  | 'AWAITING_PAYMENT' | 'PAYMENT_DETECTED' | 'PAYMENT_CONFIRMED'
  | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED';

// Commission status
type CommissionStatus =
  | 'PENDING' | 'CONFIRMED' | 'AVAILABLE' | 'PAID' | 'CANCELLED';
```

### TypeScript Interfaces

```typescript
interface Product {
  id: string;
  name: string;
  shortDescription?: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  category?: string;
  subcategory?: string;
  brand?: string;
  sku?: string;
  stock: number;
  rating: string;
  totalReviews: number;
  isFeatured: boolean;
  isDigital: boolean;
  prices: ProductPrice[];
  seller: SellerSummary;
}

interface ProductPrice {
  currency: StablecoinType;
  price: string;
}

interface Seller {
  id: string;
  name: string;
  tradingName?: string;
  type: SellerType;
  isVerified: boolean;
  verifiedAt?: string;
  logo?: string;
  banner?: string;
  description?: string;
  website?: string;
  location: {
    city?: string;
    state?: string;
    country: string;
  };
  stats: {
    rating: string;
    totalReviews: number;
    totalSales: number;
  };
  memberSince: string;
}

interface Commission {
  id: string;
  orderNumber: string;
  productName?: string;
  orderTotal: string;
  commissionRate: string;
  commissionAmount: string;
  currency: StablecoinType;
  status: CommissionStatus;
  createdAt: string;
  confirmedAt?: string;
  availableAt?: string;
  paidAt?: string;
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/missing API key |
| 402 | Payment Required - Action requires payment |
| 404 | Not Found |
| 409 | Conflict - Duplicate resource |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "details": { ... }  // Optional additional details
}
```

### Common Errors

| Error Code | Description |
|------------|-------------|
| `INVALID_API_KEY` | API key is invalid or expired |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `EMAIL_MISMATCH` | Phone is linked to different email |
| `PHONE_MISMATCH` | Email is linked to different phone |
| `OTP_EXPIRED` | OTP code has expired |
| `OTP_INVALID` | Incorrect OTP code |
| `PRODUCT_NOT_FOUND` | Product doesn't exist |
| `INSUFFICIENT_STOCK` | Not enough stock |
| `ORDER_EXPIRED` | Payment window expired |
| `DUPLICATE_ORDER` | Idempotency key already used |

---

## Frontend Implementation Checklist

### Phase 1: Core Integration

- [ ] Set up API client with X-API-Key header
- [ ] Implement error handling for all status codes
- [ ] Add rate limit handling (retry with backoff)

### Phase 2: Payment Flow

- [ ] Initiate payment form (product, customer info)
- [ ] OTP verification screen
- [ ] Address collection form
- [ ] Network selection UI
- [ ] Payment details display (address, QR code, amount)
- [ ] Transaction hash submission
- [ ] Order status polling/display

### Phase 3: Product Discovery

- [ ] Product recommendations component
- [ ] Seller profile pages
- [ ] Seller products listing
- [ ] Ad click tracking integration

### Phase 4: Commission Dashboard (For API Users)

- [ ] Commission summary cards
- [ ] Commission history table with filters
- [ ] Payout request form
- [ ] Payout history
- [ ] Wallet configuration

### Phase 5: API Key Management (Platform UI)

- [ ] Create API key modal (show key once!)
- [ ] API keys list with status badges
- [ ] Key rotation functionality
- [ ] Analytics dashboard
- [ ] Webhook configuration

### Phase 6: Webhook Integration

- [ ] Webhook endpoint implementation
- [ ] Signature verification
- [ ] Event handling for all event types
- [ ] Retry handling for failed deliveries

---

## Rate Limit Headers

All API responses include rate limit headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 2024-01-01T12:01:00Z
```

---

## Best Practices

1. **Always handle 402 responses** - They contain payment instructions
2. **Implement idempotency** - Use `idempotencyKey` for payment initiation
3. **Verify webhook signatures** - Never trust unsigned webhooks
4. **Store API keys securely** - Never expose in client-side code
5. **Implement retry logic** - With exponential backoff for failures
6. **Cache seller data** - Seller info doesn't change frequently
7. **Track ad clicks** - Use `clickToken` for proper attribution

---

**Last Updated:** November 2024
**API Version:** v1
