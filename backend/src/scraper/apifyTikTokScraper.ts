/**
 * Apify TikTok Scraper integration.
 *
 * Uses the clockworks/tiktok-scraper actor to fetch real TikTok video data
 * from trending hashtags (#tiktokshop, #tiktokmademebuyit, etc.).
 * Claude then parses product names from video captions and aggregates
 * by product to produce a ranked trending list.
 *
 * Cost: ~$3.70 / 1,000 videos → ~$0.20 per scrape run (50 videos)
 */

import { callClaude } from "../utils/claudeClient"
import { logger }     from "../utils/logger"
import { TikTokProduct } from "./tiktokScraper"

const ACTOR_ID     = "clockworks~tiktok-scraper"
const APIFY_BASE   = "https://api.apify.com/v2"
const POLL_INTERVAL_MS = 5_000   // check run status every 5 s
const MAX_WAIT_MS       = 180_000 // give up after 3 minutes

// ─── Apify API types ──────────────────────────────────────────────────────────

interface ApifyRun {
  id:               string
  status:           "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "TIMED-OUT" | "ABORTED"
  defaultDatasetId: string
}

interface ApifyVideo {
  id?:            string
  text:           string   // caption — contains product info
  createTimeISO?: string
  webVideoUrl:    string
  // Flat dot-notation fields returned by clockworks/tiktok-scraper
  "authorMeta.name"?:   string
  "authorMeta.avatar"?: string
  playCount?:    number   // views — key popularity metric
  diggCount?:    number   // likes
  shareCount?:   number
  commentCount?: number
}

// ─── Step 1: start actor run ──────────────────────────────────────────────────

async function startActorRun(
  apifyToken:    string,
  searchQueries: string[],
  videosPerQuery: number
): Promise<ApifyRun> {
  const url = `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${apifyToken}`

  // Use searchQueries (not hashtags) — search results include full playCount stats.
  // Hashtag feeds omit view counts, making GMV estimation impossible.
  const body = {
    searchQueries,
    resultsPerPage:          videosPerQuery,
    shouldDownloadVideos:    false,
    shouldDownloadCovers:    false,
    shouldDownloadSubtitles: false,
  }

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Apify start run failed ${res.status}: ${text}`)
  }

  const json = await res.json()
  return json.data as ApifyRun
}

// ─── Step 2: poll until done ──────────────────────────────────────────────────

async function pollUntilDone(apifyToken: string, runId: string): Promise<ApifyRun> {
  const deadline = Date.now() + MAX_WAIT_MS
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)

    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apifyToken}`)
    if (!res.ok) throw new Error(`Apify poll failed ${res.status}`)

    const json = await res.json()
    const run  = json.data as ApifyRun

    logger.debug("[ApifyTikTok] Poll status", { runId, status: run.status })

    if (run.status === "SUCCEEDED") return run
    if (["FAILED", "TIMED-OUT", "ABORTED"].includes(run.status)) {
      throw new Error(`Apify run ${run.status}`)
    }
  }
  throw new Error("Apify run timed out after 3 minutes")
}

// ─── Step 3: fetch dataset items ─────────────────────────────────────────────

async function fetchDatasetItems(
  apifyToken: string,
  datasetId:  string,
  limit:      number
): Promise<ApifyVideo[]> {
  const url = `${APIFY_BASE}/datasets/${datasetId}/items?token=${apifyToken}&limit=${limit}&clean=true`
  const res  = await fetch(url)
  if (!res.ok) throw new Error(`Apify dataset fetch failed ${res.status}`)
  return res.json()
}

// ─── Step 4: Claude extracts products from video captions ─────────────────────

async function extractProductsFromVideos(
  videos:   ApifyVideo[],
  apiKey:   string,
  limit:    number
): Promise<TikTokProduct[]> {
  // Build creator → image lookup + ordered list of all images
  const creatorImageMap = new Map<string, string>()
  const allImages: string[] = []
  const sorted = [...videos].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))
  for (const v of sorted) {
    const name  = v["authorMeta.name"]
    const image = v["authorMeta.avatar"]
    if (image) {
      if (name && !creatorImageMap.has(name)) creatorImageMap.set(name, image)
      if (!allImages.includes(image)) allImages.push(image)
    }
  }

  // Build a compact representation of videos for Claude
  const videoSummaries = videos
    .filter(v => v.text && v.text.length > 10)
    .slice(0, 200)
    .map(v => ({
      caption: v.text.slice(0, 400),
      views:   v.playCount  ?? 0,
      likes:   v.diggCount  ?? 0,
      shares:  v.shareCount ?? 0,
      creator: v["authorMeta.name"] ?? null,
      url:     v.webVideoUrl ?? null,
    }))
    .sort((a, b) => b.views - a.views)

  const videosJson = JSON.stringify(videoSummaries, null, 0)

  const prompt =
    `You are a TikTok product analytics API.\n\n` +
    `Below is a list of TikTok videos scraped from trending shopping searches. ` +
    `Each video has a caption, view count, and creator handle.\n\n` +
    `VIDEOS:\n${videosJson.slice(0, 10000)}\n\n` +
    `Task: identify distinct physical products being promoted and aggregate their stats.\n` +
    `For each unique product output EXACTLY these fields:\n` +
    `- product_name: specific product name — be precise, not generic (string)\n` +
    `- category: one of "Beauty", "Womenswear", "Home & Kitchen", "Health", "Electronics", "Food & Beverage", "Fashion", "Sports & Outdoors", "Pets", "Baby & Kids" (string|null)\n` +
    `- tiktok_price: price in USD — look for "$X", "only $X", "X dollars", "X.XX" patterns in captions (number|null)\n` +
    `- gmv_7d: 7-day GMV = total_views × 0.005 × (tiktok_price if found, else: Beauty=$28, Electronics=$45, Home=$22, Health=$30, Womenswear=$35, default=$25) (number)\n` +
    `- units_sold_7d: total_views × 0.005, rounded to integer (number)\n` +
    `- growth_pct: if video_count > 1, estimate % growth based on view velocity; else null (number|null)\n` +
    `- video_count: count of videos mentioning this product (number)\n` +
    `- top_creator_handle: creator handle with highest views for this product (string|null)\n` +
    `- shop_name: TikTok Shop name if mentioned in caption (string|null)\n` +
    `- image_url: null — will be filled in by system (always null here)\n\n` +
    `RULES:\n` +
    `- Return top ${limit} products sorted by gmv_7d descending\n` +
    `- Merge duplicates aggressively\n` +
    `- gmv_7d and units_sold_7d must ALWAYS be numbers, never null\n` +
    `- Output ONLY a JSON array — no text before or after, no markdown fences\n` +
    `- All number fields must be actual numbers\n\n` +
    `Output:`

  const data = await callClaude(apiKey, {
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages:   [{ role: "user", content: prompt }],
  })

  const raw     = (data?.content?.[0]?.text ?? "").trim()
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  const start   = jsonStr.indexOf("[")
  const end     = jsonStr.lastIndexOf("]")

  if (start === -1 || end === -1) {
    logger.warn("[ApifyTikTok] No JSON in extraction response", { preview: jsonStr.slice(0, 200) })
    return []
  }

  try {
    const arr: any[] = JSON.parse(jsonStr.slice(start, end + 1))
    return arr.map((p, i) => {
      const s = sanitize(p)
      // 1. Try exact handle match
      if (!s.image_url && s.top_creator_handle) {
        const handle = s.top_creator_handle.replace(/^@/, "")
        s.image_url = creatorImageMap.get(handle) ?? creatorImageMap.get(`@${handle}`) ?? null
      }
      // 2. Fallback: round-robin from top-viewed images list
      if (!s.image_url && allImages.length > 0) {
        s.image_url = allImages[i % allImages.length]
      }
      return s
    })
  } catch (err: any) {
    logger.error("[ApifyTikTok] JSON parse failed", { error: err.message })
    return []
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeApifyTikTok(opts: {
  apifyToken:        string
  claudeApiKey:      string
  searchQueries?:    string[]
  videosPerQuery?:   number
  limit?:            number
}): Promise<TikTokProduct[]> {
  const {
    apifyToken,
    claudeApiKey,
    searchQueries  = [
      "best selling products TikTok shop 2026",
      "trending TikTok products buy now",
      "TikTok shop must haves viral products",
    ],
    videosPerQuery = 50,
    limit          = 20,
  } = opts

  logger.info("[ApifyTikTok] Starting scrape", { searchQueries, videosPerQuery })

  // Step 1: start run
  const run = await startActorRun(apifyToken, searchQueries, videosPerQuery)
  logger.info("[ApifyTikTok] Run started", { runId: run.id, status: run.status })

  // Step 2: wait for completion
  const doneRun = await pollUntilDone(apifyToken, run.id)
  logger.info("[ApifyTikTok] Run succeeded", { datasetId: doneRun.defaultDatasetId })

  // Step 3: fetch videos
  const totalVideos = searchQueries.length * videosPerQuery
  const videos = await fetchDatasetItems(apifyToken, doneRun.defaultDatasetId, totalVideos)
  logger.info("[ApifyTikTok] Fetched videos", { count: videos.length })

  if (videos.length === 0) return []

  // Step 4: extract products using Claude
  const products = await extractProductsFromVideos(videos, claudeApiKey, limit)
  logger.info("[ApifyTikTok] Products extracted", { count: products.length })

  return products
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitize(p: any): TikTokProduct {
  return {
    product_name:       String(p.product_name       ?? "Unknown Product"),
    category:           p.category           ? String(p.category)           : null,
    tiktok_price:       toNum(p.tiktok_price),
    gmv_7d:             toNum(p.gmv_7d),
    units_sold_7d:      toInt(p.units_sold_7d),
    growth_pct:         toNum(p.growth_pct),
    video_count:        toInt(p.video_count),
    top_creator_handle: p.top_creator_handle ? String(p.top_creator_handle) : null,
    shop_name:          p.shop_name          ? String(p.shop_name)          : null,
    image_url:          p.image_url          ? String(p.image_url)          : null,
  }
}

function toNum(v: any): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return isFinite(n) ? n : null
}
function toInt(v: any): number | null {
  const n = toNum(v)
  return n !== null ? Math.round(n) : null
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
