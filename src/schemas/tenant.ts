import { z } from "zod"

export const addTenantSchema = z.object({
    name: z.string().trim().min(3, "Tenant name at least 3 characters long"),
    email: z.email().nonempty("Email is required"),
    phone: z.string().trim().nonempty(),
    description: z.string().optional()
})

export type AddTenantBody = z.infer<typeof addTenantSchema>