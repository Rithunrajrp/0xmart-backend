-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ID_CARD', 'PASSPORT', 'DRIVERS_LICENSE', 'SELFIE', 'ADDRESS_PROOF', 'UTILITY_BILL', 'BANK_STATEMENT');

-- AlterEnum
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- AlterTable kyc_documents - Add new columns first
ALTER TABLE "kyc_documents"
ADD COLUMN IF NOT EXISTS "backImageUrl" TEXT,
ADD COLUMN IF NOT EXISTS "metadata" JSONB,
ADD COLUMN IF NOT EXISTS "ocrData" JSONB;

-- Change documentType column to use enum (safe with IF EXISTS check)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kyc_documents'
    AND column_name = 'documentType'
    AND udt_name != 'DocumentType'
  ) THEN
    ALTER TABLE "kyc_documents"
    ALTER COLUMN "documentType" TYPE "DocumentType" USING "documentType"::text::"DocumentType";
  END IF;
END $$;

-- AlterTable users - Remove Sumsub fields, add custom KYC fields
ALTER TABLE "users"
DROP COLUMN IF EXISTS "kycData",
DROP COLUMN IF EXISTS "kycProviderId",
ADD COLUMN IF NOT EXISTS "kycApprovedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "kycRejectedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "kycRejectionReason" TEXT,
ADD COLUMN IF NOT EXISTS "kycSubmittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "kyc_documents_status_idx" ON "kyc_documents"("status");
CREATE INDEX IF NOT EXISTS "kyc_documents_documentType_idx" ON "kyc_documents"("documentType");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kyc_documents_reviewedBy_fkey'
  ) THEN
    ALTER TABLE "kyc_documents"
    ADD CONSTRAINT "kyc_documents_reviewedBy_fkey"
    FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
