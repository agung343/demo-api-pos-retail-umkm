import { Response, NextFunction } from "express"
import { Prisma } from "../generated/prisma/client"

export class ErrorApi extends Error {
    public statusCode: number
    public details: unknown

    constructor(message: string, statusCode: number, details?: unknown) {
        super(message)
        this.statusCode = statusCode
        this.details = details
    }
}

export default function ErrorHandler(err: ErrorApi, _req:any, res:Response, next:NextFunction) {
    const message = err.message || "An error occured";
    const statusCode = err instanceof ErrorApi ? err.statusCode : 500;
    const details = err instanceof ErrorApi ? err.details : null

    if (err instanceof Prisma.PrismaClientInitializationError) {
        throw new ErrorApi("Service temporarily unavailable", 503)
    }

    res.status(statusCode).json({
        success: false,
        message,
        details
    })
}
