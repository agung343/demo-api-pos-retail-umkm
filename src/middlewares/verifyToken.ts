import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken"
import { ErrorApi } from "./error-handler";

export interface AuthPayload {
    tenantId: string
    userId: string
    username: string
    role: "OWNER" | "ADMIN" | "STAFF"
}

export function verifyToken(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies.token
    if (!token) {
        return next(new ErrorApi("Unauthorized", 401))
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
        req.user = decoded
        next()
    } catch (error) {
        next(new ErrorApi("Invalid or expired token", 401))
    }
}