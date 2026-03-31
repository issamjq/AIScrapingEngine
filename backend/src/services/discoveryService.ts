import { query } from "../db"
import { ScraperEngine } from "../scraper/engine"
import { getSearchConfig } from "../scraper/searchConfigs"
import { fuzzyMatch } from "./matchingService"
import { extractWithVision, extractImageUrl } from "../scraper/aiScraper"
import { logger } from "../utils/logger"

// ── Website Probe ─────────────────────────────────────────────────

const SEARCH_PATTERNS = [
  "/search?q={query}",
  "/search/?q={query}",
  "/catalogsearch/result/?q={query}",
  "/en/catalogsearch/result/?q={query}",
  "/en/search?q={query}",
  "/?s={query}&post_type=product",
  "/search?keyword={query}",
  "/search?text={query}",
]

async function trySearchPattern(engine: ScraperEngine, url: string) {
  const context = await engine.browser!.newContext({
    userAgent:  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale:     "en-AE",
    timezoneId: "Asia/Dubai",
    viewport:   { width: 1366, height: 768 },
  })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false })
    ;(window as any).chrome = { runtime: {} }
  })
  await context.route("**/*", (route: any) => {
    if (["image", "font", "media"].includes(route.request().resourceType())) route.abort()
    else route.continue()
  })
  const page = await context.newPage()
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(1500)

    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).map((a) => ({
        text: ((a as HTMLAnchorElement).textContent || "").replace(/\s+/g, " ").trim(),
        href: (a as HTMLAnchorElement).href,
      }))
    ).catch(() => [] as any[])

    const seen = new Set<string>(), products: any[] = []
    for (const l of links) {
      if (!l.text || l.text.length < 4) continue
      if (!l.href || !l.href.startsWith("http")) continue
      if (l.href.includes("#")) continue
      try {
        const u = new URL(l.href)
        const p = u.pathname.toLowerCase()
        if (p.match(/\/(login|signup|cart|checkout|account|wishlist|category|categories|blog|contact|about|policy|faq)\b/)) continue
        const key = u.origin + u.pathname
        if (seen.has(key)) continue
        seen.add(key)
        products.push({ name: l.text.slice(0, 120), url: key })
      } catch { continue }
    }
    return { found: products.length, sample: products.slice(0, 5) }
  } finally {
    await context.close()
  }
}

export async function probeWebsite(baseUrl: string, testQuery = "shampoo") {
  const base   = baseUrl.replace(/\/$/, "")
  const engine = new ScraperEngine()
  try {
    await engine.launch()
    for (const pattern of SEARCH_PATTERNS) {
      const url = base + pattern.replace("{query}", encodeURIComponent(testQuery))
      logger.info("[Probe] Trying pattern", { pattern, url })
      try {
        const result = await trySearchPattern(engine, url)
        if (result.found >= 3) {
          return { success: true, search_url_template: base + pattern, pattern, products_found: result.found, sample: result.sample }
        }
      } catch (err: any) {
        logger.debug("[Probe] Pattern failed", { pattern, error: err.message })
      }
    }
    return { success: false, message: "Could not detect a working search URL." }
  } finally {
    await engine.close()
  }
}

// ── Claude extract + match ────────────────────────────────────────

async function claudeExtractAndMatch(
  pageLinks: any[],
  catalog: any[],
  apiKey: string,
  companyName: string,
  productUrlPattern: RegExp | null,
  screenshotBase64: string | null = null
) {
  const catalogText = catalog.map((p) => `${p.id}: ${p.internal_name}`).join("\n")
  const usefulLinks = pageLinks
    .filter((l) => {
      if (!l.text || l.text.length < 4) return false
      if (!l.href || !l.href.startsWith("http")) return false
      if (productUrlPattern && !productUrlPattern.test(l.href)) return false
      return true
    })
    .slice(0, 400)

  if (usefulLinks.length === 0) return []

  const linksText = usefulLinks.map((l: any, i: number) => `${i}: "${l.text}" → ${l.href}`).join("\n")
  const prompt =
    `You are matching product links scraped from ${companyName} to an internal product catalog.\n\n` +
    `Internal catalog (id: name):\n${catalogText}\n\n` +
    `Product links found on the page (index: "text" → URL):\n${linksText}\n\n` +
    `Match each product link to the correct catalog entry. ` +
    `Return ONLY a JSON array: [{"i": 0, "catalog_id": 5, "confidence": 0.95}]\n` +
    `Only include entries where confidence >= 0.85. Strict matching: size + flavor must match exactly.`

  const messageContent = screenshotBase64
    ? [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: screenshotBase64 } },
        { type: "text",  text: `Screenshot of ${companyName} search page for visual verification.\n\n` + prompt },
      ]
    : prompt

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 2048, messages: [{ role: "user", content: messageContent }] }),
  })
  if (!response.ok) throw new Error(`Claude API ${response.status}`)

  const data    = await response.json()
  const rawText = data?.content?.[0]?.text || "[]"
  const jm      = rawText.match(/\[[\s\S]*\]/)
  if (!jm) return []

  const matches   = JSON.parse(jm[0])
  const idToProduct = Object.fromEntries(catalog.map((p: any) => [p.id, p]))

  return matches
    .filter((m: any) => typeof m.i === "number" && usefulLinks[m.i])
    .map((m: any) => {
      const link    = usefulLinks[m.i]
      const product = m.catalog_id ? idToProduct[m.catalog_id] : null
      return {
        found:  { name: link.text, url: link.href.split("?")[0] },
        match:  product ? { product, confidence: m.confidence } : null,
        method: "ai",
      }
    })
}

async function scrapeProductPrices(engine: ScraperEngine, matchResults: any[], currency: string, apiKey: string | undefined) {
  const toScrape = matchResults.filter((r) => r.match && r.found && r.found.url)
  if (!toScrape.length) return matchResults

  const out = matchResults.map((r) => ({ ...r, found: { ...r.found } }))
  const urlToIdx = new Map(matchResults.map((r, i) => [r.found.url, i]))

  for (let i = 0; i < toScrape.length; i += 3) {
    await Promise.all(
      toScrape.slice(i, i + 3).map(async (r) => {
        const context = await engine.browser!.newContext({
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          locale: "en-AE", timezoneId: "Asia/Dubai", viewport: { width: 1366, height: 768 },
        })
        const page = await context.newPage()
        try {
          await page.goto(r.found.url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {})
          await page.waitForTimeout(1500)
          const [priceData, imageUrl] = await Promise.all([
            apiKey ? extractWithVision(page, currency, apiKey).catch(() => null) : Promise.resolve(null),
            extractImageUrl(page).catch(() => null),
          ])
          const idx = urlToIdx.get(r.found.url)
          if (idx !== undefined) {
            out[idx].found.imageUrl       = imageUrl   || null
            out[idx].found.price          = priceData?.price         ?? null
            out[idx].found.original_price = priceData?.originalPrice ?? null
            out[idx].found.currency       = priceData?.currency      || currency
            out[idx].found.availability   = priceData?.availability  || "unknown"
          }
        } catch (err: any) {
          logger.warn("[Discovery] Product page scrape failed", { url: r.found.url, error: err.message })
        } finally {
          await context.close()
        }
      })
    )
  }
  return out
}

// ── discoverProducts ──────────────────────────────────────────────

export async function discoverProducts(companyId: number, searchQuery = "marvis") {
  const { rows: compRows } = await query(
    `SELECT id, name, slug, base_url, is_active FROM companies WHERE id = $1`, [companyId]
  )
  if (!compRows.length) { const err: any = new Error(`Company ${companyId} not found`); err.status = 404; throw err }
  const company = compRows[0]

  const { rows: catalog } = await query(
    `SELECT id, internal_name, internal_sku, brand FROM products WHERE is_active = true ORDER BY internal_name`
  )

  const config = getSearchConfig(company.slug, company.base_url)
  config._searchQuery = searchQuery

  const { rows: cfgRows } = await query(
    `SELECT page_options FROM company_configs WHERE company_id = $1`, [companyId]
  ).catch(() => ({ rows: [] }))
  const customSearchTemplate = cfgRows[0]?.page_options?.search_url_template

  const searchUrl = typeof config.resolveUrl === "function"
    ? config.resolveUrl(searchQuery)
    : (customSearchTemplate || config.searchUrl)
        .replace("{query}", encodeURIComponent(searchQuery))
        .replace("{website_url}", company.base_url || "")

  logger.info("[Discovery] Loading page", { company: company.name, url: searchUrl })

  const engine = new ScraperEngine()
  let matchResults: any[] = []

  try {
    await engine.launch()

    const context = await engine.browser!.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "en-AE", timezoneId: "Asia/Dubai", viewport: { width: 1366, height: 768 },
    })
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false })
      ;(window as any).chrome = { runtime: {} }
    })
    if (config.blockResources?.length) {
      await context.route("**/*", (route: any) => {
        if (config.blockResources.includes(route.request().resourceType())) route.abort()
        else route.continue()
      })
    }
    const page = await context.newPage()
    await page.goto(searchUrl, config.pageOptions || { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {})
    if (config.waitForSelector) {
      await page.waitForSelector(config.waitForSelector, { timeout: 20000 }).catch(() => {})
    }
    if (typeof config.postLoad === "function") {
      await config.postLoad(page, searchUrl, searchQuery).catch(() => {})
    }

    const apiKey = process.env.ANTHROPIC_API_KEY

    if (apiKey) {
      const pageLinks = await page.evaluate(() =>
        Array.from(document.querySelectorAll("a[href]")).map((a) => ({
          text: ((a as HTMLAnchorElement).textContent || "").replace(/\s+/g, " ").trim(),
          href: (a as HTMLAnchorElement).href,
        }))
      ).catch(() => [] as any[])

      logger.info("[Discovery] Total links on page", { count: pageLinks.length })

      const pattern = config.productUrlPattern || null
      const preFiltered = pageLinks.filter((l: any) =>
        l.text && l.text.length >= 4 && l.href && l.href.startsWith("http") && (!pattern || pattern.test(l.href))
      )

      if (preFiltered.length > 0) {
        const screenshotBase64 = await page.screenshot({ type: "jpeg", quality: 70, fullPage: false })
          .then((buf: Buffer) => buf.toString("base64")).catch(() => null)
        matchResults = await claudeExtractAndMatch(pageLinks, catalog, apiKey, company.name, pattern, screenshotBase64)
      }
    } else {
      const extracted = await config.extractProducts(page, searchQuery)
      matchResults = extracted.map((found: any) => ({
        found,
        match:  fuzzyMatch(found.name, catalog),
        method: "fuzzy",
      }))
    }

    await context.close()

    if (matchResults.some((r: any) => r.match)) {
      matchResults = await scrapeProductPrices(engine, matchResults, "AED", apiKey)
    }
  } finally {
    await engine.close()
  }

  // Check already-tracked URLs
  let trackedSet = new Set<string>()
  const trackedUrlMap = new Map<string, any>()
  if (matchResults.length > 0) {
    const urls = matchResults.map((r: any) => r.found.url)
    const { rows } = await query(
      `SELECT id, product_id, company_id, product_url FROM product_company_urls
       WHERE company_id = $1 AND product_url = ANY($2::text[])`,
      [companyId, urls]
    )
    rows.forEach((r: any) => {
      trackedSet.add(r.product_url)
      trackedUrlMap.set(r.product_url, r)
    })
  }

  // Save fresh snapshots for already-tracked URLs
  for (const r of matchResults) {
    if (!trackedSet.has(r.found.url)) continue
    const tracked = trackedUrlMap.get(r.found.url)
    const price = r.found?.price ?? null
    if (!tracked || price === null) continue
    await query(
      `INSERT INTO price_snapshots
         (product_id, company_id, product_company_url_id,
          price, original_price, currency, availability,
          raw_price_text, scrape_status, checked_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'success',NOW(),NOW())`,
      [tracked.product_id, tracked.company_id, tracked.id, price,
       r.found.original_price || null, r.found.currency || "AED",
       r.found.availability || "unknown", String(price)]
    ).catch((err: any) => logger.warn("[Discovery] Snapshot failed", { err: err.message }))
  }

  const results = matchResults.map((r: any) => ({ ...r, already_tracked: trackedSet.has(r.found.url) }))
  logger.info("[Discovery] Done", { company: company.name, found: results.length, matched: results.filter((r: any) => r.match).length })

  return { company, results, total_found: results.length, query: searchQuery }
}

// ── confirmMappings ───────────────────────────────────────────────

export async function confirmMappings(companyId: number, mappings: any[]) {
  let added = 0
  for (const { product_id, url, image_url, price, original_price, currency, availability } of mappings) {
    const { rows } = await query(
      `INSERT INTO product_company_urls (product_id, company_id, product_url, image_url, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (product_id, company_id)
       DO UPDATE SET product_url = EXCLUDED.product_url,
                     image_url   = COALESCE(EXCLUDED.image_url, product_company_urls.image_url),
                     is_active   = true
       RETURNING id`,
      [product_id, companyId, url, image_url || null]
    )
    const urlId = rows[0]?.id
    if (urlId && price != null) {
      await query(
        `INSERT INTO price_snapshots
           (product_id, company_id, product_company_url_id,
            price, original_price, currency, availability,
            raw_price_text, scrape_status, checked_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'success',NOW(),NOW())
         ON CONFLICT DO NOTHING`,
        [product_id, companyId, urlId, price, original_price || null, currency || "AED", availability || "unknown", String(price)]
      ).catch((err: any) => logger.warn("[Discovery] Snapshot insert failed", { err: err.message }))
    }
    added++
  }
  logger.info("[Discovery] Confirmed mappings", { companyId, added })
  return { added }
}
