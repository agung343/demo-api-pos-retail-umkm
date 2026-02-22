import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { validator } from "../middlewares/validate";
import {
  createNewPurchaseSchema,
  addPurchasePaymentSchema,
} from "../schemas/transaction";
import { verifyRole } from "../middlewares/verifyRole";
import {
  getPurchasesTenant,
  getPurchaseDetails,
  createNewPurchase,
  cancelPurchaseController,
  getAllTenantPurchases,
  addPurchasePayment,
} from "../controllers/purchase.controller";

const router = Router();

router.get("/", verifyToken, getPurchasesTenant);

router.get("/all", verifyToken, getAllTenantPurchases);

router.get("/:purchaseId", verifyToken, getPurchaseDetails);

router.post(
  "/new",
  verifyToken,
  validator(createNewPurchaseSchema),
  createNewPurchase
);

router.post(
  "/:purchaseId/payment",
  verifyToken,
  validator(addPurchasePaymentSchema),
  addPurchasePayment
);

router.delete(
  "/:purchaseId",
  verifyToken,
  verifyRole("ADMIN", "OWNER"),
  cancelPurchaseController
);

export default router;
