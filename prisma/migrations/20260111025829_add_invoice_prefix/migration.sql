-- CreateTable
CREATE TABLE "Purchases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Purchases_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Purchases" ADD CONSTRAINT "Purchases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
