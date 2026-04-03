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
  location:      string | null   // e.g. "Beirut, Lebanon" or "Dubai - Marina"
  details:       string | null   // e.g. "150,000 km · 2010 · Coupe" or "256GB · Space Black"
  priceSource:   "scraped" | "not_found"
}

const VALID_CONDITIONS = ["New", "Used - Good", "Used - Fair", "Used - Poor", "Refurbished", "Unknown"]

// ── Main export ───────────────────────────────────────────────────
export async function b2cSearch(query: string, apiKey: string, countryHint = ""): Promise<B2CResult[]> {
  const geoLine = countryHint
    ? `The user is in ${countryHint}. Search ${countryHint} marketplaces first, then expand regionally and globally.`
    : `Search globally across all major marketplaces.`

  const siteHints =
    `Site guidance by product type (pick whichever fits the query):\n` +
    `• Cars / vehicles → OLX (olx.com.lb / olx.ae / olx.com.sa), Dubizzle (dubizzle.com), YallaMotor (uae.yallamotor.com), CarSwitch, OpenSooq, Haraj\n` +
    `• Electronics / phones → Amazon AE (amazon.ae), Noon (noon.com), Back Market, eBay, Dubizzle\n` +
    `• Fashion / luxury → Ounass, Namshi, Farfetch, eBay, Vestiaire Collective\n` +
    `• Furniture / home → IKEA AE, Noon, Amazon AE, PAN Emirates\n` +
    `• General goods → Amazon AE, Noon, Carrefour AE, LuLu Hypermarket, eBay\n` +
    `• Used / second-hand → OLX, Dubizzle, eBay, OpenSooq, Haraj`

  const prompt =
    `You are a real-time price discovery API. Find REAL, active listings for: "${query}"\n\n` +
    `${geoLine}\n\n` +
    `${siteHints}\n\n` +
    `Search strategy:\n` +
    `1. Search for "${query} for sale" on multiple platforms — search the user's country first, then globally.\n` +
    `2. For each platform, find INDIVIDUAL LISTING PAGES (not category pages, not search result pages).\n` +
    `3. Visit each listing page and read the actual price shown on that page.\n` +
    `4. ONLY include a result when you have confirmed a real price is shown on that specific page.\n\n` +
    `STRICT RULES — violating these will make the API useless:\n` +
    `- NEVER include a page that says "No results found", "No listings", or "0 results".\n` +
    `- NEVER make up or estimate a price. Only include prices you actually READ on the listing page.\n` +
    `- NEVER include search or category pages that don't show a specific price for one item.\n` +
    `- DO include both new and used/second-hand listings.\n` +
    `- Aim for 8–15 individual listings from at least 3 different platforms.\n\n` +
    `For each confirmed listing extract:\n` +
    `- retailer: platform name (e.g. "OLX Lebanon", "Dubizzle UAE", "Amazon AE")\n` +
    `- url: direct URL to the listing page\n` +
    `- title: exact product title shown on the page\n` +
    `- condition: one of "New", "Used - Good", "Used - Fair", "Used - Poor", "Refurbished", "Unknown"\n` +
    `- price: number (e.g. 10000) — never a string, never null if you confirmed a price\n` +
    `- originalPrice: crossed-out/was-price if on sale, otherwise null\n` +
    `- currency: the currency shown (USD, AED, GBP, EUR, SAR, LBP, etc.)\n` +
    `- availability: "In Stock", "Out of Stock", or "Unknown"\n` +
    `- imageUrl: product image URL from the listing (null if not visible)\n` +
    `- location: city/area shown on listing (e.g. "Beirut - Ras Al Nabaa", "Dubai - Deira") — null if not shown\n` +
    `- details: key specs in one line (e.g. "150,000 km · 2010 · Coupe" for cars, "256GB · Space Black" for phones) — null if not applicable\n\n` +
    `OUTPUT: Return ONLY the raw JSON array. No markdown, no explanation, no text before or after.\n\n` +
    `[{"retailer":"OLX Lebanon","url":"https://www.olx.com.lb/item/...","title":"Infiniti G37 Coupe 2010","condition":"Used - Good","price":10000,"originalPrice":null,"currency":"USD","availability":"In Stock","imageUrl":"https://...","location":"Beirut - Ras Al Nabaa","details":"150,000 km · 2010 · Coupe"}]`

  logger.info("[B2CSearch] Starting", { query, countryHint })

  try {
    const data = await callClaude(apiKey, {
      model:      "claude-sonnet-4-6",
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
          location:      r.location ? String(r.location).trim() : null,
          details:       r.details  ? String(r.details).trim()  : null,
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
