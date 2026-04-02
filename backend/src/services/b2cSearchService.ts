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
  countryHint: string
): Promise<Array<{ retailer: string; url: string; title: string; condition: string }>> {

  const geoLine = countryHint
    ? `The user is in ${countryHint}. Prioritise marketplaces popular there, then expand regionally and globally.`
    : `Search globally across all major marketplaces.`

  // Product-type hints so Claude knows which sites to search
  const siteHints =
    `Site guidance by product type (use whichever fits the query):\n` +
    `• Cars / vehicles → Dubizzle (dubizzle.com), YallaMotor (uae.yallamotor.com), CarSwitch (carswitch.com), OpenSooq (ae.opensooq.com), Haraj (haraj.com.sa), AutoTrader, Avito\n` +
    `• Electronics / phones → Amazon AE (amazon.ae), Noon (noon.com), Sharaf DG, Virgin Megastore, Back Market, eBay, Souq\n` +
    `• Fashion / luxury → Ounass, Level Shoes, Namshi, Farfetch, eBay, Vestiaire Collective\n` +
    `• Furniture / home → IKEA AE, West Elm, PAN Emirates, noon, Amazon\n` +
    `• General goods → Amazon AE, Noon, Carrefour AE, LuLu Hypermarket, eBay\n` +
    `• Any product → also check local classified sites: Dubizzle, OLX, Melltoo, Facebook Marketplace`

  const prompt =
    `You are an expert price discovery assistant — like a smart shopping agent.\n` +
    `A user wants to find: "${query}"\n\n` +
    `${geoLine}\n\n` +
    `${siteHints}\n\n` +
    `Instructions:\n` +
    `1. Search the web right now for real, active listings of this exact item.\n` +
    `2. Include both new AND used/second-hand listings.\n` +
    `3. For classifieds (Dubizzle, OLX, etc.) the search results page URL is acceptable — include it.\n` +
    `4. Aim for 10–15 diverse listings from different sellers/platforms.\n` +
    `5. For each result determine the condition from the title or listing text.\n\n` +
    `Return ONLY a valid JSON array — no explanation, no markdown, no extra text:\n` +
    `[{"retailer":"Dubizzle","url":"https://www.dubizzle.com/...","title":"2010 Infiniti G37 S Coupe","condition":"Used - Good"}]\n\n` +
    `condition must be one of exactly: "New", "Used - Good", "Used - Fair", "Used - Poor", "Refurbished", "Unknown"`

  logger.info("[B2CSearch] Web search start", { query, countryHint })

  try {
    const data = await callClaude(apiKey, {
      model:      "claude-sonnet-4-6",
      max_tokens: 4096,
      tools:      [{ type: "web_search_20250305", name: "web_search" }],
      messages:   [{ role: "user", content: prompt }],
      beta:       "web-search-2025-03-05",
    })

    const text = (data?.content ?? [])
      .filter((b: any) => b.type === "text" && b.text)
      .map((b: any) => b.text as string)
      .join("\n")

    logger.info("[B2CSearch] Raw response length", { chars: text.length, snippet: text.slice(0, 400) })

    // Extract JSON — handle code-fenced block, bare array, or wrapped object
    let parsed: any[] = []
    try {
      const fenced = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)
      if (fenced) {
        parsed = JSON.parse(fenced[1])
      } else {
        const arrMatch = text.match(/\[[\s\S]*\]/)
        if (arrMatch) {
          parsed = JSON.parse(arrMatch[0])
        } else {
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
      logger.warn("[B2CSearch] JSON parse error", { error: parseErr.message, snippet: text.slice(0, 400) })
      return []
    }

    if (parsed.length === 0) {
      logger.warn("[B2CSearch] No JSON array found in response", { snippet: text.slice(0, 400) })
      return []
    }

    // Normalize URLs — add https:// if scheme is missing
    const normalized = parsed.map((r: any) => ({
      ...r,
      url: r.url && !r.url.startsWith("http") ? `https://${r.url.replace(/^\/\//, "")}` : r.url,
    }))

    const valid = normalized.filter((r: any) => r.retailer && r.url?.startsWith("http") && r.title)
    logger.info("[B2CSearch] Web search done", { total: parsed.length, valid: valid.length })
    return valid
  } catch (err: any) {
    logger.error("[B2CSearch] Web search error", { error: (err as any).message })
    throw err
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

  // Always return something — even if web search found listings but scraping fails,
  // show the listings with "visit listing" so the user isn't left with 0 results.
  if (webResults.length === 0) return []

  let scraped: B2CResult[]
  try {
    scraped = await scrapeUrls(webResults, apiKey)
  } catch (err: any) {
    logger.warn("[B2CSearch] Scrape step failed entirely, returning web-only results", { error: err.message })
    // Scraping failed completely — return web search results without prices
    scraped = webResults.map((item) => ({
      retailer:      item.retailer,
      url:           item.url,
      title:         item.title,
      condition:     item.condition || "Unknown",
      price:         null,
      originalPrice: null,
      currency:      "AED",
      availability:  "unknown",
      imageUrl:      null,
      priceSource:   "not_found" as const,
    }))
  }

  // Sort: price-found first (ascending), then no-price at the end
  return scraped.sort((a, b) => {
    if (a.price !== null && b.price !== null) return a.price - b.price
    if (a.price !== null) return -1
    if (b.price !== null) return 1
    return 0
  })
}
