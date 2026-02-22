import { Request, Response, NextFunction } from "express";
import { ErrorApi } from "../middlewares/error-handler";
import { prisma } from "../libs/prisma";
import type { SupplierBody } from "../schemas/supplier";

export async function getSuppliersTenant (req: Request, res: Response, next: NextFunction) {
    try {
        const tenantId = req.user!.tenantId
        const q = req.query.q as string

        const result = await prisma.supplier.findMany({
            where: {
                tenantId,
                ...(q && {
                    name: { contains: q, mode: "insensitive"}
                })
            },
            select: {
                id: true,
                name: true
            }
        })

        res.status(200).json({
            result
        })
    } catch (error) {
        next(error)
    }
}

export async function createNewSupplier(req: Request, res: Response, next: NextFunction) {
    try {
        const tenantId = req.user!.tenantId

        const {name, email, phone, address} = req.body as SupplierBody

        const existedSupplier = await prisma.supplier.findFirst({
            where: {
                tenantId,
                name
            }
        })
        if (existedSupplier) return next(new ErrorApi("Supplier already exist", 400))

        await prisma.supplier.create({
            data: {
                tenantId,
                name,
                email,
                phone,
                address
            }
        })

        res.status(201).json({
            message: "New Supplier has been added"
        })
    } catch (error) {
        next(error)
    }
}
