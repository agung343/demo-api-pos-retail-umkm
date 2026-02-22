-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- AlterTable
ALTER TABLE "Purchases" ADD COLUMN     "paidAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "PurchaseStatus" NOT NULL DEFAULT 'UNPAID';

-- CreateTable
CREATE TABLE "PurchasePayment" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "Payment" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "purchaseId" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "PurchasePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchasePayment_tenantId_idx" ON "PurchasePayment"("tenantId");

-- CreateIndex
CREATE INDEX "PurchasePayment_purchaseId_idx" ON "PurchasePayment"("purchaseId");

-- AddForeignKey
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
