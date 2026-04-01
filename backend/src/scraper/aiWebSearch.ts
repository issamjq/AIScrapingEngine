import { logger } from "../utils/logger"

export interface WebSearchResult {
  retailer: string
  url:       string
  title:     string
}

/**
 * Uses Claude with the web_search_20250305 tool to find exact product page
 * URLs on specified retailers for a given search query.
 */
export async function aiWebSearch(
  query:    string,
  retailers: string[],
  apiKey:   string
): Promise<WebSearchResult[]> {
  const retailerList = retailers.join(", ")

  const prompt =
    `Search for the exact product page URL for: "${query}"\n\n` +
    `Find the product on these retailers: ${retailerList}\n\n` +
    `For each retailer, return the direct product page URL (not a search results page).\n` +
    `Return ONLY a JSON array in this exact format:\n` +
    `[{"retailer": "Amazon AE", "url": "https://...", "title": "exact product title"}]\n\n` +
    `Rules:\n` +
    `- Only include retailers where you found the actual product page\n` +
    `- URLs must be direct product pages, not search result pages\n` +
    `- title must be the product name as shown on that retailer's page\n` +
    `- Return an empty array [] if nothing found\n` +
    `- Do NOT include any explanation, only the JSON array`

  logger.info("[AIWebSearch] Searching", { query, retailers: retailerList })

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
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

  // Extract text from the final assistant message content blocks
  const textBlocks: string[] = []
  for (const block of data?.content ?? []) {
    if (block.type === "text" && block.text) textBlocks.push(block.text)
  }
  const rawText = textBlocks.join("\n")
  logger.debug("[AIWebSearch] Raw response", { rawText: rawText.slice(0, 500) })

  // Parse JSON array from the response
  const match = rawText.match(/\[[\s\S]*\]/)
  if (!match) {
    logger.warn("[AIWebSearch] No JSON array found in response", { rawText: rawText.slice(0, 300) })
    return []
  }

  try {
    const parsed: WebSearchResult[] = JSON.parse(match[0])
    const valid = parsed.filter(
      (r) => r.retailer && r.url && r.url.startsWith("http") && r.title
    )
    logger.info("[AIWebSearch] Results", { count: valid.length, query })
    return valid
  } catch (err: any) {
    logger.warn("[AIWebSearch] JSON parse failed", { error: err.message })
    return []
  }
}
