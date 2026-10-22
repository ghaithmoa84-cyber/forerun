/*
  Warnings:

  - You are about to drop the column `platformShare` on the `Settlement` table. All the data in the column will be lost.
  - You are about to drop the column `runnerShare` on the `Settlement` table. All the data in the column will be lost.
  - You are about to drop the column `platformShare` on the `SettlementItem` table. All the data in the column will be lost.
  - You are about to drop the column `runnerShare` on the `SettlementItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Settlement" DROP COLUMN "platformShare",
DROP COLUMN "runnerShare";

-- AlterTable
ALTER TABLE "SettlementItem" DROP COLUMN "platformShare",
DROP COLUMN "runnerShare";
