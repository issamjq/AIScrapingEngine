import { Router } from "express"
import { discoverProducts, confirmMappings, probeWebsite } from "../services/discoveryService"
import { b2cSearch } from "../services/b2cSearchService"
import { aiWebSearch } from "../scraper/aiWebSearch"
import { callClaude } from "../utils/claudeClient"
import { createError } from "../middleware/validate"
import { checkUsageLimit } from "../middleware/usageLimit"
import { checkAndDeductCredits, getWallet } from "../services/walletService"
import { AuthRequest } from "../middleware/auth"
import { logger } from "../utils/logger"
import { query as dbQuery } from "../db"
import { upsertSuggestion } from "../services/suggestionsService"
import { b2cSearchLimiter, unlockLimiter } from "../middleware/rateLimit"
import { logActivity, getClientIp } from "../services/activityLogger"

export const discoveryRouter = Router()

// POST /api/discovery/search
discoveryRouter.post("/search", checkUsageLimit as any, async (req, res, next) => {
  try {
    const email     = (req as AuthRequest).email!
    const companyId = parseInt(req.body.company_id)
    if (!companyId || isNaN(companyId)) return next(createError("company_id is required", 400, "VALIDATION_ERROR"))
    const searchQuery = (req.body.query || "marvis").toString().trim()
    logger.info("[DiscoveryRoute] search", { companyId, searchQuery })
    const data = await discoverProducts(companyId, searchQuery)
    logActivity({ user_email: email, action: "b2b_catalog_discovery", details: { query: searchQuery, company_id: companyId }, ip: getClientIp(req) })
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// POST /api/discovery/confirm
discoveryRouter.post("/confirm", async (req, res, next) => {
  try {
    const companyId = parseInt(req.body.company_id)
    if (!companyId || isNaN(companyId)) return next(createError("company_id is required", 400, "VALIDATION_ERROR"))
    const mappings = req.body.mappings
    if (!Array.isArray(mappings) || mappings.length === 0) return next(createError("mappings must be a non-empty array", 400, "VALIDATION_ERROR"))
    for (const m of mappings) {
      if (!m.product_id || !m.url) return next(createError("Each mapping must have product_id and url", 400, "VALIDATION_ERROR"))
    }
    logger.info("[DiscoveryRoute] confirm", { companyId, count: mappings.length })
    const data = await confirmMappings(companyId, mappings)
    logActivity({ user_email: (req as AuthRequest).email!, action: "b2b_confirm_mappings", details: { company_id: companyId, count: mappings.length }, ip: getClientIp(req) })
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// POST /api/discovery/ai-search
discoveryRouter.post("/ai-search", checkUsageLimit as any, async (req, res, next) => {
  try {
    const query = (req.body.query || "").toString().trim()
    if (!query) return next(createError("query is required", 400, "VALIDATION_ERROR"))

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return next(createError("ANTHROPIC_API_KEY not configured on server", 503, "NOT_CONFIGURED"))

    const retailers: string[] = Array.isArray(req.body.retailers) && req.body.retailers.length > 0
      ? req.body.retailers
      : ["Amazon AE (amazon.ae)", "Noon (noon.com)", "Carrefour UAE (carrefouruae.com)"]

    logger.info("[DiscoveryRoute] ai-search", { query, retailers })
    const results = await aiWebSearch(query, retailers, apiKey)
    logActivity({ user_email: (req as AuthRequest).email!, action: "b2b_ai_search", details: { query, retailers, results_count: results.length }, ip: getClientIp(req) })
    res.json({ success: true, data: { query, results } })
  } catch (err) { next(err) }
})

// POST /api/discovery/ai-match
// Takes discovered items [{retailer, url, title}] + fetches product catalog,
// returns each item with AI-matched product + confidence score
discoveryRouter.post("/ai-match", checkUsageLimit as any, async (req, res, next) => {
  try {
    const items = req.body.items
    if (!Array.isArray(items) || items.length === 0)
      return next(createError("items array required", 400, "VALIDATION_ERROR"))

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey)
      return next(createError("ANTHROPIC_API_KEY not configured", 503, "NOT_CONFIGURED"))

    // Fetch product catalog from DB — scoped to this user
    const { query: dbQuery } = await import("../db")
    const { rows: catalog } = await dbQuery(
      `SELECT id, internal_name, internal_sku, brand FROM products WHERE is_active = true AND user_email = $1 ORDER BY internal_name`,
      [(req as AuthRequest).email]
    )

    if (catalog.length === 0) {
      // No catalog — return items with no match
      return res.json({
        success: true,
        data: items.map((item: any) => ({ ...item, match: null, confidence: 0 })),
      })
    }

    const catalogText = catalog
      .map((p: any) => `${p.id}|${p.internal_name}|${p.brand || ""}`)
      .join("\n")

    const itemsText = items
      .map((item: any, i: number) => `${i}: "${item.title}" [${item.retailer}]`)
      .join("\n")

    const prompt =
      `You are matching retailer product listings to an internal product catalog.\n\n` +
      `INTERNAL CATALOG (format: id|name|brand):\n${catalogText}\n\n` +
      `RETAILER LISTINGS (format: index: "title" [retailer]):\n${itemsText}\n\n` +
      `For each listing, find the best matching catalog product.\n` +
      `Consider: same product name, same size/volume, same brand.\n` +
      `A high confidence (>=0.85) means it's the exact same product.\n` +
      `A medium confidence (0.6-0.84) means it's the same product line but maybe different size.\n` +
      `If no reasonable match exists, set confidence to 0 and catalog_id to null.\n\n` +
      `Return ONLY a JSON array:\n` +
      `[{"i": 0, "catalog_id": 5, "confidence": 0.95}]\n` +
      `Include ALL listing indices (even non-matches with confidence 0).`

    const aiData = await callClaude(apiKey, {
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages:   [{ role: "user", content: prompt }],
    })
    const rawText = aiData?.content?.[0]?.text || "[]"
    const jm      = rawText.match(/\[[\s\S]*\]/)
    const matches: any[] = jm ? JSON.parse(jm[0]) : []

    const idToProduct = Object.fromEntries(catalog.map((p: any) => [p.id, p]))

    const result = items.map((item: any, i: number) => {
      const m       = matches.find((x: any) => x.i === i)
      const product = m?.catalog_id ? idToProduct[m.catalog_id] : null
      return {
        ...item,
        match:      product ? { id: product.id, name: product.internal_name, brand: product.brand } : null,
        confidence: m?.confidence ?? 0,
      }
    })

    logger.info("[DiscoveryRoute] ai-match", {
      items: items.length,
      matched: result.filter((r: any) => r.match).length,
    })
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

// POST /api/discovery/b2c-search
// B2C price discovery: web search + Playwright scrape + Vision AI fallback = 3 credits
discoveryRouter.post("/b2c-search", b2cSearchLimiter as any, async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email
    if (!email) return res.status(401).json({ success: false, error: { message: "Unauthenticated", code: "UNAUTHENTICATED" } })

    const queryText = (req.body.query || "").toString().trim().slice(0, 300)
    if (!queryText) return next(createError("query is required", 400, "VALIDATION_ERROR"))
    if (queryText.length > 300) return next(createError("query too long (max 300 chars)", 400, "VALIDATION_ERROR"))

    // Batch: 1=Quick(3 sites/1 credit), 2=Standard(6 sites/2 credits), 3=Deep(10 sites/3 credits)
    const batch   = Math.min(3, Math.max(1, parseInt(req.body.batch) || 3))
    const siteCap = batch === 1 ? 3 : batch === 2 ? 6 : 10
    const credits = batch  // 1, 2, or 3

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return next(createError("ANTHROPIC_API_KEY not configured", 503, "NOT_CONFIGURED"))

    const UNLIMITED_ROLES = ["dev", "owner"]
    const { rows } = await dbQuery(
      `SELECT role, subscription, trial_ends_at FROM allowed_users WHERE email = $1 AND is_active = true LIMIT 1`,
      [email]
    )
    const user = rows[0]

    // Determine effective subscription (handle expired trial)
    let subscription: string = user?.subscription || "free"
    if (subscription === "trial" && user?.trial_ends_at && new Date(user.trial_ends_at) < new Date()) {
      subscription = "free"
    }

    // Deduct credits based on batch size (1/2/3) unless unlimited role
    if (user && !UNLIMITED_ROLES.includes(user.role)) {
      const batchLabel = batch === 1 ? "Quick (3 sites)" : batch === 2 ? "Standard (6 sites)" : "Deep (10 sites)"
      const creditResult = await checkAndDeductCredits(email, credits, `B2C AI price search — ${batchLabel}`)
      if (!creditResult.success) {
        const limitMsg: Record<string, string> = {
          daily:   "Daily credit limit reached. Limit resets at midnight UTC.",
          weekly:  "Weekly credit limit reached. Limit resets next Monday.",
          balance: `Insufficient credits. You need ${credits} credits but only have ${creditResult.balance}.`,
        }
        return res.status(429).json({
          success: false,
          error: {
            message:      limitMsg[creditResult.limitType ?? "balance"] ?? "Usage limit reached.",
            code:         "USAGE_LIMIT_REACHED",
            limitType:    creditResult.limitType,
            balance:      creditResult.balance,
            required:     credits,
            subscription,
            role:         user.role,
            trial_ends_at: user.trial_ends_at ?? null,
          },
        })
      }
    }

    // Visible results limit per plan (rest are blurred on frontend)
    const LIMITS: Record<string, number> = { free: 3, trial: 8, pro: 20, paid: 20, enterprise: 20, weekly: 20, monthly: 20 }
    const limit = (user && UNLIMITED_ROLES.includes(user.role)) ? 20 : (LIMITS[subscription] ?? 3)

    // Detect user country from IP for geo-aware search
    const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
                  || req.socket.remoteAddress || ""
    const clientIp = rawIp.replace("::ffff:", "")  // strip IPv4-mapped IPv6 prefix
    let countryHint = ""
    if (clientIp && clientIp !== "127.0.0.1" && clientIp !== "::1") {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${clientIp}?fields=country,status`, { signal: AbortSignal.timeout(3000) })
        const geo    = await geoRes.json()
        if (geo.status === "success" && geo.country) countryHint = geo.country
      } catch { /* geo lookup is best-effort — never block the search */ }
    }

    // Switch to SSE — all pre-flight checks passed, now stream progress
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Accel-Buffering", "no")  // disable Nginx buffering on Render
    res.flushHeaders()

    const send = (data: object) => {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`) } catch { /* client disconnected */ }
    }

    logger.info("[B2CSearch] Starting", { email, query: queryText, subscription, limit, countryHint, batch, siteCap, credits })
    const searchStart = Date.now()

    try {
      const { results, correctedQuery } = await b2cSearch(
        queryText, apiKey, countryHint, siteCap,
        (event) => send({ type: "phase", ...event }),
      )
      const durationSeconds = Math.round((Date.now() - searchStart) / 1000)
      const finalQuery = correctedQuery ?? queryText
      logger.info("[B2CSearch] Done", { email, count: results.length, correctedQuery, durationSeconds })

      // Log activity
      logActivity({ user_email: email, action: "b2c_search", details: { query: finalQuery, results_count: results.length, batch, credits, country_hint: countryHint }, ip: getClientIp(req) })

      // Save to suggestions table — crowdsourced autocomplete (fire-and-forget)
      upsertSuggestion(finalQuery, results.length).catch(() => {})

      // Save FULL results to history — await so we get the ID for secure unlock
      let historyId: number | null = null
      if (results.length > 0) {
        try {
          const { rows: hRows } = await dbQuery(
            `INSERT INTO b2c_search_history (user_email, query, country_hint, results, result_count, duration_seconds, batch)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [email, finalQuery, countryHint, JSON.stringify(results), results.length, durationSeconds, batch]
          )
          historyId = hRows[0]?.id ?? null
        } catch (err: any) {
          logger.warn("[B2CSearch] Failed to save history", { error: err.message })
        }
      }

      // Strip sensitive data from non-first results per retailer — never send locked data to client
      const retailerSeen = new Set<string>()
      const securedResults = results.map(r => {
        if (!retailerSeen.has(r.retailer)) {
          retailerSeen.add(r.retailer)
          return r  // first per retailer — full data
        }
        // Locked stub — no price, title, image, description sent to browser
        return {
          retailer:      r.retailer,
          url:           r.url,        // needed as unlock identifier; URL alone has no value without price/title
          isLocked:      true,
          title:         null,
          condition:     null,
          price:         null,
          originalPrice: null,
          currency:      null,
          availability:  null,
          imageUrl:      null,
          rating:        null,
          reviewCount:   null,
          description:   null,
          priceSource:   null,
        }
      })

      send({ type: "done", data: { query: finalQuery, correctedQuery, results: securedResults, historyId, limit, batch, credits } })
    } catch (err: any) {
      send({ type: "error", error: { message: err.message || "Search failed", code: "SEARCH_ERROR" } })
    }

    res.end()
  } catch (err) { next(err) }
})

// GET /api/discovery/b2c-history
discoveryRouter.get("/b2c-history", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email
    if (!email) return res.status(401).json({ success: false, error: { message: "Unauthenticated", code: "UNAUTHENTICATED" } })

    const { rows } = await dbQuery(
      `SELECT id, query, country_hint, results, result_count, searched_at
       FROM b2c_search_history
       WHERE user_email = $1
       ORDER BY searched_at DESC
       LIMIT 20`,
      [email]
    )

    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})

// POST /api/discovery/b2c-unlock
// Validates credits, reads real data from history, returns unlocked results
discoveryRouter.post("/b2c-unlock", unlockLimiter as any, async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email
    if (!email) return res.status(401).json({ success: false, error: { message: "Unauthenticated", code: "UNAUTHENTICATED" } })

    const { historyId, urls } = req.body
    if (!historyId || !Array.isArray(urls) || urls.length === 0)
      return next(createError("historyId and urls[] required", 400, "VALIDATION_ERROR"))
    if (urls.length > 20)
      return next(createError("Cannot unlock more than 20 at once", 400, "VALIDATION_ERROR"))

    // Verify history row belongs to this user
    const { rows: hRows } = await dbQuery(
      `SELECT results FROM b2c_search_history WHERE id = $1 AND user_email = $2 LIMIT 1`,
      [historyId, email]
    )
    if (!hRows[0]) return next(createError("History entry not found", 404, "NOT_FOUND"))

    const allResults: any[] = typeof hRows[0].results === "string"
      ? JSON.parse(hRows[0].results)
      : hRows[0].results

    const urlSet = new Set(urls)

    // Check credits and deduct (skip for unlimited roles)
    const UNLIMITED_ROLES = ["dev", "owner"]
    const { rows: userRows } = await dbQuery(
      `SELECT role FROM allowed_users WHERE email = $1 AND is_active = true LIMIT 1`, [email]
    )
    const role = userRows[0]?.role ?? ""
    if (!UNLIMITED_ROLES.includes(role)) {
      const creditResult = await (await import("../services/walletService")).deductCredits(
        email, urls.length,
        `Unlocked ${urls.length} search result${urls.length > 1 ? "s" : ""}`
      )
      if (!creditResult.success) {
        return res.status(429).json({
          success: false,
          error: { message: "Insufficient credits", code: "USAGE_LIMIT_REACHED", balance: creditResult.balance }
        })
      }
    }

    // Return only the matching real results + updated balance
    const unlocked = allResults.filter(r => urlSet.has(r.url))
    const wallet   = await (await import("../services/walletService")).getWallet(email)
    logger.info("[B2CUnlock]", { email, historyId, requested: urls.length, found: unlocked.length })

    logActivity({ user_email: email, action: "b2c_unlock", details: { history_id: historyId, count: unlocked.length }, ip: getClientIp(req) })
    res.json({ success: true, data: { results: unlocked, balance: wallet?.balance ?? null } })
  } catch (err) { next(err) }
})

// POST /api/discovery/probe
discoveryRouter.post("/probe", async (req, res, next) => {
  try {
    const url = (req.body.url || "").trim()
    if (!url || !url.startsWith("http")) return next(createError("url is required and must start with http", 400, "VALIDATION_ERROR"))
    const testQuery = (req.body.query || "shampoo").toString().trim()
    logger.info("[DiscoveryRoute] probe", { url, testQuery })
    const data = await probeWebsite(url, testQuery)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})
