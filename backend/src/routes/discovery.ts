import { Router } from "express"
import { discoverProducts, confirmMappings, probeWebsite } from "../services/discoveryService"
import { aiWebSearch } from "../scraper/aiWebSearch"
import { callClaude } from "../utils/claudeClient"
import { createError } from "../middleware/validate"
import { checkUsageLimit } from "../middleware/usageLimit"
import { logger } from "../utils/logger"

export const discoveryRouter = Router()

// POST /api/discovery/search
discoveryRouter.post("/search", checkUsageLimit as any, async (req, res, next) => {
  try {
    const companyId = parseInt(req.body.company_id)
    if (!companyId || isNaN(companyId)) return next(createError("company_id is required", 400, "VALIDATION_ERROR"))
    const searchQuery = (req.body.query || "marvis").toString().trim()
    logger.info("[DiscoveryRoute] search", { companyId, searchQuery })
    const data = await discoverProducts(companyId, searchQuery)
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

    // Fetch product catalog from DB
    const { query: dbQuery } = await import("../db")
    const { rows: catalog } = await dbQuery(
      `SELECT id, internal_name, internal_sku, brand FROM products WHERE is_active = true ORDER BY internal_name`
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
