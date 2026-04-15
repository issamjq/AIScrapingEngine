/**
 * Amazon.ae Best Sellers — real Playwright scraper.
 *
 * Hits amazon.ae/gp/bestsellers/{category} directly.
 * Extracts: rank, ASIN, product name, price (AED), rating, review count, image.
 * No Claude API cost. No third-party. Real UAE data.
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"

export interface AmazonProduct {
  asin:         string | null
  product_name: string
  category:     string | null
  rank:         number | null
  price:        number | null   // AED price
  rating:       number | null
  review_count: number | null
  image_url:    string | null
  marketplace:  string          // always "AE"
}

// ─── Amazon.ae BSR category URLs ─────────────────────────────────────────────

const AE_CATEGORIES: { label: string; url: string }[] = [
  { label: "Electronics",       url: "https://www.amazon.ae/gp/bestsellers/electronics/"    },
  { label: "Beauty",            url: "https://www.amazon.ae/gp/bestsellers/beauty/"         },
  { label: "Home & Kitchen",    url: "https://www.amazon.ae/gp/bestsellers/kitchen/"        },
  { label: "Health",            url: "https://www.amazon.ae/gp/bestsellers/hpc/"            },
  { label: "Sports & Outdoors", url: "https://www.amazon.ae/gp/bestsellers/sporting-goods/" },
  { label: "Toys & Games",      url: "https://www.amazon.ae/gp/bestsellers/toys/"           },
  { label: "Fashion",           url: "https://www.amazon.ae/gp/bestsellers/apparel/"        },
  { label: "Books",             url: "https://www.amazon.ae/gp/bestsellers/books/"          },
]

// ─── Scrape one BSR category page ────────────────────────────────────────────

async function scrapeCategoryPage(
  url:      string,
  category: string,
  page:     import("playwright").Page
): Promise<AmazonProduct[]> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })
    await page.waitForTimeout(2500)
  } catch (err: any) {
    logger.warn("[AmazonScraper] Page load failed", { url, error: err.message })
    return []
  }

  const products = await page.evaluate((cat: string) => {
    const results: any[] = []

    // Amazon BSR grid — every product card has a non-empty data-asin attribute
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

      // ── Price ─────────────────────────────────────────────────────────────
      // amazon.ae shows "AED 249.00" or spans inside .a-price
      let price: number | null = null

      const priceWhole = card.querySelector(".p13n-sc-price")
      if (priceWhole) {
        const raw = priceWhole.textContent?.replace(/[^\d.]/g, "") ?? ""
        const n   = parseFloat(raw)
        if (isFinite(n) && n > 0) price = n
      }

      if (!price) {
        const offscreen = card.querySelector("span.a-price .a-offscreen")
        if (offscreen) {
          const raw = offscreen.textContent?.replace(/[^\d.]/g, "") ?? ""
          const n   = parseFloat(raw)
          if (isFinite(n) && n > 0) price = n
        }
      }

      if (!price) {
        // Try any element containing "AED" text
        const all = Array.from(card.querySelectorAll("*"))
        for (const el of all) {
          const t = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
            ? el.textContent ?? ""
            : ""
          if (t.includes("AED") || t.match(/^\d{1,4}(\.\d{2})?$/)) {
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
      // Links that say "1,234" reviews
      const reviewLinks = Array.from(card.querySelectorAll("a[href*='customerReviews'], a[href*='reviews']"))
      for (const el of reviewLinks) {
        const raw = el.textContent?.replace(/[^\d]/g, "") ?? ""
        const n   = parseInt(raw, 10)
        if (!isNaN(n) && n > 0) { review_count = n; break }
      }
      if (!review_count) {
        // Fall back: any small span with a number
        const spans = Array.from(card.querySelectorAll("span.a-size-small, span.a-size-base"))
        for (const el of spans) {
          const raw = (el.textContent ?? "").replace(/[^\d]/g, "")
          if (raw.length >= 2 && raw.length <= 7) {
            const n = parseInt(raw, 10)
            if (!isNaN(n) && n > 0) { review_count = n; break }
          }
        }
      }

      // ── Image ─────────────────────────────────────────────────────────────
      const imgEl =
        card.querySelector("img.a-dynamic-image") ??
        card.querySelector("img[data-image-index]") ??
        card.querySelector("img")
      const image_url = imgEl?.getAttribute("src") ?? null

      // ── Rank ──────────────────────────────────────────────────────────────
      let rank: number | null = null
      const rankEl = card.querySelector(".zg-bdg-text") ?? card.querySelector("[class*='zg-bdg']")
      if (rankEl) {
        const m = rankEl.textContent?.match(/\d+/)
        if (m) rank = parseInt(m[0], 10)
      }
      if (rank === null) rank = idx + 1

      results.push({ asin, product_name, category: cat, rank, price, rating, review_count, image_url })
    })

    return results
  }, category)

  return products.map(p => ({
    asin:         p.asin,
    product_name: p.product_name,
    category:     p.category,
    rank:         p.rank,
    price:        p.price,
    rating:       p.rating,
    review_count: p.review_count,
    image_url:    p.image_url,
    marketplace:  "AE",
  }))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeAmazonBestSellers(opts: {
  category?:    string   // "All" = all categories, or specific label e.g. "Electronics"
  marketplace?: string   // ignored — always AE
  limit?:       number
  apiKey?:      string   // kept for interface compat, not needed
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 100 } = opts

  const targets = category === "All"
    ? AE_CATEGORIES
    : AE_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[AmazonScraper] No matching category", { category })
    return []
  }

  logger.info("[AmazonScraper] Starting scrape", { categories: targets.map(t => t.label) })

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
    locale:    "en-AE",
    extraHTTPHeaders: { "Accept-Language": "en-AE,en;q=0.9,ar;q=0.8" },
  })

  const page = await context.newPage()

  // Block heavy resources to speed up
  await page.route("**/*", route => {
    if (["media", "font", "websocket"].includes(route.request().resourceType())) {
      route.abort()
    } else {
      route.continue()
    }
  })

  const allProducts: AmazonProduct[] = []

  try {
    for (const target of targets) {
      logger.info("[AmazonScraper] Scraping", { label: target.label })
      const products = await scrapeCategoryPage(target.url, target.label, page)
      logger.info("[AmazonScraper] Done", { label: target.label, found: products.length })
      allProducts.push(...products)
      // Polite delay between categories
      await page.waitForTimeout(1500)
    }
  } finally {
    await browser.close()
  }

  // Deduplicate by ASIN, sort by rank within category, limit
  const seen  = new Set<string>()
  const dedup = allProducts.filter(p => {
    const key = p.asin ?? p.product_name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  logger.info("[AmazonScraper] Scrape complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
