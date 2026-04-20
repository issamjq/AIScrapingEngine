/**
 * AliExpress Best Sellers — Pure Playwright DOM scraper (no Vision).
 *
 * Prices extracted directly from the HTML inside each product card:
 *   Sale price     → element with class containing "--current--"
 *   Original price → element with class containing "--del--"
 *
 * These CSS module patterns survive AliExpress redesigns even when the
 * hash suffix changes (e.g. "--current--F8OlYIo" → "--current--X9kPmNz").
 *
 * Runs via local home-PC server (LOCAL_SCRAPER_URL) — AliExpress blocks Render IPs.
 * Data stored in amazon_trending with marketplace = "Alibaba".
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

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

  // ── DOM extraction — everything including prices ───────────────────────────
  const domProducts = await page.evaluate((cat: string) => {
    const results: any[] = []

    // Find product cards — try multiple strategies
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
      // ── Link + product ID ──
      const linkEl = (
        el.tagName === "A" && (el as HTMLAnchorElement).href?.includes("/item/")
          ? el
          : el.querySelector("a[href*='/item/']")
      ) as HTMLAnchorElement | null
      const href = linkEl?.href ?? linkEl?.getAttribute("href") ?? ""
      if (!href.includes("/item/")) return
      const product_url = href.startsWith("//") ? `https:${href}` : href
      const productId   = href.match(/\/item\/(\d+)/)?.[1] ?? null

      // ── Title ──
      const titleEl = el.querySelector("h3, h2, [class*='title'], [class*='Title'], [class*='name'], [class*='Name']")
      const product_name = (
        titleEl?.textContent ??
        linkEl?.getAttribute("title") ??
        linkEl?.textContent ??
        ""
      ).trim().replace(/\s+/g, " ")
      if (!product_name || product_name.length < 3) return

      // ── Image ──
      const imgEl     = el.querySelector("img")
      const image_url = imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-src") ?? null

      // ── Reviews / sold count ──
      let review_count: number | null = null
      const tradeEl = el.querySelector("[class*='trade'], [class*='order'], [class*='sold'], [class*='Sale']")
      if (tradeEl) {
        const m = (tradeEl.textContent ?? "").replace(/,/g, "").match(/(\d+)/)
        if (m) review_count = parseInt(m[1], 10)
      }

      // ── Brand / store ──
      const brandEl = el.querySelector("[class*='store'], [class*='shop'], [class*='Store']")
      const brand   = brandEl?.textContent?.trim() || null

      // ── Prices — CSS module pattern (hash changes but prefix is stable) ──
      //   Sale price     → class contains "--current--"
      //   Original price → class contains "--del--"
      const currentEl  = el.querySelector("[class*='--current--']")
      const delEl      = el.querySelector("[class*='--del--']")

      const currentText = currentEl?.textContent?.trim() ?? ""
      const delText     = delEl?.textContent?.trim() ?? ""
      const currentMatch = currentText.replace(/,/g, "").match(/\d+\.?\d*/)
      const delMatch     = delText.replace(/,/g, "").match(/\d+\.?\d*/)
      const price              = currentMatch ? (parseFloat(currentMatch[0]) > 0 && parseFloat(currentMatch[0]) < 50000 ? parseFloat(currentMatch[0]) : null) : null
      const original_price_val = delMatch     ? (parseFloat(delMatch[0])     > 0 && parseFloat(delMatch[0])     < 50000 ? parseFloat(delMatch[0])     : null) : null
      const original_price     = original_price_val && price && original_price_val > price ? original_price_val : null

      results.push({
        asin:          productId,
        product_name,
        category:      cat,
        rank:          idx + 1,
        image_url:     image_url ? (image_url.startsWith("//") ? `https:${image_url}` : image_url) : null,
        product_url,
        review_count,
        brand,
        price,
        original_price,
      })
    })
    return results
  }, category)

  if (domProducts.length === 0) {
    logger.info("[AlibabaScraper] DOM found no products", { category })
    return []
  }

  // Debug: if no prices found, log the actual class names of price-like elements in the first card
  const pricesFound = domProducts.filter((p: any) => p.price !== null).length
  if (pricesFound === 0) {
    const priceDebug = await page.evaluate(() => {
      const card = document.querySelector("a[href*='/item/']")?.closest("[class*='card'], [class*='item'], li") ?? document.querySelector("a[href*='/item/']")?.parentElement
      if (!card) return "no card found"
      // Find all elements that contain a dollar sign or price-like text
      const priceEls = Array.from(card.querySelectorAll("*")).filter(el =>
        /\$[\d]|US \$|\d+\.\d{2}/.test(el.textContent ?? "") && !el.children.length
      )
      return priceEls.map(el => ({ class: el.className, text: el.textContent?.trim().slice(0, 30) })).slice(0, 5)
    }).catch(() => "eval error")
    logger.info("[AlibabaScraper] Price element debug", { category, priceEls: priceDebug })
  }

  logger.info("[AlibabaScraper] Category done", { category, products: domProducts.length, pricesFound })

  return domProducts.map((p: any) => ({
    asin:           p.asin,
    product_name:   p.product_name,
    category,
    rank:           p.rank,
    price:          p.price,
    original_price: p.original_price,
    rating:         null,
    review_count:   p.review_count,
    image_url:      p.image_url,
    product_url:    p.product_url,
    badge:          p.review_count && p.review_count >= 1000 ? "Best Seller" : null,
    brand:          p.brand,
    marketplace:    "Alibaba",
  }))
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

  logger.info("[AlibabaScraper] Starting DOM scrape", { categories: targets.map(t => t.label) })

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
