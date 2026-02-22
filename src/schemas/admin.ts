import {z} from "zod"

export const newAdminSchema = z.object({
    username:z.string().trim().min(3, "Username at least have 3 characters long"),
    password: z.string().trim().min(6, "Password at least 6 characters long"),
    role: z.enum(["ADMIN", "STAFF"])
})

export const updateAdminSchema = z.object({
    username:z.string().trim().min(3, "Username at least have 3 characters long").optional(),
    password: z.string().trim().min(6, "Password at least 6 characters long").optional(),
    role: z.enum(["ADMIN", "STAFF"]).optional()
})


export type newAdminBody = z.infer<typeof newAdminSchema>

export type updateAdminBody = z.infer<typeof updateAdminSchema>