-- CreateEnum
CREATE TYPE "Payment" AS ENUM ('CASH', 'CREDITCARD', 'QRIS', 'TRANSFER');

-- CreateTable
CREATE TABLE "Sales" (
    "id" TEXT NOT NULL,
    "invoice" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "method" "Payment" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deleteBy" TEXT,
    "tenantId" TEXT NOT NULL,
    "issueBy" TEXT NOT NULL,

    CONSTRAINT "Sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItems" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "subTotal" INTEGER NOT NULL,
    "saleId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,

    CONSTRAINT "SaleItems_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sales_tenantId_invoice_key" ON "Sales"("tenantId", "invoice");

-- AddForeignKey
ALTER TABLE "Sales" ADD CONSTRAINT "Sales_deleteBy_fkey" FOREIGN KEY ("deleteBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sales" ADD CONSTRAINT "Sales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sales" ADD CONSTRAINT "Sales_issueBy_fkey" FOREIGN KEY ("issueBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItems" ADD CONSTRAINT "SaleItems_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItems" ADD CONSTRAINT "SaleItems_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
