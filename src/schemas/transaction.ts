import { z } from "zod"

export const PaymentEnum = z.enum([
    "CASH",
    "CREDITCARD",
    "TRANSFER",
    "QRIS"
])

export const SaleInputSchema = z.object({
    quantity: z.number().int().positive(),
    unitPrice: z.number().int().nonnegative(),
    subTotal: z.number().int().nonnegative(),
    inventoryId: z.cuid()
})

export const IniatialPaymentStatus = z.object({
    amount: z.number().int().positive(),
    method: PaymentEnum,
    note: z.string().trim().optional()
})

export const addPurchasePaymentSchema = z.object({
    amount: z.number().int().positive(),
    method: PaymentEnum,
    note: z.string().trim().optional()
})


export const PurchaseInputSchema = z.object({
    quantity: z.number().int().positive(),
    unitCost: z.number().int().nonnegative(),
    inventoryId: z.cuid()
})

export const returSchema = z.object({
    quantity: z.number().int().positive("must be a positive number"),
    reason: z.string().trim().min(1, "reason is required"),
    purchaseId: z.cuid(),
    purchaseItemId: z.cuid()
})

export const createNewSaleSchema = z.object({
    method: PaymentEnum,
    items: z.array(SaleInputSchema).min(1 , "At least one inventory selected")
})

export const createNewPurchaseSchema = z.object({
    invoice: z.string().trim().min(1, "Invoice is required"),
    supplierId: z.cuid("Supplier is required"),
    items: z.array(PurchaseInputSchema).min(1, "At least one inventory selected"),
    initialPayment: IniatialPaymentStatus.optional()
}).superRefine((data, ctx) => {
    const ids = data.items.map(i => i.inventoryId)
    if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
            code: "custom",
            message: "Duplicate inventory detected"
        })
    }
})

export const updateSaleSchema = z.object({
    items: z.array(SaleInputSchema).min(1, "at least one inventory in sale")
})

export const updatePurchaseSchema = z.object({
    items: z.array(PurchaseInputSchema).min(1, "At least one invetory selected")
})

export type SalesBody = z.infer<typeof createNewSaleSchema>
export type EditSaleBody = z.infer<typeof updateSaleSchema>
export type PurchasesBody = z.infer<typeof createNewPurchaseSchema>
export type EditPurchaseBody = z.infer<typeof updatePurchaseSchema>
export type AddPaymentBody = z.infer<typeof addPurchasePaymentSchema>