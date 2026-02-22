import { Request, Response, NextFunction } from "express";
import { ErrorApi } from "./error-handler";
import { UserRole } from "../generated/prisma/enums";

export function verifyRole(...allowedRoles: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new ErrorApi("Unauthorized", 401))
        }

        if (!allowedRoles.includes(req.user.role as UserRole)) {
            return next(new ErrorApi("Forbidden", 403))
        }

        next()
    }
}