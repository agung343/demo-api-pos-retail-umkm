import { Prisma } from "../generated/prisma/client";

export async function generateInvoice(tx: Prisma.TransactionClient, tenantId: string) {
  const year = new Date().getFullYear();

  const tenant = await tx.tenant.findUnique({
    where: {
      id: tenantId,
    },
    select: {
      invoicePrefix: true,
    },
  });

  if (!tenant?.invoicePrefix) {
    throw new Error("Invoice prefix not configured");
  }

  const counter = await tx.invoiceCounter.upsert({
    where: {
      tenantId_year: {
        tenantId,
        year,
      },
    },
    update: {
      lastNumber: { increment: 1 },
    },
    create: {
      tenantId,
      year,
      lastNumber: 1,
    },
  });

  return `${tenant.invoicePrefix}-${year}-${String(counter.lastNumber).padStart(
    6,
    "0"
  )}`;
}
