import { query as dbQuery } from "../db"
import { logger } from "../utils/logger"

/**
 * Normalize a search query for deduplication.
 * "iPhone 17 Pro Max" and "iphone 17 max pro" → both become "17 iphone max pro"
 */
export function normalizeSuggestion(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ")
}

/**
 * Upsert a successful search query into the suggestions table.
 * Call fire-and-forget (don't await in hot paths).
 * Only saves if query is 3–120 chars and had results.
 */
export async function upsertSuggestion(rawQuery: string, resultCount: number): Promise<void> {
  const q = rawQuery.trim()
  if (q.length < 3 || q.length > 120) return
  if (resultCount < 1) return  // don't suggest queries that returned nothing

  const key = normalizeSuggestion(q)

  try {
    await dbQuery(
      `INSERT INTO search_suggestions (normalized_key, query, search_count, last_searched_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (normalized_key) DO UPDATE
         SET search_count     = search_suggestions.search_count + 1,
             last_searched_at = NOW(),
             query            = $2`,
      [key, q]
    )
  } catch (err: any) {
    logger.warn("[Suggestions] upsert failed", { error: err.message })
  }
}

/**
 * Fetch top suggestions matching the user's partial query.
 * Returns up to `limit` rows sorted by popularity.
 */
export async function getSuggestions(partialQuery: string, limit = 8): Promise<string[]> {
  const q = partialQuery.trim()
  if (q.length < 1) return []

  try {
    const { rows } = await dbQuery(
      `SELECT query
       FROM   search_suggestions
       WHERE  query ILIKE $1
       ORDER  BY search_count DESC
       LIMIT  $2`,
      [`%${q}%`, limit]
    )
    return rows.map((r: any) => r.query)
  } catch (err: any) {
    logger.warn("[Suggestions] fetch failed", { error: err.message })
    return []
  }
}
