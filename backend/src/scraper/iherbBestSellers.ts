/**
 * iHerb Best Sellers — Playwright scraper.
 *
 * Scrapes iherb.com category pages sorted by top-sellers.
 * Data stored in amazon_trending with marketplace = "iHerb".
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

// ─── iHerb category slugs ─────────────────────────────────────────────────────

const IHERB_CATEGORIES: { label: string; slug: string }[] = [
  { label: "Vitamins",         slug: "vitamins" },
  { label: "Sports Nutrition", slug: "sports" },
  { label: "Beauty",           slug: "beauty" },
  { label: "Grocery",          slug: "grocery" },
  { label: "Baby & Kids",      slug: "baby-kids" },
  { label: "Pets",             slug: "pets" },
  { label: "Health",           slug: "health" },
  { label: "Herbs",            slug: "herbs-homeopathy" },
]

// ─── Scrape one category page ─────────────────────────────────────────────────

async function scrapeCategoryPage(
  slug:     string,
  category: string,
  page:     import("playwright").Page
): Promise<AmazonProduct[]> {
  const url = `https://www.iherb.com/c/${slug}?sort=top-sellers&psize=48`

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })
    // Wait for product links to appear — iHerb lazy-renders cards via JS
    await page.waitForSelector("a[href*='/pr/']", { timeout: 10_000 }).catch(() => {})
    await page.waitForTimeout(5000)
  } catch (err: any) {
    logger.warn("[iHerbScraper] Page load failed", { url, error: err.message })
    return []
  }

  const products = await page.evaluate((cat: string) => {
    const results: any[] = []

    // Build containers from product links — works across www.iherb.com and lb.iherb.com
    // Filter: product URLs end with a numeric ID (not review anchors)
    const productLinks = Array.from(document.querySelectorAll("a[href*='/pr/']"))
      .filter(a => /\/\d+(?:[?#]|$)/.test((a as HTMLAnchorElement).getAttribute("href") ?? ""))

    const containers = productLinks
      .map(a => a.closest(".product-cell-container, li[class], [data-product-id]") ?? a.parentElement?.parentElement ?? a.parentElement ?? a)
      .filter((el, i, arr) => arr.indexOf(el) === i) // dedup

    containers.slice(0, 50).forEach((el, idx) => {
      const anchor = (
        el.tagName === "A" ? el : el.querySelector("a[href*='/pr/']")
      ) as HTMLAnchorElement | null
      const href = anchor?.getAttribute("href") ?? ""
      if (!href.includes("/pr/")) return

      const productId = href.match(/\/(\d+)(?:[?#]|$)/)?.[1] ?? null
      const product_url = href.startsWith("http") ? href : `https://www.iherb.com${href}`

      // Product name
      const nameEl =
        el.querySelector(".product-title")          ??
        el.querySelector("[class*='product-title']") ??
        el.querySelector("h2, h3, h4")              ??
        anchor
      const product_name = nameEl?.textContent?.trim() ?? ""
      if (!product_name || product_name.length < 3) return

      // Brand
      const brandEl =
        el.querySelector(".product-brand-section a") ??
        el.querySelector("[class*='brand'] a")       ??
        el.querySelector("[class*='brand']")
      const brand = brandEl?.textContent?.trim().replace(/^by\s+/i, "") || null

      // Price — use specific iHerb price classes to avoid bundle/promo prices
      let price: number | null = null
      const priceEl =
        el.querySelector(".product-price.text-nowrap") ??
        el.querySelector(".product-price-top")         ??
        el.querySelector("span.price")                 ??
        el.querySelector("[class*='product-price']")
      if (priceEl) {
        const raw = priceEl.textContent?.replace(/[^\d.]/g, "") ?? ""
        const n   = parseFloat(raw)
        if (isFinite(n) && n > 0 && n < 5000) price = n
      }

      // Rating (1–5)
      let rating: number | null = null
      const ratingEl =
        el.querySelector(".rating")              ??
        el.querySelector("[itemprop='ratingValue']") ??
        el.querySelector("[class*='rating']")
      if (ratingEl) {
        const raw = ratingEl.getAttribute("content") ?? ratingEl.textContent ?? ""
        const m   = raw.match(/(\d[\d.]*)/)
        if (m) {
          const r = parseFloat(m[1])
          if (r >= 1 && r <= 5) rating = r
        }
      }

      // Review count
      let review_count: number | null = null
      const reviewEl =
        el.querySelector(".rating-count")            ??
        el.querySelector("[class*='rating-count']")   ??
        el.querySelector("[itemprop='ratingCount']")
      if (reviewEl) {
        const raw = reviewEl.textContent?.replace(/[^\d]/g, "") ?? ""
        const n   = parseInt(raw, 10)
        if (!isNaN(n) && n > 0) review_count = n
      }

      // Image
      const imgEl = el.querySelector("img")
      const image_url =
        imgEl?.getAttribute("src")               ??
        imgEl?.getAttribute("data-src")          ??
        imgEl?.getAttribute("data-original-src") ??
        null

      results.push({
        asin:         productId,
        product_name,
        category:     cat,
        rank:         idx + 1,
        price,
        rating,
        review_count,
        image_url,
        product_url,
        badge:        "Best Seller",
        brand,
      })
    })

    return results
  }, category)

  logger.info("[iHerbScraper] Category done", { category, count: products.length })
  return products.map(p => ({ ...p, marketplace: "iHerb" }))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeIherbBestSellers(opts: {
  category?: string
  limit?:    number
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 100 } = opts

  const targets = category === "All"
    ? IHERB_CATEGORIES
    : IHERB_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[iHerbScraper] No matching category", { category })
    return []
  }

  logger.info("[iHerbScraper] Starting scrape", { categories: targets.map(t => t.label) })

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })
  const context = await browser.newContext({
    userAgent:        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale:           "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  })
  const page = await context.newPage()

  const allProducts: AmazonProduct[] = []

  try {
    for (const target of targets) {
      const products = await scrapeCategoryPage(target.slug, target.label, page)
      allProducts.push(...products)
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 600))
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

  logger.info("[iHerbScraper] Complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
