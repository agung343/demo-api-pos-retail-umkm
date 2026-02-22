import { Router } from "express";
import { validator } from "../middlewares/validate";
import { verifyToken } from "../middlewares/verifyToken";
import { newInventorySchema, updateInventorySchema } from "../schemas/inventory";
import { getInventoryLedger, getTenantInventory, getInventoryDetail, createNewInventory, editInventory, SearchController } from "../controllers/inventory.controller";

const router = Router()

router.get("/", verifyToken, getTenantInventory)

router.get("/search", verifyToken, SearchController)

router.get("/ledgers", verifyToken, getInventoryLedger)

router.get("/:pid", verifyToken, getInventoryDetail)

router.post("/new", verifyToken, validator(newInventorySchema), createNewInventory)

router.put("/:pid/edit", verifyToken, validator(updateInventorySchema), editInventory)

export default router;
