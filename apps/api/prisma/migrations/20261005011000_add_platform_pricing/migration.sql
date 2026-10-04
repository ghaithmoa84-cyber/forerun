-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformPricing" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "baseFee" INTEGER NOT NULL,
    "extraStoreFee" INTEGER NOT NULL,
    "peripheralFee" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedByUserId" TEXT,

    CONSTRAINT "PlatformPricing_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PlatformPricing_updatedByUserId_fkey'
    ) THEN
        ALTER TABLE "PlatformPricing" ADD CONSTRAINT "PlatformPricing_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Insert default pricing row (fallback values: 60/20/40)
INSERT INTO "PlatformPricing" ("id", "baseFee", "extraStoreFee", "peripheralFee", "updatedAt", "updatedByUserId")
VALUES ('default', 60, 20, 40, CURRENT_TIMESTAMP, NULL)
ON CONFLICT ("id") DO NOTHING;
