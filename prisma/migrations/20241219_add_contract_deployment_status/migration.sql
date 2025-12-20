-- AlterTable
ALTER TABLE "network_configs" ADD COLUMN "contractDeployed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "network_configs" ADD COLUMN "contractAddress" TEXT;
ALTER TABLE "network_configs" ADD COLUMN "lastContractCheck" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "network_configs_contractDeployed_idx" ON "network_configs"("contractDeployed");
