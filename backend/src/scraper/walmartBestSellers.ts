/**
 * Walmart.com Best Sellers — Playwright scraper.
 *
 * Navigates category browse pages on walmart.com, extracts the first page
 * of products (sorted by best-match / popularity).
 * Returns the same AmazonProduct shape so it can be stored in amazon_trending
 * with marketplace = "Walmart".
 *
 * Primary extraction: Walmart embeds a __NEXT_DATA__ JSON blob in every page —
 * much more reliable than fragile CSS selectors.
 * Fallback: DOM selector scan if JSON path misses.
 */

import { chromium } from "playwright"
import { logger }   from "../utils/logger"
import { AmazonProduct } from "./amazonBestSellers"

// ─── Walmart category URLs ────────────────────────────────────────────────────

const WMT_CATEGORIES: { label: string; url: string }[] = [
  { label: "Electronics",    url: "https://www.walmart.com/browse/electronics/3944" },
  { label: "Beauty",         url: "https://www.walmart.com/browse/beauty/1085666" },
  { label: "Home & Kitchen", url: "https://www.walmart.com/browse/home/4044" },
  { label: "Health",         url: "https://www.walmart.com/browse/health/976760" },
  { label: "Sports & Outdoors", url: "https://www.walmart.com/browse/sports-outdoors/4125" },
  { label: "Toys & Games",   url: "https://www.walmart.com/browse/toys/4171" },
  { label: "Fashion",        url: "https://www.walmart.com/browse/clothing/5438" },
  { label: "Baby",           url: "https://www.walmart.com/browse/baby/5427" },
  { label: "Food & Grocery", url: "https://www.walmart.com/browse/food/976759" },
  { label: "Pet Supplies",   url: "https://www.walmart.com/browse/pets/5440" },
]

// ─── Scrape one Walmart category page ────────────────────────────────────────

async function scrapeCategoryPage(
  url:      string,
  category: string,
  page:     import("playwright").Page
): Promise<AmazonProduct[]> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35_000 })
    await page.waitForTimeout(2500)
  } catch (err: any) {
    logger.warn("[WalmartScraper] Page load failed", { url, error: err.message })
    return []
  }

  const products = await page.evaluate((cat: string) => {
    const results: any[] = []

    // ── Method 1: __NEXT_DATA__ JSON blob (most reliable) ─────────────────────
    try {
      const scriptEl = document.getElementById("__NEXT_DATA__")
      if (scriptEl?.textContent) {
        const nd = JSON.parse(scriptEl.textContent)

        // Walmart's category page data lives under several possible paths
        const searchResult =
          nd?.props?.pageProps?.initialData?.searchResult    ??
          nd?.props?.pageProps?.initialData?.contentLayout   ??
          nd?.props?.pageProps?.initialData?.browse          ??
          null

        // Items can be in different shapes depending on page type
        let rawItems: any[] = []

        // Standard search/browse result
        if (searchResult?.itemStacks) {
          for (const stack of searchResult.itemStacks) {
            if (Array.isArray(stack?.items)) rawItems.push(...stack.items)
          }
        }
        // Some pages use a modules array
        if (rawItems.length === 0 && searchResult?.modules) {
          for (const mod of searchResult.modules) {
            if (mod?.type === "ITEM_LIST" && Array.isArray(mod?.items)) rawItems.push(...mod.items)
          }
        }

        if (rawItems.length > 0) {
          rawItems.slice(0, 60).forEach((item: any, idx: number) => {
            if (!item) return
            const name: string = item.name ?? item.title ?? ""
            if (!name) return

            const itemId: string | null = item.usItemId ?? item.itemId ?? null
            const productUrl = itemId
              ? `https://www.walmart.com/ip/${itemId}`
              : (item.canonicalUrl ? `https://www.walmart.com${item.canonicalUrl}` : null)

            const price: number | null = (() => {
              const cp = item.priceInfo?.currentPrice?.price ?? item.price?.currentPrice ?? item.priceInfo?.price
              if (cp != null) return Number(cp)
              return null
            })()

            const rating:       number | null = item.averageRating       != null ? Number(item.averageRating) : null
            const review_count: number | null = item.numberOfReviews     != null ? Number(item.numberOfReviews) : null
            const brand:        string | null = item.brand               ?? null
            const image_url:    string | null =
              item.imageInfo?.thumbnailUrl ??
              item.imageUrl                ??
              (Array.isArray(item.imageInfo?.allImages) ? item.imageInfo.allImages[0]?.url : null) ??
              null

            // Walmart Best Sellers badge
            const badges: string[] = []
            if (item.isBestSeller || item.badges?.groups?.some((g: any) => g?.name === "BEST_SELLER")) {
              badges.push("Best Seller")
            }
            if (item.isTopRated || item.badges?.groups?.some((g: any) => /top.rated/i.test(g?.name ?? ""))) {
              badges.push("Top Rated")
            }
            const badge = badges.length ? badges.join(",") : null

            results.push({
              asin:         itemId,
              product_name: name,
              category:     cat,
              rank:         idx + 1,
              price,
              rating,
              review_count,
              image_url,
              product_url:  productUrl,
              badge,
              brand,
            })
          })
          return results   // JSON extraction succeeded
        }
      }
    } catch (_) { /* fall through to DOM */ }

    // ── Method 2: DOM selector fallback ──────────────────────────────────────
    // Walmart product cards vary across page types — try several patterns
    const cardSelectors = [
      "[data-automation-id='product-title']",
      "a[link-identifier]",
      "[data-testid='list-view'] a[href*='/ip/']",
      "a[href*='/ip/']",
    ]

    let links: HTMLAnchorElement[] = []
    for (const sel of cardSelectors) {
      const found = Array.from(document.querySelectorAll(sel)) as HTMLAnchorElement[]
      if (found.length >= 3) { links = found; break }
    }

    // Deduplicate by href
    const seen = new Set<string>()
    const unique = links.filter(a => {
      const k = a.href.split("?")[0]
      if (seen.has(k)) return false
      seen.add(k)
      return true
    }).slice(0, 60)

    unique.forEach((link, idx) => {
      const card = link.closest("[data-item-id]") ?? link.closest("article") ?? link.closest("li") ?? link.parentElement
      if (!card) return

      // Product name
      const nameEl =
        card.querySelector("[data-automation-id='product-title']") ??
        card.querySelector("[class*='f6']") ??
        card.querySelector("span[class*='normal']") ??
        link
      const product_name = (nameEl?.textContent ?? link.textContent ?? "").trim()
      if (!product_name) return

      // Item ID from URL: /ip/Name/ITEMID
      const m = link.href.match(/\/ip\/[^/]*\/(\d+)/)
      const asin = m?.[1] ?? card.getAttribute("data-item-id") ?? null

      // Price: prefer itemprop="price" content attribute, then visible text
      let price: number | null = null
      const priceEl = card.querySelector("[itemprop='price']") as HTMLElement | null
      if (priceEl) {
        const raw = priceEl.getAttribute("content") ?? priceEl.textContent?.replace(/[^\d.]/g, "") ?? ""
        const n = parseFloat(raw)
        if (isFinite(n) && n > 0) price = n
      }
      if (!price) {
        // Walk text nodes for $ value
        const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT)
        let node: Text | null
        while ((node = walker.nextNode() as Text | null)) {
          const t = node.textContent?.trim() ?? ""
          if (t.startsWith("$") && t.length < 12) {
            const n = parseFloat(t.replace(/[^\d.]/g, ""))
            if (isFinite(n) && n > 0) { price = n; break }
          }
        }
      }

      // Rating from aria-label like "4.5 out of 5 Stars"
      let rating: number | null = null
      let review_count: number | null = null
      const ratingEl = card.querySelector("[aria-label*='Stars'], [aria-label*='stars'], [aria-label*='star']")
      if (ratingEl) {
        const lbl = ratingEl.getAttribute("aria-label") ?? ""
        const rm  = lbl.match(/(\d[\d.]+)\s*out of/)
        if (rm) rating = parseFloat(rm[1])
        const rv  = lbl.match(/,\s*([\d,]+)\s*review/i)
        if (rv) review_count = parseInt(rv[1].replace(/,/g, ""), 10)
      }

      // Image
      const imgEl   = card.querySelector("img") as HTMLImageElement | null
      const image_url = imgEl?.src ?? imgEl?.getAttribute("data-src") ?? null

      results.push({
        asin,
        product_name,
        category:     cat,
        rank:         idx + 1,
        price,
        rating,
        review_count,
        image_url,
        product_url:  link.href.split("?")[0],
        badge:        null,
        brand:        null,
      })
    })

    return results
  }, category)

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
    ],
  })

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale:    "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  })

  const page = await context.newPage()

  // Block heavy resources to speed up scraping
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
      logger.info("[WalmartScraper] Done", { label: target.label, found: products.length })
      allProducts.push(...products)
      await page.waitForTimeout(2500 + Math.random() * 1500)
    }
  } finally {
    await browser.close()
  }

  // Deduplicate by item ID (asin field)
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
