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

// ── Step 0: Query normalization (fix typos before searching) ──────
async function normalizeQuery(query: string, apiKey: string): Promise<string> {
  try {
    const data = await callClaude(apiKey, {
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages:   [{
        role:    "user",
        content: `Fix any spelling mistakes or typos in this product search query. Return ONLY the corrected query — nothing else, no explanation.\n\nQuery: "${query}"`,
      }],
    })
    const corrected = (data?.content?.[0]?.text || "").trim().replace(/^["']|["']$/g, "")
    if (corrected && corrected.length > 0 && corrected !== query) {
      logger.info("[B2CSearch] Query normalized", { original: query, corrected })
    }
    return corrected || query
  } catch {
    return query  // if normalization fails, use original
  }
}

// ── Step 1: Claude web search ─────────────────────────────────────
async function b2cWebSearch(
  query:       string,
  apiKey:      string,
  countryHint: string,
  siteCap:     number = 10
): Promise<Array<{ retailer: string; url: string; title: string; condition: string }>> {

  const geoLine = countryHint
    ? `The user is in ${countryHint}. Use your knowledge to find the best marketplaces and retailers for this product IN ${countryHint} first — whatever platforms people actually use there. Then expand regionally and globally if needed.`
    : `Search globally across all major marketplaces.`

  const prompt =
    `You are a price discovery API. Your output must ALWAYS be a raw JSON array — never plain text.\n\n` +
    `Search for: "${query}"\n` +
    `${geoLine}\n\n` +
    `Rules:\n` +
    `1. Use web search now to find pages about this item.\n` +
    `2. Include BOTH new AND used/second-hand listings.\n` +
    `3. Specific listing URLs are preferred, but search/category page URLs are ALSO acceptable.\n` +
    `4. If you can only find category pages or general search pages — include them. They are valid.\n` +
    `5. Find EXACTLY ${siteCap} results from ${siteCap} different platforms/domains. No more, no less.\n\n` +
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

    // Deduplicate: keep only the first result per domain, cap at 10 unique sites
    const seenDomains = new Set<string>()
    const deduped = withPriority
      .map(({ r }) => r)
      .filter((r: any) => {
        try {
          const domain = new URL(r.url).hostname.replace("www.", "")
          if (seenDomains.has(domain)) return false
          seenDomains.add(domain)
          return seenDomains.size <= siteCap  // capped by batch size
        } catch { return false }
      })

    logger.info("[B2CSearch] Web search done", { total: parsed.length, valid: valid.length, sites: deduped.length })
    return deduped
  } catch (err: any) {
    logger.error("[B2CSearch] Web search error", { error: (err as any).message })
    throw err
  }
}

// ── Concurrency limiter ───────────────────────────────────────────────────────
async function withConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  const executing    = new Set<Promise<void>>()

  for (let i = 0; i < tasks.length; i++) {
    const idx = i
    const p: Promise<void> = (async () => { results[idx] = await tasks[idx]() })()
      .finally(() => executing.delete(p))
    executing.add(p)
    if (executing.size >= limit) await Promise.race(executing)
  }
  await Promise.all(executing)
  return results
}

// ── Detect if a URL is already an individual product/listing page ─────────────
function isProductPage(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase()
    // Shopify: /products/slug (not just /products or /products/)
    if (/\/products\/[^/]{3,}\/?$/.test(path)) return true
    // WooCommerce: /product/slug
    if (/\/product\/[^/]{3,}\/?$/.test(path)) return true
    // Generic listing patterns
    if (/\/(item|listing|ad|p)\/[^/]/.test(path)) return true
    return false
  } catch { return false }
}

// ── Step 2a: Drill into search/category pages → individual listing URLs ──
async function drillIntoSearchPages(
  searchPages: Array<{ retailer: string; url: string; title: string; condition: string }>,
  engine:      ScraperEngine,
  query:       string,
  concurrency: number = 3
): Promise<Array<{ retailer: string; url: string; title: string; condition: string }>> {
  // Strip modifier/filler words — only keep actual product keywords for URL matching.
  // "cheap headphones" → ["headphones"], "good laptop under 500" → ["laptop"], "used iphone" → ["iphone"]
  const MODIFIER_WORDS = new Set([
    // opinion/quality
    "good", "best", "great", "nice", "bad", "worst", "perfect", "top", "amazing",
    // price/budget
    "cheap", "affordable", "budget", "expensive", "premium", "luxury", "price", "deal", "low", "high",
    // condition
    "used", "new", "old", "refurbished", "second", "hand",
    // range words
    "under", "over", "above", "below", "around", "less", "more", "than",
    // filler
    "for", "with", "the", "and", "or", "in", "at", "buy",
  ])
  const queryKeywords = query.toLowerCase().split(/\s+/)
    .filter((w) => w.length > 2)
    .filter((w) => !MODIFIER_WORDS.has(w) && !(/^\d+$/.test(w) && parseInt(w) >= 100))  // drop modifiers + bare prices (≥100) but keep model numbers like "16", "17", "24"

  // Drill ALL sites in parallel (capped by concurrency) — sequential was the main latency bottleneck
  const drillTasks = searchPages.map((sp) => async (): Promise<typeof searchPages> => {
    try {
      if (isProductPage(sp.url)) {
        logger.info("[B2CSearch] Product page — using directly", { url: sp.url })
        return [sp]
      }
      const links = await engine.getListingUrls(sp.url, 3, queryKeywords)
      return links.map((url: string) => ({ retailer: sp.retailer, url, title: sp.title, condition: sp.condition }))
    } catch {
      return []
    }
  })

  const nested = await withConcurrency(drillTasks, concurrency)
  const result = nested.flat()

  logger.info("[B2CSearch] Drill-down complete", { sites: searchPages.length, listings: result.length })
  return result
}

// Generic CSS price selectors for common e-commerce platforms.
// Tried first (preferSelectors:true) — Vision AI only fires if all return null.
// This drastically reduces Vision API token usage for Shopify + WooCommerce sites.
const B2C_PRICE_SELECTORS = [
  // Shopify — sale price FIRST: only present on the main product when on sale.
  // Related-product carousels only use .price-item--regular, so this selector
  // naturally skips them and returns the discounted price (e.g. $125 not $1,025).
  ".price-item--sale",
  ".price-item.price-item--sale",
  // Shopify — regular price (fallback when not on sale)
  ".price__regular .price-item--regular",
  ".price-item.price-item--regular",
  ".price-item--regular",
  "[data-product-price]",
  // WooCommerce
  ".price ins .woocommerce-Price-amount bdi",
  ".price > .woocommerce-Price-amount bdi",
  ".price .woocommerce-Price-amount bdi",
  ".woocommerce-Price-amount bdi",
  // Generic structured data
  '[itemprop="price"]',
  ".product__price",
  ".product-price",
]

const B2C_TITLE_SELECTORS = [
  "h1.product_title",       // WooCommerce
  "h1.product__title",      // Shopify
  "h1.title",
  'h1[itemprop="name"]',
  "h1",
]

// ── Step 2b: Scrape each URL for price ────────────────────────────
async function scrapeUrls(
  items:   Array<{ retailer: string; url: string; title: string; condition: string }>,
  apiKey:  string,
  engine:  ScraperEngine,
  query:   string,
  siteCap: number = 10
): Promise<B2CResult[]> {
  // Timeout scales with depth: Quick=12s, Standard=15s, Deep=20s
  // Faster modes give up sooner on slow sites so they don't drag out the whole search
  const perSiteTimeout = siteCap <= 3 ? 12_000 : siteCap <= 6 ? 15_000 : 20_000

  // 4-concurrent scraping — JSON-LD first (free for Shopify/WooCommerce), Vision AI fallback
  const tasks = items.map((item) => async (): Promise<B2CResult> => {
    try {
      const result = await engine.scrape(item.url, {
        price:           [],
        title:           B2C_TITLE_SELECTORS,
        preferSelectors: true,
      }, {
        timeout:        perSiteTimeout,
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

  return withConcurrency(tasks, 4)
}

// ── Main export ───────────────────────────────────────────────────
export async function b2cSearch(query: string, apiKey: string, countryHint = "", siteCap = 10): Promise<{ results: B2CResult[]; correctedQuery: string | null }> {
  // Step 0: Normalize query — fix typos before searching
  const originalQuery  = query
  const correctedQuery = await normalizeQuery(query, apiKey)
  const searchQuery    = correctedQuery || query
  const wasCorrected   = searchQuery.toLowerCase() !== originalQuery.toLowerCase()

  // Step 1: AI web search — finds search/category page URLs (capped by siteCap)
  const webResults = await b2cWebSearch(searchQuery, apiKey, countryHint, siteCap)
  const empty = { results: [], correctedQuery: wasCorrected ? searchQuery : null }
  if (webResults.length === 0) return empty

  const engine = new ScraperEngine()
  try {
    await engine.launch()

    // Step 2a: Drill into search pages to get individual listing URLs (parallel)
    const drillConcurrency = siteCap <= 3 ? 3 : siteCap <= 6 ? 4 : 5
    const listings = await drillIntoSearchPages(webResults, engine, searchQuery, drillConcurrency)
    logger.info("[B2CSearch] After drill-down", { searchPages: webResults.length, listings: listings.length })

    // Step 2b: Scrape individual listings for price + details
    let scraped: B2CResult[]
    try {
      scraped = await scrapeUrls(listings, apiKey, engine, searchQuery, siteCap)
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

    return {
      results:        scraped.filter(r => r.price !== null).sort((a, b) => (a.price ?? 0) - (b.price ?? 0)),
      correctedQuery: wasCorrected ? searchQuery : null,
    }
  } finally {
    await engine.close().catch(() => {})
  }
}
