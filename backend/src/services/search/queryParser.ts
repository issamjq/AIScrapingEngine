// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 + 2 — Query Understanding & Category Classification
// Uses Claude Haiku to extract structured intent from a natural-language query
// ─────────────────────────────────────────────────────────────────────────────

import { callClaude }          from "../../utils/claudeClient"
import { logger }              from "../../utils/logger"
import { ProductIntent, ProductCategory } from "./types"

const CATEGORIES: ProductCategory[] = [
  "vehicles", "electronics", "furniture", "appliances", "fashion", "general",
]

// Map common location strings → ISO-2 country codes
const LOCATION_TO_COUNTRY: Record<string, string> = {
  "lebanon": "LB", "beirut": "LB", "lb": "LB", "tripoli": "LB", "saida": "LB",
  "uae": "AE", "dubai": "AE", "abu dhabi": "AE", "sharjah": "AE", "ae": "AE",
  "saudi": "SA", "ksa": "SA", "riyadh": "SA", "jeddah": "SA",
  "egypt": "EG", "cairo": "EG",
  "jordan": "JO", "amman": "JO",
  "kuwait": "KW",
  "qatar": "QA", "doha": "QA",
  "bahrain": "BH",
  "oman": "OM", "muscat": "OM",
}

export function detectCountry(location: string | null): string | null {
  if (!location) return null
  const lower = location.toLowerCase()
  for (const [key, code] of Object.entries(LOCATION_TO_COUNTRY)) {
    if (lower.includes(key)) return code
  }
  return null
}

export async function parseIntent(
  query:       string,
  apiKey:      string,
  countryHint: string
): Promise<ProductIntent> {
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)

  const fallback: ProductIntent = {
    product_type: "product",
    category:     "general",
    brand:        null,
    model:        null,
    attributes:   [],
    price_range:  { min: null, max: null },
    condition:    "any",
    location:     countryHint || null,
    country:      detectCountry(countryHint),
    keywords,
  }

  try {
    const data = await callClaude(apiKey, {
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages:   [{
        role:    "user",
        content:
          `Parse this product search query. Return ONLY raw JSON, no markdown, no explanation.\n` +
          `Query: "${query}"\n` +
          `Country hint from IP: "${countryHint}"\n\n` +
          `Rules:\n` +
          `- category must be one of: vehicles, electronics, furniture, appliances, fashion, general\n` +
          `- condition must be: new, used, or any\n` +
          `- location: the place mentioned in the query, or null\n` +
          `- keywords: the most important search terms, lowercase\n\n` +
          `{"product_type":"car","category":"vehicles","brand":"Infiniti","model":"G37","attributes":["2010","coupe","S"],` +
          `"price_range":{"min":null,"max":null,"currency":null},"condition":"used","location":"Lebanon","keywords":["infiniti","g37","2010","coupe"]}`,
      }],
    })

    const text  = data?.content?.[0]?.text || "{}"
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return fallback

    const p        = JSON.parse(match[0])
    const category: ProductCategory =
      CATEGORIES.includes(p.category) ? p.category : "general"

    // Location from query takes precedence over IP country hint
    const location: string | null = p.location || countryHint || null

    return {
      product_type: p.product_type || "product",
      category,
      brand:        p.brand                                             || null,
      model:        p.model                                             || null,
      attributes:   Array.isArray(p.attributes) ? p.attributes         : [],
      price_range:  p.price_range                                       || { min: null, max: null },
      condition:    ["new","used","any"].includes(p.condition)
                      ? p.condition : "any",
      location,
      country:      detectCountry(location),
      keywords:     Array.isArray(p.keywords) && p.keywords.length > 0
                      ? p.keywords : keywords,
    }

  } catch (err: any) {
    logger.warn("[Search] parseIntent failed", { error: err.message })
    return fallback
  }
}
