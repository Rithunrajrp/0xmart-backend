-- CreateTable
CREATE TABLE "oxlien_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "aiModel" TEXT NOT NULL DEFAULT 'gpt-4o',
    "autoPayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoPayPerOrder" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "autoPayDaily" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "autoPayMonthly" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "allowedStablecoins" TEXT[] DEFAULT (ARRAY[]::TEXT[]),
    "allowedNetworks" TEXT[] DEFAULT (ARRAY[]::TEXT[]),
    "voiceInputEnabled" BOOLEAN NOT NULL DEFAULT false,
    "voiceOutputEnabled" BOOLEAN NOT NULL DEFAULT false,
    "voiceId" TEXT NOT NULL DEFAULT 'alloy',
    "voiceSpeed" DECIMAL(3,1) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oxlien_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL DEFAULT 'generic',
    "mqttBrokerUrl" TEXT NOT NULL,
    "mqttTopic" TEXT NOT NULL,
    "mqttAuthToken" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoRestockEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxItemsPerRestock" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iot_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_events" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "parsedItems" JSONB,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "injectedMessage" TEXT,
    "orderId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iot_events_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "autoPayUsed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "oxlien_settings_userId_key" ON "oxlien_settings"("userId");

-- CreateIndex
CREATE INDEX "oxlien_settings_userId_idx" ON "oxlien_settings"("userId");

-- CreateIndex
CREATE INDEX "iot_devices_userId_idx" ON "iot_devices"("userId");

-- CreateIndex
CREATE INDEX "iot_devices_isEnabled_idx" ON "iot_devices"("isEnabled");

-- CreateIndex
CREATE INDEX "iot_events_deviceId_idx" ON "iot_events"("deviceId");

-- CreateIndex
CREATE INDEX "iot_events_status_idx" ON "iot_events"("status");

-- CreateIndex
CREATE INDEX "iot_events_createdAt_idx" ON "iot_events"("createdAt");

-- AddForeignKey
ALTER TABLE "oxlien_settings" ADD CONSTRAINT "oxlien_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_events" ADD CONSTRAINT "iot_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "iot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
