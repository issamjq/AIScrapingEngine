import { callClaude } from "../utils/claudeClient"
import { ScraperEngine } from "../scraper/engine"
import { getConfig } from "../scraper/companyConfigs"
import { logger } from "../utils/logger"

// Domains that have CSS selector configs → try selectors first, skip Vision AI if price found
const SELECTOR_DOMAINS: Record<string, string> = {
  "amazon.ae":       "amazon-ae",
  "amazon.com":      "amazon-ae",
  "carrefouruae.com":"carrefour-uae",
}

function getSlugForUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace("www.", "")
    return SELECTOR_DOMAINS[host] ?? null
  } catch { return null }
}

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
      const urlMatches: string[] = text.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? []
      const uniqueUrls: string[] = [...new Set(urlMatches)]
        .filter((u: string) => !u.includes("anthropic.com") && u.length > 25)
        .slice(0, 12)
      if (uniqueUrls.length > 0) {
        parsed = uniqueUrls.map((url: string) => {
          const host: string = (() => { try { return new URL(url).hostname.replace("www.", "") } catch { return url } })()
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

    // Sort: country-hint matching domains rise to the top before dedup
    // Claude may return them anywhere in the list, but we always prioritise them
    const countrySlug = countryHint.toLowerCase().replace(/\s+/g, "")
    const withPriority = valid.map((r: any) => {
      try {
        const domain = new URL(r.url).hostname.toLowerCase()
        const isLocalSite = countrySlug && domain.includes(countrySlug)
        return { r, priority: isLocalSite ? 0 : 1 }
      } catch { return { r, priority: 1 } }
    })
    withPriority.sort((a, b) => a.priority - b.priority)

    // Deduplicate: keep only the first result per domain, cap at 5 unique sites
    const seenDomains = new Set<string>()
    const deduped = withPriority
      .map(({ r }) => r)
      .filter((r: any) => {
        try {
          const domain = new URL(r.url).hostname.replace("www.", "")
          if (seenDomains.has(domain)) return false
          seenDomains.add(domain)
          return seenDomains.size <= 5   // hard cap: 5 unique websites max
        } catch { return false }
      })

    logger.info("[B2CSearch] Web search done", { total: parsed.length, valid: valid.length, sites: deduped.length })
    return deduped
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
//
// Cost control:
//   MAX_LISTINGS_PER_SITE  — cap per source so one site can't dominate scrape budget
//   MAX_TOTAL_LISTINGS     — hard cap on total scrapes regardless of how many sites found
//   Together: max 2 × 5 = 10 → capped at 8 = at most 8 Vision AI calls per search
async function drillIntoSearchPages(
  searchPages: Array<{ retailer: string; url: string; title: string; condition: string }>,
  engine:      ScraperEngine,
  query:       string
): Promise<Array<{ retailer: string; url: string; title: string; condition: string }>> {
  const MAX_LISTINGS_PER_SITE = 2   // was 3 — saves 1 scrape per site
  const MAX_TOTAL_LISTINGS    = 8   // hard cap — never scrape more than 8 URLs total

  const queryKeywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  const result: typeof searchPages = []

  for (const sp of searchPages) {
    if (result.length >= MAX_TOTAL_LISTINGS) break
    try {
      const remaining = MAX_TOTAL_LISTINGS - result.length
      const take      = Math.min(MAX_LISTINGS_PER_SITE, remaining)
      const links     = await engine.getListingUrls(sp.url, take, queryKeywords)
      for (const url of links) {
        result.push({ retailer: sp.retailer, url, title: sp.title, condition: sp.condition })
        if (result.length >= MAX_TOTAL_LISTINGS) break
      }
    } catch {
      // skip this source entirely on error
    }
  }

  logger.info("[B2CSearch] Drill-down complete", { sites: searchPages.length, listings: result.length })
  return result
}

// ── Step 2b: Scrape each URL for price ────────────────────────────
async function scrapeUrls(
  items:  Array<{ retailer: string; url: string; title: string; condition: string }>,
  apiKey: string,
  engine: ScraperEngine,
  query:  string
): Promise<B2CResult[]> {
  const tasks = items.map((item) => async (): Promise<B2CResult> => {
    try {
      // Use CSS selectors for known sites → Vision AI only fires as fallback if price not found
      // This saves ~$0.05 per scrape on Amazon/Carrefour where selectors reliably work
      const slug    = getSlugForUrl(item.url)
      const config  = slug ? getConfig(slug) : null
      const selectors = config ? {
        price:        config.priceSelectors,
        title:        config.titleSelectors,
        availability: config.availabilitySelectors,
        waitFor:      config.waitForSelector ?? null,
        preferSelectors: false,   // still allow Vision AI fallback if selectors return null
      } : {}

      const result = await engine.scrape(item.url, selectors, {
        timeout:        20_000,
        blockResources: ["font", "media"],
        searchQuery:    query,
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

  // 2 concurrent scrapes — prevents Vision AI 429 rate limit (50k tokens/min)
  // Each Vision call ~5k tokens → 2 concurrent = 10k tokens/batch, well within limit
  return await withConcurrency(tasks, 2)
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
    const listings = await drillIntoSearchPages(webResults, engine, query)
    logger.info("[B2CSearch] After drill-down", { searchPages: webResults.length, listings: listings.length })

    // Step 2b: Scrape individual listings for price + details
    let scraped: B2CResult[]
    try {
      scraped = await scrapeUrls(listings, apiKey, engine, query)
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
