import { Router, Response }  from "express"
import { AuthRequest }        from "../middleware/auth"
import { query as dbQuery }   from "../db"
import {
  runTikTokScrape,
  getTikTokTrending,
  getTikTokCategories,
  runAmazonScrape,
  getAmazonTrending,
  getAmazonRankHistory,
  runEbayScrape,
  getEbayTrending,
  getEbayRankHistory,
  runIherbScrape,
  getIherbTrending,
  getIherbRankHistory,
  runTescoScrape,
  getTescoTrending,
  getTescoRankHistory,
  runAlibabaScrape,
  getAlibabaTrending,
  getAlibabaRankHistory,
  runSheinScrape,
  getSheinTrending,
  getSheinRankHistory,
  runEtsyScrape,
  getEtsyTrending,
  getEtsyRankHistory,
  runBanggoodScrape,
  getBanggoodTrending,
  getBanggoodRankHistory,
  runLazadaScrape,
  getLazadaTrending,
  getLazadaRankHistory,
  getDataFreshness,
} from "../services/creatorIntelService"
import { logger } from "../utils/logger"
import { logActivity, getClientIp } from "../services/activityLogger"

export const creatorIntelRouter = Router()

const ADMIN_ROLES = ["dev", "owner"]

const apiKey = () => process.env.ANTHROPIC_API_KEY ?? ""

async function isAdmin(email: string): Promise<boolean> {
  const { rows } = await dbQuery(
    `SELECT role FROM allowed_users WHERE email = $1 LIMIT 1`, [email]
  )
  return rows[0] && ADMIN_ROLES.includes(rows[0].role)
}

// ── In-memory job tracker for long-running scrapes ───────────────────────────
type JobStatus = { status: "running" | "done" | "error"; inserted?: number; error?: string; startedAt: number }
const scrapeJobs = new Map<string, JobStatus>()

function startJob(): string {
  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  scrapeJobs.set(jobId, { status: "running", startedAt: Date.now() })
  // Clean up jobs older than 1 hour
  for (const [id, job] of scrapeJobs) {
    if (Date.now() - job.startedAt > 3_600_000) scrapeJobs.delete(id)
  }
  return jobId
}

// ── GET /api/creator-intel/job-status/:jobId ─────────────────────────────────
creatorIntelRouter.get("/job-status/:jobId", (req: AuthRequest, res: Response) => {
  const job = scrapeJobs.get(req.params.jobId)
  if (!job) return res.json({ status: "not_found" })
  res.json(job)
})

// ── GET /api/creator-intel/trending ─────────────────────────────────────────
creatorIntelRouter.get("/trending", async (req: AuthRequest, res: Response) => {
  try {
    const category = String(req.query.category ?? "All")
    const limit    = Math.min(Number(req.query.limit ?? 50), 100)
    const offset   = Number(req.query.offset ?? 0)
    const sortBy   = String(req.query.sortBy ?? "gmv_7d") as any
    const days     = req.query.days ? Number(req.query.days) : undefined

    const products = await getTikTokTrending({ category, limit, offset, sortBy, days })
    res.json({ success: true, data: products, count: products.length })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /trending", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch trending products" })
  }
})

// ── GET /api/creator-intel/categories ────────────────────────────────────────
creatorIntelRouter.get("/categories", async (_req: AuthRequest, res: Response) => {
  try {
    const categories = await getTikTokCategories()
    res.json({ success: true, data: categories })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /categories", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch categories" })
  }
})

// ── GET /api/creator-intel/amazon-trending ───────────────────────────────────
creatorIntelRouter.get("/amazon-trending", async (req: AuthRequest, res: Response) => {
  try {
    const category    = String(req.query.category ?? "All")
    const marketplace = "US"
    const limit       = Math.min(Number(req.query.limit ?? 50), 100)
    const offset      = Number(req.query.offset ?? 0)

    const products = await getAmazonTrending({ category, marketplace, limit, offset })
    res.json({ success: true, data: products, count: products.length })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /amazon-trending", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch Amazon trending" })
  }
})

// ── GET /api/creator-intel/amazon-history ────────────────────────────────────
creatorIntelRouter.get("/amazon-history", async (req: AuthRequest, res: Response) => {
  try {
    const marketplace = String(req.query.marketplace ?? "US")
    const history = await getAmazonRankHistory(marketplace)
    res.json({ success: true, data: history })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /amazon-history", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch rank history" })
  }
})

// ── GET /api/creator-intel/freshness ─────────────────────────────────────────
creatorIntelRouter.get("/freshness", async (_req: AuthRequest, res: Response) => {
  try {
    const freshness = await getDataFreshness()
    res.json({ success: true, data: freshness })
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Failed to fetch freshness" })
  }
})

// ── POST /api/creator-intel/scrape-tiktok ───────────────────────────────────
creatorIntelRouter.post("/scrape-tiktok", async (req: AuthRequest, res: Response) => {
  const admin = await isAdmin(req.email!).catch(() => false)
  if (!admin) return res.status(403).json({ success: false, error: "Forbidden" })

  try {
    const { category = "All", limit = 20 } = req.body
    const key = apiKey()
    if (!key) return res.status(500).json({ success: false, error: "ANTHROPIC_API_KEY not set" })

    logger.info("[CreatorIntel] TikTok scrape triggered", { category, limit, by: req.email })
    const result = await runTikTokScrape({ category, limit, apiKey: key })
    logActivity({ user_email: req.email!, action: "scrape_tiktok", details: { category, limit, inserted: (result as any).inserted }, ip: getClientIp(req) })
    res.json({ success: true, ...result })
  } catch (err: any) {
    logger.error("[CreatorIntel] POST /scrape-tiktok", { error: err.message })
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── POST /api/creator-intel/scrape-amazon ───────────────────────────────────
creatorIntelRouter.post("/scrape-amazon", async (req: AuthRequest, res: Response) => {
  const admin = await isAdmin(req.email!).catch(() => false)
  if (!admin) return res.status(403).json({ success: false, error: "Forbidden" })

  const key = apiKey()
  if (!key) return res.status(500).json({ success: false, error: "ANTHROPIC_API_KEY not set" })

  const { category = "All", marketplace = "US", limit = 20 } = req.body
  const jobId = startJob()
  logger.info("[CreatorIntel] Amazon scrape triggered (async)", { category, marketplace, limit, by: req.email, jobId })
  logActivity({ user_email: req.email!, action: "scrape_amazon", details: { category, marketplace, limit, jobId }, ip: getClientIp(req) })
  res.status(202).json({ success: true, status: "started", jobId })

  runAmazonScrape({ category, marketplace, limit, apiKey: key })
    .then(result => scrapeJobs.set(jobId, { status: "done", inserted: result.inserted, startedAt: scrapeJobs.get(jobId)!.startedAt }))
    .catch(err  => { scrapeJobs.set(jobId, { status: "error", error: err.message, startedAt: scrapeJobs.get(jobId)!.startedAt }); logger.error("[CreatorIntel] Amazon scrape failed", { error: err.message }) })
})

// ── GET /api/creator-intel/ebay-trending ─────────────────────────────────────
creatorIntelRouter.get("/ebay-trending", async (req: AuthRequest, res: Response) => {
  try {
    const category = String(req.query.category ?? "All")
    const limit    = Math.min(Number(req.query.limit ?? 50), 100)
    const offset   = Number(req.query.offset ?? 0)

    const products = await getEbayTrending({ category, limit, offset })
    res.json({ success: true, data: products, count: products.length })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /ebay-trending", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch eBay trending" })
  }
})

// ── GET /api/creator-intel/ebay-history ──────────────────────────────────────
creatorIntelRouter.get("/ebay-history", async (_req: AuthRequest, res: Response) => {
  try {
    const history = await getEbayRankHistory()
    res.json({ success: true, data: history })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /ebay-history", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch eBay rank history" })
  }
})

// ── POST /api/creator-intel/scrape-ebay ──────────────────────────────────────
creatorIntelRouter.post("/scrape-ebay", async (req: AuthRequest, res: Response) => {
  const admin = await isAdmin(req.email!).catch(() => false)
  if (!admin) return res.status(403).json({ success: false, error: "Forbidden" })

  const { category = "All", limit = 100 } = req.body
  const jobId = startJob()
  logger.info("[CreatorIntel] eBay scrape triggered (async)", { category, limit, by: req.email, jobId })
  logActivity({ user_email: req.email!, action: "scrape_ebay", details: { category, limit, jobId }, ip: getClientIp(req) })
  res.status(202).json({ success: true, status: "started", jobId })

  runEbayScrape({ category, limit })
    .then(result => scrapeJobs.set(jobId, { status: "done", inserted: result.inserted, startedAt: scrapeJobs.get(jobId)!.startedAt }))
    .catch(err  => { scrapeJobs.set(jobId, { status: "error", error: err.message, startedAt: scrapeJobs.get(jobId)!.startedAt }); logger.error("[CreatorIntel] eBay scrape failed", { error: err.message }) })
})

// ── GET /api/creator-intel/iherb-trending ────────────────────────────────────
creatorIntelRouter.get("/iherb-trending", async (req: AuthRequest, res: Response) => {
  try {
    const category = String(req.query.category ?? "All")
    const limit    = Math.min(Number(req.query.limit ?? 50), 100)
    const offset   = Number(req.query.offset ?? 0)
    const products = await getIherbTrending({ category, limit, offset })
    res.json({ success: true, data: products, count: products.length })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /iherb-trending", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch iHerb trending" })
  }
})

// ── GET /api/creator-intel/iherb-history ─────────────────────────────────────
creatorIntelRouter.get("/iherb-history", async (_req: AuthRequest, res: Response) => {
  try {
    const history = await getIherbRankHistory()
    res.json({ success: true, data: history })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /iherb-history", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch iHerb rank history" })
  }
})

// ── POST /api/creator-intel/scrape-iherb ─────────────────────────────────────
creatorIntelRouter.post("/scrape-iherb", async (req: AuthRequest, res: Response) => {
  const admin = await isAdmin(req.email!).catch(() => false)
  if (!admin) return res.status(403).json({ success: false, error: "Forbidden" })

  const { category = "All", limit = 100 } = req.body
  const jobId = startJob()
  logger.info("[CreatorIntel] iHerb scrape triggered (async)", { category, limit, by: req.email, jobId })
  res.status(202).json({ success: true, status: "started", jobId })

  runIherbScrape({ category, limit })
    .then(result => scrapeJobs.set(jobId, { status: "done", inserted: result.inserted, startedAt: scrapeJobs.get(jobId)!.startedAt }))
    .catch(err  => { scrapeJobs.set(jobId, { status: "error", error: err.message, startedAt: scrapeJobs.get(jobId)!.startedAt }); logger.error("[CreatorIntel] iHerb scrape failed", { error: err.message }) })
})

// ── GET /api/creator-intel/tesco-trending ────────────────────────────────────
creatorIntelRouter.get("/tesco-trending", async (req: AuthRequest, res: Response) => {
  try {
    const category = String(req.query.category ?? "All")
    const limit    = Math.min(Number(req.query.limit ?? 50), 100)
    const offset   = Number(req.query.offset ?? 0)
    const products = await getTescoTrending({ category, limit, offset })
    res.json({ success: true, data: products, count: products.length })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /tesco-trending", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch Tesco trending" })
  }
})

// ── GET /api/creator-intel/tesco-history ─────────────────────────────────────
creatorIntelRouter.get("/tesco-history", async (_req: AuthRequest, res: Response) => {
  try {
    const history = await getTescoRankHistory()
    res.json({ success: true, data: history })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /tesco-history", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch Tesco rank history" })
  }
})

// ── POST /api/creator-intel/scrape-tesco ─────────────────────────────────────
creatorIntelRouter.post("/scrape-tesco", async (req: AuthRequest, res: Response) => {
  const admin = await isAdmin(req.email!).catch(() => false)
  if (!admin) return res.status(403).json({ success: false, error: "Forbidden" })

  try {
    const { category = "All", limit = 100 } = req.body
    logger.info("[CreatorIntel] Tesco scrape triggered", { category, limit, by: req.email })
    const result = await runTescoScrape({ category, limit })
    res.json({ success: true, ...result })
  } catch (err: any) {
    logger.error("[CreatorIntel] POST /scrape-tesco", { error: err.message })
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── GET /api/creator-intel/alibaba-trending ──────────────────────────────────
creatorIntelRouter.get("/alibaba-trending", async (req: AuthRequest, res: Response) => {
  try {
    const category = String(req.query.category ?? "All")
    const limit    = Math.min(Number(req.query.limit ?? 50), 100)
    const offset   = Number(req.query.offset ?? 0)
    const products = await getAlibabaTrending({ category, limit, offset })
    res.json({ success: true, data: products, count: products.length })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /alibaba-trending", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch Alibaba trending" })
  }
})

// ── GET /api/creator-intel/alibaba-history ───────────────────────────────────
creatorIntelRouter.get("/alibaba-history", async (_req: AuthRequest, res: Response) => {
  try {
    const history = await getAlibabaRankHistory()
    res.json({ success: true, data: history })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /alibaba-history", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch Alibaba rank history" })
  }
})

// ── POST /api/creator-intel/scrape-alibaba ───────────────────────────────────
creatorIntelRouter.post("/scrape-alibaba", async (req: AuthRequest, res: Response) => {
  const admin = await isAdmin(req.email!).catch(() => false)
  if (!admin) return res.status(403).json({ success: false, error: "Forbidden" })

  const { category = "All", limit = 100 } = req.body
  const jobId = startJob()
  logger.info("[CreatorIntel] Alibaba scrape triggered (async)", { category, limit, by: req.email, jobId })
  logActivity({ user_email: req.email!, action: "scrape_aliexpress", details: { category, limit, jobId }, ip: getClientIp(req) })
  res.status(202).json({ success: true, status: "started", jobId })

  runAlibabaScrape({ category, limit })
    .then(result => scrapeJobs.set(jobId, { status: "done", inserted: result.inserted, startedAt: scrapeJobs.get(jobId)!.startedAt }))
    .catch(err  => { scrapeJobs.set(jobId, { status: "error", error: err.message, startedAt: scrapeJobs.get(jobId)!.startedAt }); logger.error("[CreatorIntel] Alibaba scrape failed", { error: err.message }) })
})

// ── Shein ─────────────────────────────────────────────────────────────────────

creatorIntelRouter.get("/shein-trending", async (req: AuthRequest, res: Response) => {
  try {
    const category = String(req.query.category ?? "All")
    const limit    = Math.min(Number(req.query.limit ?? 50), 100)
    const offset   = Number(req.query.offset ?? 0)
    const products = await getSheinTrending({ category, limit, offset })
    res.json({ success: true, data: products, count: products.length })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /shein-trending", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch Shein trending" })
  }
})

creatorIntelRouter.get("/shein-history", async (_req: AuthRequest, res: Response) => {
  try {
    const history = await getSheinRankHistory()
    res.json({ success: true, data: history })
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Failed to fetch Shein rank history" })
  }
})

creatorIntelRouter.post("/scrape-shein", async (req: AuthRequest, res: Response) => {
  const admin = await isAdmin(req.email!).catch(() => false)
  if (!admin) return res.status(403).json({ success: false, error: "Forbidden" })
  try {
    const { category = "All", limit = 100 } = req.body
    logger.info("[CreatorIntel] Shein scrape triggered", { category, limit, by: req.email })
    const result = await runSheinScrape({ category, limit })
    res.json({ success: true, ...result })
  } catch (err: any) {
    logger.error("[CreatorIntel] POST /scrape-shein", { error: err.message })
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Etsy ──────────────────────────────────────────────────────────────────────

creatorIntelRouter.get("/etsy-trending", async (req: AuthRequest, res: Response) => {
  try {
    const category = String(req.query.category ?? "All")
    const limit    = Math.min(Number(req.query.limit ?? 50), 100)
    const offset   = Number(req.query.offset ?? 0)
    const products = await getEtsyTrending({ category, limit, offset })
    res.json({ success: true, data: products, count: products.length })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /etsy-trending", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch Etsy trending" })
  }
})

creatorIntelRouter.get("/etsy-history", async (_req: AuthRequest, res: Response) => {
  try {
    const history = await getEtsyRankHistory()
    res.json({ success: true, data: history })
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Failed to fetch Etsy rank history" })
  }
})

creatorIntelRouter.post("/scrape-etsy", async (req: AuthRequest, res: Response) => {
  const admin = await isAdmin(req.email!).catch(() => false)
  if (!admin) return res.status(403).json({ success: false, error: "Forbidden" })
  try {
    const { category = "All", limit = 100 } = req.body
    logger.info("[CreatorIntel] Etsy scrape triggered", { category, limit, by: req.email })
    const result = await runEtsyScrape({ category, limit })
    res.json({ success: true, ...result })
  } catch (err: any) {
    logger.error("[CreatorIntel] POST /scrape-etsy", { error: err.message })
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Banggood ──────────────────────────────────────────────────────────────────

creatorIntelRouter.get("/banggood-trending", async (req: AuthRequest, res: Response) => {
  try {
    const category = String(req.query.category ?? "All")
    const limit    = Math.min(Number(req.query.limit ?? 50), 100)
    const offset   = Number(req.query.offset ?? 0)
    const products = await getBanggoodTrending({ category, limit, offset })
    res.json({ success: true, data: products, count: products.length })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /banggood-trending", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch Banggood trending" })
  }
})

creatorIntelRouter.get("/banggood-history", async (_req: AuthRequest, res: Response) => {
  try {
    const history = await getBanggoodRankHistory()
    res.json({ success: true, data: history })
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Failed to fetch Banggood rank history" })
  }
})

creatorIntelRouter.post("/scrape-banggood", async (req: AuthRequest, res: Response) => {
  const admin = await isAdmin(req.email!).catch(() => false)
  if (!admin) return res.status(403).json({ success: false, error: "Forbidden" })

  const { category = "All", limit = 100 } = req.body
  const jobId = startJob()
  logger.info("[CreatorIntel] Banggood scrape triggered (async)", { category, limit, by: req.email, jobId })
  res.status(202).json({ success: true, status: "started", jobId })

  runBanggoodScrape({ category, limit })
    .then(result => scrapeJobs.set(jobId, { status: "done", inserted: result.inserted, startedAt: scrapeJobs.get(jobId)!.startedAt }))
    .catch(err  => { scrapeJobs.set(jobId, { status: "error", error: err.message, startedAt: scrapeJobs.get(jobId)!.startedAt }); logger.error("[CreatorIntel] Banggood scrape failed", { error: err.message }) })
})

// ── Lazada ────────────────────────────────────────────────────────────────────

creatorIntelRouter.get("/lazada-trending", async (req: AuthRequest, res: Response) => {
  try {
    const category = String(req.query.category ?? "All")
    const limit    = Math.min(Number(req.query.limit ?? 50), 100)
    const offset   = Number(req.query.offset ?? 0)
    const products = await getLazadaTrending({ category, limit, offset })
    res.json({ success: true, data: products, count: products.length })
  } catch (err: any) {
    logger.error("[CreatorIntel] GET /lazada-trending", { error: err.message })
    res.status(500).json({ success: false, error: "Failed to fetch Lazada trending" })
  }
})

creatorIntelRouter.get("/lazada-history", async (_req: AuthRequest, res: Response) => {
  try {
    const history = await getLazadaRankHistory()
    res.json({ success: true, data: history })
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Failed to fetch Lazada rank history" })
  }
})

creatorIntelRouter.post("/scrape-lazada", async (req: AuthRequest, res: Response) => {
  const admin = await isAdmin(req.email!).catch(() => false)
  if (!admin) return res.status(403).json({ success: false, error: "Forbidden" })
  try {
    const { category = "All", limit = 100 } = req.body
    logger.info("[CreatorIntel] Lazada scrape triggered", { category, limit, by: req.email })
    const result = await runLazadaScrape({ category, limit })
    res.json({ success: true, ...result })
  } catch (err: any) {
    logger.error("[CreatorIntel] POST /scrape-lazada", { error: err.message })
    res.status(500).json({ success: false, error: err.message })
  }
})
