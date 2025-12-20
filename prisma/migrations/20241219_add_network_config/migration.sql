-- CreateTable
CREATE TABLE "network_configs" (
    "id" TEXT NOT NULL,
    "network" "NetworkType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "network_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "network_configs_network_key" ON "network_configs"("network");

-- CreateIndex
CREATE INDEX "network_configs_isEnabled_idx" ON "network_configs"("isEnabled");

-- CreateIndex
CREATE INDEX "network_configs_sortOrder_idx" ON "network_configs"("sortOrder");
