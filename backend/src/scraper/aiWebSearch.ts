import { logger } from "../utils/logger"
import { callClaude } from "../utils/claudeClient"

export interface WebSearchResult {
  retailer: string
  url:      string
  title:    string
}

const TIMEOUT_MS = 70_000  // covers up to 2 retries

/**
 * Uses Claude with the web_search_20250305 tool to find product page URLs
 * on specified retailers. Returns up to 10 results per retailer.
 * Uses shared claudeClient for concurrency queuing + auto-retry on 429.
 */
export async function aiWebSearch(
  query:     string,
  retailers: string[],
  apiKey:    string
): Promise<WebSearchResult[]> {
  const retailerList = retailers.join(", ")

  const prompt =
    `Find as many direct product page URLs as possible for: "${query}"\n\n` +
    `Search on each of these retailers: ${retailerList}\n\n` +
    `For EACH retailer, search multiple times with different search terms to find ALL available listings.\n` +
    `- On Amazon, the same product is often listed under multiple ASINs by different sellers — find all of them.\n` +
    `- On other retailers, search by product name, brand, and SKU variations to find every listing.\n` +
    `- Aim for up to 10 direct product page URLs per retailer. More results = better.\n\n` +
    `ONLY include a URL if:\n` +
    `- It is a direct product page (not a search results page or category page)\n` +
    `- It matches the EXACT size in the query (e.g. "75ml" → only 75ml, never 25ml or 85ml or any other size)\n` +
    `- It matches the EXACT variant/flavor (e.g. "Classic Mint" → only Classic Mint; Cinnamon Mint, Ginger Mint, Anise Mint are DIFFERENT products)\n` +
    `- It is a single individual product, not a bundle, multipack, or gift set\n\n` +
    `Search aggressively. Do not stop at the first result — keep searching until you have found all available listings.\n` +
    `If a retailer genuinely has no matching product, return nothing for it.\n\n` +
    `Return ONLY a JSON array, no other text:\n` +
    `[{"retailer": "Amazon AE", "url": "https://...", "title": "product title from the page"}]`

  logger.info("[AIWebSearch] Searching", { query, retailers: retailerList })

  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
    logger.warn("[AIWebSearch] Timeout reached, aborting")
  }, TIMEOUT_MS)

  try {
    const data = await callClaude(apiKey, {
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      tools:      [{ type: "web_search_20250305", name: "web_search" }],
      messages:   [{ role: "user", content: prompt }],
      beta:       "web-search-2025-03-05",
    })

    const textBlocks: string[] = []
    for (const block of data?.content ?? []) {
      if (block.type === "text" && block.text) textBlocks.push(block.text)
    }
    const rawText = textBlocks.join("\n")
    logger.debug("[AIWebSearch] Raw response", { rawText: rawText.slice(0, 500) })

    const match = rawText.match(/\[[\s\S]*\]/)
    if (!match) {
      logger.warn("[AIWebSearch] No JSON array in response", { rawText: rawText.slice(0, 300) })
      return []
    }

    const parsed: WebSearchResult[] = JSON.parse(match[0])
    const valid = parsed.filter((r) => r.retailer && r.url && r.url.startsWith("http") && r.title)

    logger.info("[AIWebSearch] Results", { count: valid.length, query })
    return valid

  } catch (err: any) {
    if (err.name === "AbortError") {
      logger.warn("[AIWebSearch] Aborted after timeout")
      return []
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
