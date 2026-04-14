/**
 * Amazon Best Sellers / Movers & Shakers scraper.
 *
 * Uses Claude web_search to find trending Amazon products with BSR,
 * review counts, and revenue estimates from public analytics sources
 * (Jungle Scout reports, Helium 10, Amazon's own indexed BSR pages).
 */

import { callClaude } from "../utils/claudeClient"
import { logger }     from "../utils/logger"

export interface AmazonProduct {
  asin:         string | null
  product_name: string
  category:     string | null
  rank:         number | null
  price:        number | null
  rating:       number | null
  review_count: number | null
  marketplace:  string
}

function buildPrompt(category: string, marketplace: string, limit: number): string {
  const catLine = category === "All"
    ? "across top Amazon categories"
    : `in the "${category}" Amazon category`

  return (
    `Search the web right now for the top ${limit} Amazon best-selling / trending products ${catLine} on Amazon ${marketplace}.\n\n` +
    `Use your web search tool to find real data from sources like:\n` +
    `- Amazon Best Sellers and Movers & Shakers pages (publicly indexed)\n` +
    `- Jungle Scout, Helium 10 published reports\n` +
    `- E-commerce analytics blogs with weekly BSR lists\n\n` +
    `For each product extract or estimate:\n` +
    `- asin: Amazon ASIN code (e.g. "B09QBKDQCV")\n` +
    `- product_name: full product name\n` +
    `- category: Amazon category (e.g. "Health & Household")\n` +
    `- rank: Best Seller Rank integer\n` +
    `- price: current price in USD (number only)\n` +
    `- rating: star rating 1–5 (decimal, e.g. 4.7)\n` +
    `- review_count: total number of reviews (integer)\n` +
    `- marketplace: "${marketplace}"\n\n` +
    `CRITICAL OUTPUT RULES:\n` +
    `- Output ONLY the JSON array. Zero other text.\n` +
    `- Number fields must be actual numbers, not strings.\n` +
    `- If a field is unknown use null — never omit the key.\n` +
    `- Return exactly ${limit} products sorted by rank ascending.\n\n` +
    `JSON format:\n` +
    `[{"asin":"B09QBKDQCV","product_name":"...","category":"...","rank":3,"price":45.00,"rating":4.8,"review_count":142381,"marketplace":"${marketplace}"}]`
  )
}

export async function scrapeAmazonBestSellers(opts: {
  category?:    string
  marketplace?: string
  limit?:       number
  apiKey:       string
}): Promise<AmazonProduct[]> {
  const { category = "All", marketplace = "US", limit = 20, apiKey } = opts
  logger.info("[AmazonScraper] Starting web search", { category, marketplace, limit })

  let raw = ""
  try {
    const data = await callClaude(apiKey, {
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      tools:      [{ type: "web_search_20250305", name: "web_search" }],
      messages:   [{ role: "user", content: buildPrompt(category, marketplace, limit) }],
      beta:       "web-search-2025-03-05",
    })

    for (const block of data?.content ?? []) {
      if (block.type === "text") raw += block.text
    }
  } catch (err: any) {
    logger.error("[AmazonScraper] Claude call failed", { error: err.message })
    return []
  }

  try {
    const jsonStr = raw.replace(/```(?:json)?/gi, "").trim()
    const start = jsonStr.indexOf("[")
    const end   = jsonStr.lastIndexOf("]")
    if (start === -1 || end === -1) {
      logger.warn("[AmazonScraper] No JSON array found", { raw: raw.slice(0, 300) })
      return []
    }
    const arr: any[] = JSON.parse(jsonStr.slice(start, end + 1))
    logger.info("[AmazonScraper] Parsed products", { count: arr.length })
    return arr.map(sanitize).map(p => ({ ...p, marketplace }))
  } catch (err: any) {
    logger.error("[AmazonScraper] JSON parse failed", { error: err.message })
    return []
  }
}

function sanitize(p: any): AmazonProduct {
  return {
    asin:         p.asin         ? String(p.asin)         : null,
    product_name: String(p.product_name ?? "Unknown Product"),
    category:     p.category     ? String(p.category)     : null,
    rank:         toInt(p.rank),
    price:        toNum(p.price),
    rating:       toNum(p.rating),
    review_count: toInt(p.review_count),
    marketplace:  String(p.marketplace ?? "US"),
  }
}

function toNum(v: any): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return isFinite(n) ? n : null
}
function toInt(v: any): number | null {
  const n = toNum(v)
  return n !== null ? Math.round(n) : null
}
