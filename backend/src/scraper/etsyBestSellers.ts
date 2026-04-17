/**
 * Etsy Best Sellers — Playwright scraper.
 *
 * Scrapes etsy.com category pages sorted by most_relevant (trending/popular).
 * Etsy embeds listing data in <script type="application/json"> tags;
 * falls back to DOM extraction.
 * Data stored in amazon_trending with marketplace = "Etsy".
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

// ─── Etsy category slugs ──────────────────────────────────────────────────────

const ETSY_CATEGORIES: { label: string; slug: string }[] = [
  { label: "Jewelry",           slug: "jewelry" },
  { label: "Home & Living",     slug: "home-and-living" },
  { label: "Clothing",          slug: "clothing" },
  { label: "Art & Collectibles",slug: "art-and-collectibles" },
  { label: "Craft Supplies",    slug: "craft-supplies-and-tools" },
  { label: "Toys & Games",      slug: "toys-and-games" },
  { label: "Accessories",       slug: "accessories" },
  { label: "Bath & Beauty",     slug: "bath-and-beauty" },
]

// ─── Scrape one Etsy category page ───────────────────────────────────────────

async function scrapeCategoryPage(
  slug:     string,
  category: string,
  page:     import("playwright").Page
): Promise<AmazonProduct[]> {
  const url = `https://www.etsy.com/c/${slug}?ref=pagination&sort_on=most_relevant&explicit=1`

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35_000 })
    await page.waitForTimeout(2000)
  } catch (err: any) {
    logger.warn("[EtsyScraper] Page load failed", { slug, error: err.message })
    return []
  }

  // Close "continue browsing" or consent banners
  for (const sel of ["button[data-gdpr-single-choice-accept]", "#gdpr-single-choice-form button"]) {
    try {
      const btn = page.locator(sel)
      if (await btn.count() > 0) { await btn.first().click(); await page.waitForTimeout(400) }
    } catch { /* ignore */ }
  }

  const pageTitle = await page.title().catch(() => "")
  if (/access.denied|captcha|robot/i.test(pageTitle)) {
    logger.warn("[EtsyScraper] Bot challenge", { slug })
    return []
  }

  // Try JSON-in-script extraction first (Etsy embeds listing data)
  const jsonProducts = await page.evaluate((cat: string) => {
    const results: any[] = []
    try {
      const scripts = Array.from(document.querySelectorAll('script[type="application/json"]'))
      for (const s of scripts) {
        try {
          const data = JSON.parse(s.textContent ?? "")
          // Etsy embeds listings in various shapes — look for array with listingId / listing_id
          const flatten = (obj: any, depth = 0): any[] => {
            if (depth > 6) return []
            if (Array.isArray(obj)) return obj
            if (obj && typeof obj === "object") {
              for (const v of Object.values(obj)) {
                const arr = flatten(v, depth + 1)
                if (arr.length > 0 && arr[0]?.listingId) return arr
              }
            }
            return []
          }
          const listings = flatten(data)
          if (listings.length > 2) {
            listings.slice(0, 48).forEach((item: any, idx: number) => {
              const title = item.title ?? item.listingTitle ?? ""
              if (!title) return
              const price = item.price?.amount ?? item.price?.value ?? item.currencyConvertedPrice?.amount ?? null
              const image_url = item.mainImage?.url750xN ?? item.mainImage?.url570xN ?? item.imageUrl ?? null
              const product_url = item.url ?? (item.listingId ? `https://www.etsy.com/listing/${item.listingId}` : null)
              results.push({
                asin:         String(item.listingId ?? item.id ?? "").trim() || null,
                product_name: title,
                category:     cat,
                rank:         idx + 1,
                price:        price != null ? parseFloat(String(price)) || null : null,
                rating:       item.ratingValue ? parseFloat(item.ratingValue) : null,
                review_count: item.reviewCount ?? item.numRatings ?? null,
                image_url,
                product_url,
                badge:        "Best Seller",
                brand:        item.shopName ?? item.shop?.name ?? null,
                marketplace:  "Etsy",
              })
            })
            if (results.length > 0) return results
          }
        } catch { /* continue */ }
      }
    } catch { /* ignore */ }
    return []
  }, category)

  if (jsonProducts.length > 0) {
    logger.info("[EtsyScraper] JSON hit", { slug: category, count: jsonProducts.length })
    return jsonProducts
  }

  // DOM fallback
  const products = await page.evaluate((cat: string) => {
    const results: any[] = []

    let cards: Element[] = Array.from(document.querySelectorAll("[data-listing-id]"))

    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll(
        ".listing-link, [class*='listing'], [class*='Listing'], [class*='item-card']"
      )).filter(el => el.querySelector("a[href*='/listing/']") || el.tagName === "A")
    }

    // Last resort: all listing anchor tags
    if (cards.length === 0) {
      const links = Array.from(document.querySelectorAll("a[href*='/listing/']"))
      cards = links
        .map(a => a.closest("li, article, div[class]") ?? a.parentElement ?? a)
        .filter((el, i, arr) => arr.indexOf(el) === i)
    }

    cards.slice(0, 48).forEach((el, idx) => {
      const listingId =
        el.getAttribute("data-listing-id") ??
        el.querySelector("a[href*='/listing/']")?.getAttribute("href")?.match(/\/listing\/(\d+)/)?.[1] ??
        null

      const linkEl = el.querySelector("a[href*='/listing/']") as HTMLAnchorElement | null
      const href = linkEl?.getAttribute("href") ?? ""
      const product_url = href.startsWith("http") ? href : href ? `https://www.etsy.com${href}` : null

      // Title — Etsy uses h3 or link text
      const titleEl =
        el.querySelector("h3, h2, [class*='title'], [class*='Title']") ??
        linkEl
      const product_name = (
        titleEl?.getAttribute("title") ??
        titleEl?.textContent?.trim() ??
        linkEl?.getAttribute("aria-label") ??
        ""
      ).slice(0, 200)
      if (!product_name || product_name.length < 3) return

      // Price
      let price: number | null = null
      const priceEl = el.querySelector("[class*='currency-value'], [class*='price'], [class*='Price']")
      if (priceEl) {
        const raw = priceEl.textContent?.replace(/[^\d.]/g, "") ?? ""
        const n   = parseFloat(raw)
        if (isFinite(n) && n > 0) price = n
      }

      // Image
      const imgEl = el.querySelector("img")
      const image_url =
        imgEl?.getAttribute("src")       ??
        imgEl?.getAttribute("data-src")  ??
        imgEl?.getAttribute("data-orig") ??
        null

      // Reviews / rating
      const reviewEl = el.querySelector("[class*='review'], [class*='rating'], [class*='star']")
      let review_count: number | null = null
      if (reviewEl) {
        const m = (reviewEl.textContent ?? "").replace(/,/g, "").match(/(\d+)/)
        if (m) review_count = parseInt(m[1], 10)
      }

      results.push({
        asin:         listingId,
        product_name,
        category:     cat,
        rank:         idx + 1,
        price,
        rating:       null,
        review_count,
        image_url,
        product_url,
        badge:        "Best Seller",
        brand:        null,
        marketplace:  "Etsy",
      })
    })

    return results
  }, category)

  logger.info("[EtsyScraper] DOM fallback", { slug: category, count: products.length })
  return products
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeEtsyBestSellers(opts: {
  category?: string
  limit?:    number
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 100 } = opts

  const targets = category === "All"
    ? ETSY_CATEGORIES
    : ETSY_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[EtsyScraper] No matching category", { category })
    return []
  }

  logger.info("[EtsyScraper] Starting scrape", { categories: targets.map(t => t.label) })

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
      const products = await scrapeCategoryPage(target.slug, target.label, page)
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

  logger.info("[EtsyScraper] Complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
