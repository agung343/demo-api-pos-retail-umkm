/*
  Warnings:

  - Added the required column `purchaseItemId` to the `PurchaseReturn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requestedBy` to the `PurchaseReturn` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PurchaseReturn" ADD COLUMN     "purchaseItemId" TEXT NOT NULL,
ADD COLUMN     "requestedBy" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
