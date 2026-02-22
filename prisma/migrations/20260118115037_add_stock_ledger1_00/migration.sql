-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('PURCHASE', 'SALE', 'CANCEL_PURCHASE', 'RETURN', 'ADJUST');

-- CreateTable
CREATE TABLE "StockLedger" (
    "id" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stockBefore" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "costBefore" INTEGER NOT NULL,
    "costAfter" INTEGER NOT NULL,
    "refId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,

    CONSTRAINT "StockLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockLedger_tenantId_idx" ON "StockLedger"("tenantId");

-- CreateIndex
CREATE INDEX "StockLedger_inventoryId_idx" ON "StockLedger"("inventoryId");

-- CreateIndex
CREATE INDEX "StockLedger_refId_idx" ON "StockLedger"("refId");

-- CreateIndex
CREATE INDEX "StockLedger_createdAt_idx" ON "StockLedger"("createdAt");

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
