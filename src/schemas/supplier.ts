import { email, z } from "zod"

export const createNewSupplierSchema = z.object({
    name: z.string().trim().min(3, "Supplier at least has 3 characters long"),
    email: z.string().email("Invalid Email").or(z.literal("")),
    phone: z.string().trim().optional(),
    address: z.string().optional()
})

export type SupplierBody = z.infer<typeof createNewSupplierSchema>
