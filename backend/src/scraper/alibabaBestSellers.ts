/**
 * AliExpress Best Sellers — Playwright (DOM) + Claude Vision (prices only).
 *
 * Phase 1 — single browser context, single page, sequential categories.
 * This is the stable working version: bot-safe, gets all 8 categories.
 * Prices extracted by position from viewport screenshot (first ~5 visible).
 *
 * Runs via local home-PC server (LOCAL_SCRAPER_URL) — AliExpress blocks Render IPs.
 * Data stored in amazon_trending with marketplace = "Alibaba".
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

const CLAUDE_API = "https://api.anthropic.com/v1/messages"

// ─── AliExpress category search queries ──────────────────────────────────────

const ALIBABA_CATEGORIES: { label: string; query: string }[] = [
  { label: "Electronics",       query: "electronics gadgets" },
  { label: "Phone Accessories", query: "phone case accessories" },
  { label: "Home & Garden",     query: "home decor garden" },
  { label: "Beauty & Health",   query: "beauty skincare health" },
  { label: "Fashion",           query: "clothing fashion women men" },
  { label: "Toys & Games",      query: "toys games kids" },
  { label: "Sports & Outdoor",  query: "sports outdoor fitness" },
  { label: "Computer & Office", query: "computer office accessories" },
]

// ─── Vision: extract prices by position from viewport screenshot ──────────────

async function extractPricesWithVision(
  screenshot: Buffer,
  count:      number,
): Promise<{ price: number | null; original_price: number | null }[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return []

  const base64 = screenshot.toString("base64")

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
        max_tokens: 800,
        messages: [{
          role:    "user",
          content: [
            {
              type:   "image",
              source: { type: "base64", media_type: "image/jpeg", data: base64 },
            },
            {
              type: "text",
              text: `This is an AliExpress search results page. Extract the prices for the first ${count} product cards visible, in order from top-left to bottom-right.

Return ONLY a JSON array with exactly ${count} entries (use null if a product's price is not visible):
[{"price": 3.45, "original_price": 5.99}, {"price": 12.01, "original_price": null}, ...]

Rules:
- "price" = the current sale price (bold, colored — what the customer pays now)
- "original_price" = the old/original price shown near the sale price in any of these forms:
  • crossed-out / strikethrough text
  • smaller gray text below or beside the sale price
  • "Welcome deal" banner: the price shown below the large sale price in smaller gray text
  Set to null if there is no secondary/original price shown
- Both must be numbers (USD), not strings
- original_price must always be higher than price, otherwise set it to null`,
            },
          ],
        }],
      }),
    })

    if (!resp.ok) throw new Error(`Claude API ${resp.status}`)
    const json = await resp.json()
    const raw  = json.content?.[0]?.text?.trim() ?? "[]"
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []

    const arr = JSON.parse(match[0])
    if (!Array.isArray(arr)) return []

    return arr.map((p: any) => {
      const price          = typeof p.price === "number" && p.price > 0 && p.price < 50000 ? p.price : null
      const original_price = typeof p.original_price === "number" && p.original_price > 0 && p.original_price < 50000
        ? p.original_price : null
      return {
        price,
        original_price: original_price && price && original_price > price ? original_price : null,
      }
    })
  } catch (err: any) {
    logger.warn("[AlibabaScraper] Vision price extraction failed", { error: err.message })
    return []
  }
}

// ─── Scrape one category page ─────────────────────────────────────────────────

async function scrapeCategoryPage(
  query:    string,
  category: string,
  page:     import("playwright").Page
): Promise<AmazonProduct[]> {
  const encoded = encodeURIComponent(query)
  const url = `https://www.aliexpress.com/wholesale?SearchText=${encoded}&SortType=total_tranRanking_desc&page=1`

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35_000 })
    await page.waitForTimeout(4000)
  } catch (err: any) {
    logger.warn("[AlibabaScraper] Page load failed", { query, error: err.message })
    return []
  }

  // Check for bot challenge
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) ?? "").catch(() => "")
  if (/captcha|robot|access.denied|verify you|unusual traffic|slide to verify/i.test(bodyText)) {
    logger.warn("[AlibabaScraper] Bot challenge detected — IP flagged, wait 20-30 min", { query })
    return []
  }

  // Scroll to trigger lazy-loaded product cards
  try {
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, 1200))
      await page.waitForTimeout(600)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(2000)
  } catch { /* ignore */ }

  // ── Step 1: DOM extraction (everything except price) ──────────────────────
  const domProducts = await page.evaluate((cat: string) => {
    const results: any[] = []

    let cards: Element[] = Array.from(document.querySelectorAll(
      "a[class*='search-card-item'], [class*='search-item-card-wrapper-gallery'], [data-item-id]"
    ))

    if (cards.length === 0) {
      const seen = new Set<Element>()
      document.querySelectorAll("a[href*='/item/']").forEach(a => {
        const card = a.closest("[class*='card'], [class*='item'], [class*='product'], li") ?? a.parentElement ?? a
        if (!seen.has(card)) { seen.add(card); cards.push(card) }
      })
    }

    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll("li, article"))
        .filter(el => el.querySelector("a[href*='/item/']"))
    }

    cards.slice(0, 24).forEach((el, idx) => {
      const linkEl = (
        el.tagName === "A" && (el as HTMLAnchorElement).href?.includes("/item/")
          ? el
          : el.querySelector("a[href*='/item/']")
      ) as HTMLAnchorElement | null
      const href = linkEl?.href ?? linkEl?.getAttribute("href") ?? ""
      if (!href.includes("/item/")) return
      const product_url = href.startsWith("//") ? `https:${href}` : href
      const productId   = href.match(/\/item\/(\d+)/)?.[1] ?? null

      const titleEl = el.querySelector("h3, h2, [class*='title'], [class*='Title'], [class*='name'], [class*='Name']")
      const product_name = (
        titleEl?.textContent ??
        linkEl?.getAttribute("title") ??
        linkEl?.textContent ??
        ""
      ).trim().replace(/\s+/g, " ")
      if (!product_name || product_name.length < 3) return

      const imgEl     = el.querySelector("img")
      const image_url = imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-src") ?? null

      let review_count: number | null = null
      const tradeEl = el.querySelector("[class*='trade'], [class*='order'], [class*='sold'], [class*='Sale']")
      if (tradeEl) {
        const m = (tradeEl.textContent ?? "").replace(/,/g, "").match(/(\d+)/)
        if (m) review_count = parseInt(m[1], 10)
      }

      const brandEl = el.querySelector("[class*='store'], [class*='shop'], [class*='Store']")
      const brand   = brandEl?.textContent?.trim() || null

      results.push({
        asin:         productId,
        product_name,
        category:     cat,
        rank:         idx + 1,
        image_url:    image_url ? (image_url.startsWith("//") ? `https:${image_url}` : image_url) : null,
        product_url,
        review_count,
        brand,
      })
    })
    return results
  }, category)

  if (domProducts.length === 0) {
    logger.info("[AlibabaScraper] DOM found no products", { category })
    return []
  }

  // ── Step 2: Vision extracts prices from viewport screenshot ──────────────
  const screenshot = await page.screenshot({ type: "jpeg", quality: 80 })
  const prices     = await extractPricesWithVision(screenshot, domProducts.length)

  // ── Step 3: Merge prices into DOM products by position ───────────────────
  const merged: AmazonProduct[] = domProducts.map((p, idx) => ({
    asin:           p.asin,
    product_name:   p.product_name,
    category,
    rank:           idx + 1,
    price:          prices[idx]?.price          ?? null,
    original_price: prices[idx]?.original_price ?? null,
    rating:         null,
    review_count:   p.review_count,
    image_url:      p.image_url,
    product_url:    p.product_url,
    badge:          p.review_count && p.review_count >= 1000 ? "Best Seller" : null,
    brand:          p.brand,
    marketplace:    "Alibaba",
  }))

  logger.info("[AlibabaScraper] Category done", { category, products: merged.length, pricesFound: prices.filter(p => p.price !== null).length })
  return merged
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeAlibabaBestSellers(opts: {
  category?: string
  limit?:    number
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 100 } = opts

  // ── Delegate to local home-PC scraper if URL is configured ──────────────────
  const localUrl = process.env.LOCAL_SCRAPER_URL
  if (localUrl) {
    logger.info("[AlibabaScraper] Delegating to local scraper", { localUrl })
    try {
      const resp = await fetch(
        `${localUrl}/scrape-aliexpress?category=${encodeURIComponent(category)}&limit=${limit}`,
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

  const targets = category === "All"
    ? ALIBABA_CATEGORIES
    : ALIBABA_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[AlibabaScraper] No matching category", { category })
    return []
  }

  logger.info("[AlibabaScraper] Starting scrape", { categories: targets.map(t => t.label) })

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
    { name: "xman_us_f",  value: "x_locale=en_US&acs_rt=", domain: ".aliexpress.com", path: "/" },
  ])
  const page = await context.newPage()

  const allProducts: AmazonProduct[] = []

  try {
    for (const target of targets) {
      const products = await scrapeCategoryPage(target.query, target.label, page)
      allProducts.push(...products)
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 500))
    }
  } finally {
    await browser.close()
  }

  const seen  = new Set<string>()
  const dedup = allProducts.filter(p => {
    const key = p.asin ?? p.product_name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  logger.info("[AlibabaScraper] Complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
