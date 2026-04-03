// ─────────────────────────────────────────────────────────────────────────────
// Stage 5 + 6 — Per-Source Discovery & Candidate Classification
//
// Uses DuckDuckGo "site:" search to find product pages on each source.
// This is more reliable than loading source search pages directly because:
//   • DuckDuckGo indexes actual product listing pages (not category pages)
//   • No Playwright needed for discovery — plain fetch, no bot detection
//   • Works for all sources regardless of their JS rendering complexity
//
// Flow per source:
//   1. Build DDG query: site:{domain} {query}
//   2. Fetch DuckDuckGo HTML endpoint (no JS required)
//   3. Parse anchor links, decode DDG redirect wrappers
//   4. Classify each URL: detail_candidate / list_candidate / reject_candidate
//   5. Expand up to 2 list_candidates (fetch their DDG results too)
//   6. Return up to `target` detail_candidates
// ─────────────────────────────────────────────────────────────────────────────

import { logger }                           from "../../utils/logger"
import { Source, Candidate, CandidateType } from "./types"

// ── DDG HTML fetch ────────────────────────────────────────────────────────────

const DDG_URL    = "https://html.duckduckgo.com/html/"
const DDG_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
]

async function fetchDDG(q: string): Promise<Array<{ url: string; title: string }>> {
  try {
    const ua  = DDG_AGENTS[Math.floor(Math.random() * DDG_AGENTS.length)]
    const src = `${DDG_URL}?q=${encodeURIComponent(q)}&kl=us-en`

    const resp = await fetch(src, {
      headers: {
        "User-Agent":      ua,
        "Accept":          "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer":         "https://duckduckgo.com/",
      },
      signal: AbortSignal.timeout(15_000),
    })
    const html = await resp.text()

    // Parse anchor tags with class="result__a"
    // href is either a real URL or "//duckduckgo.com/l/?uddg=<encoded>"
    const results: Array<{ url: string; title: string }> = []
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    let m: RegExpExecArray | null

    while ((m = re.exec(html)) !== null) {
      const href  = m[1]
      const title = m[2].replace(/<[^>]+>/g, "").trim()
      let realUrl = href
      try {
        if (href.includes("uddg=")) {
          const params = new URL("https:" + href).searchParams
          realUrl = decodeURIComponent(params.get("uddg") || href)
        }
      } catch { /* keep href */ }
      if (realUrl.startsWith("http") && !realUrl.includes("duckduckgo.com")) {
        results.push({ url: realUrl, title })
      }
    }
    return results
  } catch (err: any) {
    logger.warn("[Search] DDG fetch failed", { q, error: err.message })
    return []
  }
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

  // Must be same domain or subdomain
  if (!host.endsWith(source.domain) && !source.domain.endsWith(host)) {
    return "reject_candidate"
  }

  // Check list patterns first (safer — avoids category pages)
  if (source.listPatterns.some(p => p.test(path)))   return "list_candidate"

  // Check explicit detail patterns
  if (source.detailPatterns.some(p => p.test(path))) return "detail_candidate"

  // Heuristic: numeric ID (4+ digits) in path → likely a product page
  if (/\/\d{4,}/.test(path)) return "detail_candidate"

  // Default: treat as list (don't scrape unknown pages)
  return "list_candidate"
}

// ── Per-source discovery ──────────────────────────────────────────────────────

export async function discoverCandidates(
  source:   Source,
  query:    string,
  keywords: string[],   // not used for DDG (query already contains them) — kept for interface compat
  target:   number
): Promise<Candidate[]> {
  // Stage 5: DDG site: search
  const ddgQuery = `site:${source.domain} ${query}`
  logger.info("[Search] DDG site search", { source: source.id, ddgQuery })

  const rawLinks = await fetchDDG(ddgQuery)
  logger.info("[Search] DDG results", { source: source.id, count: rawLinks.length })

  const detailCandidates: Candidate[] = []
  const listCandidates:   string[]    = []

  // Stage 6: classify each URL
  for (const r of rawLinks) {
    if (detailCandidates.length >= target) break

    const type = classifyUrl(r.url, source)

    if (type === "detail_candidate") {
      detailCandidates.push({
        url:        r.url,
        title:      r.title,
        sourceId:   source.id,
        sourceName: source.name,
        type,
      })
    } else if (type === "list_candidate" && listCandidates.length < 2) {
      listCandidates.push(r.url)
    }
  }

  // Stage 8: if not enough detail candidates, search DDG for list page sub-queries
  // e.g. if DDG returned a category page URL, search DDG with that URL appended to query
  if (detailCandidates.length < target && listCandidates.length > 0) {
    for (const listUrl of listCandidates) {
      if (detailCandidates.length >= target) break
      // Search DDG specifically within the list page's path
      const subQuery = `site:${source.domain} ${query} ${new URL(listUrl).pathname.split("/").filter(Boolean).join(" ")}`
      logger.info("[Search] DDG sub-search", { source: source.id, subQuery })
      const subLinks = await fetchDDG(subQuery)
      for (const r of subLinks) {
        if (classifyUrl(r.url, source) === "detail_candidate") {
          detailCandidates.push({
            url:        r.url,
            title:      r.title,
            sourceId:   source.id,
            sourceName: source.name,
            type:       "detail_candidate",
          })
          if (detailCandidates.length >= target) break
        }
      }
    }
  }

  logger.info("[Search] Discovery done", { source: source.id, found: detailCandidates.length })
  return detailCandidates
}
