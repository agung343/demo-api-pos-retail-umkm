import { z } from "zod"

export const newInventorySchema = z.object({
    name: z.string().trim().min(3, "Product at least has 3 characters long"),
    code: z.string().trim().min(2, "Code at least has 2 characters long"),
    price: z.number().int().nonnegative("Invalid value: must be a positive number"),
    cost: z.number().int().nonnegative("Invalid value: must be a positive number"),
    description: z.string().optional()
})

export const updateInventorySchema = z.object({
    name: z.string().trim().min(3, "Product at least has 3 characters long"),
    code: z.string().trim().min(2, "Code at least has 2 characters long"),
    price: z.number().int().nonnegative("Invalid value: must be a positive number"),
    cost: z.number().int().nonnegative("Invalid value: must be a positive number"),
    description: z.string().optional()
})

export type inventoryBody = z.infer<typeof newInventorySchema>

export type updateInventoryBody = z.infer<typeof updateInventorySchema>
