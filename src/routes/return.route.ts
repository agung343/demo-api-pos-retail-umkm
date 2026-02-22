import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { validator } from "../middlewares/validate";
import { verifyRole } from "../middlewares/verifyRole";
import { ReturnInputSchema } from "../schemas/return";
import * as returnController from "../controllers/return.controller"

const router = Router()

router.get("/", verifyToken, returnController.getAllReturnTenant)

router.post("/new", verifyToken, validator(ReturnInputSchema), returnController.createNewReturn)

router.get("/:id", verifyToken, returnController.getReturnsDetails)

router.patch("/:id/approved", verifyToken, verifyRole("OWNER", "ADMIN"), returnController.approvedStatus)

router.patch("/:id/rejected", verifyToken, verifyRole("OWNER", "ADMIN"), returnController.rejectReturn)

router.patch("/:id/done", verifyToken, verifyRole("OWNER", "ADMIN"), returnController.doneReturn)

export default router