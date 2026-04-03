import { Router } from "express"
import { productSearch } from "../services/productSearchService"
import { deductCredits } from "../services/walletService"
import { AuthRequest } from "../middleware/auth"
import { createError } from "../middleware/validate"
import { query as dbQuery } from "../db"
import { logger } from "../utils/logger"

export const searchRouter = Router()

// POST /api/search
// Universal AI product search — 3 credits per search (unlimited for dev/owner)
searchRouter.post("/", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email
    if (!email) {
      return res.status(401).json({
        success: false,
        error: { message: "Unauthenticated", code: "UNAUTHENTICATED" },
      })
    }

    const queryText = (req.body.query || "").toString().trim()
    if (!queryText)        return next(createError("query is required", 400, "VALIDATION_ERROR"))
    if (queryText.length < 2) return next(createError("query is too short", 400, "VALIDATION_ERROR"))

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return next(createError("ANTHROPIC_API_KEY not configured", 503, "NOT_CONFIGURED"))

    // Fetch user info
    const UNLIMITED_ROLES = ["dev", "owner"]
    const { rows } = await dbQuery(
      `SELECT role, subscription, trial_ends_at FROM allowed_users
       WHERE email = $1 AND is_active = true LIMIT 1`,
      [email]
    )
    const user = rows[0]

    // Determine effective subscription (handle expired trial)
    let subscription: string = user?.subscription || "free"
    if (subscription === "trial" && user?.trial_ends_at && new Date(user.trial_ends_at) < new Date()) {
      subscription = "free"
    }

    const isUnlimited = user && UNLIMITED_ROLES.includes(user.role)

    // Deduct 3 credits (skip for unlimited roles)
    if (!isUnlimited) {
      const creditResult = await deductCredits(
        email, 3,
        `Universal product search: "${queryText.slice(0, 60)}"`
      )
      if (!creditResult.success) {
        return res.status(429).json({
          success: false,
          error: {
            message:      `Insufficient credits. You need 3 credits but only have ${creditResult.balance}.`,
            code:         "USAGE_LIMIT_REACHED",
            balance:      creditResult.balance,
            required:     3,
            subscription,
            role:         user?.role ?? "unknown",
            trial_ends_at: user?.trial_ends_at ?? null,
          },
        })
      }
    }

    // Visible results limit per plan
    const LIMITS: Record<string, number> = { free: 3, trial: 8, pro: 20, enterprise: 20 }
    const limit = isUnlimited ? 20 : (LIMITS[subscription] ?? 3)

    // Geo-detect user country from IP
    const rawIp    = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
                     || req.socket.remoteAddress || ""
    const clientIp = rawIp.replace("::ffff:", "")
    let countryHint = ""
    if (clientIp && clientIp !== "127.0.0.1" && clientIp !== "::1") {
      try {
        const geoRes = await fetch(
          `http://ip-api.com/json/${clientIp}?fields=country,status`,
          { signal: AbortSignal.timeout(3000) }
        )
        const geo = await geoRes.json()
        if (geo.status === "success" && geo.country) countryHint = geo.country
      } catch { /* geo lookup is best-effort */ }
    }

    logger.info("[Search] Starting", { email, query: queryText, subscription, limit, countryHint })

    const response = await productSearch(queryText, apiKey, countryHint)
    logger.info("[Search] Done", { email, count: response.results.length, cached: response.cached })

    res.json({
      success: true,
      data: {
        query:   response.query,
        intent:  response.intent,
        results: response.results,
        limit,
        cached:  response.cached,
      },
    })
  } catch (err) {
    next(err)
  }
})
