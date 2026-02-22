import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { ErrorApi } from "../middlewares/error-handler";
import { prisma } from "../libs/prisma";
import type { loginBody } from "../schemas/auth";

export async function loginController(req: Request<{tenant: string}>, res: Response, next: NextFunction) {
    try {
        const { tenant } = req.params
        const { username, password } = req.body as loginBody
        
        const existedTenant = await prisma.tenant.findUnique({
            where: {name: tenant}
        })
        if (!existedTenant) {
            return next(new ErrorApi("Tenant is not exist", 404))
        }

        const user = await prisma.user.findUnique({
            where: {
                tenantId_username: {
                    tenantId: existedTenant.id,
                    username
                }
            }
        })
        if (!user) return next(new ErrorApi("Username or Password are not match", 401))

        const match = await bcrypt.compare(password, user.password)
        if (!match) return next(new ErrorApi("Username or Password are not match", 401))

        const token = jwt.sign({tenantId: existedTenant.id, userId: user.id, username: user.username, role: user.role}, process.env.JWT_SECRET!, {expiresIn: "6h"})

        const isProd = process.env.NODE_ENV === "production"

        res.status(200).cookie("token", token, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            maxAge: 1000 * 60 * 60 * 6
        }).json({succcess: true})
    } catch (error) {
        next(error)
    }
}

export async function meController(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!
        res.status(200).json({
            user: {
                tenantId: user.tenantId,
                userId: user.userId,
                username: user.username,
                role: user.role
            }
        })
    } catch (error) {
        next(error)
    }
}

export function logoutController(req: Request, res: Response) {
    const isProd = process.env.NODE_ENV === "production"
    res.clearCookie("token", {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax"
    })
    .status(200)
    .json({message: "Logged out"})
}
