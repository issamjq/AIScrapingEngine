/**
 * Walmart.com Best Sellers — Playwright scraper.
 *
 * Uses Walmart search pages sorted by best_seller — these pages reliably embed
 * product data in __NEXT_DATA__ under searchResult.itemStacks[0].items.
 *
 * Data stored in amazon_trending with marketplace = "Walmart".
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

// ─── Walmart search-based category queries ────────────────────────────────────
// Using search pages (?sort=best_seller) which consistently have __NEXT_DATA__

const WMT_CATEGORIES: { label: string; url: string }[] = [
  { label: "Electronics",      url: "https://www.walmart.com/search?q=electronics&sort=best_seller" },
  { label: "Beauty",           url: "https://www.walmart.com/search?q=beauty+products&sort=best_seller" },
  { label: "Home & Kitchen",   url: "https://www.walmart.com/search?q=home+kitchen&sort=best_seller" },
  { label: "Health",           url: "https://www.walmart.com/search?q=health+wellness&sort=best_seller" },
  { label: "Sports & Outdoors",url: "https://www.walmart.com/search?q=sports+outdoors&sort=best_seller" },
  { label: "Toys & Games",     url: "https://www.walmart.com/search?q=toys+games&sort=best_seller" },
  { label: "Fashion",          url: "https://www.walmart.com/search?q=clothing+fashion&sort=best_seller" },
  { label: "Baby",             url: "https://www.walmart.com/search?q=baby+products&sort=best_seller" },
  { label: "Food & Grocery",   url: "https://www.walmart.com/search?q=grocery+food&sort=best_seller" },
  { label: "Pet Supplies",     url: "https://www.walmart.com/search?q=pet+supplies&sort=best_seller" },
]

// ─── Scrape one Walmart search page ──────────────────────────────────────────

async function scrapeCategoryPage(
  url:      string,
  category: string,
  page:     import("playwright").Page
): Promise<AmazonProduct[]> {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 40_000 })
    await page.waitForTimeout(2000)
  } catch (err: any) {
    // networkidle sometimes times out but page is still usable
    logger.warn("[WalmartScraper] Page load warning", { url, error: err.message })
  }

  // Log page title so we can detect bot challenges in Render logs
  const title = await page.title().catch(() => "?")
  const finalUrl = page.url()
  logger.info("[WalmartScraper] Page state", { category, title: title.slice(0, 80), url: finalUrl.slice(0, 120) })

  // Bot challenge detection — Walmart shows "Robot or human?" or similar
  if (/robot|captcha|challenge|access.denied|blocked/i.test(title)) {
    logger.warn("[WalmartScraper] Bot challenge detected", { category, title })
    return []
  }

  const products = await page.evaluate((cat: string) => {
    const results: any[] = []

    // ── Method 1: __NEXT_DATA__ with recursive item finder ────────────────────
    try {
      const scriptEl = document.getElementById("__NEXT_DATA__")
      if (scriptEl?.textContent) {
        const nd = JSON.parse(scriptEl.textContent)

        // Try the canonical search-result path first
        const searchResult = nd?.props?.pageProps?.initialData?.searchResult ?? null
        let rawItems: any[] = []

        if (searchResult?.itemStacks) {
          for (const stack of searchResult.itemStacks) {
            if (Array.isArray(stack?.items) && stack.items.length > 0) {
              rawItems.push(...stack.items)
            }
          }
        }

        // Fallback: try every key in initialData
        if (rawItems.length === 0) {
          const initialData = nd?.props?.pageProps?.initialData ?? {}
          for (const key of Object.keys(initialData)) {
            const section = initialData[key]
            if (section?.itemStacks) {
              for (const stack of section.itemStacks) {
                if (Array.isArray(stack?.items) && stack.items.length > 0) rawItems.push(...stack.items)
              }
            }
          }
        }

        // Fallback: look for any array with usItemId/name fields
        if (rawItems.length === 0) {
          const probe = (o: any, depth: number): any[] => {
            if (depth > 8 || !o || typeof o !== "object") return []
            if (Array.isArray(o) && o.length > 0 && o[0]?.usItemId && o[0]?.name) return o
            for (const k of Object.keys(o)) {
              const r = probe(o[k], depth + 1)
              if (r.length > 0) return r
            }
            return []
          }
          rawItems = probe(nd?.props?.pageProps?.initialData ?? {}, 0)
        }

        if (rawItems.length > 0) {
          rawItems.slice(0, 60).forEach((item: any, idx: number) => {
            if (!item?.name && !item?.title) return
            const name: string = item.name ?? item.title ?? ""
            const itemId: string | null = String(item.usItemId ?? item.itemId ?? "").trim() || null
            const productUrl = itemId ? `https://www.walmart.com/ip/${itemId}` : (item.canonicalUrl ? `https://www.walmart.com${item.canonicalUrl}` : null)

            const price: number | null = (() => {
              const cp = item.priceInfo?.currentPrice?.price ?? item.price?.currentPrice ?? item.salePrice ?? null
              if (cp != null) { const n = Number(cp); return isFinite(n) && n > 0 ? n : null }
              return null
            })()

            const rating       = item.averageRating   != null ? Number(item.averageRating)   : null
            const review_count = item.numberOfReviews != null ? Number(item.numberOfReviews) : null
            const brand        = item.brand ?? null
            const image_url    = item.imageInfo?.thumbnailUrl ?? item.imageUrl ?? null

            const badges: string[] = []
            for (const g of (item.badges?.groups ?? [])) {
              const bn = (g?.name ?? "").toUpperCase()
              if (bn.includes("BEST_SELLER")) badges.push("Best Seller")
              if (bn.includes("TOP_RATED"))   badges.push("Top Rated")
              if (bn.includes("ROLLBACK"))    badges.push("Rollback")
            }
            if (item.isBestSeller) badges.push("Best Seller")

            results.push({ asin: itemId, product_name: name, category: cat, rank: idx + 1, price, rating, review_count, image_url, product_url: productUrl, badge: badges.length ? [...new Set(badges)].join(",") : null, brand })
          })
          return results
        }
      }
    } catch (_) {}

    // ── Method 2: DOM fallback ─────────────────────────────────────────────────
    const links = Array.from(document.querySelectorAll("a[href*='/ip/']")) as HTMLAnchorElement[]
    const seen = new Set<string>()
    const unique = links.filter(a => {
      const k = a.href.split("?")[0]; if (seen.has(k)) return false; seen.add(k); return true
    }).slice(0, 60)

    unique.forEach((link, idx) => {
      const card = link.closest("[data-item-id]") ?? link.closest("article") ?? link.closest("li") ?? link.parentElement
      if (!card) return
      const nameEl = card.querySelector("[data-automation-id='product-title']") ?? card.querySelector("span[class*='f6']") ?? link
      const product_name = (nameEl?.textContent ?? "").trim()
      if (!product_name || product_name.length < 3) return
      const m = link.href.match(/\/ip\/(?:[^/]*\/)?(\d+)/)
      const asin = m?.[1] ?? null
      let price: number | null = null
      const priceEl = card.querySelector("[itemprop='price']") as HTMLElement | null
      if (priceEl) { const raw = priceEl.getAttribute("content") ?? priceEl.textContent?.replace(/[^\d.]/g, "") ?? ""; const n = parseFloat(raw); if (isFinite(n) && n > 0) price = n }
      if (!price) {
        const w = document.createTreeWalker(card, NodeFilter.SHOW_TEXT)
        let node: Text | null
        while ((node = w.nextNode() as Text | null)) {
          const t = node.textContent?.trim() ?? ""
          if (t.startsWith("$") && t.length < 12) { const n = parseFloat(t.replace(/[^\d.]/g, "")); if (isFinite(n) && n > 0) { price = n; break } }
        }
      }
      let rating: number | null = null; let review_count: number | null = null
      const ratingEl = card.querySelector("[aria-label*='Stars'], [aria-label*='stars'], [aria-label*='star']")
      if (ratingEl) { const lbl = ratingEl.getAttribute("aria-label") ?? ""; const rm = lbl.match(/(\d[\d.]+)\s*out of/); if (rm) rating = parseFloat(rm[1]); const rv = lbl.match(/,\s*([\d,]+)\s*review/i); if (rv) review_count = parseInt(rv[1].replace(/,/g, ""), 10) }
      const imgEl = card.querySelector("img") as HTMLImageElement | null
      results.push({ asin, product_name, category: cat, rank: idx + 1, price, rating, review_count, image_url: imgEl?.src ?? null, product_url: link.href.split("?")[0], badge: null, brand: null })
    })

    return results
  }, category)

  logger.info("[WalmartScraper] Extracted", { category, count: products.length })
  return products.map(p => ({ ...p, marketplace: "Walmart" }))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeWalmartBestSellers(opts: {
  category?:  string
  limit?:     number
}): Promise<AmazonProduct[]> {
  const { category = "All", limit = 100 } = opts

  const targets = category === "All"
    ? WMT_CATEGORIES
    : WMT_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[WalmartScraper] No matching category", { category })
    return []
  }

  logger.info("[WalmartScraper] Starting walmart.com scrape", { categories: targets.map(t => t.label) })

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-web-security",
    ],
  })

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale:    "en-US",
    timezoneId: "America/New_York",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "sec-ch-ua":       '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "sec-ch-ua-platform": '"Windows"',
    },
  })

  // Hide webdriver fingerprint
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined })
  })

  const page = await context.newPage()

  await page.route("**/*", route => {
    const type = route.request().resourceType()
    if (["media", "font", "websocket"].includes(type)) route.abort()
    else route.continue()
  })

  const allProducts: AmazonProduct[] = []

  try {
    for (const target of targets) {
      logger.info("[WalmartScraper] Scraping", { label: target.label })
      const products = await scrapeCategoryPage(target.url, target.label, page)
      allProducts.push(...products)
      await page.waitForTimeout(3000 + Math.random() * 2000)
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

  logger.info("[WalmartScraper] Complete", { total: dedup.length })
  return dedup.slice(0, limit)
}
