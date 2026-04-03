// ─────────────────────────────────────────────────────────────────────────────
// Stage 5 + 6 — Per-Source Discovery & Candidate Classification
//
// Uses Claude Haiku + web_search_20250305 to find product pages per source.
// One Claude call per tier (primary sources batched together, fallbacks batched
// together) — more efficient and avoids Render IP blocks on direct scraping.
//
// Candidate classification uses source-specific URL patterns to distinguish:
//   detail_candidate  → single product listing page
//   list_candidate    → category / search results page (skipped by default)
//   reject_candidate  → off-domain, social, irrelevant
// ─────────────────────────────────────────────────────────────────────────────

import { callClaude }                       from "../../utils/claudeClient"
import { logger }                           from "../../utils/logger"
import { Source, Candidate, CandidateType } from "./types"

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

  // Must be same domain or subdomain
  if (!host.endsWith(source.domain) && !source.domain.endsWith(host)) {
    return "reject_candidate"
  }

  // Check list patterns first (avoids scraping category/search pages)
  if (source.listPatterns.some(p => p.test(path)))   return "list_candidate"

  // Explicit detail patterns
  if (source.detailPatterns.some(p => p.test(path))) return "detail_candidate"

  // Heuristic: numeric ID in path → likely a product listing
  if (/\/\d{4,}/.test(path)) return "detail_candidate"

  return "list_candidate"
}

// ── Claude web search (batched per tier) ─────────────────────────────────────

async function claudeWebSearch(
  sources:  Source[],
  query:    string,
  apiKey:   string
): Promise<Array<{ url: string; title: string; domain: string }>> {
  if (sources.length === 0) return []

  const siteList    = sources.map(s => `${s.name} (${s.domain})`).join(", ")
  const domainList  = sources.map(s => s.domain).join(", ")

  const prompt =
    `Search for product listings matching this query: "${query}"\n\n` +
    `Search ONLY on these specific websites: ${siteList}\n\n` +
    `Rules:\n` +
    `- Find INDIVIDUAL product listing pages (one product per URL)\n` +
    `- NEVER include search result pages, category pages, homepages\n` +
    `- ONLY return URLs from these domains: ${domainList}\n` +
    `- Aim for up to 5 listings per site\n\n` +
    `Return ONLY a JSON array, no explanation, no markdown:\n` +
    `[{"domain":"olx.com.lb","url":"https://...","title":"product title"}]`

  logger.info("[Search] Claude web search", { sources: sources.map(s => s.id), query })

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

    logger.debug("[Search] Claude raw response", { preview: rawText.slice(0, 400) })

    const match = rawText.match(/\[[\s\S]*\]/)
    if (!match) {
      logger.warn("[Search] No JSON array in Claude response", { preview: rawText.slice(0, 300) })
      return []
    }

    const parsed = JSON.parse(match[0]) as any[]
    return parsed.filter(
      (r) => r?.url && typeof r.url === "string" && r.url.startsWith("http")
    )
  } catch (err: any) {
    logger.warn("[Search] Claude web search failed", { error: err.message })
    return []
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Discover product candidates from a batch of sources in a single Claude call.
 * Returns detail_candidates only (list/reject candidates are dropped).
 * Per-source result count is capped by `maxPerSource`.
 */
export async function discoverFromSources(
  sources:      Source[],
  query:        string,
  apiKey:       string,
  maxPerSource: number = 5
): Promise<Candidate[]> {
  const rawResults = await claudeWebSearch(sources, query, apiKey)
  logger.info("[Search] Claude results", { count: rawResults.length })

  const perSourceCount: Record<string, number> = {}
  const candidates: Candidate[] = []

  for (const item of rawResults) {
    // Match URL to a source by domain
    const source = sources.find(s => {
      try {
        const host = new URL(item.url).hostname.replace("www.", "")
        return host.endsWith(s.domain) || s.domain.endsWith(host)
      } catch { return false }
    })
    if (!source) continue

    // Cap per source
    const count = perSourceCount[source.id] || 0
    if (count >= maxPerSource) continue

    // Must be a detail page
    const type = classifyUrl(item.url, source)
    if (type !== "detail_candidate") {
      logger.debug("[Search] Dropped non-detail URL", { url: item.url, type })
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

  logger.info("[Search] Candidates", {
    sources:  sources.map(s => s.id),
    found:    candidates.length,
    perSource: perSourceCount,
  })
  return candidates
}
