/**
 * Tesco Best Sellers — Playwright scraper.
 *
 * Scrapes tesco.com grocery category pages sorted by Favourites (popularity).
 * Data stored in amazon_trending with marketplace = "Tesco".
 * Prices in GBP (£) stored as numeric value.
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

// ─── Tesco category slugs ─────────────────────────────────────────────────────

const TESCO_CATEGORIES: { label: string; slug: string }[] = [
  { label: "Food Cupboard",   slug: "food-cupboard" },
  { label: "Drinks",          slug: "drinks" },
  { label: "Dairy & Eggs",    slug: "dairy-eggs-and-chilled" },
  { label: "Frozen",          slug: "frozen-food" },
  { label: "Fresh Food",      slug: "fresh-food" },
  { label: "Health & Beauty", slug: "health-and-beauty" },
  { label: "Baby & Toddler",  slug: "baby-and-toddler" },
]

// ─── Scrape one Tesco category page ──────────────────────────────────────────

async function scrapeCategoryPage(
  slug:     string,
  category: string,
  page:     import("playwright").Page
): Promise<AmazonProduct[]> {
  const url = `https://www.tesco.com/groceries/en-GB/shop/${slug}/all?sortBy=Favourites`

  try {
    // networkidle waits for all XHR to settle — important for Tesco's React app
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 })
    await page.waitForTimeout(2000)
  } catch (err: any) {
    logger.warn("[TescoScraper] Page load failed", { url, error: err.message })
    return []
  }

  // Dismiss cookie / age-gate banners
  for (const sel of [
    "#onetrust-accept-btn-handler",
    "button:has-text('Accept all')",
    "button:has-text('Accept All')",
    "[data-auto='cookie-banner-accept']",
  ]) {
    try {
      const btn = page.locator(sel)
      if (await btn.count() > 0) { await btn.first().click(); await page.waitForTimeout(600) }
    } catch { /* ignore */ }
  }

  // Scroll down to trigger lazy-loaded product cards
  try {
    await page.evaluate(() => window.scrollBy(0, 800))
    await page.waitForTimeout(1500)
    await page.evaluate(() => window.scrollBy(0, 800))
    await page.waitForTimeout(1000)
  } catch { /* ignore */ }

  // Log what we can see for debugging
  const pageTitle = await page.title().catch(() => "")
  const html = await page.content().catch(() => "")
  logger.info("[TescoScraper] Page loaded", {
    slug,
    title: pageTitle,
    hasProductLinks: html.includes("/groceries/en-GB/products/"),
    hasDataAuto: html.includes("data-auto"),
    htmlLen: html.length,
  })

  const products = await page.evaluate((cat: string) => {
    const results: any[] = []

    // Tesco product tiles — try every known selector pattern
    let tiles = Array.from(
      document.querySelectorAll(
        "[data-auto='product-tile'], li.product-list--list-item, [class*='product-list'] li, ul[class*='product'] li"
      )
    )

    // Fallback 1: any element containing a Tesco product link
    if (tiles.length === 0) {
      tiles = Array.from(document.querySelectorAll("a[href*='/groceries/en-GB/products/']"))
        .map(a => a.closest("li, article, [class*='product'], [class*='tile']") ?? a.parentElement ?? a)
        .filter((el, i, arr) => arr.indexOf(el) === i)
    }

    // Fallback 2: grab all product anchor tags directly
    if (tiles.length === 0) {
      tiles = Array.from(document.querySelectorAll("a[href*='/groceries/en-GB/products/']"))
    }

    tiles.slice(0, 50).forEach((el, idx) => {
      const linkEl = (
        el.querySelector("a[href*='/products/']")       ??
        el.querySelector("a[href*='/groceries/']")
      ) as HTMLAnchorElement | null
      const href = linkEl?.getAttribute("href") ?? ""

      const productId = href.match(/\/products\/(\d+)/)?.[1] ?? null
      const product_url = href
        ? (href.startsWith("http") ? href : `https://www.tesco.com${href}`)
        : null

      // Product name
      const nameEl =
        el.querySelector("[data-auto='product-tile--title']") ??
        el.querySelector("h3, h4")                            ??
        el.querySelector("[class*='Heading'], [class*='heading']") ??
        linkEl
      const product_name = (
        nameEl?.textContent?.trim() ??
        linkEl?.getAttribute("aria-label")?.trim() ??
        ""
      )
      if (!product_name || product_name.length < 2) return

      // Price (GBP)
      let price: number | null = null
      const priceEl = el.querySelector(
        "[data-auto='price-details'], .price-control--price, [class*='PriceCurrent'], [class*='price']"
      )
      if (priceEl) {
        const raw = priceEl.textContent?.replace(/[^\d.]/g, "") ?? ""
        const n   = parseFloat(raw)
        if (isFinite(n) && n > 0) price = n
      }

      // Image
      const imgEl = el.querySelector("img")
      const image_url =
        imgEl?.getAttribute("src")      ??
        imgEl?.getAttribute("data-src") ??
        null

      // Brand — Tesco shows some brand info; skip if missing
      const brandEl = el.querySelector("[data-auto='product-brand'], [class*='Brand']")
      const brand   = brandEl?.textContent?.trim() || null

      results.push({
        asin:         productId,
        product_name,
        category:     cat,
        rank:         idx + 1,
        price,
        rating:       null,   // Tesco doesn't show ratings on listing pages
        review_count: null,
        image_url,
        product_url,
        badge:        null,
        brand,
      })
    })

    return results
  }, category)

  logger.info("[TescoScraper] Category done", { category, count: products.length })
  return products.map(p => ({ ...p, marketplace: "Tesco" }))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeTescoBestSellers(opts: {
  category?: string
  limit?:    number
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 100 } = opts

  const targets = category === "All"
    ? TESCO_CATEGORIES
    : TESCO_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[TescoScraper] No matching category", { category })
    return []
  }

  logger.info("[TescoScraper] Starting scrape", { categories: targets.map(t => t.label) })

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })
  const context = await browser.newContext({
    userAgent:        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale:           "en-GB",
    extraHTTPHeaders: { "Accept-Language": "en-GB,en;q=0.9" },
  })
  const page = await context.newPage()

  const allProducts: AmazonProduct[] = []

  try {
    for (const target of targets) {
      const products = await scrapeCategoryPage(target.slug, target.label, page)
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

  logger.info("[TescoScraper] Complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
