/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,name]` on the table `Supplier` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,email]` on the table `Supplier` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Supplier_tenantId_name_key" ON "Supplier"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_tenantId_email_key" ON "Supplier"("tenantId", "email");
