import { Request, Response, NextFunction } from "express";
import { startOfDay, endOfDay } from "date-fns";
import { ErrorApi } from "../middlewares/error-handler";
import { prisma } from "../libs/prisma";
import { Prisma } from "../generated/prisma/client";
import { PurchasesBody, AddPaymentBody } from "../schemas/transaction";

interface PurchaseQuery {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

type PurchaseStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID"

export async function getPurchasesTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const { from, to, page = 1, limit = 25 } = req.query as PurchaseQuery;

    const pageNumber = Math.max(page, 1);
    const pageSize = Math.min(limit, 100);
    const startDate = from
      ? startOfDay(new Date(from))
      : startOfDay(new Date());
    const endDate = to ? endOfDay(new Date(to)) : endOfDay(new Date());

    const [purchases, total] = await Promise.all([
      prisma.purchases.findMany({
        where: {
          tenantId,
          isDeleted: false,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          invoice: true,
          totalAmount: true,
          createdAt: true,
          supplier: {
            select: {
              name: true,
            },
          },
        },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.purchases.count({
        where: {
          tenantId,
          isDeleted: false,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ]);

    res.status(200).json({
      purchases,
      meta: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getPurchaseDetails(
  req: Request<{ purchaseId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;
    const pid = req.params.purchaseId;

    const result = await prisma.purchases.findFirst({
      where: {
        id: pid,
        tenantId,
        isDeleted: false,
      },
      select: {
        invoice: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            username: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            unitCost: true,
            subTotal: true,
            inventory: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
        supplier: {
          select: {
            name: true,
          },
        },
        isEdited: true,
        editedAt: true,
        editUser: {
          select: {
            username: true,
          },
        },
      },
    });

    if (!result) {
      return next(new ErrorApi("Purchase is not recorded", 404));
    }

    const purchase = {
      invoice: result.invoice,
      totalAmount: result.totalAmount,
      paidAmount: result.paidAmount ?? 0,
      status: result.status,
      createdAt: result.createdAt,
      recordedBy: result.user.username,
      supplier: result.supplier.name,
      items: result.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        cost: item.unitCost,
        subTotal: item.subTotal,
        name: item.inventory.name,
        code: item.inventory.code,
      })),
      isEdited: result.isEdited,
      editedAt: result.isEdited ? result.editedAt : null,
      editedBy: result.isEdited ? result.editUser : null,
    };

    res.status(200).json({
      success: true,
      purchase,
    });
  } catch (error) {
    next(error);
  }
}

export async function createNewPurchase(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    const { invoice, supplierId, items, initialPayment } = req.body as PurchasesBody;

    await prisma.$transaction(async (tx) => {
      // validate supplier
      const supplier = await tx.supplier.findUnique({
        where: {
          id: supplierId,
          tenantId,
        },
      });
      if (!supplier) {
        throw new ErrorApi("Supplier not found, please register first", 422);
      }

      // validate inventories
      const ids = items.map(i => i.inventoryId)
      const invetories = await tx.inventory.findMany({
        where: {
          id: { in: ids },
          tenantId,
        },
      });
      if (invetories.length !== ids.length)
        throw new ErrorApi("Invalid inventory item", 422);

      // total purchase
      const totalAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.unitCost,
        0
      );

      const purchase = await tx.purchases.create({
        data: {
          tenantId,
          invoice,
          supplierId,
          totalAmount,
          paidAmount: 0,
          status: "UNPAID",
          items: {
            create: items.map((item) => ({
              quantity: item.quantity,
              unitCost: item.unitCost,
              subTotal: item.quantity * item.unitCost,
              inventoryId: item.inventoryId,
            })),
          },
          recordedBy: userId,
        },
      });

      let paidAmount = 0;
      if (initialPayment) {
        if (initialPayment.amount > totalAmount) {
          throw new ErrorApi("Payment exceeds total amount", 400)
        }

        await tx.purchasePayment.create({
          data: {
            amount: initialPayment.amount,
            method: initialPayment.method,
            note: initialPayment.note,
            purchaseId: purchase.id,
            tenantId,
            recordedBy: userId
          }
        })

        paidAmount = initialPayment.amount
      }

      let status: PurchaseStatus = "UNPAID"
      if (paidAmount === 0) status = "UNPAID"
      if (paidAmount < totalAmount) status = "PARTIALLY_PAID"
      if (paidAmount === totalAmount) status = "PAID"
      await tx.purchases.update({
        where: {
          id: purchase.id
        },
        data: {
          paidAmount,
          status
        }
      })

      // validate stock
      for (const item of items) {
        const inventory = await tx.inventory.findUnique({
          where: { id: item.inventoryId },
        });

        if (!inventory) throw new ErrorApi("Inventory not found", 404);

        await tx.stockLedger.create({
          data: {
            type: "PURCHASE",
            quantity: item.quantity,
            stockBefore: inventory.stock,
            stockAfter: inventory.stock + item.quantity,
            costBefore: inventory.cost,
            costAfter: item.unitCost,
            refId: purchase.id,
            inventoryId: inventory.id,
            tenantId,
          },
        });

        await tx.inventory.update({
          where: {
            tenantId,
            id: item.inventoryId,
          },
          data: {
            stock: { increment: item.quantity },
            cost: item.unitCost,
          },
        });
      }
    });

    res.status(201).json({
      success: true,
      message: "Purchase has been recorded",
    });
  } catch (error) {
    next(error);
  }
}

export async function addPurchasePayment(req: Request<{purchaseId: string}>, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId
    const userId = req.user!.userId
    const {purchaseId} = req.params

    const {amount, method, note} = req.body as AddPaymentBody

    const updatedPurchase = await prisma.$transaction(async (tx) => {
      const existedPurchase = await tx.purchases.findFirst({
        where: {
          tenantId,
          id: purchaseId,
          isDeleted: false
        }
      })
      if (!existedPurchase) {
        throw new ErrorApi("Purchase not found", 404)
      }
      if (existedPurchase.status === "PAID") {
        throw new ErrorApi("Purchase already paid", 400)
      }

      const remaining = existedPurchase.totalAmount - existedPurchase.paidAmount
      if (amount > remaining) {
        throw new ErrorApi("Payment exceeds remaining balance", 400)
      }
      await tx.purchasePayment.create({
        data: {
          amount,
          method,
          note,
          purchaseId,
          tenantId,
          recordedBy: userId
        }
      })

      const newPaymentAmount = existedPurchase.paidAmount + amount
      let newStatus: PurchaseStatus = "UNPAID"
      if (newPaymentAmount === 0) newStatus = "UNPAID"
      if (newPaymentAmount < existedPurchase.totalAmount) newStatus = "PARTIALLY_PAID"
      if (newPaymentAmount === existedPurchase.totalAmount) newStatus = "PAID"
      return await tx.purchases.update({
        where: {
          id: purchaseId
        },
        data: {
          paidAmount: newPaymentAmount,
          status: newStatus
        }
      })
    })

    res.status(201).json({
      message: "Payment has been updated",
      purchase: updatedPurchase
    })
  } catch (error) {
    next(error)
  }
}

export async function cancelPurchaseController(
  req: Request<{ purchaseId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user!;
    const id = req.params.purchaseId;

    const result = await prisma.$transaction(async (tx) => {
      // get sale with items
      const purchase = await tx.purchases.findFirst({
        where: {
          tenantId: user.tenantId,
          id,
          isDeleted: false,
        },
        include: {
          items: true,
        },
      });
      if (!purchase) {
        throw new ErrorApi("Sale not found or already canceled", 400);
      }

      // restore stock & sold
      for (const item of purchase.items) {
        const inventory = await tx.inventory.findUnique({
          where: { id: item.inventoryId },
        });
        if (!inventory || inventory.stock < item.quantity) {
          throw new ErrorApi("Stock inconsitency detected", 400);
        }

        const ledger = await tx.stockLedger.findFirst({
          where: {
            refId: purchase.id,
            type: "PURCHASE",
            inventoryId: inventory.id,
          },
          orderBy: {
            createdAt: "desc",
          },
        });
        if (!ledger) throw new ErrorApi("Ledger not found", 400);

        const alreadyCanceled = await tx.stockLedger.findFirst({
          where: {
            refId: purchase.id,
            type: "CANCEL_PURCHASE",
            inventoryId: inventory.id,
          },
        });
        if (alreadyCanceled)
          throw new ErrorApi("Purchase already canceled", 400);

        await tx.stockLedger.create({
          data: {
            type: "CANCEL_PURCHASE",
            quantity: -item.quantity,
            stockBefore: ledger.stockAfter,
            stockAfter: ledger.stockBefore,
            costAfter: ledger.costBefore,
            costBefore: ledger.costAfter,
            refId: purchase.id,
            inventoryId: inventory.id,
            tenantId: user.tenantId,
          },
        });

        await tx.inventory.update({
          where: {
            id: item.inventoryId,
          },
          data: {
            stock: ledger.stockBefore,
            cost: ledger.costBefore,
          },
        });
      }

      //soft delete
      const canceled = await tx.purchases.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deleteBy: user.userId,
        },
      });

      return canceled;
    });

    res.status(200).json({
      success: true,
      message: "Purchase is canceled",
    });
  } catch (error) {
    next(error);
  }
}

export async function getAllTenantPurchases(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;

    const { from, to, page = 1, limit = 25, status="active" } = req.query as PurchaseQuery & {status?: "active" | "deleted"};
    
    if (!["active", "deleted"].includes(status)) {
      return next(new ErrorApi("Invalid status", 400))
    }

    const pageNumber = Math.max(page, 1);
    const pageSize = Math.min(limit, 100);
    
    const dateFilter: Prisma.DateTimeFilter = {}
    const now = new Date()
    if (!from && to) {
      return next(new ErrorApi("invalid date input", 400))
    }
    if (from) {
      dateFilter.gte = startOfDay(new Date(from))
      dateFilter.lte = endOfDay(new Date(to ?? now))
    }

    const where: Prisma.PurchasesWhereInput = {
      tenantId,
      isDeleted : status === "deleted"
    }
    if (Object.keys(dateFilter).length) {
      where.createdAt = dateFilter
    }

    const [purchases, total] = await Promise.all([
      prisma.purchases.findMany({
        where,
        select: {
          id: true,
          invoice: true,
          totalAmount: true,
          createdAt: true,
          paidAmount: true,
          status: true,
          supplier: {
            select: {
              name: true,
            },
          },
        },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: status === "deleted" ? { deletedAt: "desc"} : {createdAt: "desc"}
      }),
      prisma.purchases.count({where}),
    ]);

    res.status(200).json({
      purchases,
      meta: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error)
  }
}