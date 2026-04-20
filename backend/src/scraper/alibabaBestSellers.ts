/**
 * AliExpress Best Sellers — Playwright + Claude Vision scraper.
 *
 * Same pattern as Banggood: navigate, scroll, screenshot, send to Claude Vision.
 * Vision prompt explicitly asks for sale price vs crossed-out original price.
 * DOM-based extraction returns 0 on Render (datacenter IPs blocked by AliExpress).
 *
 * Data stored in amazon_trending with marketplace = "Alibaba".
 */

import { chromium }       from "playwright"
import { logger }         from "../utils/logger"
import { AmazonProduct }  from "./amazonBestSellers"

const CLAUDE_API = "https://api.anthropic.com/v1/messages"

// ─── AliExpress category search URLs ─────────────────────────────────────────

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

// ─── Claude Vision extraction ─────────────────────────────────────────────────

async function extractWithVision(
  screenshot: Buffer,
  category:   string,
): Promise<AmazonProduct[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    logger.warn("[AlibabaScraper] No ANTHROPIC_API_KEY — skipping Vision extraction")
    return []
  }

  const base64 = screenshot.toString("base64")
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
        max_tokens: 2000,
        messages: [{
          role:    "user",
          content: [
            {
              type:   "image",
              source: { type: "base64", media_type: "image/jpeg", data: base64 },
            },
            {
              type: "text",
              text: `This is an AliExpress search results page (category: ${category}).
Extract the TOP 10 best-selling products clearly visible on screen.
Return ONLY a valid JSON array — no markdown fences, no explanation:
[{"product_name":"...","brand":"...","price":26.49,"original_price":34.99,"rating":4.7,"review_count":4912}]

PRICE RULES (very important):
- AliExpress shows TWO prices on sale items: a SALE price (lower, often in red/orange) and an ORIGINAL price (higher, crossed out with a line through it)
- "price" = the SALE price (the lower number — the one customers actually pay)
- "original_price" = the CROSSED-OUT price (the higher number with a strikethrough line)
- If only ONE price is shown, put it in "price" and set "original_price" to null
- Both must be numbers, not strings

Other rules:
- rating must be 1.0–5.0 or null
- review_count is orders/reviews count (integer) or null
- If the page shows a CAPTCHA, error, or no products, return []`,
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
    const match = raw.match(/\[[\s\S]*?\]/)
    text = match ? match[0] : "[]"
  } catch (err: any) {
    logger.warn("[AlibabaScraper] Claude Vision API error", { category, error: err.message })
    return []
  }

  try {
    const arr = JSON.parse(text)
    if (!Array.isArray(arr)) return []

    return arr.slice(0, 10).map((p: any, idx: number) => {
      const price         = typeof p.price === "number" && p.price > 0 && p.price < 50000 ? p.price : null
      const original_price = typeof p.original_price === "number" && p.original_price > 0 && p.original_price < 50000
        ? p.original_price : null

      return {
        asin:           null,
        product_name:   String(p.product_name ?? "").trim(),
        category,
        rank:           idx + 1,
        price,
        original_price: original_price && price && original_price > price ? original_price : null,
        rating:         typeof p.rating === "number" && p.rating >= 1 && p.rating <= 5 ? p.rating : null,
        review_count:   typeof p.review_count === "number" && p.review_count > 0 ? Math.round(p.review_count) : null,
        image_url:      null,
        product_url:    null,
        badge:          "Best Seller",
        brand:          p.brand ? String(p.brand).trim() || null : null,
        marketplace:    "Alibaba",
      }
    }).filter((p: AmazonProduct) => p.product_name.length >= 3)
  } catch (err: any) {
    logger.warn("[AlibabaScraper] Vision JSON parse failed", { category, raw: text.slice(0, 200), error: err.message })
    return []
  }
}

// ─── Scrape one category page ─────────────────────────────────────────────────

async function scrapeCategoryPage(
  query:    string,
  category: string,
  page:     import("playwright").Page,
): Promise<AmazonProduct[]> {
  const encoded = encodeURIComponent(query)
  const url = `https://www.aliexpress.com/wholesale?SearchText=${encoded}&SortType=total_tranRanking_desc&page=1`

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35_000 })
    await page.waitForTimeout(3000)
  } catch (err: any) {
    logger.warn("[AlibabaScraper] Page load failed", { query, error: err.message })
    return []
  }

  // Scroll to trigger lazy-loaded product cards, then return to top
  try {
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 1200))
      await page.waitForTimeout(700)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(3000)
  } catch { /* ignore */ }

  // Take a JPEG screenshot and send to Claude Vision
  const screenshot = await page.screenshot({ type: "jpeg", quality: 80 })
  const products   = await extractWithVision(screenshot, category)

  logger.info("[AlibabaScraper] Category done", { category, count: products.length })
  return products
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeAlibabaBestSellers(opts: {
  category?: string
  limit?:    number
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 100 } = opts

  const targets = category === "All"
    ? ALIBABA_CATEGORIES
    : ALIBABA_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[AlibabaScraper] No matching category", { category })
    return []
  }

  logger.info("[AlibabaScraper] Starting scrape (Vision mode)", { categories: targets.map(t => t.label) })

  const browser = await chromium.launch({
    headless: true,
    args:     ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })
  const context = await browser.newContext({
    userAgent:        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale:           "en-US",
    viewport:         { width: 1440, height: 900 },
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  })
  // Force global English / USD — prevents Arabic redirect on non-US IPs
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
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 700))
    }
  } finally {
    await browser.close()
  }

  const seen  = new Set<string>()
  const dedup = allProducts.filter(p => {
    const key = p.product_name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  logger.info("[AlibabaScraper] Complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
