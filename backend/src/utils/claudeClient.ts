import { logger } from "./logger"

/**
 * Shared Claude API client with:
 * - Auto-retry on 429 (waits for Retry-After header or 30s)
 * - Concurrency queue — limits simultaneous Claude calls to prevent
 *   rate limits when many users hit the system at once
 */

// ── Concurrency queue ──────────────────────────────────────────────
// Limits how many Claude requests run in parallel across all users.
// Raise MAX_CONCURRENT if you upgrade to a higher Anthropic tier.
const MAX_CONCURRENT = 3
let   running        = 0
const waitQueue: Array<() => void> = []

function acquire(): Promise<void> {
  return new Promise((resolve) => {
    if (running < MAX_CONCURRENT) {
      running++
      resolve()
    } else {
      waitQueue.push(() => { running++; resolve() })
    }
  })
}

function release() {
  running--
  const next = waitQueue.shift()
  if (next) next()
}

// ── Claude fetch with retry ────────────────────────────────────────
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

interface ClaudeRequest {
  model:      string
  max_tokens: number
  messages:   { role: string; content: string }[]
  tools?:     any[]
  beta?:      string          // e.g. "web-search-2025-03-05"
}

export async function callClaude(apiKey: string, req: ClaudeRequest): Promise<any> {
  await acquire()
  try {
    return await fetchWithRetry(apiKey, req)
  } finally {
    release()
  }
}

async function fetchWithRetry(
  apiKey:  string,
  req:     ClaudeRequest,
  attempt: number = 1
): Promise<any> {
  const headers: Record<string, string> = {
    "x-api-key":         apiKey,
    "anthropic-version": "2023-06-01",
    "content-type":      "application/json",
  }
  if (req.beta) headers["anthropic-beta"] = req.beta

  const { beta, ...body } = req
  const response = await fetch(ANTHROPIC_URL, {
    method:  "POST",
    headers,
    body:    JSON.stringify(body),
  })

  if (response.status === 429) {
    if (attempt >= 2) {
      throw new Error("Rate limit reached — please wait a moment and try again.")
    }
    // Respect Retry-After header if present, cap at 15s to fail fast
    const retryAfter = parseInt(response.headers.get("retry-after") || "15", 10)
    const waitMs     = Math.min(retryAfter * 1000, 15_000)
    logger.warn(`[ClaudeClient] 429 rate limit — waiting ${waitMs / 1000}s before retry ${attempt + 1}`)
    await new Promise((r) => setTimeout(r, waitMs))
    return fetchWithRetry(apiKey, req, attempt + 1)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`Claude API ${response.status}: ${text}`)
  }

  return response.json()
}
