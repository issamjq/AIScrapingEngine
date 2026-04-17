/**
 * AliExpress Best Sellers — Playwright scraper.
 *
 * Scrapes aliexpress.com category pages sorted by total orders (best selling).
 * Extracts product data from window.runParams embedded in the page.
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

// ─── Extract products from window.runParams (AliExpress embeds all data here) ─

function parseRunParams(runParams: any, category: string, baseIdx: number): AmazonProduct[] {
  const results: AmazonProduct[] = []

  const mods: any =
    runParams?.data?.result?.mods ??
    runParams?.mods               ??
    {}

  const items: any[] =
    mods?.itemList?.content      ??
    mods?.list?.content          ??
    runParams?.data?.searchResult?.resultList ??
    []

  items.slice(0, 48).forEach((item: any, idx: number) => {
    const title: string = item.title ?? item.subject ?? item.name ?? ""
    if (!title || title.length < 3) return

    // Price
    const priceInfo = item.prices?.salePrice ?? item.price ?? item.salePrice ?? {}
    const rawPrice  = priceInfo.minAmount ?? priceInfo.price ?? priceInfo.value ?? null
    const price: number | null = rawPrice != null ? parseFloat(String(rawPrice)) || null : null

    // Image
    const imgRaw: string = item.image?.imgUrl ?? item.imageUrl ?? item.image ?? ""
    const image_url = imgRaw
      ? (imgRaw.startsWith("//") ? `https:${imgRaw}` : imgRaw.startsWith("http") ? imgRaw : null)
      : null

    // Orders / sold count
    let review_count: number | null = null
    const tradeStr: string = item.trade?.realTradeDesc ?? item.trade?.tradeDesc ?? item.tradeDesc ?? ""
    const tm = tradeStr.replace(/[,+]/g, "").match(/(\d+)/)
    if (tm) review_count = parseInt(tm[1], 10)

    // Seller
    const brand: string | null =
      item.storeInfo?.storeName  ??
      item.store?.storeName      ??
      item.sellerInfo?.storeName ??
      null

    // URL + product ID
    const urlRaw: string = item.productDetailUrl ?? item.detailUrl ?? item.productUrl ?? ""
    const product_url = urlRaw.startsWith("//")
      ? `https:${urlRaw}`
      : urlRaw.startsWith("http")
        ? urlRaw
        : `https://www.aliexpress.com/item/${item.productId ?? item.id}.html`

    const productId = String(item.productId ?? item.id ?? "").trim() || null

    results.push({
      asin:         productId,
      product_name: title,
      category,
      rank:         baseIdx + idx + 1,
      price,
      rating:       item.evaluation?.starRating != null ? parseFloat(item.evaluation.starRating) : null,
      review_count,
      image_url,
      product_url,
      badge:        review_count && review_count >= 1000 ? "Best Seller" : null,
      brand,
      marketplace:  "Alibaba",
    })
  })

  return results
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
  if (/captcha|robot|access.denied|verify you/i.test(bodyText)) {
    logger.warn("[AlibabaScraper] Bot challenge detected", { query })
    return []
  }

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

      const priceInfo = item.prices?.salePrice ?? item.price ?? {}
      const rawPrice  = priceInfo.minAmount ?? priceInfo.price ?? null
      const price: number | null = rawPrice != null ? parseFloat(String(rawPrice)) || null : null

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
        asin:         String(item.productId ?? item.id ?? "").trim() || null,
        product_name: title,
        category:     cat,
        rank:         idx + 1,
        price,
        rating:       item.evaluation?.starRating != null ? parseFloat(item.evaluation.starRating) : null,
        review_count,
        image_url,
        product_url,
        badge:        review_count && review_count >= 1000 ? "Best Seller" : null,
        brand,
        marketplace:  "Alibaba",
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

    const cards = Array.from(document.querySelectorAll(
      "[data-item-id], [class*='SearchCard'], .search-card-item, [class*='product-item']"
    )).filter(el => el.querySelector("a[href*='aliexpress.com/item'], a[href*='/item/']"))

    if (cards.length === 0) {
      // Ultra fallback: all links to items
      const links = Array.from(document.querySelectorAll("a[href*='/item/']"))
        .map(a => a.closest("li, div[class]") ?? a.parentElement ?? a)
        .filter((el, i, arr) => arr.indexOf(el) === i)
      cards.push(...links)
    }

    cards.slice(0, 48).forEach((el, idx) => {
      const linkEl = el.querySelector("a[href*='/item/']") as HTMLAnchorElement | null
      const href   = linkEl?.href ?? linkEl?.getAttribute("href") ?? ""
      const product_url = href.startsWith("//") ? `https:${href}` : href
      const productId = href.match(/\/item\/(\d+)/)?.[1] ?? null

      const titleEl = el.querySelector("h3, h2, [class*='title'], [class*='Title']")
      const product_name = titleEl?.textContent?.trim() ?? ""
      if (!product_name) return

      let price: number | null = null
      for (const pe of Array.from(el.querySelectorAll("[class*='price'], [class*='Price']"))) {
        const raw = pe.textContent?.replace(/[^\d.]/g, "") ?? ""
        const n   = parseFloat(raw)
        if (isFinite(n) && n > 0 && n < 50000) { price = n; break }
      }

      const imgEl    = el.querySelector("img")
      const image_url = imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-src") ?? null

      const tradeEl  = el.querySelector("[class*='trade'], [class*='order'], [class*='sold']")
      let review_count: number | null = null
      if (tradeEl) {
        const m = (tradeEl.textContent ?? "").replace(/,/g, "").match(/(\d+)/)
        if (m) review_count = parseInt(m[1], 10)
      }

      const brandEl = el.querySelector("[class*='store'], [class*='shop']")
      const brand   = brandEl?.textContent?.trim() || null

      results.push({ asin: productId, product_name, category: cat, rank: idx + 1, price, rating: null, review_count, image_url, product_url, badge: null, brand, marketplace: "Alibaba" })
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
