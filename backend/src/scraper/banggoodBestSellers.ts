/**
 * Banggood Best Sellers — Playwright + Claude Vision scraper.
 *
 * Navigates Banggood category pages, scrolls to load products and trigger
 * flash-sale price JS updates, then takes a viewport screenshot and sends
 * it to Claude Vision (haiku) for extraction. Vision reads the final
 * displayed price — always the flash/sale price after JS settles.
 *
 * Data stored in amazon_trending with marketplace = "Banggood".
 */

import { chromium }       from "playwright"
import { logger }         from "../utils/logger"
import { AmazonProduct }  from "./amazonBestSellers"

const CLAUDE_API = "https://api.anthropic.com/v1/messages"

// ─── Banggood category pages ──────────────────────────────────────────────────
// pageSize=10 — request only 10 products per page (faster load, cleaner viewport)

const BANGGOOD_CATEGORIES: { label: string; url: string }[] = [
  { label: "Electronics",       url: "https://www.banggood.com/promotion-hot100.html" },
  { label: "Phone & Gadgets",   url: "https://www.banggood.com/Cellphones--Telecommunications-ons-1543.html?sortType=p_sales_14d&pageSize=10" },
  { label: "Computers",         url: "https://www.banggood.com/Computer--Office-ons-102.html?sortType=p_sales_14d&pageSize=10" },
  { label: "Home & Garden",     url: "https://www.banggood.com/Home-Garden-ons-5261.html?sortType=p_sales_14d&pageSize=10" },
  { label: "Sports & Outdoors", url: "https://www.banggood.com/Sports--Outdoor-ons-182.html?sortType=p_sales_14d&pageSize=10" },
  { label: "Toys & Hobbies",    url: "https://www.banggood.com/Toys--Hobbies-ons-107.html?sortType=p_sales_14d&pageSize=10" },
  { label: "Beauty & Health",   url: "https://www.banggood.com/Beauty--Health-ons-6267.html?sortType=p_sales_14d&pageSize=10" },
]

// ─── Claude Vision extraction ─────────────────────────────────────────────────

async function extractWithVision(
  screenshot: Buffer,
  category:   string,
): Promise<AmazonProduct[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    logger.warn("[BanggoodScraper] No ANTHROPIC_API_KEY — skipping Vision extraction")
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
              text: `This is a Banggood best-sellers category page (${category}).
Extract the TOP 10 best-selling products clearly visible on screen.
Return ONLY a valid JSON array — no markdown fences, no explanation:
[{"product_name":"...","brand":"...","price":26.49,"rating":4.7,"review_count":491}]

Rules:
- When TWO prices are shown (e.g. flash sale: $26.49, original: $30.49), use the LOWER price
- price must be a number, not a string
- rating must be 1.0–5.0 or null
- review_count is the number of reviews/orders (integer) or null
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
    const raw  = json.content?.[0]?.text?.trim() ?? "[]"
    // Extract the first JSON array from the response (Claude may append explanations)
    const match = raw.match(/\[[\s\S]*?\]/)
    text = match ? match[0] : "[]"
  } catch (err: any) {
    logger.warn("[BanggoodScraper] Claude Vision API error", { category, error: err.message })
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
      price:        typeof p.price === "number" && p.price > 0 && p.price < 50000 ? p.price : null,
      rating:       typeof p.rating === "number" && p.rating >= 1 && p.rating <= 5 ? p.rating : null,
      review_count: typeof p.review_count === "number" && p.review_count > 0 ? Math.round(p.review_count) : null,
      original_price: null,
      image_url:    null,
      product_url:  null,
      badge:        "Best Seller",
      brand:        p.brand ? String(p.brand).trim() || null : null,
      marketplace:  "Banggood",
    })).filter(p => p.product_name.length >= 3)
  } catch (err: any) {
    logger.warn("[BanggoodScraper] Vision JSON parse failed", { category, raw: text.slice(0, 200), error: err.message })
    return []
  }
}

// ─── Scrape one Banggood page ────────────────────────────────────────────────

async function scrapeCategoryPage(
  url:      string,
  category: string,
  page:     import("playwright").Page,
): Promise<AmazonProduct[]> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35_000 })
    await page.waitForTimeout(3000)
  } catch (err: any) {
    logger.warn("[BanggoodScraper] Page load failed", { url, error: err.message })
    return []
  }

  const pageTitle = await page.title().catch(() => "")
  if (/captcha|robot|access.denied|verify/i.test(pageTitle)) {
    logger.warn("[BanggoodScraper] Bot challenge", { category })
    return []
  }

  // Scroll to trigger lazy-loaded product cards, then return to top
  try {
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, 1200))
      await page.waitForTimeout(700)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    // 5s wait: flash sale JS on Banggood fires ~1s after page load — this ensures
    // all prices have updated before we take the screenshot
    await page.waitForTimeout(5000)
  } catch { /* ignore */ }

  // Take a JPEG viewport screenshot and send to Claude Vision
  const screenshot = await page.screenshot({ type: "jpeg", quality: 80 })
  const products   = await extractWithVision(screenshot, category)

  logger.info("[BanggoodScraper] Category done", { category, count: products.length })
  return products
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeBanggoodBestSellers(opts: {
  category?: string
  limit?:    number
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 70 } = opts

  const targets = category === "All"
    ? BANGGOOD_CATEGORIES
    : BANGGOOD_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[BanggoodScraper] No matching category", { category })
    return []
  }

  logger.info("[BanggoodScraper] Starting scrape (Vision mode)", { categories: targets.map(t => t.label) })

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
  const page = await context.newPage()

  const allProducts: AmazonProduct[] = []

  try {
    for (const target of targets) {
      const products = await scrapeCategoryPage(target.url, target.label, page)
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

  logger.info("[BanggoodScraper] Complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
