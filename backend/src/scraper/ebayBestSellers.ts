/**
 * eBay Best Sellers — official Finding API scraper.
 *
 * Uses eBay's findItemsByCategory operation sorted by BestMatch (sales + popularity).
 * Requires a free eBay App ID from developer.ebay.com.
 *
 * No Playwright, no proxies, no bot protection — it's an official API.
 * Data stored in amazon_trending with marketplace = "eBay".
 */

import https  from "https"
import { logger } from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

// ─── eBay category IDs ────────────────────────────────────────────────────────

const EBAY_CATEGORIES: { label: string; id: string }[] = [
  { label: "Electronics",       id: "293"   },
  { label: "Health & Beauty",   id: "26395" },
  { label: "Home & Garden",     id: "11700" },
  { label: "Sporting Goods",    id: "888"   },
  { label: "Toys & Hobbies",    id: "220"   },
  { label: "Fashion",           id: "11450" },
  { label: "Books",             id: "267"   },
  { label: "Baby",              id: "2984"  },
  { label: "Pet Supplies",      id: "1281"  },
  { label: "Collectibles",      id: "1"     },
]

// ─── Plain HTTPS GET → parsed JSON ───────────────────────────────────────────

function apiGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "Accept": "application/json" } }, res => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        apiGet(res.headers.location).then(resolve).catch(reject)
        return
      }
      const chunks: Buffer[] = []
      res.on("data", (c: Buffer) => chunks.push(c))
      res.on("end",  ()         => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))) }
        catch (e) { reject(e) }
      })
    })
    req.on("error", reject)
    req.setTimeout(15_000, () => { req.destroy(); reject(new Error("timeout")) })
  })
}

// ─── Map one eBay item → AmazonProduct ───────────────────────────────────────

function mapItem(item: any, category: string, idx: number): AmazonProduct | null {
  // Finding API wraps every field in a 1-element array
  const v = (field: any) => Array.isArray(field) ? field[0] : field

  const itemId      = v(item.itemId)      ?? null
  const title       = v(item.title)       ?? ""
  if (!title) return null

  const productUrl  = v(item.viewItemURL) ?? null
  const image_url   = v(item.galleryURL)  ?? null

  // Price is under sellingStatus[0].currentPrice[0].__value__
  const priceRaw = v(v(item.sellingStatus)?.[0]?.currentPrice)?.__value__
  const price: number | null = priceRaw != null ? parseFloat(priceRaw) || null : null

  // Condition badge
  const condition  = v(v(item.condition)?.[0]?.conditionDisplayName) ?? null
  const topRated   = v(item.topRatedListing) === "true"
  const badges: string[] = []
  if (topRated)   badges.push("Top Rated")
  if (condition && condition !== "New") badges.push(condition)

  // Brand from item specifics if available (not always present)
  const brand: string | null = null

  return {
    asin:         itemId,
    product_name: title,
    category,
    rank:         idx + 1,
    price,
    original_price: null,
    rating:       null,   // eBay has no per-product rating
    review_count: null,
    image_url,
    product_url:  productUrl,
    badge:        badges.length ? badges.join(",") : null,
    brand,
    marketplace:  "eBay",
  }
}

// ─── Scrape one eBay category ─────────────────────────────────────────────────

async function scrapeCategory(
  catId:    string,
  category: string,
  appId:    string
): Promise<AmazonProduct[]> {
  const params = new URLSearchParams({
    "OPERATION-NAME":             "findItemsByCategory",
    "SERVICE-VERSION":            "1.0.0",
    "SECURITY-APPNAME":           appId,
    "RESPONSE-DATA-FORMAT":       "JSON",
    "categoryId":                 catId,
    "sortOrder":                  "BestMatch",
    "paginationInput.entriesPerPage": "50",
    "paginationInput.pageNumber": "1",
    // Only fixed-price listings (not auctions) for cleaner price data
    "itemFilter(0).name":         "ListingType",
    "itemFilter(0).value(0)":     "FixedPrice",
    "itemFilter(0).value(1)":     "StoreInventory",
    "itemFilter(1).name":         "Condition",
    "itemFilter(1).value":        "New",
    "outputSelector(0)":          "GalleryInfo",
    "outputSelector(1)":          "SellerInfo",
  })

  const url = `https://svcs.ebay.com/services/search/FindingService/v1?${params}`

  let data: any
  try {
    data = await apiGet(url)
  } catch (err: any) {
    logger.warn("[eBayScraper] API call failed", { category, error: err.message })
    return []
  }

  const resp    = data?.findItemsByCategoryResponse?.[0]
  const ack     = resp?.ack?.[0]
  if (ack !== "Success" && ack !== "Warning") {
    logger.warn("[eBayScraper] API error", { category, ack, error: resp?.errorMessage?.[0] })
    return []
  }

  const items: any[] = resp?.searchResult?.[0]?.item ?? []
  logger.info("[eBayScraper] Category done", { category, count: items.length })

  return items
    .map((item, idx) => mapItem(item, category, idx))
    .filter((p): p is AmazonProduct => p !== null)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeEbayBestSellers(opts: {
  category?: string
  limit?:    number
  appId:     string
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 100, appId } = opts

  const targets = category === "All"
    ? EBAY_CATEGORIES
    : EBAY_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[eBayScraper] No matching category", { category })
    return []
  }

  logger.info("[eBayScraper] Starting eBay scrape", { categories: targets.map(t => t.label) })

  const allProducts: AmazonProduct[] = []

  for (const target of targets) {
    const products = await scrapeCategory(target.id, target.label, appId)
    allProducts.push(...products)
    await new Promise(r => setTimeout(r, 500))   // polite delay between API calls
  }

  // Deduplicate by eBay item ID
  const seen  = new Set<string>()
  const dedup = allProducts.filter(p => {
    const key = p.asin ?? p.product_name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  logger.info("[eBayScraper] Complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
