// ─────────────────────────────────────────────────────────────────────────────
// Main Search Pipeline — orchestrates all stages
//
// Stages:
//  1+2  parseIntent        → ProductIntent (category, brand, model, location…)
//  3+4  buildSourcePlan    → ordered list of sources with targets
//  5+6  discoverFromSources (one Claude web_search call per tier) → Candidates
//  7    reject list/category pages via URL pattern classification
//  8    engine.scrape (Playwright + Vision AI, 2 concurrent) → raw data
//  9    reject if missing price AND image
//  10   (normalization via Vision AI inside ScraperEngine)
//  11-13 rankResults       → score + dedup + balance + top 10
//
// Tiers:
//   Primary   = sources in user's detected country (searched first)
//   Fallback  = other-country sources (searched only if primary returns < 3 results)
//
// Cache: 6-hour TTL in search_cache table.  Empty results never cached.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash }              from "crypto"
import { ScraperEngine }           from "../../scraper/engine"
import { query as dbQuery }        from "../../db"
import { logger }                  from "../../utils/logger"
import { parseIntent }             from "./queryParser"
import { buildSourcePlan, MIN_RESULTS_BEFORE_FALLBACK, MAX_PER_SOURCE } from "./sourceRouter"
import { discoverFromSources }     from "./discovery"
import { rankResults }             from "./ranker"
import { SearchResult, SearchResponse, ProductIntent } from "./types"

// ── Cache helpers ─────────────────────────────────────────────────────────────

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
    await dbQuery(
      `UPDATE search_cache SET hit_count = hit_count + 1 WHERE cache_key = $1`, [key]
    ).catch(() => {})
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

// ── Main export ───────────────────────────────────────────────────────────────

export async function productSearch(
  query:       string,
  apiKey:      string,
  countryHint: string = ""
): Promise<SearchResponse> {
  logger.info("[Search] Pipeline start", { query, countryHint })

  // Cache hit — skip the whole pipeline
  const cachedResults = await getCached(query)
  if (cachedResults) {
    logger.info("[Search] Cache hit", { query, count: cachedResults.length })
    const intent = await parseIntent(query, apiKey, countryHint).catch(() => ({
      product_type: "product", category: "general" as const,
      brand: null, model: null, attributes: [],
      price_range: { min: null, max: null }, condition: "any" as const,
      location: countryHint || null, country: null, keywords: [],
    }))
    return { query, intent, results: cachedResults, cached: true }
  }

  // Stage 1+2: understand the query
  const intent = await parseIntent(query, apiKey, countryHint)
  logger.info("[Search] Intent", { intent })

  // Stage 3+4: build source plan (loads sources from DB)
  const plan = await buildSourcePlan(intent)
  logger.info("[Search] Plan", {
    sources: plan.map(p => `${p.source.id}${p.fallback ? "(fb)" : ""}`),
  })

  const primary  = plan.filter(p => !p.fallback)
  const fallback = plan.filter(p =>  p.fallback)

  const SCRAPE_CONCURRENCY = 2
  const engine = new ScraperEngine()
  const allResults: SearchResult[] = []

  async function scrapeAndCollect(candidates: ReturnType<typeof discoverFromSources> extends Promise<infer T> ? T : never): Promise<void> {
    for (let i = 0; i < candidates.length; i += SCRAPE_CONCURRENCY) {
      const batch   = candidates.slice(i, i + SCRAPE_CONCURRENCY)
      const scraped = await Promise.all(
        batch.map(async (c) => {
          try {
            const result = await engine.scrape(c.url, {}, {
              timeout:        20_000,
              blockResources: ["font", "media"],
              searchQuery:    query,
            })

            // Stage 9: reject if both price and image are missing
            if (!result.price && !result.imageUrl) {
              logger.debug("[Search] Reject missing_price_or_image", { url: c.url })
              return null
            }

            return {
              title:          result.title || c.title || c.sourceName,
              price:          result.price,
              original_price: result.originalPrice,
              currency:       result.currency || "USD",
              image:          result.imageUrl,
              condition:      "Unknown",
              location:       null,
              seller:         c.sourceName,
              availability:   result.availability || "Unknown",
              url:            c.url,
              source:         c.sourceName,
              sourceId:       c.sourceId,
              details:        null,
              score:          0,
            } as SearchResult
          } catch (err: any) {
            logger.warn("[Search] Scrape failed", { url: c.url, error: err.message })
            return null
          }
        })
      )
      for (const r of scraped) {
        if (r) allResults.push(r)
      }
    }
  }

  try {
    await engine.launch()

    // Stage 5+6: discover from primary sources (one Claude call for all)
    const primarySources    = primary.map(p => p.source)
    const primaryCandidates = await discoverFromSources(primarySources, query, apiKey, MAX_PER_SOURCE)
    logger.info("[Search] Primary candidates", { count: primaryCandidates.length })

    // Stage 7+8+9: verify + scrape primary candidates
    await scrapeAndCollect(primaryCandidates)
    logger.info("[Search] Primary done", { results: allResults.length })

    // Stage 5+6 fallback: only if primary didn't find enough
    if (allResults.length < MIN_RESULTS_BEFORE_FALLBACK && fallback.length > 0) {
      logger.info("[Search] Expanding to fallback sources", {
        reason: `only ${allResults.length} results from primary`,
      })
      const fallbackSources    = fallback.map(p => p.source)
      const fallbackCandidates = await discoverFromSources(fallbackSources, query, apiKey, MAX_PER_SOURCE)
      logger.info("[Search] Fallback candidates", { count: fallbackCandidates.length })
      await scrapeAndCollect(fallbackCandidates)
      logger.info("[Search] Fallback done", { results: allResults.length })
    } else if (fallback.length > 0) {
      logger.info("[Search] Skipping fallback — primary has enough results")
    }

    // Stages 11–13: score, dedup, balance, top 10
    const final = rankResults(allResults, intent, query, MAX_PER_SOURCE, 10)
    logger.info("[Search] Pipeline done", { total: allResults.length, final: final.length })

    if (final.length > 0) await setCached(query, final)

    return { query, intent, results: final, cached: false }

  } finally {
    await engine.close().catch(() => {})
  }
}
