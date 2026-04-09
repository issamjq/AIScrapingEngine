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
import { plansRouter }              from "./routes/plans"
import { walletRouter }             from "./routes/wallet"
import { currencyRatesRouter }      from "./routes/currencyRates"
import { exportRouter }             from "./routes/export"
import { searchRouter }             from "./routes/search"
import { suggestionsRouter }        from "./routes/suggestions"
import { requireAuth }              from "./middleware/auth"

const app  = express()
const PORT = process.env.PORT ?? 8080

// Trust Render / reverse-proxy headers so req.ip reflects the real client IP
app.set("trust proxy", 1)

// Middleware
app.use(helmet())
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  ...(process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? "").split(",").map(o => o.trim()).filter(Boolean),
]
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: ${origin} not allowed`))
  },
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
app.use("/api/plans",                requireAuth, plansRouter)
app.use("/api/wallet",               requireAuth, walletRouter)
app.use("/api/currency-rates",       requireAuth, currencyRatesRouter)
app.use("/api/export",               requireAuth, exportRouter)
app.use("/api/search",               requireAuth, searchRouter)
app.use("/api/suggestions",          requireAuth, suggestionsRouter)

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { message: "Not found", code: "NOT_FOUND" } })
})

// Global error handler — never expose raw DB/internal errors to client
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500
  console.error(err.stack)
  // Only pass through messages we explicitly set via createError (have a .code property)
  const isAppError = !!err.code && status < 500
  res.status(status).json({
    success: false,
    error: {
      message: isAppError ? err.message : "Internal server error",
      code:    isAppError ? err.code    : "INTERNAL_ERROR",
    },
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})

export default app
