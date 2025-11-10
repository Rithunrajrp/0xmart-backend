### 1. Send OTP to Email

curl -X POST http://localhost:3000/api/v1/auth/send-otp \
 -H "Content-Type: application/json" \
 -d '{
"email": "user@example.com"
}'
(Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/send-otp" `  -Method POST`
-Headers @{ "Content-Type" = "application/json" } `
-Body '{"email": "rithunravi@gmail.com", "countryCode":"+91", "phoneNumber":"7871766466"}').Content

Response (Development):
{
"message": "OTP sent successfully to your email",
"expiresIn": 600,
"otp": "123456" // Only in development
}

### 2. Check Email

- In development, check console logs for Ethereal preview URL
- Example: https://ethereal.email/message/xxx
- Or use the OTP from the response in development

### 3. Verify OTP and Login

curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
 -H "Content-Type: application/json" \
 -d '{
"email": "user@example.com",
"otp": "123456"
}'

Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/verify-otp" `

-Method POST `  -Headers @{ "Content-Type" = "application/json" }`
-Body '{"email": "rithunravi@gmail.com", "otp": "365891", "countryCode":
"+91", "phoneNumber":"7871766466"}' | Select-Object -ExpandProperty Content
{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5OWFhMjlkMi1kNmJjLTQ5OTAtODlmMS1jYzU1NjgzMzNiNjAiLCJlbWFpbCI6InJpdGh1bnJhdmlAZ21haWwuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3NjIyNTE0ODgsImV4cCI6MTc2MjI1MjM4OH0.lac6u_VusG6pbRUI7j9gSWB-\_fS7Go8evIGlBdUN90k","refreshToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5OWFhMjlkMi1kNmJjLTQ5OTAtODlmMS1jYzU1NjgzMzNiNjAiLCJlbWFpbCI6InJpdGh1bnJhdmlAZ21haWwuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3NjIyNTE0ODgsImV4cCI6MTc2Mjg1NjI4OH0.9jX0DqFBKtvkUcvMwJ41oeKlqVKbQKuKIAxLo8UGmeU","expiresIn":900,"user":{"id":"99aa29d2-d6bc-4990-89f1-cc5568333b60","email":"rithunravi@gmail.com","phoneNumber":"","countryCode":"","role":"USER","kycStatus":"NOT_STARTED"}}

Response:
{
"accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
"refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
"expiresIn": 900,
"user": {
"id": "uuid",
"email": "user@example.com",
"phoneNumber": null,
"countryCode": null,
"role": "USER",
"kycStatus": "NOT_STARTED"
}
}

### 4. Access Protected Route

curl -X GET http://localhost:3000/api/v1/auth/me \
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/me" `

> > -Method GET `  -Headers @{ "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5OWFhMjlkMi1kNmJjLTQ5OTAtODlmMS1jYzU1NjgzMzNiNjAiLCJlbWFpbCI6InJpdGh1bnJhdmlAZ21haWwuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3NjIyNTE0ODgsImV4cCI6MTc2MjI1MjM4OH0.lac6u_VusG6pbRUI7j9gSWB-_fS7Go8evIGlBdUN90k" }`
> > | Select-Object -ExpandProperty Content
> > {"id":"99aa29d2-d6bc-4990-89f1-cc5568333b60","email":"rithunravi@gmail.com","phoneNumber":"","countryCode":"","role":"USER","status":"ACTIVE","kycStatus":"NOT_STARTED"}

### 5. Refresh Token

curl -X POST http://localhost:3000/api/v1/auth/refresh \
 -H "Content-Type: application/json" \
 -d '{
"refreshToken": "YOUR_REFRESH_TOKEN"
}'

Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/refresh" `

> > -Method POST `  -Headers @{ "Content-Type" = "application/json" }`
> > -Body '{
> > "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5OWFhMjlkMi1kNmJjLTQ5OTAtODlmMS1jYzU1NjgzMzNiNjAiLCJlbWFpbCI6InJpdGh1bnJhdmlAZ21haWwuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3NjIyNTE0ODgsImV4cCI6MTc2Mjg1NjI4OH0.9jX0DqFBKtvkUcvMwJ41oeKlqVKbQKuKIAxLo8UGmeU"
> > }' `
> > | Select-Object -ExpandProperty Content
> > {"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5OWFhMjlkMi1kNmJjLTQ5OTAtODlmMS1jYzU1NjgzMzNiNjAiLCJlbWFpbCI6InJpdGh1bnJhdmlAZ21haWwuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3NjIyNTE4MzYsImV4cCI6MTc2MjI1MjczNn0.sE4IZys_KWn-HODqOB2reeQ8DbhI9fC6Uz7AbR9vZXI","refreshToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5OWFhMjlkMi1kNmJjLTQ5OTAtODlmMS1jYzU1NjgzMzNiNjAiLCJlbWFpbCI6InJpdGh1bnJhdmlAZ21haWwuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3NjIyNTE4MzYsImV4cCI6MTc2Mjg1NjYzNn0.0VJHwT-r-vSO7ylPBidKqq0DiWBtSuHn-DlnQzFFpKs","expiresIn":900}

### 6. Logout

curl -X POST http://localhost:3000/api/v1/auth/logout \
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5OWFhMjlkMi1kNmJjLTQ5OTAtODlmMS1jYzU1NjgzMzNiNjAiLCJlbWFpbCI6InJpdGh1bnJhdmlAZ21haWwuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3NjIyNTE4MzYsImV4cCI6MTc2MjI1MjczNn0.sE4IZys_KWn-HODqOB2reeQ8DbhI9fC6Uz7AbR9vZXI"}'

Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/logout" `

> > -Method POST ` -Headers @{

    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5OWFhMjlkMi1kNmJjLTQ5OTAtODlmMS1jYzU1NjgzMzNiNjAiLCJlbWFpbCI6InJpdGh1bnJhdmlAZ21haWwuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3NjIyNTE4MzYsImV4cCI6MTc2MjI1MjczNn0.sE4IZys_KWn-HODqOB2reeQ8DbhI9fC6Uz7AbR9vZXI"
    "Content-Type"  = "application/json"

}`

> > -Body '{
> > "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5OWFhMjlkMi1kNmJjLTQ5OTAtODlmMS1jYzU1NjgzMzNiNjAiLCJlbWFpbCI6InJpdGh1bnJhdmlAZ21haWwuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3NjIyNTE4MzYsImV4cCI6MTc2MjI1MjczNn0.sE4IZys_KWn-HODqOB2reeQ8DbhI9fC6Uz7AbR9vZXI"
> > }' `
> > | Select-Object -ExpandProperty Content
> > {"message":"Logged out successfully"}

\*/

### 1. Get User Profile with Wallets

curl -X GET http://localhost:3000/api/v1/users/me \
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

Response:
{
"id": "uuid",
"email": "user@example.com",
"phoneNumber": "+11234567890",
"role": "USER",
"status": "ACTIVE",
"kycStatus": "NOT_STARTED",
"wallets": [
{
"id": "wallet-uuid",
"stablecoinType": "USDT",
"network": "POLYGON",
"depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
"balance": "0",
"lockedBalance": "0"
}
]
}

### 2. Create New Wallet

curl -X POST http://localhost:3000/api/v1/wallets \
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"stablecoinType": "USDT",
"network": "POLYGON"
}'

Response:
{
"id": "wallet-uuid",
"userId": "user-uuid",
"stablecoinType": "USDT",
"network": "POLYGON",
"depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
"balance": "0",
"lockedBalance": "0",
"createdAt": "2025-02-11T10:00:00.000Z"
}

### 3. Get All User Wallets

curl -X GET http://localhost:3000/api/v1/wallets \
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

### 4. Get User Statistics

curl -X GET http://localhost:3000/api/v1/users/me/stats \
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

Response:
{
"userId": "uuid",
"kycStatus": "NOT_STARTED",
"totalBalance": "0.00",
"totalLocked": "0.00",
"walletsCount": 3,
"transactionCount": 0,
"orderCount": 0,
"memberSince": "2025-02-11T10:00:00.000Z",
"lastLogin": "2025-02-11T10:30:00.000Z"
}

### 5. Update User Profile

curl -X PUT http://localhost:3000/api/v1/users/me \
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"email": "newemail@example.com"
}'

### 6. Initiate Withdrawal

curl -X POST http://localhost:3000/api/v1/wallets/withdraw \
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"stablecoinType": "USDT",
"network": "POLYGON",
"toAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
"amount": "100.50"
}'

Response:
{
"withdrawalId": "withdrawal-uuid",
"amount": "100.50",
"networkFee": "0.001",
"status": "PENDING",
"message": "Withdrawal request submitted. It will be processed shortly."
}

### 7. Get Wallet Transactions

curl -X GET http://localhost:3000/api/v1/wallets/{wallet-id}/transactions \
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

### 8. Admin: Get All Users

curl -X GET "http://localhost:3000/api/v1/users?page=1&limit=20" \
 -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"

### 9. Admin: Get User by ID

curl -X GET http://localhost:3000/api/v1/users/{user-id} \
 -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"

### 10. Deactivate Account

curl -X PUT http://localhost:3000/api/v1/users/me/deactivate \
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

\*/

/\*

### PRODUCTS FLOW

1. Create Product (Admin)
   curl -X POST http://localhost:3000/api/v1/products \
    -H "Authorization: Bearer ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
   "name": "Premium Coffee Beans",
   "description": "1kg bag of premium arabica coffee beans from Colombia",
   "imageUrl": "https://example.com/coffee.jpg",
   "category": "Coffee",
   "prices": [
   {
   "stablecoinType": "USDT",
   "price": "29.99"
   },
   {
   "stablecoinType": "USDC",
   "price": "29.99"
   },
   {
   "stablecoinType": "DAI",
   "price": "30.50"
   }
   ],
   "metadata": {
   "weight": "1kg",
   "origin": "Colombia"
   }
   }'

Response:
{
"id": "product-uuid",
"name": "Premium Coffee Beans",
"description": "1kg bag of premium arabica coffee beans from Colombia",
"imageUrl": "https://example.com/coffee.jpg",
"category": "Coffee",
"status": "ACTIVE",
"prices": [
{
"id": "price-uuid",
"stablecoinType": "USDT",
"price": "29.99"
},
{
"id": "price-uuid-2",
"stablecoinType": "USDC",
"price": "29.99"
}
],
"metadata": {
"weight": "1kg",
"origin": "Colombia"
},
"createdAt": "2025-02-11T10:00:00.000Z"
}

2. Get All Products (Public)
   curl -X GET http://localhost:3000/api/v1/products

curl -X GET "http://localhost:3000/api/v1/products?category=Coffee&page=1&limit=20"

Response:
{
"products": [
{
"id": "product-uuid",
"name": "Premium Coffee Beans",
"category": "Coffee",
"status": "ACTIVE",
"prices": [...]
}
],
"pagination": {
"total": 10,
"page": 1,
"limit": 20,
"totalPages": 1
}
}

3. Get Product by ID (Public)
   curl -X GET http://localhost:3000/api/v1/products/{product-id}

4. Search Products (Public)
   curl -X GET "http://localhost:3000/api/v1/products/search?q=coffee"

5. Get Categories (Public)
   curl -X GET http://localhost:3000/api/v1/products/categories

Response:
["Coffee", "Tea", "Snacks", "Beverages"]

6. Update Product (Admin)
   curl -X PATCH http://localhost:3000/api/v1/products/{product-id} \
    -H "Authorization: Bearer ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
   "name": "Premium Colombian Coffee",
   "status": "ACTIVE",
   "prices": [
   {
   "stablecoinType": "USDT",
   "price": "27.99"
   }
   ]
   }'

7. Deactivate Product (Admin)
   curl -X DELETE http://localhost:3000/api/v1/products/{product-id} \
    -H "Authorization: Bearer ADMIN_TOKEN"

### ORDERS FLOW

Prerequisites:

- User must be logged in
- User must have a wallet with the chosen stablecoin
- Wallet must have sufficient balance

1. Create Order
   curl -X POST http://localhost:3000/api/v1/orders \
    -H "Authorization: Bearer USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
   "stablecoinType": "USDT",
   "items": [
   {
   "productId": "product-uuid-1",
   "quantity": 2
   },
   {
   "productId": "product-uuid-2",
   "quantity": 1
   }
   ],
   "shippingAddress": {
   "street": "123 Main St",
   "city": "New York",
   "state": "NY",
   "zipCode": "10001",
   "country": "USA"
   }
   }'

Response:
{
"id": "order-uuid",
"userId": "user-uuid",
"orderNumber": "ORD-ABCD1234-XYZ",
"stablecoinType": "USDT",
"subtotal": "59.98",
"tax": "5.998",
"total": "65.978",
"status": "PAYMENT_PENDING",
"shippingAddress": {...},
"items": [
{
"id": "item-uuid",
"productId": "product-uuid-1",
"quantity": 2,
"pricePerUnit": "29.99",
"totalPrice": "59.98",
"product": {
"id": "product-uuid-1",
"name": "Premium Coffee Beans",
"imageUrl": "https://..."
}
}
],
"createdAt": "2025-02-11T11:00:00.000Z"
}

Note: Balance is LOCKED at this point, not deducted yet.

2. Confirm Payment (Process Order)
   curl -X POST http://localhost:3000/api/v1/orders/{order-id}/confirm-payment \
    -H "Authorization: Bearer USER_TOKEN"

Response:
{
"id": "order-uuid",
"status": "CONFIRMED",
"paidAt": "2025-02-11T11:01:00.000Z",
...
}

Note: Balance is now DEDUCTED from wallet.

3. Get User Orders
   curl -X GET http://localhost:3000/api/v1/orders \
    -H "Authorization: Bearer USER_TOKEN"

# Filter by status

curl -X GET "http://localhost:3000/api/v1/orders?status=CONFIRMED&page=1&limit=10" \
 -H "Authorization: Bearer USER_TOKEN"

Response:
{
"orders": [
{
"id": "order-uuid",
"orderNumber": "ORD-ABCD1234-XYZ",
"status": "CONFIRMED",
"total": "65.978",
"items": [...]
}
],
"pagination": {
"total": 5,
"page": 1,
"limit": 10,
"totalPages": 1
}
}

4. Get Order Details
   curl -X GET http://localhost:3000/api/v1/orders/{order-id} \
    -H "Authorization: Bearer USER_TOKEN"

Response includes transactions:
{
"id": "order-uuid",
"orderNumber": "ORD-ABCD1234-XYZ",
"status": "CONFIRMED",
"total": "65.978",
"items": [...],
"transactions": [
{
"id": "tx-uuid",
"type": "PURCHASE",
"status": "COMPLETED",
"amount": "65.978",
"createdAt": "..."
}
]
}

5. Cancel Order (Only if PENDING or PAYMENT_PENDING)
   curl -X DELETE http://localhost:3000/api/v1/orders/{order-id} \
    -H "Authorization: Bearer USER_TOKEN"

Response:
{
"message": "Order cancelled successfully"
}

Note: Locked balance is UNLOCKED.

### ADMIN ORDER MANAGEMENT

1. Get All Orders (Admin)
   curl -X GET http://localhost:3000/api/v1/orders/admin/all \
    -H "Authorization: Bearer ADMIN_TOKEN"

# With filters

curl -X GET "http://localhost:3000/api/v1/orders/admin/all?status=CONFIRMED&userId=user-uuid&page=1" \
 -H "Authorization: Bearer ADMIN_TOKEN"

Response:
{
"orders": [
{
"id": "order-uuid",
"orderNumber": "ORD-ABCD1234-XYZ",
"user": {
"id": "user-uuid",
"email": "user@example.com"
},
"status": "CONFIRMED",
"total": "65.978",
"items": [...]
}
],
"pagination": {...}
}

2. Update Order Status (Admin)
   curl -X PATCH http://localhost:3000/api/v1/orders/admin/{order-id}/status \
    -H "Authorization: Bearer ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
   "status": "SHIPPED",
   "trackingNumber": "TRACK123456789"
   }'

Response:
{
"id": "order-uuid",
"status": "SHIPPED",
"trackingNumber": "TRACK123456789",
"shippedAt": "2025-02-11T12:00:00.000Z",
...
}

# Mark as delivered

curl -X PATCH http://localhost:3000/api/v1/orders/admin/{order-id}/status \
 -H "Authorization: Bearer ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"status": "DELIVERED"
}'

\*/

// ============================================
// COMPLETE USER JOURNEY EXAMPLE
// ============================================
/\*

### Step-by-Step: From Login to Order Delivery

## STEP 1: Admin Creates Products

POST /products
{
"name": "Organic Green Tea",
"category": "Tea",
"prices": [
{"stablecoinType": "USDT", "price": "15.99"},
{"stablecoinType": "USDC", "price": "15.99"}
]
}

POST /products
{
"name": "Dark Roast Coffee",
"category": "Coffee",
"prices": [
{"stablecoinType": "USDT", "price": "24.99"},
{"stablecoinType": "USDC", "price": "24.99"}
]
}

## STEP 2: User Browses Products

GET /products
GET /products/categories
GET /products/search?q=coffee

## STEP 3: User Logs In

POST /auth/send-otp {"email": "john@example.com"}
POST /auth/verify-otp {"email": "john@example.com", "otp": "123456"}
=> Get access token

## STEP 4: User Creates Wallet

POST /wallets
{
"stablecoinType": "USDT",
"network": "POLYGON"
}
=> Get deposit address: 0xabc123...

## STEP 5: User Deposits USDT (External)

User sends 100 USDT to deposit address 0xabc123...
(Deposit monitor would detect this and credit wallet)
For testing: Manually update wallet balance to 100 USDT

## STEP 6: User Checks Balance

GET /users/me/stats
=> totalBalance: "100.00"

GET /wallets
=> balance: "100.00", lockedBalance: "0.00"

## STEP 7: User Creates Order

POST /orders
{
"stablecoinType": "USDT",
"items": [
{"productId": "tea-uuid", "quantity": 2},
{"productId": "coffee-uuid", "quantity": 1}
],
"shippingAddress": {...}
}

Calculation:

- Tea: $15.99 × 2 = $31.98
- Coffee: $24.99 × 1 = $24.99
- Subtotal: $56.97
- Tax (10%): $5.70
- Total: $62.67

Response: Order created with status "PAYMENT_PENDING"
Balance: available = 37.33, locked = 62.67

## STEP 8: User Confirms Payment

POST /orders/{order-id}/confirm-payment

Response: Order status changed to "CONFIRMED"
Balance: available = 37.33, locked = 0.00
(62.67 deducted from wallet)

## STEP 9: User Checks Order

GET /orders
GET /orders/{order-id}

Status: "CONFIRMED", paidAt: timestamp

## STEP 10: Admin Processes Order

GET /orders/admin/all?status=CONFIRMED

PATCH /orders/admin/{order-id}/status
{
"status": "PROCESSING"
}

## STEP 11: Admin Ships Order

PATCH /orders/admin/{order-id}/status
{
"status": "SHIPPED",
"trackingNumber": "FX123456789"
}

## STEP 12: User Tracks Order

GET /orders/{order-id}
=> status: "SHIPPED", trackingNumber: "FX123456789"

## STEP 13: Admin Marks Delivered

PATCH /orders/admin/{order-id}/status
{
"status": "DELIVERED"
}

## STEP 14: User Confirms Receipt

GET /orders/{order-id}
=> status: "DELIVERED", deliveredAt: timestamp

DONE! 🎉

\*/

### MOCK KYC TESTING (No Sumsub Required)

The system automatically uses MOCK KYC if Sumsub credentials are not configured.
This allows full testing without external dependencies.

#### 1. User Initiates KYC

curl -X POST http://localhost:3000/api/v1/kyc/initiate \
 -H "Authorization: Bearer USER_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"firstName": "John",
"lastName": "Doe",
"dateOfBirth": "1990-01-15",
"country": "USA",
"documentType": "passport",
"documentNumber": "AB123456"
}'

Response:
{
"applicantId": "mock_user-uuid_1707654321000",
"accessToken": "mock_token_mock_user-uuid_1707654321000_1707654321001",
"sdkUrl": "mock://kyc-verification/mock_user-uuid_1707654321000",
"status": "PENDING",
"expiresAt": "2025-02-11T13:30:00.000Z"
}

User KYC status is now: PENDING

#### 2. Check KYC Status

curl -X GET http://localhost:3000/api/v1/kyc/status \
 -H "Authorization: Bearer USER_TOKEN"

Response:
{
"userId": "user-uuid",
"kycStatus": "PENDING",
"applicantId": "mock_user-uuid_1707654321000",
"providerStatus": {
"reviewStatus": "PENDING",
"reviewResult": null,
"moderationComment": null
},
"documents": [
{
"id": "doc-uuid",
"documentType": "passport",
"status": "PENDING",
"submittedAt": "2025-02-11T12:30:00.000Z"
}
],
"canRetry": false
}

#### 3. Test Approve KYC (Mock)

curl -X POST http://localhost:3000/api/v1/kyc/test/approve \
 -H "Authorization: Bearer USER_TOKEN"

Response:
{
"success": true,
"message": "Mock KYC approved"
}

Now check status again:
curl -X GET http://localhost:3000/api/v1/kyc/status \
 -H "Authorization: Bearer USER_TOKEN"

Response:
{
"kycStatus": "APPROVED",
"providerStatus": {
"reviewStatus": "APPROVED",
"reviewResult": {
"reviewAnswer": "GREEN"
}
},
"canRetry": false
}

#### 4. Test Reject KYC (Mock)

# First, initiate KYC again with a different user or reset

curl -X POST http://localhost:3000/api/v1/kyc/test/reject \
 -H "Authorization: Bearer USER_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"reason": "Document quality insufficient"
}'

Response:
{
"success": true,
"message": "Mock KYC rejected"
}

#### 5. Retry KYC After Rejection

curl -X POST http://localhost:3000/api/v1/kyc/retry \
 -H "Authorization: Bearer USER_TOKEN"

Response:
{
"applicantId": "same-applicant-id",
"accessToken": "new-token",
"sdkUrl": "mock://kyc-verification/...",
"status": "PENDING"
}

### ADMIN KYC MANAGEMENT

#### 1. View All KYC Applications

curl -X GET http://localhost:3000/api/v1/kyc/admin/applications \
 -H "Authorization: Bearer ADMIN_TOKEN"

# Filter by status

curl -X GET "http://localhost:3000/api/v1/kyc/admin/applications?status=PENDING&page=1&limit=20" \
 -H "Authorization: Bearer ADMIN_TOKEN"

Response:
{
"applications": [
{
"id": "user-uuid",
"email": "user@example.com",
"kycStatus": "PENDING",
"kycProviderId": "mock*user-uuid*...",
"kycData": {
"firstName": "John",
"lastName": "Doe",
"country": "USA"
},
"createdAt": "2025-02-11T10:00:00.000Z",
"kycDocuments": [...]
}
],
"pagination": {
"total": 5,
"page": 1,
"limit": 20,
"totalPages": 1
}
}

#### 2. Manually Approve KYC

curl -X PATCH http://localhost:3000/api/v1/kyc/admin/{user-id}/approve \
 -H "Authorization: Bearer ADMIN_TOKEN"

Response:
{
"success": true,
"message": "KYC approved successfully"
}

#### 3. Manually Reject KYC

curl -X PATCH http://localhost:3000/api/v1/kyc/admin/{user-id}/reject \
 -H "Authorization: Bearer ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"reason": "Suspicious documents"
}'

Response:
{
"success": true,
"message": "KYC rejected"
}

### REAL SUMSUB INTEGRATION

When you're ready to use real Sumsub:

#### 1. Sign up for Sumsub

- Go to https://sumsub.com
- Create account and get credentials
- Configure verification levels

#### 2. Update .env

SUMSUB_APP_TOKEN=sbx:your_app_token_here
SUMSUB_SECRET_KEY=your_secret_key_here
SUMSUB_BASE_URL=https://api.sumsub.com

#### 3. Configure Webhook in Sumsub Dashboard

- URL: https://yourdomain.com/api/v1/kyc/webhook
- Events: applicantReviewed, applicantPending

#### 4. Restart Server

npm run start:dev

System will automatically switch from mock to real Sumsub.

#### 5. Frontend Integration

Use the sdkUrl or accessToken to integrate Sumsub SDK in your frontend:

```html
<script src="https://cdn.sumsub.com/websdk/latest/sumsub-websdk.js"></script>
<script>
  const accessToken = 'token-from-backend';
  const snsWebSdk = idensic.init(accessToken, {
    lang: 'en',
    i18n: {
      document: {
        subTitles: {
          IDENTITY: 'Upload a document that proves your identity',
        },
      },
    },
    onMessage: (type, payload) => {
      console.log('WebSDK onMessage', type, payload);
    },
    onError: (error) => {
      console.error('WebSDK onError', error);
    },
  });

  snsWebSdk.launch('#sumsub-websdk-container');
</script>
```

\*/

### TEST FLOW

#### Step 1: Verify KYC Status

curl -X GET http://localhost:3000/api/v1/kyc/status \
 -H "Authorization: Bearer USER_TOKEN"

Expected:
{
"kycStatus": "APPROVED"
}

If not approved, complete KYC first:
curl -X POST http://localhost:3000/api/v1/kyc/test/approve \
 -H "Authorization: Bearer USER_TOKEN"

#### Step 2: Check Current Balance

curl -X GET http://localhost:3000/api/v1/wallets \
 -H "Authorization: Bearer USER_TOKEN"

#### Step 3: Initiate Purchase (Stripe)

curl -X POST http://localhost:3000/api/v1/fiat-purchase \
 -H "Authorization: Bearer USER_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"provider": "STRIPE",
"stablecoinType": "USDT",
"fiatAmount": 100,
"fiatCurrency": "USD",
"paymentMethod": "card"
}'

Response:
{
"purchaseId": "purchase-uuid",
"clientSecret": "pi_xxx_secret_xxx",
"paymentUrl": "https://checkout.stripe.com/pi_xxx",
"amount": 100,
"currency": "USD",
"stablecoinAmount": "97.09",
"provider": "STRIPE"
}

Calculation:

- Fiat Amount: $100
- Processing Fee (2.9% + $0.30): $3.20
- Net Amount: $96.80
- Exchange Rate: 1 USDT = $1.005
- Stablecoin Amount: $96.80 / $1.005 = 96.32 USDT

#### Step 4: Complete Payment

For Stripe Test Mode, use test cards:

- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- 3D Secure: 4000 0025 0000 3155

In real integration, user completes payment on Stripe checkout page.

#### Step 5: Simulate Webhook (For Testing)

In production, Stripe sends webhook automatically.
For testing, manually trigger webhook or update status in database:

SQL:
UPDATE fiat_purchases
SET status = 'COMPLETED', completed_at = NOW()
WHERE id = 'purchase-uuid';

UPDATE wallets
SET balance = balance + 96.32
WHERE user_id = 'user-uuid'
AND stablecoin_type = 'USDT';

#### Step 6: Verify Balance Updated

curl -X GET http://localhost:3000/api/v1/wallets \
 -H "Authorization: Bearer USER_TOKEN"

Expected:
{
"stablecoinType": "USDT",
"balance": "96.32",
...
}

#### Step 7: View Purchase History

curl -X GET http://localhost:3000/api/v1/fiat-purchase \
 -H "Authorization: Bearer USER_TOKEN"

Response:
{
"purchases": [
{
"id": "purchase-uuid",
"provider": "STRIPE",
"stablecoinType": "USDT",
"fiatAmount": "100",
"fiatCurrency": "USD",
"stablecoinAmount": "96.32",
"exchangeRate": "1.005",
"processingFee": "3.20",
"status": "COMPLETED",
"createdAt": "2025-02-11T10:00:00.000Z",
"completedAt": "2025-02-11T10:05:00.000Z"
}
],
"pagination": {...}
}

#### Step 8: Get Specific Purchase

curl -X GET http://localhost:3000/api/v1/fiat-purchase/{purchase-id} \
 -H "Authorization: Bearer USER_TOKEN"

### RAZORPAY TESTING

#### Initiate Purchase (Razorpay)

curl -X POST http://localhost:3000/api/v1/fiat-purchase \
 -H "Authorization: Bearer USER_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"provider": "RAZORPAY",
"stablecoinType": "USDT",
"fiatAmount": 5000,
"fiatCurrency": "INR",
"paymentMethod": "upi"
}'

Response includes:

- Razorpay order ID
- Amount in paise (500000 for ₹5000)

For Razorpay, frontend needs to integrate:

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  const options = {
    key: 'rzp_test_xxx',
    amount: 500000,
    currency: 'INR',
    name: '0xMart',
    description: 'USDT Purchase',
    order_id: 'order_xxx',
    handler: function (response) {
      // Verify signature and complete
      console.log(response.razorpay_payment_id);
    },
  };
  const rzp = new Razorpay(options);
  rzp.open();
</script>
```

### ADMIN TESTING

#### View All Purchases

curl -X GET http://localhost:3000/api/v1/fiat-purchase/admin/all \
 -H "Authorization: Bearer ADMIN_TOKEN"

# Filter by status

curl -X GET "http://localhost:3000/api/v1/fiat-purchase/admin/all?status=COMPLETED" \
 -H "Authorization: Bearer ADMIN_TOKEN"

Response:
{
"purchases": [
{
"id": "purchase-uuid",
"user": {
"id": "user-uuid",
"email": "user@example.com"
},
"provider": "STRIPE",
"fiatAmount": "100",
"stablecoinAmount": "96.32",
"status": "COMPLETED",
...
}
],
"pagination": {...}
}

#### Refund Purchase

curl -X POST http://localhost:3000/api/v1/fiat-purchase/admin/{purchase-id}/refund \
 -H "Authorization: Bearer ADMIN_TOKEN"

Response:
{
"success": true,
"message": "Purchase refunded successfully"
}

What happens:

1. Refund initiated with Stripe/Razorpay
2. Stablecoin deducted from user wallet
3. Purchase status changed to REFUNDED
4. Audit log created

### ERROR SCENARIOS

#### 1. Purchase Without KYC

curl -X POST http://localhost:3000/api/v1/fiat-purchase \
 -H "Authorization: Bearer USER_TOKEN" \
 -d '{...}'

Response (400):
{
"statusCode": 400,
"message": "KYC verification required for fiat purchases. Please complete KYC first."
}

#### 2. Provider Not Configured

If Stripe keys not in .env:

Response (400):
{
"statusCode": 400,
"message": "Stripe payment not available"
}

#### 3. Minimum Amount Not Met

curl -X POST http://localhost:3000/api/v1/fiat-purchase \
 -d '{"fiatAmount": 5, ...}'

Response (400):
{
"statusCode": 400,
"message": "fiatAmount must not be less than 10"
}

\*/

### SETUP

1. Ensure blockchain RPCs are configured in .env
2. Ensure SendGrid is configured for notifications
3. System automatically starts monitoring when server starts

### MONITOR STATUS

Check server logs:
[DepositMonitorService] Scanning 5 wallets for deposits
[DepositMonitorService] Found 0 transfer events for wallet 0xabc... on POLYGON
[DepositMonitorService] Updating 0 pending deposits

### TEST DEPOSIT FLOW

#### Step 1: User Gets Deposit Address

curl -X POST http://localhost:3000/api/v1/wallets \
 -H "Authorization: Bearer USER_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"stablecoinType": "USDT",
"network": "POLYGON"
}'

Response:
{
"depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
...
}

#### Step 2: User Sends USDT to Deposit Address

User sends USDT from their external wallet (MetaMask, Trust Wallet, etc.) to the deposit address.

Example transaction on Polygon:

- From: User's wallet
- To: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
- Amount: 100 USDT
- Network: Polygon

#### Step 3: Monitor Detects Transaction (within 30 seconds)

Server logs:
[DepositMonitorService] New deposit detected: 100 USDT to wallet 0x742d... (tx: 0x123abc...)
[DepositMonitorService] Deposit confirmations: 1/128

#### Step 4: Wait for Confirmations

Polygon requires 128 confirmations (~4-5 minutes)

Monitor checks every 30 seconds:
[DepositMonitorService] Deposit confirmations: 50/128
[DepositMonitorService] Deposit confirmations: 100/128
[DepositMonitorService] Deposit confirmations: 128/128

#### Step 5: Deposit Confirmed & Credited

[DepositMonitorService] Confirming deposit: 100 USDT
[DepositMonitorService] Deposit confirmed and credited: 100 USDT to user user@example.com
✅ Deposit confirmation email sent to user@example.com

#### Step 6: User Receives Email

Subject: Your USDT Deposit Has Been Confirmed!
Body: Shows amount, tx hash, explorer link

#### Step 7: User Checks Balance

curl -X GET http://localhost:3000/api/v1/wallets \
 -H "Authorization: Bearer USER_TOKEN"

Response:
{
"stablecoinType": "USDT",
"balance": "100.00",
...
}

✅ Deposit complete!

### MANUAL TESTING (Admin)

#### Trigger Manual Scan

curl -X POST http://localhost:3000/api/v1/deposit-monitor/scan \
 -H "Authorization: Bearer ADMIN_TOKEN"

Response:
{
"success": true,
"message": "Scan completed"
}

#### Check Deposit Status

curl -X GET http://localhost:3000/api/v1/deposit-monitor/status/0x123abc... \
 -H "Authorization: Bearer USER_TOKEN"

Response:
{
"id": "deposit-uuid",
"txHash": "0x123abc...",
"amount": "100",
"stablecoinType": "USDT",
"network": "POLYGON",
"confirmations": 128,
"requiredConfirmations": 128,
"status": "COMPLETED",
"createdAt": "2025-02-11T10:00:00.000Z",
"confirmedAt": "2025-02-11T10:05:00.000Z"
}

\*/

### SETUP

1. Generate a new wallet for hot wallet:

   ```javascript
   const ethers = require('ethers');
   const wallet = ethers.Wallet.createRandom();
   console.log('Address:', wallet.address);
   console.log('Private Key:', wallet.privateKey);
   ```

2. Add to .env:
   HOT_WALLET_PRIVATE_KEY=0xyour_private_key_here

3. Fund hot wallet with:
   - Native tokens for gas (ETH, MATIC, BNB)
   - Stablecoins (USDT, USDC, DAI)

### TEST FLOW

#### Step 1: User Initiates Withdrawal

curl -X POST http://localhost:3000/api/v1/wallets/withdraw \
 -H "Authorization: Bearer USER_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"stablecoinType": "USDT",
"network": "POLYGON",
"toAddress": "0xRecipientAddress",
"amount": "50"
}'

Response:
{
"withdrawalId": "withdrawal-uuid",
"amount": "50",
"networkFee": "0.001",
"status": "PENDING",
"message": "Withdrawal request submitted. It will be processed shortly."
}

Status: PENDING (awaiting approval)

#### Step 2: Admin Views Pending Withdrawals

curl -X GET http://localhost:3000/api/v1/withdrawal-processor/pending \
 -H "Authorization: Bearer ADMIN_TOKEN"

Response:
[
{
"id": "withdrawal-uuid",
"amount": "50",
"networkFee": "0.001",
"toAddress": "0xRecipientAddress",
"network": "POLYGON",
"status": "PENDING",
"wallet": {
"stablecoinType": "USDT",
"user": {
"email": "user@example.com",
"kycStatus": "APPROVED"
}
},
"createdAt": "2025-02-11T10:00:00.000Z"
}
]

#### Step 3: Admin Approves Withdrawal

curl -X PATCH http://localhost:3000/api/v1/withdrawal-processor/{withdrawal-id}/approve \
 -H "Authorization: Bearer ADMIN_TOKEN"

Response:
{
"success": true,
"message": "Withdrawal approved and queued for processing"
}

Status: PENDING (but now approved)

#### Step 4: Processor Automatically Processes (Within 1 Minute)

Server logs:
[WithdrawalProcessorService] Processing 1 pending withdrawals
[WithdrawalProcessorService] Processing withdrawal: 50 USDT to 0xRecipient... on POLYGON
[WithdrawalProcessorService] Executing transfer: 50 USDT to 0xRecipient...
[WithdrawalProcessorService] Transaction broadcasted: 0x789def...
[WithdrawalProcessorService] Withdrawal withdrawal-uuid broadcasted successfully. TX: 0x789def...

Status: PROCESSING

#### Step 5: Processor Checks Confirmations

After transaction is mined:
[WithdrawalProcessorService] Checking 1 processing withdrawals
[WithdrawalProcessorService] Confirming withdrawal withdrawal-uuid: 50 USDT
✅ Withdrawal completion email sent to user@example.com
[WithdrawalProcessorService] Withdrawal withdrawal-uuid completed successfully

Status: COMPLETED

#### Step 6: User Receives Email

Subject: Your USDT Withdrawal is Complete!

Body:

- Amount: 50 USDT
- To Address: 0xRecipient...
- TX Hash: 0x789def...
- Network: Polygon
- Explorer Link
- Transaction Complete!

#### Step 7: User Checks Withdrawal Status

curl -X GET http://localhost:3000/api/v1/withdrawal-processor/status/0x789def... \
 -H "Authorization: Bearer USER_TOKEN"

Response:
{
"id": "withdrawal-uuid",
"txHash": "0x789def...",
"amount": "50",
"networkFee": "0.001",
"stablecoinType": "USDT",
"network": "POLYGON",
"toAddress": "0xRecipient...",
"status": "COMPLETED",
"createdAt": "2025-02-11T10:00:00.000Z",
"processedAt": "2025-02-11T10:01:00.000Z",
"completedAt": "2025-02-11T10:02:00.000Z"
}

#### Step 8: Verify on Blockchain

User can check on PolygonScan:
https://polygonscan.com/tx/0x789def...

- From: Hot Wallet Address
- To: User's External Address
- Value: 50 USDT

✅ Withdrawal Complete!

### ADMIN REJECTION FLOW

If admin wants to reject:

curl -X PATCH http://localhost:3000/api/v1/withdrawal-processor/{withdrawal-id}/reject \
 -H "Authorization: Bearer ADMIN_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"reason": "Suspicious activity detected"
}'

Response:
{
"success": true,
"message": "Withdrawal rejected and balance unlocked"
}
