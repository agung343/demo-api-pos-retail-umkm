import { Request, Response, NextFunction } from "express";
import { startOfDay, endOfDay } from "date-fns";
import { ErrorApi } from "../middlewares/error-handler";
import { prisma } from "../libs/prisma";
import { Prisma } from "../generated/prisma/client";
import { ReturnBody } from "../schemas/return";

interface ReturnQuery {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  status?: "all" | "requested" | "approved" | "rejected" | "done";
}

export async function getAllReturnTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const {
      status = "all",
      page = 1,
      limit = 25,
      from,
      to,
    } = req.query as ReturnQuery;

    const now = new Date();
    const dateFilter: Prisma.DateTimeFilter = {};
    if (!from && to) {
      return next(new ErrorApi("Invalid date input", 400));
    }
    if (from) {
      dateFilter.gte = startOfDay(new Date(from));
      dateFilter.lte = endOfDay(new Date(to ?? now));
    }

    const where: Prisma.PurchaseReturnWhereInput = {
      tenantId,
    };

    const statusMap = {
      requested: "REQUESTED",
      approved: "APPROVED",
      rejected: "REJECTED",
      done: "DONE",
    } as const;
    if (status !== "all" && statusMap[status]) {
      where.status = statusMap[status];
    }

    if (Object.keys(dateFilter).length) {
      where.createdAt = dateFilter;
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Number(limit) || 25, 100);

    const [result, total] = await Promise.all([
      prisma.purchaseReturn.findMany({
        where,
        omit: {
          reason: true,
        },
        include: {
          user: {
            select: {
              username: true,
            },
          },
          purchases: {
            select: {
              id: true,
              invoice: true,
              createdAt: true,
              supplier: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: {
          updatedAt: "desc",
        },
      }),
      prisma.purchaseReturn.count({ where }),
    ]);

    const returns = result.map((r) => ({
      id: r.id,
      purchaseId: r.purchases.id,
      purchaseDate: r.purchases.createdAt,
      requestedAt: r.createdAt,
      invoice: r.purchases.invoice,
      requestedBy: r.user.username,
      status: r.status,
      supplier: r.purchases.supplier.name,
    }));

    res.status(200).json({
      success: true,
      returns,
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

export async function getReturnsDetails(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;
    const returnId = req.params.id;

    const result = await prisma.purchaseReturn.findFirst({
      where: {
        id: returnId,
        tenantId,
      },
      include: {
        user: {
          select: {
            username: true,
          },
        },
        purchases: {
          select: {
            invoice: true,
            createdAt: true,
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        items: {
          include: {
            inventory: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
    if (!result) {
      return next(new ErrorApi("Return is not exist", 404));
    }

    const detail = {
      reason: result.reason,
      requestedBy: result.user.username,
      status: result.status,
      purchasedDate: result.purchases.createdAt,
      requestedDate: result.createdAt,
      invoice: result.purchases.invoice,
      supplier: result.purchases.supplier.name,
      items: result.items.map((item) => ({
        id: item.id,
        purchaseItemId: item.purchaseItemId,
        name: item.inventory.name,
        quantity: item.quantity,
        cost: item.unitCost,
      })),
    };

    res.status(200).json({
      success: true,
      return: detail,
    });
  } catch (error) {
    next(error);
  }
}

export async function createNewReturn(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    const { reason, purchaseId, items } = req.body as ReturnBody;

    const existedPurchase = await prisma.purchases.findFirst({
      where: {
        tenantId,
        id: purchaseId,
        isDeleted: false,
      },
      include: {
        items: {
          select: {
            id: true,
            unitCost: true,
            quantity: true,
            inventoryId: true,
          },
        },
      },
    });
    if (!existedPurchase) {
      return next(
        new ErrorApi("Purchase is not exist, return request is invalid", 400)
      );
    }

    const openReturn = await prisma.purchaseReturn.findFirst({
      where: {
        tenantId,
        purchaseId,
        status: "REQUESTED",
      },
    });
    if (openReturn) {
      return next(new ErrorApi("Retur already requested", 400));
    }

    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.purchaseItemId)) {
        return next(new ErrorApi("Duplicate purchase item", 400));
      }
      seen.add(item.purchaseItemId);
    }

    const purchaseItemMap = new Map(
      existedPurchase.items.map((item) => [item.id, item])
    );

    const returnData: Prisma.PurchaseReturnItemUncheckedCreateWithoutReturInput[] =
      [];

    for (const item of items) {
      const purchaseItem = purchaseItemMap.get(item.purchaseItemId);

      if (!purchaseItem) {
        throw new ErrorApi("Invalid purchased item in return request", 400);
      }

      const returnAggregrate = await prisma.purchaseReturnItem.aggregate({
        where: {
          purchaseItemId: item.purchaseItemId,
          retur: {
            status: {notIn: ["REJECTED", "DONE"]}
          }
        },
        _sum: {
          quantity: true
        }
      });

      const alreadyReturned = returnAggregrate._sum.quantity ?? 0;
      const availableReturnStock = purchaseItem.quantity - alreadyReturned;
      if (item.quantity > availableReturnStock) {
        throw new ErrorApi(
          `Max returanble quantity is ${availableReturnStock}`,
          400
        );
      }

      returnData.push({
        quantity: item.quantity,
        purchaseItemId: item.purchaseItemId,
        unitCost: purchaseItem.unitCost,
        subTotal: item.quantity * purchaseItem.unitCost,
        inventoryId: purchaseItem.inventoryId,
      });
    }

    await prisma.purchaseReturn.create({
      data: {
        tenantId,
        requestedBy: userId,
        reason,
        purchaseId,
        items: {
          create: returnData,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function approvedStatus(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;
    const returnId = req.params.id;

    const existedReturnRequest = await prisma.purchaseReturn.findUnique({
      where: {
        id: returnId,
        tenantId,
        status: "REQUESTED",
      },
      include: {
        items: {
          include: {
            inventory: true,
            purchaseItem: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });
    if (!existedReturnRequest) {
      return next(new ErrorApi("Return is not requested yet", 400));
    }

    await prisma.$transaction(async (tx) => {
      type ReturnItem = (typeof existedReturnRequest.items)[number];
      type ReturnInventoryAgg = {
        inventoryId: string;
        quantity: number;
        unitCost: number;
        inventory: ReturnItem["inventory"];
      };
      const returnItemByInventory = new Map<string, ReturnInventoryAgg>();

      for (const item of existedReturnRequest.items) {
        const key = item.inventoryId;

        if (!returnItemByInventory.has(key)) {
          returnItemByInventory.set(key, {
            inventoryId: item.inventoryId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            inventory: item.inventory,
          });
        } else {
          returnItemByInventory.get(key)!.quantity -= item.quantity;
        }
      }

      for (const entry of returnItemByInventory.values()) {
        const invetory = entry.inventory;

        const stockBefore = invetory.stock;
        const stockAfter = stockBefore - entry.quantity;

        await tx.inventory.update({
          where: {
            id: entry.inventoryId,
          },
          data: {
            stock: stockAfter,
          },
        });

        await tx.stockLedger.create({
          data: {
            type: "RETURN",
            quantity: entry.quantity,
            stockBefore,
            stockAfter,
            costBefore: invetory.cost,
            costAfter: invetory.cost,
            refId: existedReturnRequest.id,
            inventoryId: entry.inventoryId,
            tenantId,
            note: "return approved",
          },
        });
      }

      await tx.purchaseReturn.update({
        where: {
          id: existedReturnRequest.id,
        },
        data: {
          status: "APPROVED",
        },
      });
    });

    res
      .status(200)
      .json({ success: true, message: "Return request : Approved!" });
  } catch (error) {
    next(error);
  }
}

export async function rejectReturn(req: Request<{id: string}>, res: Response, next: NextFunction) {
    try {
        const tenantId = req.user!.tenantId
        const returnId = req.params.id

        const existedReturn = await prisma.purchaseReturn.findFirst({
            where: {
                tenantId,
                id: returnId,
                status: "REQUESTED"
            }
        })
        if (!existedReturn) return next(new ErrorApi("Return request is not found", 404))

        await prisma.purchaseReturn.update({
            where: {
                id: returnId,
                tenantId
            },
            data: {
                status: "REJECTED"
            }
        })

        res.status(200).json({
            message: "Return request rejected"
        })
    } catch (error) {
        next(error)
    }
}

export async function doneReturn(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;
    const returnId = req.params.id;

    const existedReturnApproved = await prisma.purchaseReturn.findUnique({
      where: {
        id: returnId,
        tenantId,
        status: "APPROVED",
      },
      include: {
        items: {
          include: {
            inventory: true,
            purchaseItem: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });
    if (!existedReturnApproved) {
      return next(new ErrorApi("Return is not requested yet", 400));
    }


    await prisma.$transaction(async (tx) => {
      type ReturnItem = (typeof existedReturnApproved.items)[number];
      const invetoryAgg = new Map<string, {
        inventory: ReturnItem["inventory"],
        quantity: number
      }>()

      for (const item of existedReturnApproved.items) {
        const key = item.inventoryId

        if (!invetoryAgg.has(key)) {
          invetoryAgg.set(key, {
            inventory: item.inventory,
            quantity: item.quantity
          })
        } else {
          invetoryAgg.get(key)!.quantity +=  item.quantity
        }
      }

      for (const {inventory, quantity} of invetoryAgg.values()) {
        const stockBefore = inventory.stock
        const stockAfter = stockBefore + quantity

        await tx.inventory.update({
          where: {
            id: inventory.id
          },
          data: {
            stock: stockAfter
          }
        })

        await tx.stockLedger.create({
          data: {
            type: "ADJUST",
            quantity,
            stockBefore,
            stockAfter,
            costBefore: inventory.cost,
            costAfter: inventory.cost,
            refId: existedReturnApproved.id,
            note: "return completed",
            inventoryId: inventory.id,
            tenantId
          }
        })

        await tx.purchaseReturn.update({
          where: {
            id: existedReturnApproved.id
          },
          data: {
            status: "DONE"
          }
        })
      }
    });

    res.status(200).json({
      success: true,
      message: "Return completed successfully"
    })
  } catch (error) {
    next(error);
  }
}

