import { callClaude } from "../utils/claudeClient"
import { logger } from "../utils/logger"

export interface B2CResult {
  retailer:      string
  url:           string
  title:         string
  condition:     string   // "New" | "Used - Good" | "Used - Fair" | "Used - Poor" | "Refurbished" | "Unknown"
  price:         number | null
  originalPrice: number | null
  currency:      string
  availability:  string
  imageUrl:      string | null
  priceSource:   "scraped" | "not_found"
}

const VALID_CONDITIONS = ["New", "Used - Good", "Used - Fair", "Used - Poor", "Refurbished", "Unknown"]

// ── Main export ───────────────────────────────────────────────────
// Single Claude call with web_search — finds products AND extracts prices.
// No Playwright, no browser, no crashes.
export async function b2cSearch(query: string, apiKey: string, countryHint = ""): Promise<B2CResult[]> {
  const geoLine = countryHint
    ? `The user is in ${countryHint}. Search ${countryHint} marketplaces first, then expand regionally and globally.`
    : `Search globally across all major marketplaces.`

  const siteHints =
    `Site guidance by product type (pick whichever fits):\n` +
    `• Cars / vehicles → Dubizzle (dubizzle.com), YallaMotor (uae.yallamotor.com), CarSwitch (carswitch.com), OpenSooq (ae.opensooq.com), AutoTrader, Avito\n` +
    `• Electronics / phones → Amazon AE (amazon.ae), Noon (noon.com), Sharaf DG, Back Market, eBay\n` +
    `• Fashion / luxury → Ounass, Namshi, Farfetch, eBay, Vestiaire Collective\n` +
    `• Furniture / home → IKEA AE, Noon, Amazon AE, PAN Emirates\n` +
    `• General goods → Amazon AE, Noon, Carrefour AE, LuLu Hypermarket, eBay\n` +
    `• Used / second-hand → Dubizzle, OLX, eBay, Facebook Marketplace, Melltoo`

  const prompt =
    `You are a price discovery API. Find current prices for: "${query}"\n\n` +
    `${geoLine}\n\n` +
    `${siteHints}\n\n` +
    `Instructions:\n` +
    `1. Use web search to find this exact product on multiple platforms (both new AND used listings).\n` +
    `2. For each listing found, read the page to extract the exact current price.\n` +
    `3. Search at least 3–4 different platforms and return 8–15 results total.\n` +
    `4. Only include listings that are specifically for THIS product — not unrelated items.\n\n` +
    `CRITICAL OUTPUT RULES:\n` +
    `- Output ONLY the JSON array. No markdown, no explanation, nothing else.\n` +
    `- NEVER write "I was unable to find" or any prose. Return the array even if partial.\n` +
    `- price must be a NUMBER (e.g. 299.99) or null — never a string.\n` +
    `- originalPrice is the crossed-out / was-price if on sale, otherwise null.\n` +
    `- currency: use the currency shown on the site (AED, USD, GBP, EUR, SAR, etc.).\n` +
    `- condition: one of "New", "Used - Good", "Used - Fair", "Used - Poor", "Refurbished", "Unknown".\n` +
    `- availability: "In Stock", "Out of Stock", or "Unknown".\n` +
    `- imageUrl: include product image URL if visible in the page, otherwise null.\n\n` +
    `JSON format (your entire response — nothing before, nothing after):\n` +
    `[{"retailer":"Amazon AE","url":"https://www.amazon.ae/...","title":"Exact title","condition":"New","price":299.99,"originalPrice":399.99,"currency":"AED","availability":"In Stock","imageUrl":"https://..."}]`

  logger.info("[B2CSearch] Starting", { query, countryHint })

  try {
    const data = await callClaude(apiKey, {
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      tools:      [{ type: "web_search_20250305", name: "web_search" }],
      messages:   [{ role: "user", content: prompt }],
      beta:       "web-search-2025-03-05",
    })

    // Extract the final text block from Claude's response
    const text = (data?.content ?? [])
      .filter((b: any) => b.type === "text" && b.text)
      .map((b: any) => b.text as string)
      .join("\n")

    logger.info("[B2CSearch] Claude response", { chars: text.length, snippet: text.slice(0, 400) })

    // Parse JSON — handle code-fenced block or bare array
    let parsed: any[] = []
    try {
      const fenced = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)
      if (fenced) {
        parsed = JSON.parse(fenced[1])
      } else {
        const arrMatch = text.match(/\[[\s\S]*\]/)
        if (arrMatch) parsed = JSON.parse(arrMatch[0])
      }
    } catch (parseErr: any) {
      logger.warn("[B2CSearch] JSON parse error", { error: parseErr.message, snippet: text.slice(0, 400) })
      return []
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      logger.warn("[B2CSearch] Empty result", { snippet: text.slice(0, 400) })
      return []
    }

    // Normalize + validate each result
    const results: B2CResult[] = parsed
      .filter((r: any) => r.retailer && typeof r.url === "string" && r.url.startsWith("http") && r.title)
      .map((r: any) => {
        const rawPrice    = typeof r.price === "number" ? r.price : parseFloat(r.price)
        const rawOriginal = typeof r.originalPrice === "number" ? r.originalPrice : parseFloat(r.originalPrice)
        const price         = isFinite(rawPrice)    && rawPrice    > 0 ? rawPrice    : null
        const originalPrice = isFinite(rawOriginal) && rawOriginal > 0 ? rawOriginal : null
        return {
          retailer:      String(r.retailer).trim(),
          url:           String(r.url).trim(),
          title:         String(r.title).trim(),
          condition:     VALID_CONDITIONS.includes(r.condition) ? r.condition : "Unknown",
          price,
          originalPrice: originalPrice !== null && originalPrice > (price ?? 0) ? originalPrice : null,
          currency:      String(r.currency || "AED").trim(),
          availability:  String(r.availability || "Unknown").trim(),
          imageUrl:      r.imageUrl ? String(r.imageUrl).trim() : null,
          priceSource:   price !== null ? ("scraped" as const) : ("not_found" as const),
        }
      })

    logger.info("[B2CSearch] Done", { total: parsed.length, valid: results.length })

    // Sort: price-found first (ascending), then no-price results at the end
    return results.sort((a, b) => {
      if (a.price !== null && b.price !== null) return a.price - b.price
      if (a.price !== null) return -1
      if (b.price !== null) return 1
      return 0
    })
  } catch (err: any) {
    logger.error("[B2CSearch] Error", { error: err.message })
    throw err
  }
}
