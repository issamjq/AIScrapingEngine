import "dotenv/config"
import express, { Request, Response, NextFunction } from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"

// Original routes
import { authRouter }    from "./routes/auth"
import { usersRouter }   from "./routes/users"
import { scrapingRouter } from "./routes/scraping"
import { contentRouter } from "./routes/content"

// RSP / scraping-engine routes
import { companiesRouter }          from "./routes/companies"
import { productsRouter }           from "./routes/products"
import { productCompanyUrlsRouter } from "./routes/productCompanyUrls"
import { priceSnapshotsRouter }     from "./routes/priceSnapshots"
import { syncRunsRouter }           from "./routes/syncRuns"
import { scraperRouter }            from "./routes/scraper"
import { discoveryRouter }          from "./routes/discovery"
import { statsRouter }              from "./routes/stats"
import { allowedUsersRouter }       from "./routes/allowedUsers"
import { requireAuth }              from "./middleware/auth"

const app  = express()
const PORT = process.env.PORT ?? 8080

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? "http://localhost:3000",
  credentials: true,
}))
app.use(morgan("dev"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.1", timestamp: new Date().toISOString() })
})

// ── Original routes ──────────────────────────────────────────────
app.use("/api/auth",     authRouter)
app.use("/api/users",    usersRouter)
app.use("/api/scraping", scrapingRouter)
app.use("/api/content",  contentRouter)

// ── RSP / scraping-engine routes (all protected by requireAuth) ──
app.use("/api/companies",            requireAuth, companiesRouter)
app.use("/api/products",             requireAuth, productsRouter)
app.use("/api/product-company-urls", requireAuth, productCompanyUrlsRouter)
app.use("/api/price-snapshots",      requireAuth, priceSnapshotsRouter)
app.use("/api/sync-runs",            requireAuth, syncRunsRouter)
app.use("/api/scraper",              requireAuth, scraperRouter)
app.use("/api/discovery",            requireAuth, discoveryRouter)
app.use("/api/stats",                requireAuth, statsRouter)
app.use("/api/allowed-users",        requireAuth, allowedUsersRouter)

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { message: "Not found", code: "NOT_FOUND" } })
})

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500
  console.error(err.stack)
  res.status(status).json({
    success: false,
    error: {
      message: err.message || "Internal server error",
      code:    err.code    || "INTERNAL_ERROR",
    },
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})

export default app
