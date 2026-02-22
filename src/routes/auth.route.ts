import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { validator } from "../middlewares/validate";
import { loginSchema } from "../schemas/auth";
import { loginController, logoutController, meController } from "../controllers/auth.controller";

const router = Router()

router.post("/logout", logoutController)

router.post("/:tenant", validator(loginSchema), loginController)

router.get("/me", verifyToken, meController)

export default router;
