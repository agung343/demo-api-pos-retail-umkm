import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { validator } from "../middlewares/validate";
import {
  createNewSaleSchema,
  updateSaleSchema,
} from "../schemas/transaction";
import { verifyRole } from "../middlewares/verifyRole";
import * as saleController from "../controllers/sales.controller";

const router = Router();

router.get("/", verifyToken, saleController.getTenantSales);

router.get("/all", verifyToken, saleController.getAllTenantSales)

router.get("/:saleId", verifyToken, saleController.getSaleDetails);

router.post(
  "/new",
  verifyToken,
  validator(createNewSaleSchema),
  saleController.createNewSaleController
);

router.delete(
  "/:saleId",
  verifyToken,
  verifyRole("OWNER", "ADMIN"),
  saleController.cancelSaleController
);

router.put(
  "/:saleId/edit",
  verifyToken,
  verifyRole("ADMIN", "OWNER"),
  validator(updateSaleSchema),
  saleController.editController
);

export default router;
