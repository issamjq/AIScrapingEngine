// ─────────────────────────────────────────────────────────────────────────────
// Stages 11-13 — Scoring · Deduplication · Source Balancing
// ─────────────────────────────────────────────────────────────────────────────

import { SearchResult, ProductIntent } from "./types"

// ── Scoring (0–100 points) ────────────────────────────────────────────────────
//
//  30 pts  Title keyword match (brand + model + attributes + keywords)
//  25 pts  Has a price
//  15 pts  Has an image
//  10 pts  Brand found in title
//  10 pts  Location / source matches user country
//   5 pts  Condition matches user preference
//   5 pts  Price within requested range

function scoreResult(result: SearchResult, intent: ProductIntent, query: string): number {
  let score = 0
  const titleLower = (result.title || "").toLowerCase()

  // Build keyword set from intent + raw query fallback
  const intentKws = [intent.brand, intent.model, ...intent.attributes, ...intent.keywords]
    .filter(Boolean)
    .map(k => k!.toLowerCase())
  const queryKws = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const keywords  = intentKws.length > 0 ? intentKws : queryKws

  // ── Title keyword match — 30 pts
  if (keywords.length > 0) {
    const hits = keywords.filter(k => titleLower.includes(k)).length
    score += Math.round((hits / keywords.length) * 30)
  } else {
    score += 10  // neutral if no keywords extracted
  }

  // ── Price — 25 pts
  if (result.price !== null) score += 25

  // ── Image — 15 pts
  if (result.image) score += 15

  // ── Brand match — 10 pts
  if (intent.brand) {
    if (titleLower.includes(intent.brand.toLowerCase())) score += 10
  } else {
    score += 5  // neutral bonus when no brand specified
  }

  // ── Location match — 10 pts
  if (intent.location) {
    const locLower = intent.location.toLowerCase()
    const matchesSource   = result.source.toLowerCase().includes(locLower)
    const matchesLocation = (result.location || "").toLowerCase().includes(locLower)
    // Also check country of the source (lb, ae, etc.)
    const matchesCountry  = intent.country
      ? result.sourceId.endsWith(`_${intent.country.toLowerCase()}`)
      : false
    if (matchesSource || matchesLocation || matchesCountry) score += 10
  } else {
    score += 5  // neutral
  }

  // ── Condition — 5 pts
  if (intent.condition === "any") {
    score += 5
  } else if (intent.condition === "new"  && result.condition === "New") {
    score += 5
  } else if (intent.condition === "used" && result.condition.startsWith("Used")) {
    score += 5
  }

  // ── Price range — 5 pts
  const { min, max } = intent.price_range
  if (result.price !== null) {
    const inRange = (min === null || result.price >= min) &&
                    (max === null || result.price <= max)
    if (inRange) score += 5
  }

  return Math.min(100, Math.max(0, score))
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seenUrls = new Set<string>()
  const seenSigs = new Set<string>()

  return results.filter(r => {
    // Exact URL dedup
    if (seenUrls.has(r.url)) return false
    seenUrls.add(r.url)

    // Fuzzy dedup: same source + price + title slug
    const slug = (r.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)
    const sig  = `${r.sourceId}|${r.price ?? "null"}|${slug}`
    if (seenSigs.has(sig)) return false
    seenSigs.add(sig)

    return true
  })
}

// ── Source balancing ──────────────────────────────────────────────────────────

function balanceSources(results: SearchResult[], maxPerSource: number): SearchResult[] {
  const counts: Record<string, number> = {}
  return results.filter(r => {
    const c = counts[r.sourceId] || 0
    if (c >= maxPerSource) return false
    counts[r.sourceId] = c + 1
    return true
  })
}

// ── Rejection: must have price or image ──────────────────────────────────────

function filterMissingData(results: SearchResult[]): SearchResult[] {
  return results.filter(r => {
    if (r.price === null && !r.image) return false  // reject: missing_price_or_image
    return true
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

export function rankResults(
  results:      SearchResult[],
  intent:       ProductIntent,
  query:        string,
  maxPerSource: number = 5,
  topN:         number = 10
): SearchResult[] {
  // 1. Reject results with no price AND no image
  const valid = filterMissingData(results)

  // 2. Score each result
  const scored = valid.map(r => ({ ...r, score: scoreResult(r, intent, query) }))

  // 3. Sort by score desc
  scored.sort((a, b) => b.score - a.score)

  // 4. Dedup across sources
  const deduped = deduplicateResults(scored)

  // 5. Balance — no source dominates
  const balanced = balanceSources(deduped, maxPerSource)

  // 6. Top N
  return balanced.slice(0, topN)
}
