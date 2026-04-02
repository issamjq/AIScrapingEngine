import { chromium, Browser } from "playwright"
import { parsePrice, parseAvailability } from "./priceParser"
import { extractWithVision, extractImageUrl } from "./aiScraper"
import { logger } from "../utils/logger"

export interface ScrapeSelectors {
  price?:        string[]
  title?:        string[]
  availability?: string[]
  waitFor?:      string | null
  preferSelectors?: boolean
}

export interface ScrapeOptions {
  timeout?:        number
  currency?:       string
  pageOptions?:    Record<string, any>
  blockResources?: string[]
}

export interface ScrapeResult {
  success:             boolean
  title:               string | null
  price:               number | null
  originalPrice:       number | null
  currency:            string
  availability:        string
  imageUrl:            string | null
  rawPriceText:        string | null
  rawAvailabilityText: string | null
  scrapeStatus:        string
  errorMessage:        string | null
}

export class ScraperEngine {
  browser: Browser | null = null

  async launch() {
    if (this.browser) return
    logger.info("[Scraper] Launching browser...")
    this.browser = await chromium.launch({
      headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
    })
    logger.info("[Scraper] Browser ready")
  }

  async close() {
    if (this.browser) {
      logger.info("[Scraper] Closing browser")
      await this.browser.close()
      this.browser = null
    }
  }

  async scrape(url: string, selectors: ScrapeSelectors = {}, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    if (!this.browser) throw new Error("Engine not launched. Call engine.launch() first.")

    const timeout        = options.timeout || parseInt(process.env.SCRAPER_TIMEOUT_MS || "30000") || 30000
    const currency       = options.currency || "AED"
    const pageOptions    = { waitUntil: "domcontentloaded" as const, timeout, ...(options.pageOptions || {}) }
    const blockResources = options.blockResources || ["image", "font", "media"]

    const priceSelectors        = selectors.price        || []
    const titleSelectors        = selectors.title        || []
    const availabilitySelectors = selectors.availability || []
    const waitForSelector       = selectors.waitFor      || null
    const preferSelectors       = selectors.preferSelectors || false

    let context: any
    let page: any

    try {
      const userAgent = this._randomUserAgent()
      context = await this.browser.newContext({
        userAgent,
        locale:     "en-AE",
        timezoneId: "Asia/Dubai",
        viewport:   { width: 1366, height: 768 },
        extraHTTPHeaders: {
          "Accept-Language":           "en-AE,en-US;q=0.9,en;q=0.8",
          "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Encoding":           "gzip, deflate, br",
          "Cache-Control":             "no-cache",
          "Pragma":                    "no-cache",
          "Sec-Ch-Ua":                 "\"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\", \"Not-A.Brand\";v=\"99\"",
          "Sec-Ch-Ua-Mobile":          "?0",
          "Sec-Ch-Ua-Platform":        "\"Windows\"",
          "Sec-Fetch-Dest":            "document",
          "Sec-Fetch-Mode":            "navigate",
          "Sec-Fetch-Site":            "none",
          "Sec-Fetch-User":            "?1",
          "Upgrade-Insecure-Requests": "1",
        },
      })

      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver",           { get: () => false })
        Object.defineProperty(navigator, "plugins",             { get: () => [1, 2, 3, 4, 5] })
        Object.defineProperty(navigator, "languages",           { get: () => ["en-AE", "en-US", "en"] })
        Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 })
        Object.defineProperty(navigator, "deviceMemory",        { get: () => 8 })
        Object.defineProperty(navigator, "platform",            { get: () => "Win32" })
        ;(window as any).chrome = { runtime: {}, loadTimes: function(){}, csi: function(){}, app: {} }
        if ((window as any).Notification) {
          Object.defineProperty(Notification, "permission", { get: () => "default" })
        }
      })

      const aiApiKey = process.env.ANTHROPIC_API_KEY
      const resourcesToBlock = aiApiKey
        ? blockResources.filter((r) => r !== "image")
        : blockResources

      await context.route("**/*", (route: any) => {
        const type = route.request().resourceType()
        if (resourcesToBlock.includes(type)) route.abort()
        else route.continue()
      })

      page = await context.newPage()
      logger.debug("[Scraper] Navigating", { url, mode: aiApiKey ? "AI Vision" : "Selectors" })

      await page.goto(url, pageOptions).catch((err: any) => {
        logger.debug("[Scraper] goto timed out, extracting anyway", { url, error: err.message })
      })

      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 10000 }).catch(() => {
          logger.debug("[Scraper] waitForSelector timed out", { waitForSelector })
        })
      }

      let rawTitleText: string | null, rawPriceText: string | null, rawAvailabilityText: string | null
      let price: number | null, originalPrice: number | null, detectedCurrency: string, availability: string

      if (aiApiKey && !preferSelectors) {
        logger.info("[Scraper] Using Claude Vision for extraction", { url })
        const aiResult = await extractWithVision(page, currency, aiApiKey).catch((err: any) => {
          logger.warn("[Scraper] Vision failed, falling back to selectors", { error: err.message })
          return null
        })

        if (aiResult && aiResult.price !== null) {
          rawPriceText        = aiResult.rawPriceText
          rawTitleText        = aiResult.rawTitleText
          rawAvailabilityText = aiResult.rawAvailabilityText
          price               = aiResult.price
          originalPrice       = aiResult.originalPrice ?? null
          detectedCurrency    = aiResult.currency
          availability        = aiResult.availability
        } else {
          rawTitleText        = await this._extractFirst(page, titleSelectors)
          rawPriceText        = await this._extractFirst(page, priceSelectors)
          rawAvailabilityText = await this._extractFirst(page, availabilitySelectors)
          const parsed        = parsePrice(rawPriceText, currency)
          price               = parsed.price
          originalPrice       = null
          detectedCurrency    = parsed.currency
          availability        = parseAvailability(rawAvailabilityText)
        }
      } else {
        rawTitleText        = await this._extractFirst(page, titleSelectors)
        rawPriceText        = await this._extractFirst(page, priceSelectors)
        rawAvailabilityText = await this._extractFirst(page, availabilitySelectors)
        const parsed        = parsePrice(rawPriceText, currency)
        price               = parsed.price
        originalPrice       = null
        detectedCurrency    = parsed.currency
        availability        = parseAvailability(rawAvailabilityText)

        if (price === null && aiApiKey) {
          logger.info("[Scraper] Selectors found no price, trying Claude Vision fallback", { url })
          const aiResult = await extractWithVision(page, currency, aiApiKey).catch(() => null)
          if (aiResult && aiResult.price !== null) {
            rawPriceText        = aiResult.rawPriceText
            rawTitleText        = aiResult.rawTitleText        || rawTitleText
            rawAvailabilityText = aiResult.rawAvailabilityText || rawAvailabilityText
            price               = aiResult.price
            originalPrice       = aiResult.originalPrice ?? null
            detectedCurrency    = aiResult.currency
            availability        = aiResult.availability        || availability
          }
        }
      }

      const imageUrl = await extractImageUrl(page)
      await context.close()

      const result: ScrapeResult = {
        success:             true,
        title:               rawTitleText ? rawTitleText.trim().slice(0, 500) : null,
        price,
        originalPrice:       originalPrice || null,
        currency:            detectedCurrency,
        availability,
        imageUrl:            imageUrl || null,
        rawPriceText:        rawPriceText || null,
        rawAvailabilityText: rawAvailabilityText || null,
        scrapeStatus:        price !== null ? "success" : "no_price",
        errorMessage:        price === null ? "Price selector found no value" : null,
      }

      logger.info("[Scraper] Done", { url, price, currency: detectedCurrency, availability })
      return result

    } catch (err: any) {
      logger.error("[Scraper] Failed", { url, error: err.message })
      if (context) await context.close().catch(() => {})
      return {
        success:             false,
        title:               null,
        price:               null,
        originalPrice:       null,
        currency,
        availability:        "unknown",
        imageUrl:            null,
        rawPriceText:        null,
        rawAvailabilityText: null,
        scrapeStatus:        err.name === "TimeoutError" ? "timeout" : "error",
        errorMessage:        err.message,
      }
    }
  }

  // ── Extract individual listing URLs from a search/category page ──
  // queryKeywords: terms from the search query used to filter links to only relevant ones
  async getListingUrls(url: string, maxLinks = 3, queryKeywords: string[] = []): Promise<string[]> {
    if (!this.browser) throw new Error("Engine not launched")

    const context = await this.browser.newContext({
      userAgent:  this._randomUserAgent(),
      locale:     "en-AE",
      timezoneId: "Asia/Dubai",
      viewport:   { width: 1366, height: 768 },
    })

    try {
      // Block heavy resources — we only need the DOM
      await context.route("**/*", (route: any) => {
        if (["image", "font", "media", "stylesheet"].includes(route.request().resourceType()))
          route.abort()
        else
          route.continue()
      })

      const page = await context.newPage()
      await page.goto(url, { timeout: 15_000, waitUntil: "domcontentloaded" }).catch(() => {})

      const links: string[] = await page.evaluate(
        ({ pageUrl, keywords }: { pageUrl: string; keywords: string[] }) => {
          try {
            const baseHost = new URL(pageUrl).hostname
            const seen     = new Set<string>()
            const out: string[] = []

            for (const el of Array.from(document.querySelectorAll("a[href]"))) {
              const href = (el as HTMLAnchorElement).href
              if (!href || seen.has(href)) continue
              try {
                const u        = new URL(href)
                const segments = u.pathname.split("/").filter(Boolean)

                if (u.hostname !== baseHost) continue
                if (href === pageUrl)        continue
                if (segments.length < 3)     continue
                if (/[?&](page|sort|filter|order)=/i.test(u.search)) continue

                const pathLower = u.pathname.toLowerCase()

                // Must match at least one query keyword in the URL path
                // OR have a numeric listing ID (4+ consecutive digits) in the path
                const hasKeyword  = keywords.length > 0 && keywords.some((k) => pathLower.includes(k))
                const hasNumericId = /\/\d{4,}/.test(pathLower)

                if (!hasKeyword && !hasNumericId) continue

                seen.add(href)
                out.push(href)
              } catch { /* ignore malformed URLs */ }
            }
            return out
          } catch { return [] }
        },
        { pageUrl: url, keywords: queryKeywords }
      )

      logger.info("[B2CSearch] getListingUrls", { url, found: links.length, keywords: queryKeywords })
      return links.slice(0, maxLinks)

    } catch (err: any) {
      logger.warn("[B2CSearch] getListingUrls failed", { url, error: err.message })
      return []
    } finally {
      await context.close().catch(() => {})
    }
  }

  async _extractFirst(page: any, selectors: string[]): Promise<string | null> {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector)
        if (!element) continue

        const tagName = await element.evaluate((el: any) => el.tagName.toLowerCase())
        let text: string | null = null

        if (tagName === "meta") {
          text = await element.getAttribute("content")
        } else if (tagName === "input") {
          text = await element.getAttribute("value")
        } else {
          if (/\[data-price-/.test(selector)) {
            const attrVal = await element.getAttribute("data-price-amount")
            if (attrVal && attrVal.trim()) text = attrVal.trim()
          }
          if (!text || !(text as string).trim()) {
            text = await element.textContent()
          }
        }

        if (text && text.trim()) return text.trim()
      } catch {
        continue
      }
    }
    return null
  }

  _randomUserAgent(): string {
    const agents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    ]
    return agents[Math.floor(Math.random() * agents.length)]
  }
}
