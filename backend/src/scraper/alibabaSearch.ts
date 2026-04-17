/**
 * AliExpress Sourcing Search — plain HTTPS scraper.
 *
 * On-demand search: given a product query, finds cheap suppliers on AliExpress.
 * Results returned directly — not stored to DB (ephemeral per search).
 * Extracts product data from window.runParams embedded in the page source.
 */

import https  from "https"
import { logger } from "../utils/logger"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlibabaProduct {
  title:       string
  image_url:   string | null
  price_min:   number | null
  price_max:   number | null
  currency:    string
  orders:      number | null
  seller:      string | null
  product_url: string
  platform:    "aliexpress"
}

// ─── Plain HTTPS GET ──────────────────────────────────────────────────────────

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
      },
    }, res => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        httpsGet(res.headers.location).then(resolve).catch(reject)
        return
      }
      if ((res.statusCode ?? 0) >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on("data", (c: Buffer) => chunks.push(c))
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    })
    req.on("error", reject)
    req.setTimeout(20_000, () => { req.destroy(); reject(new Error("timeout")) })
  })
}

// ─── Extract window.runParams from page source ────────────────────────────────

function extractRunParams(html: string): any | null {
  // AliExpress embeds all product data in window.runParams = {...};
  const patterns = [
    /window\.runParams\s*=\s*(\{[\s\S]{50,80000}?\})\s*;\s*window\./,
    /window\.runParams\s*=\s*(\{[\s\S]{50,80000}?\})\s*;<\/script>/,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (!m) continue
    try { return JSON.parse(m[1]) } catch { continue }
  }
  return null
}

// ─── Parse product list from runParams ────────────────────────────────────────

function parseProducts(runParams: any): AlibabaProduct[] {
  const results: AlibabaProduct[] = []

  // Navigate through the nested structure (varies by AliExpress version)
  const mods: any =
    runParams?.data?.result?.mods ??
    runParams?.mods               ??
    {}

  const items: any[] =
    mods?.itemList?.content ??
    mods?.list?.content     ??
    runParams?.data?.searchResult?.resultList ??
    []

  for (const item of items.slice(0, 40)) {
    const title: string = item.title ?? item.name ?? item.subject ?? ""
    if (!title) continue

    // Price
    const priceInfo = item.prices?.salePrice ?? item.price ?? item.salePrice ?? {}
    const rawMin = priceInfo.minAmount ?? priceInfo.price ?? priceInfo.value ?? null
    const rawMax = priceInfo.maxAmount ?? null
    const price_min: number | null = rawMin != null ? parseFloat(String(rawMin)) || null : null
    const price_max: number | null = rawMax != null ? parseFloat(String(rawMax)) || null : price_min
    const currency = priceInfo.currencyCode ?? priceInfo.currency ?? "USD"

    // Image
    const imgRaw: string = item.image?.imgUrl ?? item.imageUrl ?? item.image ?? ""
    const image_url = imgRaw
      ? (imgRaw.startsWith("//") ? `https:${imgRaw}` : imgRaw.startsWith("http") ? imgRaw : null)
      : null

    // Orders / sold count
    let orders: number | null = null
    const tradeStr: string = item.trade?.realTradeDesc ?? item.trade?.tradeDesc ?? item.tradeDesc ?? ""
    const tradeMatch = tradeStr.replace(/[,+]/g, "").match(/(\d+)/)
    if (tradeMatch) orders = parseInt(tradeMatch[1], 10)

    // Seller
    const seller: string | null =
      item.storeInfo?.storeName ??
      item.store?.storeName     ??
      item.sellerInfo?.storeName ??
      null

    // URL
    const urlRaw: string = item.productDetailUrl ?? item.detailUrl ?? item.productUrl ?? ""
    const product_url = urlRaw.startsWith("//")
      ? `https:${urlRaw}`
      : urlRaw.startsWith("http")
        ? urlRaw
        : `https://www.aliexpress.com/item/${item.productId ?? item.id}.html`

    results.push({
      title,
      image_url,
      price_min,
      price_max,
      currency,
      orders,
      seller,
      product_url,
      platform: "aliexpress",
    })
  }

  return results
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchAliexpress(query: string): Promise<AlibabaProduct[]> {
  const encoded = encodeURIComponent(query)
  const url = `https://www.aliexpress.com/wholesale?SearchText=${encoded}&SortType=total_tranRanking_desc&page=1`

  logger.info("[AlibabaScraper] Searching AliExpress", { query })

  let html: string
  try {
    html = await httpsGet(url)
  } catch (err: any) {
    logger.warn("[AlibabaScraper] Fetch failed", { query, error: err.message })
    return []
  }

  // Bot detection check
  if (/captcha|robot|access.denied/i.test(html.slice(0, 5000))) {
    logger.warn("[AlibabaScraper] Bot challenge detected", { query })
    return []
  }

  const runParams = extractRunParams(html)
  if (!runParams) {
    logger.warn("[AlibabaScraper] No runParams found", { query, htmlLen: html.length })
    return []
  }

  const products = parseProducts(runParams)
  logger.info("[AlibabaScraper] Done", { query, count: products.length })
  return products
}
