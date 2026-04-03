import { createHash } from "crypto"
import { callClaude } from "../utils/claudeClient"
import { ScraperEngine } from "../scraper/engine"
import { query as dbQuery } from "../db"
import { logger } from "../utils/logger"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductIntent {
  product_type: string
  brand:        string | null
  model:        string | null
  attributes:   string[]
  price_range:  { min: number | null; max: number | null; currency?: string }
  condition:    "new" | "used" | "any"
  location:     string | null
  keywords:     string[]
}

export interface SearchResult {
  title:          string
  price:          number | null
  original_price: number | null
  currency:       string
  image:          string | null
  condition:      string
  location:       string | null
  seller:         string
  availability:   string
  url:            string
  source:         string
  details:        string | null
  score:          number
}

export interface SearchResponse {
  query:   string
  intent:  ProductIntent
  results: SearchResult[]
  cached:  boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace domain whitelist
// ─────────────────────────────────────────────────────────────────────────────

const MARKETPLACE_DOMAINS = [
  // Classifieds / cars
  "olx.com", "dubizzle.com", "opensooq.com", "haraj.com.sa",
  "yallamotor.com", "carswitch.com", "dubicars.com", "avito.ru",
  // E-commerce
  "amazon.ae", "amazon.com", "amazon.co.uk", "amazon.sa",
  "noon.com", "ebay.com", "ebay.co.uk",
  "namshi.com", "ounass.com", "farfetch.com",
  "sharafdg.com", "backmarket.com", "backmarket.co.uk",
  // Grocery / general
  "luluhypermarket.com", "carrefouruae.com", "spinneys.com",
  // Fashion
  "levelshoes.com", "sivvi.com",
  // Furniture
  "ikea.com", "panemirates.com",
]

function getSourceName(url: string): string {
  try {
    const host = new URL(url).hostname.replace("www.", "")
    // Make a readable name: olx.com.lb → OLX Lebanon, amazon.ae → Amazon AE
    const parts = host.split(".")
    const name  = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
    const tld   = parts[parts.length - 1]
    const TLD_LABEL: Record<string, string> = {
      ae: "AE", lb: "Lebanon", sa: "Saudi", com: "", uk: "UK",
      ru: "Russia", eg: "Egypt", jo: "Jordan", kw: "Kuwait",
    }
    const label = TLD_LABEL[tld] ?? tld.toUpperCase()
    return label ? `${name} ${label}` : name
  } catch {
    return "Unknown"
  }
}

function isMarketplaceUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace("www.", "")
    return MARKETPLACE_DOMAINS.some(d => host.endsWith(d) || host.includes(d.split(".")[0]))
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCacheKey(query: string): string {
  return createHash("sha256")
    .update(query.toLowerCase().trim().replace(/\s+/g, " "))
    .digest("hex")
}

async function getCached(query: string): Promise<SearchResult[] | null> {
  try {
    const key = makeCacheKey(query)
    const { rows } = await dbQuery(
      `SELECT results FROM search_cache
       WHERE cache_key = $1 AND created_at > NOW() - INTERVAL '6 hours' LIMIT 1`,
      [key]
    )
    if (rows.length === 0) return null
    const results = rows[0].results as SearchResult[]
    if (!Array.isArray(results) || results.length === 0) {
      await dbQuery(`DELETE FROM search_cache WHERE cache_key = $1`, [key]).catch(() => {})
      return null
    }
    await dbQuery(`UPDATE search_cache SET hit_count = hit_count + 1 WHERE cache_key = $1`, [key]).catch(() => {})
    return results
  } catch {
    return null
  }
}

async function setCached(query: string, results: SearchResult[]): Promise<void> {
  if (results.length === 0) return
  try {
    const key = makeCacheKey(query)
    await dbQuery(
      `INSERT INTO search_cache (cache_key, query_text, results)
       VALUES ($1, $2, $3)
       ON CONFLICT (cache_key) DO UPDATE
         SET results = $3, created_at = NOW(), hit_count = 1`,
      [key, query, JSON.stringify(results)]
    )
  } catch { /* non-fatal */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1: Query Understanding (Claude Haiku — no web search)
// ─────────────────────────────────────────────────────────────────────────────

async function parseIntent(query: string, apiKey: string): Promise<ProductIntent> {
  const fallback: ProductIntent = {
    product_type: "product", brand: null, model: null, attributes: [],
    price_range: { min: null, max: null }, condition: "any", location: null,
    keywords: query.toLowerCase().split(/\s+/).filter(w => w.length > 2),
  }

  try {
    const data = await callClaude(apiKey, {
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages:   [{
        role: "user",
        content:
          `Parse this product search query into JSON. Return ONLY raw JSON.\n` +
          `Query: "${query}"\n\n` +
          `{"product_type":"car|phone|laptop|shoe|etc","brand":"or null","model":"or null",` +
          `"attributes":["256GB","white","2010"],"price_range":{"min":null,"max":200,"currency":"USD"},` +
          `"condition":"new|used|any","location":"Lebanon|UAE|null","keywords":["key","words"]}`
      }],
    })
    const text  = data?.content?.[0]?.text || "{}"
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return fallback
    const p = JSON.parse(match[0])
    return {
      product_type: p.product_type || "product",
      brand:        p.brand        || null,
      model:        p.model        || null,
      attributes:   Array.isArray(p.attributes) ? p.attributes : [],
      price_range:  p.price_range  || { min: null, max: null },
      condition:    ["new","used","any"].includes(p.condition) ? p.condition : "any",
      location:     p.location     || null,
      keywords:     Array.isArray(p.keywords) ? p.keywords : fallback.keywords,
    }
  } catch {
    return fallback
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2: Query Expansion
// ─────────────────────────────────────────────────────────────────────────────

function expandQueries(intent: ProductIntent, original: string, countryHint: string): string[] {
  const geo      = intent.location || countryHint
  const variants = [original]

  if (intent.brand && intent.model) {
    const base = `${intent.brand} ${intent.model} ${intent.attributes.join(" ")}`.trim()
    variants.push(`${base} for sale${geo ? " " + geo : ""}`)
    if (intent.condition === "used") variants.push(`used ${base}`)
  } else if (geo) {
    variants.push(`${original} ${geo}`)
  }

  if (intent.price_range.max) {
    variants.push(`${intent.model || intent.brand || intent.product_type} under ${intent.price_range.max}${intent.price_range.currency || ""}`)
  }

  return [...new Set(variants.map(v => v.trim()))].filter(Boolean).slice(0, 3)
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3: Search DuckDuckGo with Playwright → collect marketplace URLs
// ─────────────────────────────────────────────────────────────────────────────

async function searchDuckDuckGo(
  query:  string,
  engine: ScraperEngine
): Promise<Array<{ url: string; title: string }>> {
  const context = await engine.browser!.newContext({
    userAgent: engine._randomUserAgent(),
    locale:    "en-US",
    viewport:  { width: 1366, height: 768 },
  })
  try {
    await context.route("**/*", (route: any) => {
      if (["image", "font", "media", "stylesheet"].includes(route.request().resourceType()))
        route.abort()
      else route.continue()
    })

    const page = await context.newPage()
    const url  = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`
    await page.goto(url, { timeout: 20_000, waitUntil: "domcontentloaded" }).catch(() => {})

    const results = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".result__title a, .result a.result__a"))
        .map((el: any) => {
          const href  = el.getAttribute("href") || ""
          const title = el.textContent?.trim() || ""
          // DuckDuckGo wraps links: //duckduckgo.com/l/?uddg=<encoded>
          let realUrl = href
          try {
            if (href.includes("uddg=")) {
              const params = new URL("https:" + href).searchParams
              realUrl = decodeURIComponent(params.get("uddg") || href)
            } else if (href.startsWith("http")) {
              realUrl = href
            }
          } catch { /* keep href as-is */ }
          return { url: realUrl, title }
        })
        .filter((r: any) => r.url.startsWith("http") && !r.url.includes("duckduckgo.com"))
    }) as Array<{ url: string; title: string }>

    logger.info("[Search] DDG results", { query, count: results.length })
    return results
  } catch (err: any) {
    logger.warn("[Search] DDG failed", { query, error: err.message })
    return []
  } finally {
    await context.close().catch(() => {})
  }
}

async function collectMarketplaceUrls(
  queries:     string[],
  engine:      ScraperEngine
): Promise<Array<{ url: string; title: string; source: string }>> {
  const seen      = new Set<string>()
  const candidates: Array<{ url: string; title: string; source: string }> = []

  for (const q of queries) {
    const results = await searchDuckDuckGo(q, engine)
    for (const r of results) {
      if (!r.url || seen.has(r.url)) continue
      if (!isMarketplaceUrl(r.url))  continue
      seen.add(r.url)
      candidates.push({ url: r.url, title: r.title, source: getSourceName(r.url) })
      if (candidates.length >= 20) break
    }
    if (candidates.length >= 20) break
  }

  logger.info("[Search] Marketplace URLs collected", { count: candidates.length })
  return candidates
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4: Scrape each URL with ScraperEngine (Playwright + Haiku Vision)
// ─────────────────────────────────────────────────────────────────────────────

async function scrapeUrls(
  candidates: Array<{ url: string; title: string; source: string }>,
  engine:     ScraperEngine,
  apiKey:     string,
  query:      string
): Promise<SearchResult[]> {
  const results: SearchResult[] = []
  const CONCURRENCY = 2

  // Process in batches of CONCURRENCY
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY)
    const batch_results = await Promise.all(
      batch.map(async (c) => {
        try {
          const scraped = await engine.scrape(c.url, {}, {
            timeout:        25_000,
            blockResources: ["font", "media"],
            searchQuery:    query,
          })
          return {
            title:          scraped.title || c.title || c.source,
            price:          scraped.price,
            original_price: scraped.originalPrice,
            currency:       scraped.currency || "USD",
            image:          scraped.imageUrl,
            condition:      "Unknown",
            location:       null,
            seller:         c.source,
            availability:   scraped.availability || "Unknown",
            url:            c.url,
            source:         c.source,
            details:        null,
            score:          0,
          } as SearchResult
        } catch (err: any) {
          logger.warn("[Search] Scrape failed", { url: c.url, error: err.message })
          return null
        }
      })
    )
    for (const r of batch_results) {
      if (r) results.push(r)
    }
  }

  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 5: Scoring
// ─────────────────────────────────────────────────────────────────────────────

function scoreResult(result: SearchResult, intent: ProductIntent, query: string): number {
  let score = 0
  const titleLower = result.title.toLowerCase()

  const allKeywords = [intent.brand, intent.model, ...intent.attributes, ...intent.keywords]
    .filter(Boolean).map(k => k!.toLowerCase())

  // Title keyword match — 30 pts
  if (allKeywords.length > 0) {
    const hits = allKeywords.filter(k => titleLower.includes(k)).length
    score += Math.round((hits / allKeywords.length) * 30)
  } else {
    const rawWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const hits     = rawWords.filter(w => titleLower.includes(w)).length
    score += rawWords.length > 0 ? Math.round((hits / rawWords.length) * 20) : 10
  }

  // Price completeness — 25 pts
  if (result.price !== null) score += 25

  // Image completeness — 15 pts
  if (result.image) score += 15

  // Brand match — 10 pts
  if (intent.brand) {
    if (titleLower.includes(intent.brand.toLowerCase())) score += 10
  } else {
    score += 5
  }

  // Location match — 10 pts
  if (intent.location) {
    if ((result.location || result.source).toLowerCase().includes(intent.location.toLowerCase())) score += 10
  } else {
    score += 5
  }

  // Condition match — 5 pts
  if (intent.condition === "any") score += 5
  else if (intent.condition === "new"  && result.condition === "New")          score += 5
  else if (intent.condition === "used" && result.condition.startsWith("Used")) score += 5

  // Price range — 5 pts
  const { min, max } = intent.price_range
  if (result.price !== null) {
    if (min !== null || max !== null) {
      if ((min === null || result.price >= min) && (max === null || result.price <= max)) score += 5
    } else {
      score += 5
    }
  }

  return Math.min(100, Math.max(0, score))
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 6: Deduplication
// ─────────────────────────────────────────────────────────────────────────────

function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seenUrls = new Set<string>()
  const seenSigs = new Set<string>()
  return results.filter(r => {
    if (seenUrls.has(r.url)) return false
    seenUrls.add(r.url)
    const slug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)
    const sig  = `${r.source}|${r.price ?? "null"}|${slug}`
    if (seenSigs.has(sig)) return false
    seenSigs.add(sig)
    return true
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Main pipeline
// ─────────────────────────────────────────────────────────────────────────────

export async function productSearch(
  query:       string,
  apiKey:      string,
  countryHint: string = ""
): Promise<SearchResponse> {
  logger.info("[Search] Pipeline start", { query, countryHint })

  // Check cache
  const cached = await getCached(query)
  if (cached) {
    logger.info("[Search] Cache hit", { query, results: cached.length })
    const intent = await parseIntent(query, apiKey).catch(() => ({
      product_type: "product", brand: null, model: null, attributes: [],
      price_range: { min: null, max: null }, condition: "any" as const, location: null, keywords: [],
    }))
    return { query, intent, results: cached, cached: true }
  }

  // Stage 1: understand query
  const intent = await parseIntent(query, apiKey)
  logger.info("[Search] Intent", { intent })

  // Stage 2: expand queries
  const queries = expandQueries(intent, query, countryHint)
  logger.info("[Search] Queries", { queries })

  const engine = new ScraperEngine()
  try {
    await engine.launch()

    // Stage 3: search DuckDuckGo → collect marketplace URLs
    const candidates = await collectMarketplaceUrls(queries, engine)
    logger.info("[Search] Candidates", { count: candidates.length })

    if (candidates.length === 0) {
      logger.warn("[Search] No marketplace URLs found")
      return { query, intent, results: [], cached: false }
    }

    // Stage 4: scrape each URL
    const raw = await scrapeUrls(candidates, engine, apiKey, query)
    logger.info("[Search] Scraped", { count: raw.length })

    // Stage 5: score
    const scored = raw.map(r => ({ ...r, score: scoreResult(r, intent, query) }))

    // Stage 6: dedup + sort + top 10
    const final = deduplicateResults(scored)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    logger.info("[Search] Done", { final: final.length })

    if (final.length > 0) await setCached(query, final)

    return { query, intent, results: final, cached: false }
  } finally {
    await engine.close().catch(() => {})
  }
}
