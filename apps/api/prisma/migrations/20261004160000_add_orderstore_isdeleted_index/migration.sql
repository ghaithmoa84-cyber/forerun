-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderStore_orderId_isDeleted_idx" ON "OrderStore"("orderId", "isDeleted");
