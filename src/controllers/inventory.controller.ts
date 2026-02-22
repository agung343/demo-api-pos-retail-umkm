import { Request, Response, NextFunction } from "express";
import slugify from "slugify";
import { Prisma } from "../generated/prisma/client";
import { ErrorApi } from "../middlewares/error-handler";
import { prisma } from "../libs/prisma";
import type { inventoryBody, updateInventoryBody } from "../schemas/inventory";

interface InventoryQuery {
  q?: string;
  page?: number;
  limit?: number;
}

export async function getTenantInventory(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const { q, page = 1, limit = 25 } = req.query as InventoryQuery;

    const pageNumber = Math.max(page, 1);
    const pageSize = Math.min(limit, 100);

    const where: Prisma.InventoryWhereInput = {
      tenantId,
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
        ],
      }),
    };

    const [products, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        omit: {
          slug: true,
          createdAt: true,
          updatedAt: true,
          tenantId: true,
        },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: {
          name: "asc",
        },
      }),
      prisma.inventory.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      products,
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

export async function getInventoryDetail(
  req: Request<{ pid: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const { pid } = req.params;

    const product = await prisma.inventory.findUnique({
      where: {
        id: pid,
        tenantId,
      },
      omit: {
        slug: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
      },
    });
    if (!product) return next(new ErrorApi("Product not found", 404));

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
}

export async function createNewInventory(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const { name, code, price, cost, description } = req.body as inventoryBody;

    const existedInventoryName = await prisma.inventory.findUnique({
      where: {
        tenantId_name: {
          tenantId,
          name,
        },
      },
    });
    const existedInventoryCode = await prisma.inventory.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code,
        },
      },
    });
    if (existedInventoryName)
      return next(new ErrorApi(`${name} is already exist`, 400));
    if (existedInventoryCode)
      return next(new ErrorApi(`${code} is already exist`, 400));

    const slug = slugify(name, { lower: true, trim: true, strict: true });

    const newInventory = await prisma.inventory.create({
      data: {
        name,
        slug,
        code,
        price,
        cost,
        description,
        tenantId,
      },
    });

    res.status(201).json({
      success: true,
      message: `${newInventory.name} has beed added`,
    });
  } catch (error) {
    next(error);
  }
}

export async function editInventory(
  req: Request<{ pid: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;
    const { pid } = req.params;

    const { name, code, price, cost, description } =
      req.body as updateInventoryBody;

    const existedInventory = await prisma.inventory.findUnique({
      where: {
        id: pid,
        tenantId,
      },
    });
    if (!existedInventory)
      return next(new ErrorApi("Inventory not found", 400));

    const slug = slugify(name, { lower: true, trim: true, strict: true });

    await prisma.inventory.update({
      where: {
        id: pid,
        tenantId,
      },
      data: {
        name,
        code,
        slug,
        price,
        cost,
        description,
      },
    });

    res.status(200).json({
      success: true,
      message: "Inventory has been updated",
    });
  } catch (error) {
    next(error);
  }
}

// search inventory for transaction input
export async function SearchController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const { q } = req.query as InventoryQuery;

    const where: Prisma.InventoryWhereInput = {
      tenantId,
      ...(q && {
        OR: [{ name: { contains: q, mode: "insensitive" } }],
      }),
    };

    const result = await prisma.inventory.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        price: true,
        cost: true,
        stock: true,
      },
    });

    res.status(200).json({
      success: true,
      result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getInventoryLedger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const { q, page = 1, limit = 25 } = req.query as InventoryQuery;

    const pageNumber = Math.max(page, 1);
    const pageSize = Math.min(limit, 100);

    const result = await prisma.stockLedger.findMany({
      where: {
        tenantId,
        ...(q && {
          inventory: { name: { contains: q, mode: "insensitive" } },
        }),
      },
      include: {
        inventory: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      skip: (pageNumber - 1) * pageSize,
      take: pageSize,
      orderBy: {
        createdAt: "desc",
      },
    });

    const total = await prisma.stockLedger.count({
      where: {
        tenantId,
        ...(q && {
          inventory: { name: { contains: q, mode: "insensitive" } },
        }),
      },
    });

    const ledgers = result.map((i) => ({
      id: i.id,
      name: i.inventory.name,
      code: i.inventory.code,
      date: i.createdAt,
      type: i.type,
      quantity: i.quantity,
      stockBefore: i.stockBefore,
      stockAfter: i.stockAfter,
    }));

    res.status(200).json({
      ledgers,
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
