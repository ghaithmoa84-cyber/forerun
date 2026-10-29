-- AlterTable
ALTER TABLE "PlatformPricing" ADD COLUMN "freeOrdersPromoEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "freeOrdersCount" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "freeOrdersRemaining" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "wasFreeOrderSlot" BOOLEAN NOT NULL DEFAULT false;

-- Explicitly ensure default row in PlatformPricing has freeOrdersPromoEnabled = false and freeOrdersCount = 3
UPDATE "PlatformPricing"
SET "freeOrdersPromoEnabled" = false,
    "freeOrdersCount" = 3
WHERE "id" = 'default';

