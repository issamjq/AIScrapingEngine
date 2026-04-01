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
    `You are a precise product search assistant. Search for the EXACT product: "${query}"\n\n` +
    `Search on these retailers: ${retailerList}\n\n` +
    `CRITICAL RULES — read carefully:\n` +
    `1. Only return listings that match the EXACT product the user asked for.\n` +
    `   - If the user asked for "75ml", ONLY return 75ml listings. NEVER return 25ml, 85ml, or other sizes.\n` +
    `   - If the user asked for "Classic Mint", ONLY return Classic Mint. Not Whitening Mint, not Ginger Mint.\n` +
    `   - If the user asked for a specific brand, only return that brand.\n` +
    `2. Do NOT return search results pages — only direct product pages.\n` +
    `3. Per retailer, return up to 10 direct product page URLs that are this EXACT product.\n` +
    `   (Multiple sellers/listings of the same exact product on one retailer are OK.)\n` +
    `4. If the exact product is not found on a retailer, return nothing for that retailer.\n` +
    `5. Return ONLY a JSON array, no explanation:\n` +
    `[{"retailer": "Amazon AE", "url": "https://...", "title": "exact product title as shown on the page"}]`

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
        max_tokens: 4096,
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
