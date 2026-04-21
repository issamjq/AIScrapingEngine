/**
 * AliExpress Super Deals — Playwright + Claude Vision hybrid scraper.
 *
 * Page: https://www.aliexpress.com/ssr/300002660/Deals-HomePage (SSR — works for all IPs)
 *
 * Strategy:
 *   DOM   → product URLs, ASINs, image URLs (reliable, class-agnostic)
 *   Vision → product names, prices, original prices, ratings (accurate, reads what humans see)
 *
 * Merge by position index: DOM card[0] + Vision product[0], etc.
 *
 * Why Vision for prices:
 *   - DOM price selectors break when AliExpress changes CSS class names
 *   - Min/max decimal guessing picks ratings or sold counts by mistake
 *   - Claude reads the price exactly as displayed — handles any currency or layout
 *   - Also ignores "Welcome deal" $0.99 promo prices (told to skip them)
 *
 * Data stored in amazon_trending with marketplace = "Alibaba".
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

const SUPER_DEALS_URL = "https://www.aliexpress.com/ssr/300002660/Deals-HomePage?disableNav=YES&pha_manifest=ssr&_immersiveMode=true"
const CLAUDE_API      = "https://api.anthropic.com/v1/messages"

// ─── Claude Vision price extraction ──────────────────────────────────────────

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

  // Build content blocks: one image block per screenshot + one text instruction
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

// ─── Scrape the SSR deals page ────────────────────────────────────────────────

async function scrapeDealsPage(
  page: import("playwright").Page
): Promise<AmazonProduct[]> {
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
  logger.info("[AlibabaScraper] Page loaded", { title: pageTitle, url: page.url().slice(0, 80) })

  // ── DOM: extract URLs, images, ASINs (reliable — no price guessing) ────────
  const domCards = await page.evaluate(() => {
    const results: any[] = []

    let cards: Element[] = Array.from(document.querySelectorAll(
      "a[class*='search-card-item'], [class*='search-item-card-wrapper-gallery'], [data-item-id]"
    ))

    if (cards.length === 0) {
      const seen = new Set<Element>()
      document.querySelectorAll("a[href*='/item/']").forEach(a => {
        const card = a.closest("[class*='card'], [class*='item'], [class*='product'], [class*='deal'], li") ?? a.parentElement ?? a
        if (!seen.has(card)) { seen.add(card); cards.push(card) }
      })
    }

    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll("li, article, div"))
        .filter(el => el.querySelector("a[href*='/item/']") && el.querySelector("img"))
    }

    cards.slice(0, 40).forEach(el => {
      const linkEl = (
        el.tagName === "A" && (el as HTMLAnchorElement).href?.includes("/item/")
          ? el : el.querySelector("a[href*='/item/']")
      ) as HTMLAnchorElement | null

      const href = linkEl?.href ?? linkEl?.getAttribute("href") ?? ""
      if (!href.includes("/item/")) return

      const product_url = href.startsWith("//") ? `https:${href}` : href
      const asin        = href.match(/\/item\/(\d+)/)?.[1] ?? null
      const imgEl       = el.querySelector("img")
      const image_url   = imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-src") ?? null
      const brandEl     = el.querySelector("[class*='store'], [class*='shop'], [class*='Store']")
      const brand       = brandEl?.textContent?.trim() || null

      results.push({
        asin,
        product_url,
        image_url: image_url ? (image_url.startsWith("//") ? `https:${image_url}` : image_url) : null,
        brand,
      })
    })

    return results
  })

  if (domCards.length === 0) {
    logger.info("[AlibabaScraper] DOM found 0 cards")
    return []
  }

  logger.info("[AlibabaScraper] DOM cards found", { count: domCards.length })

  // ── Vision: scroll through Recommended section, take 3 viewport screenshots ─
  // Today's deals = horizontal carousel (only 6 products, arrow not clickable).
  // Recommended section below = grid layout with 12 products per viewport.
  // 3 screenshots × 12 products = ~30 products sent to Claude in one API call.
  const screenshots: Buffer[] = []

  // Scroll past carousel + category tabs into the Recommended product grid
  // 5 screenshots × ~10 products each = ~50 products sent to Claude in one call
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

  const visionResult = await extractWithVision(screenshots)

  logger.info("[AlibabaScraper] Vision extracted", { count: visionResult.length })

  // ── Vision results are from Recommended section (scrolled), DOM cards from
  // the initial page load. Index alignment is unreliable — use Vision as primary
  // source and assign DOM cards by index for URL/image where available.
  const products: AmazonProduct[] = []

  visionResult.forEach((vis, i) => {
    if (!vis.product_name || vis.product_name.length < 3) return
    const dom = domCards[i] ?? null
    products.push({
      asin:           dom?.asin ?? null,
      product_name:   vis.product_name,
      category:       "Super Deals",
      rank:           i + 1,
      price:          vis.price,
      original_price: vis.original_price,
      rating:         vis.rating,
      review_count:   vis.review_count,
      image_url:      dom?.image_url ?? null,
      product_url:    dom?.product_url ?? null,
      badge:          "Best Seller",
      brand:          dom?.brand ?? null,
      marketplace:    "Alibaba",
    })
  })

  const pricesFound = products.filter(p => p.price !== null).length
  logger.info("[AlibabaScraper] Merge done", { total: products.length, pricesFound })

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

  logger.info("[AlibabaScraper] Starting Vision scrape")

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
