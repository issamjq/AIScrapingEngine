/**
 * Creator Intelligence service.
 *
 * Orchestrates TikTok + Amazon scrapers, persists results to DB,
 * and provides query functions for the API routes.
 *
 * Scrape runs are on-demand (POST /scrape-tiktok / /scrape-amazon).
 * GET endpoints read from cache — no live scraping per user request.
 */

import { query }                    from "../db"
import { scrapeTikTokTrending,
         TikTokProduct }            from "../scraper/tiktokScraper"
import { scrapeApifyTikTok }        from "../scraper/apifyTikTokScraper"
import { scrapeAmazonBestSellers,
         AmazonProduct }            from "../scraper/amazonBestSellers"
import { scrapeEbayBestSellers }    from "../scraper/ebayBestSellers"
import { scrapeIherbBestSellers }   from "../scraper/iherbBestSellers"
import { scrapeTescoBestSellers }    from "../scraper/tescoBestSellers"
import { scrapeAlibabaBestSellers } from "../scraper/alibabaBestSellers"
import { logger }                   from "../utils/logger"

// ─── TikTok ──────────────────────────────────────────────────────────────────

export async function runTikTokScrape(opts: {
  category?:      string
  limit?:         number
  apiKey:         string
  apifyToken?:    string
  searchQueries?: string[]
}): Promise<{ inserted: number; source: string }> {
  const apifyToken = opts.apifyToken ?? process.env.APIFY_API_KEY

  let products: TikTokProduct[]
  let source: string

  if (apifyToken) {
    logger.info("[CreatorIntel] Using Apify scraper")
    products = await scrapeApifyTikTok({
      apifyToken,
      claudeApiKey:    opts.apiKey,
      searchQueries:   opts.searchQueries,
      videosPerQuery:  50,
      limit:           opts.limit ?? 20,
    })
    source = "apify"
  } else {
    logger.info("[CreatorIntel] Using Claude web_search scraper (no APIFY_API_KEY set)")
    products = await scrapeTikTokTrending(opts)
    source = "claude_websearch"
  }
  if (products.length === 0) return { inserted: 0, source }

  const category = opts.category ?? "All"

  // Just insert — keep all historical rows so date filters work over time.
  let inserted = 0
  for (const p of products) {
    try {
      await query(
        `INSERT INTO tiktok_products
           (product_name, category, tiktok_price, gmv_7d, units_sold_7d,
            growth_pct, video_count, top_creator_handle, shop_name, image_url, scraped_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW())`,
        [
          p.product_name, p.category, p.tiktok_price, p.gmv_7d, p.units_sold_7d,
          p.growth_pct, p.video_count, p.top_creator_handle, p.shop_name, p.image_url,
        ]
      )
      inserted++
    } catch (err: any) {
      logger.warn("[CreatorIntel] TikTok upsert skip", { name: p.product_name, error: err.message })
    }
  }

  logger.info("[CreatorIntel] TikTok scrape done", { category, inserted, source })
  return { inserted, source }
}

export async function getTikTokTrending(opts: {
  category?: string
  limit?:    number
  offset?:   number
  sortBy?:   "gmv_7d" | "units_sold_7d" | "growth_pct"
  days?:     number   // 7 | 30 | 90 — filter by scraped_at range
} = {}): Promise<TikTokProduct[]> {
  const { category, limit = 50, offset = 0, sortBy = "gmv_7d", days } = opts

  const allowedSort = new Set(["gmv_7d", "units_sold_7d", "growth_pct"])
  const sort = allowedSort.has(sortBy) ? sortBy : "gmv_7d"

  const conditions: string[] = []
  const params: any[] = []

  if (category && category !== "All") {
    params.push(category)
    conditions.push(`category = $${params.length}`)
  }
  if (days && days > 0) {
    params.push(days)
    conditions.push(`scraped_at >= NOW() - ($${params.length} || ' days')::INTERVAL`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  // Deduplicate: for same product_name in the time window, keep the row with highest gmv_7d
  const res = await query(
    `SELECT DISTINCT ON (product_name)
            product_name, category, tiktok_price, gmv_7d, units_sold_7d,
            growth_pct, video_count, top_creator_handle, shop_name, image_url, scraped_at
     FROM tiktok_products
     ${where}
     ORDER BY product_name, ${sort} DESC NULLS LAST, scraped_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  )
  return res.rows
}

export async function getTikTokCategories(): Promise<{ category: string; total_gmv: number; product_count: number }[]> {
  const res = await query(
    `SELECT category,
            COALESCE(SUM(gmv_7d), 0)::FLOAT  AS total_gmv,
            COUNT(*)::INT                      AS product_count
     FROM tiktok_products
     WHERE category IS NOT NULL
     GROUP BY category
     ORDER BY total_gmv DESC
     LIMIT 20`
  )
  return res.rows
}

// ─── Amazon ──────────────────────────────────────────────────────────────────

export async function runAmazonScrape(opts: {
  category?:    string
  marketplace?: string
  limit?:       number
  apiKey?:      string
}): Promise<{ inserted: number }> {
  const products = await scrapeAmazonBestSellers({ category: opts.category, limit: opts.limit })
  if (products.length === 0) return { inserted: 0 }

  // Always INSERT a fresh snapshot — no upsert. This accumulates history so
  // the sparkline can show real rank-over-time data.
  let inserted = 0
  for (const p of products) {
    try {
      await query(
        `INSERT INTO amazon_trending
           (asin, product_name, category, rank, price, rating, review_count,
            image_url, product_url, badge, brand, marketplace, scraped_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW())`,
        [p.asin, p.product_name, p.category, p.rank, p.price, p.rating,
         p.review_count, p.image_url, (p as any).product_url,
         (p as any).badge, (p as any).brand, p.marketplace]
      )
      inserted++
    } catch (err: any) {
      logger.warn("[CreatorIntel] Amazon insert skip", { asin: p.asin, error: err.message })
    }
  }

  logger.info("[CreatorIntel] Amazon scrape done", { inserted })
  return { inserted }
}

export async function getAmazonTrending(opts: {
  category?:    string
  marketplace?: string
  limit?:       number
  offset?:      number
} = {}): Promise<AmazonProduct[]> {
  const { category, marketplace = "US", limit = 50, offset = 0 } = opts

  // Deduplicate: for each asin keep the most recent snapshot, then sort by rank
  if (category && category !== "All") {
    const res = await query(
      `SELECT asin, product_name, category, rank, price, rating, review_count,
              image_url, product_url, badge, brand, marketplace, scraped_at
       FROM (
         SELECT DISTINCT ON (COALESCE(asin, product_name))
                asin, product_name, category, rank, price, rating, review_count,
                image_url, product_url, badge, brand, marketplace, scraped_at
         FROM amazon_trending
         WHERE marketplace = $1 AND category = $2
         ORDER BY COALESCE(asin, product_name), scraped_at DESC
       ) latest
       ORDER BY rank ASC NULLS LAST
       LIMIT $3 OFFSET $4`,
      [marketplace, category, limit, offset]
    )
    return res.rows
  }

  const res = await query(
    `SELECT asin, product_name, category, rank, price, rating, review_count,
            image_url, product_url, badge, brand, marketplace, scraped_at
     FROM (
       SELECT DISTINCT ON (COALESCE(asin, product_name))
              asin, product_name, category, rank, price, rating, review_count,
              image_url, product_url, badge, brand, marketplace, scraped_at
       FROM amazon_trending
       WHERE marketplace = $1
       ORDER BY COALESCE(asin, product_name), scraped_at DESC
     ) latest
     ORDER BY rank ASC NULLS LAST
     LIMIT $2 OFFSET $3`,
    [marketplace, limit, offset]
  )
  return res.rows
}

// Returns all historical rank snapshots grouped by ASIN — used for sparklines.
// Only returns ASINs with at least 2 data points (need history to draw a line).
export async function getAmazonRankHistory(marketplace = "US"): Promise<
  Record<string, { rank: number; date: string }[]>
> {
  const res = await query(
    `SELECT asin, rank, scraped_at
     FROM amazon_trending
     WHERE marketplace = $1 AND asin IS NOT NULL AND rank IS NOT NULL
     ORDER BY asin, scraped_at ASC`,
    [marketplace]
  )

  const history: Record<string, { rank: number; date: string }[]> = {}
  for (const row of res.rows) {
    if (!history[row.asin]) history[row.asin] = []
    history[row.asin].push({ rank: Number(row.rank), date: row.scraped_at })
  }

  // Only keep ASINs with >= 2 snapshots — single point can't draw a line
  for (const asin of Object.keys(history)) {
    if (history[asin].length < 2) delete history[asin]
  }

  return history
}

// ─── eBay ─────────────────────────────────────────────────────────────────────
// eBay data reuses the amazon_trending table with marketplace = "eBay".
// Same INSERT / DISTINCT ON / rank history pattern as Amazon.

export async function runEbayScrape(opts: {
  category?: string
  limit?:    number
}): Promise<{ inserted: number }> {
  const appId = process.env.EBAY_APP_ID
  if (!appId) {
    logger.warn("[CreatorIntel] EBAY_APP_ID not set — skipping eBay scrape")
    return { inserted: 0 }
  }

  const products = await scrapeEbayBestSellers({ category: opts.category, limit: opts.limit, appId })
  if (products.length === 0) return { inserted: 0 }

  let inserted = 0
  for (const p of products) {
    try {
      await query(
        `INSERT INTO amazon_trending
           (asin, product_name, category, rank, price, rating, review_count,
            image_url, product_url, badge, brand, marketplace, scraped_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW())`,
        [p.asin, p.product_name, p.category, p.rank, p.price, p.rating,
         p.review_count, p.image_url, p.product_url, p.badge, p.brand, "eBay"]
      )
      inserted++
    } catch (err: any) {
      logger.warn("[CreatorIntel] eBay insert skip", { asin: p.asin, error: err.message })
    }
  }

  logger.info("[CreatorIntel] eBay scrape done", { inserted })
  return { inserted }
}

export async function getEbayTrending(opts: {
  category?: string
  limit?:    number
  offset?:   number
} = {}): Promise<AmazonProduct[]> {
  const { category, limit = 50, offset = 0 } = opts

  if (category && category !== "All") {
    const res = await query(
      `SELECT asin, product_name, category, rank, price, rating, review_count,
              image_url, product_url, badge, brand, marketplace, scraped_at
       FROM (
         SELECT DISTINCT ON (COALESCE(asin, product_name))
                asin, product_name, category, rank, price, rating, review_count,
                image_url, product_url, badge, brand, marketplace, scraped_at
         FROM amazon_trending
         WHERE marketplace = 'eBay' AND category = $1
         ORDER BY COALESCE(asin, product_name), scraped_at DESC
       ) latest
       ORDER BY rank ASC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [category, limit, offset]
    )
    return res.rows
  }

  const res = await query(
    `SELECT asin, product_name, category, rank, price, rating, review_count,
            image_url, product_url, badge, brand, marketplace, scraped_at
     FROM (
       SELECT DISTINCT ON (COALESCE(asin, product_name))
              asin, product_name, category, rank, price, rating, review_count,
              image_url, product_url, badge, brand, marketplace, scraped_at
       FROM amazon_trending
       WHERE marketplace = 'eBay'
       ORDER BY COALESCE(asin, product_name), scraped_at DESC
     ) latest
     ORDER BY rank ASC NULLS LAST
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )
  return res.rows
}

export async function getEbayRankHistory(): Promise<
  Record<string, { rank: number; date: string }[]>
> {
  const res = await query(
    `SELECT asin, rank, scraped_at
     FROM amazon_trending
     WHERE marketplace = 'eBay' AND asin IS NOT NULL AND rank IS NOT NULL
     ORDER BY asin, scraped_at ASC`
  )

  const history: Record<string, { rank: number; date: string }[]> = {}
  for (const row of res.rows) {
    if (!history[row.asin]) history[row.asin] = []
    history[row.asin].push({ rank: Number(row.rank), date: row.scraped_at })
  }
  for (const asin of Object.keys(history)) {
    if (history[asin].length < 2) delete history[asin]
  }
  return history
}

// ─── Freshness check ─────────────────────────────────────────────────────────

export async function getDataFreshness(): Promise<{
  tiktok_last_scraped:  string | null
  amazon_last_scraped:  string | null
  tiktok_product_count: number
  amazon_product_count: number
}> {
  const [tk, am] = await Promise.all([
    query(`SELECT MAX(scraped_at) AS last_scraped, COUNT(*)::INT AS cnt FROM tiktok_products`),
    query(`SELECT MAX(scraped_at) AS last_scraped, COUNT(*)::INT AS cnt FROM amazon_trending`),
  ])

  return {
    tiktok_last_scraped:  tk.rows[0]?.last_scraped ?? null,
    amazon_last_scraped:  am.rows[0]?.last_scraped ?? null,
    tiktok_product_count: tk.rows[0]?.cnt ?? 0,
    amazon_product_count: am.rows[0]?.cnt ?? 0,
  }
}

// ─── iHerb ────────────────────────────────────────────────────────────────────
// iHerb data reuses amazon_trending table with marketplace = "iHerb".

export async function runIherbScrape(opts: {
  category?: string
  limit?:    number
}): Promise<{ inserted: number }> {
  const products = await scrapeIherbBestSellers({ category: opts.category, limit: opts.limit })
  if (products.length === 0) return { inserted: 0 }

  let inserted = 0
  for (const p of products) {
    try {
      await query(
        `INSERT INTO amazon_trending
           (asin, product_name, category, rank, price, rating, review_count,
            image_url, product_url, badge, brand, marketplace, scraped_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW())`,
        [p.asin, p.product_name, p.category, p.rank, p.price, p.rating,
         p.review_count, p.image_url, p.product_url, p.badge, p.brand, "iHerb"]
      )
      inserted++
    } catch (err: any) {
      logger.warn("[CreatorIntel] iHerb insert skip", { asin: p.asin, error: err.message })
    }
  }

  logger.info("[CreatorIntel] iHerb scrape done", { inserted })
  return { inserted }
}

export async function getIherbTrending(opts: {
  category?: string
  limit?:    number
  offset?:   number
} = {}): Promise<AmazonProduct[]> {
  const { category, limit = 50, offset = 0 } = opts

  if (category && category !== "All") {
    const res = await query(
      `SELECT asin, product_name, category, rank, price, rating, review_count,
              image_url, product_url, badge, brand, marketplace, scraped_at
       FROM (
         SELECT DISTINCT ON (COALESCE(asin, product_name))
                asin, product_name, category, rank, price, rating, review_count,
                image_url, product_url, badge, brand, marketplace, scraped_at
         FROM amazon_trending
         WHERE marketplace = 'iHerb' AND category = $1
         ORDER BY COALESCE(asin, product_name), scraped_at DESC
       ) latest
       ORDER BY rank ASC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [category, limit, offset]
    )
    return res.rows
  }

  const res = await query(
    `SELECT asin, product_name, category, rank, price, rating, review_count,
            image_url, product_url, badge, brand, marketplace, scraped_at
     FROM (
       SELECT DISTINCT ON (COALESCE(asin, product_name))
              asin, product_name, category, rank, price, rating, review_count,
              image_url, product_url, badge, brand, marketplace, scraped_at
       FROM amazon_trending
       WHERE marketplace = 'iHerb'
       ORDER BY COALESCE(asin, product_name), scraped_at DESC
     ) latest
     ORDER BY rank ASC NULLS LAST
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )
  return res.rows
}

export async function getIherbRankHistory(): Promise<
  Record<string, { rank: number; date: string }[]>
> {
  const res = await query(
    `SELECT asin, rank, scraped_at
     FROM amazon_trending
     WHERE marketplace = 'iHerb' AND asin IS NOT NULL AND rank IS NOT NULL
     ORDER BY asin, scraped_at ASC`
  )
  const history: Record<string, { rank: number; date: string }[]> = {}
  for (const row of res.rows) {
    if (!history[row.asin]) history[row.asin] = []
    history[row.asin].push({ rank: Number(row.rank), date: row.scraped_at })
  }
  for (const k of Object.keys(history)) {
    if (history[k].length < 2) delete history[k]
  }
  return history
}

// ─── Tesco ────────────────────────────────────────────────────────────────────
// Tesco data reuses amazon_trending table with marketplace = "Tesco".

export async function runTescoScrape(opts: {
  category?: string
  limit?:    number
}): Promise<{ inserted: number }> {
  const products = await scrapeTescoBestSellers({ category: opts.category, limit: opts.limit })
  if (products.length === 0) return { inserted: 0 }

  let inserted = 0
  for (const p of products) {
    try {
      await query(
        `INSERT INTO amazon_trending
           (asin, product_name, category, rank, price, rating, review_count,
            image_url, product_url, badge, brand, marketplace, scraped_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW())`,
        [p.asin, p.product_name, p.category, p.rank, p.price, p.rating,
         p.review_count, p.image_url, p.product_url, p.badge, p.brand, "Tesco"]
      )
      inserted++
    } catch (err: any) {
      logger.warn("[CreatorIntel] Tesco insert skip", { asin: p.asin, error: err.message })
    }
  }

  logger.info("[CreatorIntel] Tesco scrape done", { inserted })
  return { inserted }
}

export async function getTescoTrending(opts: {
  category?: string
  limit?:    number
  offset?:   number
} = {}): Promise<AmazonProduct[]> {
  const { category, limit = 50, offset = 0 } = opts

  if (category && category !== "All") {
    const res = await query(
      `SELECT asin, product_name, category, rank, price, rating, review_count,
              image_url, product_url, badge, brand, marketplace, scraped_at
       FROM (
         SELECT DISTINCT ON (COALESCE(asin, product_name))
                asin, product_name, category, rank, price, rating, review_count,
                image_url, product_url, badge, brand, marketplace, scraped_at
         FROM amazon_trending
         WHERE marketplace = 'Tesco' AND category = $1
         ORDER BY COALESCE(asin, product_name), scraped_at DESC
       ) latest
       ORDER BY rank ASC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [category, limit, offset]
    )
    return res.rows
  }

  const res = await query(
    `SELECT asin, product_name, category, rank, price, rating, review_count,
            image_url, product_url, badge, brand, marketplace, scraped_at
     FROM (
       SELECT DISTINCT ON (COALESCE(asin, product_name))
              asin, product_name, category, rank, price, rating, review_count,
              image_url, product_url, badge, brand, marketplace, scraped_at
       FROM amazon_trending
       WHERE marketplace = 'Tesco'
       ORDER BY COALESCE(asin, product_name), scraped_at DESC
     ) latest
     ORDER BY rank ASC NULLS LAST
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )
  return res.rows
}

export async function getTescoRankHistory(): Promise<
  Record<string, { rank: number; date: string }[]>
> {
  const res = await query(
    `SELECT asin, rank, scraped_at
     FROM amazon_trending
     WHERE marketplace = 'Tesco' AND asin IS NOT NULL AND rank IS NOT NULL
     ORDER BY asin, scraped_at ASC`
  )
  const history: Record<string, { rank: number; date: string }[]> = {}
  for (const row of res.rows) {
    if (!history[row.asin]) history[row.asin] = []
    history[row.asin].push({ rank: Number(row.rank), date: row.scraped_at })
  }
  for (const k of Object.keys(history)) {
    if (history[k].length < 2) delete history[k]
  }
  return history
}

// ─── Alibaba ──────────────────────────────────────────────────────────────────
// Alibaba data reuses amazon_trending table with marketplace = "Alibaba".

export async function runAlibabaScrape(opts: {
  category?: string
  limit?:    number
}): Promise<{ inserted: number }> {
  const products = await scrapeAlibabaBestSellers({ category: opts.category, limit: opts.limit })
  if (products.length === 0) return { inserted: 0 }

  let inserted = 0
  for (const p of products) {
    try {
      await query(
        `INSERT INTO amazon_trending
           (asin, product_name, category, rank, price, rating, review_count,
            image_url, product_url, badge, brand, marketplace, scraped_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW())`,
        [p.asin, p.product_name, p.category, p.rank, p.price, p.rating,
         p.review_count, p.image_url, p.product_url, p.badge, p.brand, "Alibaba"]
      )
      inserted++
    } catch (err: any) {
      logger.warn("[CreatorIntel] Alibaba insert skip", { asin: p.asin, error: err.message })
    }
  }

  logger.info("[CreatorIntel] Alibaba scrape done", { inserted })
  return { inserted }
}

export async function getAlibabaTrending(opts: {
  category?: string
  limit?:    number
  offset?:   number
} = {}): Promise<AmazonProduct[]> {
  const { category, limit = 50, offset = 0 } = opts

  if (category && category !== "All") {
    const res = await query(
      `SELECT asin, product_name, category, rank, price, rating, review_count,
              image_url, product_url, badge, brand, marketplace, scraped_at
       FROM (
         SELECT DISTINCT ON (COALESCE(asin, product_name))
                asin, product_name, category, rank, price, rating, review_count,
                image_url, product_url, badge, brand, marketplace, scraped_at
         FROM amazon_trending
         WHERE marketplace = 'Alibaba' AND category = $1
         ORDER BY COALESCE(asin, product_name), scraped_at DESC
       ) latest
       ORDER BY rank ASC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [category, limit, offset]
    )
    return res.rows
  }

  const res = await query(
    `SELECT asin, product_name, category, rank, price, rating, review_count,
            image_url, product_url, badge, brand, marketplace, scraped_at
     FROM (
       SELECT DISTINCT ON (COALESCE(asin, product_name))
              asin, product_name, category, rank, price, rating, review_count,
              image_url, product_url, badge, brand, marketplace, scraped_at
       FROM amazon_trending
       WHERE marketplace = 'Alibaba'
       ORDER BY COALESCE(asin, product_name), scraped_at DESC
     ) latest
     ORDER BY rank ASC NULLS LAST
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )
  return res.rows
}

export async function getAlibabaRankHistory(): Promise<
  Record<string, { rank: number; date: string }[]>
> {
  const res = await query(
    `SELECT asin, rank, scraped_at
     FROM amazon_trending
     WHERE marketplace = 'Alibaba' AND asin IS NOT NULL AND rank IS NOT NULL
     ORDER BY asin, scraped_at ASC`
  )
  const history: Record<string, { rank: number; date: string }[]> = {}
  for (const row of res.rows) {
    if (!history[row.asin]) history[row.asin] = []
    history[row.asin].push({ rank: Number(row.rank), date: row.scraped_at })
  }
  for (const k of Object.keys(history)) {
    if (history[k].length < 2) delete history[k]
  }
  return history
}
