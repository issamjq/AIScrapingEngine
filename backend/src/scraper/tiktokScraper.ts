/**
 * TikTok Shop trending product scraper.
 *
 * Strategy: use Claude's web_search tool to find trending TikTok Shop data
 * from public analytics/leaderboard pages. Direct Playwright scraping of
 * TikTok is blocked by aggressive bot detection; web_search is reliable
 * and returns real data aggregated from public sources (kalodata, shoplus,
 * TikTok's own indexed pages, affiliate marketing reports).
 *
 * Results are saved to the `tiktok_products` table and served cached.
 * Consumers call GET /api/creator-intel/trending — no live scraping per request.
 */

import { callClaude } from "../utils/claudeClient"
import { logger }     from "../utils/logger"

export interface TikTokProduct {
  product_name:       string
  category:           string | null
  tiktok_price:       number | null
  gmv_7d:             number | null   // USD
  units_sold_7d:      number | null
  growth_pct:         number | null   // % vs prior 7 days
  video_count:        number | null
  top_creator_handle: string | null
  shop_name:          string | null
  image_url:          string | null
}

const SYSTEM_PROMPT =
  `You are a TikTok Shop market analytics API. Your output must ALWAYS be a raw JSON array — never plain text, never explanations.`

function buildPrompt(category: string, limit: number): string {
  const catLine = category === "All"
    ? "across ALL TikTok Shop categories"
    : `in the "${category}" TikTok Shop category`

  return (
    `Search the web right now for the top ${limit} trending products ${catLine}.\n\n` +
    `Use your web search tool to find real data from sources like:\n` +
    `- kalodata.com, shoplus.net, pipiads.com (TikTok analytics platforms)\n` +
    `- TikTok Shop leaderboards, affiliate marketing reports\n` +
    `- Creator economy blogs publishing weekly trending lists\n\n` +
    `For each product extract or estimate:\n` +
    `- product_name: full product name as listed\n` +
    `- category: product category (e.g. "Beauty", "Womenswear", "Home & Kitchen")\n` +
    `- tiktok_price: current listing price in USD (number, no $ sign)\n` +
    `- gmv_7d: estimated 7-day GMV in USD (number — e.g. 1450000 for $1.45M)\n` +
    `- units_sold_7d: estimated units sold in last 7 days (integer)\n` +
    `- growth_pct: % growth vs prior 7 days (positive = growing, negative = declining)\n` +
    `- video_count: approx number of TikTok videos featuring this product (integer)\n` +
    `- top_creator_handle: @handle of the top creator promoting this (or null)\n` +
    `- shop_name: TikTok Shop seller name (or null)\n` +
    `- image_url: product image URL if found in search results (or null)\n\n` +
    `CRITICAL OUTPUT RULES:\n` +
    `- Output ONLY the JSON array. Zero other text before or after.\n` +
    `- All number fields must be actual numbers (not strings like "$1.45M").\n` +
    `- If a field is unknown, use null — never omit the key.\n` +
    `- Return exactly ${limit} products sorted by estimated GMV descending.\n` +
    `- NEVER return an empty array. If exact GMV is unavailable, estimate from context.\n\n` +
    `JSON format (your ENTIRE response):\n` +
    `[{"product_name":"...","category":"...","tiktok_price":29.99,"gmv_7d":1450000,"units_sold_7d":37000,"growth_pct":-18.4,"video_count":1620,"top_creator_handle":"@fashionista","shop_name":"StyleHub","image_url":null}]`
  )
}

export async function scrapeTikTokTrending(opts: {
  category?: string
  limit?:    number
  apiKey:    string
}): Promise<TikTokProduct[]> {
  const { category = "All", limit = 20, apiKey } = opts
  logger.info("[TikTokScraper] Starting web search", { category, limit })

  let raw = ""
  try {
    const data = await callClaude(apiKey, {
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      tools:      [{ type: "web_search_20250305", name: "web_search" }],
      messages:   [{ role: "user", content: buildPrompt(category, limit) }],
      beta:       "web-search-2025-03-05",
    })

    // Extract text from the final assistant turn
    for (const block of data?.content ?? []) {
      if (block.type === "text") raw += block.text
    }
  } catch (err: any) {
    logger.error("[TikTokScraper] Claude call failed", { error: err.message })
    return []
  }

  // Parse JSON — strip any accidental markdown fences
  try {
    const jsonStr = raw.replace(/```(?:json)?/gi, "").trim()
    const start = jsonStr.indexOf("[")
    const end   = jsonStr.lastIndexOf("]")
    if (start === -1 || end === -1) {
      logger.warn("[TikTokScraper] No JSON array found in response", { raw: raw.slice(0, 300) })
      return []
    }
    const arr: any[] = JSON.parse(jsonStr.slice(start, end + 1))
    logger.info("[TikTokScraper] Parsed products", { count: arr.length, category })
    return arr.map(sanitize)
  } catch (err: any) {
    logger.error("[TikTokScraper] JSON parse failed", { error: err.message, raw: raw.slice(0, 500) })
    return []
  }
}

function sanitize(p: any): TikTokProduct {
  return {
    product_name:       String(p.product_name       ?? "Unknown Product"),
    category:           p.category           ? String(p.category)           : null,
    tiktok_price:       toNum(p.tiktok_price),
    gmv_7d:             toNum(p.gmv_7d),
    units_sold_7d:      toInt(p.units_sold_7d),
    growth_pct:         toNum(p.growth_pct),
    video_count:        toInt(p.video_count),
    top_creator_handle: p.top_creator_handle ? String(p.top_creator_handle) : null,
    shop_name:          p.shop_name          ? String(p.shop_name)          : null,
    image_url:          p.image_url          ? String(p.image_url)          : null,
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
