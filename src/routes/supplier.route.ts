import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { validator } from "../middlewares/validate";
import { createNewSupplierSchema } from "../schemas/supplier";
import { getSuppliersTenant, createNewSupplier } from "../controllers/supplier.controller";

const router = Router()

router.get("/", verifyToken, getSuppliersTenant)

router.post("/new", verifyToken, validator(createNewSupplierSchema), createNewSupplier)

export default router