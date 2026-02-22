import { Request, Response, NextFunction } from "express";
import { startOfDay, endOfDay } from "date-fns";
import { ErrorApi } from "../middlewares/error-handler";
import { prisma } from "../libs/prisma";
import { Prisma } from "../generated/prisma/client";
import { generateInvoice } from "../libs/invoice-generate";
import { SalesBody, EditSaleBody } from "../schemas/transaction";

interface SalesQuery {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export async function getTenantSales(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const { page = 1, limit = 25, from, to } = req.query as SalesQuery;

    const pageNumber = Math.max(page, 1);
    const pageSize = Math.min(limit, 100);

    const startDate = from
      ? startOfDay(new Date(from))
      : startOfDay(new Date());
    const endDate = to ? endOfDay(new Date(to)) : endOfDay(new Date());

    const [sales, total] = await Promise.all([
      prisma.sales.findMany({
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
          method: true,
          createdAt: true,
        },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.sales.count({
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
      success: true,
      sales,
      meta: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next();
  }
}

export async function getSaleDetails(
  req: Request<{ saleId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const { saleId } = req.params;

    const result = await prisma.sales.findFirst({
      where: {
        id: saleId,
        tenantId,
      },
      select: {
        invoice: true,
        user: {
          select: {
            username: true,
          },
        },
        totalAmount: true,
        method: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            subTotal: true,
            inventory: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        isEdited: true,
        editedAt: true,
        editUser: {
          select: {
            username: true,
          },
        },
        isDeleted: true,
        deletedAt: true,
        deleteUser: {
          select: {
            username: true,
          },
        },
      },
    });
    if (!result) return next(new ErrorApi("Sale not recorded", 400));

    const sale = {
      invoice: result.invoice,
      createdAt: result.createdAt,
      method: result.method,
      issuedBy: result.user.username,
      totalAmount: result.totalAmount,
      items: result.items.map((r) => ({
        id: r.inventory.id,
        quantity: r.quantity,
        price: r.unitPrice,
        subTotal: r.subTotal,
        name: r.inventory.name,
        code: r.inventory.code,
      })),
      isEdited: result.isEdited,
      editedAt: result.isEdited ? result.editedAt : null,
      editedBy: result.isEdited ? result.editUser?.username : null,
      isDeleted: result.isDeleted,
      deletedAt: result.isDeleted ? result.deletedAt : null,
      deletedBy: result.isDeleted ? result.deleteUser?.username : null,
    };

    res.status(200).json({
      success: true,
      sale,
    });
  } catch (error) {
    next(error);
  }
}

export async function createNewSaleController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user!;

    const { method, items } = req.body as SalesBody;

    const sale = await prisma.$transaction(async (tx) => {
      // validate stock
      const inventoryIds = items.map(i => i.inventoryId)
      const inventories = await tx.inventory.findMany({
        where: {
          id: {in: inventoryIds},
          tenantId: user.tenantId,
        }
      })
      if (inventories.length !== inventoryIds.length) {
        throw new ErrorApi("Invalid inventory detected", 400)
      }
      const inventoryMap = new Map(
        inventories.map(inv => [inv.id, inv])
      )
      for (const item of items) {
        const inventory = inventoryMap.get(item.inventoryId)!
        if (inventory.stock < item.quantity) throw new ErrorApi(`Stock ${inventory.name} is not enoguh`,400)
      }

      //generate invoice
      const invoice = await generateInvoice(tx, user.tenantId);

      // calculate totalAmount
      const totalAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );

      //create sale
      const result = await tx.sales.create({
        data: {
          tenantId: user.tenantId,
          invoice,
          totalAmount,
          method,
          issueBy: user.userId,
          items: {
            create: items.map((item) => ({
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subTotal: item.quantity * item.unitPrice,
              inventoryId: item.inventoryId,
            })),
          },
        },
        include: {
          items: {
            include: {
              inventory: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
          },
          user: {
            select: {
              username: true
            }
          }
        },
      });

      //update inventory and ledger
      for (const item of items) {
        const inventory = inventoryMap.get(item.inventoryId)!

        const stockBefore = inventory.stock
        const stockAfter = inventory.stock - item.quantity
        await tx.inventory.update({
          where: {
            id: item.inventoryId,
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
            sold: {
              increment: item.quantity,
            },
          },
        });

        await tx.stockLedger.create({
          data: {
            type: "SALE",
            quantity: -item.quantity,
            stockBefore: stockBefore,
            stockAfter: stockAfter,
            costBefore: inventory.cost,
            costAfter: inventory.cost,
            refId: result.id,
            inventoryId: item.inventoryId,
            tenantId: user.tenantId
          }
        })
      }

      const sale = {
        invoice: result.invoice,
        createdAt: result.createdAt,
        method: result.method,
        issuedBy: result.user.username,
        totalAmount: result.totalAmount,
        items: result.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          price: item.unitPrice,
          name: item.inventory.name,
          code: item.inventory.code,
        })),
      };

      return sale;
    });

    res.status(201).json({
      success: true,
      sale,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelSaleController(
  req: Request<{ saleId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user!;
    const id = req.params.saleId;

    const result = await prisma.$transaction(async (tx) => {
      // get sale with items
      const sale = await tx.sales.findFirst({
        where: {
          tenantId: user.tenantId,
          id,
          isDeleted: false,
        },
        include: {
          items: true,
        },
      });
      if (!sale) {
        return next(new ErrorApi("Sale not found or already canceled", 400));
      }

      // restore stock & sold
      for (const item of sale.items) {
        const inventory = await tx.inventory.findUnique({
          where: {
            id: item.inventoryId
          }
        })
        if (!inventory) throw new ErrorApi("Inventory no exist", 400)
        await tx.inventory.update({
          where: {
            id: inventory.id,
            tenantId: user.tenantId
          },
          data: {
            stock: { increment: item.quantity },
            sold: { decrement: item.quantity },
          },
        });

        await tx.stockLedger.create({
          data: {
            type: "CANCEL_SALE",
            quantity: item.quantity,
            stockBefore: inventory.stock,
            stockAfter: inventory.stock + item.quantity,
            costBefore: inventory.cost,
            costAfter: inventory.cost,
            refId: sale.id,
            tenantId: user.tenantId,
            inventoryId: item.inventoryId,
            note: ""
          }
        })
      }

      //soft delete
      const canceled = await tx.sales.update({
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
      message: "Sale is canceled",
    });
  } catch (error) {
    next(error);
  }
}

export async function editController(
  req: Request<{ saleId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user!;
    const { saleId } = req.params;

    const { items } = req.body as EditSaleBody;

    await prisma.$transaction(async (tx) => {
      const existedSale = await tx.sales.findUnique({
        where: {
          id: saleId,
          tenantId: user.tenantId,
          isDeleted: false,
        },
        include: {
          items: true,
        },
      });
      if (!existedSale) throw new ErrorApi("Sales not found", 404);
      if (existedSale.isDeleted) throw new ErrorApi("Sales has been deleted", 400)
      
      for (const oldItem of existedSale.items) {
        const inventory = await tx.inventory.findUnique({
          where: {
            id: oldItem.inventoryId
          }
        })
        const stockBefore = inventory!.stock
        const stockAfter = stockBefore + oldItem.quantity

        await tx.inventory.update({
          where: {id: oldItem.inventoryId},
          data: {
            stock: {increment: oldItem.quantity},
            sold: {decrement: oldItem.quantity}
          }
        })
        await tx.stockLedger.create({
          data: {
            type: "EDIT_SALE_RESTORE",
            quantity: oldItem.quantity,
            stockBefore,
            stockAfter,
            costBefore: inventory!.cost,
            costAfter: inventory!.cost,
            tenantId: user.tenantId,
            refId: existedSale.id,
            note: "Edited Sale restored",
            inventoryId: inventory!.id
          }
        })
      }

      await tx.saleItems.deleteMany({
        where: {saleId}
      })

      //validate edit-stock
      for (const item of items) {
        const inventory = await tx.inventory.findUnique({
          where: { id: item.inventoryId}
        })
        if (!inventory) throw new ErrorApi("Inventory not found", 404)
        if (inventory.stock < item.quantity) throw new ErrorApi(`Stock of ${inventory.name} is not enough`, 400)
        const stockBefore = inventory.stock
        const stockAfter = stockBefore - item.quantity

        await tx.inventory.update({
          where: {
            id: item.inventoryId
          },
          data: {
            stock: {decrement: item.quantity},
            sold: {increment: item.quantity}
          }
        })

        await tx.stockLedger.create({
          data: {
            type: "EDIT_SALE_APPLY",
            quantity: item.quantity,
            stockBefore,
            stockAfter,
            costAfter: inventory.cost,
            costBefore: inventory.cost,
            refId: existedSale.id,
            tenantId: user.tenantId,
            inventoryId: inventory.id,
          }
        })

        await tx.saleItems.create({
          data: {
            saleId,
            inventoryId: item.inventoryId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subTotal: item.quantity * item.unitPrice
          }
        })
      }

      const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    
      await tx.sales.update({
        where: {
          id: existedSale.id,
        },
        data: {
          totalAmount,
          isEdited: true,
          editedBy: user.userId,
          editedAt: new Date(),
        },
      });
    });

    res.status(200).json({
      success: true,
      message: "Sale has been updated",
    });
  } catch (error) {
    next(error);
  }
}

export async function getAllTenantSales(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const {
      page = 1,
      limit = 25,
      from,
      to,
      status = "active",
    } = req.query as SalesQuery & { status?: "active" | "deleted" };

    if (!["active", "deleted"].includes(status)) {
      return next(new ErrorApi("Invalid status", 400));
    }

    const pageNumber = Math.max(page, 1);
    const pageSize = Math.min(limit, 100);

    const dateFilter: Prisma.DateTimeFilter = {};
    if (!from && to) {
      return next(new ErrorApi("Invalid date input", 400));
    }
    if (from) {
      dateFilter.gte = startOfDay(new Date(from));
      dateFilter.lte = endOfDay(new Date(to ?? new Date()));
    }

    const where: Prisma.SalesWhereInput = {
      tenantId,
      isDeleted: status === "deleted",
    };
    if (Object.keys(dateFilter).length) {
      where.createdAt = dateFilter;
    }

    const [sales, total] = await Promise.all([
      prisma.sales.findMany({
        where,
        select: {
          id: true,
          invoice: true,
          totalAmount: true,
          method: true,
          createdAt: true,
        },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy:
          status === "deleted" ? { deletedAt: "desc" } : { createdAt: "desc" },
      }),
      prisma.sales.count({
        where,
      }),
    ]);

    res.status(200).json({
      success: true,
      sales,
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
