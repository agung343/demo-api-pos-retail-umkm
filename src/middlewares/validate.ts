import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import { ErrorApi } from "./error-handler"

type RequestPart = "body" | "params" | "query"

export function validator(schema: z.ZodObject, property: RequestPart = "body") {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[property])

        if (!result.success) {
            const errors = result.error.flatten()
            const details = errors.fieldErrors
            return next(new ErrorApi("Validation Error", 422, details))
        }

        req[property] = result.data
        next()
    }
}