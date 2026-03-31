const CURRENCY_MAP: Record<string, string> = {
  "aed":   "AED",
  "د.إ":   "AED",
  "dhs":   "AED",
  "dh":    "AED",
  "aed.":  "AED",
  "usd":   "USD",
  "$":     "USD",
  "sar":   "SAR",
  "﷼":    "SAR",
}

export function parsePrice(rawText: string | null, fallbackCurrency = "AED"): { price: number | null; currency: string } {
  if (!rawText || typeof rawText !== "string") {
    return { price: null, currency: fallbackCurrency }
  }

  const text = rawText.trim()
  let detectedCurrency = fallbackCurrency
  const lowerText = text.toLowerCase()

  for (const [symbol, code] of Object.entries(CURRENCY_MAP)) {
    if (lowerText.includes(symbol)) {
      detectedCurrency = code
      break
    }
  }

  let cleaned = text
    .replace(/aed\.?/gi, "")
    .replace(/د\.إ/g, "")
    .replace(/dhs?\.?/gi, "")
    .replace(/usd/gi, "")
    .replace(/sar/gi, "")
    .replace(/\$/g, "")
    .replace(/﷼/g, "")
    .replace(/price[:\s]*/gi, "")
    .replace(/[^\d.,]/g, "")
    .trim()

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "")
  } else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".")
  } else {
    cleaned = cleaned.replace(/,/g, "")
  }

  const match = cleaned.match(/\d+(\.\d+)?/)
  if (!match) return { price: null, currency: detectedCurrency }

  const price = parseFloat(match[0])
  if (isNaN(price) || price <= 0) return { price: null, currency: detectedCurrency }

  return { price: Math.round(price * 100) / 100, currency: detectedCurrency }
}

export function parseAvailability(rawText: string | null): string {
  if (!rawText || typeof rawText !== "string") return "unknown"

  const lower = rawText.toLowerCase().trim()

  const inStockPhrases = [
    "in stock", "available", "add to cart", "add to basket",
    "buy now", "متاح", "متوفر", "ships from",
  ]
  const outOfStockPhrases = [
    "out of stock", "unavailable", "sold out", "not available",
    "currently unavailable", "غير متاح", "نفذ", "out-of-stock",
  ]

  for (const phrase of inStockPhrases) {
    if (lower.includes(phrase)) return "in_stock"
  }
  for (const phrase of outOfStockPhrases) {
    if (lower.includes(phrase)) return "out_of_stock"
  }

  return rawText.trim().slice(0, 100)
}
