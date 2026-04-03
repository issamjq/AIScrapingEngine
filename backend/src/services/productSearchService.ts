import { createHash } from "crypto"
import { callClaude } from "../utils/claudeClient"
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

const VALID_CONDITIONS = ["New", "Used - Good", "Used - Fair", "Used - Poor", "Refurbished", "Unknown"]

const SITE_GUIDE =
  `Platform guidance by product type:\n` +
  `• Cars/vehicles: OLX (olx.com.lb / olx.ae / olx.com.sa), Dubizzle, YallaMotor, OpenSooq, CarSwitch, Haraj, Avito\n` +
  `• Electronics/phones: Amazon AE, Noon, Back Market, eBay, Dubizzle, OLX\n` +
  `• Shoes/fashion: Nike, Adidas, Foot Locker, Namshi, Ounass, Farfetch, eBay\n` +
  `• Laptops/computers: Amazon AE, Noon, Apple Store, eBay, Back Market\n` +
  `• Gaming: Amazon AE, Noon, eBay\n` +
  `• Furniture/home: IKEA AE, Noon, Amazon AE, PAN Emirates\n` +
  `• Appliances/generators: Noon, Amazon AE, Jumbo, OLX, Dubizzle\n` +
  `• General used: OLX, Dubizzle, eBay, OpenSooq, Facebook Marketplace`

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
       WHERE cache_key = $1 AND created_at > NOW() - INTERVAL '6 hours'
       LIMIT 1`,
      [key]
    )
    if (rows.length === 0) return null
    const results = rows[0].results as SearchResult[]
    // Auto-evict empty cache entries left by previous bugs
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
  try {
    const key = makeCacheKey(query)
    await dbQuery(
      `INSERT INTO search_cache (cache_key, query_text, results)
       VALUES ($1, $2, $3)
       ON CONFLICT (cache_key) DO UPDATE
         SET results = $3, created_at = NOW(), hit_count = 1`,
      [key, query, JSON.stringify(results)]
    )
  } catch {
    /* cache write failure is non-fatal */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1: Query Understanding (Claude Haiku — no web search)
// ─────────────────────────────────────────────────────────────────────────────

async function parseIntent(query: string, apiKey: string): Promise<ProductIntent> {
  const prompt =
    `Parse this product search query into a structured JSON object. Return ONLY raw JSON.\n\n` +
    `Query: "${query}"\n\n` +
    `Return exactly this shape:\n` +
    `{\n` +
    `  "product_type": "car | phone | laptop | shoe | furniture | appliance | etc",\n` +
    `  "brand": "brand name or null",\n` +
    `  "model": "model name or null",\n` +
    `  "attributes": ["256GB", "white", "size 43", "2010", "coupe"],\n` +
    `  "price_range": { "min": null, "max": 200, "currency": "USD" },\n` +
    `  "condition": "new | used | any",\n` +
    `  "location": "Lebanon | UAE | etc or null",\n` +
    `  "keywords": ["all", "important", "search", "terms"]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- condition "used" if query contains: used, second-hand, old, 2nd hand\n` +
    `- condition "new" if query contains: new, brand new, sealed, unopened\n` +
    `- condition "any" if not specified\n` +
    `- attributes: extract storage size, color, year, model variant, screen size, etc.\n` +
    `- price_range.max from "under X", "below X", "less than X"\n` +
    `- keywords: all meaningful words (min length 3, exclude common words like "for", "the", "and")\n` +
    `- Output ONLY the JSON. No markdown, no explanation.`

  const fallback: ProductIntent = {
    product_type: "product",
    brand:        null,
    model:        null,
    attributes:   [],
    price_range:  { min: null, max: null },
    condition:    "any",
    location:     null,
    keywords:     query.toLowerCase().split(/\s+/).filter(w => w.length > 2),
  }

  try {
    const data = await callClaude(apiKey, {
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages:   [{ role: "user", content: prompt }],
    })
    const text  = data?.content?.[0]?.text || "{}"
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return fallback
    const parsed = JSON.parse(match[0])
    return {
      product_type: parsed.product_type || "product",
      brand:        parsed.brand        || null,
      model:        parsed.model        || null,
      attributes:   Array.isArray(parsed.attributes) ? parsed.attributes : [],
      price_range:  parsed.price_range  || { min: null, max: null },
      condition:    ["new", "used", "any"].includes(parsed.condition) ? parsed.condition : "any",
      location:     parsed.location     || null,
      keywords:     Array.isArray(parsed.keywords) ? parsed.keywords : fallback.keywords,
    }
  } catch {
    return fallback
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2: Query Expansion (rule-based)
// ─────────────────────────────────────────────────────────────────────────────

function expandQueries(intent: ProductIntent, original: string, countryHint: string): string[] {
  const variants: string[] = [original]
  const geo = intent.location || countryHint

  // Brand + model variant
  if (intent.brand && intent.model) {
    const base = `${intent.brand} ${intent.model} ${intent.attributes.join(" ")}`.trim()
    variants.push(base + (geo ? ` for sale ${geo}` : " for sale"))
    if (intent.condition === "used") variants.push(`used ${base}`)
    if (intent.condition === "new")  variants.push(`new ${base} price`)
  }

  // Generic product + location
  if (geo && !original.toLowerCase().includes(geo.toLowerCase())) {
    variants.push(`${original} ${geo}`)
  }

  // Price-range variant
  if (intent.price_range.max) {
    const what = intent.model || intent.brand || intent.product_type
    variants.push(`${what} under ${intent.price_range.max}${intent.price_range.currency || ""}`)
  }

  return [...new Set(variants.map(v => v.trim()))].filter(Boolean).slice(0, 4)
}

// ─────────────────────────────────────────────────────────────────────────────
// Stages 3–6: Discovery + Verification + Extraction (one Claude Sonnet call)
// ─────────────────────────────────────────────────────────────────────────────

async function discoverAndExtract(
  queries:     string[],
  intent:      ProductIntent,
  countryHint: string,
  apiKey:      string
): Promise<SearchResult[]> {
  const geoLine = (intent.location || countryHint)
    ? `User is in ${intent.location || countryHint}. Search there first, then expand globally.`
    : `Search globally across all major marketplaces.`

  const intentSummary =
    `Product type : ${intent.product_type}\n` +
    `Brand        : ${intent.brand    || "any"}\n` +
    `Model        : ${intent.model    || "any"}\n` +
    `Attributes   : ${intent.attributes.join(", ") || "none"}\n` +
    `Condition    : ${intent.condition}\n` +
    `Location     : ${intent.location || countryHint || "any"}\n` +
    `Price range  : ${
      intent.price_range.max
        ? `max ${intent.price_range.max} ${intent.price_range.currency || ""}`
        : intent.price_range.min
        ? `min ${intent.price_range.min} ${intent.price_range.currency || ""}`
        : "any"
    }`

  const prompt =
    `You are a product search API. Your output must ALWAYS be a raw JSON array — never plain text, never an explanation.\n\n` +
    `Find listings for sale matching:\n${intentSummary}\n\n` +
    `Search queries (use all of them):\n` +
    queries.map((q, i) => `${i + 1}. "${q}"`).join("\n") + `\n\n` +
    `${geoLine}\n\n` +
    `${SITE_GUIDE}\n\n` +
    `Instructions:\n` +
    `1. Search the above queries across at least 4 different platforms.\n` +
    `2. Extract product listings — prices may come from search result snippets, listing pages, or category pages.\n` +
    `3. Include both new and used listings.\n` +
    `4. Return 10–15 results. If you can only find a few, return those.\n\n` +
    `CRITICAL OUTPUT RULES:\n` +
    `- Output ONLY the JSON array. Zero other text before or after it.\n` +
    `- NEVER write "I was unable to find", "I apologize", "⚠️", or any explanation whatsoever.\n` +
    `- NEVER return an empty array []. If you found any relevant listing at all, include it.\n` +
    `- If a price is shown in search snippets (e.g. "$10,000"), include that listing — you do not need to visit each page.\n` +
    `- Do NOT invent prices that you did not see anywhere in search results.\n\n` +
    `JSON format (your entire response — nothing before, nothing after):\n` +
    `[{"title":"Infiniti G37 Coupe 2010","price":10000,"original_price":null,"currency":"USD","image":"https://...","condition":"Used - Good","location":"Beirut - Ras Al Nabaa","seller":"Private Seller","availability":"In Stock","url":"https://www.olx.com.lb/item/...","source":"OLX Lebanon","details":"150,000 km · 2010 · Coupe"}]`

  logger.info("[Search] Discovery+extraction start", { queries, countryHint })

  const data = await callClaude(apiKey, {
    model:      "claude-sonnet-4-6",
    max_tokens: 8192,
    tools:      [{ type: "web_search_20250305", name: "web_search" }],
    messages:   [{ role: "user", content: prompt }],
    beta:       "web-search-2025-03-05",
  })

  const text = (data?.content ?? [])
    .filter((b: any) => b.type === "text" && b.text)
    .map((b: any) => b.text as string)
    .join("\n")

  logger.info("[Search] Claude response", { chars: text.length, snippet: text.slice(0, 400) })

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
  } catch (err: any) {
    logger.warn("[Search] JSON parse error", { error: err.message, snippet: text.slice(0, 400) })
    return []
  }

  if (!Array.isArray(parsed)) return []

  return parsed
    .filter((r: any) => r.url?.startsWith("http") && r.title)
    .map((r: any) => {
      const rawPrice = typeof r.price === "number" ? r.price : parseFloat(r.price)
      const rawOrig  = typeof r.original_price === "number" ? r.original_price : parseFloat(r.original_price)
      const price    = isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null
      const orig     = isFinite(rawOrig) && rawOrig > 0 && rawOrig > (price ?? 0) ? rawOrig : null
      return {
        title:          String(r.title).trim(),
        price,
        original_price: orig,
        currency:       String(r.currency || "USD").trim(),
        image:          r.image    ? String(r.image).trim()    : null,
        condition:      VALID_CONDITIONS.includes(r.condition) ? r.condition : "Unknown",
        location:       r.location ? String(r.location).trim() : null,
        seller:         String(r.seller || r.source || "").trim(),
        availability:   String(r.availability || "Unknown").trim(),
        url:            String(r.url).trim(),
        source:         String(r.source || "").trim(),
        details:        r.details  ? String(r.details).trim()  : null,
        score:          0,
      } as SearchResult
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 7: Scoring (pure JavaScript)
// ─────────────────────────────────────────────────────────────────────────────

function scoreResult(result: SearchResult, intent: ProductIntent, query: string): number {
  let score = 0
  const titleLower = result.title.toLowerCase()

  // All keywords from intent + raw query
  const allKeywords = [
    intent.brand,
    intent.model,
    ...intent.attributes,
    ...intent.keywords,
  ].filter(Boolean).map(k => k!.toLowerCase())

  // Title keyword match — 30 pts
  if (allKeywords.length > 0) {
    const hits = allKeywords.filter(k => titleLower.includes(k)).length
    score += Math.round((hits / allKeywords.length) * 30)
  } else {
    // No keywords to match — give partial credit based on raw query words
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
    const brand = intent.brand.toLowerCase()
    if (titleLower.includes(brand) || result.seller.toLowerCase().includes(brand)) score += 10
  } else {
    score += 5 // no brand constraint — partial credit
  }

  // Location match — 10 pts
  const locHit = result.location?.toLowerCase() || ""
  if (intent.location) {
    if (locHit.includes(intent.location.toLowerCase())) score += 10
  } else {
    score += 5 // no location preference — partial credit
  }

  // Condition match — 5 pts
  if (intent.condition === "any")                                       score += 5
  else if (intent.condition === "new"  && result.condition === "New")   score += 5
  else if (intent.condition === "used" && result.condition.startsWith("Used")) score += 5

  // Price range match — 5 pts
  const { min, max } = intent.price_range
  if (result.price !== null) {
    if (min !== null || max !== null) {
      const inRange = (min === null || result.price >= min) && (max === null || result.price <= max)
      if (inRange) score += 5
    } else {
      score += 5 // no range constraint
    }
  }

  return Math.min(100, Math.max(0, score))
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 8: Deduplication (pure JavaScript)
// ─────────────────────────────────────────────────────────────────────────────

function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seenUrls  = new Set<string>()
  const seenSigs  = new Set<string>()

  return results.filter(r => {
    // Dedupe by exact URL
    if (seenUrls.has(r.url)) return false
    seenUrls.add(r.url)

    // Dedupe by price+source+title-slug (catches same listing under different URL params)
    const titleSlug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)
    const sig       = `${r.source}|${r.price ?? "null"}|${titleSlug}`
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

  // Check cache first
  const cached = await getCached(query)
  if (cached) {
    logger.info("[Search] Cache hit", { query, results: cached.length })
    // Re-parse intent quickly for the response (haiku, cheap)
    const intent = await parseIntent(query, apiKey).catch(() => ({
      product_type: "product", brand: null, model: null, attributes: [],
      price_range: { min: null, max: null }, condition: "any" as const,
      location: null, keywords: [],
    }))
    return { query, intent, results: cached, cached: true }
  }

  // Stage 1: Query understanding
  const intent = await parseIntent(query, apiKey)
  logger.info("[Search] Intent parsed", { intent })

  // Stage 2: Query expansion
  const queries = expandQueries(intent, query, countryHint)
  logger.info("[Search] Queries expanded", { queries })

  // Stages 3-6: Discovery + verification + extraction
  const raw = await discoverAndExtract(queries, intent, countryHint, apiKey)
  logger.info("[Search] Raw results", { count: raw.length })

  // Stage 7: Score every result
  const scored = raw.map(r => ({ ...r, score: scoreResult(r, intent, query) }))

  // Stage 8: Deduplicate
  const deduped = deduplicateResults(scored)

  // Stage 9: Sort by score desc, top 10
  const final = deduped.sort((a, b) => b.score - a.score).slice(0, 10)
  logger.info("[Search] Pipeline done", { final: final.length })

  // Cache the result
  // Only cache non-empty results — never cache a failed/empty search
  if (final.length > 0) await setCached(query, final)

  return { query, intent, results: final, cached: false }
}
