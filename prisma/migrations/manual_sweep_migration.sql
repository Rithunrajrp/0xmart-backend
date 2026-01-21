-- Manual migration for SUI sweep functionality
-- Run this if automatic migration fails

-- Add encryptedPrivateKey column to wallets table
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "encryptedPrivateKey" TEXT;

-- Create sweep_transactions table
CREATE TABLE IF NOT EXISTS "sweep_transactions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "walletId" TEXT NOT NULL,
  "depositId" TEXT,
  "fromAddress" TEXT NOT NULL,
  "toAddress" TEXT NOT NULL,
  "amount" DECIMAL(20,8) NOT NULL,
  "stablecoinType" TEXT NOT NULL,
  "network" TEXT NOT NULL,
  "txHash" TEXT UNIQUE,
  "gasUsed" TEXT,
  "gasFee" DECIMAL(20,8),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "maxRetries" INTEGER NOT NULL DEFAULT 3,
  CONSTRAINT "sweep_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for sweep_transactions
CREATE INDEX IF NOT EXISTS "sweep_transactions_walletId_idx" ON "sweep_transactions"("walletId");
CREATE INDEX IF NOT EXISTS "sweep_transactions_status_idx" ON "sweep_transactions"("status");
CREATE INDEX IF NOT EXISTS "sweep_transactions_network_idx" ON "sweep_transactions"("network");
CREATE INDEX IF NOT EXISTS "sweep_transactions_txHash_idx" ON "sweep_transactions"("txHash");
CREATE INDEX IF NOT EXISTS "sweep_transactions_createdAt_idx" ON "sweep_transactions"("createdAt");

-- Add comment to explain purpose
COMMENT ON TABLE "sweep_transactions" IS 'Tracks automatic sweep operations from user deposit addresses to hot wallet';
COMMENT ON COLUMN "wallets"."encryptedPrivateKey" IS 'AES-256-GCM encrypted private key for sweep functionality (only for non-EVM networks like SUI)';
