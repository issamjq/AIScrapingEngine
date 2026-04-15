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
  getDataFreshness,
} from "../services/creatorIntelService"
import { logger } from "../utils/logger"

export const creatorIntelRouter = Router()

const ADMIN_ROLES = ["dev", "owner"]

const apiKey = () => process.env.ANTHROPIC_API_KEY ?? ""

async function isAdmin(email: string): Promise<boolean> {
  const { rows } = await dbQuery(
    `SELECT role FROM allowed_users WHERE email = $1 LIMIT 1`, [email]
  )
  return rows[0] && ADMIN_ROLES.includes(rows[0].role)
}

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

  try {
    const { category = "All", marketplace = "US", limit = 20 } = req.body
    const key = apiKey()
    if (!key) return res.status(500).json({ success: false, error: "ANTHROPIC_API_KEY not set" })

    logger.info("[CreatorIntel] Amazon scrape triggered", { category, marketplace, limit, by: req.email })
    const result = await runAmazonScrape({ category, marketplace, limit, apiKey: key })
    res.json({ success: true, ...result })
  } catch (err: any) {
    logger.error("[CreatorIntel] POST /scrape-amazon", { error: err.message })
    res.status(500).json({ success: false, error: err.message })
  }
})
