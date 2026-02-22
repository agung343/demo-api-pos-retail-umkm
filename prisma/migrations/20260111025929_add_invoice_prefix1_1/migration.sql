/*
  Warnings:

  - A unique constraint covering the columns `[invoicePrefix]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "invoicePrefix" TEXT;

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceCounter_tenantId_year_key" ON "InvoiceCounter"("tenantId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_invoicePrefix_key" ON "Tenant"("invoicePrefix");

-- AddForeignKey
ALTER TABLE "InvoiceCounter" ADD CONSTRAINT "InvoiceCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
