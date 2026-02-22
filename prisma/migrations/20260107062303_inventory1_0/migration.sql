-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inventory_tenantId_name_idx" ON "Inventory"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Inventory_tenantId_code_idx" ON "Inventory"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_tenantId_name_key" ON "Inventory"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_tenantId_code_key" ON "Inventory"("tenantId", "code");

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
