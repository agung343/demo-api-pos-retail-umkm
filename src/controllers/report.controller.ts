import { Request, Response, NextFunction } from "express";
import { eachMonthOfInterval, format } from "date-fns";
import { ErrorApi } from "../middlewares/error-handler";
import { prisma } from "../libs/prisma";
import { Prisma } from "../generated/prisma/client";
import { dateFilterHelper, type DateRange } from "../libs/date-filter";

interface ReportQuery {
  q?: string;
  from?: string;
  to?: string;
  range?: DateRange
  page?: number;
  limit?: number;
}

export async function getSalesReport(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const { page = 1, limit = 25, from, to, q, range } = req.query as ReportQuery;

    const pageNumber = Math.max(page, 1);
    const pageSize = Math.min(limit, 100);

    if (!from && to) {
      return next(new ErrorApi("Invalid date input", 400));
    }
    
    const dateFilter = dateFilterHelper(range, from, to)

    const where: Prisma.SalesWhereInput = {
      tenantId,
      isDeleted: false,
      ...(q && {
        items: {
          some: {
            inventory: {
              name: { contains: q, mode: "insensitive" },
            },
          },
        },
      }),
    };

    if (dateFilter !== undefined) {
      where.createdAt = dateFilter;
    }

    const [results, total, totalRevenue] = await Promise.all([
      prisma.sales.findMany({
        where,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          items: {
            where: q
              ? {
                  inventory: {
                    name: { contains: q, mode: "insensitive" },
                  },
                }
              : undefined,
            include: {
              inventory: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      }),
      prisma.sales.count({ where }),
      prisma.saleItems.aggregate({
        where: {
          sale: where,
          ...(q && {
            inventory: {
              name: {contains: q, mode: "insensitive"}
            }
          })
        },
        _sum: {
          subTotal: true
        }
      })
    ]);

    const sales = results.flatMap((sale) => 
      sale.items.map(i => ({
        id: i.id,
        invoice: sale.invoice,
        saleDate: sale.createdAt,
        name: i.inventory.name,
        code: i.inventory.code,
        quantity: i.quantity,
        price: i.unitPrice,
        subTotal: i.subTotal,
        method: sale.method
      }))
    )
    const totalSales = totalRevenue._sum.subTotal ?? 0;

    res.status(200).json({
      success: true,
      sales,
      totalRevenue: totalSales,
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

export async function getPurchasesReport(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const { page = 1, limit = 25, from, to, q, range } = req.query as ReportQuery;

    const pageNumber = Math.max(page, 1);
    const pageSize = Math.min(limit, 100);

    const tenant = await prisma.tenant.findUnique({
      where: {
        id: tenantId,
      },
      select: {
        createdAt: true
      }
    })

    if (!tenant) {
      return next(new ErrorApi("Tenant not found", 404))
    }

    if (!from && to) {
      return next(new ErrorApi("Invalid date input", 400));
    }

    const dateFilter = dateFilterHelper(range, from, to)

    const where: Prisma.PurchasesWhereInput = {
      tenantId,
      isDeleted: false,
      ...(q && {
        items: {
          some: {
            inventory: {
              name: { contains: q, mode: "insensitive" },
            },
          },
        },
      }),
    };
    if (dateFilter) {
      where.createdAt = dateFilter
    }

    const [results, total, totalCost] = await Promise.all([
      prisma.purchases.findMany({
        where,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        include: {
            supplier: {
                select: {
                    name: true
                }
            },
            items: {
            where: q
              ? {
                  inventory: {
                    name: { contains: q, mode: "insensitive" },
                  },
                }
              : undefined,
            include: {
              inventory: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      }),
      prisma.purchases.count({ where }),
      prisma.purchaseItems.aggregate({
        where: {
          purchases: where,
          ...(q && {
            inventory: {
              name: {contains: q, mode: "insensitive"}
            }
          })
        },
        _sum: {
          subTotal: true
        }
      })
    ]);

    const totalCOST = totalCost._sum.subTotal ?? 0;

    const purchases = results.flatMap((purchase) =>
      purchase.items.map(i => ({
        id: i.id,
        invoice: purchase.invoice,
        purchaseDate: purchase.createdAt,
        supplier: purchase.supplier.name,
        status: purchase.status,
        name: i.inventory.name,
        code: i.inventory.code,
        quantity: i.quantity,
        cost: i.unitCost,
        subTotal: i.subTotal
      }))
    )

    res.status(200).json({
        success: true,
        purchases,
        totalCost: totalCOST,
        meta: {
            page: pageNumber,
            limit: pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    })
  } catch (error) {
    next(error);
  }
}
