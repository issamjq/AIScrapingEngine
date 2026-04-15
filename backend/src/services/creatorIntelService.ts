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
  // Always scrape AE — marketplace param ignored
  const products = await scrapeAmazonBestSellers({ category: opts.category, limit: opts.limit })
  if (products.length === 0) return { inserted: 0 }

  let inserted = 0
  for (const p of products) {
    try {
      if (p.asin) {
        // Upsert by ASIN — update price + rank + image each run
        await query(
          `INSERT INTO amazon_trending
             (asin, product_name, category, rank, price, rating, review_count, image_url, marketplace, scraped_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())
           ON CONFLICT (asin) DO UPDATE SET
             product_name = EXCLUDED.product_name,
             category     = EXCLUDED.category,
             rank         = EXCLUDED.rank,
             price        = EXCLUDED.price,
             rating       = EXCLUDED.rating,
             review_count = EXCLUDED.review_count,
             image_url    = COALESCE(EXCLUDED.image_url, amazon_trending.image_url),
             marketplace  = EXCLUDED.marketplace,
             scraped_at   = NOW()`,
          [p.asin, p.product_name, p.category, p.rank, p.price, p.rating, p.review_count, p.image_url, p.marketplace]
        )
      } else {
        await query(
          `INSERT INTO amazon_trending
             (product_name, category, rank, price, rating, review_count, image_url, marketplace, scraped_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())`,
          [p.product_name, p.category, p.rank, p.price, p.rating, p.review_count, p.image_url, p.marketplace]
        )
      }
      inserted++
    } catch (err: any) {
      logger.warn("[CreatorIntel] Amazon upsert skip", { asin: p.asin, error: err.message })
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
  const { category, marketplace = "AE", limit = 50, offset = 0 } = opts

  const params: any[] = [marketplace, limit, offset]
  const conditions = ["marketplace = $1"]

  if (category && category !== "All") {
    params.splice(1, 0, category)   // insert at index 1, shift rest
    conditions.push(`category = $2`)
    // rebuild positional params
    const res2 = await query(
      `SELECT asin, product_name, category, rank, price, rating, review_count, image_url, marketplace
       FROM amazon_trending
       WHERE marketplace = $1 AND category = $2
       ORDER BY rank ASC NULLS LAST, scraped_at DESC
       LIMIT $3 OFFSET $4`,
      [marketplace, category, limit, offset]
    )
    return res2.rows
  }

  const res = await query(
    `SELECT asin, product_name, category, rank, price, rating, review_count, image_url, marketplace
     FROM amazon_trending
     WHERE marketplace = $1
     ORDER BY rank ASC NULLS LAST, scraped_at DESC
     LIMIT $2 OFFSET $3`,
    [marketplace, limit, offset]
  )
  return res.rows
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
