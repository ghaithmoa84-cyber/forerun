-- AlterTable
ALTER TABLE "Order" ADD COLUMN "customFee" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "customFeeReason" TEXT;

-- CreateConstraint
ALTER TABLE "Order" ADD CONSTRAINT "Order_customFee_nonneg_check" CHECK ("customFee" >= 0);
