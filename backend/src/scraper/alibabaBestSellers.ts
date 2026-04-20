/**
 * AliExpress Super Deals — SSR page Playwright scraper.
 *
 * Uses the SSR (Server-Side Rendered) deals page on aliexpress.com:
 *   https://www.aliexpress.com/ssr/300002660/Deals-HomePage
 *
 * Why SSR URL:
 *   - Products are in the initial HTML — no JS lazy-loading issues
 *   - Confirmed working via fetch (18 products visible)
 *   - Works for all IPs including Lebanon
 *   - One page, no category looping → zero bot detection risk
 *
 * USD is forced via c_tp=USD cookie. If AliExpress ignores it and serves local
 * currency (LBP), S4 converts by extracting the number and applying LBP→USD.
 *
 * Price extraction — 4 strategies (first match wins):
 *   S1 — CSS module: [class*='--current--'] / [class*='--del--']
 *   S2 — <del>/<s> HTML tags for original price + sibling leaf for sale
 *   S3 — All "US $X.XX" / "$X.XX" text in card → min=sale, max=original
 *   S4 — All decimal numbers (X.XX) in leaf elements → min=sale, max=original
 *        (catches LBP, AED, EUR, any currency — then normalised to USD range)
 *
 * Data stored in amazon_trending with marketplace = "Alibaba".
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

// SSR deals page — confirmed working for all IPs
const SUPER_DEALS_URL = "https://www.aliexpress.com/ssr/300002660/Deals-HomePage?disableNav=YES&pha_manifest=ssr&_immersiveMode=true"

// ─── Scrape the SSR deals page ────────────────────────────────────────────────

async function scrapeDealsPage(
  page: import("playwright").Page
): Promise<AmazonProduct[]> {
  try {
    await page.goto(SUPER_DEALS_URL, { waitUntil: "domcontentloaded", timeout: 40_000 })
    await page.waitForTimeout(4000)
  } catch (err: any) {
    logger.warn("[AlibabaScraper] Page load failed", { error: err.message })
    return []
  }

  // Bot challenge check
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) ?? "").catch(() => "")
  if (/captcha|robot|access.denied|verify you|unusual traffic|slide to verify/i.test(bodyText)) {
    logger.warn("[AlibabaScraper] Bot challenge detected — IP flagged, wait 20-30 min")
    return []
  }

  // Scroll to trigger any lazy-loaded cards
  try {
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, 1200))
      await page.waitForTimeout(600)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(2000)
  } catch { /* ignore */ }

  // ── Log page title and URL to confirm we landed on the right page ──────────
  const pageTitle = await page.title().catch(() => "")
  const pageUrl   = page.url()
  logger.info("[AlibabaScraper] Page loaded", { title: pageTitle, url: pageUrl.slice(0, 80) })

  // ── DOM extraction ─────────────────────────────────────────────────────────
  const domProducts = await page.evaluate(() => {
    const results: any[] = []

    // Find product cards — multiple selector strategies
    let cards: Element[] = Array.from(document.querySelectorAll(
      "a[class*='search-card-item'], [class*='search-item-card-wrapper-gallery'], [data-item-id]"
    ))

    if (cards.length === 0) {
      const seen = new Set<Element>()
      document.querySelectorAll("a[href*='/item/']").forEach(a => {
        const card = a.closest("[class*='card'], [class*='item'], [class*='product'], [class*='deal'], li") ?? a.parentElement ?? a
        if (!seen.has(card)) { seen.add(card); cards.push(card) }
      })
    }

    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll("li, article, div"))
        .filter(el => el.querySelector("a[href*='/item/']") && el.querySelector("img"))
    }

    // Debug: log what we found about card detection
    if (cards.length === 0) {
      const allLinks = document.querySelectorAll("a[href*='/item/']").length
      const allHrefs = Array.from(document.querySelectorAll("a")).slice(0, 5).map(a => a.href.slice(0, 60))
      ;(window as any).__cardDebug = { allLinks, allHrefs, bodyLen: document.body.innerHTML.length }
    }

    cards.slice(0, 40).forEach((el, idx) => {
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

      // ── Rating ──
      let rating: number | null = null
      const ratingEl = el.querySelector("[class*='rating'], [class*='Rating'], [aria-label*='star']")
      if (ratingEl) {
        const rm = (ratingEl.textContent ?? "").match(/[\d]+\.?\d*/)
        if (rm) { const rv = parseFloat(rm[0]); if (rv >= 1 && rv <= 5) rating = rv }
      }

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

      // ── Prices — 4 strategies, first with a valid result wins ────────────
      // S1: CSS module patterns (stable prefix, hash suffix changes)
      const currentEl = el.querySelector("[class*='--current--']")
      const delEl     = el.querySelector("[class*='--del--']")
      const s1cm = (currentEl?.textContent ?? "").replace(/,/g, "").match(/\d+\.?\d*/)
      const s1dm = (delEl?.textContent ?? "").replace(/,/g, "").match(/\d+\.?\d*/)
      const s1Price = s1cm ? parseFloat(s1cm[0]) : null
      const s1Opv   = s1dm ? parseFloat(s1dm[0]) : null

      // S2: <del>/<s> tags = original price; lowest non-del sibling leaf = sale price
      const delTagEl = el.querySelector("del, s")
      const s2dm = delTagEl ? (delTagEl.textContent ?? "").replace(/,/g, "").match(/\d+\.?\d*/) : null
      const s2Opv   = s2dm ? parseFloat(s2dm[0]) : null
      let s2Price: number | null = null
      if (s2Opv && s2Opv > 0) {
        const leaves = Array.from(el.querySelectorAll("*")).filter(function(n) {
          return !n.children.length && n !== delTagEl && n.tagName !== "DEL" && n.tagName !== "S"
        })
        for (let li = 0; li < leaves.length; li++) {
          const lm = (leaves[li].textContent ?? "").replace(/,/g, "").match(/^\D*([\d]+\.?\d*)\D*$/)
          if (lm) { const lv = parseFloat(lm[1]); if (lv > 0 && lv < s2Opv) { s2Price = lv; break } }
        }
      }

      // S3: dollar-sign currency values (US $X / $X) — works when USD cookie respected
      const cardText   = (el.textContent ?? "").replace(/,/g, "")
      const s3Matches  = cardText.match(/(?:US\s*\$|USD\s*|\$\s*)([\d]+\.?\d*)/g) ?? []
      const s3Vals: number[] = []
      for (let ci = 0; ci < s3Matches.length; ci++) {
        const nm = s3Matches[ci].replace(/,/g, "").match(/([\d]+\.?\d*)/)
        if (nm) { const nv = parseFloat(nm[1]); if (nv > 0 && nv < 50000) s3Vals.push(nv) }
      }
      const s3Price = s3Vals.length > 0 ? Math.min.apply(null, s3Vals) : null
      const s3Opv   = s3Vals.length > 1 ? Math.max.apply(null, s3Vals) : null

      // S4: any decimal number (X.XX) in a leaf element — currency-agnostic
      // Catches LBP, AED, EUR, etc. Skips integers (sold counts) and pure ratings (< 5.1)
      // For non-USD: convert using approximate rate (LBP≈90000/USD, AED≈3.67/USD)
      const allLeaves4 = Array.from(el.querySelectorAll("*")).filter(function(n) {
        return !n.children.length
      })
      const s4Vals: number[] = []
      let detectedCurrency = "USD"
      const fullText = el.textContent ?? ""
      if (/LBP/.test(fullText))      detectedCurrency = "LBP"
      else if (/AED/.test(fullText)) detectedCurrency = "AED"
      else if (/€/.test(fullText))   detectedCurrency = "EUR"

      for (let i = 0; i < allLeaves4.length; i++) {
        const t = (allLeaves4[i].textContent ?? "").replace(/,/g, "").trim()
        if (!t.includes(".")) continue  // skip integers (sold counts, etc.)
        const m = t.match(/([\d]+\.[\d]{1,2})/)
        if (!m) continue
        let v = parseFloat(m[1])
        if (v <= 0) continue
        // Convert to USD equivalent
        if (detectedCurrency === "LBP") v = v / 90000
        else if (detectedCurrency === "AED") v = v / 3.67
        // Accept USD-range prices: $0.10 – $50,000
        if (v >= 0.10 && v < 50000) s4Vals.push(v)
      }
      // Filter out duplicates and ratings (≤5.0 with only one decimal)
      const s4Unique = s4Vals.filter(function(v, i, arr) { return arr.indexOf(v) === i })
        .filter(function(v) { return v > 5.1 || s4Vals.length === 1 })  // skip rating-range unless only value
      const s4Price = s4Unique.length > 0 ? Math.min.apply(null, s4Unique) : null
      const s4Opv   = s4Unique.length > 1 ? Math.max.apply(null, s4Unique) : null

      // Pick best result across all strategies
      const rawPrice = (s1Price && s1Price > 0 && s1Price < 50000) ? s1Price
                     : (s2Price && s2Price > 0 && s2Price < 50000) ? s2Price
                     : (s3Price && s3Price > 0 && s3Price < 50000) ? s3Price
                     : (s4Price && s4Price > 0 && s4Price < 50000) ? s4Price
                     : null
      const rawOpv   = (s1Opv && s1Opv > 0 && s1Opv < 50000) ? s1Opv
                     : (s2Opv && s2Opv > 0 && s2Opv < 50000) ? s2Opv
                     : (s3Opv && s3Opv > 0 && s3Opv < 50000) ? s3Opv
                     : (s4Opv && s4Opv > 0 && s4Opv < 50000) ? s4Opv
                     : null
      const price          = rawPrice
      const original_price = rawOpv && rawPrice && rawOpv > rawPrice ? rawOpv : null

      results.push({
        asin:          productId,
        product_name,
        category:      "Super Deals",
        rank:          idx + 1,
        image_url:     image_url ? (image_url.startsWith("//") ? `https:${image_url}` : image_url) : null,
        product_url,
        review_count,
        rating,
        brand,
        price,
        original_price,
      })
    })

    return results
  })

  const pricesFound = domProducts.filter((p: any) => p.price !== null).length
  logger.info("[AlibabaScraper] Page done", { total: domProducts.length, pricesFound })

  // If no products at all — log card detection debug
  if (domProducts.length === 0) {
    const cardDebug = await page.evaluate(() => {
      const d = (window as any).__cardDebug ?? {}
      const itemLinks  = Array.from(document.querySelectorAll("a[href*='/item/']")).length
      const anyLinks   = document.querySelectorAll("a").length
      const bodySnap   = document.body.innerText.slice(0, 400).replace(/\s+/g, " ")
      const sampleHrefs = Array.from(document.querySelectorAll("a")).slice(0, 8).map(a => a.href.slice(0, 70))
      return { ...d, itemLinks, anyLinks, bodySnap, sampleHrefs }
    }).catch(() => ({ error: "eval failed" }))
    logger.info("[AlibabaScraper] Card debug (0 products)", { cardDebug })
  }

  // If products found but no prices — log price element debug
  if (domProducts.length > 0 && pricesFound === 0) {
    const priceDebug = await page.evaluate(() => {
      const card = document.querySelector("a[href*='/item/']")?.closest("[class*='card'], [class*='item'], li")
               ?? document.querySelector("a[href*='/item/']")?.parentElement
      if (!card) return { error: "no card found" }
      const leaves = Array.from(card.querySelectorAll("*")).filter(function(n) { return !n.children.length })
      const currencyLeaves = leaves
        .filter(function(n) { return /\$|€|£|¥|LBP|AED|USD/.test(n.textContent ?? "") })
        .map(function(n) { return { tag: n.tagName, cls: (n.className ?? "").slice(0, 80), text: (n.textContent ?? "").trim().slice(0, 60) } })
      const decimalLeaves = leaves
        .filter(function(n) { return /\d+\.\d{1,2}/.test(n.textContent ?? "") })
        .map(function(n) { return { tag: n.tagName, cls: (n.className ?? "").slice(0, 80), text: (n.textContent ?? "").trim().slice(0, 60) } })
      return { currencyLeaves, decimalLeaves, cardText: (card.textContent ?? "").replace(/\s+/g, " ").slice(0, 400) }
    }).catch(() => ({ error: "eval failed" }))
    logger.info("[AlibabaScraper] Price debug (0 prices)", { priceDebug })
  }

  return domProducts
    .filter((p: any) => p.product_name.length >= 3)
    .map((p: any) => ({
      asin:           p.asin,
      product_name:   p.product_name,
      category:       "Super Deals",
      rank:           p.rank,
      price:          p.price,
      original_price: p.original_price,
      rating:         p.rating,
      review_count:   p.review_count,
      image_url:      p.image_url,
      product_url:    p.product_url,
      badge:          "Best Seller",
      brand:          p.brand,
      marketplace:    "Alibaba",
    }))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeAlibabaBestSellers(opts: {
  category?: string
  limit?:    number
}): Promise<AmazonProduct[]> {
  const { limit = 40 } = opts

  // ── Delegate to local home-PC scraper if URL is configured ──────────────────
  const localUrl = process.env.LOCAL_SCRAPER_URL
  if (localUrl) {
    logger.info("[AlibabaScraper] Delegating to local scraper", { localUrl })
    try {
      const resp = await fetch(
        `${localUrl}/scrape-aliexpress?limit=${limit}`,
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

  logger.info("[AlibabaScraper] Scraping AliExpress SSR Deals page")

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
  // Try to force USD currency
  await context.addCookies([
    { name: "aep_usuc_f", value: "site=glo&c_tp=USD&region=US&b_locale=en_US", domain: ".aliexpress.com", path: "/" },
    { name: "xman_us_f",  value: "x_locale=en_US&acs_rt=",                     domain: ".aliexpress.com", path: "/" },
  ])
  const page = await context.newPage()

  try {
    const products = await scrapeDealsPage(page)
    const seen  = new Set<string>()
    const dedup = products.filter(p => {
      const key = p.asin ?? p.product_name
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    logger.info("[AlibabaScraper] Complete", { total: dedup.length })
    return dedup.slice(0, limit)
  } finally {
    await browser.close()
  }
}
