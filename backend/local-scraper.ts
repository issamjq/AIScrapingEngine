/**
 * Local Scraper Server — runs on your home PC with residential IP.
 *
 * Render cannot scrape AliExpress (datacenter IP blocked).
 * This server runs locally on your home internet, exposed via Cloudflare Tunnel.
 * Render calls this server to trigger scrapes and get results back.
 *
 * Setup:
 *   1. cd backend && npm run local-scraper
 *   2. cloudflared tunnel --url http://localhost:3099
 *   3. Copy the tunnel URL → set LOCAL_SCRAPER_URL in Render env vars
 */

import "dotenv/config"
import express       from "express"
import { scrapeAlibabaBestSellers }  from "./src/scraper/alibabaBestSellers"
import { scrapeIherbBestSellers }    from "./src/scraper/iherbBestSellers"
import { scrapeBanggoodBestSellers } from "./src/scraper/banggoodBestSellers"
import { logger }    from "./src/utils/logger"

const app  = express()
const PORT = 3099

app.use(express.json())

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "local-scraper", time: new Date().toISOString() })
})

// ─── AliExpress scrape endpoint ───────────────────────────────────────────────
app.post("/scrape-aliexpress", async (req, res) => {
  const category = (req.query.category as string) ?? "All"
  const limit    = parseInt((req.query.limit as string) ?? "100", 10)

  logger.info("[LocalScraper] AliExpress scrape requested", { category, limit })

  try {
    const products = await scrapeAlibabaBestSellers({ category, limit })
    logger.info("[LocalScraper] AliExpress scrape complete", { count: products.length })
    res.json({ products })
  } catch (err: any) {
    logger.error("[LocalScraper] AliExpress scrape failed", { error: err.message })
    res.status(500).json({ error: err.message, products: [] })
  }
})

// ─── iHerb scrape endpoint ────────────────────────────────────────────────────
app.post("/scrape-iherb", async (req, res) => {
  const category = (req.query.category as string) ?? "All"
  const limit    = parseInt((req.query.limit as string) ?? "80", 10)

  logger.info("[LocalScraper] iHerb scrape requested", { category, limit })

  try {
    const products = await scrapeIherbBestSellers({ category, limit })
    logger.info("[LocalScraper] iHerb scrape complete", { count: products.length })
    res.json({ products })
  } catch (err: any) {
    logger.error("[LocalScraper] iHerb scrape failed", { error: err.message })
    res.status(500).json({ error: err.message, products: [] })
  }
})

// ─── Banggood scrape endpoint ─────────────────────────────────────────────────
app.post("/scrape-banggood", async (req, res) => {
  const category = (req.query.category as string) ?? "All"
  const limit    = parseInt((req.query.limit as string) ?? "70", 10)

  logger.info("[LocalScraper] Banggood scrape requested", { category, limit })

  try {
    const products = await scrapeBanggoodBestSellers({ category, limit })
    logger.info("[LocalScraper] Banggood scrape complete", { count: products.length })
    res.json({ products })
  } catch (err: any) {
    logger.error("[LocalScraper] Banggood scrape failed", { error: err.message })
    res.status(500).json({ error: err.message, products: [] })
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Local scraper running at http://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/health`)
  console.log(`\n📡 Now run in a separate terminal:`)
  console.log(`   cloudflared tunnel --url http://localhost:${PORT}`)
  console.log(`\n   Copy the https://xxxx.trycloudflare.com URL`)
  console.log(`   Set it as LOCAL_SCRAPER_URL in Render env vars\n`)
})
