## Authentications

AUTH ENDPOINTS
POST /auth/send-otp - Send OTP to Email
POST /auth/verify-otp - Verify OTP and Login
GET /auth/me - Access Protected Route
POST /auth/refresh - Refresh Token
POST /auth/logout - Logout

## Users

USER ENDPOINTS:
GET /users/me - Get current user profile with wallets
PUT /users/me - Update current user profile  
GET /users/me/stats - Get user statistics
PUT /users/me/deactivate - Deactivate account
GET /users - Get all users (Admin only)
GET /users/:id - Get user by ID (Admin only)
PUT /users/:id/reactivate - Reactivate user (Admin only)

## Wallets

WALLET ENDPOINTS:
POST /wallets - Create new wallet
GET /wallets - Get all user wallets
GET /wallets/:id - Get wallet by ID
GET /wallets/:id/transactions - Get wallet transaction history
POST /wallets/withdraw - Initiate withdrawal

## Products & Orders

PRODUCTS:
POST /products - Create product (Admin)
GET /products - List all products (Public)
GET /products/categories - Get categories (Public)
GET /products/search?q=query - Search products (Public)
GET /products/:id - Get product details (Public)
PATCH /products/:id - Update product (Admin)
DELETE /products/:id - Deactivate product (Admin)

ORDERS:
POST /orders - Create order
POST /orders/:id/confirm-payment - Confirm payment
GET /orders - Get user orders
GET /orders/:id - Get order details
DELETE /orders/:id - Cancel order

ADMIN:
GET /orders/admin/all - Get all orders
PATCH /orders/admin/:id/status - Update order status

## KYC

USER ENDPOINTS:
POST /kyc/initiate - Start KYC verification
GET /kyc/status - Get KYC status
POST /kyc/retry - Retry after rejection

WEBHOOK:
POST /kyc/webhook - Receive provider updates (public)

ADMIN ENDPOINTS:
GET /kyc/admin/applications - Get all KYC applications
PATCH /kyc/admin/:id/approve - Manually approve
PATCH /kyc/admin/:id/reject - Manually reject

TESTING (Mock only):
POST /kyc/test/approve - Test approve
POST /kyc/test/reject - Test reject

## FiatPurchases

USER ENDPOINTS:
POST /fiat-purchase - Initiate purchase
GET /fiat-purchase - Get purchase history
GET /fiat-purchase/:id - Get purchase details

WEBHOOK (Public):
POST /fiat-purchase/webhook/stripe - Stripe webhook
POST /fiat-purchase/webhook/razorpay - Razorpay webhook

ADMIN ENDPOINTS:
GET /fiat-purchase/admin/all - Get all purchases
POST /fiat-purchase/admin/:id/refund - Refund purchase
