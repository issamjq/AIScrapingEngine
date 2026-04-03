// ─────────────────────────────────────────────────────────────────────────────
// Stage 5 + 6 — Per-Source Discovery & Candidate Classification
//
// Two strategies depending on source type:
//
//   ECOMMERCE / RETAIL  (amazon, noon, sharafdg, ayoub, etc.)
//   → Claude Haiku + web_search_20250305
//   → Returns individual product page URLs directly
//
//   MARKETPLACE / CLASSIFIEDS  (olx, dubizzle, opensooq, autobeeb, etc.)
//   → Load the source's search URL via Playwright (ScraperEngine)
//   → Extract individual listing links from the rendered DOM
//   → These sites are JS-rendered, so we wait for networkidle
//
// URL classification uses source-specific patterns from the DB to distinguish:
//   detail_candidate  → single product/listing page  ✅ scrape this
//   list_candidate    → category / search results page  ⚠️ expand or skip
//   reject_candidate  → off-domain / irrelevant         ❌ skip
// ─────────────────────────────────────────────────────────────────────────────

import { callClaude }                         from "../../utils/claudeClient"
import { ScraperEngine }                      from "../../scraper/engine"
import { logger }                             from "../../utils/logger"
import { Source, Candidate, CandidateType }   from "./types"

// ── URL classifier ────────────────────────────────────────────────────────────

function classifyUrl(url: string, source: Source): CandidateType {
  let path: string
  let host: string
  try {
    const u = new URL(url)
    path    = (u.pathname + u.search).toLowerCase()
    host    = u.hostname.replace("www.", "")
  } catch {
    return "reject_candidate"
  }

  // Must belong to this source's domain
  if (!host.endsWith(source.domain) && !source.domain.endsWith(host)) {
    return "reject_candidate"
  }

  // List pattern check first (category / search pages → skip)
  if (source.listPatterns.some(p => p.test(path)))   return "list_candidate"

  // Explicit detail patterns (product/listing pages → scrape)
  if (source.detailPatterns.some(p => p.test(path))) return "detail_candidate"

  // Heuristic: numeric ID (4+ digits) in path → likely a product/listing page
  if (/\/\d{4,}/.test(path)) return "detail_candidate"

  return "list_candidate"
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy A — Claude web_search (ecommerce / retail sources)
// ─────────────────────────────────────────────────────────────────────────────

function extractJsonArray(text: string): any[] {
  // Handle both raw JSON and markdown code fences (```json ... ```)
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "")
  const match    = stripped.match(/\[[\s\S]*?\]/)
  if (!match) return []
  try { return JSON.parse(match[0]) } catch { return [] }
}

async function discoverViaClaudeSearch(
  sources:      Source[],
  query:        string,
  apiKey:       string,
  maxPerSource: number
): Promise<Candidate[]> {
  const siteList   = sources.map(s => `${s.name} (${s.domain})`).join(", ")
  const domainList = sources.map(s => s.domain).join(", ")

  const prompt =
    `Find as many direct product page URLs as possible for: "${query}"\n\n` +
    `Search on each of these retailers: ${siteList}\n\n` +
    `For EACH retailer, search multiple times to find all available listings.\n` +
    `ONLY include a URL if:\n` +
    `- It is a direct product page (not a search results page or category page)\n` +
    `- It is from one of these domains: ${domainList}\n\n` +
    `Search aggressively. Aim for up to ${maxPerSource} direct product URLs per retailer.\n\n` +
    `Return ONLY a JSON array, no other text:\n` +
    `[{"retailer": "Amazon UAE", "url": "https://...", "title": "product title"}]`

  logger.info("[Search] Claude web search (ecommerce)", {
    sources: sources.map(s => s.id), query,
  })

  try {
    const data = await callClaude(apiKey, {
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      tools:      [{ type: "web_search_20250305", name: "web_search" }],
      messages:   [{ role: "user", content: prompt }],
      beta:       "web-search-2025-03-05",
    })

    const rawText = (data?.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text as string)
      .join("\n")

    logger.debug("[Search] Claude raw", { preview: rawText.slice(0, 300) })

    const parsed = extractJsonArray(rawText)
    logger.info("[Search] Claude results", { count: parsed.length })

    const perSourceCount: Record<string, number> = {}
    const candidates: Candidate[] = []

    for (const item of parsed) {
      if (!item?.url || !item.url.startsWith("http")) continue

      const source = sources.find(s => {
        try {
          const host = new URL(item.url).hostname.replace("www.", "")
          return host.endsWith(s.domain) || s.domain.endsWith(host)
        } catch { return false }
      })
      if (!source) continue

      const count = perSourceCount[source.id] || 0
      if (count >= maxPerSource) continue

      const type = classifyUrl(item.url, source)
      if (type !== "detail_candidate") {
        logger.debug("[Search] Drop non-detail URL", { url: item.url, type })
        continue
      }

      candidates.push({
        url:        item.url,
        title:      item.title || "",
        sourceId:   source.id,
        sourceName: source.name,
        type,
      })
      perSourceCount[source.id] = count + 1
    }

    logger.info("[Search] Ecommerce candidates", {
      found: candidates.length, perSource: perSourceCount,
    })
    return candidates
  } catch (err: any) {
    logger.warn("[Search] Claude web search failed", { error: err.message })
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy B — Classifieds: Claude finds the search/results page URL,
//              Playwright extracts individual listing links from it.
//
// Why this split:
//   - Playwright on Render cannot load OLX/Dubizzle/OpenSooq search pages
//     directly (bot detection blocks headless Chrome on shared hosting)
//   - Claude web_search CAN find the correct search results page URL on these
//     sites (e.g. https://uae.dubizzle.com/motors/used-cars/infiniti/g37/)
//   - Playwright then loads THAT URL — a known good page — and extracts
//     individual listing hrefs from the rendered DOM
// ─────────────────────────────────────────────────────────────────────────────

async function getSearchResultsPageUrls(
  sources:  Source[],
  query:    string,
  apiKey:   string
): Promise<Array<{ source: Source; url: string }>> {
  const siteList = sources.map(s => `${s.name} (${s.domain})`).join(", ")

  const prompt =
    `Search for "${query}" on each of these classifieds/marketplace sites: ${siteList}\n\n` +
    `For each site, return the SEARCH RESULTS PAGE URL — the URL that shows a list of matching listings.\n` +
    `Do NOT return individual listing pages. Return the search/filter results page.\n\n` +
    `Return ONLY JSON: [{"site":"OLX Lebanon","domain":"olx.com.lb","url":"https://..."}]`

  logger.info("[Search] Claude classifieds search URL", { sources: sources.map(s => s.id) })

  try {
    const data = await callClaude(apiKey, {
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      tools:      [{ type: "web_search_20250305", name: "web_search" }],
      messages:   [{ role: "user", content: prompt }],
      beta:       "web-search-2025-03-05",
    })

    const rawText = (data?.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text as string)
      .join("\n")

    const parsed = extractJsonArray(rawText)
    const results: Array<{ source: Source; url: string }> = []

    for (const item of parsed) {
      if (!item?.url?.startsWith("http")) continue
      const source = sources.find(s => {
        try {
          const host = new URL(item.url).hostname.replace("www.", "")
          return host.endsWith(s.domain) || s.domain.endsWith(host) ||
                 (item.domain && (item.domain === s.domain || s.domain.includes(item.domain)))
        } catch { return false }
      })
      if (source) results.push({ source, url: item.url })
    }

    logger.info("[Search] Claude found search URLs", { count: results.length,
      urls: results.map(r => `${r.source.id}: ${r.url}`) })
    return results
  } catch (err: any) {
    logger.warn("[Search] Claude classifieds search URL failed", { error: err.message })
    // Fallback: use the source's built-in search URL template
    return sources.map(s => ({ source: s, url: s.searchUrl(query) }))
  }
}

async function discoverViaClassifieds(
  sources:      Source[],
  query:        string,
  keywords:     string[],
  apiKey:       string,
  maxPerSource: number,
  engine:       ScraperEngine
): Promise<Candidate[]> {
  // Step 1: Claude finds the search results page URL per source
  const searchPages = await getSearchResultsPageUrls(sources, query, apiKey)

  if (searchPages.length === 0) {
    logger.info("[Search] No classified search pages found, using template URLs")
    // Fallback to DB search URL templates
    searchPages.push(...sources.map(s => ({ source: s, url: s.searchUrl(query) })))
  }

  const candidates: Candidate[] = []

  // Step 2: Playwright loads each search results page → extracts listing links
  for (const { source, url } of searchPages) {
    logger.info("[Search] Playwright on classified results page", { source: source.id, url })
    try {
      const links = await engine.getListingUrls(url, maxPerSource * 3, keywords)
      logger.info("[Search] Classified links", { source: source.id, count: links.length })

      let added = 0
      for (const link of links) {
        if (added >= maxPerSource) break
        const type = classifyUrl(link, source)
        if (type === "detail_candidate") {
          candidates.push({ url: link, title: "", sourceId: source.id, sourceName: source.name, type })
          added++
        }
      }
      logger.info("[Search] Classified candidates", { source: source.id, added })
    } catch (err: any) {
      logger.warn("[Search] Playwright on classified page failed", { source: source.id, error: err.message })
    }
  }

  return candidates
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — routes sources to the right strategy
// ─────────────────────────────────────────────────────────────────────────────

export async function discoverFromSources(
  sources:      Source[],
  query:        string,
  keywords:     string[],
  apiKey:       string,
  engine:       ScraperEngine,
  maxPerSource: number = 5
): Promise<Candidate[]> {
  // Split sources by type
  const ecommerceSources  = sources.filter(s => s.type === "ecommerce" || s.type === "retail")
  const classifiedSources = sources.filter(s => s.type === "marketplace")

  const [ecommerceCandidates, classifiedCandidates] = await Promise.all([
    ecommerceSources.length > 0
      ? discoverViaClaudeSearch(ecommerceSources, query, apiKey, maxPerSource)
      : Promise.resolve([]),
    classifiedSources.length > 0
      ? discoverViaClassifieds(classifiedSources, query, keywords, apiKey, maxPerSource, engine)
      : Promise.resolve([]),
  ])

  const all = [...ecommerceCandidates, ...classifiedCandidates]
  logger.info("[Search] Total candidates", {
    ecommerce:  ecommerceCandidates.length,
    classified: classifiedCandidates.length,
    total:      all.length,
  })
  return all
}
