/**
 * AliExpress Super Deals — Playwright + Claude Vision hybrid scraper.
 *
 * Strategy (3 phases):
 *   Phase 1 — Screenshot: scroll through the Recommended section, take 5
 *             viewport screenshots, send all to Claude Vision in one API call.
 *             Vision reads product names + prices exactly as displayed.
 *
 *   Phase 2 — Search: for each product name Vision returned, run an AliExpress
 *             search, grab the first result's URL / image / ASIN from DOM.
 *             This guarantees the URL actually matches the product name.
 *
 *   Phase 3 — Merge: Vision data (name/price/rating) + Search data (url/image/asin).
 *             Screenshots are in-memory Buffers — cleared after Vision call.
 *
 * Data stored in amazon_trending with marketplace = "Alibaba".
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

const SUPER_DEALS_URL = "https://www.aliexpress.com/ssr/300002660/Deals-HomePage?disableNav=YES&pha_manifest=ssr&_immersiveMode=true"
const CLAUDE_API      = "https://api.anthropic.com/v1/messages"

// ─── Phase 1: Claude Vision — extract names + prices from screenshots ─────────

async function extractWithVision(
  screenshots: Buffer[],
): Promise<Array<{
  product_name:   string
  price:          number | null
  original_price: number | null
  rating:         number | null
  review_count:   number | null
}>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    logger.warn("[AlibabaScraper] No ANTHROPIC_API_KEY — skipping Vision")
    return []
  }

  const imageBlocks = screenshots.map(buf => ({
    type:   "image",
    source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") },
  }))

  let text = "[]"

  try {
    const resp = await fetch(CLAUDE_API, {
      method:  "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        messages: [{
          role:    "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: `These are ${screenshots.length} screenshots of the AliExpress Super Deals / Recommended section scrolled through.
Extract ALL visible products across ALL screenshots (skip duplicates).
Return ONLY a valid JSON array — no markdown fences, no explanation:
[{"product_name":"...","price":2.80,"original_price":3.57,"rating":null,"review_count":null}]

Rules:
- product_name = the full product title shown on the card (read every word carefully)
- price = the current sale price shown on the card
- original_price = the crossed-out / strikethrough price — null if none
- original_price MUST be higher than price, otherwise null
- Both prices are numbers not strings
- Skip any product that appears in multiple screenshots (no duplicates)
- rating: 1.0–5.0 or null
- review_count: integer or null
- If no products visible return []`,
            },
          ],
        }],
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "")
      throw new Error(`Claude API ${resp.status}: ${errText}`)
    }

    const json = await resp.json()
    const raw  = json.content?.[0]?.text?.trim() ?? "[]"
    const match = raw.match(/\[[\s\S]*\]/)
    text = match ? match[0] : "[]"
  } catch (err: any) {
    logger.warn("[AlibabaScraper] Vision API error", { error: err.message })
    return []
  }

  try {
    const arr = JSON.parse(text)
    if (!Array.isArray(arr)) return []

    return arr.map((p: any) => {
      const sp = typeof p.price === "number" && p.price > 0 && p.price < 50000 ? p.price : null
      const op = typeof p.original_price === "number" && p.original_price > 0 && p.original_price < 50000 ? p.original_price : null
      return {
        product_name:   String(p.product_name ?? "").trim(),
        price:          sp,
        original_price: op && sp && op > sp ? op : null,
        rating:         typeof p.rating === "number" && p.rating >= 1 && p.rating <= 5 ? p.rating : null,
        review_count:   typeof p.review_count === "number" && p.review_count > 0 ? Math.round(p.review_count) : null,
      }
    }).filter((p: any) => p.product_name.length >= 3)
  } catch (err: any) {
    logger.warn("[AlibabaScraper] Vision JSON parse failed", { raw: text.slice(0, 200), error: err.message })
    return []
  }
}

// ─── Phase 2: Search AliExpress by product name → get correct URL / image ────

async function searchForProduct(
  page:        import("playwright").Page,
  productName: string,
): Promise<{ product_url: string | null; image_url: string | null; asin: string | null }> {
  const searchUrl = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(productName)}&sortType=default`

  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20_000 })
    await page.waitForTimeout(2000)
  } catch {
    return { product_url: null, image_url: null, asin: null }
  }

  // Check for bot challenge
  const title = await page.title().catch(() => "")
  if (/captcha|robot|verify/i.test(title)) {
    return { product_url: null, image_url: null, asin: null }
  }

  return await page.evaluate(() => {
    // Find the first product link in the search results
    const links = Array.from(document.querySelectorAll("a[href*='/item/']"))
    const link  = links[0] as HTMLAnchorElement | undefined
    if (!link) return { product_url: null, image_url: null, asin: null }

    const href        = link.href || link.getAttribute("href") || ""
    const product_url = href.startsWith("//") ? `https:${href}` : href
    const asin        = href.match(/\/item\/(\d+)/)?.[1] ?? null

    // Find the image closest to this link
    const container = link.closest("[class*='card'], [class*='item'], [class*='product'], li") ?? link.parentElement ?? link
    const imgEl     = container?.querySelector("img") as HTMLImageElement | null
    const raw_img   = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || null
    const image_url = raw_img
      ? (raw_img.startsWith("//") ? `https:${raw_img}` : raw_img)
      : null

    return {
      product_url: product_url || null,
      image_url,
      asin,
    }
  })
}

// ─── Phase 3: Scrape deals page + orchestrate all phases ─────────────────────

async function scrapeDealsPage(
  page: import("playwright").Page
): Promise<AmazonProduct[]> {
  // ── Navigate to SSR Super Deals page ──────────────────────────────────────
  try {
    await page.goto(SUPER_DEALS_URL, { waitUntil: "domcontentloaded", timeout: 40_000 })
    await page.waitForTimeout(4000)
  } catch (err: any) {
    logger.warn("[AlibabaScraper] Page load failed", { error: err.message })
    return []
  }

  // Bot challenge check
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) ?? "").catch(() => "")
  if (/captcha|robot|access.denied|verify you|unusual traffic|slide to verify/i.test(bodyText)) {
    logger.warn("[AlibabaScraper] Bot challenge detected — IP flagged, wait 20-30 min")
    return []
  }

  // Scroll to load all lazy product cards
  try {
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, 1200))
      await page.waitForTimeout(600)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(2000)
  } catch { /* ignore */ }

  const pageTitle = await page.title().catch(() => "")
  logger.info("[AlibabaScraper] Page loaded", { title: pageTitle })

  // ── Phase 1: Take 5 viewport screenshots of Recommended grid ──────────────
  const screenshots: Buffer[] = []

  await page.evaluate(() => window.scrollTo(0, 700))
  await page.waitForTimeout(1200)
  screenshots.push(await page.screenshot({ type: "jpeg", quality: 85 }))

  await page.evaluate(() => window.scrollBy(0, 900))
  await page.waitForTimeout(1000)
  screenshots.push(await page.screenshot({ type: "jpeg", quality: 85 }))

  await page.evaluate(() => window.scrollBy(0, 900))
  await page.waitForTimeout(1000)
  screenshots.push(await page.screenshot({ type: "jpeg", quality: 85 }))

  await page.evaluate(() => window.scrollBy(0, 900))
  await page.waitForTimeout(1000)
  screenshots.push(await page.screenshot({ type: "jpeg", quality: 85 }))

  await page.evaluate(() => window.scrollBy(0, 900))
  await page.waitForTimeout(1000)
  screenshots.push(await page.screenshot({ type: "jpeg", quality: 85 }))

  logger.info("[AlibabaScraper] Screenshots taken", { count: screenshots.length })

  // Send all screenshots to Claude Vision in one API call
  const visionResult = await extractWithVision(screenshots)

  // Clear screenshots from memory — no longer needed
  screenshots.splice(0)

  logger.info("[AlibabaScraper] Vision extracted", { count: visionResult.length })

  if (visionResult.length === 0) return []

  // ── Phase 2: Search AliExpress for each product name to get correct URL ───
  logger.info("[AlibabaScraper] Starting product search phase", { total: visionResult.length })

  const products: AmazonProduct[] = []

  for (let i = 0; i < visionResult.length; i++) {
    const vis = visionResult[i]
    if (!vis.product_name || vis.product_name.length < 3) continue

    logger.info("[AlibabaScraper] Searching", { rank: i + 1, name: vis.product_name.slice(0, 50) })

    const searchData = await searchForProduct(page, vis.product_name)

    products.push({
      asin:           searchData.asin,
      product_name:   vis.product_name,
      category:       "Super Deals",
      rank:           i + 1,
      price:          vis.price,
      original_price: vis.original_price,
      rating:         vis.rating,
      review_count:   vis.review_count,
      image_url:      searchData.image_url,
      product_url:    searchData.product_url,
      badge:          "Best Seller",
      brand:          null,
      marketplace:    "Alibaba",
    })

    // Small delay between searches to avoid rate-limiting
    await page.waitForTimeout(800 + Math.random() * 400)
  }

  const pricesFound  = products.filter(p => p.price !== null).length
  const urlsFound    = products.filter(p => p.product_url !== null).length
  const imagesFound  = products.filter(p => p.image_url !== null).length
  logger.info("[AlibabaScraper] All phases complete", { total: products.length, pricesFound, urlsFound, imagesFound })

  return products
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeAlibabaBestSellers(opts: {
  category?: string
  limit?:    number
}): Promise<AmazonProduct[]> {
  const { limit = 40 } = opts

  // ── Delegate to local home-PC scraper if URL is configured ──────────────────
  const localUrl = process.env.LOCAL_SCRAPER_URL
  if (localUrl) {
    logger.info("[AlibabaScraper] Delegating to local scraper", { localUrl })
    try {
      const resp = await fetch(
        `${localUrl}/scrape-aliexpress?limit=${limit}`,
        { method: "POST", signal: AbortSignal.timeout(300_000) }
      )
      if (!resp.ok) throw new Error(`Local scraper responded ${resp.status}`)
      const data = await resp.json() as { products: AmazonProduct[] }
      logger.info("[AlibabaScraper] Local scraper returned", { count: data.products.length })
      return data.products
    } catch (err: any) {
      logger.error("[AlibabaScraper] Local scraper failed, falling back", { error: err.message })
    }
  }

  logger.info("[AlibabaScraper] Starting Vision + Search scrape")

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })
  const context = await browser.newContext({
    userAgent:        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale:           "en-US",
    viewport:         { width: 1440, height: 900 },
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  })
  await context.addCookies([
    { name: "aep_usuc_f", value: "site=glo&c_tp=USD&region=US&b_locale=en_US", domain: ".aliexpress.com", path: "/" },
    { name: "xman_us_f",  value: "x_locale=en_US&acs_rt=",                     domain: ".aliexpress.com", path: "/" },
  ])
  const page = await context.newPage()

  try {
    const products = await scrapeDealsPage(page)
    const seen  = new Set<string>()
    const dedup = products.filter(p => {
      const key = p.asin ?? p.product_name
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    logger.info("[AlibabaScraper] Complete", { total: dedup.length })
    return dedup.slice(0, limit)
  } finally {
    await browser.close()
  }
}
