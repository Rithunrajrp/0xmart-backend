-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN "usePersonalizedRecommendations" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "api_key_recommendation_configs" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "selectedProductIds" TEXT[],
    "selectedCategories" TEXT[],
    "minRating" DECIMAL(3,2),
    "maxPrice" DECIMAL(20,8),
    "minPrice" DECIMAL(20,8),
    "prioritizeInStock" BOOLEAN NOT NULL DEFAULT true,
    "prioritizeHighRated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_key_recommendation_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_key_recommendation_configs_apiKeyId_key" ON "api_key_recommendation_configs"("apiKeyId");

-- CreateIndex
CREATE INDEX "api_key_recommendation_configs_apiKeyId_idx" ON "api_key_recommendation_configs"("apiKeyId");

-- AddForeignKey
ALTER TABLE "api_key_recommendation_configs" ADD CONSTRAINT "api_key_recommendation_configs_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
