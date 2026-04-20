/**
 * AliExpress Best Sellers — Playwright scraper.
 *
 * Scrapes aliexpress.com category pages sorted by total orders (best selling).
 * Extracts product data from window.runParams embedded in the page.
 * Data stored in amazon_trending with marketplace = "Alibaba".
 *
 * If LOCAL_SCRAPER_URL env var is set, delegates to the local home-PC server
 * (residential IP) instead of running Playwright on Render (datacenter IP blocked).
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
  if (/captcha|robot|access.denied|verify you/i.test(bodyText)) {
    logger.warn("[AlibabaScraper] Bot challenge detected", { query })
    return []
  }

  // Scroll to trigger lazy-loaded product cards, then return to top
  try {
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, 1200))
      await page.waitForTimeout(600)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(2000)
  } catch { /* ignore */ }

  // Try window.runParams first (AliExpress embeds all product data here)
  const products = await page.evaluate((cat: string) => {
    const rp = (window as any).runParams
    if (!rp) return null

    const mods: any = rp?.data?.result?.mods ?? rp?.mods ?? {}
    const items: any[] = mods?.itemList?.content ?? mods?.list?.content ?? []
    if (items.length === 0) return null

    return items.slice(0, 48).map((item: any, idx: number) => {
      const title: string = item.title ?? item.subject ?? ""
      if (!title) return null

      const saleInfo     = item.prices?.salePrice ?? item.price ?? {}
      const originalInfo = item.prices?.originalPrice ?? {}
      const rawPrice     = saleInfo.minAmount ?? saleInfo.price ?? null
      const rawOriginal  = originalInfo.minAmount ?? originalInfo.price ?? null
      const price: number | null          = rawPrice    != null ? parseFloat(String(rawPrice))    || null : null
      const origPrice: number | null      = rawOriginal != null ? parseFloat(String(rawOriginal)) || null : null
      const original_price: number | null = origPrice && price && origPrice > price ? origPrice : null

      const imgRaw: string = item.image?.imgUrl ?? item.imageUrl ?? ""
      const image_url = imgRaw ? (imgRaw.startsWith("//") ? `https:${imgRaw}` : imgRaw) : null

      const tradeStr: string = item.trade?.realTradeDesc ?? item.trade?.tradeDesc ?? ""
      const tm = tradeStr.replace(/[,+]/g, "").match(/(\d+)/)
      const review_count: number | null = tm ? parseInt(tm[1], 10) : null

      const brand: string | null = item.storeInfo?.storeName ?? item.store?.storeName ?? null

      const urlRaw: string = item.productDetailUrl ?? item.detailUrl ?? ""
      const product_url = urlRaw.startsWith("//") ? `https:${urlRaw}` : urlRaw.startsWith("http") ? urlRaw
        : `https://www.aliexpress.com/item/${item.productId ?? ""}.html`

      return {
        asin:           String(item.productId ?? item.id ?? "").trim() || null,
        product_name:   title,
        category:       cat,
        rank:           idx + 1,
        price,
        original_price,
        rating:         item.evaluation?.starRating != null ? parseFloat(item.evaluation.starRating) : null,
        review_count,
        image_url,
        product_url,
        badge:          review_count && review_count >= 1000 ? "Best Seller" : null,
        brand,
        marketplace:    "Alibaba",
      }
    }).filter(Boolean)
  }, category) as AmazonProduct[] | null

  if (products && products.length > 0) {
    logger.info("[AlibabaScraper] runParams hit", { query: category, count: products.length })
    return products
  }

  // Fallback: DOM extraction for product cards
  const domProducts = await page.evaluate((cat: string) => {
    const results: any[] = []

    let cards: Element[] = Array.from(document.querySelectorAll(
      "a[class*='search-card-item'], [class*='search-item-card-wrapper-gallery'], [data-item-id]"
    ))

    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll("a[href*='/item/']"))
        .map(a => a.closest("li, [class*='card'], [class*='item']") ?? a.parentElement ?? a)
        .filter((el, i, arr) => arr.indexOf(el) === i)
    }

    cards.slice(0, 48).forEach((el, idx) => {
      const linkEl = (
        el.tagName === "A" ? el : el.querySelector("a[href*='/item/']")
      ) as HTMLAnchorElement | null
      const href = linkEl?.href ?? linkEl?.getAttribute("href") ?? ""
      if (!href.includes("/item/")) return
      const product_url = href.startsWith("//") ? `https:${href}` : href
      const productId = href.match(/\/item\/(\d+)/)?.[1] ?? null

      const titleEl = el.querySelector("h3, h2, [class*='title'], [class*='Title'], [class*='name']")
      const product_name = (titleEl?.textContent ?? linkEl?.getAttribute("title") ?? "").trim()
      if (!product_name || product_name.length < 3) return

      // AliExpress class convention: [component]--current--[hash] = sale price
      //                               [component]--del--[hash] or --origin = crossed-out original
      const parsePrice = (el: Element | null): number | null => {
        if (!el) return null
        const t = (el.textContent ?? "").replace(/[^\d.]/g, "")
        const n = parseFloat(t)
        return isFinite(n) && n > 0.01 && n < 50000 ? n : null
      }

      const currentEl   = el.querySelector("[class*='--current--'], [class*='price-current'], [class*='sale-price']")
      const originalEl  = el.querySelector("[class*='--del--'], [class*='--origin'], [class*='price-origin'], [class*='price-del'], [class*='old-price'], del")

      let price: number | null          = parsePrice(currentEl)
      let original_price: number | null = parsePrice(originalEl)

      // Fallback: CSS strikethrough detection if class selectors found nothing
      if (price === null) {
        const salePrices: number[] = []
        const strikePrices: number[] = []
        for (const node of Array.from(el.querySelectorAll("*"))) {
          if (node.children.length > 0) continue
          const t = (node.textContent ?? "").trim()
          if (!/^\$[\d,]+\.?\d{0,2}$|^US\$[\d,]+/.test(t)) continue
          const n = parseFloat(t.replace(/[^\d.]/g, ""))
          if (!isFinite(n) || n <= 0.01 || n >= 50000) continue
          const style = window.getComputedStyle(node as Element)
          const isStrike = style.textDecoration.includes("line-through") ||
                           style.textDecorationLine.includes("line-through")
          if (isStrike) strikePrices.push(n); else salePrices.push(n)
        }
        price          = salePrices.length > 0 ? Math.min(...salePrices)
                       : strikePrices.length > 0 ? Math.min(...strikePrices) : null
        original_price = strikePrices.length > 0 && salePrices.length > 0
                       ? Math.max(...strikePrices) : null
      }

      // Sanity check — original must be higher than sale
      if (original_price !== null && price !== null && original_price <= price) original_price = null

      const imgEl     = el.querySelector("img")
      const image_url = imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-src") ?? null

      let review_count: number | null = null
      const tradeEl = el.querySelector("[class*='trade'], [class*='order'], [class*='sold']")
      if (tradeEl) {
        const m = (tradeEl.textContent ?? "").replace(/,/g, "").match(/(\d+)/)
        if (m) review_count = parseInt(m[1], 10)
      }

      const brandEl = el.querySelector("[class*='store'], [class*='shop']")
      const brand   = brandEl?.textContent?.trim() || null

      results.push({
        asin:           productId,
        product_name,
        category:       cat,
        rank:           idx + 1,
        price,
        original_price,
        rating:         null,
        review_count,
        image_url,
        product_url,
        badge:          null,
        brand,
        marketplace:    "Alibaba",
      })
    })
    return results
  }, category)

  logger.info("[AlibabaScraper] DOM fallback", { query: category, count: domProducts.length })
  return domProducts
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
        { method: "POST", signal: AbortSignal.timeout(300_000) }  // 5 min timeout
      )
      if (!resp.ok) throw new Error(`Local scraper responded ${resp.status}`)
      const data = await resp.json() as { products: AmazonProduct[] }
      logger.info("[AlibabaScraper] Local scraper returned", { count: data.products.length })
      return data.products
    } catch (err: any) {
      logger.error("[AlibabaScraper] Local scraper failed, falling back", { error: err.message })
      // Falls through to Playwright below
    }
  }

  const targets = category === "All"
    ? ALIBABA_CATEGORIES
    : ALIBABA_CATEGORIES.filter(c => c.label.toLowerCase().includes(category.toLowerCase()))

  if (targets.length === 0) {
    logger.warn("[AlibabaScraper] No matching category", { category })
    return []
  }

  logger.info("[AlibabaScraper] Starting scrape", { categories: targets.map(t => t.label) })

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })
  const context = await browser.newContext({
    userAgent:        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale:           "en-US",
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
