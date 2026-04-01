import { logger } from "../utils/logger"

export interface WebSearchResult {
  retailer: string
  url:      string
  title:    string
}

const TIMEOUT_MS = 30_000

/**
 * Uses Claude with the web_search_20250305 tool to find product page URLs
 * on specified retailers. Returns up to 10 results total (multiple per retailer).
 * Hard-caps at 30 seconds — returns whatever was found before timeout.
 */
export async function aiWebSearch(
  query:     string,
  retailers: string[],
  apiKey:    string
): Promise<WebSearchResult[]> {
  const retailerList = retailers.join(", ")

  const prompt =
    `Search for product listings for: "${query}"\n\n` +
    `Find listings on these retailers: ${retailerList}\n\n` +
    `For each retailer, find up to 3 matching product page URLs ` +
    `(e.g. different sizes, variants, or sellers of the same product).\n` +
    `Return up to 10 results total across all retailers.\n\n` +
    `Return ONLY a JSON array in this exact format:\n` +
    `[{"retailer": "Amazon AE", "url": "https://...", "title": "exact product title as shown"}]\n\n` +
    `Rules:\n` +
    `- Only direct product pages (not search results pages)\n` +
    `- title must be the product name as shown on that retailer's page\n` +
    `- Return [] if nothing found\n` +
    `- Return ONLY the JSON array, no explanation`

  logger.info("[AIWebSearch] Searching", { query, retailers: retailerList })

  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
    logger.warn("[AIWebSearch] 30s timeout reached, aborting")
  }, TIMEOUT_MS)

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      signal:  controller.signal,
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
        "anthropic-beta":    "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`Claude API ${response.status}: ${text}`)
    }

    const data = await response.json()

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
    const valid = parsed
      .filter((r) => r.retailer && r.url && r.url.startsWith("http") && r.title)
      .slice(0, 10)

    logger.info("[AIWebSearch] Results", { count: valid.length, query })
    return valid

  } catch (err: any) {
    if (err.name === "AbortError") {
      logger.warn("[AIWebSearch] Aborted after 30s timeout")
      return []
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
