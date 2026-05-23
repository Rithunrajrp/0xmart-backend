-- CreateTable
CREATE TABLE "shopify_stores" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "shopEmail" TEXT NOT NULL,
    "shopCurrency" TEXT NOT NULL DEFAULT 'USD',
    "shopCountry" TEXT,
    "sellerId" TEXT,
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT NOT NULL,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3),
    "syncAllProducts" BOOLEAN NOT NULL DEFAULT false,
    "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.20,
    "lastProductSync" TIMESTAMP(3),
    "lastOrderSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_products" (
    "id" TEXT NOT NULL,
    "shopifyStoreId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT,
    "shopifyHandle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originalPrice" DECIMAL(20,8) NOT NULL,
    "originalCurrency" TEXT NOT NULL,
    "imageUrl" TEXT,
    "oxmartProductId" TEXT,
    "priceUsdt" DECIMAL(20,8),
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_orders" (
    "id" TEXT NOT NULL,
    "shopifyStoreId" TEXT NOT NULL,
    "oxmartOrderId" TEXT NOT NULL,
    "oxmartOrderStatus" TEXT NOT NULL,
    "oxmartPaymentStatus" TEXT,
    "totalUsdt" DECIMAL(20,8) NOT NULL,
    "shopifyOrderId" TEXT,
    "shopifyOrderName" TEXT,
    "shopifyFulfillmentId" TEXT,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "shippingAddress" JSONB,
    "isSyncedToShopify" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopify_stores_shopDomain_key" ON "shopify_stores"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_stores_sellerId_key" ON "shopify_stores"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_stores_apiKey_key" ON "shopify_stores"("apiKey");

-- CreateIndex
CREATE INDEX "shopify_stores_shopDomain_idx" ON "shopify_stores"("shopDomain");

-- CreateIndex
CREATE INDEX "shopify_stores_sellerId_idx" ON "shopify_stores"("sellerId");

-- CreateIndex
CREATE INDEX "shopify_stores_apiKey_idx" ON "shopify_stores"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_products_oxmartProductId_key" ON "shopify_products"("oxmartProductId");

-- CreateIndex
CREATE INDEX "shopify_products_shopifyProductId_idx" ON "shopify_products"("shopifyProductId");

-- CreateIndex
CREATE INDEX "shopify_products_oxmartProductId_idx" ON "shopify_products"("oxmartProductId");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_products_shopifyStoreId_shopifyProductId_key" ON "shopify_products"("shopifyStoreId", "shopifyProductId");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_orders_oxmartOrderId_key" ON "shopify_orders"("oxmartOrderId");

-- CreateIndex
CREATE INDEX "shopify_orders_shopifyStoreId_idx" ON "shopify_orders"("shopifyStoreId");

-- CreateIndex
CREATE INDEX "shopify_orders_oxmartOrderId_idx" ON "shopify_orders"("oxmartOrderId");

-- CreateIndex
CREATE INDEX "shopify_orders_shopifyOrderId_idx" ON "shopify_orders"("shopifyOrderId");

-- AddForeignKey
ALTER TABLE "shopify_stores" ADD CONSTRAINT "shopify_stores_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_products" ADD CONSTRAINT "shopify_products_shopifyStoreId_fkey" FOREIGN KEY ("shopifyStoreId") REFERENCES "shopify_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_products" ADD CONSTRAINT "shopify_products_oxmartProductId_fkey" FOREIGN KEY ("oxmartProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_orders" ADD CONSTRAINT "shopify_orders_shopifyStoreId_fkey" FOREIGN KEY ("shopifyStoreId") REFERENCES "shopify_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_orders" ADD CONSTRAINT "shopify_orders_oxmartOrderId_fkey" FOREIGN KEY ("oxmartOrderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
