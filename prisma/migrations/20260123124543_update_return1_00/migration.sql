/*
  Warnings:

  - You are about to drop the column `purchaseItemId` on the `PurchaseReturn` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `PurchaseReturn` table. All the data in the column will be lost.
  - Added the required column `tenantId` to the `PurchaseReturn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PurchaseReturn` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReturStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'DONE');

-- DropForeignKey
ALTER TABLE "PurchaseReturn" DROP CONSTRAINT "PurchaseReturn_purchaseItemId_fkey";

-- AlterTable
ALTER TABLE "PurchaseReturn" DROP COLUMN "purchaseItemId",
DROP COLUMN "quantity",
ADD COLUMN     "status" "ReturStatus" NOT NULL DEFAULT 'REQUESTED',
ADD COLUMN     "tenantId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "PurchaseReturnItem" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" INTEGER NOT NULL,
    "subTotal" INTEGER NOT NULL,
    "returId" TEXT NOT NULL,
    "purchaseItemId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,

    CONSTRAINT "PurchaseReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseReturn_tenantId_idx" ON "PurchaseReturn"("tenantId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_purchaseId_idx" ON "PurchaseReturn"("purchaseId");

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_returId_fkey" FOREIGN KEY ("returId") REFERENCES "PurchaseReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
