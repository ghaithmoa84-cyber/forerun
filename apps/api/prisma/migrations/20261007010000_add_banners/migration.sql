-- CreateEnum
CREATE TYPE "BannerActionType" AS ENUM ('NONE', 'EXTERNAL_URL', 'IN_APP_ROUTE', 'WHATSAPP_ADMIN');

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "headline" TEXT,
    "subtitle" TEXT,
    "imageUrl" TEXT NOT NULL,
    "actionType" "BannerActionType" NOT NULL DEFAULT 'NONE',
    "actionValue" TEXT,
    "ctaLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Banner_isDeleted_isActive_sortOrder_idx" ON "Banner"("isDeleted", "isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
