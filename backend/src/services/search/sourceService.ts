// ─────────────────────────────────────────────────────────────────────────────
// sourceService — loads search sources from the DB (search_sources +
// search_source_configs tables) and converts them into Source objects.
//
// Sources are cached in memory for 5 minutes so every search request doesn't
// hit the DB. Call invalidateCache() after any admin update.
// ─────────────────────────────────────────────────────────────────────────────

import { query as dbQuery } from "../../db"
import { logger }           from "../../utils/logger"
import { Source, ProductCategory } from "./types"

// ── In-memory cache ───────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000   // 5 minutes

let cachedSources:   Source[]  = []
let cacheLoadedAt:   number    = 0

export function invalidateCache(): void {
  cacheLoadedAt = 0
}

// ── DB row → Source ───────────────────────────────────────────────────────────

function rowToSource(row: any): Source {
  const detailPatterns: RegExp[] = (row.detail_patterns as string[] || []).map(p => new RegExp(p, "i"))
  const listPatterns:   RegExp[] = (row.list_patterns   as string[] || []).map(p => new RegExp(p, "i"))

  // Replace {query} placeholder in the template
  const template: string = row.search_url_template || ""

  return {
    id:             row.source_id,
    name:           row.name,
    domain:         row.domain,
    country:        row.country,
    categories:     (row.categories  as ProductCategory[]) || [],
    type:           row.source_type  as any,
    priority:       row.priority     as any || {},
    searchUrl:      (q: string) => template.replace("{query}", encodeURIComponent(q)),
    detailPatterns,
    listPatterns,
  }
}

// ── Load from DB ──────────────────────────────────────────────────────────────

export async function loadSources(forceRefresh = false): Promise<Source[]> {
  const now = Date.now()
  if (!forceRefresh && cachedSources.length > 0 && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedSources
  }

  try {
    const { rows } = await dbQuery(
      `SELECT
         ss.source_id,
         ss.name,
         ss.domain,
         ss.country,
         ss.categories,
         ss.source_type,
         ss.priority,
         sc.search_url_template,
         sc.detail_patterns,
         sc.list_patterns
       FROM search_sources ss
       LEFT JOIN search_source_configs sc ON sc.source_id = ss.id
       WHERE ss.is_active = true
       ORDER BY ss.country, ss.source_id`,
      []
    )

    cachedSources = rows.map(rowToSource)
    cacheLoadedAt = now
    logger.info("[SourceService] Loaded sources from DB", { count: cachedSources.length })
    return cachedSources
  } catch (err: any) {
    logger.error("[SourceService] Failed to load sources", { error: err.message })
    // Return stale cache rather than crashing the pipeline
    return cachedSources
  }
}

export async function getSourceById(id: string): Promise<Source | undefined> {
  const sources = await loadSources()
  return sources.find(s => s.id === id)
}
