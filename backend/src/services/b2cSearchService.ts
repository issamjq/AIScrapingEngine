import { callClaude } from "../utils/claudeClient"
import { ScraperEngine } from "../scraper/engine"
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

// ── Step 1: Claude web search ─────────────────────────────────────
async function b2cWebSearch(
  query:       string,
  apiKey:      string,
  countryHint: string   // e.g. "United Arab Emirates", "Lebanon", "Egypt" — from IP geo-detection
): Promise<Array<{ retailer: string; url: string; title: string; condition: string }>> {
  const geoContext = countryHint
    ? `The user is located in ${countryHint}. Search on marketplaces and retailers popular in ${countryHint} first, then expand globally if needed.`
    : `Search globally across all major marketplaces and retailers.`

  const prompt =
    `You are a world-class price discovery AI. Find the best product listings for: "${query}"\n\n` +
    `${geoContext}\n\n` +
    `Search strategy:\n` +
    `1. Start with the user's local country marketplaces (e-commerce sites, classifieds, retailers)\n` +
    `2. If the product is scarce locally, expand to regional and global marketplaces\n` +
    `3. Include both new and used/second-hand listings where relevant\n` +
    `4. Search any marketplace that sells this type of product (Amazon, eBay, Noon, Dubizzle, OLX, local classifieds, brand websites, etc.)\n\n` +
    `For EACH listing, return:\n` +
    `- retailer: the marketplace/platform name\n` +
    `- url: the direct product or listing page URL\n` +
    `- title: the exact product title as shown on the listing\n` +
    `- condition: classify strictly as one of: "New", "Used - Good", "Used - Fair", "Used - Poor", "Refurbished", "Unknown"\n` +
    `  (determine from title, description, or seller notes)\n\n` +
    `Rules:\n` +
    `- Only direct product/listing pages (not search results or category pages)\n` +
    `- Focus on the most competitive prices and most relevant listings\n` +
    `- Return at most 15 results total\n` +
    `- No duplicates\n\n` +
    `Return ONLY a JSON array, no other text:\n` +
    `[{"retailer":"Dubizzle","url":"https://...","title":"...","condition":"Used - Good"}]`

  logger.info("[B2CSearch] Web search", { query, countryHint })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 75_000)

  try {
    const data = await callClaude(apiKey, {
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      tools:      [{ type: "web_search_20250305", name: "web_search" }],
      messages:   [{ role: "user", content: prompt }],
      beta:       "web-search-2025-03-05",
    })

    const text = (data?.content ?? [])
      .filter((b: any) => b.type === "text" && b.text)
      .map((b: any) => b.text as string)
      .join("\n")

    // Extract JSON — handle plain array, code-block array, or wrapped object
    let parsed: any[] = []
    try {
      // 1) Try code-fenced block: ```json [...] ```
      const fenced = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)
      if (fenced) {
        parsed = JSON.parse(fenced[1])
      } else {
        // 2) Try bare array anywhere in text
        const arrMatch = text.match(/\[[\s\S]*\]/)
        if (arrMatch) {
          parsed = JSON.parse(arrMatch[0])
        } else {
          // 3) Try JSON object with a known wrapper key
          const objMatch = text.match(/\{[\s\S]*\}/)
          if (objMatch) {
            const obj = JSON.parse(objMatch[0])
            for (const key of ["results", "listings", "items", "products", "data"]) {
              if (Array.isArray(obj[key])) { parsed = obj[key]; break }
            }
          }
        }
      }
    } catch (parseErr: any) {
      logger.warn("[B2CSearch] JSON parse error", { error: parseErr.message, snippet: text.slice(0, 300) })
      return []
    }

    if (parsed.length === 0) {
      logger.warn("[B2CSearch] No JSON in web search response", { snippet: text.slice(0, 300) })
      return []
    }

    // Normalize URLs — add https:// if scheme is missing
    const normalized = parsed.map((r: any) => ({
      ...r,
      url: r.url && !r.url.startsWith("http") ? `https://${r.url.replace(/^\/\//, "")}` : r.url,
    }))

    const valid = normalized.filter((r: any) => r.retailer && r.url?.startsWith("http") && r.title)
    logger.info("[B2CSearch] Web search found", { total: parsed.length, valid: valid.length })
    return valid
  } catch (err: any) {
    if (err.name === "AbortError") {
      logger.warn("[B2CSearch] Web search timeout")
      return []
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ── Simple concurrency limiter ────────────────────────────────────
async function withConcurrency<T>(
  tasks:     Array<() => Promise<T>>,
  maxActive: number
): Promise<T[]> {
  const results: T[]              = new Array(tasks.length)
  const active:  Promise<void>[]  = []

  for (let i = 0; i < tasks.length; i++) {
    const idx = i
    const p   = (async () => { results[idx] = await tasks[idx]() })()
    active.push(p)
    if (active.length >= maxActive) await Promise.race(active)
    // clean settled
    for (let j = active.length - 1; j >= 0; j--) {
      active[j] = active[j].then(() => {
        active.splice(j, 1)
      }).catch(() => {
        active.splice(j, 1)
      })
    }
  }

  await Promise.allSettled(active)
  return results
}

// ── Step 2: Scrape each URL for price ─────────────────────────────
async function scrapeUrls(
  items:  Array<{ retailer: string; url: string; title: string; condition: string }>,
  apiKey: string
): Promise<B2CResult[]> {
  const engine = new ScraperEngine()
  try {
    await engine.launch()

    const tasks = items.map((item) => async (): Promise<B2CResult> => {
      try {
        const result = await engine.scrape(item.url, {}, {
          timeout:         20_000,
          blockResources:  ["font", "media"],   // keep images so Vision AI can see the page
        })
        return {
          retailer:      item.retailer,
          url:           item.url,
          title:         result.title || item.title,
          condition:     item.condition || "Unknown",
          price:         result.price,
          originalPrice: result.originalPrice,
          currency:      result.currency || "AED",
          availability:  result.availability || "unknown",
          imageUrl:      result.imageUrl,
          priceSource:   result.price !== null ? "scraped" : "not_found",
        }
      } catch (err: any) {
        logger.warn("[B2CSearch] Scrape failed", { url: item.url, error: err.message })
        return {
          retailer:      item.retailer,
          url:           item.url,
          title:         item.title,
          condition:     item.condition || "Unknown",
          price:         null,
          originalPrice: null,
          currency:      "AED",
          availability:  "unknown",
          imageUrl:      null,
          priceSource:   "not_found",
        }
      }
    })

    // 3 concurrent scrapes — Vision AI fallback is already built into engine.scrape()
    return await withConcurrency(tasks, 3)
  } finally {
    await engine.close().catch(() => {})
  }
}

// ── Main export ───────────────────────────────────────────────────
export async function b2cSearch(query: string, apiKey: string, countryHint = ""): Promise<B2CResult[]> {
  const webResults = await b2cWebSearch(query, apiKey, countryHint)
  if (webResults.length === 0) return []

  const scraped = await scrapeUrls(webResults, apiKey)

  // Sort: price-found first (ascending), then no-price at the end
  return scraped.sort((a, b) => {
    if (a.price !== null && b.price !== null) return a.price - b.price
    if (a.price !== null) return -1
    if (b.price !== null) return 1
    return 0
  })
}
