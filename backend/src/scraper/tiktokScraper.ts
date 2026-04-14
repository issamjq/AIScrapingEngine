/**
 * TikTok Shop trending product scraper.
 *
 * Two-step approach (more reliable than one-shot JSON):
 *   Step 1 — web_search: find raw text about trending TikTok Shop products
 *   Step 2 — extract:    Claude reads that text and outputs clean JSON
 *
 * This separation avoids the failure mode where Claude haiku mixes
 * search commentary with JSON output, breaking JSON.parse().
 */

import { callClaude } from "../utils/claudeClient"
import { logger }     from "../utils/logger"

export interface TikTokProduct {
  product_name:       string
  category:           string | null
  tiktok_price:       number | null
  gmv_7d:             number | null
  units_sold_7d:      number | null
  growth_pct:         number | null
  video_count:        number | null
  top_creator_handle: string | null
  shop_name:          string | null
  image_url:          string | null
}

// ── Step 1: web search ────────────────────────────────────────────────────────

async function searchTikTokTrending(
  category: string,
  limit:    number,
  apiKey:   string
): Promise<string> {
  const catLine = category === "All"
    ? "across all TikTok Shop categories"
    : `in the TikTok Shop "${category}" category`

  const prompt =
    `Search the web for the top ${limit} best-selling / trending products ${catLine} right now.\n\n` +
    `Look for sources like:\n` +
    `- kalodata.com, shoplus.net, pipiads.com\n` +
    `- TikTok Shop leaderboard pages\n` +
    `- Affiliate marketing weekly trending reports\n` +
    `- E-commerce analyst blogs\n\n` +
    `Collect as much detail as possible: product names, prices, estimated revenue (GMV), units sold, growth rate, shop names, creator handles, and categories.\n` +
    `Write a detailed summary of everything you found — raw facts and numbers, no commentary.`

  const data = await callClaude(apiKey, {
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    tools:      [{ type: "web_search_20250305", name: "web_search" }],
    messages:   [{ role: "user", content: prompt }],
    beta:       "web-search-2025-03-05",
  })

  // Collect all text blocks from the response
  let raw = ""
  for (const block of data?.content ?? []) {
    if (block.type === "text") raw += block.text + "\n"
  }
  return raw.trim()
}

// ── Step 2: extract JSON from raw text ───────────────────────────────────────

async function extractProducts(
  rawText: string,
  limit:   number,
  apiKey:  string
): Promise<TikTokProduct[]> {
  if (!rawText || rawText.length < 50) return []

  const prompt =
    `You are a data extraction API. Parse the following text about trending TikTok Shop products and return a JSON array.\n\n` +
    `TEXT:\n${rawText.slice(0, 6000)}\n\n` +
    `Extract up to ${limit} products. For each product output:\n` +
    `- product_name (string): full product name\n` +
    `- category (string|null): e.g. "Beauty", "Womenswear", "Home & Kitchen"\n` +
    `- tiktok_price (number|null): price in USD, digits only\n` +
    `- gmv_7d (number|null): 7-day GMV in USD — convert "$1.45M" → 1450000, "$876K" → 876000\n` +
    `- units_sold_7d (number|null): units sold last 7 days, integer\n` +
    `- growth_pct (number|null): % growth — positive if growing, negative if declining\n` +
    `- video_count (number|null): number of TikTok videos/creators, integer\n` +
    `- top_creator_handle (string|null): @handle of top promoting creator\n` +
    `- shop_name (string|null): TikTok Shop seller name\n` +
    `- image_url (string|null): product image URL if mentioned\n\n` +
    `RULES:\n` +
    `- Output ONLY the JSON array — no text before or after, no markdown fences.\n` +
    `- All number fields must be actual numbers (not strings).\n` +
    `- Unknown fields → null. Never omit a key.\n` +
    `- Sort by gmv_7d descending. If gmv_7d is unknown, put those last.\n\n` +
    `Output:`

  const data = await callClaude(apiKey, {
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages:   [{ role: "user", content: prompt }],
  })

  const raw = (data?.content?.[0]?.text ?? "").trim()

  // Strip markdown fences if present
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  const start   = jsonStr.indexOf("[")
  const end     = jsonStr.lastIndexOf("]")

  if (start === -1 || end === -1) {
    logger.warn("[TikTokScraper] No JSON array in extraction response", { preview: jsonStr.slice(0, 200) })
    return []
  }

  try {
    const arr: any[] = JSON.parse(jsonStr.slice(start, end + 1))
    return arr.map(sanitize)
  } catch (err: any) {
    logger.error("[TikTokScraper] JSON parse failed", { error: err.message, preview: jsonStr.slice(0, 300) })
    return []
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function scrapeTikTokTrending(opts: {
  category?: string
  limit?:    number
  apiKey:    string
}): Promise<TikTokProduct[]> {
  const { category = "All", limit = 20, apiKey } = opts
  logger.info("[TikTokScraper] Start", { category, limit })

  try {
    // Step 1: search
    const rawText = await searchTikTokTrending(category, limit, apiKey)
    logger.info("[TikTokScraper] Search complete", { chars: rawText.length })

    if (!rawText) {
      logger.warn("[TikTokScraper] Empty search result")
      return []
    }

    // Step 2: extract
    const products = await extractProducts(rawText, limit, apiKey)
    logger.info("[TikTokScraper] Extracted products", { count: products.length })
    return products
  } catch (err: any) {
    logger.error("[TikTokScraper] Failed", { error: err.message })
    return []
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
