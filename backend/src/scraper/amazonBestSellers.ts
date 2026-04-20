/**
 * Amazon.com Best Sellers — real Playwright scraper.
 *
 * Hits amazon.com/gp/bestsellers/{category} directly.
 * Extracts: rank, ASIN, product name, brand, price (USD), rating,
 *           review count, image, badge, product_url.
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"

export interface AmazonProduct {
  asin:           string | null
  product_name:   string
  category:       string | null
  rank:           number | null
  price:          number | null
  original_price: number | null   // crossed-out/strikethrough price when a sale is active
  rating:         number | null
  review_count:   number | null
  image_url:      string | null
  product_url:    string | null
  badge:          string | null   // comma-separated: "Best Seller" | "Amazon's Choice" | "A+" | combinations
  brand:          string | null
  marketplace:    string
}

// ─── Amazon.com BSR category URLs ────────────────────────────────────────────

const COM_CATEGORIES: { label: string; url: string }[] = [
  { label: "Electronics",       url: "https://www.amazon.com/gp/bestsellers/electronics/"   },
  { label: "Beauty",            url: "https://www.amazon.com/gp/bestsellers/beauty/"        },
  { label: "Home & Kitchen",    url: "https://www.amazon.com/gp/bestsellers/kitchen/"       },
  { label: "Health",            url: "https://www.amazon.com/gp/bestsellers/hpc/"           },
  { label: "Sports & Outdoors", url: "https://www.amazon.com/gp/bestsellers/sporting-goods/"},
  { label: "Toys & Games",      url: "https://www.amazon.com/gp/bestsellers/toys-and-games/"},
  { label: "Fashion",           url: "https://www.amazon.com/gp/bestsellers/apparel/"       },
  { label: "Books",             url: "https://www.amazon.com/gp/bestsellers/books/"         },
  { label: "Office Products",   url: "https://www.amazon.com/gp/bestsellers/office-products/"},
  { label: "Pet Supplies",      url: "https://www.amazon.com/gp/bestsellers/pet-supplies/"  },
]

// ─── Scrape one BSR category page ────────────────────────────────────────────

async function scrapeCategoryPage(
  url:      string,
  category: string,
  page:     import("playwright").Page
): Promise<AmazonProduct[]> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })
    await page.waitForTimeout(2000)
  } catch (err: any) {
    logger.warn("[AmazonScraper] Page load failed", { url, error: err.message })
    return []
  }

  const products = await page.evaluate((cat: string) => {
    const results: any[] = []

    const cards = Array.from(document.querySelectorAll("[data-asin]"))
      .filter(el => (el.getAttribute("data-asin") ?? "").length > 0)

    cards.forEach((card, idx) => {
      const asin = card.getAttribute("data-asin") ?? null

      // ── Product name ──────────────────────────────────────────────────────
      const nameEl =
        card.querySelector("._cDEzb_p13n-sc-css-line-clamp-3_g3dy1") ??
        card.querySelector(".p13n-sc-truncate-desktop-type2")           ??
        card.querySelector(".p13n-sc-truncated")                        ??
        card.querySelector("span._cDEzb_p13n-sc-css-line-clamp-1_1Fn9h") ??
        card.querySelector("a span")
      const product_name = nameEl?.textContent?.trim() ?? ""
      if (!product_name) return

      // ── Product URL ───────────────────────────────────────────────────────
      const linkEl = card.querySelector("a[href*='/dp/']") as HTMLAnchorElement | null
      let product_url: string | null = null
      if (asin) {
        product_url = `https://www.amazon.com/dp/${asin}`
      } else if (linkEl?.href) {
        product_url = linkEl.href.split("?")[0]
      }

      // ── Price ─────────────────────────────────────────────────────────────
      let price: number | null = null
      const priceEl = card.querySelector(".p13n-sc-price") ??
                      card.querySelector("span.a-price .a-offscreen")
      if (priceEl) {
        const raw = priceEl.textContent?.replace(/[^\d.]/g, "") ?? ""
        const n   = parseFloat(raw)
        if (isFinite(n) && n > 0) price = n
      }
      if (!price) {
        // Try any text with dollar sign
        const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT)
        let node: Text | null
        while ((node = walker.nextNode() as Text | null)) {
          const t = node.textContent?.trim() ?? ""
          if (t.startsWith("$") && t.length < 12) {
            const raw = t.replace(/[^\d.]/g, "")
            const n   = parseFloat(raw)
            if (isFinite(n) && n > 0) { price = n; break }
          }
        }
      }

      // ── Rating ────────────────────────────────────────────────────────────
      let rating: number | null = null
      const ratingEl = card.querySelector("span.a-icon-alt")
      if (ratingEl) {
        const m = ratingEl.textContent?.match(/(\d[\d.]+)/)
        if (m) rating = parseFloat(m[1])
      }

      // ── Review count ──────────────────────────────────────────────────────
      let review_count: number | null = null
      const reviewLinks = Array.from(card.querySelectorAll("a[href*='customerReviews'], a[href*='reviews'], span.a-size-small"))
      for (const el of reviewLinks) {
        const raw = (el.textContent ?? "").replace(/[^\d]/g, "")
        if (raw.length >= 1 && raw.length <= 8) {
          const n = parseInt(raw, 10)
          if (!isNaN(n) && n > 0) { review_count = n; break }
        }
      }

      // ── Image ─────────────────────────────────────────────────────────────
      const imgEl =
        card.querySelector("img.a-dynamic-image") ??
        card.querySelector("img[data-image-index]") ??
        card.querySelector("img")
      const image_url = imgEl?.getAttribute("src") ?? null

      // ── Badge ─────────────────────────────────────────────────────────────
      const badges: string[] = []

      // Best Seller + Amazon's Choice — shown directly on BSR cards
      const badgeEl =
        card.querySelector(".zg-badge-wrapper")    ??
        card.querySelector("[class*='p13n-badge']") ??
        card.querySelector("[class*='badge']")
      if (badgeEl) {
        const t = badgeEl.textContent?.trim() ?? ""
        if (t.toLowerCase().includes("best seller"))          badges.push("Best Seller")
        else if (t.toLowerCase().includes("amazon's choice")) badges.push("Amazon's Choice")
      }
      if (badges.length === 0) {
        const allText = card.textContent ?? ""
        if (allText.includes("#1 Best Seller") || allText.includes("Best Seller in")) badges.push("Best Seller")
        else if (allText.includes("Amazon's Choice")) badges.push("Amazon's Choice")
      }

      // A+ Content — check for brand content sections on the BSR card.
      // BSR cards for A+ products often have a brand banner / "From the brand" block.
      const hasAPlus =
        !!card.querySelector("[data-component-type*='aplus']")        ||
        !!card.querySelector("[class*='aplus']")                      ||
        !!card.querySelector(".a-carousel-brand-story-card")          ||
        !!card.querySelector("[data-cel-widget*='aplus']")            ||
        !!(card.textContent ?? "").includes("A+ Content")
      if (hasAPlus) badges.push("A+")

      const badge = badges.length > 0 ? badges.join(",") : null

      // ── Brand ─────────────────────────────────────────────────────────────
      let brand: string | null = null
      const brandEl = card.querySelector(".a-color-secondary") ??
                      card.querySelector("span[class*='brand']") ??
                      card.querySelector(".a-size-small.a-color-secondary")
      if (brandEl) {
        const t = brandEl.textContent?.trim() ?? ""
        if (t.length > 0 && t.length < 60 && !t.match(/^\d/)) brand = t
      }

      // ── Rank ──────────────────────────────────────────────────────────────
      let rank: number | null = null
      const rankEl = card.querySelector(".zg-bdg-text") ?? card.querySelector("[class*='zg-bdg']")
      if (rankEl) {
        const m = rankEl.textContent?.match(/\d+/)
        if (m) rank = parseInt(m[0], 10)
      }
      if (rank === null) rank = idx + 1

      results.push({ asin, product_name, category: cat, rank, price, rating, review_count, image_url, product_url, badge, brand })
    })

    return results
  }, category)

  return products.map(p => ({ ...p, marketplace: "US" }))
}

// ─── A+ Content detection via product detail page ────────────────────────────
// For top-ranked products (rank ≤ 5) that don't already have A+, we do a
// lightweight visit to the product detail page and check for the #aplus section.
// This is fast because we only load DOM (no images/media) and only hit a few ASINs.

async function checkAplusContent(
  products: AmazonProduct[],
  page: import("playwright").Page
): Promise<AmazonProduct[]> {
  // Only check top 5 per category — good signal, not too many requests
  const toCheck = products
    .filter(p => p.asin && p.product_url && p.rank !== null && p.rank <= 5)
    .filter(p => !(p.badge ?? "").includes("A+"))   // skip if already detected

  logger.info("[AmazonScraper] Checking A+ on product pages", { count: toCheck.length })

  const aplusAsins = new Set<string>()

  for (const p of toCheck) {
    try {
      await page.goto(p.product_url!, { waitUntil: "domcontentloaded", timeout: 20_000 })
      await page.waitForTimeout(800)

      const hasAPlus = await page.evaluate(() => {
        return !!(
          document.querySelector("#aplus")            ||
          document.querySelector(".aplus-module")     ||
          document.querySelector(".aplus-v2")         ||
          document.querySelector("[id^='aplus']")     ||
          document.querySelector("[class*='aplus']")
        )
      })

      if (hasAPlus && p.asin) {
        aplusAsins.add(p.asin)
        logger.info("[AmazonScraper] A+ detected", { asin: p.asin, name: p.product_name })
      }
    } catch (err: any) {
      logger.warn("[AmazonScraper] A+ check failed", { asin: p.asin, error: err.message })
    }
    await page.waitForTimeout(600 + Math.random() * 400)
  }

  if (aplusAsins.size === 0) return products

  return products.map(p => {
    if (!p.asin || !aplusAsins.has(p.asin)) return p
    const existing = p.badge ? p.badge.split(",") : []
    if (!existing.includes("A+")) existing.push("A+")
    return { ...p, badge: existing.join(",") }
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeAmazonBestSellers(opts: {
  category?:    string
  marketplace?: string
  limit?:       number
  apiKey?:      string
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 100 } = opts

  const targets = category === "All"
    ? COM_CATEGORIES
    : COM_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[AmazonScraper] No matching category", { category })
    return []
  }

  logger.info("[AmazonScraper] Starting amazon.com scrape", { categories: targets.map(t => t.label) })

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  })

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale:    "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  })

  const page = await context.newPage()

  await page.route("**/*", route => {
    if (["media", "font", "websocket"].includes(route.request().resourceType())) {
      route.abort()
    } else {
      route.continue()
    }
  })

  let allProducts: AmazonProduct[] = []

  try {
    for (const target of targets) {
      logger.info("[AmazonScraper] Scraping", { label: target.label })
      const products = await scrapeCategoryPage(target.url, target.label, page)
      logger.info("[AmazonScraper] Done", { label: target.label, found: products.length })
      allProducts.push(...products)
      // Polite delay between categories
      await page.waitForTimeout(2000 + Math.random() * 1000)
    }

    // A+ Content: visit product detail pages for top-ranked products
    allProducts = await checkAplusContent(allProducts, page)
  } finally {
    await browser.close()
  }

  // Deduplicate by ASIN
  const seen  = new Set<string>()
  const dedup = allProducts.filter(p => {
    const key = p.asin ?? p.product_name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  logger.info("[AmazonScraper] Complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
