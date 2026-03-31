import { Router } from "express"
import { discoverProducts, confirmMappings, probeWebsite } from "../services/discoveryService"
import { createError } from "../middleware/validate"
import { logger } from "../utils/logger"

export const discoveryRouter = Router()

// POST /api/discovery/search
discoveryRouter.post("/search", async (req, res, next) => {
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
