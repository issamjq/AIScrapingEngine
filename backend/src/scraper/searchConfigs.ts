import { Page } from "playwright"

export interface SearchConfig {
  searchUrl:          string
  pageOptions:        Record<string, any>
  blockResources:     string[]
  waitForSelector:    string | null
  productUrlPattern?: RegExp
  resolveUrl?:        (query: string) => string
  extractProducts:    (page: Page, searchQuery?: string) => Promise<Array<{ name: string; url: string }>>
  postLoad?:          (page: Page, url: string, searchQuery?: string) => Promise<void>
  _searchQuery?:      string
}

const searchConfigs: Record<string, SearchConfig> = {
  "carrefour-uae": {
    searchUrl:        "https://www.carrefouruae.com/mafuae/en/search?query={query}",
    pageOptions:      { waitUntil: "commit", timeout: 30000 },
    blockResources:   ["font", "image", "media"],
    waitForSelector:  "a[href*=\"/p/\"]",
    productUrlPattern: /\/p\/\d+/,
    resolveUrl(query) {
      const brandPages: Record<string, string> = { marvis: "https://www.carrefouruae.com/mafuae/en/c/16302" }
      const q = query.toLowerCase().trim()
      return brandPages[q] || this.searchUrl.replace("{query}", encodeURIComponent(query))
    },
    async extractProducts(page) {
      return page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a[href*=\"/p/\"]"))
        const seen = new Set<string>(); const results: any[] = []
        for (const a of anchors) {
          const url = (a as HTMLAnchorElement).href.split("?")[0]
          if (!url || seen.has(url)) continue; seen.add(url)
          const nameEl = a.querySelector("[class*=\"line-clamp\"]") || a.querySelector("span") || a.querySelector("div") || a
          const name = (nameEl as HTMLElement).textContent?.trim() || ""
          if (name && url) results.push({ name, url })
        }
        return results
      })
    },
  },

  "amazon-ae": {
    searchUrl:        "https://www.amazon.ae/s?k={query}",
    pageOptions:      { waitUntil: "domcontentloaded", timeout: 30000 },
    blockResources:   ["image", "font", "media"],
    waitForSelector:  "[data-component-type=\"s-search-result\"]",
    productUrlPattern: /\/dp\/[A-Z0-9]{5,}/,
    async extractProducts(page) {
      return page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll("[data-component-type=\"s-search-result\"]"))
        const results: any[] = []
        for (const card of cards) {
          const titleEl = card.querySelector("h2 .a-link-normal span") || card.querySelector("h2 span")
          const name = titleEl ? (titleEl as HTMLElement).textContent?.trim() : ""
          const asin = (card as HTMLElement).dataset.asin || ""
          const url  = asin ? `https://www.amazon.ae/dp/${asin}` : ""
          if (name && url) results.push({ name, url })
        }
        return results
      })
    },
  },

  noon: {
    searchUrl:        "https://www.noon.com/uae-en/search/?q={query}",
    pageOptions:      { waitUntil: "domcontentloaded", timeout: 30000 },
    blockResources:   ["font", "media"],
    waitForSelector:  "a[href*=\"/p/\"]",
    productUrlPattern: /\/p\//,
    async extractProducts(page) {
      return page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a[href*=\"/p/\"]"))
        const seen = new Set<string>(); const results: any[] = []
        for (const a of anchors) {
          const url = (a as HTMLAnchorElement).href.split("?")[0]
          if (!url || seen.has(url)) continue
          const path = new URL(url).pathname
          if (path.split("/").filter(Boolean).length < 3) continue
          seen.add(url)
          const rawText = a.textContent || ""
          const name = rawText.replace(/@keyframes[\s\S]*?\}(\s*\})?/g, "").replace(/\s+/g, " ").trim()
          if (name && url) results.push({ name, url })
        }
        return results
      })
    },
  },

  talabat: {
    searchUrl:       "https://www.talabat.com/uae/grocery/600398/talabat-mart?aid=1244",
    pageOptions:     { waitUntil: "networkidle", timeout: 40000 },
    blockResources:  ["font", "media"],
    waitForSelector: "input",
    productUrlPattern: /\/item\/\d+/,
    async postLoad(page, _url, searchQuery) {
      const q = searchQuery || "marvis"
      const selectors = [
        "input[placeholder*=\"Search\"]",
        "input[type=\"search\"]",
        "input[type=\"text\"]",
        "input",
      ]
      let box: any = null
      for (const sel of selectors) {
        box = await page.$(sel).catch(() => null)
        if (box) break
      }
      if (!box) return
      await box.click()
      await box.fill("")
      for (const char of q) await box.type(char, { delay: 80 })
      await page.waitForTimeout(4000)
      await page.waitForSelector("a[href*=\"/item/\"]", { timeout: 10000 }).catch(() => {})
    },
    async extractProducts(page) {
      return page.evaluate(() => {
        const results: any[] = []; const seen = new Set<string>()
        const anchors = Array.from(document.querySelectorAll("a[href*=\"/item/\"]"))
        for (const a of anchors) {
          const url = (a as HTMLAnchorElement).href.split("?")[0]
          if (!url || seen.has(url)) continue
          if (!/\/item\/\d+/.test(url)) continue
          seen.add(url)
          const nameEl = a.querySelector("[class*=\"name\"], [class*=\"title\"], p, span")
          const name = ((nameEl?.textContent || a.textContent) || "").replace(/\s+/g, " ").trim()
          if (name.length > 3) results.push({ name, url })
        }
        return results
      })
    },
  },
}

function genericConfig(websiteUrl: string): SearchConfig {
  return {
    searchUrl:      `${websiteUrl || ""}/search?q={query}`,
    pageOptions:    { waitUntil: "domcontentloaded", timeout: 30000 },
    blockResources: ["image", "font", "media"],
    waitForSelector: null,
    async extractProducts(page) {
      return page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"))
        const seen = new Set<string>(); const results: any[] = []
        for (const a of anchors) {
          const href = (a as HTMLAnchorElement).href || ""
          if (!href.includes("product") && !href.match(/\/p\/|\/dp\/|\/item\//)) continue
          const url = href.split("?")[0]
          if (!url || seen.has(url)) continue; seen.add(url)
          const name = a.textContent?.trim() || ""
          if (name && url) results.push({ name, url })
        }
        return results
      })
    },
  }
}

export function getSearchConfig(slug: string, websiteUrl?: string): SearchConfig {
  return searchConfigs[slug] || genericConfig(websiteUrl || "")
}
