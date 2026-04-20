/**
 * iHerb Best Sellers — Playwright + Claude Vision scraper.
 *
 * Navigates iherb.com category pages, takes a viewport screenshot after
 * lazy-load scrolling, then uses Claude Vision (haiku) to extract up to 10
 * best-selling products per category. Vision is immune to HTML structure
 * changes, per-serving price fragments, and element class renames.
 *
 * Data stored in amazon_trending with marketplace = "iHerb".
 */

import { chromium }       from "playwright"
import { logger }         from "../utils/logger"
import { AmazonProduct }  from "./amazonBestSellers"

const CLAUDE_API = "https://api.anthropic.com/v1/messages"

// ─── iHerb category slugs ─────────────────────────────────────────────────────

const IHERB_CATEGORIES: { label: string; slug: string }[] = [
  { label: "Vitamins",         slug: "vitamins" },
  { label: "Sports Nutrition", slug: "sports-nutrition" },
  { label: "Beauty",           slug: "beauty" },
  { label: "Grocery",          slug: "grocery" },
  { label: "Baby & Kids",      slug: "baby-kids" },
  { label: "Pets",             slug: "pets" },
  { label: "Health",           slug: "health" },
  { label: "Herbs",            slug: "herbs-homeopathy" },
]

// ─── Claude Vision extraction ─────────────────────────────────────────────────

async function extractWithVision(
  screenshot: Buffer,
  category:   string,
): Promise<AmazonProduct[]> {
  const base64 = screenshot.toString("base64")

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    logger.warn("[iHerbScraper] No ANTHROPIC_API_KEY — skipping Vision extraction")
    return []
  }

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
        max_tokens: 1500,
        messages: [{
          role:    "user",
          content: [
            {
              type:   "image",
              source: { type: "base64", media_type: "image/jpeg", data: base64 },
            },
            {
              type: "text",
              text: `This is a screenshot of an iHerb best-sellers category page (${category}).
Extract the TOP 10 best-selling products clearly visible on screen.
Return ONLY a valid JSON array — no markdown fences, no explanation:
[{"product_name":"...","brand":"...","price":14.95,"rating":4.7,"review_count":12500}]

Rules:
- Only include products with a clearly visible USD price (e.g. $14.95)
- price must be a number, not a string
- rating must be 1.0–5.0 or null
- review_count is the integer number of reviews or null
- If the page shows a CAPTCHA, error message, or no products, return []`,
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
    const raw = json.content?.[0]?.text?.trim() ?? "[]"
    // Extract the first JSON array from the response — Claude sometimes appends
    // markdown fences or explanatory text after the array (e.g. "[]\n```\nThe page...")
    const match = raw.match(/\[[\s\S]*?\]/)
    text = match ? match[0] : "[]"
  } catch (err: any) {
    logger.warn("[iHerbScraper] Claude Vision API error", { category, error: err.message })
    return []
  }

  try {
    const arr = JSON.parse(text)
    if (!Array.isArray(arr)) return []

    return arr.slice(0, 10).map((p: any, idx: number) => ({
      asin:         null,
      product_name: String(p.product_name ?? "").trim(),
      category,
      rank:         idx + 1,
      price:        typeof p.price === "number" && p.price > 0 && p.price < 5000 ? p.price : null,
      rating:       typeof p.rating === "number" && p.rating >= 1 && p.rating <= 5 ? p.rating : null,
      review_count: typeof p.review_count === "number" && p.review_count > 0 ? Math.round(p.review_count) : null,
      original_price: null,
      image_url:    null,
      product_url:  null,
      badge:        "Best Seller",
      brand:        p.brand ? String(p.brand).trim() || null : null,
      marketplace:  "iHerb",
    })).filter(p => p.product_name.length >= 3)
  } catch (err: any) {
    logger.warn("[iHerbScraper] Vision JSON parse failed", { category, raw: text.slice(0, 200), error: err.message })
    return []
  }
}

// ─── Scrape one category page ─────────────────────────────────────────────────

async function scrapeCategoryPage(
  slug:     string,
  category: string,
  page:     import("playwright").Page,
): Promise<AmazonProduct[]> {
  // psize=10 requests only 10 products → smaller page, faster load
  const url = `https://www.iherb.com/c/${slug}?sort=top-sellers&psize=10`

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })
    await page.waitForTimeout(2000)

    // Scroll to trigger lazy-loaded product cards, then return to top
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 900))
      await page.waitForTimeout(500)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1500)
  } catch (err: any) {
    logger.warn("[iHerbScraper] Page load failed", { url, error: err.message })
    return []
  }

  // Take a JPEG viewport screenshot (1280×1400 set on context) and send to Claude
  const screenshot = await page.screenshot({ type: "jpeg", quality: 80 })
  const products   = await extractWithVision(screenshot, category)

  logger.info("[iHerbScraper] Category done", { category, count: products.length })
  return products
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeIherbBestSellers(opts: {
  category?: string
  limit?:    number
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 80 } = opts

  const targets = category === "All"
    ? IHERB_CATEGORIES
    : IHERB_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[iHerbScraper] No matching category", { category })
    return []
  }

  logger.info("[iHerbScraper] Starting scrape (Vision mode)", { categories: targets.map(t => t.label) })

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  })

  const allProducts: AmazonProduct[] = []

  try {
    for (const target of targets) {
      // Fresh context per category — avoids carrying a Cloudflare-flagged session
      // from one category into the next (which gave 0 for all with single context).
      const context = await browser.newContext({
        userAgent:        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        locale:           "en-US",
        viewport:         { width: 1280, height: 1400 },
        extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
      })
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined })
      })
      const page = await context.newPage()
      try {
        const products = await scrapeCategoryPage(target.slug, target.label, page)
        allProducts.push(...products)
      } finally {
        await context.close()
      }
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 800))
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

  logger.info("[iHerbScraper] Complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
