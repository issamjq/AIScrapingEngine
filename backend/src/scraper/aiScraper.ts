import { Page } from "playwright"
import { logger } from "../utils/logger"

const CLAUDE_API = "https://api.anthropic.com/v1/messages"

export async function extractWithVision(
  page: Page,
  currency = "AED",
  apiKey: string,
  searchQuery?: string
): Promise<{
  price: number | null
  originalPrice: number | null
  currency: string
  title: string | null
  availability: string
  rawPriceText: string | null
  rawTitleText: string | null
  rawAvailabilityText: string | null
}> {
  if (!apiKey) throw new Error("No ANTHROPIC_API_KEY")

  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {})

  const screenshotBuffer = await page.screenshot({
    type:     "jpeg",
    quality:  75,
    fullPage: false,
    clip:     { x: 0, y: 0, width: 1366, height: 768 },
  })
  const base64Image = screenshotBuffer.toString("base64")
  const pageUrl = page.url()

  const queryLine = searchQuery
    ? `\nTarget product being searched: "${searchQuery}"\n`
    : ""

  const prompt = `You are analyzing a product page screenshot from an e-commerce website (${pageUrl}).${queryLine}
Extract the following fields from what you see on screen and return ONLY a JSON object:

{
  "price": <number or null — the FINAL/discounted price the customer pays, e.g. 49.25>,
  "original_price": <number or null — the crossed-out/before-discount price, e.g. 65.00. null if no discount is shown>,
  "currency": "<3-letter currency code, e.g. AED, USD — default to ${currency} if unclear>",
  "title": "<full product name as shown on page, or null>",
  "availability": "<one of: in_stock, out_of_stock, unknown>"
}

Rules:
- price: the highlighted/current selling price (what customer pays now). Read the digits carefully.
- IMPORTANT: Some UAE sites use a custom currency symbol that looks like "Ð", "₫", "B", or a stylised "D" before the price — this is just their AED symbol, NOT a digit. Ignore it completely and read only the numeric digits. Example: "Ð 49.50" → price is 49.50, NOT 19.50 or 9.50.
- original_price: ONLY set if a strikethrough/was-price is visibly shown next to the current price; otherwise null
- title: the main product heading, include size/variant (e.g. "Marvis Classic Strong Mint 75ml")
- availability: "in_stock" if Add to Cart / Buy Now is active, "out_of_stock" if sold out, else "unknown"
- IMPORTANT: If the page shows a grid or list of multiple listings (classifieds, car ads, marketplace search results)${searchQuery ? ` and you know the target product is "${searchQuery}"` : ""}, find the listing card that BEST MATCHES the target product and extract its price and title. Do NOT pick a random card — look for the exact model/variant. If none match exactly, pick the closest match. Never return null just because multiple items are shown.
- Return ONLY the JSON object, no explanation, no markdown`

  const body = JSON.stringify({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{
      role:    "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Image } },
        { type: "text",  text: prompt },
      ],
    }],
  })

  const headers = {
    "x-api-key":         apiKey,
    "anthropic-version": "2023-06-01",
    "content-type":      "application/json",
  }

  let response = await fetch(CLAUDE_API, { method: "POST", headers, body })

  // Retry once on 429 — Tier 2 (450k tokens/min) makes this rare; 5s covers transient spikes
  if (response.status === 429) {
    logger.info("[AI Scraper] Vision 429 — waiting 5s then retrying", { url: pageUrl })
    await new Promise(r => setTimeout(r, 5_000))
    response = await fetch(CLAUDE_API, { method: "POST", headers, body })
  }

  if (!response.ok) {
    const err = await response.text().catch(() => "")
    throw new Error(`Claude Vision API ${response.status}: ${err}`)
  }

  const data    = await response.json()
  const rawText = data?.content?.[0]?.text || "{}"

  let parsed: any = {}
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch {
    logger.warn("[AI Scraper] Failed to parse Claude Vision response", { rawText })
  }

  logger.info("[AI Scraper] Vision extraction result", {
    url:          pageUrl,
    price:        parsed.price,
    title:        parsed.title,
    availability: parsed.availability,
  })

  return {
    price:               parsed.price          ?? null,
    originalPrice:       parsed.original_price ?? null,
    currency:            parsed.currency       || currency,
    title:               parsed.title          || null,
    availability:        mapAvailability(parsed.availability),
    rawPriceText:        parsed.price ? String(parsed.price) : null,
    rawTitleText:        parsed.title || null,
    rawAvailabilityText: parsed.availability || null,
  }
}

export async function extractImageUrl(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const get = (el: Element | null) => el
      ? (el.getAttribute("data-old-hires") || el.getAttribute("data-src") ||
         el.getAttribute("data-lazy-src")  || el.getAttribute("src") || null)
      : null

    const amz = document.querySelector("#landingImage, #imgTagWrapperId img")
    if (amz && get(amz) && !get(amz)!.includes("transparent-pixel")) return get(amz)

    const noon = Array.from(document.querySelectorAll("img")).find((img) => {
      const s = get(img) || ""
      return s.includes("f.nooncdn.com/p/") && !s.includes("/icons/") && !s.endsWith(".svg")
    })
    if (noon) return get(noon)

    const tal = Array.from(document.querySelectorAll("img")).find((img) => {
      const s = get(img) || ""
      return s.includes("dhmedia.io") || s.includes("talabat-cdn")
    })
    if (tal) return get(tal)

    const crf = document.querySelector('img[src*="mafrservices"], img[data-src*="mafrservices"]')
    if (crf && get(crf)) return get(crf)

    const mag = document.querySelector(".fotorama__img, .MagicZoomPlus img, .woocommerce-product-gallery__image img")
    if (mag && get(mag)) return get(mag)

    const og = document.querySelector('meta[property="og:image"]')
    if (og?.getAttribute("content")) return og.getAttribute("content")

    return null
  }).catch(() => null)
}

function mapAvailability(raw: string | undefined): string {
  if (!raw) return "unknown"
  const r = raw.toLowerCase()
  if (r === "in_stock" || r === "in stock") return "In Stock"
  if (r === "out_of_stock" || r === "out of stock") return "Out of Stock"
  return "unknown"
}
