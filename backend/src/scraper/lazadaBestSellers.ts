/**
 * Lazada Best Sellers — Playwright scraper.
 *
 * Scrapes lazada.sg category pages sorted by popularity.
 * Lazada embeds product data in window.__STORE__ / window.pageData;
 * falls back to DOM extraction.
 * Data stored in amazon_trending with marketplace = "Lazada".
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

// ─── Lazada category pages (Singapore) ────────────────────────────────────────

const LAZADA_CATEGORIES: { label: string; url: string }[] = [
  { label: "Electronics",       url: "https://www.lazada.sg/electronics/?sort=popularity&page=1" },
  { label: "Mobile & Tablets",  url: "https://www.lazada.sg/mobile-phones-tablets/?sort=popularity&page=1" },
  { label: "Home & Living",     url: "https://www.lazada.sg/home-appliances/?sort=popularity&page=1" },
  { label: "Health & Beauty",   url: "https://www.lazada.sg/health-beauty/?sort=popularity&page=1" },
  { label: "Sports & Outdoors", url: "https://www.lazada.sg/sports-outdoors/?sort=popularity&page=1" },
  { label: "Fashion",           url: "https://www.lazada.sg/womens-clothing/?sort=popularity&page=1" },
  { label: "Toys & Games",      url: "https://www.lazada.sg/toys-games/?sort=popularity&page=1" },
  { label: "Groceries",         url: "https://www.lazada.sg/groceries/?sort=popularity&page=1" },
]

// ─── Scrape one Lazada category page ─────────────────────────────────────────

async function scrapeCategoryPage(
  url:      string,
  category: string,
  page:     import("playwright").Page
): Promise<AmazonProduct[]> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40_000 })
    await page.waitForTimeout(3000)
  } catch (err: any) {
    logger.warn("[LazadaScraper] Page load failed", { url, error: err.message })
    return []
  }

  // Scroll to load more products
  try {
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 900))
      await page.waitForTimeout(600)
    }
  } catch { /* ignore */ }

  const pageTitle = await page.title().catch(() => "")
  if (/access.denied|captcha|robot|blocked/i.test(pageTitle)) {
    logger.warn("[LazadaScraper] Bot challenge", { category })
    return []
  }

  // Try window.__STORE__ extraction
  const storeProducts = await page.evaluate((cat: string) => {
    try {
      const store = (window as any).__STORE__
      if (!store) return null

      // Lazada stores product list in multiple possible paths
      const items: any[] =
        store?.pageData?.data?.mainInfo?.items ??
        store?.listItems ??
        store?.items ??
        []

      if (items.length === 0) return null

      return items.slice(0, 48).map((item: any, idx: number) => {
        const title: string = item.name ?? item.productName ?? ""
        if (!title || title.length < 3) return null

        const rawPrice = item.price ?? item.priceInfo?.price ?? null
        const price = rawPrice != null ? parseFloat(String(rawPrice).replace(/[^\d.]/g, "")) || null : null

        const imgUrl: string = item.image ?? item.mainImage ?? item.imgUrl ?? ""
        const image_url = imgUrl.startsWith("//") ? `https:${imgUrl}` : imgUrl || null

        const productUrl: string = item.productUrl ?? item.itemUrl ?? ""
        const product_url = productUrl.startsWith("//") ? `https:${productUrl}`
          : productUrl.startsWith("http") ? productUrl : null

        const productId = String(item.itemId ?? item.productId ?? "").trim() || null

        return {
          asin:         productId,
          product_name: title,
          category:     cat,
          rank:         idx + 1,
          price,
          rating:       item.ratingScore ? parseFloat(item.ratingScore) : null,
          review_count: item.review ? parseInt(item.review, 10) : null,
          image_url,
          product_url,
          badge:        "Best Seller",
          brand:        item.brandName ?? item.brand ?? null,
          marketplace:  "Lazada",
        }
      }).filter(Boolean)
    } catch { return null }
  }, category) as AmazonProduct[] | null

  if (storeProducts && storeProducts.length > 0) {
    logger.info("[LazadaScraper] __STORE__ hit", { category, count: storeProducts.length })
    return storeProducts
  }

  // DOM fallback
  const products = await page.evaluate((cat: string) => {
    const results: any[] = []

    let cards: Element[] = Array.from(document.querySelectorAll(
      "[data-qa-locator='product-item'], [class*='Bd2Yyb'], [class*='_pc2GE'], [class*='product-card']"
    ))

    // Fallback: any links to product pages
    if (cards.length === 0) {
      const links = Array.from(document.querySelectorAll("a[href*='lazada.sg/products/'], a[href*='.html?spm=']"))
        .map(a => a.closest("li, div[class]") ?? a.parentElement ?? a)
        .filter((el, i, arr) => arr.indexOf(el) === i)
      cards.push(...links)
    }

    cards.slice(0, 48).forEach((el, idx) => {
      const linkEl = (
        el.querySelector("a[href*='/products/'], a[href*='.html']") ??
        (el.tagName === "A" ? el : null)
      ) as HTMLAnchorElement | null

      const href = linkEl?.getAttribute("href") ?? ""
      const product_url = href.startsWith("//") ? `https:${href}`
        : href.startsWith("http") ? href : null

      const productId = href.match(/i(\d+)-s(\d+)/)?.[0] ?? href.match(/\d{10,}/)?.[0] ?? null

      // Title
      const titleEl =
        el.querySelector("[class*='title'], [class*='Title'], [class*='name']") ??
        el.querySelector("h3, h2")
      const product_name = titleEl?.textContent?.trim() ?? ""
      if (!product_name || product_name.length < 3) return

      // Price
      let price: number | null = null
      const priceEl = el.querySelector("[class*='price'], [class*='Price']")
      if (priceEl) {
        const raw = priceEl.textContent?.replace(/[^\d.]/g, "") ?? ""
        const n   = parseFloat(raw)
        if (isFinite(n) && n > 0 && n < 100000) price = n
      }

      // Image
      const imgEl = el.querySelector("img")
      const image_url =
        imgEl?.getAttribute("src")       ??
        imgEl?.getAttribute("data-src")  ??
        null

      // Review count
      let review_count: number | null = null
      const revEl = el.querySelector("[class*='review'], [class*='Review'], [class*='rating']")
      if (revEl) {
        const m = (revEl.textContent ?? "").replace(/,/g, "").match(/(\d+)/)
        if (m) review_count = parseInt(m[1], 10)
      }

      results.push({
        asin:         productId,
        product_name,
        category:     cat,
        rank:         idx + 1,
        price,
        rating:       null,
        review_count,
        image_url:    image_url ? (image_url.startsWith("//") ? `https:${image_url}` : image_url) : null,
        product_url,
        badge:        "Best Seller",
        brand:        null,
        marketplace:  "Lazada",
      })
    })

    return results
  }, category)

  logger.info("[LazadaScraper] DOM fallback", { category, count: products.length })
  return products
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeLazadaBestSellers(opts: {
  category?: string
  limit?:    number
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 100 } = opts

  const targets = category === "All"
    ? LAZADA_CATEGORIES
    : LAZADA_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[LazadaScraper] No matching category", { category })
    return []
  }

  logger.info("[LazadaScraper] Starting scrape", { categories: targets.map(t => t.label) })

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale:    "en-SG",
    extraHTTPHeaders: { "Accept-Language": "en-SG,en;q=0.9" },
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
    const key = p.asin ?? p.product_name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  logger.info("[LazadaScraper] Complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
