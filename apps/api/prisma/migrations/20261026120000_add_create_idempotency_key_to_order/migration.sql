-- AddCreateIdempotencyKeyToOrder
-- Add createIdempotencyKey column to Order table for customer order creation idempotency

-- AddColumn
ALTER TABLE "Order" ADD COLUMN "createIdempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_createIdempotencyKey_key" ON "Order"("createIdempotencyKey");
