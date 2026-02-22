import { Router } from "express";
import { prisma } from "../libs/prisma";
import { addTenantSchema } from "../schemas/tenant";
import { validator } from "../middlewares/validate";
import type { AddTenantBody } from "../schemas/tenant";
import { ErrorApi } from "../middlewares/error-handler";

const router = Router()

router.post("/", validator(addTenantSchema), async (req, res, next) => {
    try {
        const {name, email, phone, description} = req.body as AddTenantBody

        const existedTenant = await prisma.tenant.findUnique({
            where: {
                name,
                email
            }
        })
        if (existedTenant) {
            return next(new ErrorApi("Tenant already exist", 400))
        }

        const prefix = name.slice(0,3).toUpperCase()

        await prisma.tenant.create({
            data: {
                name,
                email,
                phone,
                description,
                invoicePrefix: prefix
            }
        })
    } catch (error) {
        next(error)
    }
})

export default router;
