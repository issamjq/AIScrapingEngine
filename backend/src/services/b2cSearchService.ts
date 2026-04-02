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
    `You are a price discovery API. Your output must ALWAYS be a raw JSON array — never plain text.\n\n` +
    `Search for: "${query}"\n` +
    `${geoLine}\n\n` +
    `${siteHints}\n\n` +
    `Rules:\n` +
    `1. Use web search now to find pages about this item.\n` +
    `2. Include BOTH new AND used/second-hand listings.\n` +
    `3. Specific listing URLs are preferred, but search/category page URLs are ALSO acceptable.\n` +
    `4. If you can only find category pages or general search pages — include them. They are valid.\n` +
    `5. Aim for 10–15 results from different platforms.\n\n` +
    `CRITICAL OUTPUT RULES:\n` +
    `- Output ONLY the JSON array. Zero other text.\n` +
    `- NEVER write "I was unable to find", "I apologize", or any explanation.\n` +
    `- NEVER return an empty response. If you found any relevant page at all, include it.\n` +
    `- If specific listings are unavailable, use the search results page URL for that platform.\n\n` +
    `JSON format (this is your entire response — nothing before, nothing after):\n` +
    `[{"retailer":"YallaMotor","url":"https://uae.yallamotor.com/used-cars/infiniti/g37","title":"Infiniti G37 2010 for sale UAE","condition":"Unknown"}]`

  logger.info("[B2CSearch] Web search start", { query, countryHint })

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
      logger.warn("[B2CSearch] No JSON array found — trying URL fallback", { snippet: text.slice(0, 400) })
      // Haiku sometimes returns conversational text mentioning URLs — extract them directly
      const urlMatches = text.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? []
      const uniqueUrls = [...new Set(urlMatches)]
        .filter((u) => !u.includes("anthropic.com") && u.length > 25)
        .slice(0, 12)
      if (uniqueUrls.length > 0) {
        parsed = uniqueUrls.map((url) => {
          const host = (() => { try { return new URL(url).hostname.replace("www.", "") } catch { return url } })()
          const retailer = host.split(".")[0].charAt(0).toUpperCase() + host.split(".")[0].slice(1)
          return { retailer, url, title: query, condition: "Unknown" }
        })
        logger.info("[B2CSearch] URL fallback extracted", { count: parsed.length })
      } else {
        return []
      }
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

// ── Step 2a: Drill into search/category pages → individual listing URLs ──
async function drillIntoSearchPages(
  searchPages: Array<{ retailer: string; url: string; title: string; condition: string }>,
  engine:      ScraperEngine
): Promise<Array<{ retailer: string; url: string; title: string; condition: string }>> {
  const result: typeof searchPages = []

  // Drill into the first 3 search pages (enough for good coverage without excessive requests)
  for (const sp of searchPages.slice(0, 3)) {
    try {
      const links = await engine.getListingUrls(sp.url, 5)
      if (links.length > 0) {
        for (const url of links) {
          result.push({ retailer: sp.retailer, url, title: sp.title, condition: sp.condition })
        }
      } else {
        result.push(sp)   // no individual links found — keep the search page
      }
    } catch {
      result.push(sp)
    }
  }

  // Remaining search pages appended as-is (breadth)
  result.push(...searchPages.slice(3))
  return result
}

// ── Step 2b: Scrape each URL for price ────────────────────────────
async function scrapeUrls(
  items:  Array<{ retailer: string; url: string; title: string; condition: string }>,
  apiKey: string,
  engine: ScraperEngine
): Promise<B2CResult[]> {
  const tasks = items.map((item) => async (): Promise<B2CResult> => {
    try {
      const result = await engine.scrape(item.url, {}, {
        timeout:        20_000,
        blockResources: ["font", "media"],   // keep images for Vision AI
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

  // 3 concurrent scrapes
  return await withConcurrency(tasks, 3)
}

// ── Main export ───────────────────────────────────────────────────
export async function b2cSearch(query: string, apiKey: string, countryHint = ""): Promise<B2CResult[]> {
  // Step 1: AI web search — finds search/category page URLs
  const webResults = await b2cWebSearch(query, apiKey, countryHint)
  if (webResults.length === 0) return []

  const engine = new ScraperEngine()
  try {
    await engine.launch()

    // Step 2a: Drill into search pages to get individual listing URLs
    const listings = await drillIntoSearchPages(webResults, engine)
    logger.info("[B2CSearch] After drill-down", { searchPages: webResults.length, listings: listings.length })

    // Step 2b: Scrape individual listings for price + details
    let scraped: B2CResult[]
    try {
      scraped = await scrapeUrls(listings, apiKey, engine)
    } catch (err: any) {
      logger.warn("[B2CSearch] Scrape step failed, returning web-only results", { error: err.message })
      scraped = listings.map((item) => ({
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
  } finally {
    await engine.close().catch(() => {})
  }
}
