import { Request, Response, NextFunction } from "express";
import { startOfDay, startOfMonth, endOfMonth, subYears, eachMonthOfInterval, format } from "date-fns";
import { prisma } from "../libs/prisma";
import { ErrorApi } from "../middlewares/error-handler";

export async function getDashboardSummary(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { createdAt: true },
    });
    if (!tenant) return next(new ErrorApi("Tenant not found", 404));

    const todayStart = startOfDay(new Date());   
    const monthStart = startOfMonth(new Date());

    const oneYearAgo = subYears(new Date(), 1)
    const rawStart = tenant.createdAt > oneYearAgo ? tenant.createdAt : oneYearAgo
    const startDate = startOfMonth(rawStart)

    const [salesTrend, purchasesTrend] = await prisma.$transaction([
      prisma.$queryRaw<
        {
          month: Date;
          totalAmount: number;
        }[]
      >`
        SELECT 
          date_trunc('month', "createdAt") AS month,
          COALESCE(SUM("totalAmount"), 0)::int AS "totalAmount"
        FROM "Sales"
        WHERE "tenantId" = ${tenantId}
          AND "isDeleted" = false
          AND "createdAt" >= ${startDate}
        GROUP BY month
        ORDER BY month ASC;
      `,
      prisma.$queryRaw<
        {
          month: Date;
          totalAmount: number;
        }[]
      >`
        SELECT 
          date_trunc('month', "createdAt") AS month,
          COALESCE(SUM("totalAmount"), 0)::int AS "totalAmount"
        FROM "Purchases"
        WHERE "tenantId" = ${tenantId}
          AND "isDeleted" = false
          AND "createdAt" >= ${startDate}
        GROUP BY month
        ORDER BY month ASC;
      `,
    ]);

    const [
      salesToday,
      salesMonth,
      salesCount,
      purchaseMonth,
      leastStock,
      mostSold,
      topRevenueRaw,
    ] = await Promise.all([
      prisma.sales.aggregate({
        where: {
          tenantId,
          isDeleted: false,
          createdAt: { gte: todayStart },
        },
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.sales.aggregate({
        where: {
          tenantId,
          isDeleted: false,
          createdAt: { gte: monthStart },
        },
        _sum: { totalAmount: true },
      }),
      prisma.sales.count({ where: { tenantId, isDeleted: false } }),
      prisma.purchases.aggregate({
        where: {
          tenantId,
          isDeleted: false,
          createdAt: {
            gte: monthStart,
          },
        },
        _sum: { totalAmount: true },
      }),
      prisma.inventory.findMany({
        where: {
          tenantId,
        },
        select: {
          id: true,
          name: true,
          stock: true,
        },
        orderBy: {
          stock: "asc",
        },
        take: 5,
      }),
      prisma.inventory.findMany({
        where: {
          tenantId,
          sold: {
            gt: 0,
          },
        },
        select: {
          id: true,
          name: true,
          cost: true,
          price: true,
          sold: true,
        },
        orderBy: {
          sold: "desc",
        },
        take: 5,
      }),
      prisma.saleItems.groupBy({
        by: ["inventoryId"],
        where: {
          sale: {
            tenantId,
            isDeleted: false,
          },
        },
        _sum: {
          subTotal: true,
        },
        orderBy: {
          _sum: {
            subTotal: "desc",
          },
        },
        take: 5,
      }),
    ]);

    const endDate = endOfMonth(new Date())

    const months = eachMonthOfInterval({
      start: startDate,
      end: endDate
    })
    const salesMap = new Map(
      salesTrend.map((sale) => [
        `${sale.month.getFullYear()}-${sale.month.getMonth()}`,
        sale.totalAmount
      ])
    )
    const purchasesMap = new Map(
      purchasesTrend.map(purchase => [
        `${purchase.month.getFullYear()}-${purchase.month.getMonth()}`,
        purchase.totalAmount
      ])
    )
    const trend = months.map((date) => {
      const key = `${date.getFullYear()}-${date.getMonth()}`
      return {
        month: format(date, "MMM yyyy"),
        sales: salesMap.get(key) ?? 0,
        purchases: purchasesMap.get(key) ?? 0
      }
    })

    const inventoryIds = topRevenueRaw.map((i) => i.inventoryId);

    const invetories = await prisma.inventory.findMany({
      where: {
        id: { in: inventoryIds },
      },
      select: {
        id: true,
        name: true,
      },
    });
    const inventoryMap = new Map(invetories.map((i) => [i.id, i]));
    const topRevenue = topRevenueRaw.map((item) => {
      const product = inventoryMap.get(item.inventoryId);

      return {
        id: item.inventoryId,
        name: product?.name ?? "unknown",
        totalRevenue: item._sum.subTotal ?? 0,
      };
    });

    res.status(200).json({
      success: true,
      trend,
      sales: {
        today: salesToday._sum.totalAmount ?? 0,
        month: salesMonth._sum.totalAmount ?? 0,
        totalTransactions: salesCount,
      },
      purchases: {
        month: purchaseMonth._sum.totalAmount ?? 0,
      },
      inventory: {
        leastStock,
        mostSold,
        topRevenue,
      },
    });
  } catch (error) {
    next(error);
  }
}
