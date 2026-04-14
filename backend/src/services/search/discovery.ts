// ─────────────────────────────────────────────────────────────────────────────
// Stage 5 + 6 — Per-Source Discovery & Candidate Classification
//
// Uses Claude Haiku + web_search_20250305 for ALL source types.
//
// Why not Playwright for link discovery:
//   - OLX / Dubizzle / AutoBeeb are React SPAs — headless Chrome on Render
//     is blocked by bot detection on all of them (returns 0 links)
//   - OpenSooq returns 1121 links but they are navigation/category URLs,
//     not individual listing pages — keyword filter doesn't help
//   - Claude web_search goes through Anthropic's servers (no IP block)
//     and returns actual indexed product/listing pages per site
//
// Prompt strategy:
//   ECOMMERCE/RETAIL  → "Find direct product page URLs" (Amazon /dp/, Noon /p/)
//   CLASSIFIEDS       → "Find individual listing pages" (OLX /item/, Dubizzle /listing/)
//   Both are validated by URL pattern classification after Claude returns them
// ─────────────────────────────────────────────────────────────────────────────

import { callClaude }                         from "../../utils/claudeClient"
import { logger }                             from "../../utils/logger"
import { Source, Candidate, CandidateType }   from "./types"

// ── JSON parser — handles both raw arrays and markdown code fences ────────────

function extractJsonArray(text: string): any[] {
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "")
  const match    = stripped.match(/\[[\s\S]*?\]/)
  if (!match) return []
  try { return JSON.parse(match[0]) } catch { return [] }
}

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

  // Must belong to this source's domain or subdomain
  if (!host.endsWith(source.domain) && !source.domain.endsWith(host)) {
    return "reject_candidate"
  }

  // List patterns first (category / search / filter pages → reject)
  if (source.listPatterns.some(p => p.test(path)))   return "list_candidate"

  // Explicit detail patterns (product / listing pages → keep)
  if (source.detailPatterns.some(p => p.test(path))) return "detail_candidate"

  // Heuristic: numeric ID (4+ digits) in path → likely a listing page
  if (/\/\d{4,}/.test(path)) return "detail_candidate"

  return "list_candidate"
}

// ── Build the right Claude prompt per source type ─────────────────────────────

function buildPrompt(sources: Source[], query: string, maxPerSource: number): string {
  const hasClassifieds = sources.some(s => s.type === "marketplace")
  const hasEcommerce   = sources.some(s => s.type !== "marketplace")
  const siteList       = sources.map(s => `${s.name} (${s.domain})`).join(", ")
  const domainList     = sources.map(s => s.domain).join(", ")

  let rules = ""
  if (hasClassifieds && hasEcommerce) {
    rules =
      `For RETAIL/ECOMMERCE sites: return direct product page URLs (e.g. amazon.ae/dp/XXX).\n` +
      `For CLASSIFIEDS/MARKETPLACE sites: return individual ad/listing page URLs ` +
      `(pages showing a single item for sale, not a category or search results page).\n`
  } else if (hasClassifieds) {
    rules =
      `Return individual ad/listing page URLs — pages showing ONE specific item for sale.\n` +
      `Do NOT return category pages, search results pages, or filter pages.\n` +
      `Each URL must be a single listing (one car, one item) with a unique ID in the URL.\n`
  } else {
    rules =
      `Return direct product page URLs — individual product detail pages.\n` +
      `Do NOT return search results, category pages, or homepages.\n`
  }

  return (
    `Find as many matching URLs as possible for: "${query}"\n\n` +
    `Search on these sites: ${siteList}\n\n` +
    `Rules:\n` +
    rules +
    `Only include URLs from these domains: ${domainList}\n` +
    `Aim for up to ${maxPerSource} URLs per site. Search multiple times per site.\n\n` +
    `Return ONLY a JSON array, no explanation, no markdown:\n` +
    `[{"retailer":"Site Name","url":"https://...","title":"listing or product title"}]`
  )
}

// ── Main discovery function ───────────────────────────────────────────────────

export async function discoverFromSources(
  sources:      Source[],
  query:        string,
  keywords:     string[],   // kept for interface compat — used as fallback hint
  apiKey:       string,
  _engine:      any,        // no longer used for discovery (Playwright blocked on Render)
  maxPerSource: number = 5
): Promise<Candidate[]> {
  if (sources.length === 0) return []

  const prompt = buildPrompt(sources, query, maxPerSource)
  logger.info("[Search] Claude web search", { sources: sources.map(s => s.id), query })

  let parsed: any[] = []
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

    logger.debug("[Search] Claude raw", { preview: rawText.slice(0, 400) })
    parsed = extractJsonArray(rawText)
    logger.info("[Search] Claude raw results", { count: parsed.length })
  } catch (err: any) {
    logger.warn("[Search] Claude web search failed", { error: err.message })
    return []
  }

  // Classify and cap per source
  const perSourceCount: Record<string, number> = {}
  const candidates: Candidate[] = []

  for (const item of parsed) {
    if (!item?.url || !item.url.startsWith("http")) continue

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

    // Must be a detail/listing page
    const type = classifyUrl(item.url, source)
    if (type !== "detail_candidate") {
      logger.debug("[Search] Drop non-detail URL", { url: item.url, type, source: source.id })
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
    found:     candidates.length,
    perSource: perSourceCount,
  })
  return candidates
}
