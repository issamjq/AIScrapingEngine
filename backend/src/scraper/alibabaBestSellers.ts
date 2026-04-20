/**
 * AliExpress Best Sellers — Playwright (DOM) + Claude Vision (prices only).
 *
 * Hybrid approach:
 *  1. DOM  → extracts product name, URL, image, reviews, rank (all correct)
 *  2. Vision → reads prices from the screenshot (sale + crossed-out original)
 *  3. Merge  → prices injected into DOM products by position index
 *
 * This avoids price extraction bugs (wrong class names, CSS not rendered)
 * while keeping Vision usage minimal (1 call per category = 8 calls total).
 *
 * Runs via local home-PC server (LOCAL_SCRAPER_URL) — AliExpress blocks Render IPs.
 * Data stored in amazon_trending with marketplace = "Alibaba".
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

const CLAUDE_API = "https://api.anthropic.com/v1/messages"

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

// ─── Vision: extract prices only from screenshot ─────────────────────────────

// Vision returns {name, price, original_price} per card — matched back to DOM by name.
// Name-based matching avoids cascade errors from positional counting on tall pages.
async function extractPricesWithVision(
  screenshot:   Buffer,
  domProducts:  { product_name: string }[],
): Promise<Map<string, { price: number | null; original_price: number | null }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return new Map()

  const base64 = screenshot.toString("base64")

  try {
    const resp = await fetch(CLAUDE_API, {
      method:  "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{
          role:    "user",
          content: [
            {
              type:   "image",
              source: { type: "base64", media_type: "image/jpeg", data: base64 },
            },
            {
              type: "text",
              text: `This is an AliExpress search results page. For each product card visible, extract the product name (first 6 words only) and its prices.

Return ONLY a JSON array — no markdown, no explanation:
[{"name": "Silicone Suction Phone Case", "price": 0.16, "original_price": 0.34}, ...]

Rules:
- "name" = first 6 words of the product title as shown on the card
- "price" = the current sale price (bold/colored — what the customer pays)
- "original_price" = the crossed-out or gray secondary price shown near the sale price (Welcome deal original, strikethrough, "was $X") — null if none
- Both prices must be numbers (USD), not strings
- original_price must be higher than price, otherwise null
- Include ALL product cards visible on the page`,
            },
          ],
        }],
      }),
    })

    if (!resp.ok) throw new Error(`Claude API ${resp.status}`)
    const json = await resp.json()
    const raw  = json.content?.[0]?.text?.trim() ?? "[]"
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return new Map()

    const arr = JSON.parse(match[0])
    if (!Array.isArray(arr)) return new Map()

    // Build lookup: normalize name → {price, original_price}
    const visionMap = new Map<string, { price: number | null; original_price: number | null }>()
    for (const p of arr) {
      const nameKey = String(p.name ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 40)
      if (!nameKey) continue
      const price          = typeof p.price === "number" && p.price > 0 && p.price < 50000 ? p.price : null
      const original_price = typeof p.original_price === "number" && p.original_price > 0 && p.original_price < 50000
        ? p.original_price : null
      visionMap.set(nameKey, {
        price,
        original_price: original_price && price && original_price > price ? original_price : null,
      })
    }

    // Match each DOM product to the best Vision entry by name overlap
    const result = new Map<string, { price: number | null; original_price: number | null }>()
    for (const dom of domProducts) {
      const domNorm = dom.product_name.toLowerCase().replace(/\s+/g, " ").trim()
      let bestKey   = ""
      let bestScore = 0
      for (const [vKey] of visionMap) {
        // Score = length of longest common prefix (after normalizing)
        const shorter = vKey.length < domNorm.length ? vKey : domNorm.slice(0, vKey.length)
        let score = 0
        for (let i = 0; i < Math.min(shorter.length, vKey.length); i++) {
          if (domNorm[i] === vKey[i]) score++
          else break
        }
        // Fallback: count shared words
        if (score < 5) {
          const domWords = new Set(domNorm.split(" ").slice(0, 8))
          const shared   = vKey.split(" ").filter(w => domWords.has(w)).length
          if (shared > score) score = shared
        }
        if (score > bestScore) { bestScore = score; bestKey = vKey }
      }
      if (bestScore >= 3 && bestKey) {
        result.set(dom.product_name, visionMap.get(bestKey)!)
      } else {
        result.set(dom.product_name, { price: null, original_price: null })
      }
    }

    return result
  } catch (err: any) {
    logger.warn("[AlibabaScraper] Vision price extraction failed", { error: err.message })
    return new Map()
  }
}

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
    await page.waitForTimeout(3000)
  } catch (err: any) {
    logger.warn("[AlibabaScraper] Page load failed", { query, error: err.message })
    return []
  }

  // Check for bot challenge
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) ?? "").catch(() => "")
  logger.info("[AlibabaScraper] Page body preview", { category, text: bodyText.slice(0, 150) })
  if (/captcha|robot|access.denied|verify you|unusual traffic|slide to verify/i.test(bodyText)) {
    logger.warn("[AlibabaScraper] Bot challenge detected — IP flagged, wait 20-30 min", { query })
    return []
  }

  // Scroll to trigger lazy-loaded product cards
  try {
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 1200))
      await page.waitForTimeout(500)
    }
    await page.waitForTimeout(1000)
  } catch { /* ignore */ }

  // ── Step 1: DOM extraction (everything except price) ──────────────────────
  // Debug: log how many cards each strategy finds
  const selectorDebug = await page.evaluate(() => {
    const s1 = document.querySelectorAll("a[class*='search-card-item'], [class*='search-item-card-wrapper-gallery'], [data-item-id]").length
    const s2 = document.querySelectorAll("a[href*='/item/']").length
    const s3 = Array.from(document.querySelectorAll("li, article")).filter(el => el.querySelector("a[href*='/item/']")).length
    const allLinks = Array.from(document.querySelectorAll("a[href]")).map(a => (a as HTMLAnchorElement).href).filter(h => h.includes("aliexpress")).slice(0, 5)
    return { s1, s2, s3, allLinks }
  }).catch(() => ({ s1: 0, s2: 0, s3: 0, allLinks: [] }))
  logger.info("[AlibabaScraper] Selector debug", { category, ...selectorDebug })

  const domProducts = await page.evaluate((cat: string) => {
    const results: any[] = []

    // Try multiple selector strategies in order
    let cards: Element[] = []

    // Strategy 1: known AliExpress card class patterns
    cards = Array.from(document.querySelectorAll(
      "a[class*='search-card-item'], [class*='search-item-card-wrapper-gallery'], [data-item-id]"
    ))

    // Strategy 2: any element containing a /item/ link (broad fallback)
    if (cards.length < 3) {
      const seen = new Set<Element>()
      document.querySelectorAll("a[href*='/item/']").forEach(a => {
        const card = a.closest("[class*='card'], [class*='item'], [class*='product'], li") ?? a.parentElement ?? a
        if (!seen.has(card)) { seen.add(card); cards.push(card) }
      })
    }

    // Strategy 3: list items that contain item links
    if (cards.length < 3) {
      cards = Array.from(document.querySelectorAll("li, article"))
        .filter(el => el.querySelector("a[href*='/item/']"))
    }

    cards.slice(0, 24).forEach((el, idx) => {
      const linkEl = (
        el.tagName === "A" && (el as HTMLAnchorElement).href?.includes("/item/")
          ? el
          : el.querySelector("a[href*='/item/']")
      ) as HTMLAnchorElement | null
      const href = linkEl?.href ?? linkEl?.getAttribute("href") ?? ""
      if (!href.includes("/item/")) return
      const product_url = href.startsWith("//") ? `https:${href}` : href
      const productId   = href.match(/\/item\/(\d+)/)?.[1] ?? null

      // Title: try multiple selectors
      const titleEl = el.querySelector("h3, h2, [class*='title'], [class*='Title'], [class*='name'], [class*='Name']")
      const product_name = (
        titleEl?.textContent ??
        linkEl?.getAttribute("title") ??
        linkEl?.textContent ??
        ""
      ).trim().replace(/\s+/g, " ")
      if (!product_name || product_name.length < 3) return

      const imgEl     = el.querySelector("img")
      const image_url = imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-src") ?? null

      let review_count: number | null = null
      const tradeEl = el.querySelector("[class*='trade'], [class*='order'], [class*='sold'], [class*='Sale']")
      if (tradeEl) {
        const m = (tradeEl.textContent ?? "").replace(/,/g, "").match(/(\d+)/)
        if (m) review_count = parseInt(m[1], 10)
      }

      const brandEl = el.querySelector("[class*='store'], [class*='shop'], [class*='Store']")
      const brand   = brandEl?.textContent?.trim() || null

      results.push({
        asin:         productId,
        product_name,
        category:     cat,
        rank:         idx + 1,
        image_url:    image_url ? (image_url.startsWith("//") ? `https:${image_url}` : image_url) : null,
        product_url,
        review_count,
        brand,
      })
    })
    return results
  }, category)

  if (domProducts.length === 0) {
    logger.info("[AlibabaScraper] DOM found no products", { category })
    return []
  }

  // ── Step 2: Vision extracts prices from full-page screenshot ─────────────
  // fullPage: true captures all products (including below the fold).
  // Viewport-only screenshot only shows ~5 cards → prices wrong for 6+.
  const screenshot = await page.screenshot({ type: "jpeg", quality: 75, fullPage: true })
  const priceMap   = await extractPricesWithVision(screenshot, domProducts)

  // ── Step 3: Merge prices into DOM products by name ────────────────────────
  const merged: AmazonProduct[] = domProducts.map((p, idx) => {
    const pr = priceMap.get(p.product_name) ?? { price: null, original_price: null }
    return {
      asin:           p.asin,
      product_name:   p.product_name,
      category,
      rank:           idx + 1,
      price:          pr.price,
      original_price: pr.original_price,
      rating:         null,
      review_count:   p.review_count,
      image_url:      p.image_url,
      product_url:    p.product_url,
      badge:          p.review_count && p.review_count >= 1000 ? "Best Seller" : null,
      brand:          p.brand,
      marketplace:    "Alibaba",
    }
  })

  const pricesFound = merged.filter(p => p.price !== null).length
  logger.info("[AlibabaScraper] Category done", { category, products: merged.length, pricesFound })
  return merged
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

  logger.info("[AlibabaScraper] Starting scrape (DOM+Vision hybrid, parallel)", { categories: targets.map(t => t.label) })

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })

  // Sequential with fresh context per category — parallel was triggering AliExpress bot detection
  const allProducts: AmazonProduct[] = []

  try {
    for (const target of targets) {
      const ctx = await browser.newContext({
        userAgent:        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        locale:           "en-US",
        viewport:         { width: 1440, height: 900 },
        extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
      })
      await ctx.addCookies([
        { name: "aep_usuc_f", value: "site=glo&c_tp=USD&region=US&b_locale=en_US", domain: ".aliexpress.com", path: "/" },
        { name: "xman_us_f",  value: "x_locale=en_US&acs_rt=", domain: ".aliexpress.com", path: "/" },
      ])
      const pg = await ctx.newPage()
      try {
        const products = await scrapeCategoryPage(target.query, target.label, pg)
        allProducts.push(...products)
      } finally {
        await ctx.close()
      }
      // Small delay between categories
      await new Promise(r => setTimeout(r, 800 + Math.random() * 400))
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
