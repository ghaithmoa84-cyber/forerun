-- AlterTable
ALTER TABLE "DeviceToken" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RefreshToken" ALTER COLUMN "expiresAt" DROP DEFAULT;
