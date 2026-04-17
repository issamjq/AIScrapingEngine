/**
 * Shein Best Sellers — Playwright scraper.
 *
 * Scrapes us.shein.com best-seller category pages.
 * Shein embeds product data in window.gbRawData / window.SHEIN_KEY_CONFIG;
 * falls back to DOM extraction.
 * Data stored in amazon_trending with marketplace = "Shein".
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

// ─── Shein category pages ─────────────────────────────────────────────────────

const SHEIN_CATEGORIES: { label: string; url: string }[] = [
  { label: "Women",          url: "https://us.shein.com/Best-Sellers-sc-00199582.html" },
  { label: "Men",            url: "https://us.shein.com/Best-Sellers-Men-sc-00253280.html" },
  { label: "Shoes",          url: "https://us.shein.com/Best-Sellers-sc-00168282.html" },
  { label: "Bags",           url: "https://us.shein.com/Best-Sellers-Bags-sc-00213808.html" },
  { label: "Beauty",         url: "https://us.shein.com/Best-Sellers-Health-Beauty-sc-00215080.html" },
  { label: "Home & Living",  url: "https://us.shein.com/Best-Sellers-Home-Living-sc-00291201.html" },
]

// ─── Scrape one Shein category page ──────────────────────────────────────────

async function scrapeCategoryPage(
  url:      string,
  category: string,
  page:     import("playwright").Page
): Promise<AmazonProduct[]> {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 40_000 })
    await page.waitForTimeout(2500)
  } catch (err: any) {
    logger.warn("[SheinScraper] Page load failed", { url, error: err.message })
    return []
  }

  // Scroll to trigger lazy-loaded images
  try {
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 900))
      await page.waitForTimeout(600)
    }
  } catch { /* ignore */ }

  const pageTitle = await page.title().catch(() => "")
  if (/access.denied|captcha|robot|blocked/i.test(pageTitle)) {
    logger.warn("[SheinScraper] Bot challenge", { category })
    return []
  }

  // DOM extraction — Shein renders product cards with consistent class patterns
  const products = await page.evaluate((cat: string) => {
    const results: any[] = []

    // Collect all product card containers
    let cards: Element[] = Array.from(document.querySelectorAll(
      ".S-product-item__main, [class*='product-card'], [class*='goods-item'], [class*='ProductCard']"
    ))

    // Fallback: any anchor linking to a goods detail page
    if (cards.length === 0) {
      const links = Array.from(document.querySelectorAll("a[href*='/p/'], a[href*='goods_id='], a[href*='-p-']"))
      cards = links
        .map(a => a.closest("li, div[class]") ?? a.parentElement ?? a)
        .filter((el, i, arr) => arr.indexOf(el) === i)
    }

    cards.slice(0, 48).forEach((el, idx) => {
      // URL + product ID
      const linkEl = (
        el.querySelector("a[href*='/p/']")          ??
        el.querySelector("a[href*='-p-']")           ??
        el.querySelector("a[href*='goods_id']")      ??
        el.querySelector("a[href]")
      ) as HTMLAnchorElement | null

      const href = linkEl?.getAttribute("href") ?? ""
      const product_url = href.startsWith("http") ? href
        : href.startsWith("//") ? `https:${href}`
        : href ? `https://us.shein.com${href}` : null

      const productId = (
        href.match(/goods_id=(\d+)/)?.[1] ??
        href.match(/\/p\/[^-]+-p-(\d+)/)?.[1] ??
        href.match(/-(\d+)\.html/)?.[1] ??
        null
      )

      // Title
      const titleEl =
        el.querySelector("[class*='goods-title'], [class*='product-name'], [class*='title']") ??
        el.querySelector("h3, h4, [class*='name']")
      const product_name = titleEl?.textContent?.trim() ?? linkEl?.getAttribute("aria-label")?.trim() ?? ""
      if (!product_name || product_name.length < 3) return

      // Price
      let price: number | null = null
      for (const pe of Array.from(el.querySelectorAll("[class*='price'], [class*='Price']"))) {
        const raw = pe.textContent?.replace(/[^\d.]/g, "") ?? ""
        const n   = parseFloat(raw)
        if (isFinite(n) && n > 0 && n < 10000) { price = n; break }
      }

      // Image
      const imgEl = el.querySelector("img")
      const image_url =
        imgEl?.getAttribute("src")         ??
        imgEl?.getAttribute("data-src")    ??
        imgEl?.getAttribute("data-origin") ??
        null

      // Review count (Shein shows ratings as "4.5 (1.2k)")
      let review_count: number | null = null
      const revEl = el.querySelector("[class*='review'], [class*='rating'], [class*='eval']")
      if (revEl) {
        const t = revEl.textContent ?? ""
        const m = t.match(/(\d[\d.,]*)\s*[kK]/)
        if (m) {
          review_count = Math.round(parseFloat(m[1].replace(",", "")) * 1000)
        } else {
          const m2 = t.match(/(\d+)/)
          if (m2) review_count = parseInt(m2[1], 10)
        }
      }

      // Rating
      let rating: number | null = null
      const ratingEl = el.querySelector("[class*='star'], [class*='rate']")
      if (ratingEl) {
        const m = (ratingEl.textContent ?? "").match(/(\d+\.?\d*)/)
        if (m) { const v = parseFloat(m[1]); if (v > 0 && v <= 5) rating = v }
      }

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
        badge:        "Best Seller",
        brand:        null,
        marketplace:  "Shein",
      })
    })

    return results
  }, category)

  logger.info("[SheinScraper] Category done", { category, count: products.length })
  return products
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeSheinBestSellers(opts: {
  category?: string
  limit?:    number
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 100 } = opts

  const targets = category === "All"
    ? SHEIN_CATEGORIES
    : SHEIN_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[SheinScraper] No matching category", { category })
    return []
  }

  logger.info("[SheinScraper] Starting scrape", { categories: targets.map(t => t.label) })

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale:    "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  })
  const page = await context.newPage()

  const allProducts: AmazonProduct[] = []

  try {
    for (const target of targets) {
      const products = await scrapeCategoryPage(target.url, target.label, page)
      allProducts.push(...products)
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 600))
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

  logger.info("[SheinScraper] Complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
