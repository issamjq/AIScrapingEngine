/**
 * Walmart.com Best Sellers — pure HTTP scraper (no Playwright).
 *
 * Fetches Walmart search pages directly via HTTP and extracts product data
 * from the __NEXT_DATA__ JSON blob embedded in every server-rendered page.
 * No browser needed — far less detectable than headless Chrome on cloud IPs.
 *
 * Data stored in amazon_trending with marketplace = "Walmart".
 */

import https  from "https"
import { logger } from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

// ─── Walmart search URLs (sort=best_seller) ───────────────────────────────────

const WMT_CATEGORIES: { label: string; query: string }[] = [
  { label: "Electronics",       query: "electronics" },
  { label: "Beauty",            query: "beauty skincare" },
  { label: "Home & Kitchen",    query: "home kitchen essentials" },
  { label: "Health",            query: "health wellness vitamins" },
  { label: "Sports & Outdoors", query: "sports outdoors fitness" },
  { label: "Toys & Games",      query: "toys games kids" },
  { label: "Fashion",           query: "clothing apparel" },
  { label: "Baby",              query: "baby products infant" },
  { label: "Food & Grocery",    query: "grocery food snacks" },
  { label: "Pet Supplies",      query: "pet supplies dog cat" },
]

// ─── Plain HTTPS GET → string ─────────────────────────────────────────────────

function httpsGet(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      // Follow one redirect
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        httpsGet(res.headers.location, headers).then(resolve).catch(reject)
        return
      }
      if ((res.statusCode ?? 0) >= 400) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      const chunks: Buffer[] = []
      res.on("data", (c: Buffer) => chunks.push(c))
      res.on("end",  ()         => resolve(Buffer.concat(chunks).toString("utf8")))
    })
    req.on("error", reject)
    req.setTimeout(20_000, () => { req.destroy(); reject(new Error("timeout")) })
  })
}

// ─── Extract __NEXT_DATA__ from raw HTML ─────────────────────────────────────

function extractNextData(html: string): any | null {
  const m = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}

// ─── Walk the parsed JSON to find an array of Walmart items ──────────────────

function findItemArray(obj: any, depth = 0): any[] {
  if (depth > 10 || obj == null || typeof obj !== "object") return []

  // itemStacks is the canonical location (search results page)
  if (obj.itemStacks && Array.isArray(obj.itemStacks)) {
    for (const stack of obj.itemStacks) {
      if (Array.isArray(stack?.items) && stack.items.length > 0 && stack.items[0]?.usItemId) {
        return stack.items
      }
    }
  }

  if (Array.isArray(obj)) {
    // Direct item array
    if (obj.length > 0 && obj[0]?.usItemId && obj[0]?.name) return obj
    for (const el of obj) {
      const r = findItemArray(el, depth + 1)
      if (r.length > 0) return r
    }
    return []
  }

  for (const key of Object.keys(obj)) {
    const r = findItemArray(obj[key], depth + 1)
    if (r.length > 0) return r
  }
  return []
}

// ─── Map a raw Walmart item to our AmazonProduct shape ───────────────────────

function mapItem(item: any, category: string, idx: number): AmazonProduct | null {
  const name: string = (item.name ?? item.title ?? "").trim()
  if (!name) return null

  const itemId = String(item.usItemId ?? item.itemId ?? "").trim() || null
  const productUrl = itemId
    ? `https://www.walmart.com/ip/${itemId}`
    : item.canonicalUrl ? `https://www.walmart.com${item.canonicalUrl}` : null

  const price: number | null = (() => {
    const cp =
      item.priceInfo?.currentPrice?.price ??
      item.price?.currentPrice            ??
      item.priceInfo?.price               ??
      item.salePrice                      ??
      null
    if (cp == null) return null
    const n = Number(cp)
    return isFinite(n) && n > 0 ? n : null
  })()

  const rating       = item.averageRating   != null ? Number(item.averageRating)   : null
  const review_count = item.numberOfReviews != null ? Number(item.numberOfReviews) : null
  const brand        = item.brand ?? null

  const image_url: string | null =
    item.imageInfo?.thumbnailUrl ??
    item.imageUrl                ??
    (Array.isArray(item.imageInfo?.allImages) ? item.imageInfo.allImages[0]?.url : null) ??
    null

  const badges: string[] = []
  for (const g of (item.badges?.groups ?? [])) {
    const n = String(g?.name ?? "").toUpperCase()
    if (n.includes("BEST_SELLER")) badges.push("Best Seller")
    if (n.includes("TOP_RATED"))   badges.push("Top Rated")
    if (n.includes("ROLLBACK"))    badges.push("Rollback")
  }
  if (item.isBestSeller) badges.push("Best Seller")

  return {
    asin:         itemId,
    product_name: name,
    category,
    rank:         idx + 1,
    price,
    rating,
    review_count,
    image_url,
    product_url:  productUrl,
    badge:        badges.length ? [...new Set(badges)].join(",") : null,
    brand,
    marketplace:  "Walmart",
  }
}

// ─── Scrape one Walmart search query ─────────────────────────────────────────

const BASE_HEADERS: Record<string, string> = {
  "User-Agent":                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language":           "en-US,en;q=0.9",
  "Accept-Encoding":           "identity",
  "Cache-Control":             "no-cache",
  "Pragma":                    "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest":            "document",
  "Sec-Fetch-Mode":            "navigate",
  "Sec-Fetch-Site":            "none",
  "Sec-Fetch-User":            "?1",
  "sec-ch-ua":                 '"Chromium";v="124","Google Chrome";v="124"',
  "sec-ch-ua-platform":        '"Windows"',
}

async function scrapeCategory(
  query:    string,
  category: string
): Promise<AmazonProduct[]> {
  const encoded = encodeURIComponent(query)
  const url     = `https://www.walmart.com/search?q=${encoded}&sort=best_seller`

  let html: string
  try {
    html = await httpsGet(url, BASE_HEADERS)
  } catch (err: any) {
    logger.warn("[WalmartScraper] Fetch failed", { category, error: err.message })
    return []
  }

  // Detect bot challenge / access denied in HTML
  if (/robot|captcha|access.denied|verify you are human/i.test(html.slice(0, 3000))) {
    logger.warn("[WalmartScraper] Bot challenge page detected", { category })
    return []
  }

  const nd = extractNextData(html)
  if (!nd) {
    logger.warn("[WalmartScraper] No __NEXT_DATA__ found", { category, htmlLen: html.length })
    return []
  }

  const rawItems = findItemArray(nd?.props?.pageProps?.initialData ?? nd)
  logger.info("[WalmartScraper] Raw items found", { category, count: rawItems.length })

  if (rawItems.length === 0) return []

  return rawItems
    .slice(0, 60)
    .map((item, idx) => mapItem(item, category, idx))
    .filter((p): p is AmazonProduct => p !== null)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeWalmartBestSellers(opts: {
  category?: string
  limit?:    number
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 100 } = opts

  const targets = category === "All"
    ? WMT_CATEGORIES
    : WMT_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[WalmartScraper] No matching category", { category })
    return []
  }

  logger.info("[WalmartScraper] Starting HTTP scrape", { categories: targets.map(t => t.label) })

  const allProducts: AmazonProduct[] = []

  for (const target of targets) {
    const products = await scrapeCategory(target.query, target.label)
    logger.info("[WalmartScraper] Category done", { label: target.label, found: products.length })
    allProducts.push(...products)
    // Polite delay between requests
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000))
  }

  // Deduplicate by item ID
  const seen  = new Set<string>()
  const dedup = allProducts.filter(p => {
    const key = p.asin ?? p.product_name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  logger.info("[WalmartScraper] Complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
