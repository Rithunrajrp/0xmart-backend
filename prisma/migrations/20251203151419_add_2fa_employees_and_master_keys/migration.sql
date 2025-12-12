-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('MERCHANT_ONBOARDING', 'KYC_REVIEWER', 'PRODUCT_MANAGER', 'INVENTORY_MANAGER', 'CUSTOMER_SUPPORT');

-- CreateEnum
CREATE TYPE "EmployeePermission" AS ENUM ('VIEW_USERS', 'EDIT_USERS', 'DELETE_USERS', 'VIEW_MERCHANTS', 'APPROVE_MERCHANTS', 'REJECT_MERCHANTS', 'VIEW_KYC', 'APPROVE_KYC', 'REJECT_KYC', 'VIEW_PRODUCTS', 'CREATE_PRODUCTS', 'EDIT_PRODUCTS', 'DELETE_PRODUCTS', 'VIEW_INVENTORY', 'UPDATE_INVENTORY', 'VIEW_ORDERS', 'EDIT_ORDERS', 'CANCEL_ORDERS', 'VIEW_TICKETS', 'RESPOND_TICKETS', 'CLOSE_TICKETS', 'VIEW_WITHDRAWALS', 'APPROVE_WITHDRAWALS', 'VIEW_ANALYTICS', 'EXPORT_DATA');

-- CreateEnum
CREATE TYPE "BlockchainNetwork" AS ENUM ('ETHEREUM', 'AVALANCHE', 'SUI', 'TON', 'BITCOIN');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'EMPLOYEE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "EmployeeRole" NOT NULL,
    "permissions" JSONB NOT NULL,
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_activities" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_keys" (
    "id" TEXT NOT NULL,
    "network" "BlockchainNetwork" NOT NULL,
    "encryptedSeed" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT,
    "publicAddress" TEXT NOT NULL,
    "derivationPath" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAccessedAt" TIMESTAMP(3),
    "lastAccessedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,

    CONSTRAINT "master_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_key_access_logs" (
    "id" TEXT NOT NULL,
    "masterKeyId" TEXT NOT NULL,
    "accessedBy" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_key_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_userId_idx" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_role_idx" ON "employees"("role");

-- CreateIndex
CREATE INDEX "employees_isActive_idx" ON "employees"("isActive");

-- CreateIndex
CREATE INDEX "employee_activities_employeeId_idx" ON "employee_activities"("employeeId");

-- CreateIndex
CREATE INDEX "employee_activities_action_idx" ON "employee_activities"("action");

-- CreateIndex
CREATE INDEX "employee_activities_entityType_idx" ON "employee_activities"("entityType");

-- CreateIndex
CREATE INDEX "employee_activities_createdAt_idx" ON "employee_activities"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "master_keys_network_key" ON "master_keys"("network");

-- CreateIndex
CREATE UNIQUE INDEX "master_keys_publicAddress_key" ON "master_keys"("publicAddress");

-- CreateIndex
CREATE INDEX "master_keys_network_idx" ON "master_keys"("network");

-- CreateIndex
CREATE INDEX "master_keys_createdBy_idx" ON "master_keys"("createdBy");

-- CreateIndex
CREATE INDEX "master_key_access_logs_masterKeyId_idx" ON "master_key_access_logs"("masterKeyId");

-- CreateIndex
CREATE INDEX "master_key_access_logs_accessedBy_idx" ON "master_key_access_logs"("accessedBy");

-- CreateIndex
CREATE INDEX "master_key_access_logs_createdAt_idx" ON "master_key_access_logs"("createdAt");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_activities" ADD CONSTRAINT "employee_activities_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_key_access_logs" ADD CONSTRAINT "master_key_access_logs_masterKeyId_fkey" FOREIGN KEY ("masterKeyId") REFERENCES "master_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
