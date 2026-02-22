import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { validator } from "../middlewares/validate";
import { newAdminSchema, updateAdminSchema } from "../schemas/admin";
import { verifyRole } from "../middlewares/verifyRole";
import { getTenantUser, createNewAdmin, updateUser, deleteUserController} from "../controllers/admin.controller"

const router = Router()

router.get("/", verifyToken, verifyRole("ADMIN", "OWNER"), getTenantUser)

router.post("/new", verifyToken, verifyRole("ADMIN", "OWNER"), validator(newAdminSchema), createNewAdmin)

router.put("/:adminId/edit", verifyToken, verifyRole("ADMIN", "OWNER"), validator(updateAdminSchema), updateUser)

router.delete("/:adminId", verifyToken, verifyRole("ADMIN", "OWNER"), deleteUserController)

export default router;