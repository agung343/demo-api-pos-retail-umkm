import { Request, Response, NextFunction } from "express";
import { stringify } from "csv-stringify/sync";
import ExcelJS from "exceljs";
import { ErrorApi } from "../middlewares/error-handler";
import { prisma } from "../libs/prisma";
import { Prisma } from "../generated/prisma/client";
import { dateFilterHelper, type DateRange } from "../libs/date-filter";

interface ReportQuery {
  q?: string;
  from?: string;
  to?: string;
  range?: DateRange;
  format?: "csv" | "xlsx";
}

async function buildSalesReportData(
  tenantId: string,
  { q, range, from, to }: ReportQuery
) {
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

  const dateFilter = dateFilterHelper(range, from, to);
  if (dateFilter) where.createdAt = dateFilter;

  const result = await prisma.sales.findMany({
    where,
    orderBy: {
      createdAt: "desc",
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
    },
  });

  const sales = result.flatMap((sale) =>
    sale.items.map((i) => ({
      Invoice: sale.invoice,
      Date: sale.createdAt,
      Item: i.inventory.name,
      Code: i.inventory.code,
      Quantity: i.quantity,
      Price: i.unitPrice,
      SubTotal: i.subTotal,
      Method: sale.method,
    }))
  );

  return sales;
}

async function buildPurchaseData(
  tenantId: string,
  { q, range, from, to }: ReportQuery
) {
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

  const dateFilter = dateFilterHelper(range, from, to);
  if (dateFilter) where.createdAt = dateFilter;

  const result = await prisma.purchases.findMany({
    where,
    include: {
      supplier: {
        select: {
          name: true,
        },
      },
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
    },
  });

  const purchases = result.flatMap((purchase) =>
    purchase.items.map((i) => ({
      Invoice: purchase.invoice,
      Date: purchase.createdAt,
      Supplier: purchase.supplier.name,
      Item: i.inventory.name,
      Code: i.inventory.code,
      Quantity: i.quantity,
      Cost: i.unitCost,
      SubTotal: i.subTotal,
    }))
  );

  return purchases;
}

export async function getSalesReportData(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const { format = "csv" } = req.query as ReportQuery;

    const data = await buildSalesReportData(tenantId, req.query as ReportQuery);

    if (format === "csv") {
      const csv = stringify(data, { header: true });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="sales-report.csv"'
      );

      return res.send(csv);
    }

    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Sales Report");

      sheet.columns = Object.keys(data[0]).map((key) => ({
        header: key,
        key,
        width: 20,
      }));

      data.forEach((row) => sheet.addRow(row));

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="sales-report.xlsx"'
      );

      await workbook.xlsx.write(res);

      return res.end();
    }

    next(new ErrorApi("Unsupported export format", 400));
  } catch (error) {
    next(error);
  }
}

export async function getPurchasesReportData(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const { format = "csv" } = req.query as ReportQuery;

    const data = await buildPurchaseData(tenantId, req.query as ReportQuery);

    if (format === "csv") {
      const csv = stringify(data, { header: true });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="purchase-report.csv"'
      );

      return res.send(csv);
    }

    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Purchase Report");

      sheet.columns = Object.keys(data[0]).map((key) => ({
        header: key,
        key,
        width: 20,
      }));

      data.forEach((row) => sheet.addRow(row));

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="purchase-report.xlsx"'
      );

      await workbook.xlsx.write(res);

      return res.end();
    }

    next(new ErrorApi("Unsupported export format", 400));
  } catch (error) {
    next(error);
  }
}
