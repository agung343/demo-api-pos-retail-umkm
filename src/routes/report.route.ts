import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { getSalesReport, getPurchasesReport } from "../controllers/report.controller";
import { getDashboardSummary } from "../controllers/dashboard.controller";
import { getSalesReportData, getPurchasesReportData } from "../services/report.service";

const router = Router()

router.get("/sales", verifyToken, getSalesReport)

router.get("/purchases", verifyToken, getPurchasesReport)

router.get("/dashboard", verifyToken, getDashboardSummary)

router.get("/sales/export", verifyToken, getSalesReportData)

router.get("/purchases/export", verifyToken, getPurchasesReportData)

export default router;
