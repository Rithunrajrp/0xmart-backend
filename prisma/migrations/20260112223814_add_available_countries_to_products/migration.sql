-- AlterTable
ALTER TABLE "products" ADD COLUMN "availableCountries" TEXT[] DEFAULT ARRAY[]::TEXT[];
