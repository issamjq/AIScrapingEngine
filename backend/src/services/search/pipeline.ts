// ─────────────────────────────────────────────────────────────────────────────
// Main Search Pipeline — orchestrates all stages
//
// Stages:
//  1+2  parseIntent      → ProductIntent (category, brand, model, location…)
//  3+4  buildSourcePlan  → ordered list of sources with targets
//  5+6  discoverCandidates (per source, 2 concurrent) → detail_candidate URLs
//  7+8  engine.scrape    (Playwright + Vision AI, 2 concurrent) → raw data
//  9    reject if missing price AND image
//  10   (normalization embedded in scraper via Vision AI)
//  11-13 rankResults     → score + dedup + balance + top 10
//
// Caching: results are stored in search_cache for 6 h.
//          Empty results are never cached.
//          Fallback sources are skipped when primary sources already have ≥3 results.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash }             from "crypto"
import { ScraperEngine }          from "../../scraper/engine"
import { query as dbQuery }       from "../../db"
import { logger }                 from "../../utils/logger"
import { parseIntent }            from "./queryParser"
import { buildSourcePlan, MIN_RESULTS_BEFORE_FALLBACK, MAX_PER_SOURCE } from "./sourceRouter"
import { discoverCandidates }     from "./discovery"
import { rankResults }            from "./ranker"
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
      // Evict stale empty entry
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
  if (results.length === 0) return   // never cache empty results
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

// ── Keyword set for Playwright link filtering ─────────────────────────────────

function buildKeywords(intent: ProductIntent, query: string): string[] {
  const kws = [intent.brand, intent.model, ...intent.attributes, ...intent.keywords]
    .filter(Boolean)
    .map(k => k!.toLowerCase())
    .flatMap(k => k.split(/\s+/))

  const fallback = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  return [...new Set(kws.length > 0 ? kws : fallback)]
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

  // Stage 3+4: build source plan
  const plan = buildSourcePlan(intent)
  logger.info("[Search] Plan", {
    sources: plan.map(p => `${p.source.id}×${p.target}${p.fallback ? "(fb)" : ""}`),
  })

  const keywords   = buildKeywords(intent, query)
  const engine     = new ScraperEngine()
  const allResults: SearchResult[] = []

  // Split plan into primary and fallback tiers
  const primary  = plan.filter(p => !p.fallback)
  const fallback = plan.filter(p =>  p.fallback)

  const DISCOVERY_CONCURRENCY = 2   // concurrent source searches
  const SCRAPE_CONCURRENCY    = 2   // concurrent page scrapes

  async function runBatch(tier: typeof plan): Promise<void> {
    // Discover candidates — 2 sources at a time
    for (let i = 0; i < tier.length; i += DISCOVERY_CONCURRENCY) {
      const srcBatch = tier.slice(i, i + DISCOVERY_CONCURRENCY)
      const candidateBatches = await Promise.all(
        srcBatch.map(({ source, target }) =>
          discoverCandidates(source, query, keywords, target)
        )
      )
      const candidates = candidateBatches.flat()
      logger.info("[Search] Candidates from batch", {
        sources: srcBatch.map(s => s.source.id),
        count:   candidates.length,
      })

      // Stage 7+9: Verify + extract — 2 pages at a time
      for (let j = 0; j < candidates.length; j += SCRAPE_CONCURRENCY) {
        const scrapeBatch = candidates.slice(j, j + SCRAPE_CONCURRENCY)
        const scraped = await Promise.all(
          scrapeBatch.map(async (c) => {
            try {
              const result = await engine.scrape(c.url, {}, {
                timeout:        20_000,
                blockResources: ["font", "media"],
                searchQuery:    query,
              })

              // Stage 9 rejection: must have at least a price OR an image
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
  }

  try {
    await engine.launch()

    // Run primary sources
    await runBatch(primary)
    logger.info("[Search] Primary done", { results: allResults.length })

    // Run fallback sources only if primary didn't find enough
    if (allResults.length < MIN_RESULTS_BEFORE_FALLBACK && fallback.length > 0) {
      logger.info("[Search] Expanding to fallback sources", {
        reason: `only ${allResults.length} results from primary`,
      })
      await runBatch(fallback)
      logger.info("[Search] Fallback done", { results: allResults.length })
    } else if (fallback.length > 0) {
      logger.info("[Search] Skipping fallback sources — primary has enough results")
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
