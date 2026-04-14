/**
 * Amazon Best Sellers scraper — two-step approach.
 * Step 1: web_search finds raw text about Amazon BSR / trending products.
 * Step 2: Claude extracts structured JSON from that text.
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

async function searchAmazonBestSellers(
  category:    string,
  marketplace: string,
  limit:       number,
  apiKey:      string
): Promise<string> {
  const catLine = category === "All"
    ? "across top Amazon categories"
    : `in the Amazon "${category}" category`

  const prompt =
    `Search the web for the top ${limit} Amazon best-selling and trending products ${catLine} on Amazon ${marketplace} right now.\n\n` +
    `Look for:\n` +
    `- Amazon Best Sellers and Movers & Shakers pages (publicly indexed)\n` +
    `- Jungle Scout, Helium 10 published weekly reports\n` +
    `- E-commerce analyst blogs with current BSR lists\n\n` +
    `Collect as much detail as possible: product names, ASINs, prices, Best Seller Rank, review counts, star ratings, categories.\n` +
    `Write a detailed factual summary of everything you found.`

  const data = await callClaude(apiKey, {
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    tools:      [{ type: "web_search_20250305", name: "web_search" }],
    messages:   [{ role: "user", content: prompt }],
    beta:       "web-search-2025-03-05",
  })

  let raw = ""
  for (const block of data?.content ?? []) {
    if (block.type === "text") raw += block.text + "\n"
  }
  return raw.trim()
}

async function extractAmazonProducts(
  rawText:     string,
  marketplace: string,
  limit:       number,
  apiKey:      string
): Promise<AmazonProduct[]> {
  if (!rawText || rawText.length < 50) return []

  const prompt =
    `You are a data extraction API. Parse the following text about Amazon best-selling products and return a JSON array.\n\n` +
    `TEXT:\n${rawText.slice(0, 6000)}\n\n` +
    `Extract up to ${limit} products. For each product output:\n` +
    `- asin (string|null): Amazon ASIN code (e.g. "B09QBKDQCV")\n` +
    `- product_name (string): full product name\n` +
    `- category (string|null): Amazon category\n` +
    `- rank (number|null): Best Seller Rank integer\n` +
    `- price (number|null): current price in USD, digits only\n` +
    `- rating (number|null): star rating 1–5 decimal\n` +
    `- review_count (number|null): total reviews integer\n` +
    `- marketplace (string): "${marketplace}"\n\n` +
    `RULES:\n` +
    `- Output ONLY the JSON array — no text before or after, no markdown fences.\n` +
    `- All number fields must be actual numbers.\n` +
    `- Unknown fields → null. Never omit a key.\n` +
    `- Sort by rank ascending.\n\n` +
    `Output:`

  const data = await callClaude(apiKey, {
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages:   [{ role: "user", content: prompt }],
  })

  const raw     = (data?.content?.[0]?.text ?? "").trim()
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  const start   = jsonStr.indexOf("[")
  const end     = jsonStr.lastIndexOf("]")

  if (start === -1 || end === -1) {
    logger.warn("[AmazonScraper] No JSON array in extraction response", { preview: jsonStr.slice(0, 200) })
    return []
  }

  try {
    const arr: any[] = JSON.parse(jsonStr.slice(start, end + 1))
    return arr.map(p => sanitize(p, marketplace))
  } catch (err: any) {
    logger.error("[AmazonScraper] JSON parse failed", { error: err.message })
    return []
  }
}

export async function scrapeAmazonBestSellers(opts: {
  category?:    string
  marketplace?: string
  limit?:       number
  apiKey:       string
}): Promise<AmazonProduct[]> {
  const { category = "All", marketplace = "US", limit = 20, apiKey } = opts
  logger.info("[AmazonScraper] Start", { category, marketplace, limit })

  try {
    const rawText = await searchAmazonBestSellers(category, marketplace, limit, apiKey)
    logger.info("[AmazonScraper] Search complete", { chars: rawText.length })
    if (!rawText) return []

    const products = await extractAmazonProducts(rawText, marketplace, limit, apiKey)
    logger.info("[AmazonScraper] Extracted products", { count: products.length })
    return products
  } catch (err: any) {
    logger.error("[AmazonScraper] Failed", { error: err.message })
    return []
  }
}

function sanitize(p: any, marketplace: string): AmazonProduct {
  return {
    asin:         p.asin         ? String(p.asin)         : null,
    product_name: String(p.product_name ?? "Unknown Product"),
    category:     p.category     ? String(p.category)     : null,
    rank:         toInt(p.rank),
    price:        toNum(p.price),
    rating:       toNum(p.rating),
    review_count: toInt(p.review_count),
    marketplace:  String(p.marketplace ?? marketplace),
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
