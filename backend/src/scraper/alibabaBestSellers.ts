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

      // ── Prices — multi-strategy, class-name-agnostic ──
      // Strategy 1: CSS module patterns (stable prefix, hash suffix changes)
      const currentEl = el.querySelector("[class*='--current--']")
      const delEl     = el.querySelector("[class*='--del--']")
      const s1Current = currentEl?.textContent?.trim() ?? ""
      const s1Del     = delEl?.textContent?.trim() ?? ""
      const s1cm = s1Current.replace(/,/g, "").match(/\d+\.?\d*/)
      const s1dm = s1Del.replace(/,/g, "").match(/\d+\.?\d*/)
      const s1Price = s1cm ? parseFloat(s1cm[0]) : null
      const s1Opv   = s1dm ? parseFloat(s1dm[0]) : null

      // Strategy 2: <del> / <s> tags = original price; sibling leaf = sale price
      const delTagEl = el.querySelector("del, s")
      const s2dm = delTagEl ? (delTagEl.textContent ?? "").replace(/,/g, "").match(/\d+\.?\d*/) : null
      const s2Opv   = s2dm ? parseFloat(s2dm[0]) : null
      // Lowest-value leaf element not inside del/s = likely sale price
      let s2Price: number | null = null
      if (s2Opv && s2Opv > 0) {
        const leaves = Array.from(el.querySelectorAll("*")).filter(function(n) {
          return !n.children.length && n !== delTagEl && n.tagName !== "DEL" && n.tagName !== "S"
        })
        for (let li = 0; li < leaves.length; li++) {
          const lm = (leaves[li].textContent ?? "").replace(/,/g, "").match(/^\D*([\d]+\.?\d*)\D*$/)
          if (lm) {
            const lv = parseFloat(lm[1])
            if (lv > 0 && lv < s2Opv) { s2Price = lv; break }
          }
        }
      }

      // Strategy 3: extract all currency-formatted values from card text (US $X.XX / $X.XX)
      const cardText = (el.textContent ?? "").replace(/,/g, "")
      const currMatches = cardText.match(/(?:US\s*\$|USD\s*|\$\s*)([\d]+\.?\d*)/g) ?? []
      const currVals: number[] = []
      for (let ci = 0; ci < currMatches.length; ci++) {
        const nm = currMatches[ci].replace(/,/g, "").match(/([\d]+\.?\d*)/)
        if (nm) {
          const nv = parseFloat(nm[1])
          if (nv > 0 && nv < 50000) currVals.push(nv)
        }
      }
      const s3Price = currVals.length > 0 ? Math.min.apply(null, currVals) : null
      const s3Opv   = currVals.length > 1 ? Math.max.apply(null, currVals) : null

      // Pick best result: S1 → S2 → S3
      const rawPrice = (s1Price && s1Price > 0 && s1Price < 50000) ? s1Price
                     : (s2Price && s2Price > 0 && s2Price < 50000) ? s2Price
                     : (s3Price && s3Price > 0 && s3Price < 50000) ? s3Price
                     : null
      const rawOpv   = (s1Opv   && s1Opv   > 0 && s1Opv   < 50000) ? s1Opv
                     : (s2Opv   && s2Opv   > 0 && s2Opv   < 50000) ? s2Opv
                     : (s3Opv   && s3Opv   > 0 && s3Opv   < 50000) ? s3Opv
                     : null
      const price          = rawPrice
      const original_price = rawOpv && rawPrice && rawOpv > rawPrice ? rawOpv : null

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

  const pricesFound = domProducts.filter((p: any) => p.price !== null).length
  // Debug: if still no prices found after all strategies, log detailed card info
  if (pricesFound === 0) {
    const priceDebug = await page.evaluate(() => {
      const card = document.querySelector("a[href*='/item/']")?.closest("[class*='card'], [class*='item'], li") ?? document.querySelector("a[href*='/item/']")?.parentElement
      if (!card) return { error: "no card found" }
      // All leaf elements with any numeric text
      const leaves = Array.from(card.querySelectorAll("*")).filter(function(n) { return !n.children.length })
      const numericLeaves = leaves.filter(function(n) { return /[\d]/.test(n.textContent ?? "") })
        .map(function(n) { return { tag: n.tagName, cls: (n.className ?? "").slice(0, 60), text: (n.textContent ?? "").trim().slice(0, 40) } })
        .slice(0, 10)
      // Currency-containing leaves
      const currencyLeaves = leaves.filter(function(n) { return /\$|€|£|¥/.test(n.textContent ?? "") })
        .map(function(n) { return { tag: n.tagName, cls: (n.className ?? "").slice(0, 60), text: (n.textContent ?? "").trim().slice(0, 40) } })
        .slice(0, 5)
      // del/s tags
      const delTags = Array.from(card.querySelectorAll("del, s")).map(function(n) { return (n.textContent ?? "").trim().slice(0, 30) })
      return { numericLeaves, currencyLeaves, delTags, cardText: (card.textContent ?? "").replace(/\s+/g, " ").slice(0, 200) }
    }).catch(function(e) { return { evalError: String(e) } })
    logger.info("[AlibabaScraper] Price debug (0 prices found)", { category, debug: priceDebug })
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
