import dotenv from "dotenv"
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

import tenantRoute from "./routes/tenant.route"
import authRoutes from "./routes/auth.route"
import adminRoutes from "./routes/admin.route"
import inventoryRoutes from "./routes/inventory.route"
import salesRoutes from "./routes/sales.route"
import purchaseRoutes from "./routes/purchase.route"
import returnRoutes from "./routes/return.route"
import supplierRoutes from "./routes/supplier.route"
import reportRoutes from "./routes/report.route"
import ErrorHandler from "./middlewares/error-handler"

dotenv.config()
const PORT = process.env.PORT || 8080

const app = express()

app.use(express.json())
app.use(cookieParser())

app.use(cors({
    origin: [process.env.CLIENT_URL as string, "http://localhost:3000"],
    credentials: true
}))

app.use(process.env.TENANT_ENDPOINT as string, tenantRoute)
app.use("/auth", authRoutes)
app.use("/admin", adminRoutes)
app.use("/inventory", inventoryRoutes)
app.use("/transaction/sales", salesRoutes)
app.use("/transaction/purchases", purchaseRoutes)
app.use("/retur", returnRoutes)
app.use("/supplier", supplierRoutes)
app.use("/report", reportRoutes)

app.use(ErrorHandler)

app.listen(PORT, () => console.log(`listening at ${PORT}`))
