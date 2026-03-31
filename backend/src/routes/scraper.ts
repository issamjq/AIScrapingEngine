import { Router } from "express"
import * as syncService from "../services/syncService"
import { createError } from "../middleware/validate"
import { logger } from "../utils/logger"

export const scraperRouter = Router()

// POST /api/scraper/run-one — scrape single URL synchronously
scraperRouter.post("/run-one", async (req, res, next) => {
  try {
    const urlId = parseInt(req.body.url_id)
    if (!urlId || isNaN(urlId)) return next(createError("url_id is required and must be a number", 400, "VALIDATION_ERROR"))
    logger.info("[ScraperRoute] runOne", { urlId })
    const data = await syncService.runOne(urlId)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// POST /api/scraper/run-company — async, returns immediately
scraperRouter.post("/run-company", async (req, res, next) => {
  try {
    const companyId = parseInt(req.body.company_id)
    if (!companyId || isNaN(companyId)) return next(createError("company_id is required", 400, "VALIDATION_ERROR"))
    logger.info("[ScraperRoute] runCompany", { companyId })
    syncService.runCompany(companyId).catch((err: any) => {
      logger.error("[ScraperRoute] runCompany background error", { companyId, error: err.message })
    })
    res.json({ success: true, message: `Sync started for company ${companyId}. Poll /api/sync-runs for status.` })
  } catch (err) { next(err) }
})

// POST /api/scraper/run-many — async batch by URL IDs
scraperRouter.post("/run-many", async (req, res, next) => {
  try {
    const urlIds = req.body.url_ids
    if (!Array.isArray(urlIds) || urlIds.length === 0) return next(createError("url_ids array is required", 400, "VALIDATION_ERROR"))
    logger.info("[ScraperRoute] runMany", { count: urlIds.length })
    const data = await syncService.startMany(urlIds.map(Number))
    res.json({ success: true, data: { run_id: data.id, total: Number(data.meta?.url_count ?? urlIds.length) } })
  } catch (err) { next(err) }
})

// POST /api/scraper/run-all — async, all active URLs
scraperRouter.post("/run-all", async (req, res, next) => {
  try {
    logger.info("[ScraperRoute] runAll triggered")
    const data = await syncService.startAll()
    res.json({ success: true, data: { run_id: data.id, total: Number(data.meta?.url_count ?? 0) } })
  } catch (err) { next(err) }
})
