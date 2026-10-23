-- CreateTable
CREATE TABLE "AppVersion" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "latestVersionCode" INTEGER NOT NULL,
    "latestVersionName" TEXT NOT NULL,
    "minSupportedVersionCode" INTEGER NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "releaseNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedByUserId" TEXT,

    CONSTRAINT "AppVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppVersion_platform_key" ON "AppVersion"("platform");

-- AddForeignKey
ALTER TABLE "AppVersion" ADD CONSTRAINT "AppVersion_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert default app version row for Android matching the currently deployed release (versionCode: 3, versionName: 0.1.2)
-- Note on id: Prisma @default(cuid()) is evaluated on client runtime. In raw SQL migration seed,
-- we use PostgreSQL native gen_random_uuid()::text to satisfy the NOT NULL constraint cleanly without hardcoding.
INSERT INTO "AppVersion" ("id", "platform", "latestVersionCode", "latestVersionName", "minSupportedVersionCode", "downloadUrl", "releaseNotes", "updatedAt", "updatedByUserId")
VALUES (gen_random_uuid()::text, 'android', 3, '0.1.2', 3, 'https://faow.run', 'الإصدار الأولي لتطبيق فور رن', CURRENT_TIMESTAMP, NULL)
ON CONFLICT ("platform") DO NOTHING;



