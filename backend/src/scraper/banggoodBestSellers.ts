/**
 * Banggood Best Sellers — Playwright scraper.
 *
 * Scrapes banggood.com hot/popular product pages.
 * Data stored in amazon_trending with marketplace = "Banggood".
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

// ─── Banggood category pages ──────────────────────────────────────────────────

const BANGGOOD_CATEGORIES: { label: string; url: string }[] = [
  { label: "Electronics",       url: "https://www.banggood.com/promotion-hot100.html" },
  { label: "Phone & Gadgets",   url: "https://www.banggood.com/Cellphones--Telecommunications-ons-1543.html?sortType=p_sales_14d&pageSize=48" },
  { label: "Computers",         url: "https://www.banggood.com/Computer--Office-ons-102.html?sortType=p_sales_14d&pageSize=48" },
  { label: "Home & Garden",     url: "https://www.banggood.com/Home-Garden-ons-5261.html?sortType=p_sales_14d&pageSize=48" },
  { label: "Sports & Outdoors", url: "https://www.banggood.com/Sports--Outdoor-ons-182.html?sortType=p_sales_14d&pageSize=48" },
  { label: "Toys & Hobbies",    url: "https://www.banggood.com/Toys--Hobbies-ons-107.html?sortType=p_sales_14d&pageSize=48" },
  { label: "Beauty & Health",   url: "https://www.banggood.com/Beauty--Health-ons-6267.html?sortType=p_sales_14d&pageSize=48" },
]

// ─── Scrape one Banggood page ────────────────────────────────────────────────

async function scrapeCategoryPage(
  url:      string,
  category: string,
  page:     import("playwright").Page
): Promise<AmazonProduct[]> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35_000 })
    await page.waitForTimeout(3000)
  } catch (err: any) {
    logger.warn("[BanggoodScraper] Page load failed", { url, error: err.message })
    return []
  }

  // Scroll aggressively to trigger lazy-loading of product cards
  try {
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, 1200))
      await page.waitForTimeout(800)
    }
    // Scroll back to top so first products are included, then wait for JS price updates
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(2000)
  } catch { /* ignore */ }

  const pageTitle = await page.title().catch(() => "")
  if (/captcha|robot|access.denied|verify/i.test(pageTitle)) {
    logger.warn("[BanggoodScraper] Bot challenge", { category })
    return []
  }

  const products = await page.evaluate((cat: string) => {
    const results: any[] = []

    // Banggood card selectors
    let cards: Element[] = Array.from(document.querySelectorAll(
      ".card-item, .goods-item, [class*='product-item'], [class*='goodsItem']"
    ))

    // Fallback: any link to a product page
    if (cards.length === 0) {
      const links = Array.from(document.querySelectorAll("a[href*='.html'][href*='-p-']"))
        .map(a => a.closest("li, div[class]") ?? a.parentElement ?? a)
        .filter((el, i, arr) => arr.indexOf(el) === i)
      cards.push(...links)
    }

    cards.slice(0, 48).forEach((el, idx) => {
      // Link + product ID
      const linkEl = (
        el.querySelector("a.goods-title-link, a[class*='title'], a[href*='-p-']") ??
        el.querySelector("a[href*='.html']")
      ) as HTMLAnchorElement | null

      const href = linkEl?.getAttribute("href") ?? ""
      const product_url = href.startsWith("http") ? href
        : href ? `https://www.banggood.com${href}` : null

      const productId = href.match(/-p-(\d+)\.html/)?.[1] ?? null

      // Title
      const titleEl =
        el.querySelector(".goods-title-link, [class*='goods-title'], [class*='product-title'], [class*='title']") ??
        linkEl
      const product_name = titleEl?.getAttribute("title") ??
        titleEl?.textContent?.trim() ?? ""
      if (!product_name || product_name.length < 3) return

      // Price — prefer current sale price; avoid price-old (crossed-out original price)
      let price: number | null = null
      const priceEl =
        el.querySelector(".main-price, [class*='main-price'], [class*='price-main']") ??
        el.querySelector(".price.wh_cn, .price:not(.price-old)")
      if (priceEl) {
        const raw = priceEl.textContent?.replace(/[^\d.]/g, "") ?? ""
        const n   = parseFloat(raw)
        if (isFinite(n) && n > 0 && n < 50000) price = n
      }
      // Fallback: scan all price elements, skip price-old, take first valid
      if (price === null) {
        for (const pe of Array.from(el.querySelectorAll("[class*='price']"))) {
          if (pe.className.includes("old") || pe.className.includes("Old")) continue
          const raw = pe.textContent?.replace(/[^\d.]/g, "") ?? ""
          const n   = parseFloat(raw)
          if (isFinite(n) && n > 0 && n < 50000) { price = n; break }
        }
      }

      // Image
      const imgEl = el.querySelector("img.img-origin, img[class*='goods-img'], img")
      const image_url =
        imgEl?.getAttribute("data-src")  ??
        imgEl?.getAttribute("src")       ??
        null

      // Sold / orders count
      let review_count: number | null = null
      const soldEl = el.querySelector("[class*='sold'], [class*='orders'], [class*='review']")
      if (soldEl) {
        const m = (soldEl.textContent ?? "").replace(/,/g, "").match(/(\d+)/)
        if (m) review_count = parseInt(m[1], 10)
      }

      // Rating
      let rating: number | null = null
      const ratingEl = el.querySelector("[class*='star'], [class*='rate'], [class*='rating']")
      if (ratingEl) {
        const m = (ratingEl.getAttribute("style") ?? ratingEl.textContent ?? "").match(/(\d+\.?\d*)/)
        if (m) { const v = parseFloat(m[1]); if (v > 0 && v <= 5) rating = v }
      }

      // Brand
      const brandEl = el.querySelector("[class*='brand'], [class*='Brand']")
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
        badge:        "Best Seller",
        brand,
        marketplace:  "Banggood",
      })
    })

    return results
  }, category)

  logger.info("[BanggoodScraper] Category done", { category, count: products.length })
  return products
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeBanggoodBestSellers(opts: {
  category?: string
  limit?:    number
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 100 } = opts

  const targets = category === "All"
    ? BANGGOOD_CATEGORIES
    : BANGGOOD_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[BanggoodScraper] No matching category", { category })
    return []
  }

  logger.info("[BanggoodScraper] Starting scrape", { categories: targets.map(t => t.label) })

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

  logger.info("[BanggoodScraper] Complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
