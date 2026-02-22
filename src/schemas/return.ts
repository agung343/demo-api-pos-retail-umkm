import { z } from "zod"

export const ReturnStatus = z.enum([
    "REQUESTED",
    "APPROVED",
    "REJECTED",
    "DONE"
])

export const ReturnItem = z.object({
    purchaseItemId: z.cuid(),
    quantity: z.number().int().positive("Value must be a positive number"),
})

export const ReturnInputSchema = z.object({
    reason: z.string().trim().min(20, "At least has 20 characters long"),
    purchaseId: z.cuid(),
    items: z.array(ReturnItem).min(1, "At least one item selected")
})

export type ReturnBody = z.infer<typeof ReturnInputSchema>
