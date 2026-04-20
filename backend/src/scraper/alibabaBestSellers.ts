/**
 * AliExpress Best Sellers — Playwright + DOM scraper.
 *
 * Scrapes aliexpress.com search pages sorted by total orders.
 * Price extraction uses leaf-node Math.min() — picks the sale/flash price
 * (lower number) and ignores the crossed-out original price (higher number).
 * window.runParams is intentionally skipped — it returned wrong price variants.
 *
 * Data stored in amazon_trending with marketplace = "Alibaba".
 */

import { chromium }       from "playwright"
import { logger }         from "../utils/logger"
import { AmazonProduct }  from "./amazonBestSellers"

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

  // Check for bot challenge
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) ?? "").catch(() => "")
  if (/captcha|robot|access.denied|verify you/i.test(bodyText)) {
    logger.warn("[AlibabaScraper] Bot challenge detected", { query })
    return []
  }

  // Scroll to trigger lazy-loaded product cards
  try {
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000))
      await page.waitForTimeout(600)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(2000)
  } catch { /* ignore */ }

  const products = await page.evaluate((cat: string) => {
    const results: any[] = []

    // AliExpress search card selector
    let cards: Element[] = Array.from(document.querySelectorAll(
      "a[class*='search-card-item'], [class*='search-item-card-wrapper-gallery'], [data-item-id]"
    ))

    // Fallback: any link to an item page → walk up to card container
    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll("a[href*='/item/']"))
        .map(a => a.closest("li, [class*='card'], [class*='item']") ?? a.parentElement ?? a)
        .filter((el, i, arr) => arr.indexOf(el) === i)
    }

    cards.slice(0, 48).forEach((el, idx) => {
      // Link
      const linkEl = (
        el.tagName === "A" ? el : el.querySelector("a[href*='/item/']")
      ) as HTMLAnchorElement | null
      const href = linkEl?.href ?? linkEl?.getAttribute("href") ?? ""
      if (!href.includes("/item/")) return
      const product_url = href.startsWith("//") ? `https:${href}` : href
      const productId   = href.match(/\/item\/(\d+)/)?.[1] ?? null

      // Title
      const titleEl    = el.querySelector("h3, h2, [class*='title'], [class*='Title'], [class*='name']")
      const product_name = (titleEl?.textContent ?? linkEl?.getAttribute("title") ?? "").trim()
      if (!product_name || product_name.length < 3) return

      // Price — leaf-node scan, collect all $X.XX values, take MINIMUM.
      // The sale/flash price is always lower than the crossed-out original price,
      // so Math.min() naturally picks the correct current price.
      const leafPrices: number[] = []
      for (const node of Array.from(el.querySelectorAll("*"))) {
        if (node.children.length > 0) continue
        const t = (node.textContent ?? "").trim()
        if (!/^\$[\d,]+\.?\d{0,2}$|^US\$[\d,]+/.test(t)) continue
        const n = parseFloat(t.replace(/[^\d.]/g, ""))
        if (isFinite(n) && n > 0.01 && n < 50000) leafPrices.push(n)
      }
      const price: number | null = leafPrices.length > 0 ? Math.min(...leafPrices) : null

      // Image
      const imgEl     = el.querySelector("img")
      const image_url = imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-src") ?? null

      // Orders/sold count
      let review_count: number | null = null
      const tradeEl = el.querySelector("[class*='trade'], [class*='order'], [class*='sold']")
      if (tradeEl) {
        const m = (tradeEl.textContent ?? "").replace(/,/g, "").match(/(\d+)/)
        if (m) review_count = parseInt(m[1], 10)
      }

      // Rating
      let rating: number | null = null
      const ratingEl = el.querySelector("[class*='rating'], [class*='star'], [class*='Rate']")
      if (ratingEl) {
        const m = (ratingEl.textContent ?? "").match(/(\d[\d.]*)/)
        if (m) { const v = parseFloat(m[1]); if (v >= 1 && v <= 5) rating = v }
      }

      const brandEl = el.querySelector("[class*='store'], [class*='shop']")
      const brand   = brandEl?.textContent?.trim() || null

      results.push({
        asin:         productId,
        product_name,
        category:     cat,
        rank:         idx + 1,
        price,
        rating,
        review_count,
        image_url:    image_url ? (image_url.startsWith("//") ? `https:${image_url}` : image_url) : null,
        product_url,
        badge:        review_count && review_count >= 1000 ? "Best Seller" : null,
        brand,
        marketplace:  "Alibaba",
      })
    })

    return results
  }, category)

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
