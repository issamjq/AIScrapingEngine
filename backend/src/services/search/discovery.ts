// ─────────────────────────────────────────────────────────────────────────────
// Stage 5 + 6 — Per-Source Discovery & Candidate Classification
//
// For each source in the plan:
//   1. Load the source's search page via Playwright (engine.getListingUrls)
//   2. Classify every extracted URL:
//        detail_candidate  → URL pattern matches a single-product page
//        list_candidate    → URL pattern matches a list/category page
//        reject_candidate  → off-domain, social, irrelevant
//   3. Expand list_candidates (up to 2 per source) by following them and
//      extracting sub-links — handles sites where search → category → product
//   4. Return up to `target` detail_candidates per source
// ─────────────────────────────────────────────────────────────────────────────

import { ScraperEngine }           from "../../scraper/engine"
import { logger }                  from "../../utils/logger"
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

  // Must be same domain (or subdomain of it)
  if (!host.endsWith(source.domain) && !source.domain.endsWith(host)) {
    return "reject_candidate"
  }

  // Explicit list pattern → list_candidate
  if (source.listPatterns.some(p => p.test(path))) return "list_candidate"

  // Explicit detail pattern → detail_candidate
  if (source.detailPatterns.some(p => p.test(path))) return "detail_candidate"

  // Heuristic: URL with a numeric ID segment (4+ digits) is likely a detail page
  if (/\/\d{4,}/.test(path)) return "detail_candidate"

  // Default to list (safer — prevents scraping category pages as products)
  return "list_candidate"
}

// ── Per-source discovery ──────────────────────────────────────────────────────

export async function discoverCandidates(
  source:   Source,
  query:    string,
  keywords: string[],
  target:   number,
  engine:   ScraperEngine
): Promise<Candidate[]> {
  const searchUrl = source.searchUrl(query)
  logger.info("[Search] Discover", { source: source.id, url: searchUrl })

  let rawLinks: string[]
  try {
    // getListingUrls: Playwright-renders the search page and extracts all same-domain
    // anchor hrefs that have a numeric ID or contain a query keyword in the path.
    rawLinks = await engine.getListingUrls(searchUrl, target * 4, keywords)
  } catch (err: any) {
    logger.warn("[Search] getListingUrls failed", { source: source.id, error: err.message })
    return []
  }

  const detailCandidates: Candidate[] = []
  const listCandidates:   string[]    = []

  for (const url of rawLinks) {
    if (detailCandidates.length >= target) break

    const type = classifyUrl(url, source)

    if (type === "detail_candidate") {
      detailCandidates.push({
        url,
        title:      "",
        sourceId:   source.id,
        sourceName: source.name,
        type,
      })
    } else if (type === "list_candidate" && listCandidates.length < 2) {
      listCandidates.push(url)
    }
  }

  // Stage 8: expand list candidates when we don't have enough detail URLs
  if (detailCandidates.length < target && listCandidates.length > 0) {
    for (const listUrl of listCandidates) {
      if (detailCandidates.length >= target) break
      logger.info("[Search] Expanding list candidate", { source: source.id, listUrl })
      let subLinks: string[]
      try {
        subLinks = await engine.getListingUrls(listUrl, (target - detailCandidates.length) * 2, keywords)
      } catch {
        continue
      }
      for (const url of subLinks) {
        if (classifyUrl(url, source) === "detail_candidate") {
          detailCandidates.push({
            url,
            title:      "",
            sourceId:   source.id,
            sourceName: source.name,
            type:       "detail_candidate",
          })
          if (detailCandidates.length >= target) break
        }
      }
    }
  }

  logger.info("[Search] Discovery done", {
    source: source.id,
    found:  detailCandidates.length,
  })
  return detailCandidates
}
