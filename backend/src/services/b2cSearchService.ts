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
  query:       string
): Promise<Array<{ retailer: string; url: string; title: string; condition: string }>> {
  // Extract keywords from query to filter extracted links (e.g. ["infiniti","g37","coupe","2010"])
  const queryKeywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)

  const result: typeof searchPages = []

  // Drill into ALL search pages (already capped at 5 unique sites from web search step)
  // Get 2 individual listing URLs per site → max 5 × 2 = 10 total listings
  for (const sp of searchPages) {
    try {
      // If Claude already returned a specific product page URL, skip drill-down
      // (e.g. Shopify /products/slug — drilling in finds only image gallery URLs)
      if (isProductPage(sp.url)) {
        result.push(sp)
        logger.info("[B2CSearch] Product page — using directly", { url: sp.url })
        continue
      }

      const links = await engine.getListingUrls(sp.url, 2, queryKeywords)
      // Only keep individual listing URLs — never fall back to the search/list page itself
      // (scraping a list page causes Vision AI to pick a price from a random card on the page)
      for (const url of links) {
        result.push({ retailer: sp.retailer, url, title: sp.title, condition: sp.condition })
      }
    } catch {
      // skip this source entirely on error
    }
  }

  logger.info("[B2CSearch] Drill-down complete", { sites: searchPages.length, listings: result.length })
  return result
}

// Generic CSS price selectors for common e-commerce platforms.
// Tried first (preferSelectors:true) — Vision AI only fires if all return null.
// This drastically reduces Vision API token usage for Shopify + WooCommerce sites.
const B2C_PRICE_SELECTORS = [
  // Shopify
  ".price__regular .price-item--regular",
  ".price-item.price-item--regular",
  ".price-item--regular",
  ".price-item--sale",
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
  items:  Array<{ retailer: string; url: string; title: string; condition: string }>,
  apiKey: string,
  engine: ScraperEngine,
  query:  string
): Promise<B2CResult[]> {
  const results: B2CResult[] = []

  // Sequential with 3s gap between Vision-capable calls.
  // preferSelectors:true means CSS selectors run first; Vision only fires as fallback
  // for sites where all CSS selectors return null. Shopify/WooCommerce sites will
  // resolve via CSS and never touch the Vision token budget.
  for (let i = 0; i < items.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 3_000))

    const item = items[i]
    try {
      const result = await engine.scrape(item.url, {
        price:          B2C_PRICE_SELECTORS,
        title:          B2C_TITLE_SELECTORS,
        preferSelectors: true,              // CSS first — Vision only if all selectors fail
      }, {
        timeout:        20_000,
        blockResources: ["font", "media"],  // keep images loaded in case Vision is needed
        searchQuery:    query,              // tells Vision AI which listing card to pick
      })
      results.push({
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
      })
    } catch (err: any) {
      logger.warn("[B2CSearch] Scrape failed", { url: item.url, error: err.message })
      results.push({
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
      })
    }
  }

  return results
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
