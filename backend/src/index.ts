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
import { creatorIntelRouter }       from "./routes/creatorIntel"
import { adminStatsRouter }        from "./routes/adminStats"
import { adminUserRouter }         from "./routes/adminUser"
import { superAdminRouter }        from "./routes/superAdmin"
import { heartbeatRouter }         from "./routes/heartbeat"
import { totpRouter }              from "./routes/totp"
import { requireTotp }             from "./middleware/requireTotp"
import { blogPublicRouter, blogAdminRouter } from "./routes/blog"
import { broadcastsRouter }        from "./routes/broadcasts"
import { timingMiddleware }        from "./middleware/timing"
import { logError }                from "./services/errorLogger"
import { requireAuth }              from "./middleware/auth"
import { globalLimiter }            from "./middleware/rateLimit"

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

// Global rate limit — all API routes
app.use("/api/", globalLimiter)

// Request timing — records duration/status for every finished API request
app.use("/api/", timingMiddleware)

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.1", timestamp: new Date().toISOString() })
})

// ── Original routes ──────────────────────────────────────────────
app.use("/api/auth",     authRouter)
app.use("/api/users",    usersRouter)
app.use("/api/scraping", scrapingRouter)
app.use("/api/content",  contentRouter)

// Public blog reads — anonymous landing-page visitors.
app.use("/api/blog",     blogPublicRouter)

// ── RSP / scraping-engine routes (all protected by requireAuth) ──
app.use("/api/companies",            requireAuth, requireTotp, companiesRouter)
app.use("/api/products",             requireAuth, requireTotp, productsRouter)
app.use("/api/product-company-urls", requireAuth, requireTotp, productCompanyUrlsRouter)
app.use("/api/price-snapshots",      requireAuth, requireTotp, priceSnapshotsRouter)
app.use("/api/sync-runs",            requireAuth, requireTotp, syncRunsRouter)
app.use("/api/scraper",              requireAuth, requireTotp, scraperRouter)
app.use("/api/discovery",            requireAuth, requireTotp, discoveryRouter)
app.use("/api/stats",                requireAuth, requireTotp, statsRouter)
app.use("/api/allowed-users",        requireAuth, requireTotp, allowedUsersRouter)
app.use("/api/plans",                requireAuth, requireTotp, plansRouter)
app.use("/api/wallet",               requireAuth, requireTotp, walletRouter)
app.use("/api/currency-rates",       requireAuth, requireTotp, currencyRatesRouter)
app.use("/api/export",               requireAuth, requireTotp, exportRouter)
app.use("/api/search",               requireAuth, requireTotp, searchRouter)
app.use("/api/suggestions",          requireAuth, requireTotp, suggestionsRouter)
app.use("/api/creator-intel",        requireAuth, requireTotp, creatorIntelRouter)
app.use("/api/admin/stats",          requireAuth, requireTotp, adminStatsRouter)
app.use("/api/admin/user",           requireAuth, requireTotp, adminUserRouter)
app.use("/api/admin/super",          requireAuth, requireTotp, superAdminRouter)
app.use("/api/blog/admin",           requireAuth, requireTotp, blogAdminRouter)
app.use("/api/heartbeat",            requireAuth, heartbeatRouter   /* heartbeat is in TOTP skip-list */)

// TOTP enrollment + verification — must be reachable BEFORE TOTP is satisfied,
// hence no requireTotp here. The skip-list inside requireTotp also covers
// /api/auth/totp/* for any other middleware ordering.
app.use("/api/auth/totp",            requireAuth, totpRouter)
// Broadcasts: GET /active is intentionally public (so the landing page can
// show the banner to anonymous visitors). The admin write/list endpoints
// inside the router apply requireAuth themselves.
app.use("/api/broadcasts",           broadcastsRouter)

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { message: "Not found", code: "NOT_FOUND" } })
})

// Global error handler — never expose raw DB/internal errors to client
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500
  console.error(err.stack)
  // Only pass through messages we explicitly set via createError (have a .code property)
  const isAppError = !!err.code && status < 500
  // Persist 5xx (and uncategorized) errors so the admin dashboard can surface them
  if (status >= 500 || !isAppError) {
    logError({
      level:      status >= 500 ? "error" : "warn",
      source:     "express",
      message:    err.message || "unknown error",
      stack:      err.stack,
      path:       req.path,
      status,
      user_email: (req as any).email ?? null,
      ip:         (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null,
    })
  }
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
