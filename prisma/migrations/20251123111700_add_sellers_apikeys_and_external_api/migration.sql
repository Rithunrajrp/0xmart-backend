-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('SHIPPING', 'BILLING');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'RETAILER', 'AGENCY', 'BRAND', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "SellerStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CustomerVerificationStatus" AS ENUM ('PENDING', 'EMAIL_VERIFIED', 'PHONE_VERIFIED', 'FULLY_VERIFIED');

-- CreateEnum
CREATE TYPE "DepositAddressStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'USED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ExternalOrderStatus" AS ENUM ('INITIATED', 'AWAITING_VERIFICATION', 'AWAITING_ADDRESS', 'AWAITING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WebhookEventType" AS ENUM ('PAYMENT_INITIATED', 'PAYMENT_DETECTED', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'PAYMENT_EXPIRED', 'ORDER_PROCESSING', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_CANCELLED', 'ORDER_REFUNDED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'AVAILABLE', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SellerPayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ON_HOLD');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ADDRESS_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'ADDRESS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ADDRESS_DELETED';

-- AlterEnum
ALTER TYPE "NetworkType" ADD VALUE 'AVALANCHE';
ALTER TYPE "NetworkType" ADD VALUE 'SUI';
ALTER TYPE "NetworkType" ADD VALUE 'TON';
ALTER TYPE "NetworkType" ADD VALUE 'BASE';

-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'PENDING_REVIEW';
ALTER TYPE "ProductStatus" ADD VALUE 'REJECTED';

-- CreateTable: sellers (MUST be created before products update)
CREATE TABLE "sellers" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "tradingName" TEXT,
    "sellerType" "SellerType" NOT NULL,
    "status" "SellerStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "registrationNumber" TEXT,
    "taxId" TEXT,
    "businessLicense" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL,
    "logo" TEXT,
    "banner" TEXT,
    "description" TEXT,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "rejectionReason" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankName" TEXT,
    "bankRoutingNumber" TEXT,
    "bankSwiftCode" TEXT,
    "payoutWalletAddress" TEXT,
    "payoutNetwork" "NetworkType",
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.10,
    "minOrderValue" DECIMAL(20,8),
    "maxOrderValue" DECIMAL(20,8),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for sellers
CREATE UNIQUE INDEX "sellers_email_key" ON "sellers"("email");
CREATE INDEX "sellers_status_idx" ON "sellers"("status");
CREATE INDEX "sellers_sellerType_idx" ON "sellers"("sellerType");
CREATE INDEX "sellers_country_idx" ON "sellers"("country");
CREATE INDEX "sellers_companyName_idx" ON "sellers"("companyName");

-- Insert a default seller for existing products
INSERT INTO "sellers" (
    "id",
    "companyName",
    "sellerType",
    "email",
    "country",
    "status",
    "updatedAt"
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default Platform Seller',
    'RETAILER',
    'platform@0xmart.com',
    'US',
    'VERIFIED',
    CURRENT_TIMESTAMP
);

-- AlterTable: products - Add new columns with defaults
ALTER TABLE "products" ADD COLUMN "barcode" TEXT,
ADD COLUMN "brand" TEXT,
ADD COLUMN "dimensions" JSONB,
ADD COLUMN "images" JSONB,
ADD COLUMN "isDigital" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN "metaDescription" TEXT,
ADD COLUMN "metaTitle" TEXT,
ADD COLUMN "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
ADD COLUMN "sellerId" TEXT,
ADD COLUMN "shippingClass" TEXT,
ADD COLUMN "shortDescription" TEXT,
ADD COLUMN "sku" TEXT,
ADD COLUMN "slug" TEXT,
ADD COLUMN "specifications" JSONB,
ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "subcategory" TEXT,
ADD COLUMN "tags" JSONB,
ADD COLUMN "totalReviews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "videoUrl" TEXT,
ADD COLUMN "weight" DECIMAL(10,2);

-- Update existing products to use default seller
UPDATE "products" SET "sellerId" = '00000000-0000-0000-0000-000000000001' WHERE "sellerId" IS NULL;

-- Make sellerId NOT NULL after updating existing records
ALTER TABLE "products" ALTER COLUMN "sellerId" SET NOT NULL;

-- Note: Cannot use PENDING_REVIEW here as enum values must be committed first
-- The default will remain ACTIVE; update in a follow-up migration if needed

-- CreateTable: user_addresses
CREATE TABLE "user_addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AddressType" NOT NULL,
    "label" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: seller_documents
CREATE TABLE "seller_documents" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable: product_reviews
CREATE TABLE "product_reviews" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT,
    "userId" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "images" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable: api_keys
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "secretHash" TEXT,
    "prefix" TEXT NOT NULL,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "rateLimitPerDay" INTEGER NOT NULL DEFAULT 10000,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'free',
    "monthlyQuota" INTEGER NOT NULL DEFAULT 1000,
    "usageThisMonth" INTEGER NOT NULL DEFAULT 0,
    "billingResetAt" TIMESTAMP(3),
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "totalEarnings" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "pendingEarnings" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "availableEarnings" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "payoutWalletAddress" TEXT,
    "payoutNetwork" "NetworkType",
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable: api_usage_logs
CREATE TABLE "api_usage_logs" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ad_clicks
CREATE TABLE "ad_clicks" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "clickToken" TEXT NOT NULL,
    "customerSessionId" TEXT,
    "customerPreferences" JSONB,
    "clickedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: external_customers
CREATE TABLE "external_customers" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "countryCode" TEXT,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "CustomerVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "lastVerifiedAt" TIMESTAMP(3),
    "fullName" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "landmark" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "lastActivityAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: external_otp_verifications
CREATE TABLE "external_otp_verifications" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: external_deposit_addresses
CREATE TABLE "external_deposit_addresses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "network" "NetworkType" NOT NULL,
    "stablecoinType" "StablecoinType" NOT NULL,
    "address" TEXT NOT NULL,
    "status" "DepositAddressStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "pendingBalance" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "totalReceived" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_deposit_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: external_orders
CREATE TABLE "external_orders" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "depositAddressId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "stablecoinType" "StablecoinType" NOT NULL,
    "network" "NetworkType",
    "pricePerUnit" DECIMAL(20,8) NOT NULL,
    "subtotal" DECIMAL(20,8) NOT NULL,
    "tax" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "total" DECIMAL(20,8) NOT NULL,
    "status" "ExternalOrderStatus" NOT NULL DEFAULT 'INITIATED',
    "depositAddress" TEXT,
    "expectedAmount" DECIMAL(20,8),
    "receivedAmount" DECIMAL(20,8),
    "txHash" TEXT,
    "paymentExpiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "shippingAddress" JSONB,
    "trackingNumber" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "external_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: webhook_logs
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" "WebhookEventType" NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
    "statusCode" INTEGER,
    "response" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: commissions
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "orderTotal" DECIMAL(20,8) NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "commissionAmount" DECIMAL(20,8) NOT NULL,
    "stablecoinType" "StablecoinType" NOT NULL,
    "network" "NetworkType",
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "payoutId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: commission_payouts
CREATE TABLE "commission_payouts" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "totalAmount" DECIMAL(20,8) NOT NULL,
    "stablecoinType" "StablecoinType" NOT NULL,
    "network" "NetworkType" NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "txHash" TEXT,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: seller_payouts
CREATE TABLE "seller_payouts" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "grossAmount" DECIMAL(20,8) NOT NULL,
    "platformFee" DECIMAL(20,8) NOT NULL,
    "netAmount" DECIMAL(20,8) NOT NULL,
    "stablecoinType" "StablecoinType" NOT NULL,
    "network" "NetworkType",
    "payoutMethod" TEXT NOT NULL,
    "walletAddress" TEXT,
    "bankReference" TEXT,
    "txHash" TEXT,
    "status" "SellerPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "requestedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "orderIds" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: user_addresses
CREATE INDEX "user_addresses_userId_idx" ON "user_addresses"("userId");
CREATE INDEX "user_addresses_userId_type_idx" ON "user_addresses"("userId", "type");
CREATE INDEX "user_addresses_userId_isDefault_idx" ON "user_addresses"("userId", "isDefault");

-- CreateIndex: seller_documents
CREATE INDEX "seller_documents_sellerId_idx" ON "seller_documents"("sellerId");
CREATE INDEX "seller_documents_documentType_idx" ON "seller_documents"("documentType");

-- CreateIndex: product_reviews
CREATE INDEX "product_reviews_productId_idx" ON "product_reviews"("productId");
CREATE INDEX "product_reviews_rating_idx" ON "product_reviews"("rating");
CREATE INDEX "product_reviews_isApproved_idx" ON "product_reviews"("isApproved");

-- CreateIndex: api_keys
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");
CREATE INDEX "api_keys_status_idx" ON "api_keys"("status");
CREATE INDEX "api_keys_prefix_idx" ON "api_keys"("prefix");

-- CreateIndex: api_usage_logs
CREATE INDEX "api_usage_logs_apiKeyId_idx" ON "api_usage_logs"("apiKeyId");
CREATE INDEX "api_usage_logs_createdAt_idx" ON "api_usage_logs"("createdAt");
CREATE INDEX "api_usage_logs_endpoint_idx" ON "api_usage_logs"("endpoint");

-- CreateIndex: ad_clicks
CREATE UNIQUE INDEX "ad_clicks_clickToken_key" ON "ad_clicks"("clickToken");
CREATE UNIQUE INDEX "ad_clicks_orderId_key" ON "ad_clicks"("orderId");
CREATE INDEX "ad_clicks_apiKeyId_idx" ON "ad_clicks"("apiKeyId");
CREATE INDEX "ad_clicks_productId_idx" ON "ad_clicks"("productId");
CREATE INDEX "ad_clicks_clickToken_idx" ON "ad_clicks"("clickToken");
CREATE INDEX "ad_clicks_createdAt_idx" ON "ad_clicks"("createdAt");

-- CreateIndex: external_customers
CREATE UNIQUE INDEX "external_customers_phone_key" ON "external_customers"("phone");
CREATE UNIQUE INDEX "external_customers_email_key" ON "external_customers"("email");
CREATE INDEX "external_customers_phone_idx" ON "external_customers"("phone");
CREATE INDEX "external_customers_email_idx" ON "external_customers"("email");
CREATE INDEX "external_customers_verificationStatus_idx" ON "external_customers"("verificationStatus");

-- CreateIndex: external_otp_verifications
CREATE INDEX "external_otp_verifications_customerId_idx" ON "external_otp_verifications"("customerId");
CREATE INDEX "external_otp_verifications_recipient_idx" ON "external_otp_verifications"("recipient");
CREATE INDEX "external_otp_verifications_expiresAt_idx" ON "external_otp_verifications"("expiresAt");

-- CreateIndex: external_deposit_addresses
CREATE INDEX "external_deposit_addresses_customerId_idx" ON "external_deposit_addresses"("customerId");
CREATE INDEX "external_deposit_addresses_address_idx" ON "external_deposit_addresses"("address");
CREATE INDEX "external_deposit_addresses_status_idx" ON "external_deposit_addresses"("status");
CREATE INDEX "external_deposit_addresses_expiresAt_idx" ON "external_deposit_addresses"("expiresAt");
CREATE UNIQUE INDEX "external_deposit_addresses_customerId_network_stablecoinTyp_key" ON "external_deposit_addresses"("customerId", "network", "stablecoinType");

-- CreateIndex: external_orders
CREATE UNIQUE INDEX "external_orders_orderNumber_key" ON "external_orders"("orderNumber");
CREATE UNIQUE INDEX "external_orders_txHash_key" ON "external_orders"("txHash");
CREATE UNIQUE INDEX "external_orders_idempotencyKey_key" ON "external_orders"("idempotencyKey");
CREATE INDEX "external_orders_apiKeyId_idx" ON "external_orders"("apiKeyId");
CREATE INDEX "external_orders_customerId_idx" ON "external_orders"("customerId");
CREATE INDEX "external_orders_status_idx" ON "external_orders"("status");
CREATE INDEX "external_orders_orderNumber_idx" ON "external_orders"("orderNumber");
CREATE INDEX "external_orders_txHash_idx" ON "external_orders"("txHash");
CREATE INDEX "external_orders_idempotencyKey_idx" ON "external_orders"("idempotencyKey");
CREATE INDEX "external_orders_createdAt_idx" ON "external_orders"("createdAt");

-- CreateIndex: webhook_logs
CREATE INDEX "webhook_logs_orderId_idx" ON "webhook_logs"("orderId");
CREATE INDEX "webhook_logs_status_idx" ON "webhook_logs"("status");
CREATE INDEX "webhook_logs_eventType_idx" ON "webhook_logs"("eventType");
CREATE INDEX "webhook_logs_nextRetryAt_idx" ON "webhook_logs"("nextRetryAt");

-- CreateIndex: commissions
CREATE UNIQUE INDEX "commissions_externalOrderId_key" ON "commissions"("externalOrderId");
CREATE INDEX "commissions_apiKeyId_idx" ON "commissions"("apiKeyId");
CREATE INDEX "commissions_status_idx" ON "commissions"("status");
CREATE INDEX "commissions_createdAt_idx" ON "commissions"("createdAt");
CREATE INDEX "commissions_payoutId_idx" ON "commissions"("payoutId");

-- CreateIndex: commission_payouts
CREATE UNIQUE INDEX "commission_payouts_txHash_key" ON "commission_payouts"("txHash");
CREATE INDEX "commission_payouts_apiKeyId_idx" ON "commission_payouts"("apiKeyId");
CREATE INDEX "commission_payouts_status_idx" ON "commission_payouts"("status");
CREATE INDEX "commission_payouts_createdAt_idx" ON "commission_payouts"("createdAt");

-- CreateIndex: seller_payouts
CREATE UNIQUE INDEX "seller_payouts_txHash_key" ON "seller_payouts"("txHash");
CREATE INDEX "seller_payouts_sellerId_idx" ON "seller_payouts"("sellerId");
CREATE INDEX "seller_payouts_status_idx" ON "seller_payouts"("status");
CREATE INDEX "seller_payouts_createdAt_idx" ON "seller_payouts"("createdAt");

-- CreateIndex: products (new indexes)
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE INDEX "products_sellerId_idx" ON "products"("sellerId");
CREATE INDEX "products_brand_idx" ON "products"("brand");
CREATE INDEX "products_slug_idx" ON "products"("slug");

-- AddForeignKey: user_addresses
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: seller_documents
ALTER TABLE "seller_documents" ADD CONSTRAINT "seller_documents_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: products -> sellers
ALTER TABLE "products" ADD CONSTRAINT "products_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: product_reviews
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: api_keys
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: api_usage_logs
ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ad_clicks
ALTER TABLE "ad_clicks" ADD CONSTRAINT "ad_clicks_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ad_clicks" ADD CONSTRAINT "ad_clicks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ad_clicks" ADD CONSTRAINT "ad_clicks_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "external_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: external_otp_verifications
ALTER TABLE "external_otp_verifications" ADD CONSTRAINT "external_otp_verifications_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "external_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: external_deposit_addresses
ALTER TABLE "external_deposit_addresses" ADD CONSTRAINT "external_deposit_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "external_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: external_orders
ALTER TABLE "external_orders" ADD CONSTRAINT "external_orders_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_orders" ADD CONSTRAINT "external_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "external_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_orders" ADD CONSTRAINT "external_orders_depositAddressId_fkey" FOREIGN KEY ("depositAddressId") REFERENCES "external_deposit_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "external_orders" ADD CONSTRAINT "external_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: webhook_logs
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "external_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: commissions
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_externalOrderId_fkey" FOREIGN KEY ("externalOrderId") REFERENCES "external_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "commission_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: commission_payouts
ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: seller_payouts
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
